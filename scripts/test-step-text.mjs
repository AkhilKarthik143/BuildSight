// Spoken and on-screen step names (src/lib/stepText.ts). Run: npm run test:steps
import { spokenStep, stepLabel } from "../src/lib/stepText.ts";

const cases = [
  [stepLabel({ number: 8, instruction: "Attach the wing." }), "Step 8"],
  [stepLabel({ number: 8, sub: "2/4", instruction: "x" }), "Step 8 · 2 of 4"],
  [stepLabel({ continued: true, number: 8, instruction: "x" }), "Step 8 · continued"],
  [stepLabel({ continued: true, number: 0, instruction: "x" }), "Continued"],
  [spokenStep({ number: 3, instruction: "Press the plate down." }), "Step 3. Press the plate down."],
  [spokenStep({ number: 3, sub: "1/2", instruction: "Clip it." }), "Step 3, part 1 of 2. Clip it."],
  [spokenStep({ continued: true, number: 3, instruction: "Keep going." }), "Step 3, continued. Keep going."],
  [spokenStep({ continued: true, number: 0, instruction: "Keep going." }), "Continuing. Keep going."],
];

let failed = 0;
for (const [got, want] of cases) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${JSON.stringify(got)}${ok ? "" : `  (expected ${JSON.stringify(want)})`}`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
if (failed) process.exit(1);
console.log("step text tests passed");
