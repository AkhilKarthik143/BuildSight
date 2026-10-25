// Checks the step-check mistake box parser (src/lib/issueBox.ts). Run: npm run test:boxes
import { parseIssueBox, parseIssueKind } from "../src/lib/issueBox.ts";

const box = (left, top, right, bottom) => ({ left, top, right, bottom });
const cases = [
  ["valid box", box(25, 30, 45, 50), { x: 0.25, y: 0.3, w: 0.2, h: 0.2 }],
  ["edges are allowed", box(0, 0, 10, 100), { x: 0, y: 0, w: 0.1, h: 1 }],
  ["missing box", undefined, undefined],
  ["null box", null, undefined],
  ["not an object", "25,30,45,50", undefined],
  ["missing a side", { left: 10, top: 10, right: 20 }, undefined],
  ["string numbers", box("10", 10, 20, 20), undefined],
  ["NaN", box(NaN, 10, 20, 20), undefined],
  ["Infinity", box(10, 10, Infinity, 20), undefined],
  ["negative", box(-5, 10, 20, 20), undefined],
  ["over 100", box(10, 10, 120, 20), undefined],
  ["right before left", box(40, 10, 20, 30), undefined],
  ["bottom above top", box(10, 40, 30, 20), undefined],
  ["zero width", box(20, 10, 20, 30), undefined],
  ["under 2% tall", box(10, 10, 30, 11), undefined],
  ["over 80% of the photo", box(0, 0, 95, 95), undefined],
  ["just under 80%", box(0, 0, 80, 100), { x: 0, y: 0, w: 0.8, h: 1 }],
];

let failed = 0;
const near = (a, b) => (a === undefined || b === undefined ? a === b : ["x", "y", "w", "h"].every((k) => Math.abs(a[k] - b[k]) < 1e-9));
for (const [name, input, want] of cases) {
  const got = parseIssueBox(input);
  if (!near(got, want)) {
    failed++;
    console.log(`FAIL ${name}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
  }
}
for (const [input, want] of [["orientation", "orientation"], ["missing_part", "missing_part"], ["rotated", undefined], [undefined, undefined]]) {
  if (parseIssueKind(input) !== want) {
    failed++;
    console.log(`FAIL kind ${input}: got ${parseIssueKind(input)}`);
  }
}
const total = cases.length + 4;
console.log(`${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
