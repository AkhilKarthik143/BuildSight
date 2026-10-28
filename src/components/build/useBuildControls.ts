"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { CheckResult } from "@/app/api/check/route";
import type { ExtractedStep } from "@/app/api/extract/route";
import type { AssistAction } from "@/lib/assistReply";
import { AUTO_CHANGE_THRESHOLD, AUTO_MAX_MISSES, AUTO_SPEAK_FIX_CONFIDENCE, MANUAL_ADVANCE_MS, SPEED_OF, describeTiming, markChecked, newWatch, presetAt, recordMiss, resetForStep, stepSpeed, tick, timingFor, type AutoTiming } from "@/lib/autoCheck";
import { checkVerdict, isPass, spokenIssues } from "@/lib/issueBox";
import { matchCommand } from "@/lib/commands";
import { partLines } from "@/lib/parts";
import { speak, speaker, stopSpeaking } from "@/lib/speech";
import { faultCopy } from "@/lib/faults";
import { spokenStep } from "@/lib/stepText";
import { AUTO_MIN_CONFIDENCE, MAX_TILES, changed, decide, whereAmI, type Tile } from "@/lib/whereAmI";
import type { CameraHandle } from "@/components/CameraFeed";
import { PRESET_LABEL, readAutoMode, readAutoSpeed, setAutoModeStored, setAutoSpeedStored } from "./autoStore";
import { SEARCH_PAGES, breathe, pageReader, stepThumbs, type PageSource } from "./pageWork";
import type { Advance, Check, Phase } from "./types";

type Notice = { text: string; problems?: string[] } | null;
type Subs = { key: string; items: string[]; done: boolean[] } | null;

export type BuildControlInput = {
  camera: { current: CameraHandle | null };
  direction: { current: 1 | -1 };
  landOn: { current: number | null };
  landIdx: { current: number | null };
  search: { current: number };
  doc: PageSource | null;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  setPageImage: Dispatch<SetStateAction<string | null>>;
  steps: ExtractedStep[];
  setSteps: Dispatch<SetStateAction<ExtractedStep[]>>;
  stepIdx: number;
  setStepIdx: Dispatch<SetStateAction<number>>;
  phase: Phase;
  setPhase: Dispatch<SetStateAction<Phase>>;
  target: string | null;
  targetKey: string | null;
  previous: string | null;
  setCheckState: Dispatch<SetStateAction<(Check & { key: string }) | null>>;
  setIssuePick: Dispatch<SetStateAction<number | null>>;
  checkSeq: { current: number };
  advance: Advance | null;
  setAdvance: Dispatch<SetStateAction<Advance | null>>;
  voiceDone: { current: Promise<unknown> };
  muted: boolean;
  isPhone: boolean;
  setSheetOpen: Dispatch<SetStateAction<boolean>>;
  stepKey: string;
  setSubsteps: Dispatch<SetStateAction<Subs>>;
  check: (Check & { key: string }) | null;
  setCheck: (c: Check | null) => void;
  photoOpen: boolean;
  setAttempt: Dispatch<SetStateAction<number>>;
  setReadCount: Dispatch<SetStateAction<number>>;
  locating: boolean;
  setLocating: Dispatch<SetStateAction<boolean>>;
  notice: Notice;
  setNotice: Dispatch<SetStateAction<Notice>>;
  lastAuto: { current: number };
  lastManual: { current: number };
  autoJump: { current: boolean };
  firstAutoDone: { current: boolean };
  baseline: { current: Uint8ClampedArray | null };
  autoMode: boolean;
  timing: AutoTiming;
  timingRef: { current: AutoTiming };
  watch: { current: ReturnType<typeof newWatch> };
  setAutoStatus: Dispatch<SetStateAction<string | null>>;
  currentKey: { current: string };
  turnTo: (p: number) => void;
  step: ExtractedStep | undefined;
  reader: ReturnType<typeof pageReader> | null;
  zoomOpen: boolean;
  readCount: number;
  onSummary?: () => void;
};

