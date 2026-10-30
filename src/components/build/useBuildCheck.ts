"use client";

import type { CheckResult } from "@/app/api/check/route";
import {
  AUTO_SPEAK_FIX_CONFIDENCE,
  MANUAL_ADVANCE_MS,
  markChecked
} from "@/lib/autoCheck";
import { checkVerdict, isPass, spokenIssues } from "@/lib/issueBox";
import { partLines } from "@/lib/parts";
import { faultCopy } from "@/lib/faults";
import { speak, speaker } from "@/lib/speech";
import { useCallback, useEffect, useRef } from "react";

import type { BuildNavigation } from "./useBuildNavigation";
import type { BuildState } from "./useBuildState";
export function useBuildCheck(s: BuildState, n: BuildNavigation) {
  const {
    camera: cameraRef, phase, target, previous, setCheckState, setIssuePick, checkSeq: checkSeqRef,
    advance, setAdvance, voiceDone: voiceDoneRef, muted, check, setCheck, timingRef: timingRefRef,
    watch: watchRef, step
  } = s;
  const { go } = n;
  // Checks the build against this step's manual picture. Asked for (button, Space/Enter, voice "check"): always
  // shows and speaks the result, as before. Automatic (Auto Mode): quiet unless it passes or finds a likely mistake.
  // Either way a pass (isPass) starts a cancellable move to the next step.
  const runCheck = useCallback(async (automatic = false): Promise<CheckResult | null> => {
    if(!step || !target || check?.state === "checking") return null;
    const frame = cameraRef.current?.capture();
    const sample = cameraRef.current?.sample() ?? null; // the view at check time, to tell if the cameraRef moves after
    if(!frame) {
      if(!automatic) setCheck({ state: "error", message: "Camera isn't ready yet." });
      return null;
    }
    if(!automatic) {
      // Pressing Check resumes a paused Auto Mode, and Auto Mode won't re-send the scene just checked.
      const fine = cameraRef.current?.sampleFine();
      if(fine) markChecked(watchRef.current, fine, Date.now());
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
      if(seq !== checkSeqRef.current) return null; // the step changed or a newer check started
      if (res.status === 429) {
        const fault = faultCopy("rate-limited");
        if (!automatic) {
          setCheck({ state: "error", message: `${fault.title}. ${fault.detail}` });
          if (!muted) speak(fault.say);
        } else setCheckState(null);
        return null;
      }
      if(!res.ok) throw new Error(data.error);
      const result = data as CheckResult;
      const verdict = checkVerdict(result);
      const pass = isPass(result);
      const loud = !automatic || pass || (verdict === "fix" && result.confidence >= AUTO_SPEAK_FIX_CONFIDENCE);
      voiceDoneRef.current = Promise.resolve();
      if(loud) {
        setCheck({ state: "result", result, frame, id: seq, sample });
        // A mistake is said with where it is ("The red 2x4 near the top left is rotated."), since the builder's eyes
        // are on the bricks; everything else says Claude's own sentence, as before.
        const spoken = verdict === "fix" ? spokenIssues(result.issues) : result.say;
        if(!muted && spoken) voiceDoneRef.current = speaker().say(spoken);
      } else {
        setCheckState(null);
      }
      if(pass) setAdvance({ id: seq, delay: automatic ? timingRefRef.current.advanceMs : MANUAL_ADVANCE_MS, waitForVoice: automatic, started: false });
      return result;
    } catch(e) {
      if(seq !== checkSeqRef.current) return null;
      if(automatic) setCheckState(null);
      else setCheck({ state: "error", message: e instanceof Error && e.message ? e.message : "Check failed." });
      return null;
    }
  }, [step, target, check?.state, cameraRef, checkSeqRef, setAdvance, setCheck, setIssuePick, watchRef, previous, voiceDoneRef, timingRefRef, muted, setCheckState]);

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
    if(pendingId == null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (pendingWaits ? voiceDoneRef.current : Promise.resolve()).then(() => {
      if(cancelled) return;
      setAdvance((a) => (a?.id === pendingId ? { ...a, started: true } : a));
      timer = setTimeout(() => {
        if(pendingId === checkSeqRef.current) goNext.current(1);
      }, pendingDelay);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pendingId, pendingDelay, pendingWaits, voiceDoneRef, setAdvance, checkSeqRef]);

  return { runCheck, pending, pendingId, pendingDelay, pendingWaits, goNext };
}
export type BuildCheck = ReturnType<typeof useBuildCheck>;
