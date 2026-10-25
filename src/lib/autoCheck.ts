// Auto Mode: check the build on its own when the builder seems to have finished, and move on when it passes.
// The trigger is "changed, then still": the table differs from the last checked scene, and nothing has moved
// for a moment (hands out of the way). Motion is measured on the phone from a 64x48 grayscale sample, so
// watching is free; Claude is only called when this says so. Kept free of React so it can be tested.
// The pass rule itself (isPass / checkVerdict) lives in src/lib/issueBox.ts and is shared with the manual Check.

import type { CheckVerdict } from "@/lib/issueBox";

/** Share of 64x48 pixels that must differ from the last checked scene to count as "something was built". Tune here. */
export const AUTO_CHANGE_THRESHOLD = 0.02;
/** Share of pixels that may change between two samples (500 ms apart) and still count as "not moving". */
export const AUTO_MOTION_THRESHOLD = 0.02;
/** How long the scene must hold still before checking (hands out of frame). */
export const AUTO_STILL_MS = 1500;
/** Wait between automatic checks: 8 s, doubling after each miss (8, 8, 16, 32). These are the Careful preset (see AUTO_PRESETS). */
export const AUTO_BASE_GAP_MS = 8000;
export const AUTO_MAX_GAP_MS = 32000;
/** After this many misses on one step, stop checking until the step changes or the builder presses Check. */
export const AUTO_MAX_MISSES = 4;
/** After this many "not done yet" results in a row, ask "where am I?" in case the builder skipped ahead. */
export const AUTO_LOCATE_AFTER = 2;
/** Mistakes are only spoken in Auto Mode at this confidence or higher. */
export const AUTO_SPEAK_FIX_CONFIDENCE = 0.6;
/** Auto Mode moves on this long after the "verified" line finishes speaking. */
export const AUTO_ADVANCE_MS = 3000;
/** A manual Check moves on this long after the result (unchanged from before Auto Mode). */
export const MANUAL_ADVANCE_MS = 1800;
/** How often the camera is sampled at the Careful speed; AUTO_MOTION_THRESHOLD is per this interval. */
export const AUTO_SAMPLE_MS = 500;

// ── Speed ───────────────────────────────────────────────────────────────────
// The timing above is the Careful preset. The builder can pick a faster speed (a slider from Careful to Fast,
// with Normal in the middle). The backoff after misses and the pause after AUTO_MAX_MISSES apply at every speed.

export type AutoTiming = {
  stillMs: number; // scene must hold still this long before a check
  baseGapMs: number; // wait between checks, doubling after each miss...
  maxGapMs: number; // ...up to this
  advanceMs: number; // move-on countdown after a pass
  sampleMs: number; // how often the camera is sampled
};

export const AUTO_PRESETS = {
  careful: { stillMs: AUTO_STILL_MS, baseGapMs: AUTO_BASE_GAP_MS, maxGapMs: AUTO_MAX_GAP_MS, advanceMs: AUTO_ADVANCE_MS, sampleMs: AUTO_SAMPLE_MS },
  normal: { stillMs: 1200, baseGapMs: 5000, maxGapMs: 20000, advanceMs: 3000, sampleMs: 400 },
  fast: { stillMs: 800, baseGapMs: 3000, maxGapMs: 12000, advanceMs: 2000, sampleMs: 250 },
} satisfies Record<string, AutoTiming>;
export type AutoPreset = keyof typeof AUTO_PRESETS;

/** Slider positions: 0 = Careful, 0.5 = Normal, 1 = Fast. */
export const SPEED_OF: Record<AutoPreset, number> = { careful: 0, normal: 0.5, fast: 1 };
export const DEFAULT_SPEED = SPEED_OF.normal;

/** Timing for a slider position (0 Careful … 0.5 Normal … 1 Fast), blending between neighbouring presets. */
export function timingFor(speed: number): AutoTiming {
  const v = Number.isFinite(speed) ? Math.min(1, Math.max(0, speed)) : DEFAULT_SPEED;
  const [a, b, f] = v <= 0.5 ? [AUTO_PRESETS.careful, AUTO_PRESETS.normal, v / 0.5] : [AUTO_PRESETS.normal, AUTO_PRESETS.fast, (v - 0.5) / 0.5];
  const mix = (k: keyof AutoTiming, step: number) => Math.round((a[k] + (b[k] - a[k]) * f) / step) * step;
  return { stillMs: mix("stillMs", 100), baseGapMs: mix("baseGapMs", 500), maxGapMs: mix("maxGapMs", 1000), advanceMs: mix("advanceMs", 100), sampleMs: mix("sampleMs", 50) };
}

/** The preset a slider position sits on (within a hair), or null between presets. */
export function presetAt(speed: number): AutoPreset | null {
  return (Object.keys(SPEED_OF) as AutoPreset[]).find((p) => Math.abs(SPEED_OF[p] - speed) < 0.02) ?? null;
}

