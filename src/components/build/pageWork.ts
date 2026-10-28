"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ExtractedStep } from "@/app/api/extract/route";
import { encodeCanvas } from "@/lib/encode";
import { getPageSteps, savePageSteps, type Manual } from "@/lib/manuals";
import { openManualPdf, renderPage } from "@/lib/pdf";
import type { Prebuilt } from "@/lib/prebuilt";

// Every step picture on one page, cut out and scaled to THUMB_H px tall, decoding the page only once.
// Shared by the step strip and "where am I?" (see thumbsFor), so each picture is cut once per session.
const THUMB_H = 160;
export async function stepThumbs(pageImage: string, boxes: ExtractedStep["box"][], pad = 0.02): Promise<string[]> {
  const img = new Image();
  img.src = pageImage;
  await img.decode();
  const out: string[] = [];
  for (const box of boxes) {
    const x = Math.max(0, box.x - pad) * img.width;
    const y = Math.max(0, box.y - pad) * img.height;
    const w = Math.min(Math.min(1, box.w + 2 * pad) * img.width, img.width - x);
    const h = Math.min(Math.min(1, box.h + 2 * pad) * img.height, img.height - y);
    const scale = Math.min(1, THUMB_H / h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext("2d")?.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
    out.push(await encodeCanvas(canvas, "image/jpeg", 0.8));
  }
  return out;
}

// Lets the phone draw a frame between chunks of picture work, so the screen never freezes.
export const breathe = () => new Promise((r) => setTimeout(r, 0));

// Cuts a step's picture out of the rendered page (box is 0–1 of the page), with a little padding.
export async function crop(pageImage: string, box: ExtractedStep["box"], pad = 0.02): Promise<string> {
  const img = new Image();
  img.src = pageImage;
  await img.decode();
  const x = Math.max(0, box.x - pad) * img.width;
  const y = Math.max(0, box.y - pad) * img.height;
  const w = Math.min(1, box.w + 2 * pad) * img.width;
  const h = Math.min(1, box.h + 2 * pad) * img.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(w, img.width - x);
  canvas.height = Math.min(h, img.height - y);
  canvas.getContext("2d")?.drawImage(img, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return encodeCanvas(canvas, "image/jpeg", 0.75);
}

// Draws a light percentage grid on an image. Claude places boxes far more accurately with it.
export async function withGrid(src: string): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.max(1, 700 / img.width); // small crops get upscaled so labels stay legible
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const g = canvas.getContext("2d")!;
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  g.strokeStyle = "rgba(255,0,150,0.55)";
  g.fillStyle = "rgba(255,0,150,0.9)";
  g.lineWidth = 1;
  g.font = "11px sans-serif";
  for (let i = 1; i < 10; i++) {
    const x = (canvas.width * i) / 10;
    const y = (canvas.height * i) / 10;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, canvas.height);
    g.moveTo(0, y);
    g.lineTo(canvas.width, y);
    g.stroke();
    g.fillText(String(i * 10), x + 2, 11);
    g.fillText(String(i * 10), 2, y - 2);
  }
  return encodeCanvas(canvas, "image/jpeg", 0.75);
}

// A piece this big on the manual page (geometric mean of width and height, as a share of the page) fills the hologram.
export const HOLO_FULL_SIZE = 0.09;

// How many pages ahead to read in the background, and how many Claude calls may run at once.
export const LOOKAHEAD = 6;
export const MAX_PARALLEL = 3; // uploads share the phone's connection; fewer at once keeps the current page fast
// "Go to step n" searches this many pages each way in a manual that isn't pre-read (each unread page is a Claude call).
export const SEARCH_PAGES = 15;

// Runs at most `n` tasks at a time; extra ones wait in line.
export function limiter(n: number) {
  let running = 0;
  const queue: (() => void)[] = [];
  return async <T,>(task: () => Promise<T>): Promise<T> => {
    if (running >= n) await new Promise<void>((r) => queue.push(r));
    running++;
    try {
      return await task();
    } finally {
      running--;
      queue.shift()?.();
    }
  };
}

// Where page images come from: pre-read images when we have them, otherwise the PDF (opened only if needed).
export type PageSource = { numPages: number; prebuilt: Prebuilt | null; render: (page: number) => Promise<string> };

export function makeSource(m: Manual, prebuilt: Prebuilt | null, numPages: number, doc?: PDFDocumentProxy): PageSource {
  let pdf: Promise<PDFDocumentProxy> | null = doc ? Promise.resolve(doc) : null;
  return {
    numPages,
    prebuilt,
    render: (page) =>
      prebuilt?.pages[String(page)]?.length
        ? Promise.resolve(`/steps/${prebuilt.id}/${page}.jpg`)
        : (pdf ??= openManualPdf(m)).then((d) => renderPage(d, page, 1000, 0.7)),
  };
}

export type PageJob = { image: () => Promise<string>; steps: Promise<ExtractedStep[]> };

// Renders and reads pages, each at most once: shared by the current page and the read-ahead.
export function pageReader(manualId: string, source: PageSource) {
  const jobs = new Map<number, PageJob>();
  const read = new Map<number, ExtractedStep[]>(); // pages whose steps are known, for "where am I?"
  const limit = limiter(MAX_PARALLEL);
  const readPage = (page: number): PageJob => {
    const existing = jobs.get(page);
    if (existing) return existing;
    let rendered: Promise<string> | null = null;
    const image = () => (rendered ??= source.render(page));
    const steps = (async () => {
      const cached = await getPageSteps<ExtractedStep>(manualId, page);
      if (cached) return cached;
      const pre = source.prebuilt?.pages[String(page)];
      if (pre) {
        await savePageSteps(manualId, page, pre);
        return pre;
      }
      const pageImage = await image();
      const data = await limit(async () => {
        const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ page: await withGrid(pageImage) }) });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Couldn't read that page.");
        return body;
      });
      await savePageSteps(manualId, page, data.steps);
      return data.steps as ExtractedStep[];
    })();
    // Continuation pages: a page with no printed step number, or one whose number is lower than the
    // previous page's (step numbers only go up, so a lower one is a panel number from a sub-build),
    // continues the previous page's last step and takes its number.
    const numbered = steps.then(async (found) => {
      if (page < 2 || found.length === 0) return found;
      const before = await (jobs.get(page - 1)?.steps ?? getPageSteps<ExtractedStep>(manualId, page - 1)).catch(() => null);
      const last = before?.filter((s) => s.number).at(-1)?.number;
      if (!last) return found;
      return found.map((s) =>
        (s.continued && !s.number) || (s.number && s.number < last && !s.continued)
          ? { ...s, number: last, continued: true, sub: undefined }
          : s,
      );
    });
    const job = { image, steps: numbered };
    // A failed page can be retried.
    numbered.catch(() => jobs.delete(page));
    numbered.then((found) => read.set(page, found)).catch(() => {});
    jobs.set(page, job);
    return job;
  };
  // Pages read so far that have steps, in order, with their image (for "where am I?").
  const pages = () =>
    [...read.entries()]
      .filter(([, found]) => found.length)
      .sort(([a], [b]) => a - b)
      .map(([p, found]) => ({ page: p, steps: found, image: readPage(p).image }));
  return Object.assign(readPage, { pages, count: () => read.size });
}
