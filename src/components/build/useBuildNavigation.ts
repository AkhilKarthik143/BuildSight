"use client";

import type { ExtractedStep } from "@/app/api/extract/route";
import { getManual, saveManual } from "@/lib/manuals";
import { openManualPdf } from "@/lib/pdf";
import { loadPrebuilt } from "@/lib/prebuilt";
import { speak, stopSpeaking } from "@/lib/speech";
import { type Tile } from "@/lib/whereAmI";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { spokenStep } from "@/lib/stepLabels";
import { breathe, crop, stepThumbs } from "./images";
import { makeSource, pageReader } from "./pageReader";
import type { BuildState } from "./useBuildState";
const LOOKAHEAD = 6;
const SEARCH_PAGES = 15;
export function useBuildNavigation(s: BuildState) {
  const {
    id, direction: directionRef, landOn: landOnRef, landIdx: landIdxRef, search: searchRef, manual,
    setManual, doc, setDoc, page, setPage, pageImage, setPageImage, steps, setSteps, stepIdx,
    setStepIdx, phase, setPhase, setTarget, setTargetKey, setPrevious, setCheckState, muted, isPhone,
    setSheetOpen, stepKey, setCheck, attempt, setAttempt, setPreview, readCount, setReadCount, turnTo,
    step
  } = s;
  // 1. load the manual and its PDF
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await getManual(id);
      if(!m) return setPhase({ kind: "error", message: "That manual isn't in your library on this device." });
      setManual(m);
      try {
        // A pre-read manual needs no PDF and no Claude calls; otherwise open the PDF.
        const prebuilt = await loadPrebuilt(m);
        const pdf = prebuilt ? undefined : await openManualPdf(m);
        const numPages = prebuilt?.pageCount ?? pdf!.numPages;
        if(cancelled) return;
        const updated = { ...m, pageCount: numPages, openedAt: Date.now() };
        await saveManual(updated);
        setManual(updated);
        setDoc(makeSource(m, prebuilt, numPages, pdf));
        turnTo(Math.min(m.page, numPages));
      } catch(e) {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "Couldn't open the PDF." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, setDoc, setManual, setPhase, turnTo]);

  const reader = useMemo(() => (doc && manual ? pageReader(manual.id, doc) : null), [doc, manual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. read the current page (and the next few in the background); skip pages with no steps
  useEffect(() => {
    if(!reader || !doc || !manual || page < 1) return;
    let cancelled = false;
    const job = reader(page); // queue the current page before the read-ahead
    for(let k = 1;k <= LOOKAHEAD && page + k <= doc.numPages;k++) reader(page + k);
    const knownEmpty = doc.prebuilt?.pages[String(page)]?.length === 0;
    if(!knownEmpty) job.image().then((img) => !cancelled && setPreview(img)).catch(() => { });
    job.steps
      .then(async (found) => [found.length ? await job.image() : "", found] as const)
      .then(([image, found]) => {
        if(cancelled) return;
        if(found.length === 0) {
          const next = page + directionRef.current;
          if(next >= 1 && next <= doc.numPages) return turnTo(next);
          if(next > doc.numPages) return setPhase({ kind: "done" });
          directionRef.current = 1;
          return turnTo(page + 1);
        }
        setPageImage(image);
        setSteps(found);
        const land =
          landIdxRef.current != null ? Math.min(landIdxRef.current, found.length - 1) : landOnRef.current == null ? -1 : found.findIndex((s) => s.number === landOnRef.current);
        landOnRef.current = null;
        landIdxRef.current = null;
        setStepIdx(land >= 0 ? land : directionRef.current === 1 ? 0 : found.length - 1);
        setPhase({ kind: "ready" });
        saveManual({ ...manual, page, openedAt: Date.now() });
      })
      .catch((e) => !cancelled && setPhase({ kind: "error", message: e instanceof Error ? e.message : "Couldn't read that page." }));
    return () => {
      cancelled = true;
    };
    // manual is saved as a side effect; re-running on its change would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reader, page, attempt]);

  // 3. cut out this step's target picture (and the one before it) for display and checking
  useEffect(() => {
    if(!pageImage || !step) return;
    let cancelled = false;
    const key = `${page}-${stepIdx}`;
    crop(pageImage, step.box).then((t) => {
      if(cancelled) return;
      setTarget(t);
      setTargetKey(key);
    });
    const prev = steps[stepIdx - 1];
    (prev ? crop(pageImage, prev.box) : Promise.resolve(null)).then((p) => !cancelled && setPrevious(p));
    return () => {
      cancelled = true;
    };
  }, [pageImage, step, steps, stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps -- page changes come with a new pageImage

  // Back to step 1: page 1 forward, skipping cover/intro pages as usual.
  const restart = useCallback(
    (ask = true) => {
      if(!doc || (ask && !window.confirm("Start over from step 1?"))) return;
      searchRef.current++;
      stopSpeaking();
      directionRef.current = 1;
      setSheetOpen(true);
      turnTo(1);
      setAttempt((n) => n + 1); // re-read even if we're already on page 1
    },
    [directionRef, doc, searchRef, setAttempt, setSheetOpen, turnTo],
  );

  const go = useCallback(
    (delta: 1 | -1) => {
      if(phase.kind !== "ready" || !doc) return;
      searchRef.current++;
      setCheckState(null);
      directionRef.current = delta;
      const nextIdx = stepIdx + delta;
      if(nextIdx >= 0 && nextIdx < steps.length) return setStepIdx(nextIdx);
      const nextPage = page + delta;
      if(nextPage < 1) return;
      if(nextPage > doc.numPages) return setPhase({ kind: "done" });
      turnTo(nextPage);
    },
    [phase.kind, doc, searchRef, setCheckState, directionRef, stepIdx, steps.length, setStepIdx, page, setPhase, turnTo],
  );

  const speakStep = useCallback(() => {
    if(step && !muted) speak(spokenStep(step));
  }, [step, muted]);

  // Jumps to step n: on this page at once; otherwise reads pages ahead (then behind) until one has step n.
  // Step numbers can repeat in a book (sub-builds restart at 1), so the nearest match wins.
  const goToStep = useCallback(
    async (n: number) => {
      if(!doc || !reader || (phase.kind !== "ready" && phase.kind !== "done")) return;
      const here = phase.kind === "ready" ? steps.findIndex((s) => s.number === n) : -1;
      if(here >= 0) {
        searchRef.current++;
        setCheckState(null);
        if(here === stepIdx) speakStep();
        else setStepIdx(here);
        return;
      }
      const id = ++searchRef.current;
      const reach = doc.prebuilt ? doc.numPages : SEARCH_PAGES; // pre-read books are free to searchRef
      const order: number[] = [];
      for(let k = 1;k <= reach && page + k <= doc.numPages;k++) order.push(page + k);
      for(let k = 1;k <= reach && page - k >= 1;k++) order.push(page - k);
      const wasPhase = phase;
      setCheckState(null);
      setPhase({ kind: "loading", label: `Finding step ${n}` });
      for(let i = 0;i < order.length;i++) {
        order.slice(i + 1, i + 3).forEach((p) => reader(p)); // read the next couple of pages meanwhile
        const found = await reader(order[i]).steps.catch(() => [] as ExtractedStep[]);
        if(searchRef.current !== id) return; // cancelled (Next, Back, Restart, another jump)
        if(found.some((s) => s.number === n)) {
          landOnRef.current = n;
          directionRef.current = 1;
          setPhase({ kind: "loading", label: `Opening step ${n}` });
          setPage(order[i]);
          return;
        }
      }
      if(searchRef.current !== id) return;
      setPhase(wasPhase);
      const searchedAll = order.length >= doc.numPages - 1;
      const message = searchedAll ? `I couldn't find step ${n} in this book.` : `I couldn't find step ${n} within ${SEARCH_PAGES} pages of this one.`;
      setCheck({ state: "error", message });
      if(!muted) speak(message);
    },
    [doc, reader, phase, steps, searchRef, setCheckState, setPhase, setCheck, muted, stepIdx, speakStep, setStepIdx, page, landOnRef, directionRef, setPage],
  );

  // Once a step is up, read the rest of the book in the background, two pages at a time (so the page in view
  // never waits), so "where am I?" can compare against every step. Pre-read manuals are instant.
  // Phones read one page at a time with a short rest between pages, and the screen re-lists the read pages at
  // most every 2 s: rendering and re-rendering for every page made the whole app stutter while a book was read.
  const ready = phase.kind === "ready";
  useEffect(() => {
    if(!reader || !doc || !ready) return;
    let stopped = false;
    let next = 1;
    let shown = 0;
    const show = () => {
      if(stopped) return;
      shown = Date.now();
      setReadCount(reader.count());
    };
    const lane = async () => {
      while(!stopped && next <= doc.numPages) {
        const p = next++;
        await reader(p).steps.catch(() => { });
        if(Date.now() - shown > 2000) show();
        if(isPhone) await new Promise((r) => setTimeout(r, 250));
      }
      show();
    };
    lane();
    if(!isPhone) lane();
    return () => {
      stopped = true;
    };
  }, [reader, doc, ready, isPhone, setReadCount]);

  // Opens a tile's step: on this page at once, otherwise opens its page at that step.
  // Goes straight to a step on a page that's already read: no loading card in between (that flash, and the
  // step strip re-centering from scratch after it, made jumping feel jumpy). False if the page isn't read yet.
  const openReadPage = useCallback(
    (toPage: number, pick: (steps: ExtractedStep[]) => number): boolean => {
      const known = reader?.pages().find((pg) => pg.page === toPage);
      if(!known) return false;
      const idx = Math.max(0, Math.min(pick(known.steps), known.steps.length - 1));
      const id = searchRef.current;
      landIdxRef.current = idx; // the page effect re-runs for the new page and lands on the same step
      directionRef.current = 1;
      known
        .image()
        .then((image) => {
          if(searchRef.current !== id) return; // another jump started meanwhile
          setPageImage(image);
          setSteps(known.steps);
          setStepIdx(idx);
          setPage(toPage);
        })
        .catch(() => turnTo(toPage));
      return true;
    },
    [directionRef, landIdxRef, reader, searchRef, setPage, setPageImage, setStepIdx, setSteps, turnTo],
  );

  const openTile = useCallback(
    (t: Tile) => {
      searchRef.current++; // cancel any running "go to step" searchRef
      setCheckState(null);
      if(t.page === page) {
        const idx = steps.findIndex((s) => s.number === t.number);
        if(idx >= 0) return setStepIdx(idx);
      }
      if(openReadPage(t.page, (found) => found.findIndex((s) => s.number === t.number))) return;
      landOnRef.current = t.number;
      directionRef.current = 1;
      turnTo(t.page);
    },
    [searchRef, setCheckState, page, openReadPage, landOnRef, directionRef, turnTo, steps, setStepIdx],
  );

  // Step strip: every step read so far as a small thumbnail, in a sideways scroll inside the step card. Tap one to
  // jump straight there. Fills in as the book is read in the background.
  const stripItems = useMemo(
    () => (reader ? reader.pages().flatMap((pg) => pg.steps.map((st, idx) => ({ page: pg.page, idx, step: st, image: pg.image }))) : []),
    [reader, readCount], // eslint-disable-line react-hooks/exhaustive-deps -- re-list whenever more pages are read
  );
  // Step pictures, cut once per page and kept (the strip shows them, "where am I?" sends them to Claude).
  const pageThumbs = useRef(new Map<number, { steps: ExtractedStep[]; job: Promise<string[]> }>());
  const thumbsFor = useCallback((pg: { page: number; steps: ExtractedStep[]; image: () => Promise<string> }) => {
    const have = pageThumbs.current.get(pg.page);
    if(have && have.steps === pg.steps) return have.job;
    const job = pg
      .image()
      .then((image) => stepThumbs(image, pg.steps.map((st) => st.box)))
      .catch(() => pg.steps.map(() => ""));
    pageThumbs.current.set(pg.page, { steps: pg.steps, job });
    return job;
  }, []);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    if(!reader) return;
    let cancelled = false;
    (async () => {
      for(const pg of reader.pages()) {
        if(pg.steps.every((_, idx) => thumbs[`${pg.page}-${idx}`] !== undefined)) continue;
        const urls = await thumbsFor(pg);
        if(cancelled) return;
        setThumbs((t) => ({ ...t, ...Object.fromEntries(urls.map((u, idx) => [`${pg.page}-${idx}`, u])) }));
        await breathe();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stripItems]); // eslint-disable-line react-hooks/exhaustive-deps -- runs when more pages are read; `thumbs` only skips finished pages
  const jumpToStep = useCallback(
    (toPage: number, idx: number) => {
      searchRef.current++; // cancel any running "go to step" searchRef
      setCheckState(null);
      if(toPage === page) return setStepIdx(idx);
      if(openReadPage(toPage, () => idx)) return;
      landIdxRef.current = idx;
      directionRef.current = 1;
      turnTo(toPage);
    },
    [searchRef, setCheckState, page, setStepIdx, openReadPage, landIdxRef, directionRef, turnTo],
  );
  // Centers the current step in the strip whenever it appears or the step changes. Keyed to the step, so swiping
  // the strip doesn't get pulled back on every re-render. A strip that just appeared (still at the start) jumps
  // straight there instead of sliding across every step.
  const centerCurrent = useCallback(
    (el: HTMLButtonElement | null) => {
      if(!el) return;
      const fresh = (el.parentElement?.scrollLeft ?? 0) === 0;
      requestAnimationFrame(() => el.scrollIntoView({ inline: "center", block: "nearest", behavior: fresh ? "auto" : "smooth" }));
    },
    [stepKey], // eslint-disable-line react-hooks/exhaustive-deps -- a new callback per step re-runs it
  );


  return {
    reader, restart, go, speakStep, goToStep, ready, openReadPage, openTile, stripItems, pageThumbs,
    thumbsFor, thumbs, setThumbs, jumpToStep, centerCurrent
  };
}
export type BuildNavigation = ReturnType<typeof useBuildNavigation>;
