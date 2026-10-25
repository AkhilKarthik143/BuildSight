"use client";

// Keeps the model roughly fixed in space as the phone turns: device orientation (gyro) as a rotation relative to
// where the phone pointed when practice started (or at the last Recenter). iOS asks permission from a tap.
// No WebXR (iOS Safari doesn't have it); without a gyro, the view is moved by touch instead.

import { useCallback, useEffect, useRef, useState } from "react";
import * as THREE from "three";

const zee = new THREE.Vector3(0, 0, 1);
const toCamera = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // the camera looks out of the back of the phone
const euler = new THREE.Euler();
const qz = new THREE.Quaternion();

function deviceQuaternion(e: DeviceOrientationEvent, out: THREE.Quaternion) {
  const d = THREE.MathUtils.DEG2RAD;
  const orient = (typeof screen !== "undefined" && screen.orientation ? screen.orientation.angle : 0) * d;
  euler.set((e.beta ?? 0) * d, (e.alpha ?? 0) * d, -(e.gamma ?? 0) * d, "YXZ");
  out.setFromEuler(euler).multiply(toCamera).multiply(qz.setFromAxisAngle(zee, -orient));
  return out;
}

type PermissionApi = { requestPermission?: () => Promise<"granted" | "denied"> };

export function useDeviceOrientation() {
  const delta = useRef<THREE.Quaternion | null>(null); // rotation since calibration, in camera space
  const base = useRef<THREE.Quaternion | null>(null);
  const now = useRef(new THREE.Quaternion());
  const [active, setActive] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.alpha == null && e.beta == null) return;
      deviceQuaternion(e, now.current);
      if (!base.current) base.current = now.current.clone();
      delta.current = (delta.current ?? new THREE.Quaternion()).copy(base.current).invert().multiply(now.current);
      setActive(true);
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
  }, [enabled]);

  /** Call from a tap. Resolves true if motion is available (iOS shows its permission prompt). */
  const start = useCallback(async () => {
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return false;
    const api = DeviceOrientationEvent as unknown as PermissionApi;
    if (typeof api.requestPermission === "function") {
      try {
        if ((await api.requestPermission()) !== "granted") return false;
      } catch {
        return false;
      }
    }
    setEnabled(true);
    return true;
  }, []);

  const recenter = useCallback(() => {
    base.current = null;
    delta.current = null;
  }, []);

  const stop = useCallback(() => {
    setEnabled(false);
    setActive(false);
    recenter();
  }, [recenter]);

  return { delta, active, enabled, start, stop, recenter };
}
