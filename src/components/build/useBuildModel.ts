"use client";
import { useAutoController } from "./useAutoController";
import { useBuildCheck } from "./useBuildCheck";
import { useBuildNavigation } from "./useBuildNavigation";
import { useBuildRecognition } from "./useBuildRecognition";
import { useBuildState } from "./useBuildState";
import { useBuildVoice } from "./useBuildVoice";
import { usePartGuidance } from "./usePartGuidance";

export function useBuildModel() {
  const s = useBuildState();
  const n = useBuildNavigation(s);
  const p = usePartGuidance(s);
  const c = useBuildCheck(s, n);
  const r = useBuildRecognition(s, n);
  useAutoController(s, n, c, r);
  const v = useBuildVoice(s, n, c, r);
  return { ...s, ...n, ...p, ...c, ...r, ...v, roomForResult: s.isPhone && s.check != null && s.check.state !== "checking" };
}
export type BuildModel = ReturnType<typeof useBuildModel>;
