"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { describeTiming, presetAt, SPEED_OF, timingFor, type AutoPreset } from "@/lib/autoCheck";
import { PRESET_LABEL, setAutoModeStored, setAutoSpeedStored } from "./autoStore";

// The Auto Mode switch. Lit when on; the manual Check button sits beside it and always works.
export function AutoToggle({ on, small }: { on: boolean; small?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Auto Mode: check each step automatically"
      title="Auto Mode (A): check each step when you finish it, and move on when it passes"
      onClick={() => setAutoModeStored(!on)}
      className={`flex shrink-0 items-center gap-2 rounded-xl border text-xs font-semibold transition active:scale-95 ${small ? "px-2.5 py-2.5" : "px-3"} ${
        on ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-200" : "border-white/15 bg-white/[0.06] text-white/60 hover:text-white/85"
      }`}
    >
      <span className={`relative h-3.5 w-6 rounded-full transition ${on ? "bg-emerald-300/80" : "bg-white/20"}`}>
        <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all ${on ? "left-3" : "left-0.5"}`} />
      </span>
      Auto
    </button>
  );
}

// Gear next to the Auto switch: a small popover to pick how quickly Auto Mode checks and moves on.
export function AutoSpeedSettings({ speed, small }: { speed: number; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const t = timingFor(speed);
  const preset = presetAt(speed);
  return (
    <div ref={box} className={`relative shrink-0 ${open ? "z-50" : ""}`} onPointerDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Auto speed: ${preset ? PRESET_LABEL[preset] : "custom"}`}
        aria-expanded={open}
        title="Auto speed"
        className={`grid h-full place-items-center rounded-xl border border-white/15 bg-white/[0.06] text-white/60 transition hover:text-white/90 active:scale-95 ${small ? "w-10 py-2.5" : "w-10 py-2.5"} ${open ? "border-sky-300/50 text-sky-200" : ""}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            role="dialog"
            aria-label="Auto speed"
            className="absolute bottom-full right-0 z-50 mb-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-sky-300/25 bg-[#070c16] p-3 text-left shadow-[0_12px_40px_-8px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold text-white/90">Auto speed</p>
              <p className="text-[11px] text-sky-300">{preset ? PRESET_LABEL[preset] : "Custom"}</p>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-white/[0.05] p-1">
              {(["careful", "normal", "fast"] as AutoPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAutoSpeedStored(SPEED_OF[p])}
                  aria-pressed={preset === p}
                  className={`rounded-lg py-1.5 text-xs font-semibold transition ${preset === p ? "bg-sky-300 text-ink" : "text-white/65 hover:text-white"}`}
                >
                  {PRESET_LABEL[p]}
                </button>
              ))}
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={speed}
              onChange={(e) => setAutoSpeedStored(Number(e.target.value))}
              aria-label="Auto speed, from careful to fast"
              className="mt-3 w-full accent-sky-300"
            />
            <div className="flex justify-between text-[10px] text-white/40">
              <span>Careful</span>
              <span>Fast</span>
            </div>
            <p className="mt-2 text-[11px] leading-snug text-white/75">{describeTiming(t)}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-white/45">
              Moves on {Number((t.advanceMs / 1000).toFixed(1))} s after a pass · waits longer after misses
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
