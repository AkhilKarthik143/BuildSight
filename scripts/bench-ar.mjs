import assert from 'node:assert/strict';
import {createDetector} from '../src/lib/ar/detector.ts';
import {markerFrame} from './ar-fixtures.mjs';
const detector=createDetector(),frame=markerFrame({noise:20});
for(let i=0;i<10;i++)detector.detect(frame);
const times=[];
for(let i=0;i<60;i++){const start=performance.now();assert.equal(detector.detect(frame).length,4);times.push(performance.now()-start);}
times.sort((a,b)=>a-b);const mean=times.reduce((a,b)=>a+b)/times.length,p95=times[Math.floor(times.length*.95)];
console.log(`Synthetic ${frame.width}x${frame.height} detector: mean ${mean.toFixed(2)} ms, p95 ${p95.toFixed(2)} ms/frame; local machine, not phone FPS.`);
assert.ok(p95<60,'Detector p95 exceeds 60ms/frame on this machine');