export function useBuildControls(input: BuildControlInput) {
  const {
    camera: cameraRef, direction: directionRef, landOn: landOnRef, landIdx: landIdxRef, search: searchRef, doc, page, setPage, setPageImage, steps, setSteps, stepIdx, setStepIdx,
    phase, setPhase, target, targetKey, previous, setCheckState, setIssuePick, checkSeq: checkSeqRef, advance, setAdvance, voiceDone: voiceDoneRef,
    muted, isPhone, setSheetOpen, stepKey, setSubsteps, check, setCheck, photoOpen, setAttempt,
    setReadCount, locating, setLocating, notice, setNotice, lastAuto: lastAutoRef, lastManual: lastManualRef, autoJump: autoJumpRef, firstAutoDone: firstAutoDoneRef, baseline: baselineRef,
    autoMode, timing, timingRef, watch: watchRef, setAutoStatus, currentKey: currentKeyRef, turnTo, step, reader, zoomOpen, readCount,
    onSummary,
  } = input;

  // Back to step 1: page 1 forward, skipping cover/intro pages as usual.
  const restart = useCallback(
    (ask = true) => {
      if (!doc || (ask && !window.confirm("Start over from step 1?"))) return;
      searchRef.current++;
      stopSpeaking();
      directionRef.current = 1;
      setSheetOpen(true);
      turnTo(1);
      setAttempt((n) => n + 1); // re-read even if we're already on page 1
    },
    [doc, turnTo, directionRef, searchRef, setAttempt, setSheetOpen],
  );

  const go = useCallback(
    (delta: 1 | -1) => {
      if (phase.kind !== "ready" || !doc) return;
      searchRef.current++;
      setCheckState(null);
      directionRef.current = delta;
      const nextIdx = stepIdx + delta;
      if (nextIdx >= 0 && nextIdx < steps.length) return setStepIdx(nextIdx);
      const nextPage = page + delta;
      if (nextPage < 1) return;
      if (nextPage > doc.numPages) return setPhase({ kind: "done" });
      turnTo(nextPage);
    },
    [phase.kind, doc, stepIdx, steps.length, page, turnTo, directionRef, searchRef, setCheckState, setPhase, setStepIdx],
  );

  // Checks the build against this step's manual picture. Asked for (button, Space/Enter, voice "check"): always
  // shows and speaks the result, as before. Automatic (Auto Mode): quiet unless it passes or finds a likely mistake.
  // Either way a pass (isPass) starts a cancellable move to the next step.
  const runCheck = useCallback(async (automatic = false): Promise<CheckResult | null> => {
    if (!step || !target || check?.state === "checking") return null;
    const frame = cameraRef.current?.capture();
    const sample = cameraRef.current?.sample() ?? null; // the view at check time, to tell if the camera moves after
    if (!frame) {
      if (!automatic) setCheck({ state: "error", message: "Camera isn't ready yet." });
      return null;
    }
    if (!automatic) {
      // Pressing Check resumes a paused Auto Mode, and Auto Mode won't re-send the scene just checked.
      const fine = cameraRef.current?.sampleFine();
      if (fine) markChecked(watchRef.current, fine, Date.now());
      watchRef.current.misses = 0;
      watchRef.current.notYet = 0;
    }
    const seq = ++checkSeqRef.current;
    setAdvance(null);
    setCheck({ state: "checking", auto: automatic });
    setIssuePick(null);
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame, expected: target, previous: previous ?? undefined, instruction: step.instruction, watchFor: step.watchFor, parts: partLines(step.parts) }),
      });
      const data = await res.json();
      if (seq !== checkSeqRef.current) return null; // the step changed or a newer check started
      if (res.status === 429) {
        const fault = faultCopy("rate-limited");
        if (!automatic) {
          setCheck({ state: "error", message: `${fault.title}. ${fault.detail}` });
          if (!muted) speak(fault.say);
        } else setCheckState(null);
        return null;
      }
      if (!res.ok) throw new Error(data.error);
      const result = data as CheckResult;
      const verdict = checkVerdict(result);
      const pass = isPass(result);
      const loud = !automatic || pass || (verdict === "fix" && result.confidence >= AUTO_SPEAK_FIX_CONFIDENCE);
      voiceDoneRef.current = Promise.resolve();
      if (loud) {
        setCheck({ state: "result", result, frame, id: seq, sample });
        // A mistake is said with where it is ("The red 2x4 near the top left is rotated."), since the builder's eyes
        // are on the bricks; everything else says Claude's own sentence, as before.
        const spoken = verdict === "fix" ? spokenIssues(result.issues) : result.say;
        if (!muted && spoken) voiceDoneRef.current = speaker().say(spoken);
      } else {
        setCheckState(null);
      }
      if (pass) setAdvance({ id: seq, delay: automatic ? timingRef.current.advanceMs : MANUAL_ADVANCE_MS, waitForVoice: automatic, started: false });
      return result;
    } catch (e) {
      if (seq !== checkSeqRef.current) return null;
      if (automatic) setCheckState(null);
      else setCheck({ state: "error", message: e instanceof Error && e.message ? e.message : "Check failed." });
      return null;
    }
  }, [step, target, previous, check?.state, muted, setCheck, cameraRef, checkSeqRef, setAdvance, setCheckState, setIssuePick, timingRef, voiceDoneRef, watchRef]);

  // The pending move to the next step. Auto Mode waits for the "verified" line to finish (the mic is off while it
  // speaks), then gives 3 s to cancel: the Cancel button, saying "stop"/"cancel"/"wait", Back or Escape. A manual check
  // moves on 1.8 s after the result, as before. It belongs to the check result on screen, so a step change, a new check
  // or dismissing the result drops it; checkSeqRef is checked again before moving, so it can never skip an extra step.
  const pending = advance && phase.kind === "ready" && check?.state === "result" && check.id === advance.id ? advance : null;
  const pendingId = pending?.id;
  const pendingDelay = pending?.delay ?? 0;
  const pendingWaits = pending?.waitForVoice ?? false;
  const goNext = useRef(go);
  useEffect(() => {
    goNext.current = go;
  });
  useEffect(() => {
    if (pendingId == null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (pendingWaits ? voiceDoneRef.current : Promise.resolve()).then(() => {
      if (cancelled) return;
      setAdvance((a) => (a?.id === pendingId ? { ...a, started: true } : a));
      timer = setTimeout(() => {
        if (pendingId === checkSeqRef.current) goNext.current(1);
      }, pendingDelay);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pendingId, pendingDelay, pendingWaits, checkSeqRef, setAdvance, voiceDoneRef]);

  const speakStep = useCallback(() => {
    if (step && !muted) speak(spokenStep(step));
  }, [step, muted]);

  // Jumps to step n: on this page at once; otherwise reads pages ahead (then behind) until one has step n.
  // Step numbers can repeat in a book (sub-builds restart at 1), so the nearest match wins.
  const goToStep = useCallback(
    async (n: number) => {
      if (!doc || !reader || (phase.kind !== "ready" && phase.kind !== "done")) return;
      const here = phase.kind === "ready" ? steps.findIndex((s) => s.number === n) : -1;
      if (here >= 0) {
        searchRef.current++;
        setCheckState(null);
        if (here === stepIdx) speakStep();
        else setStepIdx(here);
        return;
      }
      const id = ++searchRef.current;
      const reach = doc.prebuilt ? doc.numPages : SEARCH_PAGES; // pre-read books are free to search
      const order: number[] = [];
      for (let k = 1; k <= reach && page + k <= doc.numPages; k++) order.push(page + k);
      for (let k = 1; k <= reach && page - k >= 1; k++) order.push(page - k);
      const wasPhase = phase;
      setCheckState(null);
      setPhase({ kind: "loading", label: `Finding step ${n}` });
      for (let i = 0; i < order.length; i++) {
        order.slice(i + 1, i + 3).forEach((p) => reader(p)); // read the next couple of pages meanwhile
        const found = await reader(order[i]).steps.catch(() => [] as ExtractedStep[]);
        if (searchRef.current !== id) return; // cancelled (Next, Back, Restart, another jump)
        if (found.some((s) => s.number === n)) {
          landOnRef.current = n;
          directionRef.current = 1;
          setPhase({ kind: "loading", label: `Opening step ${n}` });
          setPage(order[i]);
          return;
        }
      }
      if (searchRef.current !== id) return;
      setPhase(wasPhase);
      const searchedAll = order.length >= doc.numPages - 1;
      const message = searchedAll ? `I couldn't find step ${n} in this book.` : `I couldn't find step ${n} within ${SEARCH_PAGES} pages of this one.`;
      setCheck({ state: "error", message });
      if (!muted) speak(message);
    },
    [doc, reader, phase, steps, stepIdx, page, muted, speakStep, setCheck, directionRef, landOnRef, searchRef, setCheckState, setPage, setPhase, setStepIdx],
  );

  // Once a step is up, read the rest of the book in the background, two pages at a time (so the page in view
  // never waits), so "where am I?" can compare against every step. Pre-read manuals are instant.
  // Phones read one page at a time with a short rest between pages, and the screen re-lists the read pages at
  // most every 2 s: rendering and re-rendering for every page made the whole app stutter while a book was read.
  const ready = phase.kind === "ready";
  useEffect(() => {
    if (!reader || !doc || !ready) return;
    let stopped = false;
    let next = 1;
    let shown = 0;
    const show = () => {
      if (stopped) return;
      shown = Date.now();
      setReadCount(reader.count());
    };
    const lane = async () => {
      while (!stopped && next <= doc.numPages) {
        const p = next++;
        await reader(p).steps.catch(() => {});
        if (Date.now() - shown > 2000) show();
        if (isPhone) await new Promise((r) => setTimeout(r, 250));
      }
      show();
    };
    lane();
    if (!isPhone) lane();
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
      if (!known) return false;
      const idx = Math.max(0, Math.min(pick(known.steps), known.steps.length - 1));
      const id = searchRef.current;
      landIdxRef.current = idx; // the page effect re-runs for the new page and lands on the same step
      directionRef.current = 1;
      known
        .image()
        .then((image) => {
          if (searchRef.current !== id) return; // another jump started meanwhile
          setPageImage(image);
          setSteps(known.steps);
          setStepIdx(idx);
          setPage(toPage);
        })
        .catch(() => turnTo(toPage));
      return true;
    },
    [reader, turnTo, directionRef, landIdxRef, searchRef, setPage, setPageImage, setStepIdx, setSteps],
  );

  const openTile = useCallback(
    (t: Tile) => {
      searchRef.current++; // cancel any running "go to step" search
      setCheckState(null);
      if (t.page === page) {
        const idx = steps.findIndex((s) => s.number === t.number);
        if (idx >= 0) return setStepIdx(idx);
      }
      if (openReadPage(t.page, (found) => found.findIndex((s) => s.number === t.number))) return;
      landOnRef.current = t.number;
      directionRef.current = 1;
      turnTo(t.page);
    },
    [page, steps, turnTo, openReadPage, directionRef, landOnRef, searchRef, setCheckState, setStepIdx],
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
    if (have && have.steps === pg.steps) return have.job;
    const job = pg
      .image()
      .then((image) => stepThumbs(image, pg.steps.map((st) => st.box)))
      .catch(() => pg.steps.map(() => ""));
    pageThumbs.current.set(pg.page, { steps: pg.steps, job });
    return job;
  }, []);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!reader) return;
    let cancelled = false;
    (async () => {
      for (const pg of reader.pages()) {
        if (pg.steps.every((_, idx) => thumbs[`${pg.page}-${idx}`] !== undefined)) continue;
        const urls = await thumbsFor(pg);
        if (cancelled) return;
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
      searchRef.current++; // cancel any running "go to step" search
      setCheckState(null);
      if (toPage === page) return setStepIdx(idx);
      if (openReadPage(toPage, () => idx)) return;
      landIdxRef.current = idx;
      directionRef.current = 1;
      turnTo(toPage);
    },
    [page, turnTo, openReadPage, directionRef, landIdxRef, searchRef, setCheckState, setStepIdx],
  );
  // Centers the current step in the strip whenever it appears or the step changes. Keyed to the step, so swiping
  // the strip doesn't get pulled back on every re-render. A strip that just appeared (still at the start) jumps
  // straight there instead of sliding across every step.
  const centerCurrent = useCallback(
    (el: HTMLButtonElement | null) => {
      if (!el) return;
      const fresh = (el.parentElement?.scrollLeft ?? 0) === 0;
      requestAnimationFrame(() => el.scrollIntoView({ inline: "center", block: "nearest", behavior: fresh ? "auto" : "smooth" }));
    },
    [stepKey], // eslint-disable-line react-hooks/exhaustive-deps -- a new callback per step re-runs it
  );

  // "Where am I?": compares the camera with every step picture read so far. Jumps to the next step, or back to
  // an earlier step that looks broken. Asked for: always answers. Automatic: silent unless the step changes.
  const findMyPlace = useCallback(
    async (automatic = false) => {
      if (!reader || !doc || locating) return;
      const frame = cameraRef.current?.capture();
      const say = (text: string, problems?: string[]) => {
        setNotice({ text, problems });
        if (!muted) speak(text);
      };
      if (!frame) return automatic ? undefined : say("The camera isn't ready yet.");
      const pages = reader.pages();
      if (!pages.length) return automatic ? undefined : say("I haven't read any steps yet. Give me a moment.");
      setLocating(true);
      if (!automatic) setNotice({ text: "Finding your place…" });
      try {
        // The same step pictures the strip shows: already cut, so this is nearly free after the first time.
        const tiles: Tile[] = [];
        for (const pg of pages) {
          const urls = await thumbsFor(pg);
          for (const [idx, st] of pg.steps.entries()) {
            if (tiles.length >= MAX_TILES) break;
            tiles.push({ tile: tiles.length + 1, page: pg.page, number: st.number, image: urls[idx] });
          }
        }
        const complete = reader.count() >= doc.numPages;
        const result = await whereAmI({ frame, tiles, complete });
        const place = decide(result, tiles, complete, step && { page, number: step.number }, automatic ? AUTO_MIN_CONFIDENCE : 0);
        if (place.action === "fix" || place.action === "goto") {
          autoJumpRef.current = true;
          say(place.say, place.action === "fix" ? place.problems : undefined);
          openTile(place.target);
        } else if (!automatic) {
          say(place.say);
        }
      } catch (e) {
        if (!automatic) say(e instanceof Error && e.message ? e.message : "I couldn't find your place.");
      } finally {
        setLocating(false);
      }
    },
    [reader, doc, locating, muted, step, page, openTile, thumbsFor, autoJumpRef, cameraRef, setLocating, setNotice],
  );

  // A new step drops any check still running and a pending auto-advance (the old result hides itself: see `check`).
  useEffect(() => {
    checkSeqRef.current++;
    // Auto Mode starts each step fresh: new "before" scene, no misses.
    currentKeyRef.current = stepKey;
    resetForStep(watchRef.current);
  }, [stepKey, checkSeqRef, currentKeyRef, watchRef]);

  // Step changes the builder made (Next, Back, voice, tapping) hold off automatic jumps for a while.
  useEffect(() => {
    if (autoJumpRef.current) autoJumpRef.current = false;
    else lastManualRef.current = Date.now();
  }, [stepKey, autoJumpRef, lastManualRef]);


  // Automatic detection. Watches a tiny grayscale camera sample on the phone (no network). Once the whole
  // book is read it checks once, then again whenever the build has changed and the scene has held still for
  // 1.5 s (hands out of the way). At most every 20 s, and not within 20 s of the builder changing step.
  //
  // Auto Mode shares this loop: while it's on and the step's picture is ready, the "changed, then still" moment runs the
  // cheap step check (3 images) instead of "where am I" (up to 8 contact sheets). "Where am I" then only runs after 2
  // "not done yet" results in a row, in case the builder skipped ahead. Unlike "where am I", Auto Mode keeps watching
  // while a mistake is on screen, so it notices when the builder fixes it.
  type AutoState = {
    ready: boolean;
    busy: boolean;
    checking: boolean;
    findMyPlace: (automatic?: boolean) => void;
    autoMode: boolean;
    canCheck: boolean;
    pending: boolean;
    runCheck: (automatic?: boolean) => Promise<CheckResult | null>;
    timing: AutoTiming;
  };
  const autoState = useRef<AutoState>({
    ready: false, busy: false, checking: false, findMyPlace: () => {}, autoMode: false, canCheck: false, pending: false, runCheck: async () => null, timing,
  });
  useEffect(() => {
    // A mistake on screen pauses it too, so it doesn't jump away while the builder is fixing it.
    const reviewing = check?.state === "result" && check.result.issues.length > 0;
    autoState.current = {
      ready,
      busy: locating || check?.state === "checking" || reviewing,
      checking: locating || check?.state === "checking",
      findMyPlace,
      autoMode,
      canCheck: !!step && !!target && targetKey === stepKey,
      pending: !!pending,
      runCheck,
      timing,
    };
  });
  // Auto Mode samples faster at quicker speeds (250 ms at Fast) so "still for 0.8 s" is measured finely enough.
  const sampleMs = autoMode ? timing.sampleMs : 500;
  useEffect(() => {
    if (!reader || !doc) return;
    let prev: Uint8ClampedArray | null = null;
    let stillSince = Date.now();
    const timer = setInterval(() => {
      const st = autoState.current;
      if (st.autoMode && st.canCheck) {
        const fine = cameraRef.current?.sampleFine();
        if (!fine) return;
        const now = Date.now();
        const w = watchRef.current;
        const t = tick(w, fine, now, !st.ready || st.checking || st.pending || speaker().speaking, st.timing);
        // For tuning under the venue lights: how much the table differs from the last checked scene.
        console.log(
          `[auto] change ${t.change == null ? "—" : (t.change * 100).toFixed(1) + "%"} (needs ${(AUTO_CHANGE_THRESHOLD * 100).toFixed(1)}%)` +
            ` · motion ${(t.motion * 100).toFixed(1)}% · still ${(t.stillMs / 1000).toFixed(1)}s · ${t.reason}`,
        );
        // A miss stays on the status line until the scene moves again.
        if (w.misses >= AUTO_MAX_MISSES) setAutoStatus(`Auto · paused after ${AUTO_MAX_MISSES} tries · press Check`);
        else if (!st.checking && !st.pending && (w.misses === 0 || t.reason === "moving")) setAutoStatus("Auto · watching");
        if (!t.check) return;
        markChecked(w, fine, now);
        setAutoStatus("Auto · checking…");
        const key = currentKeyRef.current;
        st.runCheck(true).then((r) => {
          if (currentKeyRef.current !== key || (r && isPass(r))) return; // moved on meanwhile, or passed
          const verdict = r ? checkVerdict(r) : "unsure";
          setAutoStatus(verdict === "notyet" ? "Auto · not done yet" : verdict === "fix" ? "Auto · needs a fix" : "Auto · need a better look");
          if (recordMiss(w, verdict) && reader.count() >= doc.numPages) autoState.current.findMyPlace(true);
        });
        return;
      }
      const sample = cameraRef.current?.sample();
      if (!sample) return;
      const now = Date.now();
      const moving = !prev || changed(prev, sample) > 0.02;
      prev = sample;
      if (moving) {
        stillSince = now;
        return;
      }
      if (now - stillSince < 1500) return;
      if (!st.ready || st.busy || st.pending || speaker().speaking || reader.count() < doc.numPages) return;
      if (firstAutoDoneRef.current) {
        if (now - lastAutoRef.current < 20000 || now - lastManualRef.current < 20000) return;
        if (baselineRef.current && changed(baselineRef.current, sample) < 0.04) return; // nothing new on the table
      }
      firstAutoDoneRef.current = true;
      lastAutoRef.current = now;
      baselineRef.current = sample;
      st.findMyPlace(true);
    }, sampleMs);
    return () => clearInterval(timer);
  }, [reader, doc, sampleMs, baselineRef, cameraRef, currentKeyRef, firstAutoDoneRef, lastAutoRef, lastManualRef, setAutoStatus, watchRef]);

  // The notice fades after a while (problem lists stay longer). Tap to dismiss.
  useEffect(() => {
    if (!notice || locating) return;
    const t = setTimeout(() => setNotice(null), notice.problems?.length ? 20000 : 8000);
    return () => clearTimeout(t);
  }, [notice, locating, setNotice]);

  // Actions from the voice assistant's reply ("go back", "take me to step 5", "I'm stuck").
  const onAction = useCallback(
    (a: AssistAction) => {
      switch (a.action) {
        case "next":
          return go(1);
        case "prev":
          return go(-1);
        case "goto":
          return void goToStep(a.goto_step);
        case "add_substeps":
          return setSubsteps({ key: stepKey, items: a.substeps, done: a.substeps.map(() => false) });
      }
    },
    [go, goToStep, stepKey, setSubsteps],
  );

  // Spoken commands from the voice panel; returns what to show in the transcript, or null to ask Claude instead.
  const onCommand = useCallback(
    (text: string): string | null => {
      const c = matchCommand(text);
      if (!c) return null;
      if (c.kind === "stop") {
        stopSpeaking();
        if (pending) {
          setAdvance(null);
          return "Staying on this step.";
        }
        return "Stopped.";
      }
      if (c.kind === "auto") {
        setAutoModeStored(c.on);
        return c.on ? "Auto Mode on: I'll check each step when you finish it." : "Auto Mode off.";
      }
      if (c.kind === "speed") {
        const now = readAutoSpeed(); // the saved value, current even if two commands arrive before a re-render
        const next = c.to === "faster" ? stepSpeed(now, 1) : c.to === "slower" ? stepSpeed(now, -1) : SPEED_OF[c.to];
        setAutoSpeedStored(next);
        const name = PRESET_LABEL[presetAt(next) ?? "normal"];
        if (!muted) speak(`Auto speed ${name.toLowerCase()}.`);
        return `Auto speed: ${name}. ${describeTiming(timingFor(next))}.`;
      }
      if (c.kind === "summary") {
        onSummary?.();
        return "Here's your build summary.";
      }
      if (phase.kind === "loading") return "One moment, still loading.";
      switch (c.kind) {
        case "next":
          go(1);
          return "Next step.";
        case "back":
          go(-1);
          return "Previous step.";
        case "repeat":
          if (!step) return null;
          speakStep();
          return spokenStep(step);
        case "check":
          runCheck();
          return "Checking your build…";
        case "goto":
          goToStep(c.step);
          return `Going to step ${c.step}.`;
        case "locate":
          findMyPlace();
          return "Finding your place…";
      }
    },
    [phase.kind, go, step, speakStep, runCheck, goToStep, findMyPlace, pending, muted, setAdvance, onSummary],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (zoomOpen || photoOpen) return; // the zoom viewer handles its own keys
      if (e.target instanceof HTMLElement && e.target.closest("button, input, textarea")) return; // a focused button handles its own Enter/Space
      if (e.key === "a" || e.key === "A") setAutoModeStored(!readAutoMode());
      if (e.key === "Escape") setAdvance(null);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        runCheck();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, runCheck, zoomOpen, photoOpen, setAdvance]);

  // Phones are short: while a check result shows, the step card drops the extras (holograms, chips, tip) to make room.
  const roomForResult = isPhone && check != null && check.state !== "checking";


  return { restart, runCheck, pending, onAction, onCommand, roomForResult, stripItems, thumbs, jumpToStep, centerCurrent };
}
