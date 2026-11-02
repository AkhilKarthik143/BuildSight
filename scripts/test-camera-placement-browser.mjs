import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installMockCamera } from './mock-camera.mjs';
const base=process.env.E2E_BASE_URL||'http://localhost:3102';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--use-fake-ui-for-media-stream']});
const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
await installMockCamera(page);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let mode='ready', release, calls=0, checks=0, sent;
const answer={canSee:true,confidence:.9,target:{x:.53,y:.51,w:.07,h:.09},source:{x:.43,y:.45,w:.06,h:.06},instruction:'Place the brown brick on the base, long side across.'};
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());if(url.origin!==new URL(base).origin)return route.abort();
 if(url.pathname==='/api/ar-guide') {
  calls++;sent=route.request().postDataJSON(); const thisMode=mode;
  if(thisMode==='hold')await new Promise(r=>release=r);
  try { return await route.fulfill(thisMode==='error'?{status:503,json:{error:'Missing key'}}:{json:thisMode==='empty'?{...answer,canSee:false,target:null,source:null,instruction:'Show the assembly clearly.'}:answer}); } catch { return; }
 }
 if(url.pathname==='/api/check'){checks++;return route.fulfill({json:{can_see:true,step_complete:false,confidence:.95,say:'Keep building.',issues:[]}});}
 if(url.pathname==='/api/locate')return route.fulfill({json:{callout:null,placed:null}});
 if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Offline test'}});
 return route.continue();
});
const layer=page.locator('[data-camera-placement]');
const visible=async expected=>page.waitForFunction(e=>document.querySelector('[data-camera-placement]')?.getAttribute('data-placement-visible')===String(e),expected);
async function suggest(){await page.getByRole('button',{name:/^(Show|Refresh) placement$/}).click();}
async function next(){await page.locator('body').click({position:{x:2,y:445}});await page.keyboard.press('ArrowRight');}
try {
 await page.goto(base);
 await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('keyval-store',1);r.onupgradeneeded=()=>r.result.createObjectStore('keyval');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('keyval','readwrite');tx.objectStore('keyval').put({id:'placement-smoke',source:'lego',title:'Parrot camera guide',subtitle:'Offline regression',pdfPath:'/manual-pdf/lego/6455750.pdf',page:5,addedAt:Date.now(),openedAt:Date.now()},'manual:placement-smoke');tx.oncomplete=resolve;tx.onerror=reject;});db.close();
 });
 await page.goto(base+'/build/placement-smoke');await page.locator('h1').waitFor();
 await page.getByRole('button',{name:'Voice on',exact:true}).click();await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);
 await page.getByRole('button',{name:'AR overlay',exact:true}).click();
 assert.equal(calls,0,'no automatic paid grounding');await suggest();await visible(true);
 assert.match(sent.frame,/^data:image\/jpeg/);assert.match(sent.expected,/^data:image\//);assert.ok(sent.part);assert.ok(sent.instruction);
 assert.equal(await layer.getAttribute('data-placement-mode'),'snapshot');
 const q=(await layer.getAttribute('data-placement-target')).split(' ').map(p=>p.split(',').map(Number));
 const expectedX=.53*(1280*844/720)+(390-1280*844/720)/2;
 assert.ok(Math.abs(q[0][0]-expectedX)<1);assert.ok(Math.abs(q[0][1]-.51*844)<1);
 assert.equal(await layer.locator('polygon').count(),2,'pickup and destination');
 await page.waitForTimeout(400);
 const panel=await page.getByRole('region',{name:'AR overlay controls'}).boundingBox();
 assert.ok(panel.y>Math.max(...q.map(p=>p[1]))+36,'controls leave the suggested brick and label visible');
 await page.screenshot({path:'/tmp/buildsight-camera-placement.png'});
 await page.getByRole('button',{name:'Adjust suggestion',exact:true}).click();
 const before=await layer.getAttribute('data-placement-target');await layer.click({position:{x:260,y:450}});
 assert.notEqual(await layer.getAttribute('data-placement-target'),before);
 await page.getByRole('button',{name:'Rotate 90°'}).click();await page.getByRole('button',{name:'Nudge suggestion →'}).click();
 await page.getByRole('button',{name:'Done adjusting',exact:true}).click();assert.equal(checks,0,'placement never runs Check');
 await page.evaluate(()=>window.moveMockCamera());await visible(false);await page.getByText('View changed — refresh the placement.').waitFor();
 await suggest();await visible(true);await next();await visible(false);await page.getByRole('button',{name:'Show placement',exact:true}).waitFor();
 mode='hold';release=undefined;await suggest();await page.waitForTimeout(250);assert.ok(release);const count=calls;
 assert.equal(await page.getByRole('button',{name:'Finding placement…'}).isDisabled(),true);assert.equal(calls,count);
 await next();release();await page.waitForTimeout(350);await visible(false);assert.equal(calls,count,'step changes do not issue hidden requests');
 mode='hold';release=undefined;await suggest();await page.waitForTimeout(200);await page.getByRole('button',{name:'Check',exact:true}).click();release();await page.waitForTimeout(300);await visible(false);assert.equal(checks,1,'check wins over pending grounding');
 mode='empty';await suggest();await page.getByText('Show the assembly clearly.').waitFor();await visible(false);
 mode='error';await suggest();await page.getByText(/Camera suggestions need a Claude API key/).waitFor();await visible(false);
 mode='ready';await suggest();await visible(true);await page.getByRole('button',{name:'AR overlay',exact:true}).click();await visible(false);
 await page.getByRole('button',{name:'AR overlay',exact:true}).click();await visible(false);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=390),true);assert.deepEqual(errors,[]);
 console.log('Camera placement browser passed: no-mat camera guidance, source/target crop, drag/rotate/nudge, movement invalidation, step cancellation, check priority, no visibility, missing key and toggle reset at 390x844.');
} catch(e) { await page.screenshot({path:'/tmp/buildsight-placement-failure.png'});throw e; } finally {await browser.close();}
