"use client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import type { CameraHandle } from '../CameraFeed';
import { emptyPose, type PoseResult } from '@/lib/ar/tracker';
import type { Homography } from '@/lib/ar/homography';

const KEY='buildsight:ar-overlay', EVENT='buildsight:ar-overlay-change';
function readEnabled(){try{return localStorage.getItem(KEY)==='on';}catch{return false;}}
function subscribe(listener:()=>void){window.addEventListener(EVENT,listener);window.addEventListener('storage',listener);return()=>{window.removeEventListener(EVENT,listener);window.removeEventListener('storage',listener);};}
function saveEnabled(on:boolean){try{localStorage.setItem(KEY,on?'on':'off');}catch{/* Private mode: the current tab still updates. */}window.dispatchEvent(new Event(EVENT));}
// Storage can be blocked. Keep a tab-local override, without reading window during server render.
let override:boolean|undefined;
const snapshot=()=>override??readEnabled();
const subscribePreference=(listener:()=>void)=>subscribe(listener);

type Reply={id:number;kind:'track'|'anchor';result:PoseResult|{pose:Homography;visible:number}|null;ms:number;error?:boolean};
export function useArGuide(cameraRef:RefObject<CameraHandle|null>,sourceKey:string) {
  const [live,setLive]=useState<{pose:PoseResult;fps:number;error:boolean;sourceKey:string}>({pose:emptyPose(),fps:0,error:false,sourceKey});
  const enabled=useSyncExternalStore(subscribePreference,snapshot,()=>false);
  const setEnabled=useCallback((on:boolean)=>{override=on;setLive({pose:emptyPose(),fps:0,error:false,sourceKey});saveEnabled(on);},[sourceKey]);
  const toggle=useCallback(()=>setEnabled(!snapshot()),[setEnabled]);
  const workerRef=useRef<Worker|null>(null),seqRef=useRef(0);
  const anchorsRef=useRef(new Map<number,(h:Homography|null)=>void>());
  const poseRef=useRef<PoseResult>(emptyPose());
  useEffect(()=>{
    if(!enabled)return;
    let worker:Worker;
    try{worker=new Worker(new URL('../../lib/ar/worker.ts',import.meta.url),{type:'module'});}catch{queueMicrotask(()=>setLive({pose:emptyPose('lost'),fps:0,error:true,sourceKey}));return;}
    workerRef.current=worker;
    let stopped=false,busy=false,raf=0,lastSent=0,lastReply=performance.now(),count=0,windowStart=performance.now(),fps=0;
    const requests=anchorsRef.current;
    const publish=(pose:PoseResult,error=false)=>{poseRef.current=pose;setLive({pose,fps,error,sourceKey});};
    worker.onmessage=(event:MessageEvent<Reply>)=>{
      if(stopped)return;
      const {id,kind,result,error}=event.data;
      if(kind==='anchor'){requests.get(id)?.(!error&&result&&'pose' in result?result.pose:null);requests.delete(id);return;}
      busy=false;lastReply=performance.now();count++;
      if(lastReply-windowStart>=1000){fps=count*1000/(lastReply-windowStart);windowStart=lastReply;count=0;}
      publish(!error&&result&&'state' in result?{...result,timestamp:lastSent}:emptyPose('lost'),!!error);
    };
    worker.onerror=()=>{publish(emptyPose('lost'),true);worker.terminate();workerRef.current=null;};
    function tick(now:number){
      if(stopped)return;
      if((document.hidden||now-lastReply>300)&&poseRef.current.pose)publish(emptyPose('lost'));
      if(!document.hidden&&!busy&&now-lastSent>=60&&workerRef.current){
        const frame=cameraRef.current?.sampleFrame?.();
        if(frame){busy=true;lastSent=now;worker.postMessage({id:++seqRef.current,kind:'track',frame},{transfer:[frame.data.buffer]});}
      }
      raf=requestAnimationFrame(tick);
    }
    raf=requestAnimationFrame(tick);
    return()=>{stopped=true;cancelAnimationFrame(raf);worker.terminate();workerRef.current=null;poseRef.current=emptyPose();for(const resolve of requests.values())resolve(null);requests.clear();};
  },[enabled,cameraRef,sourceKey]);

  const anchorFrame=useCallback(async(frame:string):Promise<Homography|null>=>{
    // Detect the exact JPEG sent to Check build, not the frame present when Claude replies.
    if(!workerRef.current||poseRef.current.state!=='tracking'||!poseRef.current.fresh)return null;
    try{
      const image=new Image();image.src=frame;await image.decode();
      if(!workerRef.current)return null;
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=Math.round(image.height*320/image.width);
      const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return null;
      ctx.drawImage(image,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
      return await new Promise(resolve=>{
        const id=++seqRef.current;
        const timer=setTimeout(()=>{anchorsRef.current.delete(id);resolve(null);},800);
        anchorsRef.current.set(id,h=>{clearTimeout(timer);resolve(h);});
        workerRef.current?.postMessage({id,kind:'anchor',frame:pixels},{transfer:[pixels.data.buffer]});
      });
    }catch{return null;}
  },[]);
  return {enabled,setEnabled,toggle,anchorFrame,pose:enabled&&live.sourceKey===sourceKey?live.pose:emptyPose(),fps:live.fps,error:enabled&&live.error};
}
export type ArGuide=ReturnType<typeof useArGuide>;
