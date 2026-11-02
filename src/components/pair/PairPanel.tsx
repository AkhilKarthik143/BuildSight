"use client";

import type { BuildPairing } from "../build/useBuildPairing";
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

export function PairPanel({ onClose, pairing }: { onClose: () => void; pairing: BuildPairing }) {
  const { code, error, last, frame, usePhone, selectCamera, disconnect, create } = pairing;
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
        {!code && <button onClick={() => create()} className="mt-3 rounded-lg bg-holo px-3 py-2 text-xs font-semibold text-ink">Open pairing room</button>}
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
            {frame && (
              // eslint-disable-next-line @next/next/no-img-element -- camera frame is a data URL
              <img src={frame} alt="Frame from the phone" className="mx-auto mt-2 h-24 w-36 rounded object-cover" />
            )}
            <p className="mt-3 text-xs text-white/60">Use an HTTPS address reachable from both devices. A localhost link only works on this laptop.</p>
            <button disabled={!frame && !usePhone} onClick={() => selectCamera(!usePhone)} className="mt-3 rounded-xl bg-holo px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-40">{usePhone ? "Use laptop camera" : "Use phone camera"}</button>
            <button onClick={disconnect} className="ml-2 rounded-lg px-3 py-2 text-xs text-white/65">Disconnect</button>
          </>
        )}
      </div>
    </div>
  );
}
