import assert from 'node:assert/strict';
import { recentManuals, uploadTitle, stepKeysFor } from '../src/lib/manuals.ts';
import { LEGO, IKEA, matches, categoriesOf, metaLine, toResult } from '../src/lib/catalog.ts';
import { firstJsonObject } from '../src/lib/json.ts';
import { parseWhereAmIResult } from '../src/lib/whereAmIResult.ts';
import { decide } from '../src/lib/whereAmI.ts';
globalThis.fetch=async()=>{throw new Error('Unexpected network call');};
const a={id:'a',openedAt:1},b={id:'b',openedAt:3};
const input=[a,undefined,b]; assert.deepEqual(recentManuals(input),[b,a]);assert.equal(input[0],a);
assert.equal(uploadTitle('my_manual-01.PDF'),'my manual 01');
assert.deepEqual(stepKeysFor('a.b',['steps:a.b:1','steps:v2:a.b:2','steps:v33:a.b:5','steps:axb:3','steps:ab:4','pdf:a.b',1]),['steps:a.b:1','steps:v2:a.b:2','steps:v33:a.b:5']);
assert.ok(LEGO.length && IKEA.length);
const item={source:'lego',name:'Test Parrot',category:'Creator',set:'31136',pieces:12,age:'7+',image:'cover',manuals:[{label:'Book 1',pdfPath:'/book.pdf'},{label:'Book 2',pdfPath:'/book2.pdf'}]};
assert.equal(matches(item,'PARROT 31136'),true);assert.equal(matches(item,'parrot table'),false);assert.equal(matches(item,'  '),true);
assert.deepEqual(categoriesOf([{category:'Unknown'},{category:'City'},{category:'Creator'},{category:'City'}]),['Creator','City','Unknown']);
assert.equal(metaLine(item),'#31136 · 12 pcs · 7+');assert.equal(metaLine({...item,source:'ikea'}),'2 manuals');
assert.deepEqual(toResult(item,item.manuals[0]),{source:'lego',title:'Test Parrot',subtitle:'LEGO 31136 · Book 1',coverUrl:'cover',pdfPath:'/book.pdf',sizeLabel:undefined});
assert.equal(toResult({...item,source:'ikea',itemNo:'123',manuals:[item.manuals[0]]},item.manuals[0]).subtitle,'IKEA 123');
for(const [raw,expected] of [
 ['```json\n{"a":1}\n```',{a:1}],['prose {bad} then {"ok":true}',{ok:true}],
 ['{"text":"a } and \\" {","nested":{"a":1}}',{text:'a } and " {',nested:{a:1}}],
 ['{"a":1} {"a":2}',{a:1}],['refusal text',null],['{"a":',null],
]) assert.deepEqual(firstJsonObject(raw),expected,raw);
const valid=new Set([0,1,2,3]);
const parsed=parseWhereAmIResult(JSON.stringify({completed_tile:2,confidence:2,broken:[{tile:3,problem:'future'},{tile:2,problem:'turned'},{tile:1,problem:'missing'},null]}),valid);
assert.equal(parsed.confidence,1);assert.deepEqual(parsed.broken.map(b=>b.tile),[1,2]);
for(const raw of ['no answer','{}','{"completed_tile":99,"confidence":0.9}','{"completed_tile":1,"confidence":"high"}','{"completed_tile":1,"confidence":1e999}']) assert.equal(parseWhereAmIResult(raw,valid),null);
const tiles=[1,2,3].map(n=>({tile:n,page:n,number:n,image:''}));
assert.equal(decide(parsed,tiles,true).action,'fix');
const result={completed_tile:1,confidence:.9,broken:[]};
assert.equal(decide(result,tiles,true).action,'goto');
assert.equal(decide(result,tiles,true,{page:2,number:2}).action,'stay');
assert.equal(decide({...result,confidence:.1},tiles,true,undefined,.3).action,'unsure');
assert.equal(decide({...result,completed_tile:3},tiles,true).action,'done');
assert.equal(decide({...result,completed_tile:3},tiles,false).action,'unsure');
console.log('Library: manual keys/titles/order, catalog, JSON and step recognition parsing/decisions passed.');
