// Offline eval of recorded check replies. No network. Fixtures are local JSON.
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCheckResult } from "../src/lib/checkParse.ts";
import { boxLocation, checkVerdict, isPass } from "../src/lib/issueBox.ts";

const dir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/check");
const labels = ["pass", "fix", "notyet", "unsure", "unparsed"];

const files = (await readdir(dir)).filter((name) => name.endsWith(".json")).sort();
if (files.length < 12) {
  console.error(`need 12 fixtures, found ${files.length}`);
  process.exit(1);
}

const matrix = Object.fromEntries(labels.map((row) => [row, Object.fromEntries(labels.map((col) => [col, 0]))]));
let failed = 0;

for (const file of files) {
  const fixture = JSON.parse(await readFile(join(dir, file), "utf8"));
  const parsed = parseCheckResult(fixture.reply);
  const gotVerdict = parsed ? checkVerdict(parsed) : "unparsed";
  const gotPass = parsed ? isPass(parsed) : false;
  const gotLocations = parsed ? parsed.issues.filter((issue) => issue.box).map((issue) => boxLocation(issue.box)) : [];
  matrix[fixture.verdict][gotVerdict] += 1;
  const sameLocations = JSON.stringify(gotLocations) === JSON.stringify(fixture.locations);
  const sameConfidence = fixture.confidence === undefined || (parsed && parsed.confidence === fixture.confidence);
  const sameIssues = fixture.issues === undefined || (parsed && parsed.issues.length === fixture.issues);
  const ok = gotVerdict === fixture.verdict && gotPass === fixture.pass && sameLocations && sameConfidence && sameIssues;
  if (!ok) failed++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${file.padEnd(28)} verdict ${gotVerdict} pass ${gotPass} loc ${JSON.stringify(gotLocations)}` +
      (ok ? "" : `  expected ${fixture.verdict} pass ${fixture.pass} loc ${JSON.stringify(fixture.locations)}`),
  );
}

console.log("\nconfusion (rows expected, columns got)");
console.log(["expected", ...labels].join("\t"));
for (const row of labels) {
  console.log([row, ...labels.map((col) => matrix[row][col])].join("\t"));
}
console.log(`\n${files.length - failed}/${files.length} fixtures matched`);
if (failed) process.exit(1);
console.log("eval-check passed");
