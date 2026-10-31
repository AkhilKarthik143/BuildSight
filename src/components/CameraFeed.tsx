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
  sampleFrame?: () => ImageData | null;
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
function grayscale(v: CanvasImageSource, s: Sampler): Uint8ClampedArray | null {
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

type Props = { remoteEnabled?: boolean; remoteFrame?: string | null; muted?: boolean };
const CameraFeed = forwardRef<CameraHandle, Props>(function CameraFeed({ remoteEnabled = false, remoteFrame = null, muted = false }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const remote = useRef<HTMLImageElement>(null);
  const mutedRef = useRef(muted);
  useEffect(() => { mutedRef.current = muted; }, [muted]);
  const [error, setError] = useState<string | null>(null);
  const sampler = useRef<Sampler>({ w: SAMPLE_W, h: SAMPLE_H, ctx: null });
  const arCanvas = useRef<HTMLCanvasElement | null>(null);
  const fine = useRef<Sampler>({ w: FINE_W, h: FINE_H, ctx: null });

  useEffect(() => {
    if (remoteEnabled) return;
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
        setError(null);
      } catch (e) {
        const denied = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError");
        if (denied) {
          const fault = faultCopy("camera-denied");
          setError(`${fault.title}. ${fault.detail}`);
          if (!mutedRef.current) speaker().say(fault.say);
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
  }, [remoteEnabled]);

  function currentSource() {
    const image = remote.current, v = video.current;
    if (remoteEnabled) return remoteFrame && image?.complete && image.naturalWidth ? { image, w: image.naturalWidth, h: image.naturalHeight } : null;
    return v?.videoWidth ? { image: v, w: v.videoWidth, h: v.videoHeight } : null;
  }
  useImperativeHandle(ref, () => ({
    sampleFrame() {
      const source = currentSource();
      if (!source) return null;
      const canvas = arCanvas.current ??= document.createElement("canvas");
      const h = Math.round(320 * source.h / source.w);
      if (canvas.width !== 320 || canvas.height !== h) { canvas.width = 320; canvas.height = h; }
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(source.image, 0, 0, 320, h);
      return ctx.getImageData(0, 0, 320, h);
    },
    capture() {
      const source = currentSource();
      if (!source) return null;
      const scale = Math.min(1, MAX_SIDE / Math.max(source.w, source.h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(source.w * scale);
      canvas.height = Math.round(source.h * scale);
      canvas.getContext("2d")?.drawImage(source.image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.7);
    },
    size() {
      const source = currentSource();
      return source ? { w: source.w, h: source.h } : null;
    },
    sample() {
      const source = currentSource();
      return source ? grayscale(source.image, sampler.current) : null;
    },
    sampleFine() {
      const source = currentSource();
      return source ? grayscale(source.image, fine.current) : null;
    },
  }));

  return (
    <div className="absolute inset-0 bg-black">
      {remoteEnabled ? (remoteFrame ? (
        // eslint-disable-next-line @next/next/no-img-element -- private same-origin paired camera frame
        <img ref={remote} src={remoteFrame} alt="Phone camera" className="h-full w-full object-cover" />
      ) : <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/70">Phone camera paused. Reconnect the phone or choose the laptop camera in Pair.</p>) : <video ref={video} autoPlay playsInline muted className="h-full w-full object-cover" />}
      {remoteEnabled && <p className="absolute left-3 top-14 z-20 rounded-full bg-ink/90 px-2 py-1 text-[10px] text-holo">Phone camera · preview rate</p>}
      {error && !remoteEnabled && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/80">
          {error}
        </div>
      )}
    </div>
  );
});

export default CameraFeed;
