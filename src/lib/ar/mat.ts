import { boxQuad, type Quad } from './homography.ts';
export const MAT = { width: 180, height: 220, markerSize: 28 } as const;
export const MAT_QUAD = boxQuad({x:0,y:0,w:MAT.width,h:MAT.height});
export const MARKERS = [
  {id:0,x:6,y:6}, {id:1,x:146,y:6}, {id:2,x:146,y:186}, {id:3,x:6,y:186},
] as const;
export function markerQuad(id:number): Quad | null {
  const m=MARKERS.find(m=>m.id===id);
  return m ? boxQuad({x:m.x,y:m.y,w:MAT.markerSize,h:MAT.markerSize}) : null;
}
export const onMat = (p:{x:number;y:number}) => Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=MAT.width&&p.y<=MAT.height;
