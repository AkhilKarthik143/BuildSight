import assert from 'node:assert/strict';
import {boxQuad,convexQuad,coverTransform,createPoseSmoother,invert,project,projectQuad,solveHomography} from '../src/lib/ar/homography.ts';
import {createTracker,estimatePose} from '../src/lib/ar/tracker.ts';
import {createDetector} from '../src/lib/ar/detector.ts';
import {MARKERS,markerQuad,MAT_QUAD} from '../src/lib/ar/mat.ts';
import {supportsImmersiveAr} from '../src/lib/ar/xr.ts';
import {markerFrame,DEFAULT_QUAD} from './ar-fixtures.mjs';
globalThis.fetch=()=>{throw new Error('AR tests must stay offline');};
let seed=491;
const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
for(let i=0;i<200;i++) {
 const q=[{x:random()*.2,y:random()*.2},{x:.7+random()*.3,y:random()*.2},{x:.7+random()*.3,y:.7+random()*.3},{x:random()*.2,y:.7+random()*.3}];
 const h=solveHomography(MAT_QUAD,q);assert.ok(h);const inv=invert(h);
 for(let j=0;j<10;j++) { const p={x:random()*180,y:random()*220};const r=project(inv,project(h,p));assert.ok(Math.hypot(p.x-r.x,p.y-r.y)<1e-6); }
}
assert.equal(solveHomography(Array(4).fill({x:0,y:0}),MAT_QUAD),null);
assert.equal(invert([0,0,0,0,0,0,0,0,0]),null);
assert.equal(convexQuad([{x:0,y:0},{x:1,y:1},{x:0,y:1},{x:1,y:0}]),false);
assert.deepEqual(projectQuad([2,0,10,0,3,20,0,0,1],boxQuad({x:0,y:0,w:2,h:3})),[{x:10,y:20},{x:14,y:20},{x:14,y:29},{x:10,y:29}]);
for(const frame of [{w:1280,h:720},{w:720,h:1280}]) {
 const h=coverTransform(frame,{w:390,h:844});assert.deepEqual(project(h,{x:.5,y:.5}),{x:195,y:422});
 const p={x:.4,y:.7};const round=project(invert(h),project(h,p));assert.ok(Math.abs(round.x-p.x)<1e-9);
}
const smooth=createPoseSmoother(MAT_QUAD);let rawErr=0, smoothErr=0;
for(let i=0;i<120;i++) { const x=.2+(i%2?-.005:.005),h=[.003,0,x,0,.003,.1,0,0,1];const next=smooth.update(h,i*60);if(i>10){rawErr+=(x-.2)**2;smoothErr+=(project(next,{x:0,y:0}).x-.2)**2;} }
assert.ok(smoothErr<rawErr*.5,'smoother reduces alternating jitter');
const h=solveHomography(MAT_QUAD,DEFAULT_QUAD);
let visible=MARKERS.map(m=>({id:m.id,corners:projectQuad(h,markerQuad(m.id))}));
const detector={detect:()=>visible};const tracker=createTracker(detector),frame={width:320,height:400,data:new Uint8ClampedArray()};
visible=visible.slice(0,3);assert.equal(tracker.update(frame,0).state,'searching','need all four to acquire');
visible=MARKERS.map(m=>({id:m.id,corners:projectQuad(h,markerQuad(m.id))}));
assert.equal(tracker.update(frame,60).state,'tracking');
visible=visible.slice(0,3);let r=tracker.update(frame,120);assert.equal(r.partial,true);assert.equal(r.fresh,true);
visible=[];assert.equal(tracker.update(frame,180).state,'tracking');assert.equal(tracker.update(frame,240).fresh,false);assert.equal(tracker.update(frame,300).state,'lost');
for(let i=0;i<15;i++) r=tracker.update(frame,360+i*60);assert.equal(r.state,'searching');
visible=MARKERS.map(m=>({id:m.id,corners:projectQuad(h,markerQuad(m.id))}));assert.equal(tracker.update(frame,1400).state,'tracking');
assert.equal(estimatePose([...visible,visible[0]],320,400),null,'duplicate IDs rejected');
const bad=structuredClone(visible);bad[0].corners[0].x+=60;assert.equal(estimatePose(bad,320,400),null,'inconsistent mat rejected');
assert.equal(await supportsImmersiveAr({}),false);assert.equal(await supportsImmersiveAr({xr:{isSessionSupported:async()=>true}}),true);assert.equal(await supportsImmersiveAr({xr:{isSessionSupported:async()=>{throw Error();}}}),false);
// Actual detector on rasterized markers, including perspective, rotation and noise.
const real=createDetector();
for(const quad of [DEFAULT_QUAD,[{x:75,y:50},{x:260,y:18},{x:245,y:360},{x:45,y:330}],[{x:260,y:365},{x:65,y:360},{x:65,y:30},{x:255,y:30}]]) {
 const f=markerFrame({quad,noise:12}),markers=real.detect(f);assert.deepEqual(markers.map(m=>m.id).sort(),[0,1,2,3]);
 const fit=estimatePose(markers,f.width,f.height);assert.ok(fit);
 const predicted=project(fit.pose,{x:90,y:110}), expected=project(solveHomography(MAT_QUAD,quad),{x:90,y:110});
 assert.ok(Math.hypot(predicted.x*f.width-expected.x,predicted.y*f.height-expected.y)<3,'real detection centre within 3px on synthetic raster');
}
assert.deepEqual(real.detect(markerFrame({hidden:[0,1,2,3]})),[]);
console.log('AR passed: 2,000 homography round trips, projection/crop/rotation, smoothing, loss/reacquisition/3-marker tracking, XR and real synthetic marker detection.');
