"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExtractedStep } from "@/app/api/extract/route";
import type { LocateResult } from "@/app/api/locate/route";
import type { PartMark } from "@/components/HighlightBox";
import type { CameraHandle } from "@/components/CameraFeed";
import { BuildLayout } from "@/components/build/BuildLayout";
import { useAutoMode, useAutoSpeed } from "@/components/build/autoStore";
import { HOLO_FULL_SIZE, LOOKAHEAD, crop, makeSource, pageReader, withGrid, type PageSource } from "@/components/build/pageWork";
import { MAX_PARTS, type Advance, type Check, type Phase } from "@/components/build/types";
import { useBuildControls } from "@/components/build/useBuildControls";
import { useIsPhone } from "@/components/build/usePhone";
import { boxLocation, forStep, checkVerdict } from "@/lib/issueBox";
import { emptySession, formatSessionMarkdown, noteMistake, noteStep, type SessionState } from "@/lib/sessionSummary";
import { describePart, partLines } from "@/lib/parts";
import { cutOutPiece, type Cutout } from "@/lib/cutout";
import { getManual, saveManual, type Manual } from "@/lib/manuals";
import { openManualPdf } from "@/lib/pdf";
import { loadPrebuilt } from "@/lib/prebuilt";
import { speak, stopSpeaking } from "@/lib/speech";
import { spokenStep, stepLabel } from "@/lib/stepText";
import { newWatch, timingFor, type AutoTiming } from "@/lib/autoCheck";

