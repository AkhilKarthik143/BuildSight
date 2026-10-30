import aruco from 'js-aruco2';
const { AR } = aruco;
import type { Quad } from './homography.ts';
export type Frame = {width:number;height:number;data:Uint8ClampedArray};
export type Marker = {id:number;corners:Quad};
export type Detector = {detect(frame:Frame):Marker[]};
export const DICTIONARY = 'ARUCO_MIP_36h12';
export function createDetector(): Detector {
  const detector=new AR.Detector({dictionaryName:DICTIONARY,maxHammingDistance:3});
  return {detect:frame=>detector.detect(frame).filter(m=>m.id>=0&&m.id<=3&&m.corners.length===4).map(m=>({id:m.id,corners:m.corners as Quad}))};
}
export function markerSvg(id:number): string { return new AR.Dictionary(DICTIONARY).generateSVG(id).replace('viewBox="0 0 10 10"', 'viewBox="1 1 8 8"'); }
