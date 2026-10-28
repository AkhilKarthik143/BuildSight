// Every provider call goes through this mock; no credentials are read from .env files.
import assert from 'node:assert/strict';
process.env.ANTHROPIC_API_KEY='';process.env.OPENROUTER_API_KEY='';
let calls=[], reply;
globalThis.fetch=async(url,init)=>{
 const req=new Request(url,init);const body=await req.json();
 calls.push({url:req.url,headers:req.headers,body});
 assert.equal(Object.hasOwn(body,'temperature'),false,'never send temperature');
 if(!reply) throw new Error('Unexpected network call');
 return reply(req,body);
};
const {askClaude,streamClaude,ClaudeError,claudeConfigured}=await import('../src/lib/claude.ts');
const ask={system:'test',parts:[{type:'text',text:'hello'},{type:'image',dataUrl:'data:image/png;base64,YQ=='}]};
assert.equal(claudeConfigured(),false);
await assert.rejects(()=>askClaude(ask),e=>e instanceof ClaudeError && e.status===500);assert.equal(calls.length,0);
process.env.OPENROUTER_API_KEY='offline-openrouter-placeholder';
reply=()=>Response.json({choices:[{message:{content:'router answer'}}]});
assert.equal(await askClaude(ask),'router answer');
assert.equal(calls.at(-1).url,'https://openrouter.ai/api/v1/chat/completions');
assert.equal(calls.at(-1).headers.get('authorization'),'Bearer offline-openrouter-placeholder');
assert.equal(calls.at(-1).body.max_tokens,16000);
assert.equal(calls.at(-1).body.messages[1].content[1].image_url.url,ask.parts[1].dataUrl);
assert.equal(claudeConfigured(),true);
let chunks=[];for await(const chunk of streamClaude('test',[{role:'user',text:'question'}]))chunks.push(chunk);
assert.deepEqual(chunks,['router answer']);
reply=()=>new Response('offline-openrouter-placeholder SECRET upstream',{status:400});
await assert.rejects(()=>askClaude(ask),e=>e.status===502 && !/placeholder|SECRET/.test(e.message));
reply=()=>{throw new Error('SECRET transport headers');};
await assert.rejects(()=>askClaude(ask),e=>e instanceof ClaudeError && !/SECRET/.test(e.message));
reply=()=>new Response('SECRET malformed upstream reply');
await assert.rejects(()=>askClaude(ask),e=>e instanceof ClaudeError && !/SECRET/.test(e.message));
reply=()=>Response.json({choices:[{message:{content:{unexpected:true}}}]});
await assert.rejects(()=>askClaude(ask),e=>e instanceof ClaudeError);
process.env.ANTHROPIC_API_KEY='offline-anthropic-placeholder';
const msg={id:'msg_test',type:'message',role:'assistant',model:'mock',content:[{type:'text',text:'anthropic answer'}],stop_reason:'end_turn',stop_sequence:null,usage:{input_tokens:1,output_tokens:1}};
reply=()=>Response.json(msg);
assert.equal(await askClaude({...ask,effort:'medium'}),'anthropic answer');
assert.match(calls.at(-1).url,/api\.anthropic\.com\/v1\/messages/);
assert.equal(calls.at(-1).headers.get('authorization'),'Bearer offline-anthropic-placeholder');
assert.equal(calls.at(-1).body.output_config.effort,'medium');
assert.equal(calls.at(-1).body.max_tokens,16000);
assert.equal(calls.at(-1).body.messages[0].content[1].source.media_type,'image/png');
const count=calls.length;
await assert.rejects(()=>askClaude({system:'test',parts:[{type:'image',dataUrl:'https://evil.test/image'}]}),e=>e.status===400);
assert.equal(calls.length,count,'invalid data URL never sent');
reply=()=>Response.json({...msg,stop_reason:'refusal'});
await assert.rejects(()=>askClaude(ask),e=>e.status===422);
for(const status of [400,401,429]){
 reply=()=>Response.json({type:'error',error:{type:status===401?'authentication_error':status===429?'rate_limit_error':'invalid_request_error',message:'SECRET offline-anthropic-placeholder'}},{status,headers:{'x-should-retry':'false'}});
 await assert.rejects(()=>askClaude(ask),e=>e instanceof ClaudeError&&!/SECRET|placeholder/.test(e.message));
}
const events=[
 {type:'message_start',message:{...msg,content:[],stop_reason:null,usage:{input_tokens:1,output_tokens:0}}},
 {type:'content_block_start',index:0,content_block:{type:'text',text:''}},
 {type:'content_block_delta',index:0,delta:{type:'text_delta',text:'Hello.'}},
 {type:'content_block_stop',index:0},
 {type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:1}},
 {type:'message_stop'},
];
reply=()=>new Response(events.map(e=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}});
chunks=[];for await(const chunk of streamClaude('test',[{role:'user',text:'look',image:ask.parts[1].dataUrl},{role:'assistant',text:'ok'},{role:'user',text:'next?'}]))chunks.push(chunk);
assert.deepEqual(chunks,['Hello.']);
assert.equal(calls.at(-1).body.stream,true);assert.equal(calls.at(-1).body.max_tokens,2000);
assert.equal(calls.at(-1).body.output_config.effort,'low');assert.equal(calls.at(-1).body.messages.length,3);
reply=()=>Response.json({type:'error',error:{type:'invalid_request_error',message:'SECRET offline-anthropic-placeholder'}},{status:400,headers:{'x-should-retry':'false'}});
await assert.rejects(async()=>{for await(const ignored of streamClaude('test',[{role:'user',text:'x'}]))void ignored;},e=>!e.message.includes('SECRET'));
console.log('Claude: provider choice, payload settings, images, streaming/refusal and sanitized errors passed using mocked fetch only.');
