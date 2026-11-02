import Link from 'next/link';
import { markerSvg } from '@/lib/ar/detector';
import { MARKERS, MAT } from '@/lib/ar/mat';
import PrintMat from './PrintMat';
import './markers.css';
export const metadata={title:'Print an AR mat · BuildSight'};
export default function MarkersPage(){
  return <main className="marker-page">
    <header className="marker-screen"><Link href="/">← BuildSight</Link><p className="mt-8 text-xs font-semibold uppercase tracking-widest text-holo">A steady reference for your camera</p><h1 className="mt-2 text-3xl font-semibold">Print your build mat</h1><p className="mt-3 max-w-lg text-sm leading-relaxed text-white/70">Print at <strong className="text-white">100% / actual size</strong>. Place your build between the four markers. Keep the mat flat and visible, then turn on AR overlay in the build screen.</p><PrintMat/><p className="mt-3 text-xs text-white/50">A4 or US Letter · Portrait · No headers/footers · Don’t use “Fit to page”.</p></header>
    <section className="marker-sheet" aria-label="Printable AR mat">
      <div className="marker-title">BUILDSIGHT <span>Camera guide mat · 2D plane</span></div>
      <div className="marker-mat" style={{width:`${MAT.width}mm`,height:`${MAT.height}mm`}}>
        {MARKERS.map(m=><div key={m.id} data-ar-marker={m.id} className="mat-marker" style={{left:`${m.x}mm`,top:`${m.y}mm`,width:`${MAT.markerSize}mm`,height:`${MAT.markerSize}mm`}}><div aria-label={`ArUco marker ${m.id}`} dangerouslySetInnerHTML={{__html:markerSvg(m.id)}}/><span>{m.id}</span></div>)}
        <div className="mat-workspace"><strong>BUILD HERE</strong><span>Keep all four corners visible.</span><span>Keep the build fixed on the mat.</span></div>
        <div className="mat-scale"><i/>50 mm — check with a ruler</div>
      </div>
      <p className="marker-footer">Print at 100%. Show all four markers to acquire tracking; three can maintain it.</p>
    </section>
    <p className="marker-screen mt-6 max-w-lg text-xs leading-relaxed text-white/60">Tracks the paper plane, not the height of bricks. Tall builds can show parallax. Targets are placed by you; the camera does not infer exact stud positions. <Link href="/" className="text-holo underline">Back to your library</Link></p>
  </main>;
}
