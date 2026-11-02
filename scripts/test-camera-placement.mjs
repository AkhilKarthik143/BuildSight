import assert from 'node:assert/strict';
import { parseCameraPlacement, targetQuad, center, moveQuad, rotateQuad } from '../src/lib/ar/placement.ts';
import { coverTransform, projectQuad } from '../src/lib/ar/homography.ts';
import { validApiInput } from '../src/lib/apiInput.ts';
import { CLAUDE_ROUTES, createRateLimiter } from '../src/lib/rateLimit.ts';
import { BODY_LIMITS, withApiGuard } from '../src/lib/apiGuard.ts';
const good = { canSee: true, confidence: .9, target: { x: .4, y: .5, w: .12, h: .08 }, source: { x: .3, y: .7, w: .1, h: .08 }, instruction: 'Place on the base.' };
assert.deepEqual(parseCameraPlacement(JSON.stringify(good)), good);
for (const value of [null, {}, { ...good, confidence: NaN }, { ...good, confidence: '0.9' }, { ...good, canSee: 'yes' }, { ...good, confidence: 2 }]) assert.equal(parseCameraPlacement(value), null);
for (const value of [{ ...good, canSee: false }, { ...good, confidence: .69 }, ...[null, {}, {x:'0',y:0,w:.1,h:.1}, {x:0,y:0,w:Infinity,h:.1}, {x:.9,y:0,w:.2,h:.1}, {x:0,y:0,w:-.1,h:.1}].map(target => ({...good,target}))]) {
 const parsed = parseCameraPlacement(value); assert.equal(parsed.target, null); assert.equal(parsed.source, null);
}
assert.equal(parseCameraPlacement({...good,source:{x:-1,y:0,w:.1,h:.1}}).source,null);
assert.equal(parseCameraPlacement({...good,instruction:'x'.repeat(500)}).instruction.length,220);
const q=targetQuad(good), c=center(q), rotated=rotateQuad(q);
assert.deepEqual(center(rotated),c); assert.ok(Math.abs(rotated[1].y-rotated[0].y-.12)<1e-10);
assert.ok(Math.abs(center(moveQuad(q,.1,-.1)).x-c.x-.1)<1e-10);
const screen=projectQuad(coverTransform({w:1280,h:720},{w:390,h:844}),q);
assert.ok(Math.abs(screen[0].x-44.95555555555552)<1e-6,'object-cover crops the full frame, not viewport percentages');
const image='data:image/jpeg;base64,YQ==', input={frame:image,expected:image,instruction:'Place the brick',part:'red 2x4 brick'};
assert.equal(validApiInput('ar-guide',input),true);
for(const change of [{frame:'https://evil/frame.jpg'},{expected:'x'},{part:''},{instruction:'x'.repeat(4001)}]) assert.equal(validApiInput('ar-guide',{...input,...change}),false);
assert.ok(CLAUDE_ROUTES.has('ar-guide'));assert.equal(BODY_LIMITS['ar-guide'],12*1024*1024);
const limits=createRateLimiter();for(let i=0;i<6;i++)assert.equal(limits.take('test','ar-guide',0).ok,true);assert.equal(limits.take('test','ar-guide',0).ok,false);
let calls=0;const handler=withApiGuard('ar-guide',()=>{calls++;return Response.json(good);});
const request=body=>new Request('http://local/api/ar-guide',{method:'POST',body:JSON.stringify(body)});
assert.equal((await handler(request({...input,part:''}))).status,400);assert.equal(calls,0);
assert.equal((await handler(request(input))).status,200);assert.equal(calls,1);
console.log('Camera placement passed: conservative parsing, no invisible/low-confidence targets, geometry, input bounds and paid-route limits.');
