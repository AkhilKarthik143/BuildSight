// "Where am I?" for a half-built or broken build. The phone sends contact sheets of the manual's step
// pictures (src/lib/whereAmI.ts) and a camera frame. Tiles are numbered 1, 2, 3... in book order, not by
// the printed step number, because sub-builds restart their numbering. Claude returns the furthest tile
// the build has reached and any earlier tile that looks broken (a piece missing, wrong, moved or rotated).

import { guard } from "@/lib/apiGuard";
import { asImage } from "@/lib/apiInput";
import { askClaude, ClaudeError, type Part } from "@/lib/claude";
import { firstJsonObject } from "@/lib/json";

const MAX_IMAGE_CHARS = 4_000_000;
const MAX_SHEETS = 8;

export type BrokenTile = { tile: number; part: string; problem: string; fix: string };
export type WhereAmIResult = { completed_tile: number; confidence: number; broken: BrokenTile[] };

type WhereAmIRequest = {
  frame?: string; // camera frame, data URL
  sheets?: { image: string; numbers: number[] }[]; // contact sheets of step pictures, data URLs
  complete?: boolean; // false while the rest of the book is still being read
};

const SYSTEM_PROMPT = `A builder points a camera at a build that may be half-finished, and may have been knocked or taken apart in places. They ask where they are.
You get contact sheets of the manual: each tile is one step's picture, in book order, with a TILE NUMBER in a black box in its top-left corner. Use those tile numbers in your answer, not the step numbers printed inside the pictures. Then a CAMERA photo of the real build now.

1. completed_tile: the furthest tile whose picture the real build has reached. Judge by the overall shape and the newest parts that are present, even if an earlier piece is missing or wrong. 0 if nothing is built yet.
2. broken: tiles at or before completed_tile whose parts are missing, the wrong color or size, in the wrong place, or rotated in the real build. For each, name the part by color and size, say what's wrong, and give one fix under 15 words. Empty if everything up to completed_tile looks right.

Compare shape, size, colors and which parts are present. Ignore camera angle, lighting, the drawing style, and loose parts lying beside the build.
Only report what you can actually see. If part of the build is hidden or out of frame, don't call it missing.
Reply with JSON only, no other text:
{"completed_tile": number, "confidence": number between 0 and 1,
 "broken": [{"tile": number, "part": "...", "problem": "...", "fix": "..."}]}
Set confidence below 0.7 when two tiles look alike, the view is unclear, or no tile matches well.`;

function isImage(s: unknown): s is string {
  return asImage(s, MAX_IMAGE_CHARS) !== null;
}

function readSheets(value: unknown): { image: string; numbers: number[] }[] {
  if (!Array.isArray(value)) return [];
  const out: { image: string; numbers: number[] }[] = [];
  for (const sheet of value.slice(0, MAX_SHEETS)) {
    if (!sheet || typeof sheet !== "object") continue;
    const image = asImage((sheet as { image?: unknown }).image, MAX_IMAGE_CHARS);
    const rawNumbers = (sheet as { numbers?: unknown }).numbers;
    const numbers = Array.isArray(rawNumbers)
      ? rawNumbers.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 10000).slice(0, 40)
      : [];
    if (image && numbers.length) out.push({ image, numbers });
  }
  return out;
}

async function post(request: Request) {
  let body: WhereAmIRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }
  const sheets = readSheets(body.sheets);
  if (!isImage(body.frame) || !sheets.length) return Response.json({ error: "Send `frame` and at least one contact sheet." }, { status: 400 });

  const parts: Part[] = [];
  for (const s of sheets) parts.push({ type: "text", text: `Tiles ${s.numbers[0]} to ${s.numbers[s.numbers.length - 1]}:` }, { type: "image", dataUrl: s.image });
  parts.push(
    { type: "text", text: "CAMERA, the real build now:" },
    { type: "image", dataUrl: body.frame },
    { type: "text", text: body.complete === false ? "These are only the pages read so far; later steps may be missing from the sheets. Where is the builder?" : "Where is the builder?" },
  );

  const valid = new Set([0, ...sheets.flatMap((s) => s.numbers)]);
  const started = Date.now();
  try {
    // A hard visual comparison: keep thinking on (askClaude's default) at medium effort.
    const text = await askClaude({ system: SYSTEM_PROMPT, parts, effort: "medium" });
    const r = firstJsonObject(text) as { completed_tile?: unknown; confidence?: unknown; broken?: unknown } | null;
    const tile = Number(r?.completed_tile);
    if (!r || !valid.has(tile) || typeof r.confidence !== "number") {
      return Response.json({ error: "Couldn't tell where you are." }, { status: 502 });
    }
    const broken = (Array.isArray(r.broken) ? r.broken : [])
      .map((b: Record<string, unknown>) => ({ tile: Number(b?.tile), part: String(b?.part ?? ""), problem: String(b?.problem ?? ""), fix: String(b?.fix ?? "") }))
      .filter((b) => valid.has(b.tile) && b.tile > 0 && b.tile <= tile && b.problem)
      .sort((a, b) => a.tile - b.tile);
    const result: WhereAmIResult = { completed_tile: tile, confidence: Math.max(0, Math.min(1, r.confidence)), broken };
    return Response.json({ ...result, latencyMs: Date.now() - started });
  } catch (e) {
    const err = e instanceof ClaudeError ? e : new ClaudeError("Couldn't tell where you are.");
    return Response.json({ error: err.message }, { status: err.status });
  }
}

export const POST = guard("where-am-i", post);
