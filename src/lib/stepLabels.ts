import type { ExtractedStep } from "@/app/api/extract/route";
// "Step 8" or, for a panel inside a step, "Step 8 · 2 of 4".
// A "continued" step (a page with no printed number) shows the step it continues, when known.
export function stepLabel(s: ExtractedStep) {
  if (s.continued) return s.number ? `Step ${s.number} · continued` : "Continued";
  return `Step ${s.number}${s.sub ? ` · ${s.sub.replace("/", " of ")}` : ""}`;
}
export function spokenStep(s: ExtractedStep) {
  if (s.continued) return `${s.number ? `Step ${s.number}, continued` : "Continuing"}. ${s.instruction}`;
  return `Step ${s.number}${s.sub ? `, part ${s.sub.replace("/", " of ")}` : ""}. ${s.instruction}`;
}
