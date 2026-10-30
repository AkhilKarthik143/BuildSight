// Offline decision regression eval. Fixtures are synthetic recorded-format outputs, NOT accuracy measurements.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { parseCheckResult } from '../src/lib/checkResult.ts';
import { isPass, checkVerdict, issueMarkers, boxLocation } from '../src/lib/issueBox.ts';
globalThis.fetch=async()=>{throw new Error('Offline eval attempted network');};
const dir=new URL('./fixtures/check/',import.meta.url);
const labels=['pass','fix','notyet','unsure','invalid'];
const table=Object.fromEntries(labels.map(label=>[label,Object.fromEntries(labels.map(p=>[p,0]))]));
let failures=0,count=0;
for(const file of readdirSync(dir).filter(f=>f.endsWith('.json')).sort()){
 const fixture=JSON.parse(readFileSync(new URL(file,dir),'utf8'));count++;
 const result=parseCheckResult(fixture.raw ?? fixture.reply);
 const actual={verdict:result?checkVerdict(result):'invalid',pass:result?isPass(result):false,locations:result?issueMarkers(result.issues).map(m=>boxLocation(m.box)):[]};
 const expected=fixture.expected ?? {verdict:fixture.verdict === 'unparsed' ? 'invalid' : fixture.verdict,pass:fixture.pass,locations:fixture.locations};
 table[expected.verdict][actual.verdict]++;
 try {assert.deepEqual(actual,expected,fixture.name ?? file);
 if(fixture.confidence !== undefined) assert.equal(result?.confidence,fixture.confidence);
 if(fixture.issues !== undefined) assert.equal(result?.issues.length,fixture.issues);}catch(e){failures++;console.error(e.message);}
}
console.log('Expected rows → predicted columns (hand-authored offline fixtures):');
console.table(table);
console.log(`${count-failures}/${count} fixtures matched; this is not real-camera accuracy.`);
if(count<12||failures)process.exitCode=1;
