// The four friendly failures. Pure.
import { faultCopy, faultFromMessage } from "../src/lib/faults.ts";

let failed = 0;
function check(name, ok) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

for (const kind of ["camera-denied", "mic-denied", "offline", "rate-limited"]) {
  const copy = faultCopy(kind);
  check(`${kind} copy`, Boolean(copy.title && copy.detail && copy.say && !copy.say.includes("http")));
}
check("429", faultFromMessage("Too many requests. Try again shortly.", 429) === "rate-limited");
check("daily", faultFromMessage("Daily limit reached.") === "rate-limited");
check("mic", faultFromMessage("Microphone is blocked. Allow it.") === "mic-denied");
check("camera", faultFromMessage("Camera is blocked. Allow the camera.") === "camera-denied");
check("offline", faultFromMessage("Network problem. Check the connection.") === "offline");
check("other", faultFromMessage("Model reply wasn't valid JSON.") === null);

console.log(failed ? `\n${failed} failed` : "\nfault tests passed");
if (failed) process.exit(1);
