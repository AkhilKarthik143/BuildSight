// Checks the spoken-command matcher (src/lib/commands.ts). Run: npm run test:commands
import { matchCommand } from "../src/lib/commands.ts";

const cases = [
  // next / back
  ["Next.", { kind: "next" }],
  ["Okay, next step please.", { kind: "next" }],
  ["Continue", { kind: "next" }],
  ["move on", { kind: "next" }],
  ["Go back.", { kind: "back" }],
  ["previous step", { kind: "back" }],
  // repeat / check / stop
  ["Say that again?", { kind: "repeat" }],
  ["What do I do?", { kind: "repeat" }],
  ["Is this right?", { kind: "check" }],
  ["Did I do it right?", { kind: "check" }],
  ["I'm done.", { kind: "check" }],
  ["finished", { kind: "check" }],
  ["Stop talking.", { kind: "stop" }],
  ["Cancel.", { kind: "stop" }],
  ["Wait!", { kind: "stop" }],
  ["Hold on.", { kind: "stop" }],
  // Auto Mode
  ["Auto mode on.", { kind: "auto", on: true }],
  ["Turn on auto mode, please.", { kind: "auto", on: true }],
  ["Enable automatic mode", { kind: "auto", on: true }],
  ["Turn auto mode on", { kind: "auto", on: true }],
  ["Auto on", { kind: "auto", on: true }],
  ["Auto mode off.", { kind: "auto", on: false }],
  ["Turn off auto mode", { kind: "auto", on: false }],
  ["Stop auto mode.", { kind: "auto", on: false }],
  ["Disable auto checking", { kind: "auto", on: false }],
  ["What does auto mode do?", null],
  // Auto Mode speed
  ["Faster.", { kind: "speed", to: "faster" }],
  ["Okay, speed up please.", { kind: "speed", to: "faster" }],
  ["Go faster", { kind: "speed", to: "faster" }],
  ["Slower.", { kind: "speed", to: "slower" }],
  ["Slow down.", { kind: "speed", to: "slower" }],
  ["Auto speed fast.", { kind: "speed", to: "fast" }],
  ["Set auto speed to careful.", { kind: "speed", to: "careful" }],
  ["auto speed normal", { kind: "speed", to: "normal" }],
  ["Speed to fast", { kind: "speed", to: "fast" }],
  ["Auto mode careful", { kind: "speed", to: "careful" }],
  ["Normal mode.", { kind: "speed", to: "normal" }],
  ["Fast speed", { kind: "speed", to: "fast" }],
  ["How fast should I go?", null],
  ["Is the careful way better?", null],
  ["Can it check faster when I'm done?", null],
  ["Auto speed banana", null],
  ["Hold on, where does this go?", null],
  // where am I (camera)
  ["Where am I?", { kind: "locate" }],
  ["Okay, what step am I on?", { kind: "locate" }],
  ["Find my place please.", { kind: "locate" }],
  ["Where does this piece go?", null],
  ["What step is the red brick in?", null],
  // go to a step: digits and words
  ["Go to step 8.", { kind: "goto", step: 8 }],
  ["Step eight.", { kind: "goto", step: 8 }],
  ["skip to step twenty-one", { kind: "goto", step: 21 }],
  ["Jump to step forty two.", { kind: "goto", step: 42 }],
  ["I'm on step 8.", { kind: "goto", step: 8 }],
  ["Um, go to step number 12, please.", { kind: "goto", step: 12 }],
  // finished a step → the one after
  ["I finished step 7.", { kind: "goto", step: 8 }],
  ["I'm done with step seven.", { kind: "goto", step: 8 }],
  ["Completed steps 1 through 7.", { kind: "goto", step: 8 }],
  ["I've finished steps one to ninety-eight.", { kind: "goto", step: 99 }],
  // questions and other speech: not commands, these go to Claude
  ["What color is the piece in step 8?", null],
  ["Next to the red brick?", null],
  ["What's the next step?", null],
  ["Should I go back and fix the wing?", null],
  ["How do I check if it's on tight?", null],
  ["Step 8 is confusing, can you help?", null],
  ["I'm done with the red bricks, what now?", null],
  ["Go to step banana", null],
  ["", null],
];

let failed = 0;
for (const [text, want] of cases) {
  const got = matchCommand(text);
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${JSON.stringify(text).padEnd(48)} → ${JSON.stringify(got)}${ok ? "" : `  (expected ${JSON.stringify(want)})`}`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
