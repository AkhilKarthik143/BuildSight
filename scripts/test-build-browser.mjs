// Browser regression smoke with a simulated camera and all paid endpoints mocked.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { installMockCamera } from './mock-camera.mjs';
const base=process.env.E2E_BASE_URL||'http://localhost:3102';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const page=await browser.newPage({viewport:{width:390,height:844},permissions:['camera']});
await installMockCamera(page);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let pass=false,hold=false,release;
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());
 if(url.origin!==new URL(base).origin)return route.abort();
 if(url.pathname==='/api/check'){
  if(hold){hold=false;await new Promise(resolve=>{release=resolve;});}
  return route.fulfill({json:{can_see:true,step_complete:pass,confidence:.95,say:pass?'Verified.':'Turn the brick.',issues:pass?[]:[{part:'red brick',problem:'rotated',fix:'Turn it.',kind:'orientation',box:{x:.2,y:.2,w:.1,h:.1}}]}});
 }
 if(url.pathname==='/api/locate')return route.fulfill({json:{callout:null,placed:null}});
 if(url.pathname==='/api/pair')return route.fulfill({json:{code:'ABC234'}});
 if(url.pathname==='/api/pair/events')return route.fulfill({contentType:'text/event-stream',body:'event: ready\ndata: {"code":"ABC234"}\n\n'});
 if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Offline browser test'}});
 return route.continue();
});
try{
 await page.goto(base);
 await page.evaluate(async()=>{
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('keyval-store',1);r.onupgradeneeded=()=>r.result.createObjectStore('keyval');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('keyval','readwrite');tx.objectStore('keyval').put({id:'hardening-smoke',source:'lego',title:'Parrot test',subtitle:'Offline regression',pdfPath:'/manual-pdf/lego/6455750.pdf',page:5,addedAt:Date.now(),openedAt:Date.now()},'manual:hardening-smoke');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
 });
 await page.goto(base+'/build/hardening-smoke');
 const heading=page.getByRole('heading',{level:1});await heading.waitFor();
 const first=await heading.textContent();
 await page.getByRole('button',{name:'Voice on',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);
 await page.getByRole('button',{name:'Check build',exact:true}).click();
 await page.locator('[data-issue-list]').waitFor();
 assert.ok(await page.locator('[data-issue-box]').count()>0);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'Collapse step card'}).click();
 await page.getByRole('button',{name:'Expand step card'}).click();
 const auto=page.getByRole('switch',{name:'Auto Mode: check each step automatically'});
 await auto.click();assert.equal(await auto.getAttribute('aria-checked'),'true');await auto.click();
 await page.getByRole('button',{name:'Auto speed: Normal'}).click();
 await page.getByRole('button',{name:'Fast',exact:true}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('buildsight:autoSpeed')),'1');
 await page.keyboard.press('Escape');
 pass=true;await page.getByRole('button',{name:'Check build',exact:true}).click();
 await page.waitForFunction(first=>document.querySelector('h1')?.textContent!==first,first);
 const second=await heading.textContent();assert.notEqual(second,first);
 await page.locator('body').click({position:{x:5,y:400}});await page.keyboard.press('ArrowLeft');
 await page.waitForFunction(first=>document.querySelector('h1')?.textContent===first,first);
 hold=true;pass=false;await page.getByRole('button',{name:'Check build',exact:true}).click();
 await page.waitForTimeout(300);assert.ok(release);
 await page.locator('body').click({position:{x:5,y:400}});await page.keyboard.press('ArrowRight');release();
 await page.waitForFunction(second=>document.querySelector('h1')?.textContent===second,second);
 await page.waitForTimeout(300);assert.equal(await page.locator('[data-issue-list]').count(),0,'old result not shown on new step');
 await page.getByRole('button',{name:'Go to step 8',exact:true}).first().click();
 await page.waitForTimeout(300);assert.ok(await heading.textContent());
 // Fork-only features must still work after the controller split.
 await page.getByLabel('Build options',{exact:true}).click();
 await page.getByRole('button',{name:'Show the build summary',exact:true}).click();
 await page.getByRole('dialog',{name:'Build summary',exact:true}).waitFor();
 assert.match(await page.getByRole('dialog',{name:'Build summary',exact:true}).textContent(),/Parrot test/);
 await page.getByRole('button',{name:'Close summary',exact:true}).click();
 await page.getByLabel('Build options',{exact:true}).click();
 await page.getByRole('button',{name:'Pair a phone camera',exact:true}).click();
 await page.getByRole('dialog',{name:'Pair a phone',exact:true}).waitFor();
 await page.getByLabel('Room code A B C 2 3 4').waitFor();
 await page.getByRole('button',{name:'Close pairing',exact:true}).click();
 await page.getByPlaceholder('Type a command').fill('show the summary');
 await page.getByRole('button',{name:'Send',exact:true}).click();
 await page.getByRole('dialog',{name:'Build summary',exact:true}).waitFor();
 await page.getByRole('button',{name:'Close summary',exact:true}).click();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=390),true,'no horizontal overflow');
 await page.getByLabel('Build options',{exact:true}).click();
 for(const label of ['Pair a phone camera','Show the build summary','Restart from step 1']) {
  const box=await page.getByRole('button',{name:label,exact:true}).boundingBox();
  assert.ok(box && box.x>=0 && box.x+box.width<=390,`${label} fits the phone`);
 }
 await page.getByLabel('Build options',{exact:true}).click();
 await page.screenshot({path:'/tmp/buildsight-hardening-mobile.png'});
 await page.goto(base+'/practice/parrot');await page.waitForTimeout(500);
 assert.equal(await page.title(),'Practice in AR · BuildSight');
 assert.deepEqual(errors,[]);
 console.log('390x844 browser smoke passed: manual, camera, checks/error boxes, auto preferences, collapse, pass advancement, navigation, stale result rejection, pairing, summary command and practice route.');
}catch(error){console.error('Browser errors:', errors);console.error(await page.locator('nextjs-portal').evaluateAll(nodes=>nodes.map(n=>n.shadowRoot?.textContent?.slice(-6000))));await page.screenshot({path:'/tmp/buildsight-hardening-failure.png'});throw error;}finally{await browser.close();}
