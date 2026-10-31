"use client";
import {useState} from 'react';
export default function PrintMat(){
 const [paper,setPaper]=useState('A4');
 return <div className="mt-6 flex items-center gap-3"><label htmlFor="paper-size" className="text-sm">Paper</label><select id="paper-size" value={paper} onChange={e=>setPaper(e.target.value)} className="rounded-xl border border-white/20 bg-ink px-3 py-2 text-sm"><option>A4</option><option>Letter</option></select><button className="rounded-xl bg-holo px-5 py-2.5 text-sm font-semibold text-ink" onClick={()=>window.print()}>Print mat</button><style>{`@page { size: ${paper} portrait; margin: 10mm; }`}</style></div>;
}
