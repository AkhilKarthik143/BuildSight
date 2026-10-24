/* eslint-disable @next/next/no-img-element -- step pictures are data URLs rendered in the browser */
"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { CheckResult } from "@/app/api/check/route";
import type { ExtractedStep } from "@/app/api/extract/route";
import CameraFeed, { type CameraHandle } from "@/components/CameraFeed";
import { getManual, getPageSteps, saveManual, savePageSteps, type Manual } from "@/lib/manuals";
import { openManualPdf, renderPage } from "@/lib/pdf";
import { speak, stopSpeaking } from "@/lib/speech";

const Hologram = dynamic(() => import("@/components/Hologram"), { ssr: false });

type Phase = { kind: "loading"; label: string } | { kind: "ready" } | { kind: "error"; message: string } | { kind: "done" };
type Check = { state: "checking" } | { state: "result"; result: CheckResult; frame: string } | { state: "error"; message: string };

// Cuts a step's picture out of the rendered page (box is 0–1 of the page), with a little padding.
async function crop(pageImage: string, box: ExtractedStep["box"]): Promise<string> {
  const img = new Image();
  img.src = pageImage;
  await img.decode();
  const pad = 0.02;
  const x = Math.max(0, box.x - pad) * img.width;
  const y = Math.max(0, box.y - pad) * img.height;
  const w = Math.min(1, box.w + 2 * pad) * img.width;
  const h = Math.min(1, box.h + 2 * pad) * img.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(w, img.width - x);
  canvas.height = Math.min(h, img.height - y);
  canvas.getContext("2d")?.drawImage(img, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function extractSteps(manualId: string, doc: PDFDocumentProxy, page: number) {
  const image = await renderPage(doc, page);
  const cached = await getPageSteps<ExtractedStep>(manualId, page);
  if (cached) return { image, steps: cached };
  const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: image }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Couldn't read that page.");
  await savePageSteps(manualId, page, data.steps);
  return { image, steps: data.steps as ExtractedStep[] };
}

export default function BuildView() {
  const { id } = useParams<{ id: string }>();
  const camera = useRef<CameraHandle>(null);
  const direction = useRef<1 | -1>(1);

  const [manual, setManual] = useState<Manual | null>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(0);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [steps, setSteps] = useState<ExtractedStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "loading", label: "Opening manual" });
  const [target, setTarget] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [muted, setMuted] = useState(false);
  const [showManual, setShowManual] = useState(true);
  const [attempt, setAttempt] = useState(0); // bumped by Retry to re-read the page

  // Every page change shows the loading card first.
  const turnTo = useCallback((p: number) => {
    setPhase({ kind: "loading", label: `Reading page ${p}` });
    setCheck(null);
    setPage(p);
  }, []);

  const step = steps[stepIdx] as ExtractedStep | undefined;
  const part = step?.parts[0];

  // 1. load the manual and its PDF
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await getManual(id);
      if (!m) return setPhase({ kind: "error", message: "That manual isn't in your library on this device." });
      setManual(m);
      try {
        const d = await openManualPdf(m);
        if (cancelled) return;
        const updated = { ...m, pageCount: d.numPages, openedAt: Date.now() };
        await saveManual(updated);
        setManual(updated);
        setDoc(d);
        turnTo(Math.min(m.page, d.numPages));
      } catch (e) {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "Couldn't open the PDF." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, turnTo]);

  // 2. read the current page; skip pages with no steps in the direction of travel
  useEffect(() => {
    if (!doc || !manual || page < 1) return;
    let cancelled = false;
    extractSteps(manual.id, doc, page)
      .then(({ image, steps: found }) => {
        if (cancelled) return;
        if (found.length === 0) {
          const next = page + direction.current;
          if (next >= 1 && next <= doc.numPages) return turnTo(next);
          if (next > doc.numPages) return setPhase({ kind: "done" });
          direction.current = 1;
          return turnTo(page + 1);
        }
        setPageImage(image);
        setSteps(found);
        setStepIdx(direction.current === 1 ? 0 : found.length - 1);
        setPhase({ kind: "ready" });
        saveManual({ ...manual, page, openedAt: Date.now() });
      })
      .catch((e) => !cancelled && setPhase({ kind: "error", message: e instanceof Error ? e.message : "Couldn't read that page." }));
    return () => {
      cancelled = true;
    };
    // manual is saved as a side effect; re-running on its change would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, page, attempt]);

  // 3. cut out this step's target picture (and the one before it) for display and checking
  useEffect(() => {
    if (!pageImage || !step) return;
    let cancelled = false;
    crop(pageImage, step.box).then((t) => !cancelled && setTarget(t));
    const prev = steps[stepIdx - 1];
    (prev ? crop(pageImage, prev.box) : Promise.resolve(null)).then((p) => !cancelled && setPrevious(p));
    return () => {
      cancelled = true;
    };
  }, [pageImage, step, steps, stepIdx]);

  // 4. read each new step aloud
  useEffect(() => {
    if (phase.kind === "ready" && step && !muted) speak(`Step ${step.number}. ${step.instruction}`);
  }, [phase.kind, step, muted]);
  useEffect(() => stopSpeaking, []);

  const go = useCallback(
    (delta: 1 | -1) => {
      if (phase.kind !== "ready" || !doc) return;
      setCheck(null);
      direction.current = delta;
      const nextIdx = stepIdx + delta;
      if (nextIdx >= 0 && nextIdx < steps.length) return setStepIdx(nextIdx);
      const nextPage = page + delta;
      if (nextPage < 1) return;
      if (nextPage > doc.numPages) return setPhase({ kind: "done" });
      turnTo(nextPage);
    },
    [phase.kind, doc, stepIdx, steps.length, page, turnTo],
  );

  const runCheck = useCallback(async () => {
    if (!step || !target || check?.state === "checking") return;
    const frame = camera.current?.capture();
    if (!frame) return setCheck({ state: "error", message: "Camera isn't ready yet." });
    setCheck({ state: "checking" });
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame, expected: target, previous: previous ?? undefined, instruction: step.instruction, watchFor: step.watchFor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const result = data as CheckResult;
      setCheck({ state: "result", result, frame });
      if (!muted && result.say) speak(result.say);
      if (result.step_complete && result.confidence >= 0.7) setTimeout(() => go(1), 1800);
    } catch (e) {
      setCheck({ state: "error", message: e instanceof Error && e.message ? e.message : "Check failed." });
    }
  }, [step, target, previous, check?.state, muted, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        runCheck();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, runCheck]);

  const verdict = useMemo(() => {
    if (check?.state !== "result") return null;
    const { result } = check;
    if (result.confidence < 0.5) return "unsure" as const;
    if (result.issues.length > 0) return "fix" as const;
    return result.step_complete ? ("pass" as const) : ("notyet" as const);
  }, [check]);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-ink text-white">
      <CameraFeed ref={camera} />
      <div className="hud-scanlines pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-ink/80" />

      {/* top bar */}
      <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <Link href="/" className="hud-panel flex items-center gap-2 rounded-lg px-3 py-2 font-hud text-sm font-semibold uppercase tracking-[0.2em] text-holo transition hover:bg-holo/10">
          ◂ Hub
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-hud text-base font-semibold uppercase tracking-[0.15em] holo-text">{manual?.title ?? "BuildSight"}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.2em] text-holo/60">
            {manual?.subtitle}
            {doc && page > 0 ? ` · Page ${page}/${doc.numPages}` : ""}
          </p>
        </div>
        <button
          onClick={() => {
            setMuted((m) => !m);
            stopSpeaking();
          }}
          className="hud-panel rounded-lg px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-holo"
          aria-pressed={muted}
        >
          {muted ? "Voice off" : "Voice on"}
        </button>
      </header>

      {/* reticle: shows while a check is running */}
      <AnimatePresence>
        {check?.state === "checking" && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="pointer-events-none absolute left-1/2 top-[42%] z-10 -translate-x-1/2 -translate-y-1/2">
            <svg viewBox="0 0 200 200" className="h-56 w-56">
              <g className="spin-fast" style={{ transformBox: "fill-box" }}>
                <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(79,195,255,0.8)" strokeWidth="2" strokeDasharray="30 20" />
              </g>
              <g className="spin-rev" style={{ transformBox: "fill-box" }}>
                <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(79,195,255,0.5)" strokeWidth="1.5" strokeDasharray="4 8" />
              </g>
              <path d="M100 20v20M100 160v20M20 100h20M160 100h20" stroke="rgba(79,195,255,0.9)" strokeWidth="2" />
            </svg>
            <p className="mt-2 text-center font-mono text-xs uppercase tracking-[0.3em] text-holo holo-text">Analyzing build</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* target state: the manual's picture of this step */}
      <AnimatePresence>
        {target && phase.kind === "ready" && (
          <motion.aside
            key={target.slice(-40)}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className="absolute right-3 top-20 z-10 w-36 sm:right-6 sm:top-24 sm:w-72"
          >
            <button onClick={() => setShowManual((s) => !s)} className="hud-panel holo-glow block w-full overflow-hidden rounded-xl text-left">
              <div className="flex items-center justify-between px-3 pt-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-holo sm:text-[10px]">Target · Step {step?.number}</span>
                <span className="font-mono text-[9px] text-holo/60">{showManual ? "holo" : "real"}</span>
              </div>
              <div className="relative m-2 overflow-hidden rounded-lg bg-ink/60">
                <img src={target} alt={`Manual picture for step ${step?.number}`} className={`w-full ${showManual ? "holo-image" : ""}`} />
              </div>
            </button>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* bottom: hologram + step card */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-6 sm:left-6 sm:right-auto sm:w-[440px] sm:p-0">
        {phase.kind === "ready" && part && (
          <div className="relative mx-auto h-36 w-36 sm:mx-0 sm:h-48 sm:w-48">
            <Hologram part={part} />
            <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.2em] text-holo/80">Next part</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.section
            key={phase.kind === "ready" ? `step-${page}-${stepIdx}` : phase.kind}
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="hud-panel holo-glow rounded-2xl p-5"
          >
            {phase.kind === "loading" && (
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-holo">{phase.label}</p>
                <div className="scan-bar mt-3 h-1 rounded-full" />
                <p className="mt-3 text-sm text-white/50">Reading the instructions so I can walk you through them.</p>
              </div>
            )}

            {phase.kind === "error" && (
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-rose-300">System error</p>
                <p className="mt-2 text-sm text-white/80">{phase.message}</p>
                <div className="mt-4 flex gap-2">
                  <Link href="/" className="rounded-xl border border-white/15 px-4 py-2.5 text-sm">Back to hub</Link>
                  {doc && (
                    <button
                      onClick={() => {
                        setPhase({ kind: "loading", label: `Reading page ${page}` });
                        setAttempt((a) => a + 1);
                      }}
                      className="rounded-xl bg-holo px-4 py-2.5 text-sm font-semibold text-ink"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            {phase.kind === "done" && (
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-300">Build complete</p>
                <p className="mt-2 font-hud text-2xl font-semibold">That&apos;s the last step in this manual.</p>
                <Link href="/" className="mt-4 inline-block rounded-xl bg-holo px-4 py-2.5 text-sm font-semibold text-ink">Back to hub</Link>
              </div>
            )}

            {phase.kind === "ready" && step && (
              <>
                <div className="flex items-baseline justify-between">
                  <p className="font-hud text-sm font-semibold uppercase tracking-[0.3em] text-holo">Step {step.number}</p>
                  <p className="font-mono text-[10px] text-white/40">
                    {stepIdx + 1}/{steps.length} on page {page}
                  </p>
                </div>
                <h1 className="mt-1 text-xl font-semibold leading-snug sm:text-2xl">{step.instruction}</h1>

                {step.parts.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {step.parts.map((p, i) => (
                      <li key={`${p.name}-${i}`} className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm">
                        <span className="h-3 w-3 rounded-sm ring-1 ring-white/20" style={{ background: p.color }} />
                        {p.name}
                        <span className="text-white/50">×{p.qty}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {step.watchFor[0] && (
                  <p className="mt-3 flex gap-2 text-xs text-amber-200/90">
                    <span className="font-mono">⚠</span>
                    {step.watchFor[0]}
                  </p>
                )}

                <AnimatePresence>
                  {check && check.state !== "checking" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className={`mt-4 overflow-hidden rounded-xl border p-3 text-sm ${
                        check.state === "error" || verdict === "unsure" || verdict === "notyet"
                          ? "border-white/15 bg-white/5 text-white/80"
                          : verdict === "pass"
                            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                            : "border-amber-400/40 bg-amber-400/10 text-amber-100"
                      }`}
                    >
                      {check.state === "error" ? (
                        check.message
                      ) : (
                        <>
                          <p className="font-mono text-[10px] uppercase tracking-[0.25em]">
                            {{ pass: "Verified", fix: "Hold on", notyet: "Not done yet", unsure: "Need a better look" }[verdict ?? "unsure"]} ·{" "}
                            {Math.round(check.result.confidence * 100)}%
                          </p>
                          <p className="mt-1">{check.result.say}</p>
                          {verdict === "fix" && check.result.issues.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <figure>
                                <img src={target ?? ""} alt="Manual" className="rounded-md bg-white" />
                                <figcaption className="mt-1 font-mono text-[9px] uppercase tracking-widest text-white/50">Manual</figcaption>
                              </figure>
                              <figure>
                                <img src={check.frame} alt="Your build" className="rounded-md" />
                                <figcaption className="mt-1 font-mono text-[9px] uppercase tracking-widest text-white/50">Your build</figcaption>
                              </figure>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mt-5 grid grid-cols-[1fr_1.4fr_1fr] gap-2">
                  <button onClick={() => go(-1)} className="rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-medium transition active:scale-95">
                    Back
                  </button>
                  <button
                    onClick={runCheck}
                    disabled={check?.state === "checking"}
                    className="rounded-xl bg-holo py-3 font-hud text-sm font-bold uppercase tracking-[0.2em] text-ink transition hover:brightness-110 active:scale-95 disabled:opacity-60"
                  >
                    {check?.state === "checking" ? "Checking" : "Check build"}
                  </button>
                  <button onClick={() => go(1)} className="rounded-xl border border-holo/40 bg-holo/10 py-3 text-sm font-medium text-holo transition active:scale-95">
                    Next
                  </button>
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>
      </div>
    </main>
  );
}