/** "faster" / "slower": the next preset in that direction (from anywhere on the slider). */
export function stepSpeed(speed: number, dir: 1 | -1): number {
  const stops = [0, 0.5, 1];
  const next = dir > 0 ? stops.find((s) => s > speed + 0.02) : [...stops].reverse().find((s) => s < speed - 0.02);
  return next ?? (dir > 0 ? 1 : 0);
}

/** Plain words for the settings: "Checks after 1.2 s still · at most every 5 s". */
export function describeTiming(t: AutoTiming): string {
  const sec = (ms: number) => `${Number((ms / 1000).toFixed(1))} s`;
  return `Checks after ${sec(t.stillMs)} still · at most every ${sec(t.baseGapMs)}`;
}

/** Share of pixels that changed noticeably between two small grayscale samples (0–1). */
export function changed(a: Uint8ClampedArray, b: Uint8ClampedArray, threshold = 28): number {
  if (a.length !== b.length || !a.length) return 1;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > threshold) n++;
  return n / a.length;
}

/** Wait required since the last automatic check, given the misses on this step so far. */
export function gapFor(misses: number, timing?: AutoTiming): number {
  // Anything but a timing object means Careful (also keeps `[0, 1, 2].map(gapFor)` working: map passes an index here).
  const t = timing && typeof timing === "object" ? timing : AUTO_PRESETS.careful;
  return Math.min(t.maxGapMs, t.baseGapMs * 2 ** Math.max(0, misses - 1));
}

export type Watch = {
  prev: Uint8ClampedArray | null; // last sample, for motion
  stillSince: number;
  baseline: Uint8ClampedArray | null; // the scene at the last check (or when this step opened)
  lastCheck: number; // when the last automatic check ran
  misses: number; // non-passing automatic checks on this step
  notYet: number; // "not done yet" results in a row on this step
};

export function newWatch(now: number): Watch {
  return { prev: null, stillSince: now, baseline: null, lastCheck: 0, misses: 0, notYet: 0 };
}

/** A new step: forget the scene and the misses (the last check time stays, so the gap still holds). */
export function resetForStep(w: Watch) {
  w.baseline = null;
  w.misses = 0;
  w.notYet = 0;
}

export type Tick = {
  check: boolean;
  motion: number; // share changed since the previous sample
  change: number | null; // share changed since the baseline (null until there is one)
  stillMs: number;
  reason: string; // why it did or didn't check, for the console
};

/**
 * Feeds one camera sample. Returns whether to run a check now. `blocked` is true while something else is going on
 * (loading, a check or "where am I" running, the voice speaking, a move-on pending).
 * Updates motion tracking; the caller calls markChecked() when it actually starts a check.
 */
export function tick(w: Watch, sample: Uint8ClampedArray, now: number, blocked: boolean, timing: AutoTiming = AUTO_PRESETS.careful): Tick {
  const motion = w.prev ? changed(w.prev, sample) : 1;
  w.prev = sample;
  // Samples closer together show less change for the same hand movement, so the motion bar scales with the interval.
  if (motion > AUTO_MOTION_THRESHOLD * (timing.sampleMs / AUTO_SAMPLE_MS)) w.stillSince = now;
  const stillMs = now - w.stillSince;
  const still = stillMs >= timing.stillMs;
  // The scene the step starts from: the first still moment after the step opens.
  if (!w.baseline) {
    if (still && !blocked) w.baseline = sample;
    return { check: false, motion, change: null, stillMs, reason: w.baseline ? "baseline saved" : "waiting for a still baseline" };
  }
  const change = changed(w.baseline, sample);
  const out = (check: boolean, reason: string): Tick => ({ check, motion, change, stillMs, reason });
  if (!still) return out(false, "moving");
  if (blocked) return out(false, "busy");
  if (w.misses >= AUTO_MAX_MISSES) return out(false, `paused after ${AUTO_MAX_MISSES} misses`);
  if (now - w.lastCheck < gapFor(w.misses, timing)) return out(false, "cooling down");
  if (change < AUTO_CHANGE_THRESHOLD) return out(false, "no change");
  return out(true, "changed, then still");
}

/** A check is starting on this scene: it becomes the new baseline, so the same scene is never sent twice. */
export function markChecked(w: Watch, sample: Uint8ClampedArray, now: number) {
  w.baseline = sample;
  w.lastCheck = now;
}

/** Records a non-passing result. Returns true when it's time to try "where am I?" instead. */
export function recordMiss(w: Watch, verdict: CheckVerdict): boolean {
  w.misses++;
  w.notYet = verdict === "notyet" ? w.notYet + 1 : 0;
  return verdict === "notyet" && w.notYet === AUTO_LOCATE_AFTER;
}
