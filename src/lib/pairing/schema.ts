// Pairing messages between a phone camera and the laptop screen. Pure.

export type PairMessage =
  | { type: "frame"; image: string }
  | { type: "step"; page: number; step: number }
  | { type: "check"; verdict: string; say: string }
  | { type: "transcript"; text: string; from: "phone" | "laptop" };

const IMAGE = /^data:image\/(?:jpeg|png|gif|webp);base64,[a-z0-9+/=\s]+$/i;
const MAX_IMAGE = 8_000_000;
const MAX_TEXT = 2_000;

export function parsePairMessage(value: unknown): PairMessage | null {
  if (!value || typeof value !== "object") return null;
  const msg = value as Record<string, unknown>;
  if (msg.type === "frame") {
    if (typeof msg.image !== "string" || msg.image.length > MAX_IMAGE || !IMAGE.test(msg.image)) return null;
    return { type: "frame", image: msg.image };
  }
  if (msg.type === "step") {
    if (!whole(msg.page, 1, 2000) || !whole(msg.step, 0, 2000)) return null;
    return { type: "step", page: msg.page, step: msg.step };
  }
  if (msg.type === "check") {
    if (typeof msg.verdict !== "string" || typeof msg.say !== "string") return null;
    if (msg.verdict.length > 40 || msg.say.length > MAX_TEXT) return null;
    return { type: "check", verdict: msg.verdict, say: msg.say };
  }
  if (msg.type === "transcript") {
    if ((msg.from !== "phone" && msg.from !== "laptop") || typeof msg.text !== "string" || !msg.text.trim() || msg.text.length > MAX_TEXT) return null;
    return { type: "transcript", text: msg.text, from: msg.from };
  }
  return null;
}

function whole(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}
