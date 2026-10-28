import { firstJsonObject } from "./json.ts";
import { parseIssueBox, parseIssueKind, type IssueBox, type IssueKind } from "./issueBox.ts";

export type CheckResult = {
  step_complete: boolean;
  confidence: number; // 0–1: how sure the step_complete call is (forced low when the camera can't see the build)
  can_see: boolean; // false when the camera view doesn't show the build clearly (dark, covered, blurry, off-frame)
  // box: where the mistake is in the CAMERA photo, normalized 0-1; missing when the model couldn't place it
  issues: { part: string; problem: string; fix: string; kind?: IssueKind; box?: IssueBox }[];
  say: string; // one short sentence to speak aloud
};

function isIssue(i: unknown): i is Record<string, unknown> {
  return !!i && typeof i === "object" && ["part", "problem", "fix"].some((k) => typeof (i as Record<string, unknown>)[k] === "string");
}

// Keeps the issue text even when its box is missing or bad.
function toIssue(i: Record<string, unknown>): CheckResult["issues"][number] {
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  return { part: text(i.part), problem: text(i.problem), fix: text(i.fix), kind: parseIssueKind(i.kind), box: parseIssueBox(i.box) };
}

// The model is asked for bare JSON; tolerate a stray code fence anyway.
export function parseCheckResult(text: string): CheckResult | null {
  try {
    const r = firstJsonObject(text) as { can_see?: unknown; step_complete?: unknown; confidence?: unknown; issues?: unknown; say?: unknown } | null;
    if (!r) return null;
    if (typeof r.step_complete !== "boolean" || typeof r.confidence !== "number" || !Number.isFinite(r.confidence)) return null;
    const canSee = r.can_see !== false;
    // Can't see the build: never report it as a confident pass or a list of problems.
    return {
      can_see: canSee,
      step_complete: canSee && r.step_complete,
      confidence: canSee ? Math.max(0, Math.min(1, r.confidence)) : Math.min(0.3, Math.max(0, r.confidence)),
      issues: canSee && Array.isArray(r.issues) ? r.issues.filter(isIssue).map(toIssue) : [],
      say: typeof r.say === "string" ? r.say : "",
    };
  } catch {
    return null;
  }
}
