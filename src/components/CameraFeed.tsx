"use client";

// Full-screen camera background. Prefers the rear camera on phones.
// Exposes a capture() that returns a resized JPEG data URL for the model, and a sample() that returns a
// tiny grayscale frame for cheap motion sensing on the phone (no network): 32x24 for "where am I", 64x48 (sampleFine)
// for Auto Mode, where a single small piece has to register. size() is the camera's own frame size,
// which capture() keeps (just scaled), so boxes in a captured photo can be mapped back onto the live video.

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { faultCopy } from "@/lib/faults";
import { speaker } from "@/lib/speech";

export type CameraHandle = {
  capture: () => string | null;
  sample: () => Uint8ClampedArray | null;
  sampleFine: () => Uint8ClampedArray | null;
  size: () => { w: number; h: number } | null;
};

const MAX_SIDE = 896; // enough detail for bricks, small enough to upload fast on venue Wi-Fi
const SAMPLE_W = 32;
const SAMPLE_H = 24;
const FINE_W = 64;
const FINE_H = 48;

type Sampler = { w: number; h: number; ctx: CanvasRenderingContext2D | null };

// Draws the video into a small canvas and returns grayscale pixels.
function grayscale(v: HTMLVideoElement, s: Sampler): Uint8ClampedArray | null {
  if (!s.ctx) {
    const c = document.createElement("canvas");
    c.width = s.w;
    c.height = s.h;
    s.ctx = c.getContext("2d", { willReadFrequently: true });
  }
  const ctx = s.ctx;
  if (!ctx) return null;
  ctx.drawImage(v, 0, 0, s.w, s.h);
  const rgba = ctx.getImageData(0, 0, s.w, s.h).data;
  const gray = new Uint8ClampedArray(s.w * s.h);
  for (let i = 0; i < gray.length; i++) gray[i] = (rgba[i * 4] * 3 + rgba[i * 4 + 1] * 6 + rgba[i * 4 + 2]) / 10;
  return gray;
}

const CameraFeed = forwardRef<CameraHandle>(function CameraFeed(_, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const sampler = useRef<Sampler>({ w: SAMPLE_W, h: SAMPLE_H, ctx: null });
  const fine = useRef<Sampler>({ w: FINE_W, h: FINE_H, ctx: null });

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera needs HTTPS (or localhost). Open the deployed https:// link on your phone.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // 1280x720 is plenty: photos for Claude are at most 896 px, and a 1080p stream costs phones more to decode and draw
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) video.current.srcObject = stream;
      } catch (e) {
        const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError");
        if (denied) {
          const fault = faultCopy("camera-denied");
          setError(`${fault.title}. ${fault.detail}`);
          speaker().say(fault.say);
        } else {
          setError(e instanceof Error ? `Camera blocked: ${e.message}` : "Camera blocked.");
        }
      }
    }
    start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useImperativeHandle(ref, () => ({
    capture() {
      const v = video.current;
      if (!v || !v.videoWidth) return null;
      const scale = Math.min(1, MAX_SIDE / Math.max(v.videoWidth, v.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(v, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.7);
    },
    size() {
      const v = video.current;
      return v && v.videoWidth ? { w: v.videoWidth, h: v.videoHeight } : null;
    },
    sample() {
      const v = video.current;
      return v && v.videoWidth ? grayscale(v, sampler.current) : null;
    },
    sampleFine() {
      const v = video.current;
      return v && v.videoWidth ? grayscale(v, fine.current) : null;
    },
  }));

  return (
    <div className="absolute inset-0 bg-black">
      <video ref={video} autoPlay playsInline muted className="h-full w-full object-cover" />
      {error && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">
          {error}
        </div>
      )}
    </div>
  );
});

export default CameraFeed;
