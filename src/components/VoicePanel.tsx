"use client";

// Voice loop panel: status (Listening / Thinking / Speaking), running transcript, and a hold-to-talk mic button.
// Hold the button, or hold the M key, to talk. Or turn on hands-free (H): it listens all the time,
// sends each sentence when you pause, and stops listening while BuildSight is thinking or speaking.

import { useCallback, useEffect, useRef, useState } from "react";
import type { AssistRequest } from "@/app/api/assist/route";
import { Listener } from "@/lib/listen";
import { speaker } from "@/lib/speech";

export type VoiceStatus = "idle" | "listening" | "thinking" | "speaking";
type Line = { who: "you" | "assistant"; text: string; frame?: string };

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

type Props = {
  getFrame?: () => string | null; // latest camera frame, grabbed when you stop talking
  context?: Pick<AssistRequest, "manual" | "step">;
  muted?: boolean;
  compact?: boolean; // phones with the step card collapsed: just a round mic button
};

export default function VoicePanel({ getFrame, context, muted, compact }: Props) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [handsFree, setHandsFree] = useState(false);
  // The panel is a small pill; the latest answer shows below it while active and for a few seconds after.
  const [faded, setFaded] = useState(true);
  const [pinned, setPinned] = useState(false); // tap the status line to keep the full transcript open
  const handsFreeRef = useRef(false);
  handsFreeRef.current = handsFree;

  const listener = useRef<Listener | null>(null);
  const starting = useRef<Promise<void> | null>(null);
  const held = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const linesRef = useRef<Line[]>([]);
  linesRef.current = lines;
  const props = useRef({ getFrame, context, muted });
  props.current = { getFrame, context, muted };
  const asking = useRef<AbortController | null>(null);

  useEffect(() => {
    const l = new Listener({
      onInterim: setInterim,
      // Hands-free: a finished sentence is sent at once, and listening pauses until the answer is spoken.
      onPhrase: async () => {
        if (!handsFreeRef.current || held.current || !l.listening) return;
        const text = await l.stop();
        setInterim("");
        if (text) ask(text);
        else setStatus("idle");
      },
      onError: (m) => {
        setError(m);
        setStatus("idle");
        setInterim("");
      },
    });
    listener.current = l;
    l.warm().catch(() => {}); // errors show on first press instead
    return () => {
      l.close();
      asking.current?.abort();
    };
  }, []);

  // Show "Speaking" whenever the voice is playing (replies and step announcements alike).
  useEffect(
    () =>
      speaker().subscribe((on) =>
        setStatus((s) => (on ? (s === "listening" && held.current ? s : "speaking") : s === "speaking" ? "idle" : s)),
      ),
    [],
  );

  // Hands-free: listen whenever idle; stop listening while thinking or speaking so it never hears itself.
  useEffect(() => {
    const l = listener.current;
    if (!handsFree || !l || held.current) return;
    if (status === "thinking" || status === "speaking") {
      if (l.listening) l.stop(); // discard: anything heard now is our own voice
      return;
    }
    if (status !== "idle") return;
    const t = setTimeout(() => {
      setStatus("listening");
      l.start().catch((e) => {
        setError(e instanceof Error ? e.message : "Couldn't start listening.");
        setHandsFree(false);
        setStatus("idle");
      });
    }, 300); // short gap so the end of our own voice isn't picked up
    return () => clearTimeout(t);
  }, [handsFree, status]);

  const toggleHandsFree = useCallback(() => {
    speaker().unlock();
    setError(null);
    setHandsFree((on) => {
      if (on && listener.current?.listening && !held.current) {
        listener.current.stop();
        setInterim("");
        setStatus("idle");
      }
      return !on;
    });
  }, []);

  // Shrink back to the pill a few seconds after the answer finishes.
  useEffect(() => {
    if (status !== "idle" || faded) return;
    const t = setTimeout(() => setFaded(true), 6000);
    return () => clearTimeout(t);
  }, [status, faded]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines, interim]);

  const press = useCallback(() => {
    if (held.current || !listener.current) return;
    held.current = true;
    setFaded(false);
    // Talking interrupts: stop the voice and any answer still coming in.
    speaker().unlock();
    speaker().stop();
    asking.current?.abort();
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
    if (text) ask(text);
  }, []); // ask only reads refs

  // Sends the question (plus a camera frame) to Claude and shows the reply as it streams in.
  async function ask(question: string) {
    asking.current?.abort();
    const ctrl = new AbortController();
    asking.current = ctrl;
    const { getFrame, context, muted } = props.current;
    const history = linesRef.current.map((l) => ({ role: l.who === "you" ? ("user" as const) : ("assistant" as const), text: l.text }));
    const frame = getFrame?.() ?? undefined; // what the camera sees the moment you stop talking
    setLines((ls) => [...ls, { who: "you", text: question, frame }, { who: "assistant", text: "" }]);
    setFaded(false);
    setStatus("thinking");
    const voice = muted ? null : speaker().stream();
    const finish = () => setStatus((s) => (s === "thinking" || s === "speaking" ? "idle" : s));

    const setReply = (text: string) =>
      setLines((ls) => {
        const next = [...ls];
        next[next.length - 1] = { who: "assistant", text };
        return next;
      });

    try {
      const body: AssistRequest = { question, history, frame, ...context };
      const res = await fetch("/api/assist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctrl.signal });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Couldn't get an answer.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        reply += chunk;
        setReply(reply);
        voice?.push(chunk); // each finished sentence starts speaking right away
      }
      reply = reply.trim();
      if (!reply) throw new Error("Got an empty answer. Try again.");
      if (voice) voice.end().then(() => !ctrl.signal.aborted && finish());
      else finish();
    } catch (e) {
      if (ctrl.signal.aborted) return;
      voice?.end();
      setLines((ls) => (ls[ls.length - 1]?.who === "assistant" && !ls[ls.length - 1].text ? ls.slice(0, -1) : ls));
      setError(e instanceof TypeError ? "Network problem. Check the connection and try again." : e instanceof Error ? e.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  // Hold M to talk (ignored while typing in a field).
  useEffect(() => {
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "m" && !e.repeat && !typing(e)) press();
      if (e.key.toLowerCase() === "h" && !e.repeat && !typing(e)) toggleHandsFree();
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
  }, [press, release, toggleHandsFree]);

  const micHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      press();
    },
    onPointerUp: release,
    onPointerCancel: release,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    style: { touchAction: "none", WebkitTouchCallout: "none" } as React.CSSProperties,
  };
  const micLabel =
    status === "speaking"
      ? "Tap to interrupt"
      : status === "listening"
        ? handsFree && !held.current
          ? "Listening… just talk"
          : "Listening… release to send"
        : status === "thinking"
          ? "Thinking…"
          : handsFree
            ? "Hands-free on"
            : "🎙 Hold to talk";

  if (compact) {
    const last = interim || lines[lines.length - 1]?.text;
    return (
      <div className="flex items-center gap-2">
        <button
          {...micHandlers}
          aria-label={micLabel}
          className={`hud-panel relative grid h-14 w-14 shrink-0 select-none place-items-center rounded-full text-xl transition active:scale-95 ${
            status === "listening" ? "bg-rose-400/90" : ""
          }`}
        >
          🎙
          <span className={`absolute right-1 top-1 h-2.5 w-2.5 rounded-full ${STATUS_DOT[status]}`} />
        </button>
        {(status !== "idle" || error) && (
          <p className={`hud-panel line-clamp-2 rounded-xl px-2.5 py-1.5 text-xs ${error ? "text-rose-100" : "text-white/80"}`}>
            {error ?? (last ? last : STATUS_LABEL[status])}
          </p>
        )}
      </div>
    );
  }

  const statusLine =
    status === "listening"
      ? interim || "Listening…"
      : status === "thinking"
        ? "Thinking…"
        : status === "speaking"
          ? "Speaking · tap mic to stop"
          : handsFree
            ? "Hands-free · just talk"
            : "Hold to ask";
  const shown = pinned ? lines : lines.slice(-2);
  const open = pinned || error !== null || (!faded && lines.length > 0);

  return (
    <section className="hud-panel w-full overflow-hidden rounded-2xl">
      <div className="flex h-11 items-center gap-2 pl-1 pr-1.5">
        <button
          {...micHandlers}
          aria-label={micLabel}
          className={`relative grid h-9 w-9 shrink-0 select-none place-items-center rounded-full text-base transition active:scale-95 ${
            status === "listening" ? "bg-rose-400" : "bg-white/10 hover:bg-white/20"
          }`}
        >
          🎙
          <span className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-ink ${STATUS_DOT[status]}`} />
        </button>
        <button
          onClick={() => setPinned((p) => !p)}
          className={`min-w-0 flex-1 truncate text-left text-[13px] ${status === "listening" && interim ? "italic text-white/70" : "text-white/85"}`}
          title={pinned ? "Hide transcript" : "Show transcript"}
        >
          {statusLine}
          {status === "idle" && !handsFree && <span className="ml-1.5 hidden text-[10px] text-white/40 sm:inline">or hold M</span>}
        </button>
        <button
          onClick={toggleHandsFree}
          aria-pressed={handsFree}
          title="Hands-free (H)"
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
            handsFree ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-100" : "border-white/15 text-white/55 hover:text-white"
          }`}
        >
          <span className="sm:hidden">{handsFree ? "Auto on" : "Auto"}</span>
          <span className="hidden sm:inline">Hands-free {handsFree ? "on" : "off"}</span>
        </button>
      </div>

      {open && (
        <div ref={scroller} className={`space-y-1.5 overflow-y-auto border-t border-white/10 px-3 py-2 text-[13px] leading-snug ${pinned ? "max-h-48 sm:max-h-72" : "max-h-28 sm:max-h-40"}`}>
          {shown.map((l, i) => (
            <p key={lines.length - shown.length + i} className={l.who === "you" ? "text-white/90" : "text-sky-200"}>
              {l.frame && (
                // eslint-disable-next-line @next/next/no-img-element -- camera frame is a data URL
                <img src={l.frame} alt="What BuildSight saw" className="float-right ml-2 h-9 w-12 rounded object-cover ring-1 ring-white/20" />
              )}
              <span className="mr-1.5 text-[10px] font-semibold uppercase text-white/40">{l.who === "you" ? "You" : "BuildSight"}</span>
              {l.text || <span className="animate-pulse text-white/40">…</span>}
            </p>
          ))}
          {error && <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-2.5 py-1.5 text-xs text-rose-100">{error}</p>}
        </div>
      )}
    </section>
  );
}
