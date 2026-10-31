"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
import {parsePairMessage,type PairMessage} from '@/lib/pairing/schema';
import {checkVerdict} from '@/lib/issueBox';
import type {BuildState} from './useBuildState';

async function send(code:string,message:PairMessage):Promise<boolean>{
 try{return (await fetch('/api/pair/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,message})})).ok;}catch{return false;}
}
export function useBuildPairing(s:Pick<BuildState,'page'|'step'|'check'|'checkSeq'|'setCheckState'|'setAdvance'>){
 const [code,setCode]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[last,setLast]=useState<PairMessage|null>(null);
 const [frame,setFrame]=useState<string|null>(null),[usePhone,setUsePhone]=useState(false);
 const roomRef=useRef<string|null>(null),sourceRef=useRef<EventSource|null>(null),busyRef=useRef(false),frameTimeRef=useRef(0),generationRef=useRef(0);
 const disconnect=useCallback(()=>{generationRef.current++;sourceRef.current?.close();sourceRef.current=null;roomRef.current=null;busyRef.current=false;setCode(null);setFrame(null);setUsePhone(false);setLast(null);},[]);
 useEffect(()=>()=>{generationRef.current++;sourceRef.current?.close();},[]);
 const create=useCallback(async()=>{
  if(roomRef.current||busyRef.current)return;
  busyRef.current=true;setError(null);const generation=generationRef.current;
  try{
   const res=await fetch('/api/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create'})});
   const body=await res.json();if(generation!==generationRef.current)return;
   if(!res.ok||typeof body.code!=='string')throw Error('Could not open a room. Try again.');
   roomRef.current=body.code;setCode(body.code);
   const source=new EventSource(`/api/pair/events?code=${body.code}`);sourceRef.current=source;
   source.onmessage=event=>{try{const msg=parsePairMessage(JSON.parse(event.data));if(!msg)return;setLast(msg);if(msg.type==='frame'){frameTimeRef.current=Date.now();setFrame(msg.image);setError(null);}}catch{/* ignore malformed events */}};
   source.onerror=()=>setError('Connection interrupted. Keep the phone page open.');
  }catch{setError('Could not open a pairing room. Try again.');}finally{busyRef.current=false;}
 },[]);
 useEffect(()=>{const timer=setInterval(()=>{if(frameTimeRef.current&&Date.now()-frameTimeRef.current>4000)setFrame(null);},1000);return()=>clearInterval(timer);},[]);
 const publish=useCallback(async(message:PairMessage)=>{
  const room=roomRef.current;if(!room)return;
  try{const res=await fetch('/api/pair/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:room,message})});if(!res.ok)setError('Could not send the update to the phone.');}catch{setError('Could not send the update to the phone.');}
 },[]);
 const {page,step,check,checkSeq:checkSeqRef,setCheckState,setAdvance}=s;
 const stepNumber=step?.number;
 const connected=!!frame;
 useEffect(()=>{
  if(code&&stepNumber!=null)void send(code,{type:'step',page,step:stepNumber}).then(ok=>{if(!ok)setError('Could not send the step to the phone.');});
 },[code,page,stepNumber,connected]);
 useEffect(()=>{
  if(code&&check?.state==='result')void send(code,{type:'check',verdict:checkVerdict(check.result),say:check.result.say}).then(ok=>{if(!ok)setError('Could not send the check to the phone.');});
 },[code,check]);
 const selectCamera=useCallback((phone:boolean)=>{
  // A response from the old camera must never appear over the newly selected camera.
  checkSeqRef.current++;setCheckState(null);setAdvance(null);setUsePhone(phone);
 },[checkSeqRef,setCheckState,setAdvance]);
 return {code,error,last,frame,usePhone,create,disconnect:()=>{if(usePhone)selectCamera(false);disconnect();},publish,selectCamera};
}
export type BuildPairing=ReturnType<typeof useBuildPairing>;
