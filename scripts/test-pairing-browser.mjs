// Two real local SSE clients; only paid endpoints are mocked. No external host is allowed.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const base=process.env.E2E_BASE_URL||'http://localhost:3102';assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--use-fake-ui-for-media-stream']});
const desktop=await browser.newPage({viewport:{width:1280,height:800},serviceWorkers:'block'}),phone=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
const errors=[];let captured;
for(const [page,color] of [[desktop,'rgb(200,20,30)'],[phone,'rgb(20,200,30)']]){
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(color=>{const c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,640,480);setInterval(()=>ctx.fillRect(0,0,640,480),100);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>c.captureStream(10)});},color);
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin!==new URL(base).origin)return route.abort();
  if(url.pathname==='/api/check'){captured=route.request().postDataJSON().frame;return route.fulfill({json:{can_see:true,step_complete:false,confidence:.9,issues:[],say:'Phone frame received.'}});}
  if(url.pathname==='/api/locate')return route.fulfill({json:{callout:null,placed:null}});
  if(url.pathname.startsWith('/api/')&&!url.pathname.startsWith('/api/pair'))return route.fulfill({status:503,json:{error:'No paid calls in tests'}});
  return route.continue();
 });
}
try{
 await desktop.goto(base);await desktop.evaluate(async()=>{const db=await new Promise(resolve=>{const r=indexedDB.open('keyval-store',1);r.onupgradeneeded=()=>r.result.createObjectStore('keyval');r.onsuccess=()=>resolve(r.result);});await new Promise(resolve=>{const t=db.transaction('keyval','readwrite');t.objectStore('keyval').put({id:'pair-smoke',source:'lego',title:'Pair test',subtitle:'Local',pdfPath:'/manual-pdf/lego/6455750.pdf',page:5,addedAt:Date.now(),openedAt:Date.now()},'manual:pair-smoke');t.oncomplete=resolve;});db.close();});
 await desktop.goto(base+'/build/pair-smoke');await desktop.locator('h1').waitFor();await desktop.getByRole('button',{name:'Voice on',exact:true}).click();
 await desktop.getByLabel('Build options',{exact:true}).click();await desktop.getByRole('button',{name:'Pair a phone camera',exact:true}).click();
 await desktop.locator('[aria-label^="Room code "]').waitFor();const code=(await desktop.locator('[aria-label^="Room code "]').textContent()).trim();
 await phone.goto(base+'/pair/'+code);await desktop.getByRole('button',{name:'Use phone camera',exact:true}).waitFor();
 await desktop.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Use phone camera')?.disabled);
 await desktop.getByRole('button',{name:'Use phone camera',exact:true}).click();await desktop.getByRole('button',{name:'Close pairing',exact:true}).click();
 await desktop.getByRole('img',{name:'Phone camera',exact:true}).waitFor();await desktop.getByRole('button',{name:'Check build',exact:true}).click();
 await phone.getByText('Phone frame received.',{exact:true}).waitFor();
 const color=await desktop.evaluate(async src=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=c.height=1;const ctx=c.getContext('2d');ctx.drawImage(img,0,0,1,1);return Array.from(ctx.getImageData(0,0,1,1).data);},captured);
 assert.ok(color[1]>170&&color[0]<50,'Check build sent the phone image, not the laptop image');
 await desktop.locator('body').click({position:{x:5,y:400}});await desktop.keyboard.press('ArrowRight');await phone.getByText(/Laptop is on page .* step 2\./).waitFor();
 await phone.getByLabel('Note to the laptop').fill('Ready on the phone');await phone.getByRole('button',{name:'Send',exact:true}).click();
 await desktop.getByLabel('Build options',{exact:true}).click();await desktop.getByRole('button',{name:'Pair a phone camera',exact:true}).click();await desktop.getByText('Ready on the phone',{exact:true}).waitFor();
 await desktop.getByRole('button',{name:'Use laptop camera',exact:true}).click();await desktop.getByRole('button',{name:'Disconnect',exact:true}).click();await desktop.getByRole('button',{name:'Close pairing',exact:true}).click();assert.equal(await desktop.getByRole('img',{name:'Phone camera',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('Pairing browser passed: two clients, remote camera check, step/check feedback, transcript and source switching.');
}catch(e){await desktop.screenshot({path:'/tmp/buildsight-pairing-failure.png'});throw e;}finally{await browser.close();}
