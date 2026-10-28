"use client";
import { useAutoController } from "./useAutoController";
import { useBuildCheck } from "./useBuildCheck";
import { useBuildNavigation } from "./useBuildNavigation";
import { useBuildRecognition } from "./useBuildRecognition";
import { useBuildState } from "./useBuildState";
import { useBuildSummary } from "./useBuildSummary";
import { useBuildVoice } from "./useBuildVoice";
import { usePartGuidance } from "./usePartGuidance";

export function useBuildModel() {
  const s = useBuildState();
  const n = useBuildNavigation(s);
  const p = usePartGuidance(s);
  const c = useBuildCheck(s, n);
  const r = useBuildRecognition(s, n);
  useAutoController(s, n, c, r);
  const summary = useBuildSummary(s);
  const v = useBuildVoice(s, n, c, r, summary.openSummary);
  return { ...s, ...n, ...p, ...c, ...r, ...v, ...summary, roomForResult: s.isPhone && s.check != null && s.check.state !== "checking" };
}
export type BuildModel = ReturnType<typeof useBuildModel>;
