import assert from 'node:assert/strict';
import { limiter } from '../src/lib/limiter.ts';
import { stepLabel, spokenStep } from '../src/lib/stepLabels.ts';
const step={number:8,instruction:'Place the brick.'};
assert.equal(stepLabel(step),'Step 8');
assert.equal(spokenStep({...step,sub:'2/4'}),'Step 8, part 2 of 4. Place the brick.');
assert.equal(stepLabel({...step,continued:true}),'Step 8 · continued');
assert.equal(stepLabel({...step,continued:true,number:0}),'Continued');
assert.equal(spokenStep({...step,continued:true,number:0}),'Continuing. Place the brick.');
const limit=limiter(2); let running=0, peak=0;
const results=await Promise.allSettled(Array.from({length:8},(_,i)=>limit(async()=>{
 running++;peak=Math.max(peak,running); await new Promise(resolve=>setTimeout(resolve,1));running--;
 if(i===2) throw new Error('task failed');return i;
})));
assert.equal(peak,2);assert.equal(running,0);assert.equal(results[2].status,'rejected');assert.equal(results[7].status,'fulfilled');
console.log('Build helpers: labels and bounded queue release passed.');
