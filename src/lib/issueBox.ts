// Where a step-check mistake is in the camera photo. The model answers in whole-number percentages
// (left/top/right/bottom, 0-100) of the CAMERA image; this turns that into a normalized {x, y, w, h}
// box (0-1), or undefined when the box is missing or can't be trusted. Used by /api/check.
// Run the tests with: npm run test:boxes

export type IssueBox = { x: number; y: number; w: number; h: number };

export const ISSUE_KINDS = ["wrong_part", "orientation", "misalignment", "missing_part", "incorrect_placement", "other"] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];

const MIN_SIDE = 2; // percent: smaller than this is a guess, not a piece
const MAX_AREA = 0.8; // share of the photo: bigger than this points at nothing in particular

export function parseIssueBox(raw: unknown): IssueBox | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const { left, top, right, bottom } = raw as Record<string, unknown>;
  const n = [left, top, right, bottom];
  if (!n.every((v): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100)) return undefined;
  const [l, t, r, b] = n as number[];
  if (r - l < MIN_SIDE || b - t < MIN_SIDE) return undefined; // also catches right <= left, bottom <= top
  if (((r - l) / 100) * ((b - t) / 100) > MAX_AREA) return undefined;
  return { x: l / 100, y: t / 100, w: (r - l) / 100, h: (b - t) / 100 };
}

export function parseIssueKind(raw: unknown): IssueKind | undefined {
  return ISSUE_KINDS.find((k) => k === raw);
}
