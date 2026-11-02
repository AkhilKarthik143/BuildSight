"use client";
import { useEffect, useRef, useState } from 'react';
import { boxQuad, coverTransform, invert, project, projectQuad, type Quad } from '@/lib/ar/homography';
import { center, moveQuad } from '@/lib/ar/placement';
import type { BuildModel } from './useBuildModel';

type Props = { model: Pick<BuildModel, 'ar' | 'placement' | 'camera' | 'step'>; adjusting: boolean };
const points = (q: Quad) => q.map(p => `${p.x},${p.y}`).join(' ');
export default function CameraPlacementLayer({ model: { ar, placement, camera, step }, adjusting }: Props) {
  const area = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const svg = area.current; if (!svg) return;
    const observer = new ResizeObserver(() => setView({ w: svg.clientWidth, h: svg.clientHeight }));
    observer.observe(svg); return () => observer.disconnect();
  }, []);
  // The video size can change on phone rotation; sample outside render.
  const [frame, setFrame] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => { const tick = () => setFrame(camera.current?.size() ?? null); tick(); const timer = setInterval(tick, 200); return () => clearInterval(timer); }, [camera]);
  const s = placement.state;
  const visible = s?.status === 'ready' && s.quad && !s.stale && frame && view.w &&
    (!s.anchored || (ar.pose.state === 'tracking' && ar.pose.pose));
  const cover = frame && coverTransform(frame, view);
  const cameraQuad = visible && s.quad && (s.anchored ? projectQuad(ar.pose.pose!, s.quad) : s.quad);
  const target = cameraQuad && cover ? projectQuad(cover, cameraQuad) : null;
  const source = target && s?.sourceVisible && s.result?.source && cover ? projectQuad(cover, boxQuad(s.result.source)) : null;
  const c = target && center(target), start = source && center(source);
  const part = step?.parts[s?.part ?? 0];
  const color = /^#[0-9a-f]{6}$/i.test(part?.color ?? '') ? part!.color : '#5cc8ff';
  const xs = Math.min(8, Math.max(0, Math.round(part?.studsX || 0))), ys = Math.min(8, Math.max(0, Math.round(part?.studsY || 0)));
  const onSurface = (x: number, y: number) => {
    if (!target) return { x: 0, y: 0 };
    const [a, b, c, d] = target;
    return { x: a.x*(1-x)*(1-y)+b.x*x*(1-y)+c.x*x*y+d.x*(1-x)*y, y: a.y*(1-x)*(1-y)+b.y*x*(1-y)+c.y*x*y+d.y*(1-x)*y };
  };
  function position(clientX: number, clientY: number) {
    if (!s?.quad || !visible || !cover || !area.current) return;
    const bounds = area.current.getBoundingClientRect(), inverse = invert(cover);
    const inCamera = inverse && project(inverse, { x: clientX - bounds.left, y: clientY - bounds.top });
    const back = s.anchored && ar.pose.pose ? invert(ar.pose.pose) : null;
    const next = inCamera && (s.anchored ? back && project(back, inCamera) : inCamera);
    if (!next) return;
    const old = center(s.quad), moved = moveQuad(s.quad, next.x - old.x, next.y - old.y);
    const normalized = s.anchored && ar.pose.pose ? projectQuad(ar.pose.pose, moved) : moved;
    if (normalized?.every(p => p.x >= 0 && p.y >= 0 && p.x <= 1 && p.y <= 1)) placement.adjust(moved);
  }
  return <svg ref={area} data-camera-placement data-placement-visible={!!target} data-placement-mode={s?.anchored ? 'mat' : 'snapshot'} data-placement-target={target ? points(target) : ''}
    aria-label="Suggested placement over the camera" className={`absolute inset-0 z-[9] h-full w-full overflow-hidden ${adjusting && target ? 'touch-none' : 'pointer-events-none'}`}
    onPointerDown={e => { if (!adjusting || !target) return; e.currentTarget.setPointerCapture(e.pointerId); position(e.clientX,e.clientY); }}
    onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) position(e.clientX,e.clientY); }}
    onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}>
    <defs><marker id="placement-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 8 4 0 8" fill="none" stroke="#5cc8ff" strokeWidth="1.5" /></marker></defs>
    {target && c && <>
      {source && <polygon points={points(source)} fill="none" stroke="#5cc8ff" strokeWidth="2.5" />}
      {start && <><text x={start.x} y={Math.min(...source!.map(p=>p.y))-10} textAnchor="middle" fill="#b9eeff" stroke="#04070d" strokeWidth="3" paintOrder="stroke" fontSize="13">Pick up</text>
        <path d={`M ${start.x} ${start.y} Q ${(start.x+c.x)/2+35} ${Math.min(start.y,c.y)-55} ${c.x} ${c.y}`} fill="none" stroke="#5cc8ff" strokeWidth="2.5" strokeDasharray="5 5" markerEnd="url(#placement-arrow)" /></>}
      <polygon points={points(target)} fill={color} fillOpacity=".5" stroke="#fbbf24" strokeWidth="2.5" strokeDasharray="7 5" />
      {Array.from({ length: xs * ys }, (_, i) => { const p = onSurface((i%xs+.5)/xs,(Math.floor(i/xs)+.5)/ys);return <circle key={i} cx={p.x} cy={p.y} r={Math.max(2,Math.min(7,Math.hypot(target[1].x-target[0].x,target[1].y-target[0].y)/Math.max(xs,1)*.2))} fill={color} fillOpacity=".8" stroke="#fff" strokeOpacity=".6" />; })}
      <g transform={`translate(${Math.max(102,Math.min(view.w-102,c.x))},${Math.max(82,Math.min(view.h-32,Math.max(...target.map(p=>p.y))+22))})`}>
        <rect x="-100" y="-14" width="200" height="26" rx="8" fill="#04070d" fillOpacity=".95" />
        <text textAnchor="middle" y="3" fontSize="12" fontWeight="600" fill="#fde68a">{s?.adjusted ? 'Your adjustment' : 'Suggested spot'} · Step {step?.number}</text>
      </g>
    </>}
  </svg>;
}
