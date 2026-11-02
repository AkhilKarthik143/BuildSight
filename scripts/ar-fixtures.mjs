// Synthetic camera images, built from the exact printable dictionary. No network or native imaging.
import { markerSvg } from '../src/lib/ar/detector.ts';
import { MARKERS, MAT, MAT_QUAD } from '../src/lib/ar/mat.ts';
import { invert, project, solveHomography } from '../src/lib/ar/homography.ts';
export const DEFAULT_QUAD=[{x:65,y:30},{x:255,y:30},{x:255,y:365},{x:65,y:365}];
const grids=MARKERS.map(m=>{
 const grid=Array.from({length:8},()=>Array(8).fill(0));
 for(const r of markerSvg(m.id).matchAll(/<rect x="(\d+)" y="(\d+)" width="1" height="1" fill="white"/g)) grid[Number(r[2])-1][Number(r[1])-1]=1;
 return grid;
});
export function markerFrame({width=320,height=400,quad=DEFAULT_QUAD,hidden=[],noise=0}={}) {
 const h=solveHomography(MAT_QUAD,quad), back=invert(h), data=new Uint8ClampedArray(width*height*4);
 let seed=3421;
 for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
  const p=project(back,{x:x+.5,y:y+.5});let value=80;
  if(p&&p.x>=0&&p.y>=0&&p.x<=MAT.width&&p.y<=MAT.height) {
   value=245;
   const i=MARKERS.findIndex(m=>p.x>=m.x&&p.y>=m.y&&p.x<m.x+MAT.markerSize&&p.y<m.y+MAT.markerSize);
   if(i>=0&&!hidden.includes(MARKERS[i].id)) { const m=MARKERS[i];value=grids[i][Math.floor((p.y-m.y)/MAT.markerSize*8)][Math.floor((p.x-m.x)/MAT.markerSize*8)]?245:10; }
  }
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;value+=((seed/2**32)-.5)*noise;
  const at=(y*width+x)*4; data[at]=data[at+1]=data[at+2]=value;data[at+3]=255;
 }
 return {width,height,data};
}
