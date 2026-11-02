"use client";
import {stopSpeaking} from '@/lib/speech';
import Link from 'next/link';
import type {BuildModel} from './useBuildModel';
export default function BuildHeader({model}:{model:Pick<BuildModel,'manual'|'doc'|'page'|'restart'|'setMuted'|'muted'|'setPairOpen'|'openSummary'|'ar'|'pairing'>}){
 const {manual,doc,page,restart,setMuted,muted,setPairOpen,openSummary,ar,pairing}=model;
 function closeMenu(target:HTMLElement){const details=target.closest('details');if(details)details.open=false;}
 const item='block w-full rounded-lg px-3 py-2.5 text-left text-sm text-white/85 hover:bg-white/10';
 return <header className="absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
  <Link href="/" className="hud-panel flex h-10 shrink-0 items-center rounded-xl px-3 text-sm text-white/85">← Hub</Link>
  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{manual?.title??'BuildSight'}</p>{doc&&page>0&&<p className="truncate text-[10px] text-white/50">Page {page}/{doc.numPages}</p>}</div>
  <button onClick={ar.toggle} aria-label="AR overlay" aria-pressed={ar.enabled} title="AR overlay (G)" className={`h-10 shrink-0 rounded-xl border px-2.5 text-xs font-semibold ${ar.enabled?'border-holo/50 bg-holo/15 text-holo':'border-white/15 bg-ink/80 text-white/80'}`}>AR overlay</button>
  <button onClick={()=>{setMuted(m=>!m);stopSpeaking();}} aria-pressed={muted} className="hud-panel h-10 shrink-0 rounded-xl px-2.5 text-xs text-white/85">{muted?'Voice off':'Voice on'}</button>
  <details className="relative shrink-0"><summary aria-label="Build options" className="hud-panel grid h-10 w-9 cursor-pointer list-none place-items-center rounded-xl text-lg">⋯</summary><div className="absolute right-0 top-12 w-60 rounded-2xl border border-white/15 bg-ink p-2 shadow-xl">
   <button onClick={e=>{setPairOpen(true);void pairing.create();closeMenu(e.currentTarget);}} aria-label="Pair a phone camera" className={item}>Pair a phone camera</button>
   <button onClick={e=>{openSummary();closeMenu(e.currentTarget);}} aria-label="Show the build summary" className={item}>Build summary</button>
   <button onClick={e=>{restart();closeMenu(e.currentTarget);}} disabled={!doc} aria-label="Restart from step 1" className={item}>Restart from step 1</button>
   {/\/645575\d\.pdf$/.test(manual?.pdfPath??'')&&<Link href="/practice/parrot" aria-label="Practice in AR" className={item}>Practice in AR ↗</Link>}
   <Link href="/ar/markers" target="_blank" rel="noopener" className={item}>Print AR mat ↗</Link>
  </div></details>
 </header>;
}
