import { convexQuad, createPoseSmoother, project, projectQuad, solveHomography, type Homography, type Point, type Quad } from './homography.ts';
import { markerQuad, MAT_QUAD } from './mat.ts';
import type { Detector, Frame, Marker } from './detector.ts';
export type PoseResult = {state:'tracking'|'lost'|'searching'; pose:Homography|null; raw:Homography|null; visible:number; partial:boolean; fresh:boolean; timestamp:number};
export interface Tracker { update(frame:Frame, now?:number):PoseResult; }
export const emptyPose = (state:PoseResult['state']='searching',timestamp=0):PoseResult=>({state,pose:null,raw:null,visible:0,partial:false,fresh:false,timestamp});
/** Reject duplicate IDs, scrambled marker order, tiny detections and inconsistent geometry. */
export function estimatePose(markers:Marker[],width:number,height:number): {pose:Homography;visible:number}|null {
  if(width<=0||height<=0) return null;
  const from:Point[]=[],to:Point[]=[],seen=new Set<number>();
  for(const m of markers) {
    const mat=markerQuad(m.id); if(!mat) continue;
    if(seen.has(m.id)||!convexQuad(m.corners,60)) return null;
    seen.add(m.id);from.push(...mat);to.push(...m.corners.map(p=>({x:p.x/width,y:p.y/height})));
  }
  if(seen.size<3) return null;
  const pose=solveHomography(from,to),quad=pose&&projectQuad(pose,MAT_QUAD);
  if(!pose||!quad||!convexQuad(quad,0.015)||quad.some(p=>p.x<-.5||p.y<-.5||p.x>1.5||p.y>1.5)) return null;
  const errors=from.map((p,i)=>{const q=project(pose,p);return q?Math.hypot(q.x-to[i].x,q.y-to[i].y):Infinity;});
  if(Math.max(...errors)>0.018) return null;
  return {pose,visible:seen.size};
}
export function createTracker(detector:Detector, lostFrames=3):Tracker {
  let result=emptyPose(), misses=0, acquired=false, lastGood=0;
  const smoother=createPoseSmoother(MAT_QUAD);
  return {update(frame, now=performance.now()) {
    const markers=detector.detect(frame), found=estimatePose(markers,frame.width,frame.height);
    // Acquire all four; after that, three markers give 12 fresh point correspondences.
    if(found&&(acquired||found.visible===4)) {
      if(!acquired) smoother.reset();
      acquired=true;misses=0;lastGood=now;
      result={state:'tracking',pose:smoother.update(found.pose,now),raw:found.pose,visible:found.visible,partial:found.visible===3,fresh:true,timestamp:now};
    } else {
      misses++;
      if(acquired&&misses<lostFrames&&now-lastGood<250) result={...result,visible:markers.filter(m=>markerQuad(m.id)).length,fresh:false};
      else {
        const state=acquired?'lost':(result.state==='lost'&&misses<lostFrames+12?'lost':'searching');
        acquired=false;smoother.reset();result=emptyPose(state,now);
      }
    }
    return result;
  }};
}
export function anchorBoxes(pose:Homography|null, boxes:Quad[]):Quad[] | null {
  // Kept in the UI state only; no geometry is ever sent to a model or saved as progress.
  if(!pose) return null;
  const out=boxes.map(q=>projectQuad(pose,q));
  return out.every(q=>q!==null)?out as Quad[]:null;
}
