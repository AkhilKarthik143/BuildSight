import { firstJsonObject } from '../json.ts';
import { boxQuad, type Quad } from './homography.ts';

export type PlacementBox = { x: number; y: number; w: number; h: number };
export type CameraPlacement = {
  canSee: boolean; confidence: number; target: PlacementBox | null;
  source: PlacementBox | null; instruction: string;
};
function box(value: unknown): PlacementBox | null {
  if (!value || typeof value !== 'object') return null;
  const { x, y, w, h } = value as PlacementBox;
  if (![x, y, w, h].every(n => typeof n === 'number' && Number.isFinite(n)) ||
      x < 0 || y < 0 || w < .01 || h < .01 || x + w > 1.000001 || y + h > 1.000001) return null;
  return { x, y, w, h };
}
/** Model coordinates are always the full camera image, never the manual or viewport. */
export function parseCameraPlacement(raw: unknown): CameraPlacement | null {
  const value = typeof raw === 'string' ? firstJsonObject(raw) : raw;
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  if (typeof r.canSee !== 'boolean' || typeof r.confidence !== 'number' || !Number.isFinite(r.confidence) || r.confidence < 0 || r.confidence > 1) return null;
  const visible = r.canSee && r.confidence >= .7;
  const target = visible ? box(r.target) : null;
  return { canSee: r.canSee, confidence: r.confidence, target,
    source: target ? box(r.source) : null,
    instruction: typeof r.instruction === 'string' ? r.instruction.trim().slice(0, 220) : '' };
}
export const targetQuad = (p: CameraPlacement): Quad | null => p.target ? boxQuad(p.target) : null;
export function center(q: Quad) { return { x: q.reduce((s, p) => s + p.x, 0) / 4, y: q.reduce((s, p) => s + p.y, 0) / 4 }; }
export function moveQuad(q: Quad, x: number, y: number): Quad { return q.map(p => ({ x: p.x + x, y: p.y + y })) as Quad; }
export function rotateQuad(q: Quad): Quad {
  const c = center(q);
  return q.map(p => ({ x: c.x - (p.y - c.y), y: c.y + (p.x - c.x) })) as Quad;
}
