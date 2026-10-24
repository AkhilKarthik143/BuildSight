"use client";

// Voice loop panel: status (Listening / Thinking / Speaking), running transcript, and a hold-to-talk mic button.
// Hold the button, or hold the M key, to talk.

import { useCallback, useEffect, useRef, useState } from "react";
import { Listener } from "@/lib/listen";

export type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";
type Line = { who: "you" | "assistant"; text: string };

const STATUS_LABEL: Record<VoiceStatus, string> = {
  idle: "Hold to talk",
  listening: "Listening",
  thinking: "Thinking",
  speaking: "Speaking",
};

const STATUS_DOT: Record<VoiceStatus, string> = {
  idle: "bg-white/40",
  listening: "bg-rose-400 animate-pulse",
  thinking: "bg-amber-300 animate-pulse",
  speaking: "bg-sky-300 animate-pulse",
};

export default function VoicePanel() {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listener = useRef<Listener | null>(null);
  const starting = useRef<Promise<void> | null>(null);
  const held = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const l = new Listener({
      onInterim: setInterim,
      onError: (m) => {
        setError(m);
        setStatus("idle");
        setInterim("");
      },
    });
    listener.current = l;
    l.warm().catch(() => {}); // errors show on first press instead
    return () => l.close();
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines, interim]);

  const press = useCallback(() => {
    if (held.current || !listener.current) return;
    held.current = true;
    setError(null);
    setInterim("");
    setStatus("listening");
    starting.current = listener.current.start().catch((e) => {
      setError(e instanceof Error ? e.message : "Couldn't start listening.");
      setStatus("idle");
    });
  }, []);

  const release = useCallback(async () => {
    if (!held.current || !listener.current) return;
    held.current = false;
    await starting.current; // a quick tap may release before listening has started
    const text = await listener.current.stop();
    setInterim("");
    setStatus("idle");
    if (text) setLines((ls) => [...ls, { who: "you", text }]);
  }, []);

  // Hold M to talk (ignored while typing in a field).
  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m" && !e.repeat && !typing(e)) press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m") release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", release);
    };
  }, [press, release]);

  return (
    <section className="hud-panel flex w-full flex-col overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 px-3 pt-2.5">
        <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{STATUS_LABEL[status]}</span>
        <span className="ml-auto hidden text-[10px] text-white/40 sm:inline">hold M</span>
      </div>

      <div ref={scroller} className="max-h-28 min-h-10 space-y-1.5 overflow-y-auto px-3 py-2 text-[13px] leading-snug sm:max-h-48">
        {lines.length === 0 && !interim && <p className="text-white/40">Ask anything about this step.</p>}
        {lines.map((l, i) => (
          <p key={i} className={l.who === "you" ? "text-white/90" : "text-sky-200"}>
            <span className="mr-1.5 text-[10px] font-semibold uppercase text-white/40">{l.who === "you" ? "You" : "BuildSight"}</span>
            {l.text}
          </p>
        ))}
        {interim && (
          <p className="text-white/50 italic">
            <span className="mr-1.5 text-[10px] font-semibold uppercase not-italic text-white/40">You</span>
            {interim}
          </p>
        )}
      </div>

      {error && <p className="mx-3 mb-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-2.5 py-1.5 text-xs text-rose-100">{error}</p>}

      <button
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          press();
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(e) => e.preventDefault()}
        className={`m-2 mt-0 select-none rounded-xl py-3 text-sm font-semibold transition active:scale-[0.98] ${
          status === "listening" ? "bg-rose-400 text-ink" : "border border-white/15 bg-white/[0.08] text-white hover:bg-white/15"
        }`}
        style={{ touchAction: "none", WebkitTouchCallout: "none" }}
      >
        {status === "listening" ? "Listening… release to send" : "🎙 Hold to talk"}
      </button>
    </section>
  );
}
