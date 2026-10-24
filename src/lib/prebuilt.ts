"use client";

// Manuals read ahead of time by scripts/preread.py (steps + page images in public/steps/).
// A pre-read manual opens instantly and needs neither the PDF nor Claude.

import type { ExtractedStep } from "@/app/api/extract/route";
import type { Manual } from "@/lib/manuals";

export type Prebuilt = { id: string; pageCount: number; pages: Record<string, ExtractedStep[]> };

const loaded = new Map<string, Promise<Prebuilt | null>>();

export function loadPrebuilt(m: Manual): Promise<Prebuilt | null> {
  const id = m.pdfPath?.match(/^\/manual-pdf\/lego\/(\d+)\.pdf$/)?.[1];
  if (!id) return Promise.resolve(null);
  let job = loaded.get(id);
  if (!job) {
    job = fetch(`/steps/${id}.json`)
      .then(async (res) => (res.ok ? ({ id, ...(await res.json()) } as Prebuilt) : null))
      .catch(() => null);
    loaded.set(id, job);
  }
  return job;
}
