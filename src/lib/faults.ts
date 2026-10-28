// Friendly copy for the four failures the build screen can explain. Pure.

export type FaultKind = "camera-denied" | "mic-denied" | "offline" | "rate-limited";

export type FaultCopy = { title: string; detail: string; say: string };

const COPY: Record<FaultKind, FaultCopy> = {
  "camera-denied": {
    title: "Camera is blocked",
    detail: "Allow the camera in the browser's address bar, then reload.",
    say: "I can't see the build. Allow the camera, then try again.",
  },
  "mic-denied": {
    title: "Microphone is blocked",
    detail: "Allow the microphone in the browser's address bar, then tap the mic again.",
    say: "I can't hear you. Allow the microphone, then tap the mic again.",
  },
  offline: {
    title: "You're offline",
    detail: "Check the connection. The demo manual still opens from this device.",
    say: "You look offline. Check the connection and try again.",
  },
  "rate-limited": {
    title: "Slow down a moment",
    detail: "Too many requests. Try again shortly.",
    say: "That's too many requests. Wait a moment, then try again.",
  },
};

export function faultCopy(kind: FaultKind): FaultCopy {
  return COPY[kind];
}

export function faultFromMessage(message: string, status?: number): FaultKind | null {
  if (status === 429) return "rate-limited";
  const text = message.toLowerCase();
  if (text.includes("too many requests") || text.includes("daily limit")) return "rate-limited";
  if (text.includes("mic access is blocked") || text.includes("microphone is blocked") || text.includes("couldn't open the microphone")) return "mic-denied";
  if (text.includes("camera") && (text.includes("blocked") || text.includes("denied") || text.includes("not allowed"))) return "camera-denied";
  if (text.includes("offline") || text.includes("network problem") || text.includes("failed to fetch") || text.includes("can't reach the server")) return "offline";
  return null;
}
