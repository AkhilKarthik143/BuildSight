// Planar projective geometry. Units are explicit: mat millimetres or normalized full-camera coordinates.
export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];
export type Homography = [number, number, number, number, number, number, number, number, number];
export const IDENTITY: Homography = [1, 0, 0, 0, 1, 0, 0, 0, 1];

export function project(h: Homography, p: Point): Point | null {
  const z = h[6] * p.x + h[7] * p.y + h[8];
  if (!Number.isFinite(z) || Math.abs(z) < 1e-10) return null;
  const x = (h[0] * p.x + h[1] * p.y + h[2]) / z;
  const y = (h[3] * p.x + h[4] * p.y + h[5]) / z;
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}
export function projectQuad(h: Homography, q: readonly Point[]): Quad | null {
  const out = q.map(p => project(h, p));
  return out.length === 4 && out.every(p => p !== null) ? out as Quad : null;
}
export function boxQuad(b: { x: number; y: number; w: number; h: number }): Quad {
  return [{ x: b.x, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h }, { x: b.x, y: b.y + b.h }];
}
export const projectBox = (h: Homography, b: { x: number; y: number; w: number; h: number }) => projectQuad(h, boxQuad(b));
export function invert(h: Homography): Homography | null {
  const [a,b,c,d,e,f,g,i,j] = h;
  const v: Homography = [e*j-f*i,c*i-b*j,b*f-c*e,f*g-d*j,a*j-c*g,c*d-a*f,d*i-e*g,b*g-a*i,a*e-b*d];
  const det = a*v[0]+b*v[3]+c*v[6];
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return v.map(n=>n/det) as Homography;
}
function multiply(a: Homography, b: Homography): Homography {
  return Array.from({length:9}, (_,i)=>[0,1,2].reduce((v,k)=>v+a[Math.floor(i/3)*3+k]*b[k*3+i%3],0)) as Homography;
}
function normalize(points: readonly Point[]) {
  const x = points.reduce((n,p)=>n+p.x,0)/points.length;
  const y = points.reduce((n,p)=>n+p.y,0)/points.length;
  const mean = points.reduce((n,p)=>n+Math.hypot(p.x-x,p.y-y),0)/points.length;
  const s = mean > 1e-10 ? Math.SQRT2/mean : 1;
  const h: Homography = [s,0,-s*x,0,s,-s*y,0,0,1];
  return { h, points: points.map(p=>({x:s*(p.x-x),y:s*(p.y-y)})) };
}
/** Normalized least squares; accepts four points or all 12/16 detected marker corners. */
export function solveHomography(from: readonly Point[], to: readonly Point[]): Homography | null {
  if (from.length < 4 || from.length !== to.length || ![...from,...to].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))) return null;
  const a = normalize(from), b = normalize(to);
  const normal = Array.from({length:8},()=>Array<number>(9).fill(0));
  for (let i=0;i<from.length;i++) {
    const {x,y}=a.points[i], {x:u,y:v}=b.points[i];
    for (const row of [[x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]]) {
      for(let r=0;r<8;r++) for(let c=0;c<9;c++) normal[r][c]+=row[r]*row[c];
    }
  }
  for(let c=0;c<8;c++) {
    let pivot=c;
    for(let r=c+1;r<8;r++) if(Math.abs(normal[r][c])>Math.abs(normal[pivot][c])) pivot=r;
    if(Math.abs(normal[pivot][c])<1e-10) return null;
    [normal[c],normal[pivot]]=[normal[pivot],normal[c]];
    const d=normal[c][c]; for(let j=c;j<9;j++) normal[c][j]/=d;
    for(let r=0;r<8;r++) if(r!==c) { const k=normal[r][c]; for(let j=c;j<9;j++) normal[r][j]-=k*normal[c][j]; }
  }
  const h=multiply(multiply(invert(b.h)!, [...normal.map(row=>row[8]),1] as Homography),a.h);
  if(Math.abs(h[8])<1e-10) return null;
  const out=h.map(n=>n/h[8]) as Homography;
  return invert(out) && out.every(Number.isFinite) ? out : null;
}
export function convexQuad(q: Quad, minArea = 0): boolean {
  let sign=0, area=0;
  for(let i=0;i<4;i++) {
    const a=q[i],b=q[(i+1)%4],c=q[(i+2)%4];
    const cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
    if(!Number.isFinite(cross)||Math.abs(cross)<1e-10 || (sign && Math.sign(cross)!==sign)) return false;
    sign=Math.sign(cross);area+=a.x*b.y-a.y*b.x;
  }
  return Math.abs(area)/2>=minArea;
}
/** Smooth projected corners, not matrix coefficients. Reset on reacquisition or a large camera jump. */
export function createPoseSmoother(mat: Quad, tauMs = 65) {
  let previous: Quad | null=null, time=0;
  return {
    reset() { previous=null; },
    update(h: Homography, now: number): Homography {
      const next=projectQuad(h,mat);
      if(!next) return h;
      const jump=previous && Math.max(...next.map((p,i)=>Math.hypot(p.x-previous![i].x,p.y-previous![i].y)))>0.12;
      const alpha=1-Math.exp(-Math.max(1,now-time)/tauMs);
      previous=previous && !jump ? next.map((p,i)=>({x:previous![i].x+alpha*(p.x-previous![i].x),y:previous![i].y+alpha*(p.y-previous![i].y)})) as Quad : next;
      time=now;
      return solveHomography(mat,previous) ?? h;
    },
  };
}
/** object-cover transform, including portrait camera rotation via its actual frame dimensions. */
export function coverTransform(frame: {w:number;h:number}, view: {w:number;h:number}): Homography {
  const k=Math.max(view.w/frame.w,view.h/frame.h), w=frame.w*k,h=frame.h*k;
  return [w,0,(view.w-w)/2,0,h,(view.h-h)/2,0,0,1];
}
