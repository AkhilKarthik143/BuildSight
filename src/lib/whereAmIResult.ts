import { firstJsonObject } from "./json.ts";
export type BrokenTile = { tile: number; part: string; problem: string; fix: string };
export type WhereAmIResult = { completed_tile: number; confidence: number; broken: BrokenTile[] };

export function parseWhereAmIResult(text: string, valid: Set<number>): WhereAmIResult | null {
    const r = firstJsonObject(text) as { completed_tile?: unknown; confidence?: unknown; broken?: unknown } | null;
    const tile = Number(r?.completed_tile);
    if (!r || !valid.has(tile) || typeof r.confidence !== "number" || !Number.isFinite(r.confidence)) {
      return null;
    }
    const broken = (Array.isArray(r.broken) ? r.broken : [])
      .map((b: Record<string, unknown>) => ({ tile: Number(b?.tile), part: String(b?.part ?? ""), problem: String(b?.problem ?? ""), fix: String(b?.fix ?? "") }))
      .filter((b) => valid.has(b.tile) && b.tile > 0 && b.tile <= tile && b.problem)
      .sort((a, b) => a.tile - b.tile);
    const result: WhereAmIResult = { completed_tile: tile, confidence: Math.max(0, Math.min(1, r.confidence)), broken };
    return result;
}
