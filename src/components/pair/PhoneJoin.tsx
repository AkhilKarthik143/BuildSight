"use client";

import { useEffect, useRef, useState } from "react";
import { parsePairMessage, type PairMessage } from "@/lib/pairing/schema";
import { faultCopy } from "@/lib/faults";

export default function PhoneJoin({ code }: { code: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Joining…");
  const [last, setLast] = useState<PairMessage | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    let stop = false;
    let source: EventSource | null = null;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function publish(message: PairMessage) {
      await fetch("/api/pair/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, message }),
      });
    }

    (async () => {
      const res = await fetch("/api/pair", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", code }),
      });
      if (stop) return;
      if (!res.ok) {
        setStatus("That room isn't open. Check the code on the laptop.");
        return;
      }
      setStatus("Joined. Point the camera at the build.");
      source = new EventSource(`/api/pair/events?code=${code}`);
      source.onmessage = (event) => {
        try {
          const msg = parsePairMessage(JSON.parse(event.data));
          if (msg && msg.type !== "frame") setLast(msg);
        } catch {
          /* ignore a bad event */
        }
      };
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch {
        const fault = faultCopy("camera-denied");
        setStatus(`${fault.title}. ${fault.detail}`);
        return;
      }
      if (stop) return stream.getTracks().forEach((t) => t.stop());
      if (video.current) video.current.srcObject = stream;
      timer = setInterval(() => {
        const v = video.current;
        if (!v || !v.videoWidth) return;
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight));
        canvas.width = Math.round(v.videoWidth * scale);
        canvas.height = Math.round(v.videoHeight * scale);
        canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
        publish({ type: "frame", image: canvas.toDataURL("image/jpeg", 0.6) }).catch(() => setStatus("Couldn't send the camera frame."));
      }, 1200);
    })().catch(() => setStatus("Couldn't join that room."));

    return () => {
      stop = true;
      source?.close();
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [code]);

  return (
    <main className="min-h-dvh bg-ink px-4 py-6 text-white">
      <h1 className="text-lg font-semibold">BuildSight phone</h1>
      <p className="mt-1 font-mono text-sm tracking-[0.25em] text-white/70">{code}</p>
      <p className="mt-3 text-sm text-white/80" aria-live="polite">
        {status}
      </p>
      <video ref={video} autoPlay playsInline muted className="mt-4 aspect-[4/3] w-full rounded-2xl bg-black object-cover" />
      {last?.type === "step" && <p className="mt-3 text-sm">Laptop is on page {last.page}, step {last.step}.</p>}
      {last?.type === "check" && <p className="mt-3 text-sm">{last.say}</p>}
      {last?.type === "transcript" && <p className="mt-3 text-sm text-sky-200">{last.text}</p>}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setDraft("");
          fetch("/api/pair/publish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, message: { type: "transcript", text, from: "phone" } }),
          }).catch(() => setStatus("Couldn't send that note."));
        }}
      >
        <label htmlFor="phone-note" className="sr-only">
          Note to the laptop
        </label>
        <input
          id="phone-note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Send a note"
          className="min-w-0 flex-1 rounded-xl bg-white/10 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-xl bg-holo px-3 py-2 text-sm font-semibold text-ink">
          Send
        </button>
      </form>
    </main>
  );
}
