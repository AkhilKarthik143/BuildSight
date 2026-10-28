// Pure "where am I" decision. No DOM and no fetch, so tests can load it under node.

export type Tile = { tile: number; page: number; number: number; image: string };
export type BrokenTile = { tile: number; part: string; problem: string; fix: string };
export type WhereAmIResult = { completed_tile: number; confidence: number; broken: BrokenTile[] };

export type Placement =
  | { action: "fix"; target: Tile; problems: string[]; say: string }
  | { action: "goto"; target: Tile; say: string }
  | { action: "stay"; say: string }
  | { action: "done"; say: string }
  | { action: "unsure"; say: string };

export const AUTO_MIN_CONFIDENCE = 0.3;
export const BROKEN_MIN_CONFIDENCE = 0.6;

/**
 * `tiles` are the tiles that were sent, in order; `current` is the step on screen. A broken earlier step
 * wins over moving on: fixing it first keeps later checks honest.
 */
export function decide(
  result: WhereAmIResult,
  tiles: Tile[],
  complete: boolean,
  current?: { page: number; number: number },
  minConfidence = 0,
): Placement {
  const byTile = new Map(tiles.map((t) => [t.tile, t]));
  const still = complete ? "" : " I'm still reading the rest of the book.";
  const reached = byTile.get(result.completed_tile);
  if (result.confidence < minConfidence) return { action: "unsure", say: "I can't see the build clearly. Hold the phone steady over it." };
  const broken =
    result.confidence < BROKEN_MIN_CONFIDENCE
      ? []
      : result.broken.map((b) => ({ b, t: byTile.get(b.tile) })).filter((x): x is { b: BrokenTile; t: Tile } => !!x.t);
  if (broken.length) {
    const { b, t } = broken[0];
    const more = broken.length > 1 ? ` There ${broken.length === 2 ? "is 1 more problem" : `are ${broken.length - 1} more problems`} after that.` : "";
    return {
      action: "fix",
      target: t,
      problems: broken.map((x) => `Step ${x.t.number}: ${x.b.part} ${x.b.problem}. ${x.b.fix}`),
      say: `It seems ${reached ? `you're up to step ${reached.number}, but ` : ""}step ${t.number} needs fixing: the ${b.part} is ${b.problem}. ${b.fix}${more}`,
    };
  }
  const next = tiles.find((t) => t.tile > result.completed_tile);
  if (!next) {
    return complete
      ? { action: "done", say: `It seems you've finished ${reached ? `step ${reached.number}, ` : ""}the last step.` }
      : { action: "unsure", say: `It seems you've finished everything I've read so far.${still} Ask again in a minute.` };
  }
  if (current && current.page === next.page && current.number === next.number) return { action: "stay", say: `You're on step ${next.number}.` };
  return {
    action: "goto",
    target: next,
    say: result.completed_tile === 0 ? `It seems nothing's built yet. Starting at step ${next.number}.` : `It seems you're on step ${next.number}. Going there now.`,
  };
}
