"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { changed } from '@/lib/whereAmI';
import { describePart } from '@/lib/parts';
import { parseCameraPlacement, targetQuad, type CameraPlacement } from '@/lib/ar/placement';
import { invert, projectQuad, type Quad } from '@/lib/ar/homography';
import type { ArGuide } from './useArGuide';
import type { BuildState } from './useBuildState';

export type PlacementState = {
  key: string; status: 'loading' | 'ready' | 'empty' | 'error'; message: string;
  part: number; result?: CameraPlacement; quad?: Quad; anchored?: boolean;
  sample?: Uint8ClampedArray; frameSize?: { w: number; h: number };
  sourceVisible?: boolean; stale?: boolean; adjusted?: boolean; capturedAt?: number;
};
export function useCameraPlacement(s: BuildState, ar: ArGuide, source: string) {
  const { camera, step, target, targetKey, stepKey, phase, check, checkSeq, setSheetOpen } = s;
  const key = `${stepKey}:${source}`;
  const [state, setState] = useState<PlacementState | null>(null);
  const job = useRef<AbortController | null>(null), sequence = useRef(0);
  const stop = useCallback(() => { sequence.current++; job.current?.abort(); job.current = null; }, []);
  const cancel = useCallback(() => { stop(); setState(null); }, [stop]);
  useEffect(() => {
    const version = ++sequence.current;
    job.current?.abort(); job.current = null;
    queueMicrotask(() => { if (version === sequence.current) setState(null); });
    return stop;
  }, [key, ar.enabled, stop]);

  const request = useCallback(async (part: number) => {
    if (job.current || !ar.enabled || check?.state === 'checking' || phase.kind !== 'ready' ||
        !step?.parts[part] || !target || targetKey !== stepKey) return;
    const frame = camera.current?.capture(), sample = camera.current?.sample(), frameSize = camera.current?.size();
    if (!frame || !sample || !frameSize) {
      setState({ key, status: 'error', part, message: 'Camera is not ready. Allow camera access and try again.' }); return;
    }
    setSheetOpen(false); // Free the camera workspace; the step card remains expandable.
    const controller = new AbortController(); job.current = controller;
    const version = ++sequence.current, checkVersion = checkSeq.current, capturedAt = Date.now();
    const valid = () => version === sequence.current && !controller.signal.aborted && checkVersion === checkSeq.current;
    const anchor = ar.anchorFrame(frame);
    setState({ key, status: 'loading', part, message: 'Finding this part’s landing spot…' });
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetch('/api/ar-guide', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
        body: JSON.stringify({ frame, expected: target, instruction: step.instruction, part: describePart(step.parts[part]) }),
      });
      const body = await response.json();
      const pose = await anchor;
      if (controller.signal.aborted) throw Error("Aborted");
      if (!valid()) return;
      if (!response.ok) { setState({ key, status: 'error', part, message: response.status === 429 ? 'Too many suggestions. Wait a moment, then try again.' : response.status === 503 ? 'Camera suggestions need a Claude API key on the server. You can still pin a target on the mat.' : 'Could not suggest a placement. Try a clearer view.' }); return; }
      const result = parseCameraPlacement(body), quad = result && targetQuad(result);
      if (!result || !quad) {
        setState({ key, status: 'empty', part, message: result?.instruction || 'The attachment point is not clear. Show the assembly and the loose part, then try again.' }); return;
      }
      const inverse = pose && invert(pose), mat = inverse && projectQuad(inverse, quad);
      const now = camera.current?.sample();
      const moved = !now || changed(sample, now) > .12;
      setState({ key, status: 'ready', part, message: result.instruction || 'Compare the suggested area with your build before placing.',
        result, quad: mat || quad, anchored: !!mat, sample, frameSize, capturedAt,
        sourceVisible: !moved, stale: !mat && moved });
    } catch {
      if (version !== sequence.current || checkVersion !== checkSeq.current) return;
      setState({ key, status: 'error', part, message: controller.signal.aborted ? 'That took too long. Try again with a clear, still view.' : 'Could not suggest a placement. Check your connection and server API key, then try again.' });
    } finally { clearTimeout(timeout); if (job.current === controller) job.current = null; }
  }, [ar, camera, check?.state, checkSeq, setSheetOpen, key, phase.kind, step, stepKey, target, targetKey]);

  useEffect(() => {
    if (state?.key !== key || state.status !== 'ready' || !ar.enabled) return;
    const timer = setInterval(() => {
      const now = camera.current?.sample(), size = camera.current?.size();
      const moved = !now || !state.sample || changed(state.sample, now) > .12;
      const resized = !size || size.w !== state.frameSize?.w || size.h !== state.frameSize?.h;
      const expired = Date.now() - (state.capturedAt || 0) > 60_000;
      if (moved || resized || expired || document.hidden) setState(old => old?.key === key && old.status === 'ready'
        ? { ...old, sourceVisible: false, stale: old.stale || expired || document.hidden || (!old.anchored && (moved || resized)) } : old);
    }, 200);
    return () => clearInterval(timer);
  }, [ar.enabled, camera, key, state]);
  const adjust = useCallback((quad: Quad) => setState(old => {
    if (old?.status !== 'ready') return old;
    const normalized = old.anchored && ar.pose.pose ? projectQuad(ar.pose.pose, quad) : quad;
    return normalized?.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.y >= 0 && p.x <= 1 && p.y <= 1)
      ? { ...old, quad, adjusted: true } : old;
  }), [ar.pose.pose]);
  return { state: ar.enabled && state?.key === key && check?.state !== 'checking' ? state : null, request, cancel, adjust };
}
export type CameraPlacementGuide = ReturnType<typeof useCameraPlacement>;
