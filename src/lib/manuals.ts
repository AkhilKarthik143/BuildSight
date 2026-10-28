// The manual library. Lives in the browser (IndexedDB) for now:
// metadata under "manual:<id>", uploaded PDF bytes under "pdf:<id>".

import { del, get, keys, set } from "idb-keyval";
import { uploadTitle } from "./uploadTitle.ts";

export type ManualSource = "lego" | "ikea" | "upload";

export type Manual = {
  id: string;
  source: ManualSource;
  title: string; // "Playful Cat"
  subtitle: string; // "LEGO 31163 · Book 1 of 3"
  coverUrl?: string;
  pdfPath?: string; // same-origin path for lego/ikea (see next.config rewrites); uploads use stored bytes
  pageCount?: number;
  page: number; // page the builder is on (1-based)
  addedAt: number;
  openedAt: number;
};

// A search hit, before it's added to the library.
export type ManualResult = {
  source: Exclude<ManualSource, "upload">;
  title: string;
  subtitle: string;
  coverUrl?: string;
  pdfPath: string;
  sizeLabel?: string;
};

const MANUAL = "manual:";
const PDF = "pdf:";

export async function listManuals(): Promise<Manual[]> {
  const ids = (await keys()).filter((k): k is string => typeof k === "string" && k.startsWith(MANUAL));
  const all = await Promise.all(ids.map((k) => get<Manual>(k)));
  return recentManuals(all);
}

export const getManual = (id: string) => get<Manual>(MANUAL + id);
export const saveManual = (m: Manual) => set(MANUAL + m.id, m);
export const getPdfBytes = (id: string) => get<ArrayBuffer>(PDF + id);

export async function removeManual(id: string) {
  // Saved readings from every version (old ones are ignored but still take space).
  const stepKeys = stepKeysFor(id, await keys());
  await Promise.all([del(MANUAL + id), del(PDF + id), ...stepKeys.map((k) => del(k))]);
}

// Steps extracted from each page, cached so a page is only read once.
// Versioned: bump when page reading changes, so devices re-read pages instead of trusting old results.
// v2 = unnumbered IKEA steps, JSON parsing fix, smaller uploads. v3 = sub-panels ("8 · 2 of 4"), grid-measured boxes.
const STEPS = "steps:v3:";
export const getPageSteps = <T,>(id: string, page: number) => get<T[]>(`${STEPS}${id}:${page}`);
export const savePageSteps = <T,>(id: string, page: number, steps: T[]) => set(`${STEPS}${id}:${page}`, steps);

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export async function addFromResult(r: ManualResult): Promise<Manual> {
  // Re-adding the same book just reopens it.
  const existing = (await listManuals()).find((m) => m.pdfPath === r.pdfPath);
  if (existing) return existing;
  const now = Date.now();
  const m: Manual = { id: newId(), source: r.source, title: r.title, subtitle: r.subtitle, coverUrl: r.coverUrl, pdfPath: r.pdfPath, page: 1, addedAt: now, openedAt: now };
  await saveManual(m);
  return m;
}

export async function addUpload(file: File): Promise<Manual> {
  const now = Date.now();
  const m: Manual = {
    id: newId(),
    source: "upload",
    title: uploadTitle(file.name),
    subtitle: `Uploaded · ${(file.size / 1_000_000).toFixed(1)} MB`,
    page: 1,
    addedAt: now,
    openedAt: now,
  };
  await set(PDF + m.id, await file.arrayBuffer());
  await saveManual(m);
  return m;
}

// Pure library helpers: no IndexedDB or File APIs needed to validate their behavior.
export function recentManuals(all: (Manual | undefined)[]): Manual[] {
  return all.filter((m): m is Manual => !!m).sort((a, b) => b.openedAt - a.openedAt);
}
export { uploadTitle } from "./uploadTitle.ts";
export function stepKeysFor(id: string, storageKeys: unknown[]): string[] {
  return storageKeys.filter((k): k is string => typeof k === "string" &&
    (k.startsWith(`steps:${id}:`) || k.replace(/^steps:v\d+:/, "steps:").startsWith(`steps:${id}:`)));
}
