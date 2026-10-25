// The voice assistant's structured reply: {"transcript": "...", "action": "...", "goto_step"?: n, "substeps"?: [...]}.
// It streams in as JSON; readTranscript() pulls the spoken text out while it's still arriving, so speech starts
// after the first sentence, and the action is read once the reply is complete.
// Pure functions (browser and tests). Run the tests with: npm run test:assist

export const ACTIONS = ["none", "next", "prev", "goto", "add_substeps"] as const;
export type AssistAction =
  | { action: "none" | "next" | "prev" }
  | { action: "goto"; goto_step: number }
  | { action: "add_substeps"; substeps: string[] };

const MIN_SUBSTEPS = 2;
const MAX_SUBSTEPS = 6;
const MAX_SUBSTEP_CHARS = 120;

/** Checks the action fields of a reply; anything malformed becomes "none" (never a wrong move). */
export function readAction(raw: unknown): AssistAction {
  if (!raw || typeof raw !== "object") return { action: "none" };
  const r = raw as Record<string, unknown>;
  switch (r.action) {
    case "next":
    case "prev":
      return { action: r.action };
    case "goto": {
      const n = Number(r.goto_step);
      return Number.isInteger(n) && n >= 1 && n <= 999 ? { action: "goto", goto_step: n } : { action: "none" };
    }
    case "add_substeps": {
      const list = Array.isArray(r.substeps)
        ? r.substeps.map((s) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, MAX_SUBSTEP_CHARS) : "")).filter(Boolean)
        : [];
      return list.length >= MIN_SUBSTEPS ? { action: "add_substeps", substeps: list.slice(0, MAX_SUBSTEPS) } : { action: "none" };
    }
    default:
      return { action: "none" };
  }
}

/**
 * Streams the "transcript" string out of a JSON reply as it arrives. feed() returns the newly decoded text.
 * If the reply turns out not to be JSON (the model answered in plain prose), the text passes straight through,
 * up to any JSON the model tacks on after it ("Sure, press it down. {"transcript": "Sure, press it down."...}"):
 * that part is never shown or spoken, only its action is used.
 */
export function readTranscript() {
  let raw = "";
  let mode: "start" | "seek" | "string" | "after" | "prose" = "start";
  let pos = 0; // how far into `raw` we've read
  let transcript = "";

  function feed(chunk: string): string {
    raw += chunk;
    let out = "";
    while (pos < raw.length) {
      if (mode === "start") {
        const c = raw[pos];
        if (/\s/.test(c)) {
          pos++;
          continue;
        }
        if (c === "`" || c === "{") {
          mode = "seek"; // JSON (maybe in a code fence)
          continue;
        }
        mode = "prose";
        continue;
      }
      if (mode === "prose") {
        // Spoken prose has no braces or backticks, so one means JSON is starting: stop there.
        const rest = raw.slice(pos);
        const cut = rest.search(/[{`]/);
        if (cut < 0) {
          out += rest;
          pos = raw.length;
          break;
        }
        out += rest.slice(0, cut);
        pos += cut;
        mode = "after";
        break;
      }
      if (mode === "seek") {
        const m = /"transcript"\s*:\s*"/.exec(raw.slice(pos));
        if (!m) {
          // Keep the tail in case the key is split across chunks.
          pos = Math.max(pos, raw.length - 20);
          break;
        }
        pos += m.index + m[0].length;
        mode = "string";
        continue;
      }
      if (mode === "string") {
        const c = raw[pos];
        if (c === '"') {
          mode = "after";
          pos++;
          break;
        }
        if (c !== "\\") {
          out += c;
          pos++;
          continue;
        }
        // Escape sequence: wait for all of it to arrive.
        const e = raw[pos + 1];
        if (e === undefined) break;
        if (e === "u") {
          const hex = raw.slice(pos + 2, pos + 6);
          if (hex.length < 4) break;
          out += String.fromCharCode(parseInt(hex, 16) || 32);
          pos += 6;
          continue;
        }
        out += ({ n: " ", t: " ", r: "", b: "", f: "" } as Record<string, string>)[e] ?? e; // \" \\ \/ come through as themselves
        pos += 2;
        continue;
      }
      break; // "after": the rest is the action, read at the end
    }
    transcript += out;
    return out;
  }

  /** The complete reply: everything spoken, and the action to take. */
  function finish(): { transcript: string; action: AssistAction } {
    if (mode === "prose" || mode === "start") return { transcript: transcript.trim(), action: { action: "none" } };
    const obj = parseObject(raw);
    // Prose followed by JSON: the prose was already spoken, so keep it; take only the action from the JSON.
    if (transcript.trim() && !/^\s*[{`]/.test(raw)) return { transcript: transcript.replace(/\s+/g, " ").trim(), action: readAction(obj) };
    const full = typeof obj?.transcript === "string" ? obj.transcript : transcript;
    return { transcript: full.replace(/\s+/g, " ").trim(), action: readAction(obj) };
  }

  return { feed, finish };
}

// The reply is one JSON object, sometimes inside a code fence: parse from the first "{" to the last "}".
function parseObject(raw: string): Record<string, unknown> | null {
  const a = raw.indexOf("{");
  const b = raw.lastIndexOf("}");
  if (a < 0 || b <= a) return null;
  try {
    const v = JSON.parse(raw.slice(a, b + 1));
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
