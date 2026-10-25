// Checks the streamed assistant reply reader (src/lib/assistReply.ts). Run: npm run test:assist
import { readAction, readTranscript } from "../src/lib/assistReply.ts";

let failed = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};

// Feed a reply in chunks of n characters; returns what was streamed and the final result.
function run(reply, n) {
  const r = readTranscript();
  let streamed = "";
  for (let i = 0; i < reply.length; i += n) streamed += r.feed(reply.slice(i, i + n));
  return { streamed, ...r.finish() };
}

const stuck = JSON.stringify({
  transcript: 'No problem. Pick up the lime green 2x4 plate. Turn it so the "notch" faces you.',
  action: "add_substeps",
  substeps: ["Pick up the lime green 2x4 plate", "Turn the notch toward you", "Press it onto the red brick"],
});
for (const n of [1, 3, 7, 1000]) {
  const r = run(stuck, n);
  eq(`stuck reply, chunks of ${n}: streamed text`, r.streamed, 'No problem. Pick up the lime green 2x4 plate. Turn it so the "notch" faces you.');
  eq(`stuck reply, chunks of ${n}: action`, r.action, {
    action: "add_substeps",
    substeps: ["Pick up the lime green 2x4 plate", "Turn the notch toward you", "Press it onto the red brick"],
  });
}

eq("next", run('{"transcript": "Moving on.", "action": "next"}', 4).action, { action: "next" });
eq("goto", run('{"transcript":"Going to step five.","action":"goto","goto_step":5}', 2).action, { action: "goto", goto_step: 5 });
eq("code fence", run('```json\n{"transcript": "Sure.", "action": "prev"}\n```', 5), { streamed: "Sure.", transcript: "Sure.", action: { action: "prev" } });
eq("unicode + newline escapes", run('{"transcript":"Caf\\u00e9 time.\\nNext line.","action":"none"}', 1).streamed, "Café time. Next line.");
eq("plain prose passes through", run("Press the brick down firmly.", 4), { streamed: "Press the brick down firmly.", transcript: "Press the brick down firmly.", action: { action: "none" } });
for (const n of [1, 4, 1000]) {
  eq(
    `prose then JSON, chunks of ${n}: spoken once`,
    run('Press the red brick down. {"transcript": "Press the red brick down.", "action": "next"}', n),
    { streamed: "Press the red brick down. ", transcript: "Press the red brick down.", action: { action: "next" } },
  );
}
eq("prose then fenced JSON", run('Sure.\n```json\n{"transcript": "Sure.", "action": "none"}\n```', 3), { streamed: "Sure.\n", transcript: "Sure.", action: { action: "none" } });
eq("cut off mid-reply keeps the words", run('{"transcript": "Press the red', 3), { streamed: "Press the red", transcript: "Press the red", action: { action: "none" } });

// Actions are validated; anything odd becomes "none" (never a wrong move).
eq("goto without a number", readAction({ action: "goto" }), { action: "none" });
eq("goto step 0", readAction({ action: "goto", goto_step: 0 }), { action: "none" });
eq("goto as text number", readAction({ action: "goto", goto_step: "7" }), { action: "goto", goto_step: 7 });
eq("one substep is not enough", readAction({ action: "add_substeps", substeps: ["Do it"] }), { action: "none" });
eq("substeps capped at 6", readAction({ action: "add_substeps", substeps: ["a", "b", "c", "d", "e", "f", "g", "h"] }).substeps.length, 6);
eq("unknown action", readAction({ action: "dance" }), { action: "none" });
eq("missing", readAction(null), { action: "none" });

console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);
