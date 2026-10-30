"use client";

import type { LocateResult } from "@/app/api/locate/route";
import type { PartMark } from "@/components/HighlightBox";
import { cutOutPiece, type Cutout } from "@/lib/cutout";
import { describePart, partLines } from "@/lib/parts";
import { useEffect, useRef, useState } from "react";

import { crop, withGrid } from "./images";
import type { BuildState } from "./useBuildState";
const HOLO_FULL_SIZE = 0.09;
export function usePartGuidance(s: BuildState) {
  const { doc, page, pageImage, phase, target, targetKey, stepKey, located: locatedRef, step } = s;
  // Finds part i of this step in the manual picture (once per part; shared by tap-to-find and the hologram).
  function locatePart(i: number): Promise<LocateResult | null> | null {
    if(!step || !target || targetKey !== stepKey || !step.parts[i]) return null;
    const key = `${stepKey}-${i}`;
    let job = locatedRef.current.get(key);
    if(!job) {
      job = withGrid(target)
        .then((image) =>
          fetch("/api/locate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, part: describePart(step.parts[i]), parts: partLines(step.parts) }) }),
        )
        .then((r) => (r.ok ? (r.json() as Promise<LocateResult>) : null))
        .catch(() => null);
      locatedRef.current.set(key, job);
    }
    return job;
  }
  // 4. every part of this step, found in the manual's parts box at once (one /api/locate call per part, in
  // parallel, cached), so all parts are boxed on the manual picture and shown as holograms without tapping.
  const MAX_PARTS = 6;
  const [locs, setLocs] = useState<{ key: string; results: (LocateResult | null)[] } | null>(null);
  useEffect(() => {
    if(phase.kind !== "ready" || !step || !target || targetKey !== stepKey) return;
    let cancelled = false;
    const jobs = step.parts.slice(0, MAX_PARTS).map((_, i) => locatePart(i) ?? Promise.resolve(null));
    Promise.all(jobs).then((results) => !cancelled && setLocs({ key: stepKey, results }));
    return () => {
      cancelled = true;
    };
    // locatePart reads the same step/target values listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind, step, target, targetKey, stepKey]);
  const stepLocs = locs?.key === stepKey ? locs.results : null;
  const marks: PartMark[] | undefined = stepLocs?.map((r, i) => ({
    callout: r?.callout ?? null,
    placed: r?.placed ?? null,
    label: i + 1,
    dim: false,
  }));

  // Holograms of every part: the real piece cut out of the manual's parts box, at the manual's scale.
  const holos = useRef(new Map<string, Promise<{ cut: Cutout | null; size: number }>>());
  const [holoList, setHoloList] = useState<{ key: string; items: { cut: Cutout | null; size: number }[] } | null>(null);
  useEffect(() => {
    if(phase.kind !== "ready" || !step || !target || targetKey !== stepKey || !pageImage) return;
    let cancelled = false;
    // Cut from the 2400 px page when the manual has one (sharper), else from the page image on screen.
    const hires = doc?.prebuilt?.pages[String(page)]?.length ? `/steps/${doc.prebuilt.id}/hi/${page}.jpg` : null;
    const source = hires ?? pageImage;
    const box = step.box;
    const holoFor = (i: number): Promise<{ cut: Cutout | null; size: number }> => {
      const key = `${stepKey}-${i}`;
      const cached = holos.current.get(key);
      if(cached) return cached;
      const found = locatePart(i);
      if(!found) return Promise.resolve({ cut: null, size: 0 });
      const job = found
        .then(async (result) => {
          const c = result?.callout;
          if(!c) return { cut: null, size: 0 };
          // The callout box is relative to the step picture; map it onto the whole page (same padding as crop()).
          const tx = Math.max(0, box.x - 0.02);
          const ty = Math.max(0, box.y - 0.02);
          const tw = Math.min(box.w + 0.04, 1 - tx);
          const th = Math.min(box.h + 0.04, 1 - ty);
          const onPage = { x: tx + c.x * tw, y: ty + c.y * th, w: c.w * tw, h: c.h * th };
          const pad = 0.008;
          const cut = await cutOutPiece(await crop(source, onPage, pad).catch(() => crop(pageImage, onPage, pad)));
          if(!cut) return { cut: null, size: 0 };
          // Size on the manual page, so pieces keep their proportions to each other from step to step.
          const cropW = Math.min(onPage.w + 2 * pad, 1 - Math.max(0, onPage.x - pad));
          const cropH = Math.min(onPage.h + 2 * pad, 1 - Math.max(0, onPage.y - pad));
          const size = Math.max(0.42, Math.min(1, Math.sqrt(cut.width * cropW * cut.height * cropH) / HOLO_FULL_SIZE));
          return { cut, size };
        })
        .catch(() => ({ cut: null, size: 0 }));
      holos.current.set(key, job);
      return job;
    };
    Promise.all(step.parts.slice(0, MAX_PARTS).map((_, i) => holoFor(i))).then((items) => !cancelled && setHoloList({ key: stepKey, items }));
    return () => {
      cancelled = true;
    };
    // locatePart reads the same step/target values listed here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.kind, step, target, targetKey, stepKey, pageImage, doc, page]);
  const holoItems = holoList?.key === stepKey ? holoList.items : null;
  const holoState: "scanning" | "ready" | "none" = !holoItems ? "scanning" : holoItems.some((h) => h.cut) ? "ready" : "none";

  return { locatePart, MAX_PARTS, locs, setLocs, stepLocs, marks, holos, holoList, setHoloList, holoItems, holoState };
}
