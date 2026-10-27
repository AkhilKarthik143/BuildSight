"use client";

import type { ExtractedStep } from "@/app/api/extract/route";
import type { LocateResult } from "@/app/api/locate/route";
import { type CameraHandle } from "@/components/CameraFeed";
import {
  newWatch,
  timingFor,
  type AutoTiming
} from "@/lib/autoCheck";
import { checkVerdict, forStep } from "@/lib/issueBox";
import { type Manual } from "@/lib/manuals";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAutoMode, useAutoSpeed } from "./autoPreferences";
import { type PageSource } from "./pageReader";
import type { Advance, Check, Phase } from "./types";
import { useIsPhone } from "./useIsPhone";

export function useBuildState() {
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

  return {
    id, camera, liveCamera, direction, landOn, landIdx, search, manual, setManual, doc, setDoc, page,
    setPage, pageImage, setPageImage, steps, setSteps, stepIdx, setStepIdx, phase, setPhase, target,
    setTarget, targetKey, setTargetKey, previous, setPrevious, checkState, setCheckState, issuePick,
    setIssuePick, showBoxes, setShowBoxes, photoFor, setPhotoFor, checkSeq, advance, setAdvance,
    voiceDone, muted, setMuted, showManual, setShowManual, zoomOpen, setZoomOpen, isPhone, sheetOpen,
    setSheetOpen, compact, stepKey, substeps, setSubsteps, activeSubs, check, setCheck, verdict,
    photoOpen, located, attempt, setAttempt, preview, setPreview, readCount, setReadCount, locating,
    setLocating, notice, setNotice, lastAuto, lastManual, autoJump, firstAutoDone, baseline, autoMode,
    autoSpeed, timing, timingRef, watch, autoStatus, setAutoStatus, currentKey, turnTo, step, part
  };
}
export type BuildState = ReturnType<typeof useBuildState>;
