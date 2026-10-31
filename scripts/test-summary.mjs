// Session summary formatter and the "I'm done building" command. "I'm done." stays a check.
import { matchCommand } from "../src/lib/commands.ts";
import { emptySession, formatSessionMarkdown, noteMistake, noteStep, noteVerified } from "../src/lib/sessionSummary.ts";

let failed = 0;
function check(name, ok) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

check("I'm done. is still a check", matchCommand("I'm done.")?.kind === "check");
check("finished is still a check", matchCommand("finished")?.kind === "check");
for (const phrase of ["I'm done building", "I'm done with the build", "end the build", "session summary", "show the summary", "that's everything"]) {
  check(phrase, matchCommand(phrase)?.kind === "summary");
}

let state = emptySession("Playful Cat");
state = noteStep(state, "1-0", "Step 1", 0);
state = noteMistake(state, { part: "red 2x4", where: "top left", problem: "rotated" });
state = noteStep(state, "1-1", "Step 2", 90_000);
state = noteVerified(state, "1-0");
state = noteVerified(state, "1-0");
const md = formatSessionMarkdown(state, 150_000);
check("title", md.startsWith("# Playful Cat summary"));
check("verified once", md.includes("1 verified complete"));
check("visited is not completed", md.includes("2 steps visited"));
check("two steps", md.includes("2 steps"));
check("mistake where", md.includes("red 2x4 (top left): rotated"));
check("time", md.includes("Time: 1m 30s") && md.includes("Time: 1m 0s"));
check("empty", formatSessionMarkdown(emptySession("Build"), 0).includes("No steps recorded."));

console.log(failed ? `\n${failed} failed` : "\nsummary tests passed");
if (failed) process.exit(1);