export default function BuildView() {
  const { id } = useParams<{ id: string }>();
  const camera = useRef<CameraHandle>(null);
  // What the live mistake boxes need from the camera (read when called, not during render).
  const liveCamera = useMemo(() => ({ size: () => camera.current?.size() ?? null, sample: () => camera.current?.sample() ?? null }), []);
  const direction = useRef<1 | -1>(1);
  const landOn = useRef<number | null>(null); // step number the next page load opens at ("go to step 8")
  const landIdx = useRef<number | null>(null); // exact step index the next page load opens at (step strip)
  const search = useRef(0); // bumped to cancel a running "go to step" search

  const [manual, setManual] = useState<Manual | null>(null);
  const [doc, setDoc] = useState<PageSource | null>(null);
  const [page, setPage] = useState(0);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [steps, setSteps] = useState<ExtractedStep[]>([]);
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "loading", label: "Opening manual" });
  const [target, setTarget] = useState<string | null>(null);
  const [targetKey, setTargetKey] = useState<string | null>(null); // which step `target` was cut for
  const [previous, setPrevious] = useState<string | null>(null);
  // A check belongs to the step it ran on (its key); on any other step it isn't shown.
  const [checkState, setCheckState] = useState<(Check & { key: string }) | null>(null);
  const [issuePick, setIssuePick] = useState<number | null>(null); // problem tapped in the list: its box is brightened
  const [showBoxes, setShowBoxes] = useState(true);
  // The checked photo is open full screen while this holds that check's id; a new check (new id), a step change
  // (the check hides) or Close all end it without extra bookkeeping.
  const [photoFor, setPhotoFor] = useState<number | null>(null);
  const checkSeq = useRef(0); // bumped by every new check and step change; older answers are dropped
  // the move to the next step after a pass: shown as a countdown bar with Cancel (see the effect after runCheck)
  const [advance, setAdvance] = useState<Advance | null>(null);
  const voiceDone = useRef<Promise<unknown>>(Promise.resolve()); // resolves when the last check result finishes speaking
  const [muted, setMuted] = useState(false);
  const [showManual, setShowManual] = useState(false); // true = blue "hologram" tint; default is the real colors
  const [zoomOpen, setZoomOpen] = useState(false); // full-screen zoom viewer for the manual picture
  // Phones get a swipeable step card: swipe down to see your build, up for full details.
  const isPhone = useIsPhone();
  const [sheetOpen, setSheetOpen] = useState(true);
  const compact = isPhone && !sheetOpen;

  const stepKey = `${page}-${stepIdx}`;
  // "I'm stuck": smaller sub-steps from the voice assistant, shown as a checklist for this step only.
  const [substeps, setSubsteps] = useState<{ key: string; items: string[]; done: boolean[] } | null>(null);
  const activeSubs = substeps?.key === stepKey ? substeps : null;
  const check = forStep(checkState, stepKey);
  const setCheck = useCallback((c: Check | null) => setCheckState(c && { ...c, key: stepKey }), [stepKey]);
  const verdict = check?.state === "result" ? checkVerdict(check.result) : null;
  const photoOpen = check?.state === "result" && verdict === "fix" && photoFor === check.id;
  // Where each part sits in the manual picture, found once per part (see locatePart).
  const located = useRef(new Map<string, Promise<LocateResult | null>>());
  const [attempt, setAttempt] = useState(0); // bumped by Retry to re-read the page
  const [preview, setPreview] = useState<string | null>(null); // page image shown while Claude reads it
  // Finding the step from the camera, always automatic (no button): see findMyPlace and the auto-detect loop below.
  const [readCount, setReadCount] = useState(0); // pages read so far, in view or in the background
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<{ text: string; problems?: string[] } | null>(null);
  const lastAuto = useRef(0); // when the last automatic check ran
  const lastManual = useRef(0); // when the builder last changed step themselves
  const autoJump = useRef(false); // the next step change is ours, not the builder's
  const firstAutoDone = useRef(false);
  const baseline = useRef<Uint8ClampedArray | null>(null); // camera sample at the last automatic check
  // Auto Mode: checks the build on its own ("changed, then still") and moves on when it passes. See src/lib/autoCheck.ts.
  const autoMode = useAutoMode();
  const autoSpeed = useAutoSpeed();
  const timing = useMemo(() => timingFor(autoSpeed), [autoSpeed]);
  const timingRef = useRef<AutoTiming>(timing); // read by runCheck's move-on countdown without re-creating it
  useEffect(() => {
    timingRef.current = timing;
  }, [timing]);
  const watch = useRef(newWatch(0));
  const [autoStatus, setAutoStatus] = useState<string | null>(null); // what Auto Mode is doing, in the step card
  const currentKey = useRef(stepKey);

  // Every page change shows the loading card first.
  const turnTo = useCallback((p: number) => {
    setPhase({ kind: "loading", label: `Reading page ${p}` });
    setCheckState(null);
    setPage(p);
  }, []);

  const step = steps[stepIdx] as ExtractedStep | undefined;
  const part = step?.parts[0];

  // Finds part i of this step in the manual picture (once per part; shared by tap-to-find and the hologram).
  function locatePart(i: number): Promise<LocateResult | null> | null {
    if (!step || !target || targetKey !== stepKey || !step.parts[i]) return null;
    const key = `${stepKey}-${i}`;
    let job = located.current.get(key);
    if (!job) {
      job = withGrid(target)
        .then((image) =>
          fetch("/api/locate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image, part: describePart(step.parts[i]), parts: partLines(step.parts) }) }),
        )
        .then((r) => (r.ok ? (r.json() as Promise<LocateResult>) : null))
        .catch(() => null);
      located.current.set(key, job);
    }
    return job;
  }

  // 1. load the manual and its PDF
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const m = await getManual(id);
      if (!m) return setPhase({ kind: "error", message: "That manual isn't in your library on this device." });
      setManual(m);
      try {
        // A pre-read manual needs no PDF and no Claude calls; otherwise open the PDF.
        const prebuilt = await loadPrebuilt(m);
        const pdf = prebuilt ? undefined : await openManualPdf(m);
        const numPages = prebuilt?.pageCount ?? pdf!.numPages;
        if (cancelled) return;
        const updated = { ...m, pageCount: numPages, openedAt: Date.now() };
        await saveManual(updated);
        setManual(updated);
        setDoc(makeSource(m, prebuilt, numPages, pdf));
        turnTo(Math.min(m.page, numPages));
      } catch (e) {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : "Couldn't open the PDF." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, turnTo]);

  const reader = useMemo(() => (doc && manual ? pageReader(manual.id, doc) : null), [doc, manual?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. read the current page (and the next few in the background); skip pages with no steps
  useEffect(() => {
    if (!reader || !doc || !manual || page < 1) return;
    let cancelled = false;
    const job = reader(page); // queue the current page before the read-ahead
    for (let k = 1; k <= LOOKAHEAD && page + k <= doc.numPages; k++) reader(page + k);
    const knownEmpty = doc.prebuilt?.pages[String(page)]?.length === 0;
    if (!knownEmpty) job.image().then((img) => !cancelled && setPreview(img)).catch(() => {});
    job.steps
      .then(async (found) => [found.length ? await job.image() : "", found] as const)
      .then(([image, found]) => {
        if (cancelled) return;
        if (found.length === 0) {
          const next = page + direction.current;
          if (next >= 1 && next <= doc.numPages) return turnTo(next);
          if (next > doc.numPages) return setPhase({ kind: "done" });
          direction.current = 1;
          return turnTo(page + 1);
        }
        setPageImage(image);
        setSteps(found);
        const land =
          landIdx.current != null ? Math.min(landIdx.current, found.length - 1) : landOn.current == null ? -1 : found.findIndex((s) => s.number === landOn.current);
        landOn.current = null;
        landIdx.current = null;
        setStepIdx(land >= 0 ? land : direction.current === 1 ? 0 : found.length - 1);
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
    if (!pageImage || !step) return;
    let cancelled = false;
    const key = `${page}-${stepIdx}`;
    crop(pageImage, step.box).then((t) => {
      if (cancelled) return;
      setTarget(t);
      setTargetKey(key);
    });
    const prev = steps[stepIdx - 1];
    (prev ? crop(pageImage, prev.box) : Promise.resolve(null)).then((p) => !cancelled && setPrevious(p));
    return () => {
      cancelled = true;
    };
  }, [pageImage, step, steps, stepIdx]); // eslint-disable-line react-hooks/exhaustive-deps -- page changes come with a new pageImage

  // 4. every part of this step, found in the manual's parts box at once (one /api/locate call per part, in
  // parallel, cached), so all parts are boxed on the manual picture and shown as holograms without tapping.
  const [locs, setLocs] = useState<{ key: string; results: (LocateResult | null)[] } | null>(null);
  useEffect(() => {
    if (phase.kind !== "ready" || !step || !target || targetKey !== stepKey) return;
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
    if (phase.kind !== "ready" || !step || !target || targetKey !== stepKey || !pageImage) return;
    let cancelled = false;
    // Cut from the 2400 px page when the manual has one (sharper), else from the page image on screen.
    const hires = doc?.prebuilt?.pages[String(page)]?.length ? `/steps/${doc.prebuilt.id}/hi/${page}.jpg` : null;
    const source = hires ?? pageImage;
    const box = step.box;
    const holoFor = (i: number): Promise<{ cut: Cutout | null; size: number }> => {
      const key = `${stepKey}-${i}`;
      const cached = holos.current.get(key);
      if (cached) return cached;
      const found = locatePart(i);
      if (!found) return Promise.resolve({ cut: null, size: 0 });
      const job = found
        .then(async (result) => {
          const c = result?.callout;
          if (!c) return { cut: null, size: 0 };
          // The callout box is relative to the step picture; map it onto the whole page (same padding as crop()).
          const tx = Math.max(0, box.x - 0.02);
          const ty = Math.max(0, box.y - 0.02);
          const tw = Math.min(box.w + 0.04, 1 - tx);
          const th = Math.min(box.h + 0.04, 1 - ty);
          const onPage = { x: tx + c.x * tw, y: ty + c.y * th, w: c.w * tw, h: c.h * th };
          const pad = 0.008;
          const cut = await cutOutPiece(await crop(source, onPage, pad).catch(() => crop(pageImage, onPage, pad)));
          if (!cut) return { cut: null, size: 0 };
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

  // 4. read each new step aloud
  useEffect(() => {
    if (phase.kind === "ready" && step && !muted) speak(spokenStep(step));
  }, [phase.kind, step, muted]);
  useEffect(() => stopSpeaking, []);


  const [session, setSession] = useState<SessionState>(() => emptySession("Build"));
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [trackedStep, setTrackedStep] = useState("");
  const [trackedCheck, setTrackedCheck] = useState<number | null>(null);
  const [seenPhase, setSeenPhase] = useState(phase.kind);
  const title = manual?.title || "Build";
  const stepChanged = Boolean(step) && trackedStep !== stepKey;
  const checkChanged = check?.state === "result" && checkVerdict(check.result) === "fix" && trackedCheck !== check.id;
  if (session.title !== title || stepChanged || checkChanged) {
    if (stepChanged) setTrackedStep(stepKey);
    if (checkChanged && check?.state === "result") setTrackedCheck(check.id);
    setSession((s) => {
      let next = s.title === title ? s : { ...s, title };
      if (stepChanged && step) next = noteStep(next, stepKey, stepLabel(step));
      if (checkChanged && check?.state === "result") {
        next = check.result.issues.reduce(
          (acc, issue) => noteMistake(acc, { part: issue.part, where: issue.box ? boxLocation(issue.box) : "", problem: issue.problem }),
          next,
        );
      }
      return next;
    });
  }
  if (seenPhase !== phase.kind) {
    setSeenPhase(phase.kind);
    if (phase.kind === "done") setSummaryOpen(true);
  }
  const openSummary = useCallback(() => setSummaryOpen(true), [setSummaryOpen]);

  const controls = useBuildControls({
    camera, direction, landOn, landIdx, search, doc, page, setPage, setPageImage, steps, setSteps, stepIdx, setStepIdx,
    phase, setPhase, target, targetKey, previous, setCheckState, setIssuePick, checkSeq, advance, setAdvance, voiceDone,
    muted, isPhone, setSheetOpen, stepKey, setSubsteps, check, setCheck, photoOpen, setAttempt,
    setReadCount, locating, setLocating, notice, setNotice, lastAuto, lastManual, autoJump, firstAutoDone, baseline,
    autoMode, timing, timingRef, watch, setAutoStatus, currentKey, turnTo, step, reader, zoomOpen, readCount,
    onSummary: openSummary,
  });

  return (
    <BuildLayout
      camera={camera}
      liveCamera={liveCamera}
      check={check}
      verdict={verdict}
      showBoxes={showBoxes}
      setShowBoxes={setShowBoxes}
      issuePick={issuePick}
      setIssuePick={setIssuePick}
      manual={manual}
      doc={doc}
      page={page}
      readCount={readCount}
      restart={controls.restart}
      muted={muted}
      setMuted={setMuted}
      target={target}
      phase={phase}
      step={step}
      showManual={showManual}
      setShowManual={setShowManual}
      marks={marks}
      compact={compact}
      zoomOpen={zoomOpen}
      setZoomOpen={setZoomOpen}
      pageImage={pageImage}
      photoOpen={photoOpen}
      setPhotoFor={setPhotoFor}
      onCommand={controls.onCommand}
      onAction={controls.onAction}
      notice={notice}
      setNotice={setNotice}
      pending={controls.pending}
      setAdvance={setAdvance}
      part={part}
      holoState={holoState}
      holoItems={holoItems}
      stepKey={stepKey}
      roomForResult={controls.roomForResult}
      isPhone={isPhone}
      setSheetOpen={setSheetOpen}
      sheetOpen={sheetOpen}
      stripItems={controls.stripItems}
      thumbs={controls.thumbs}
      stepIdx={stepIdx}
      steps={steps}
      centerCurrent={controls.centerCurrent}
      jumpToStep={controls.jumpToStep}
      activeSubs={activeSubs}
      setSubsteps={setSubsteps}
      autoMode={autoMode}
      autoSpeed={autoSpeed}
      autoStatus={autoStatus}
      runCheck={controls.runCheck}
      setPhase={setPhase}
      setAttempt={setAttempt}
      setCheckState={setCheckState}
      preview={preview}
      locating={locating}
      summaryOpen={summaryOpen}
      summaryMarkdown={formatSessionMarkdown(session)}
      setSummaryOpen={setSummaryOpen}
    />
  );
}
