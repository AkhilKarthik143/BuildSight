// Sends one camera frame (plus an optional question) to Claude via OpenRouter.
// The API key stays on the server; the browser only sees the answer.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";
const MAX_IMAGE_CHARS = 4_000_000; // ~3 MB of base64; frames are resized well below this

const SYSTEM_PROMPT =
  "You are BuildSight, a hands-free build assistant looking down at a work surface " +
  "through an overhead camera. Answer in at most two short sentences, as if spoken aloud. " +
  "Name pieces by color and size (for example 'red 2x4 brick'). If you can't see clearly, say so.";

type VisionRequest = { image?: string; question?: string };

export async function POST(request: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim(); // pasted keys often carry a stray space
  if (!apiKey) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 500 },
    );
  }

  let body: VisionRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const { image, question } = body;
  if (!image || !image.startsWith("data:image/")) {
    return Response.json({ error: "Send `image` as a data URL (data:image/jpeg;base64,...)." }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return Response.json({ error: "Image too large." }, { status: 413 });
  }

  const started = Date.now();
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "BuildSight",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      max_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: image } },
            { type: "text", text: question?.trim() || "What do you see on the work surface?" },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return Response.json({ error: `OpenRouter error ${res.status}`, detail: detail.slice(0, 500) }, { status: 502 });
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  return Response.json({ text, model: data?.model, latencyMs: Date.now() - started });
}
