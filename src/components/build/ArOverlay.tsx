"use client";
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { boxQuad, coverTransform, invert, project, projectQuad, type Point, type Quad } from '@/lib/ar/homography';
import { onMat } from '@/lib/ar/mat';
import { checkVerdict, issueMarkers } from '@/lib/issueBox';
import type { BuildModel } from './useBuildModel';

function outline(ctx:CanvasRenderingContext2D,points:Quad,color:string,fill:string,dashed=false){
 ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.setLineDash(dashed?[6,4]:[]);ctx.stroke();ctx.setLineDash([]);
}
// Two affine triangles approximate the small planar cutout; no 3D asset or extra render loop.
function drawCutout(ctx:CanvasRenderingContext2D,image:HTMLImageElement,p:Quad){
 const w=image.naturalWidth,h=image.naturalHeight;
 for(const tri of [[0,1,3],[2,3,1]]){
  const [a,b,c]=tri.map(i=>p[i]);ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.clip();
  if(tri[0]===0)ctx.transform((b.x-a.x)/w,(b.y-a.y)/w,(c.x-a.x)/h,(c.y-a.y)/h,a.x,a.y);
  else ctx.transform((a.x-b.x)/w,(a.y-b.y)/w,(a.x-c.x)/h,(a.y-c.y)/h,b.x+c.x-a.x,b.y+c.y-a.y);
  ctx.globalAlpha=.7;ctx.drawImage(image,0,0);ctx.restore();
 }
}
type Props={model:Pick<BuildModel,'ar'|'camera'|'check'|'showBoxes'|'issuePick'|'step'|'holoItems'|'phase'>};
export default function ArOverlay({model}:Props){
 const {ar,camera:cameraRef,check,showBoxes,issuePick,step,holoItems,phase}=model;
 const canvasRef=useRef<HTMLCanvasElement>(null);
 const [pin,setPin]=useState<Point|null>(null),[placing,setPlacing]=useState(false),[size,setSize]=useState({w:0,h:0});
 const [piece,setPiece]=useState(0);
 const imageRef=useRef<HTMLImageElement|null>(null);
 const cut=holoItems?.[piece]?.cut?.image;
 const tracking=ar.enabled&&ar.pose.state==='tracking'&&!!ar.pose.pose;
 useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const observer=new ResizeObserver(()=>setSize({w:canvas.clientWidth,h:canvas.clientHeight}));observer.observe(canvas);return()=>observer.disconnect();},[]);
 useEffect(()=>{imageRef.current=null;if(!cut)return;const image=new Image();image.src=cut;image.onload=()=>{imageRef.current=image;};return()=>{image.onload=null;imageRef.current=null;};},[cut]);
 useEffect(()=>{
  const canvas=canvasRef.current,ctx=canvas?.getContext('2d'),frame=cameraRef.current?.size();if(!canvas||!ctx||!frame||!size.w||!size.h)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=size.w*dpr;canvas.height=size.h*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,size.w,size.h);
  if(!tracking||!ar.pose.pose)return;
  const pose=ar.pose.pose,cover=coverTransform(frame,size);
  const toScreen=(q:Quad)=>{const camera=projectQuad(pose,q);return camera&&projectQuad(cover,camera);};
  if(check?.state==='result'&&checkVerdict(check.result)==='fix'&&check.arPose&&showBoxes){
   const inverse=invert(check.arPose);
   if(inverse)for(const mark of issueMarkers(check.result.issues)){
    const mat=projectQuad(inverse,boxQuad(mark.box)),points=mat&&toScreen(mat);if(!points)continue;
    ctx.globalAlpha=issuePick==null||issuePick===mark.n-1?1:.35;
    outline(ctx,points,'#ff5868','rgba(255,65,90,.15)',mark.category==='missing');
    ctx.fillStyle='#ff5868';ctx.fillRect(points[0].x-1,points[0].y-20,27,20);ctx.fillStyle='white';ctx.font='bold 12px sans-serif';ctx.fillText(`! ${mark.n}`,points[0].x+3,points[0].y-6);
   }
  }
  ctx.globalAlpha=1;
  if(pin&&phase.kind==='ready'){
   const points=toScreen(boxQuad({x:pin.x-9,y:pin.y-9,w:18,h:18}));
   if(points){outline(ctx,points,'#5cc8ff','rgba(92,200,255,.15)',true);const cameraCenter=project(pose,pin),center=cameraCenter&&project(cover,cameraCenter);if(center){ctx.fillStyle='#5cc8ff';ctx.beginPath();ctx.arc(center.x,center.y,4,0,Math.PI*2);ctx.fill();}}
   const cameraLabel=project(pose,{x:pin.x,y:pin.y+14}),label=cameraLabel&&project(cover,cameraLabel);
   if(label){const text=`Your placement · Step ${step?.number??''}`;ctx.font='600 12px sans-serif';const w=ctx.measureText(text).width+16,x=Math.max(8,Math.min(size.w-w-8,label.x-w/2));ctx.fillStyle='rgba(4,7,13,.9)';ctx.fillRect(x,label.y-14,w,24);ctx.fillStyle='#a8e3ff';ctx.fillText(text,x+8,label.y+2);}
   const image=imageRef.current;
   if(image){const q=toScreen(boxQuad({x:pin.x+13,y:pin.y-10,w:22,h:22*image.naturalHeight/image.naturalWidth}));if(q)drawCutout(ctx,image,q);}
  }
 },[ar.pose.pose,tracking,check,showBoxes,issuePick,pin,phase.kind,step?.number,size,cameraRef,cut]);
 function setAt(clientX:number,clientY:number){
  const canvas=canvasRef.current,frame=cameraRef.current?.size(),pose=ar.pose.raw;if(!canvas||!frame||!pose||!tracking||!ar.pose.fresh)return;
  const bounds=canvas.getBoundingClientRect(),backCover=invert(coverTransform(frame,size)),backPose=invert(pose);
  if(!backCover||!backPose)return;
  const camera=project(backCover,{x:clientX-bounds.left,y:clientY-bounds.top}),mat=camera&&project(backPose,camera);
  if(mat&&onMat(mat))setPin(mat);
 }
 return <>
  <canvas ref={canvasRef} data-ar-overlay data-ar-anchored-issues={tracking&&check?.state==='result'&&checkVerdict(check.result)==='fix'&&check.arPose?issueMarkers(check.result.issues).length:0} data-ar-state={ar.enabled?ar.pose.state:'off'} data-ar-pin={pin?`${pin.x.toFixed(2)},${pin.y.toFixed(2)}`:''} aria-label="Marker anchored 2D guide" className={`absolute inset-0 z-[8] h-full w-full ${placing&&tracking?'touch-none':'pointer-events-none'}`} onPointerDown={e=>{if(!placing)return;e.currentTarget.setPointerCapture(e.pointerId);setAt(e.clientX,e.clientY);}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))setAt(e.clientX,e.clientY);}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}/>
  {ar.enabled&&<section aria-label="AR overlay controls" className={`absolute left-3 ${placing?'right-3 top-14 z-[25]':'right-[10.5rem] top-[15.5rem] z-20'} rounded-2xl border border-sky-200/20 bg-ink/95 p-3 shadow-xl sm:left-6 sm:right-auto sm:top-24 sm:w-72`}>
   <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-holo">2D guide</p><p className="mt-1 text-sm font-semibold" role="status">{ar.error?'Tracking unavailable':tracking?(ar.pose.partial?'Mat tracked · one corner covered':'Mat tracked'):'Show the mat corners'}</p></div><Link href="/ar/markers" target="_blank" rel="noopener" className="shrink-0 rounded-lg border border-white/20 px-2.5 py-2 text-xs text-sky-200">Print ↗</Link></div>
   <p className={`mt-1 text-xs leading-relaxed text-white/60 ${pin&&!placing&&tracking?'hidden':''}`}>{ar.error?'Check build still works. Try turning AR off and on.':tracking?(placing?'Tap or drag on the mat to position your target. This does not complete the step.':pin?'Your target stays on the mat. Keep the build fixed on the paper.':'Pin the spot from the manual. Placement is chosen by you, not detected.'): 'Lay the mat flat and show all four markers. Check build works while tracking is unavailable.'}</p>
   {tracking&&phase.kind==='ready'&&<div className="mt-2 flex flex-wrap items-center gap-2"><button onClick={()=>setPlacing(v=>!v)} aria-pressed={placing} className="rounded-lg bg-holo px-3 py-2 text-xs font-semibold text-ink">{placing?'Done positioning':pin?'Adjust target':'Pin target'}</button>{pin&&<button onClick={()=>{setPin(null);setPlacing(false);}} className="rounded-lg bg-white/10 px-3 py-2 text-xs">Clear</button>}{placing&&(step?.parts.length??0)>1&&<select aria-label="AR target part" value={piece} onChange={e=>setPiece(Number(e.target.value))} className="min-w-0 max-w-36 rounded-lg bg-ink px-2 py-2 text-xs">{step?.parts.map((p,i)=><option value={i} key={i}>{i+1}. {p.name}</option>)}</select>}</div>}
   {placing&&!pin&&tracking&&<button onClick={()=>setPin({x:90,y:110})} className="mt-2 rounded-lg border border-white/20 px-3 py-2 text-xs">Place at mat center</button>}
   {placing&&pin&&<div className="mt-2 flex items-center gap-1" aria-label="Nudge placement"><span className="mr-1 text-xs text-white/50">1 mm</span>{[["←",-1,0],["↑",0,-1],["↓",0,1],["→",1,0]].map(([label,x,y])=><button key={label} aria-label={`Nudge target ${label}`} onClick={()=>{const next={x:pin.x+Number(x),y:pin.y+Number(y)};if(onMat(next))setPin(next);}} className="h-8 w-8 rounded-lg bg-white/10 text-sm">{label}</button>)}</div>}
   {process.env.NODE_ENV==='development'&&<p className="mt-1 font-mono text-[10px] text-white/40">Detector {ar.fps.toFixed(1)} fps · {ar.pose.visible}/4 markers</p>}
  </section>}
 </>;
}
