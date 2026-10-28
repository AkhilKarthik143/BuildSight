"use client";

import type { AssistAction } from "@/lib/assistReply";
import {
  describeTiming,
  presetAt,
  SPEED_OF,
  stepSpeed,
  timingFor
} from "@/lib/autoCheck";
import { matchCommand } from "@/lib/commands";
import { speak, stopSpeaking } from "@/lib/speech";
import { useCallback, useEffect } from "react";

import { spokenStep } from "@/lib/stepLabels";
import { PRESET_LABEL, readAutoMode, readAutoSpeed, setAutoModeStored, setAutoSpeedStored } from "./autoPreferences";
import type { BuildCheck } from "./useBuildCheck";
import type { BuildNavigation } from "./useBuildNavigation";
import type { BuildRecognition } from "./useBuildRecognition";
import type { BuildState } from "./useBuildState";
export function useBuildVoice(s: BuildState, n: BuildNavigation, c: BuildCheck, r: BuildRecognition, openSummary: () => void) {
  const { phase, setAdvance, muted, zoomOpen, stepKey, setSubsteps, photoOpen, step } = s;
  const { go, speakStep, goToStep } = n;
  const { runCheck, pending } = c;
  const { findMyPlace } = r;
  // 4. read each new step aloud
  useEffect(() => {
    if(phase.kind === "ready" && step && !muted) speak(spokenStep(step));
  }, [phase.kind, step, muted]);
  useEffect(() => stopSpeaking, []);
  // Actions from the voice assistant's reply ("go back", "take me to step 5", "I'm stuck").
  const onAction = useCallback(
    (a: AssistAction) => {
      switch(a.action) {
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
    [go, goToStep, setSubsteps, stepKey],
  );

  // Spoken commands from the voice panel; returns what to show in the transcript, or null to ask Claude instead.
  const onCommand = useCallback(
    (text: string): string | null => {
      const c = matchCommand(text);
      if(!c) return null;
      if(c.kind === "stop") {
        stopSpeaking();
        if(pending) {
          setAdvance(null);
          return "Staying on this step.";
        }
        return "Stopped.";
      }
      if(c.kind === "summary") {
        openSummary();
        return "Here's your build summary.";
      }
      if(c.kind === "auto") {
        setAutoModeStored(c.on);
        return c.on ? "Auto Mode on: I'll check each step when you finish it." : "Auto Mode off.";
      }
      if(c.kind === "speed") {
        const now = readAutoSpeed(); // the saved value, current even if two commands arrive before a re-render
        const next = c.to === "faster" ? stepSpeed(now, 1) : c.to === "slower" ? stepSpeed(now, -1) : SPEED_OF[c.to];
        setAutoSpeedStored(next);
        const name = PRESET_LABEL[presetAt(next) ?? "normal"];
        if(!muted) speak(`Auto speed ${name.toLowerCase()}.`);
        return `Auto speed: ${name}. ${describeTiming(timingFor(next))}.`;
      }
      if(phase.kind === "loading") return "One moment, still loading.";
      switch(c.kind) {
        case "next":
          go(1);
          return "Next step.";
        case "back":
          go(-1);
          return "Previous step.";
        case "repeat":
          if(!step) return null;
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
    [openSummary, phase.kind, pending, setAdvance, muted, go, step, speakStep, runCheck, goToStep, findMyPlace],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if(zoomOpen || photoOpen) return; // the zoom viewer handles its own keys
      if(e.target instanceof HTMLElement && e.target.closest("button, input, textarea")) return; // a focused button handles its own Enter/Space
      if(e.key === "a" || e.key === "A") setAutoModeStored(!readAutoMode());
      if(e.key === "Escape") setAdvance(null);
      if(e.key === "ArrowRight") go(1);
      if(e.key === "ArrowLeft") go(-1);
      if(e.key === " " || e.key === "Enter") {
        e.preventDefault();
        runCheck();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, runCheck, zoomOpen, photoOpen, setAdvance]);

  return { onAction, onCommand };
}
