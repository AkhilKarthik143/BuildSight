// A finished build, from local state. Pure.

export type SessionMistake = { part: string; where: string; problem: string };
export type SessionStep = { key: string; label: string; startedAt: number; endedAt: number; mistakes: SessionMistake[] };

export type SessionState = {
  title: string;
  steps: SessionStep[];
  open: { key: string; label: string; startedAt: number; mistakes: SessionMistake[] } | null;
};

export function emptySession(title: string): SessionState {
  return { title, steps: [], open: null };
}

export function noteStep(state: SessionState, key: string, label: string, now?: number): SessionState {
  const at = now ?? Date.now();
  if (state.open?.key === key) return state.open.label === label ? state : { ...state, open: { ...state.open, label } };
  const steps = state.open ? [...state.steps, { ...state.open, endedAt: at }] : state.steps;
  return { ...state, steps, open: { key, label, startedAt: at, mistakes: [] } };
}

export function noteMistake(state: SessionState, mistake: SessionMistake): SessionState {
  if (!state.open) return state;
  return { ...state, open: { ...state.open, mistakes: [...state.open.mistakes, mistake] } };
}

export function closeSession(state: SessionState, now: number): SessionState {
  if (!state.open) return state;
  return { title: state.title, steps: [...state.steps, { ...state.open, endedAt: now }], open: null };
}

function clock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

export function formatSessionMarkdown(state: SessionState, now?: number): string {
  const closed = closeSession(state, now ?? Date.now());
  const mistakes = closed.steps.reduce((n, step) => n + step.mistakes.length, 0);
  const lines = [
    `# ${closed.title || "Build"} summary`,
    "",
    `${closed.steps.length} step${closed.steps.length === 1 ? "" : "s"} · ${mistakes} mistake${mistakes === 1 ? "" : "s"} caught`,
    "",
  ];
  if (!closed.steps.length) lines.push("No steps recorded.");
  for (const step of closed.steps) {
    lines.push(`## ${step.label}`, "", `Time: ${clock(step.endedAt - step.startedAt)}`);
    if (!step.mistakes.length) lines.push("Mistakes: none", "");
    else {
      lines.push("Mistakes:");
      for (const mistake of step.mistakes) {
        const where = mistake.where ? ` (${mistake.where})` : "";
        lines.push(`- ${mistake.part || "Piece"}${where}: ${mistake.problem}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n").trimEnd() + "\n";
}
