// Runs the real worker/detector on synthetic camera frames. Only localhost, paid APIs mocked.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {markerFrame,DEFAULT_QUAD} from './ar-fixtures.mjs';
import {coverTransform,invert,project,solveHomography} from '../src/lib/ar/homography.ts';
import {MAT_QUAD} from '../src/lib/ar/mat.ts';
const base=process.env.E2E_BASE_URL||'http://localhost:3102';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const shifted=DEFAULT_QUAD.map(p=>({x:p.x+15,y:p.y+4}));
const frames=[markerFrame(),markerFrame({quad:shifted}),markerFrame({hidden:[3]}),markerFrame({hidden:[0,1,2,3]})].map(f=>Buffer.from(f.data).toString('base64'));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--use-fake-ui-for-media-stream']});
const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(({frames})=>{
 const canvas=document.createElement('canvas');canvas.width=320;canvas.height=400;const ctx=canvas.getContext('2d');
 const images=frames.map(b=>{const raw=atob(b),bytes=new Uint8ClampedArray(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return new ImageData(bytes,320,400);});
 window.__arFrame=0;ctx.putImageData(images[0],0,0);setInterval(()=>ctx.putImageData(images[window.__arFrame],0,0),33);
 Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>canvas.captureStream(30),configurable:true});
},{frames});
let release,checks=0;
await page.route('**/*',async route=>{
 const url=new URL(route.request().url());if(url.origin!==new URL(base).origin)return route.abort();
 if(url.pathname==='/api/check'){
  checks++;await new Promise(resolve=>release=resolve);
  return route.fulfill({json:{can_see:true,step_complete:false,confidence:.95,say:'Turn the brick.',issues:[{part:'red brick',problem:'rotated',fix:'Turn it.',kind:'orientation',box:{x:.35,y:.45,w:.1,h:.1}}]}});
 }
 if(url.pathname==='/api/locate')return route.fulfill({json:{callout:null,placed:null}});
 if(url.pathname.startsWith('/api/'))return route.fulfill({status:503,json:{error:'Offline test'}});
 return route.continue();
});
const overlay=page.locator('[data-ar-overlay]');
async function tracking(){await page.waitForFunction(()=>document.querySelector('[data-ar-overlay]')?.getAttribute('data-ar-state')==='tracking');}
async function hasColor(x,y,color){return page.locator('[data-ar-overlay]').evaluate((canvas,{x,y,color})=>{const ctx=canvas.getContext('2d'),scale=canvas.width/canvas.clientWidth;for(let i=-8;i<=8;i++)for(let j=-8;j<=8;j++){const p=ctx.getImageData(Math.round((x+i)*scale),Math.round((y+j)*scale),1,1).data;if(color==='cyan'?p[2]>200&&p[1]>140&&p[0]<150&&p[3]>100:p[0]>200&&p[1]<130&&p[2]<160&&p[3]>100)return true;}return false;},{x,y,color});}
try{
 await page.goto(base+'/ar/markers');assert.equal(await page.locator('[data-ar-marker]').count(),4);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=390),true);
 await page.getByLabel('Paper',{exact:true}).selectOption('Letter');
 await page.emulateMedia({media:'print'});const printSize=await page.locator('.marker-mat').boundingBox();assert.ok(Math.abs(printSize.width-180/25.4*96)<1);
 await page.pdf({path:'/tmp/buildsight-ar-letter.pdf',preferCSSPageSize:true,printBackground:true});await page.emulateMedia({media:'screen'});
 await page.evaluate(async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('keyval-store',1);r.onupgradeneeded=()=>r.result.createObjectStore('keyval');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 await new Promise((resolve,reject)=>{const t=db.transaction('keyval','readwrite');t.objectStore('keyval').put({id:'ar-smoke',source:'lego',title:'Parrot AR test',subtitle:'Synthetic camera',pdfPath:'/manual-pdf/lego/6455750.pdf',page:5,addedAt:Date.now(),openedAt:Date.now()},'manual:ar-smoke');t.oncomplete=resolve;t.onerror=()=>reject(t.error);});db.close();
 });
 await page.goto(base+'/build/ar-smoke');await page.getByRole('heading',{level:1}).waitFor();
 await page.getByRole('button',{name:'Voice on',exact:true}).click();const heading=await page.locator('h1').textContent();
 assert.equal(await page.getByRole('button',{name:'AR overlay',exact:true}).getAttribute('aria-pressed'),'false');
 await page.getByRole('button',{name:'AR overlay',exact:true}).click();await tracking();
 await page.getByRole('button',{name:'Pin target',exact:true}).click();await overlay.click({position:{x:195,y:465}});
 await page.getByRole('button',{name:'Done positioning',exact:true}).click();
 const pin=(await overlay.getAttribute('data-ar-pin')).split(',').map(Number);assert.equal(pin.length,2);assert.ok(await hasColor(195,465,'cyan'));
 await page.evaluate(()=>window.__arFrame=1);await page.waitForTimeout(600);
 const cover=coverTransform({w:320,h:400},{w:390,h:844}),h=solveHomography(MAT_QUAD,shifted.map(p=>({x:p.x/320,y:p.y/400}))),expected=project(cover,project(h,{x:pin[0],y:pin[1]}));
 assert.ok(await hasColor(expected.x,expected.y,'cyan'),'pin follows actual detector pose and cover crop');
 await page.evaluate(()=>window.__arFrame=2);await page.waitForTimeout(400);await tracking();assert.match(await page.getByRole('status').filter({hasText:'corner covered'}).textContent(),/corner covered/);
 await page.evaluate(()=>window.__arFrame=3);await page.waitForTimeout(400);assert.notEqual(await overlay.getAttribute('data-ar-state'),'tracking');
 assert.equal(await overlay.evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)),false,'lost tracking clears canvas');
 await page.evaluate(()=>window.__arFrame=0);await tracking();
 await page.getByRole('button',{name:'Check build',exact:true}).click();await page.waitForTimeout(250);assert.ok(release);
 await page.evaluate(()=>window.__arFrame=1);await page.waitForTimeout(400);release();
 await page.waitForFunction(()=>document.querySelector('[data-ar-overlay]')?.getAttribute('data-ar-anchored-issues')==='1');
 const old=solveHomography(MAT_QUAD,DEFAULT_QUAD.map(p=>({x:p.x/320,y:p.y/400}))),mat=project(invert(old),{x:.35,y:.45}),corner=project(cover,project(h,mat));
 assert.ok(await hasColor(corner.x,corner.y,'red'),'check box uses capture-time pose despite a delayed response');
 await page.screenshot({path:'/tmp/buildsight-ar-tracking.png'});
 await page.getByRole('button',{name:'AR overlay',exact:true}).click();assert.equal(await overlay.getAttribute('data-ar-state'),'off');assert.equal(await page.locator('h1').textContent(),heading);assert.equal(checks,1);
 assert.equal(await page.locator('[data-live-boxes]').count(),1,'old fallback returns with toggle off');
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.getByRole('button',{name:'AR overlay',exact:true}).click();await tracking();
 await page.locator('body').click({position:{x:2,y:440}});await page.keyboard.press('ArrowRight');
 await page.waitForFunction(h=>document.querySelector('h1')?.textContent!==h,heading);assert.equal(await overlay.getAttribute('data-ar-pin'),'','new active step clears target');
 await page.reload();await page.getByRole('heading',{level:1}).waitFor();assert.equal(await page.getByRole('button',{name:'AR overlay',exact:true}).getAttribute('aria-pressed'),'true');await tracking();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=390),true);assert.deepEqual(errors,[]);
 console.log('AR browser passed at 390x844: real worker, print scale, pin projection, 3 markers, lost/reacquired tracking, delayed check anchoring, fallback, step sync, preference and reduced motion.');
}catch(e){console.error(errors);await page.screenshot({path:'/tmp/buildsight-ar-failure.png'});throw e;}finally{await browser.close();}
