import type { ExtractedStep } from "@/app/api/extract/route";
import { encodeCanvas } from "@/lib/encode";
// Every step picture on one page, cut out and scaled to THUMB_H px tall, decoding the page only once.
// Shared by the step strip and "where am I?" (see thumbsFor), so each picture is cut once per session.
const THUMB_H = 160;
export async function stepThumbs(pageImage: string, boxes: ExtractedStep["box"][], pad = 0.02): Promise<string[]> {
  const img = new Image();
  img.src = pageImage;
  await img.decode();
  const out: string[] = [];
  for(const box of boxes) {
    const x = Math.max(0, box.x - pad) * img.width;
    const y = Math.max(0, box.y - pad) * img.height;
    const w = Math.min(Math.min(1, box.w + 2 * pad) * img.width, img.width - x);
    const h = Math.min(Math.min(1, box.h + 2 * pad) * img.height, img.height - y);
    const scale = Math.min(1, THUMB_H / h);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    canvas.getContext("2d")?.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
    out.push(await encodeCanvas(canvas, "image/jpeg", 0.8));
  }
  return out;
}

// Lets the phone draw a frame between chunks of picture work, so the screen never freezes.
export const breathe = () => new Promise((r) => setTimeout(r, 0));

// Cuts a step's picture out of the rendered page (box is 0–1 of the page), with a little padding.
export async function crop(pageImage: string, box: ExtractedStep["box"], pad = 0.02): Promise<string> {
  const img = new Image();
  img.src = pageImage;
  await img.decode();
  const x = Math.max(0, box.x - pad) * img.width;
  const y = Math.max(0, box.y - pad) * img.height;
  const w = Math.min(1, box.w + 2 * pad) * img.width;
  const h = Math.min(1, box.h + 2 * pad) * img.height;
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(w, img.width - x);
  canvas.height = Math.min(h, img.height - y);
  canvas.getContext("2d")?.drawImage(img, x, y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return encodeCanvas(canvas, "image/jpeg", 0.75);
}

// Draws a light percentage grid on an image. Claude places boxes far more accurately with it.
export async function withGrid(src: string): Promise<string> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.max(1, 700 / img.width); // small crops get upscaled so labels stay legible
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const g = canvas.getContext("2d")!;
  g.drawImage(img, 0, 0, canvas.width, canvas.height);
  g.strokeStyle = "rgba(255,0,150,0.55)";
  g.fillStyle = "rgba(255,0,150,0.9)";
  g.lineWidth = 1;
  g.font = "11px sans-serif";
  for(let i = 1;i < 10;i++) {
    const x = (canvas.width * i) / 10;
    const y = (canvas.height * i) / 10;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, canvas.height);
    g.moveTo(0, y);
    g.lineTo(canvas.width, y);
    g.stroke();
    g.fillText(String(i * 10), x + 2, 11);
    g.fillText(String(i * 10), 2, y - 2);
  }
  return encodeCanvas(canvas, "image/jpeg", 0.75);
}
