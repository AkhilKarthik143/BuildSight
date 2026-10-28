"use client";

// "Where am I?" for a half-built or broken build, phone side. The server half is
// src/app/api/where-am-i/route.ts. Used by findMyPlace in BuildView.tsx, on request and automatically.
//
//   1. contactSheets(tiles)  packs step pictures into labeled grids (20 per sheet)
//   2. whereAmI(...)         sends the grids and a camera frame to /api/where-am-i
//   3. decide(...)           turns the answer into what the app does: fix a broken step first, go to
//                            the next step, stay put, or say it isn't sure
//
// Tiles are numbered 1, 2, 3... in book order (that's what the grid labels show and what Claude answers
// with); each tile remembers its page and printed step number, since sub-builds restart at step 1.

import { encodeCanvas } from "./encode.ts";
import type { Tile, WhereAmIResult } from "./whereAmIDecide.ts";

export type { Placement, Tile } from "./whereAmIDecide.ts";
export { AUTO_MIN_CONFIDENCE, BROKEN_MIN_CONFIDENCE, decide } from "./whereAmIDecide.ts";

// ── 1. Contact sheets ───────────────────────────────────────────────────────

const COLS = 5;
const ROWS = 4;
const TILE_W = 200;
const TILE_H = 160;
export const MAX_TILES = 160; // 8 sheets; the route reads at most 8

async function load(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

// Sheets are kept and reused while their tiles are the same, so automatic checks don't redraw them every time.
// Only the sheets whose tiles changed (usually just the last one, as more pages are read) are drawn again.
const sheetCache = new Map<string, Promise<string>>();

export async function contactSheets(tiles: Tile[]): Promise<{ image: string; numbers: number[] }[]> {
  const sheets: { image: string; numbers: number[] }[] = [];
  const keep = new Set<string>();
  for (let start = 0; start < tiles.length; start += COLS * ROWS) {
    const group = tiles.slice(start, start + COLS * ROWS);
    const key = group.map((t) => `${t.tile}:${t.page}:${t.number}:${t.image.length}`).join(",");
    keep.add(key);
    let image = sheetCache.get(key);
    if (!image) {
      image = drawSheet(group);
      sheetCache.set(key, image);
    }
    sheets.push({ image: await image, numbers: group.map((t) => t.tile) });
  }
  for (const key of sheetCache.keys()) if (!keep.has(key)) sheetCache.delete(key);
  return sheets;
}

async function drawSheet(group: Tile[]): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE_W;
  canvas.height = Math.ceil(group.length / COLS) * TILE_H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const [i, t] of group.entries()) {
    const x = (i % COLS) * TILE_W;
    const y = Math.floor(i / COLS) * TILE_H;
    try {
      const img = await load(t.image);
      const scale = Math.min((TILE_W - 8) / img.width, (TILE_H - 8) / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, x + (TILE_W - w) / 2, y + (TILE_H - h) / 2, w, h);
    } catch {
      // a picture that won't load leaves its tile blank
    }
    ctx.strokeStyle = "#cccccc";
    ctx.strokeRect(x + 0.5, y + 0.5, TILE_W - 1, TILE_H - 1);
    ctx.fillStyle = "#111111";
    ctx.fillRect(x, y, 48, 26);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText(String(t.tile), x + 6, y + 19);
  }
  return encodeCanvas(canvas, "image/jpeg", 0.8);
}

// ── 2. Ask the server ───────────────────────────────────────────────────────

export async function whereAmI(opts: { frame: string; tiles: Tile[]; complete: boolean }): Promise<WhereAmIResult> {
  const res = await fetch("/api/where-am-i", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ frame: opts.frame, sheets: await contactSheets(opts.tiles), complete: opts.complete }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Couldn't tell where you are.");
  return data as WhereAmIResult;
}

// ── 3. Decide what to do ────────────────────────────────────────────────────
// decide() lives in whereAmIDecide.ts so tests can load it without the DOM. Re-exported above.

// ── 4. Watching for changes (for automatic detection) ───────────────────────

/** Share of pixels that changed between two small grayscale samples (shared with Auto Mode). */
export { changed } from "./autoCheck.ts";
