// Spoken and on-screen names for one manual step. Pure.

export type StepLike = { continued?: boolean; number: number; sub?: string; instruction: string };

// "Step 8" or, for a panel inside a step, "Step 8 · 2 of 4".
// A "continued" step (a page with no printed number) shows the step it continues, when known.
export function stepLabel(s: StepLike) {
  if (s.continued) return s.number ? `Step ${s.number} · continued` : "Continued";
  return `Step ${s.number}${s.sub ? ` · ${s.sub.replace("/", " of ")}` : ""}`;
}
export function spokenStep(s: StepLike) {
  if (s.continued) return `${s.number ? `Step ${s.number}, continued` : "Continuing"}. ${s.instruction}`;
  return `Step ${s.number}${s.sub ? `, part ${s.sub.replace("/", " of ")}` : ""}. ${s.instruction}`;
}
