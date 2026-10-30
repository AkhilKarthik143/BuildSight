"use client";

import type { CheckResult } from "@/app/api/check/route";
import {
  AUTO_MAX_MISSES,
  markChecked,
  recordMiss,
  resetForStep,
  tick,
  type AutoTiming
} from "@/lib/autoCheck";
import { checkVerdict, isPass } from "@/lib/issueBox";
import { speaker } from "@/lib/speech";
import { changed } from "@/lib/whereAmI";
import { useEffect, useRef } from "react";

import type { BuildCheck } from "./useBuildCheck";
import type { BuildNavigation } from "./useBuildNavigation";
import type { BuildRecognition } from "./useBuildRecognition";
import type { BuildState } from "./useBuildState";
export function useAutoController(s: BuildState, n: BuildNavigation, c: BuildCheck, r: BuildRecognition) {
  const {
    camera: cameraRef, doc, target, targetKey, checkSeq: checkSeqRef, stepKey, check, locating,
    lastAuto: lastAutoRef, lastManual: lastManualRef, autoJump: autoJumpRef, firstAutoDone:
    firstAutoDoneRef, baseline: baselineRef, autoMode, timing, watch: watchRef, setAutoStatus,
    currentKey: currentKeyRef, step
  } = s;
  const { reader, ready } = n;
  const { runCheck, pending } = c;
  const { findMyPlace } = r;
  // A new step drops any check still running and a pending auto-advance (the old result hides itself: see `check`).
  useEffect(() => {
    checkSeqRef.current++;
    // Auto Mode starts each step fresh: new "before" scene, no misses.
    currentKeyRef.current = stepKey;
    resetForStep(watchRef.current);
  }, [checkSeqRef, currentKeyRef, stepKey, watchRef]);

  // Step changes the builder made (Next, Back, voice, tapping) hold off automatic jumps for a while.
  useEffect(() => {
    if(autoJumpRef.current) autoJumpRef.current = false;
    else lastManualRef.current = Date.now();
  }, [autoJumpRef, lastManualRef, stepKey]);


  // Automatic detection. Watches a tiny grayscale cameraRef sample on the phone (no network). Once the whole
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
    ready: false, busy: false, checking: false, findMyPlace: () => { }, autoMode: false, canCheck: false, pending: false, runCheck: async () => null, timing,
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
    if(!reader || !doc) return;
    let prev: Uint8ClampedArray | null = null;
    let stillSince = Date.now();
    const timer = setInterval(() => {
      const st = autoState.current;
      if(st.autoMode && st.canCheck) {
        const fine = cameraRef.current?.sampleFine();
        if(!fine) return;
        const now = Date.now();
        const w = watchRef.current;
        const t = tick(w, fine, now, !st.ready || st.checking || st.pending || speaker().speaking, st.timing);
        // A miss stays on the status line until the scene moves again.
        if(w.misses >= AUTO_MAX_MISSES) setAutoStatus(`Auto · paused after ${AUTO_MAX_MISSES} tries · press Check`);
        else if(!st.checking && !st.pending && (w.misses === 0 || t.reason === "moving")) setAutoStatus("Auto · watching");
        if(!t.check) return;
        markChecked(w, fine, now);
        setAutoStatus("Auto · checking…");
        const key = currentKeyRef.current;
        st.runCheck(true).then((r) => {
          if(currentKeyRef.current !== key || (r && isPass(r))) return; // moved on meanwhile, or passed
          const verdict = r ? checkVerdict(r) : "unsure";
          setAutoStatus(verdict === "notyet" ? "Auto · not done yet" : verdict === "fix" ? "Auto · needs a fix" : "Auto · need a better look");
          if(recordMiss(w, verdict) && reader.count() >= doc.numPages) autoState.current.findMyPlace(true);
        });
        return;
      }
      const sample = cameraRef.current?.sample();
      if(!sample) return;
      const now = Date.now();
      const moving = !prev || changed(prev, sample) > 0.02;
      prev = sample;
      if(moving) {
        stillSince = now;
        return;
      }
      if(now - stillSince < 1500) return;
      if(!st.ready || st.busy || st.pending || speaker().speaking || reader.count() < doc.numPages) return;
      if(firstAutoDoneRef.current) {
        if(now - lastAutoRef.current < 20000 || now - lastManualRef.current < 20000) return;
        if(baselineRef.current && changed(baselineRef.current, sample) < 0.04) return; // nothing new on the table
      }
      firstAutoDoneRef.current = true;
      lastAutoRef.current = now;
      baselineRef.current = sample;
      st.findMyPlace(true);
    }, sampleMs);
    return () => clearInterval(timer);
  }, [reader, doc, sampleMs, cameraRef, firstAutoDoneRef, lastAutoRef, baselineRef, watchRef, setAutoStatus, currentKeyRef, lastManualRef]);

}
