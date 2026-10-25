// Checks Auto Mode's decisions (src/lib/autoCheck.ts): the pass rule, the backoff, and the "changed, then still" trigger.
// Run: npm run test:auto
import {
  AUTO_ADVANCE_MS,
  AUTO_BASE_GAP_MS,
  AUTO_MAX_GAP_MS,
  AUTO_MAX_MISSES,
  AUTO_PRESETS,
  AUTO_STILL_MS,
  DEFAULT_SPEED,
  describeTiming,
  gapFor,
  markChecked,
  newWatch,
  presetAt,
  recordMiss,
  resetForStep,
  stepSpeed,
  tick,
  timingFor,
} from "../src/lib/autoCheck.ts";
import { checkVerdict as verdictOf, isPass } from "../src/lib/issueBox.ts";

let failed = 0;
let total = 0;
function eq(name, got, want) {
  total++;
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(62)} → ${JSON.stringify(got)}${ok ? "" : `  (expected ${JSON.stringify(want)})`}`);
}

// ── pass rule (shared with the manual Check) ──
const r = (o) => ({ can_see: true, step_complete: true, confidence: 0.9, issues: [], say: "", ...o });
const issue = [{ part: "red 2x2", problem: "rotated", fix: "turn it" }];
eq("done, sure, no issues → pass", [isPass(r({})), verdictOf(r({}))], [true, "pass"]);
eq("done but an issue listed → not a pass (was moving on before)", [isPass(r({ issues: issue })), verdictOf(r({ issues: issue }))], [false, "fix"]);
eq("done at 0.69 → not a pass, need a better look", [isPass(r({ confidence: 0.69 })), verdictOf(r({ confidence: 0.69 }))], [false, "unsure"]);
eq("done at exactly 0.7 → pass", isPass(r({ confidence: 0.7 })), true);
eq("can't see → not a pass", [isPass(r({ can_see: false })), verdictOf(r({ can_see: false }))], [false, "unsure"]);
eq("not done, sure → not done yet", verdictOf(r({ step_complete: false })), "notyet");
eq("not done, unsure (0.4) → need a better look", verdictOf(r({ step_complete: false, confidence: 0.4 })), "unsure");

// ── backoff ──
eq("gap by misses 0..5 (8, 8, 16, 32, 32, 32 s)", [0, 1, 2, 3, 4, 5].map(gapFor), [8000, 8000, 16000, 32000, 32000, 32000]);

// ── trigger ──
const N = 64 * 48;
const scene = (v, changedPixels = 0) => {
  const a = new Uint8ClampedArray(N).fill(100);
  for (let i = 0; i < changedPixels; i++) a[i] = v;
  return a;
};
const empty = scene(100);
const onePiece = scene(200, Math.ceil(N * 0.03)); // a piece covering 3% of the view
const tiny = scene(200, Math.floor(N * 0.01)); // 1%: below the threshold
const hand = scene(10, Math.ceil(N * 0.3)); // a hand over the table

// feeds the same sample every 500 ms for `ms`, returns the last tick
function hold(w, sample, from, ms, blocked = false) {
  let t;
  for (let now = from; now <= from + ms; now += 500) t = tick(w, sample, now, blocked);
  return t;
}

let w = newWatch(0);
let t = hold(w, empty, 0, 1000);
eq("no baseline until the scene has been still 1.5 s", [t.check, t.reason], [false, "waiting for a still baseline"]);
t = hold(w, empty, 1500, 500);
eq("still → baseline saved, no check", [t.check, w.baseline === empty], [false, true]);
t = hold(w, empty, 2500, 10000);
eq("nothing changed → never checks", [t.check, t.reason], [false, "no change"]);
t = tick(w, hand, 13000, false);
eq("hand moving over the table → no check", [t.check, t.reason], [false, "moving"]);
t = hold(w, onePiece, 13500, 1000);
eq("piece placed, still only 1 s → no check", [t.check, t.reason], [false, "moving"]);
t = hold(w, onePiece, 15000, 500);
eq("piece placed and still 1.5 s → check", [t.check, t.reason], [true, "changed, then still"]);
eq("measured change is ~3%", Math.round(t.change * 100), 3);
markChecked(w, onePiece, 15500);
t = hold(w, onePiece, 16000, 20000);
eq("same scene after a check → never re-sent", [t.check, t.reason], [false, "no change"]);

// cooldown and misses
w = newWatch(0);
hold(w, empty, 0, 2000);
markChecked(w, empty, 2000);
w.misses = 2; // next wait: 16 s
t = hold(w, onePiece, 2500, 9500);
eq("after 2 misses: changed + still at 12 s → cooling down", [t.check, t.reason], [false, "cooling down"]);
t = hold(w, onePiece, 18000, 500);
eq("after 2 misses: at 16.5 s → check", t.check, true);
w.misses = AUTO_MAX_MISSES;
t = hold(w, scene(250, N), 60000, 2000);
eq(`after ${AUTO_MAX_MISSES} misses → paused`, [t.check, t.reason], [false, `paused after ${AUTO_MAX_MISSES} misses`]);
resetForStep(w);
eq("new step → misses and baseline cleared", [w.misses, w.baseline], [0, null]);

// blocked (voice speaking, check running, move-on pending)
w = newWatch(0);
hold(w, empty, 0, 2000);
t = hold(w, onePiece, 9000, 2000, true);
eq("changed + still but busy → no check", [t.check, t.reason], [false, "busy"]);
t = hold(w, onePiece, 11500, 0, false);
eq("busy ends → check", t.check, true);

// small change below threshold
w = newWatch(0);
hold(w, empty, 0, 2000);
t = hold(w, tiny, 10000, 2000);
eq("1% change (below 2%) → no check", [t.check, t.reason], [false, "no change"]);

// "where am I" after 2 not-done-yets in a row
w = newWatch(0);
eq("1st not done yet → keep checking", recordMiss(w, "notyet"), false);
eq("2nd not done yet → try where am I", recordMiss(w, "notyet"), true);
eq("3rd not done yet → don't ask again", recordMiss(w, "notyet"), false);
w = newWatch(0);
recordMiss(w, "notyet");
recordMiss(w, "unsure");
eq("a can't-see in between resets the streak", recordMiss(w, "notyet"), false);
eq("misses counted for backoff", w.misses, 3);

// ── speed presets ──
const pick = (t) => [t.stillMs, t.baseGapMs, t.maxGapMs, t.advanceMs];
eq("Careful = the original constants", pick(AUTO_PRESETS.careful), [AUTO_STILL_MS, AUTO_BASE_GAP_MS, AUTO_MAX_GAP_MS, AUTO_ADVANCE_MS]);
eq("Normal: still 1.2 s, gap 5 s (max 20 s), countdown 3 s", pick(AUTO_PRESETS.normal), [1200, 5000, 20000, 3000]);
eq("Fast: still 0.8 s, gap 3 s (max 12 s), countdown 2 s", pick(AUTO_PRESETS.fast), [800, 3000, 12000, 2000]);
eq("default speed is Normal", [DEFAULT_SPEED, presetAt(DEFAULT_SPEED)], [0.5, "normal"]);
eq("slider ends and middle land on the presets", [timingFor(0), timingFor(0.5), timingFor(1)], [AUTO_PRESETS.careful, AUTO_PRESETS.normal, AUTO_PRESETS.fast]);
const mid = timingFor(0.75);
eq("between Normal and Fast → in between", [mid.stillMs > 800 && mid.stillMs < 1200, mid.baseGapMs > 3000 && mid.baseGapMs < 5000], [true, true]);
const curve = [0, 0.1, 0.3, 0.5, 0.6, 0.8, 1].map(timingFor);
eq("faster slider never waits longer", curve.every((t, i) => i === 0 || (t.stillMs <= curve[i - 1].stillMs && t.baseGapMs <= curve[i - 1].baseGapMs)), true);
eq("out-of-range / bad slider values are clamped", [timingFor(-3), timingFor(9), timingFor(NaN)], [AUTO_PRESETS.careful, AUTO_PRESETS.fast, AUTO_PRESETS.normal]);
eq("presetAt between presets → null", presetAt(0.3), null);
eq("backoff still doubles at Fast (3, 3, 6, 12, 12 s)", [0, 1, 2, 3, 4].map((m) => gapFor(m, AUTO_PRESETS.fast)), [3000, 3000, 6000, 12000, 12000]);
eq("backoff at Normal (5, 5, 10, 20, 20 s)", [0, 1, 2, 3, 4].map((m) => gapFor(m, AUTO_PRESETS.normal)), [5000, 5000, 10000, 20000, 20000]);
eq("plain words", describeTiming(AUTO_PRESETS.normal), "Checks after 1.2 s still · at most every 5 s");
eq("plain words, Fast", describeTiming(AUTO_PRESETS.fast), "Checks after 0.8 s still · at most every 3 s");
eq("faster: Careful → Normal → Fast → Fast", [stepSpeed(0, 1), stepSpeed(0.5, 1), stepSpeed(1, 1)], [0.5, 1, 1]);
eq("slower: Fast → Normal → Careful → Careful", [stepSpeed(1, -1), stepSpeed(0.5, -1), stepSpeed(0, -1)], [0.5, 0, 0]);
eq("faster from between presets → next preset up", [stepSpeed(0.3, 1), stepSpeed(0.7, -1)], [0.5, 0.5]);

// Fast trigger: samples every 250 ms, checks after 0.8 s still, 3 s between checks, and still pauses after 4 misses.
const F = AUTO_PRESETS.fast;
function holdAt(w, sample, from, ms, timing, blocked = false) {
  let t;
  for (let now = from; now <= from + ms; now += timing.sampleMs) t = tick(w, sample, now, blocked, timing);
  return t;
}
let f = newWatch(0);
holdAt(f, empty, 0, 1000, F); // baseline after 0.8 s still
eq("Fast: baseline after 0.8 s still", f.baseline === empty, true);
let ft = tick(f, hand, 5000, false, F);
ft = holdAt(f, onePiece, 5250, 500, F);
eq("Fast: piece still 0.5 s → not yet", [ft.check, ft.reason], [false, "moving"]);
ft = holdAt(f, onePiece, 5750, 500, F);
eq("Fast: piece still 0.8 s → check", [ft.check, ft.reason], [true, "changed, then still"]);
markChecked(f, onePiece, 6250);
recordMiss(f, "notyet");
ft = tick(f, hand, 7000, false, F);
ft = holdAt(f, empty, 7250, 1000, F); // changed back and still, but within the 3 s gap
eq("Fast: within 3 s of the last check → cooling down", [ft.check, ft.reason], [false, "cooling down"]);
ft = holdAt(f, empty, 8500, 1000, F);
eq("Fast: after 3 s → checks again", ft.check, true);
f.misses = AUTO_MAX_MISSES;
ft = tick(f, hand, 20000, false, F);
ft = holdAt(f, onePiece, 20250, 2000, F);
eq(`Fast: still paused after ${AUTO_MAX_MISSES} misses`, [ft.check, ft.reason], [false, `paused after ${AUTO_MAX_MISSES} misses`]);
// A slow hand drifting (1.2% of pixels per 250 ms sample) counts as moving at Fast, as it would at 500 ms.
const drift = (k) => scene(180, Math.round(N * 0.012 * k));
let d = newWatch(0);
holdAt(d, empty, 0, 1000, F);
let dt;
for (let k = 1, now = 2000; k <= 6; k++, now += F.sampleMs) dt = tick(d, drift(k), now, false, F);
eq("Fast: a slowly moving hand still counts as moving", dt.reason, "moving");

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
