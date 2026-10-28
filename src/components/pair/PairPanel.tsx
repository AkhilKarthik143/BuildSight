"use client";

import { useEffect, useState } from "react";
import { parsePairMessage, type PairMessage } from "@/lib/pairing/schema";
import { qrSvg } from "@/lib/pairing/qr";

function QrCode({ text }: { text: string }) {
  let svg = "";
  try {
    svg = qrSvg(text);
  } catch {
    svg = "";
  }
  if (!svg) return null;
  return <div className="mx-auto mt-3 w-48 bg-white p-2" aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function PairPanel({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<PairMessage | null>(null);

  useEffect(() => {
    let closed = false;
    let source: EventSource | null = null;
    (async () => {
      const res = await fetch("/api/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create" }) });
      const data = await res.json().catch(() => ({}));
      if (closed) return;
      if (!res.ok || typeof data.code !== "string") {
        setError(data.error ?? "Couldn't open a pairing room.");
        return;
      }
      setCode(data.code);
      source = new EventSource(`/api/pair/events?code=${data.code}`);
      source.onmessage = (event) => {
        try {
          const msg = parsePairMessage(JSON.parse(event.data));
          if (msg) setLast(msg);
        } catch {
          /* a bad frame does not close the room */
        }
      };
    })().catch(() => !closed && setError("Couldn't open a pairing room."));
    return () => {
      closed = true;
      source?.close();
    };
  }, []);

  const joinUrl = code && typeof window !== "undefined" ? `${window.location.origin}/pair/${code}` : "";

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-ink/80 p-4" role="dialog" aria-label="Pair a phone">
      <div className="hud-panel w-full max-w-sm rounded-2xl p-4 text-center">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Pair a phone</h2>
          <button type="button" onClick={onClose} aria-label="Close pairing" className="rounded-lg px-2 py-1 text-xs text-white/70 hover:text-white">
            Close
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
        {code && (
          <>
            <p className="mt-2 text-xs text-white/60">Open this on the phone, or scan the code.</p>
            <p className="mt-2 font-mono text-3xl tracking-[0.3em] text-white" aria-label={`Room code ${code.split("").join(" ")}`}>
              {code}
            </p>
            {joinUrl && <QrCode text={joinUrl} />}
            <p className="mt-2 break-all text-[11px] text-white/50">{joinUrl}</p>
            <p className="mt-3 text-xs text-white/80" aria-live="polite">
              {last?.type === "frame" ? "Phone camera connected." : last?.type === "transcript" ? last.text : last?.type === "check" ? last.say : "Waiting for the phone."}
            </p>
            {last?.type === "frame" && (
              // eslint-disable-next-line @next/next/no-img-element -- camera frame is a data URL
              <img src={last.image} alt="Frame from the phone" className="mx-auto mt-2 h-24 w-36 rounded object-cover" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
