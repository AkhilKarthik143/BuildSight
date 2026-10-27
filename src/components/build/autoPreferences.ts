"use client";
import { DEFAULT_SPEED,type AutoPreset } from "@/lib/autoCheck";
import { useSyncExternalStore } from "react";
// Auto Mode on/off, remembered per device. Off by default, so the manual Check flow is unchanged until it's turned on.
const AUTO_KEY = "buildsight:autoMode";
const autoListeners = new Set<() => void>();
export function readAutoMode() {
  try {
    return localStorage.getItem(AUTO_KEY) === "1";
  } catch {
    return false;
  }
}
export function setAutoModeStored(on: boolean) {
  try {
    localStorage.setItem(AUTO_KEY, on ? "1" : "0");
  } catch {}
  autoListeners.forEach((fn) => fn());
}
export function useAutoMode() {
  return useSyncExternalStore(
    (onChange) => {
      autoListeners.add(onChange);
      return () => void autoListeners.delete(onChange);
    },
    readAutoMode,
    () => false,
  );
}
// Auto Mode speed, remembered per device: 0 = Careful … 0.5 = Normal (default) … 1 = Fast. See timingFor in autoCheck.ts.
const SPEED_KEY = "buildsight:autoSpeed";
const speedListeners = new Set<() => void>();
export function readAutoSpeed() {
  try {
    const v = Number(localStorage.getItem(SPEED_KEY));
    return localStorage.getItem(SPEED_KEY) != null && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_SPEED;
  } catch {
    return DEFAULT_SPEED;
  }
}
export function setAutoSpeedStored(v: number) {
  try {
    localStorage.setItem(SPEED_KEY, String(Math.min(1, Math.max(0, v))));
  } catch {}
  speedListeners.forEach((fn) => fn());
}
export function useAutoSpeed() {
  return useSyncExternalStore(
    (onChange) => {
      speedListeners.add(onChange);
      return () => void speedListeners.delete(onChange);
    },
    readAutoSpeed,
    () => DEFAULT_SPEED,
  );
}
export const PRESET_LABEL: Record<AutoPreset, string> = { careful: "Careful", normal: "Normal", fast: "Fast" };
