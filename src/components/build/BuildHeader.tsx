"use client";



import { stopSpeaking } from "@/lib/speech";
import Link from "next/link";

import type { BuildModel } from "./useBuildModel";

export default function BuildHeader({ model }: { model: Pick<BuildModel, "manual" | "doc" | "page" | "readCount" | "restart" | "setMuted" | "muted"> }) {
  const { manual, doc, page, readCount, restart, setMuted, muted } = model;
  return (
    <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
      <Link href="/" className="hud-panel flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-white/85 transition hover:text-white">
        ← Hub
      </Link>
      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-[15px] font-semibold tracking-tight">{manual?.title ?? "BuildSight"}</p>
        {/* the page number never gets cut off: only the subtitle truncates */}
        <p className="flex justify-center whitespace-nowrap text-[11px] text-white/50">
          <span className="min-w-0 truncate">{manual?.subtitle}</span>
          {doc && page > 0 && <span className="shrink-0 pl-1">{manual?.subtitle ? "· " : ""}Page {page}/{doc.numPages}</span>}
          {doc && readCount > 0 && readCount < doc.numPages && <span className="hidden shrink-0 sm:inline"> · read {readCount}/{doc.numPages}</span>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {/\/645575\d\.pdf$/.test(manual?.pdfPath ?? "") && (
          <Link
            href="/practice/parrot"
            aria-label="Practice in AR"
            title="Practice in AR"
            className="hud-panel grid h-9 place-items-center rounded-xl px-2.5 text-xs font-semibold text-holo transition hover:text-white"
          >
            AR
          </Link>
        )}
        <button
          onClick={() => restart()}
          disabled={!doc}
          aria-label="Restart from step 1"
          title="Restart from step 1"
          className="hud-panel grid h-9 w-9 place-items-center rounded-xl text-white/85 transition hover:text-white disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
        <button
          onClick={() => {
            setMuted((m) => !m);
            stopSpeaking();
          }}
          className="hud-panel h-9 rounded-xl px-3 text-xs font-medium text-white/85 transition hover:text-white"
          aria-pressed={muted}
        >
          {muted ? "Voice off" : "Voice on"}
        </button>
      </div>
    </header>


  );
}
