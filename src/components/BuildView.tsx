"use client";

import { AnimatePresence, motion } from "motion/react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import CameraFeed, { type CameraHandle } from "@/components/CameraFeed";
import { DEMO_STEPS } from "@/lib/steps";

// three.js needs the browser; load it only on the client.
const Hologram = dynamic(() => import("@/components/Hologram"), { ssr: false });

type Reply = { text: string; latencyMs?: number; error?: boolean };

export default function BuildView() {
  const camera = useRef<CameraHandle>(null);
  const [index, setIndex] = useState(0);
  const [asking, setAsking] = useState(false);
  const [reply, setReply] = useState<Reply | null>(null);

  const step = DEMO_STEPS[index];
  const piece = step.pieces[0];

  const go = useCallback((delta: number) => {
    setReply(null);
    setIndex((i) => Math.min(DEMO_STEPS.length - 1, Math.max(0, i + delta)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  async function ask() {
    const image = camera.current?.capture();
    if (!image) {
      setReply({ text: "Camera isn't ready yet.", error: true });
      return;
    }
    setAsking(true);
    setReply(null);
    try {
      const res = await fetch("/api/vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });
      const data = await res.json();
      setReply(res.ok ? { text: data.text, latencyMs: data.latencyMs } : { text: data.error, error: true });
    } catch {
      setReply({ text: "Couldn't reach the server.", error: true });
    } finally {
      setAsking(false);
    }
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black text-white">
      <CameraFeed ref={camera} />

      {/* soft vignette so the overlays stay readable on any background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />

      {/* top bar */}
      <header className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
          </span>
          <span className="text-sm font-semibold tracking-wide">BuildSight</span>
        </div>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs backdrop-blur-md">
          Step {step.number}
        </span>
      </header>

      {/* where the piece goes */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`target-${step.number}`}
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${step.target.x * 100}%`, top: `${step.target.y * 100}%` }}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 0.35 }}
        >
          <span className="target-ring" />
          <span className="target-ring [animation-delay:0.8s]" />
          <span className="block h-3 w-3 rounded-full bg-cyan-300 shadow-[0_0_16px_4px_rgba(79,195,255,0.8)]" />
        </motion.div>
      </AnimatePresence>

      {/* hologram + instruction card */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-stretch gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:left-6 sm:right-auto sm:bottom-6 sm:w-[420px] sm:p-0">
        <div className="relative mx-auto h-44 w-44 sm:mx-0 sm:h-52 sm:w-52">
          <Hologram piece={piece} />
          <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">
            Next piece
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.section
            key={step.number}
            initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="rounded-3xl border border-cyan-300/25 bg-slate-900/45 p-5 shadow-[0_0_40px_-10px_rgba(79,195,255,0.6)] backdrop-blur-xl"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Step {step.number}</p>
            <h1 className="mt-1 text-xl font-semibold leading-snug sm:text-2xl">{step.instruction}</h1>

            <ul className="mt-4 flex flex-wrap gap-2">
              {step.pieces.map((p) => (
                <li
                  key={p.name}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm"
                >
                  <span className="h-3 w-3 rounded-sm" style={{ background: p.color }} />
                  {p.name}
                  <span className="text-white/60">×{p.qty}</span>
                </li>
              ))}
            </ul>

            <AnimatePresence>
              {reply && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className={`mt-4 text-sm ${reply.error ? "text-rose-300" : "text-cyan-100"}`}
                >
                  {reply.text}
                  {reply.latencyMs != null && (
                    <span className="ml-2 text-xs text-white/50">{(reply.latencyMs / 1000).toFixed(1)} s</span>
                  )}
                </motion.p>
              )}
            </AnimatePresence>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <button
                onClick={() => go(-1)}
                disabled={index === 0}
                className="rounded-2xl border border-white/15 bg-white/5 py-3 text-sm font-medium transition active:scale-95 disabled:opacity-30"
              >
                Back
              </button>
              <button
                onClick={ask}
                disabled={asking}
                className="rounded-2xl border border-cyan-300/40 bg-cyan-400/15 py-3 text-sm font-medium text-cyan-100 transition active:scale-95 disabled:opacity-50"
              >
                {asking ? "Looking…" : "Ask"}
              </button>
              <button
                onClick={() => go(1)}
                disabled={index === DEMO_STEPS.length - 1}
                className="rounded-2xl bg-cyan-400 py-3 text-sm font-semibold text-slate-950 transition active:scale-95 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </motion.section>
        </AnimatePresence>
      </div>
    </main>
  );
}
