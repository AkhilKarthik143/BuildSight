// Local HTTP integration test. Run a server with provider keys unset; never targets a public host.
import assert from 'node:assert/strict';
const base=process.env.E2E_BASE_URL||'http://localhost:3102';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname));
for(const path of ['/','/practice/parrot']){
 const r=await fetch(base+path);assert.equal(r.status,200,path);
 assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 assert.equal(r.headers.get('referrer-policy'),'strict-origin-when-cross-origin');
 assert.match(r.headers.get('permissions-policy'),/camera=\(self\), microphone=\(self\)/);
 await r.arrayBuffer();
}
for(const name of ['check','assist','extract','locate','where-am-i','vision','tts']){
 for(const body of ['{','null','[]','{"question":12,"text":12}']) {
  const r=await fetch(`${base}/api/${name}`,{method:'POST',headers:{'content-type':'application/json','x-forwarded-for':'192.0.2.81'},body});
  assert.equal(r.status,400,`${name}: ${body}`);
 }
}
const huge=await fetch(base+'/api/tts',{method:'POST',body:' '.repeat(65537),headers:{'x-forwarded-for':'192.0.2.82'}});assert.equal(huge.status,413);
const blocked=await fetch(base+'/api/search?q='+encodeURIComponent('http://127.0.0.1/private'),{headers:{'x-forwarded-for':'192.0.2.83'}});assert.equal(blocked.status,400);
const headers={'x-forwarded-for':'192.0.2.84'};
// One-letter search is a valid cheap response with zero upstream fetches.
const responses=await Promise.all(Array.from({length:40},()=>fetch(base+'/api/search?q=a',{headers})));
const throttled=responses.filter(r=>r.status===429);assert.ok(throttled.length>0);
assert.ok(responses.some(r=>r.status===200));
const retry=Math.max(...throttled.map(r=>Number(r.headers.get('retry-after'))));
assert.ok(retry>0&&retry<=3);
await new Promise(resolve=>setTimeout(resolve,(retry+0.2)*1000));
assert.equal((await fetch(base+'/api/search?q=a',{headers})).status,200);
console.log(`HTTP smoke passed: pages/headers, seven POST validation paths, 413, search rejection, ${throttled.length}/40 rate rejections, refill recovery.`);
