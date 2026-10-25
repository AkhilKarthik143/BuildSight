// Checks Auto Mode's decisions (src/lib/autoCheck.ts): the pass rule, the backoff, and the "changed, then still" trigger.
// Run: npm run test:auto
import { AUTO_MAX_MISSES, gapFor, markChecked, newWatch, recordMiss, resetForStep, tick } from "../src/lib/autoCheck.ts";
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

console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
