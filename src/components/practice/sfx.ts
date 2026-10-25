"use client";

// Small synthesized sounds (no audio files): a crisp click when a part snaps, a double click for latches,
// a soft low note for a correction. Started from a tap, since browsers block audio until the user interacts.

let ctx: AudioContext | null = null;

export function unlockSfx() {
  if (typeof window === "undefined") return;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
}

function click(at: number, freq: number, gain: number) {
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * 0.03);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(at);
  // a short body thump under the click
  const o = ctx.createOscillator();
  const og = ctx.createGain();
  o.frequency.setValueAtTime(190, at);
  o.frequency.exponentialRampToValueAtTime(90, at + 0.06);
  og.gain.setValueAtTime(gain * 0.5, at);
  og.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
  o.connect(og).connect(ctx.destination);
  o.start(at);
  o.stop(at + 0.08);
}

function tone(at: number, from: number, to: number, dur: number, gain: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

export function sfx(kind: "snap" | "latch" | "wrong" | "pick" | "done") {
  if (!ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.01;
  if (kind === "snap") click(t, 2600, 0.55);
  if (kind === "latch") {
    click(t, 3200, 0.45);
    click(t + 0.075, 3600, 0.4);
  }
  if (kind === "wrong") tone(t, 330, 220, 0.22, 0.07);
  if (kind === "pick") tone(t, 900, 1100, 0.06, 0.03);
  if (kind === "done") [523, 659, 784].forEach((f, i) => tone(t + i * 0.09, f, f, 0.22, 0.06));
}
