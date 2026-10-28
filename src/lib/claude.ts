// One place that talks to Claude. Uses the Anthropic API directly when ANTHROPIC_API_KEY is set,
// otherwise falls back to OpenRouter (OPENROUTER_API_KEY). Server-only.

import Anthropic from "@anthropic-ai/sdk";

export type Part = { type: "text"; text: string } | { type: "image"; dataUrl: string };

type Ask = {
  system: string;
  parts: Part[];
  effort?: "low" | "medium" | "high";
};

export class ClaudeError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "anthropic/claude-sonnet-5.5";
// Thinking happens inside this budget too, so leave plenty of room.
const MAX_TOKENS = 16000;

type ImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const IMAGE_TYPES = new Set<string>(["image/jpeg", "image/png", "image/gif", "image/webp"]);

// Upstream messages sometimes echo the request, including the key. Never forward them.
function safeStatus(status: number | undefined): number {
  return typeof status === "number" && status >= 400 && status <= 599 ? status : 502;
}

function splitDataUrl(dataUrl: string): { mediaType: ImageType; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m || !IMAGE_TYPES.has(m[1])) throw new ClaudeError("Images must be JPEG, PNG, GIF or WebP data URLs.", 400);
  return { mediaType: m[1] as ImageType, data: m[2] };
}

export function claudeConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim());
}

let client: Anthropic | null = null;

async function viaAnthropic({ system, parts, effort = "low" }: Ask): Promise<string> {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  const content: Anthropic.Beta.BetaContentBlockParam[] = parts.map((p) => {
    if (p.type === "text") return { type: "text", text: p.text };
    const { mediaType, data } = splitDataUrl(p.dataUrl);
    return { type: "image", source: { type: "base64", media_type: mediaType, data } };
  });

  try {
    const response = await client.beta.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort },
      // If a safety filter wrongly declines, the API re-runs the request on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") throw new ClaudeError("Claude declined this request.", 422);
    return response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  } catch (e) {
    if (e instanceof ClaudeError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new ClaudeError("Anthropic rejected the API key.", 500);
    if (e instanceof Anthropic.RateLimitError) throw new ClaudeError("Rate limited by Anthropic. Try again in a moment.", 429);
    if (e instanceof Anthropic.APIError) throw new ClaudeError("Claude request failed.", safeStatus(e.status));
    throw new ClaudeError("Couldn't reach Anthropic.");
  }
}

async function viaOpenRouter({ system, parts }: Ask): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!.trim()}`,
      "Content-Type": "application/json",
      "X-Title": "BuildSight",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        {
          role: "user",
          content: parts.map((p) => (p.type === "text" ? { type: "text", text: p.text } : { type: "image_url", image_url: { url: p.dataUrl } })),
        },
      ],
    }),
  });
  if (!res.ok) throw new ClaudeError("OpenRouter request failed.", res.status === 429 ? 429 : 502);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

/** Sends one request to Claude and returns its text reply. */
export async function askClaude(ask: Ask): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY?.trim()) return viaAnthropic(ask);
  if (process.env.OPENROUTER_API_KEY?.trim()) return viaOpenRouter(ask);
  throw new ClaudeError("No Claude key set. Add ANTHROPIC_API_KEY (or OPENROUTER_API_KEY) to .env.local and to Vercel.", 500);
}

// ---- Streaming, for the voice assistant ----

export type Turn = { role: "user" | "assistant"; text: string; image?: string };

/**
 * Streams Claude's reply as text chunks. Tuned for speed: no extended thinking, low effort, short replies.
 * Without an Anthropic key it falls back to one non-streamed OpenRouter call.
 */
export async function* streamClaude(system: string, turns: Turn[]): AsyncGenerator<string> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    const last = turns[turns.length - 1];
    const parts: Part[] = [{ type: "text", text: last.text }];
    if (last.image) parts.unshift({ type: "image", dataUrl: last.image });
    yield await askClaude({ system, parts });
    return;
  }

  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!.trim() });
  const messages: Anthropic.Beta.BetaMessageParam[] = turns.map((t) => {
    if (!t.image) return { role: t.role, content: t.text };
    const { mediaType, data } = splitDataUrl(t.image);
    return {
      role: t.role,
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data } },
        { type: "text", text: t.text },
      ],
    };
  });

  try {
    const stream = client.beta.messages.stream({
      model: ANTHROPIC_MODEL,
      max_tokens: 2000,
      // Sonnet 5.5's no-thinking mode: fastest first word. Other models just use low effort.
      ...(ANTHROPIC_MODEL === "claude-sonnet-5-5" ? { thinking: { type: "between_tools" as const } } : {}),
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages,
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text;
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") yield " Sorry, I can't help with that one.";
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ClaudeError("Anthropic rejected the API key.", 500);
    if (e instanceof Anthropic.RateLimitError) throw new ClaudeError("Rate limited by Anthropic. Try again in a moment.", 429);
    if (e instanceof Anthropic.APIError) throw new ClaudeError("Claude request failed.", safeStatus(e.status));
    throw new ClaudeError("Couldn't reach Anthropic.");
  }
}
