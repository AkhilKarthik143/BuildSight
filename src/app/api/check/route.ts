import { withApiGuard } from "@/lib/apiGuard";
// Step check: compares the camera frame to the manual's picture for this step
// (and the previous step), and says whether the step is done and what's wrong.

import { askClaude, ClaudeError, type Part } from "@/lib/claude";
import { parseCheckResult as parseResult } from "@/lib/checkResult";
export type { CheckResult } from "@/lib/checkResult";
import { LOOKALIKE_RULE, partsPrompt, readPartLines, type PartLine } from "@/lib/parts";

const MAX_IMAGE_CHARS = 4_000_000;

type CheckRequest = {
  frame?: string; // camera frame, data URL
  expected?: string; // manual picture of this step finished, data URL
  previous?: string; // manual picture of the previous step finished, data URL (optional)
  instruction?: string; // what this step asks for, if known
  watchFor?: string[]; // common mistakes to look for
  parts?: PartLine[]; // every part of this step, described by appearance (optional; older clients don't send it)
};

const SYSTEM_PROMPT = `You check one step of a build against its instruction manual.
You get up to three images, in this order:
1. PREVIOUS: the manual's picture of the build before this step (may be missing).
2. EXPECTED: the manual's picture of the build after this step.
3. CAMERA: a photo of the real build right now.

Manual pictures are drawn, not photos: ignore drawing style, background, colors shifted by
lighting, camera angle, and the parts callout box. Judge only the physical build.
Focus on what changed between PREVIOUS and EXPECTED: is that change present in CAMERA,
in the right place and orientation?

Reply with JSON only, no other text:
{"can_see": boolean, "step_complete": boolean, "confidence": number between 0 and 1,
 "issues": [{"part": "piece by color and size", "problem": "what's wrong", "fix": "what to do",
             "kind": "wrong_part" | "orientation" | "misalignment" | "missing_part" | "incorrect_placement" | "other",
             "box": {"left": int, "top": int, "right": int, "bottom": int}}],
 "say": "one sentence, at most 20 words, to speak to the builder"}
- can_see: false if CAMERA doesn't clearly show the build (too dark, covered, blurry, or the build isn't in frame).
- confidence: how sure you are that step_complete is right. It is NOT how sure you are that the camera is unusable.
- If can_see is false: step_complete false, issues empty, and "say" asks for a closer or clearer view.
- issues: only mistakes you can actually see in CAMERA. A piece that is there but wrong (wrong color, size or
  shape) is wrong_part. A piece that isn't there at all is missing_part. Hands, fingers, shadows, the table and
  loose pieces lying beside the build are not part of the build.
- fix: one specific action naming the piece, like "Turn the red 2x4 so it runs left to right."
- box: where the mistake is in the CAMERA image (never the manual pictures), as whole-number percentages of
  CAMERA's width (left, right) and height (top, bottom), 0 to 100. Draw it tight around the wrong piece. For a
  missing piece, box the spot where it belongs only if that spot is clearly visible. Leave "box" out if you
  aren't sure where it is, or the piece is hidden or out of frame. Never guess a box.`;

function isImage(s: unknown): s is string {
  return typeof s === "string" && s.startsWith("data:image/") && s.length <= MAX_IMAGE_CHARS;
}

async function handlePOST(request: Request) {
  let body: CheckRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const { frame, expected, previous, instruction, watchFor } = body;
  const stepParts = readPartLines(body.parts);
  if (!isImage(frame) || !isImage(expected) || (previous !== undefined && !isImage(previous))) {
    return Response.json({ error: "Send `frame` and `expected` (and optionally `previous`) as image data URLs." }, { status: 400 });
  }

  const parts: Part[] = [];
  if (previous) parts.push({ type: "text", text: "PREVIOUS:" }, { type: "image", dataUrl: previous });
  parts.push(
    { type: "text", text: "EXPECTED:" },
    { type: "image", dataUrl: expected },
    { type: "text", text: "CAMERA:" },
    { type: "image", dataUrl: frame },
  );
  const notes = [
    instruction && `This step: ${instruction}`,
    watchFor?.length && `Common mistakes here: ${watchFor.join("; ")}`,
    stepParts.length &&
      `PARTS LIST for this step:\n${partsPrompt(stepParts)}\n${LOOKALIKE_RULE} ` +
        "If you're unsure a piece is the right one, set step_complete false with confidence below 0.5.",
  ].filter(Boolean);
  parts.push({ type: "text", text: notes.length ? notes.join("\n") : "Check this step." });

  const started = Date.now();
  try {
    const text = await askClaude({ system: SYSTEM_PROMPT, parts });
    const result = parseResult(text);
    if (!result) return Response.json({ error: "Model reply wasn't valid JSON." }, { status: 502 });
    return Response.json({ ...result, latencyMs: Date.now() - started });
  } catch (e) {
    const err = e instanceof ClaudeError ? e : new ClaudeError("Check failed.");
    return Response.json({ error: err.message }, { status: err.status });
  }
}

export const POST = withApiGuard("check", handlePOST);
