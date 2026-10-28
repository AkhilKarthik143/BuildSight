"use client";
import { useCallback, useState } from "react";
import { boxLocation, checkVerdict } from "@/lib/issueBox";
import { emptySession, formatSessionMarkdown, noteMistake, noteStep, type SessionState } from "@/lib/sessionSummary";
import { stepLabel } from "@/lib/stepLabels";
import type { BuildState } from "./useBuildState";

export function useBuildSummary({ manual, step, stepKey, check, phase }: BuildState) {
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

  const [pairOpen, setPairOpen] = useState(false);
  return { summaryOpen, setSummaryOpen, summaryMarkdown: formatSessionMarkdown(session), openSummary, pairOpen, setPairOpen };
}
