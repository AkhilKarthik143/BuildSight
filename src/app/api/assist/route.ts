// Voice assistant: answers the builder's spoken question, looking at the latest camera frame.
// Streams plain text back so the browser can start speaking after the first sentence.

import { ClaudeError, streamClaude, type Turn } from "@/lib/claude";

const MAX_IMAGE_CHARS = 4_000_000;
const MAX_TURNS = 8; // recent history only, to keep it fast

export type AssistRequest = {
  question: string;
  frame?: string; // camera frame, JPEG data URL
  history?: { role: "user" | "assistant"; text: string }[];
  step?: { number: number | string; instruction: string; parts?: string[]; watchFor?: string[] };
  manual?: string; // title of what they're building
};

const SYSTEM_PROMPT = `You are BuildSight, an expert builder talking someone through a LEGO set or IKEA furniture build, hands-free.
Your words are spoken aloud by a voice, so write for the ear:
- Keep it short: one to three sentences, under 50 words unless asked for more.
- One step at a time. Give the next action, then stop. Don't list several steps at once.
- Plain words. No markdown, lists, emoji, or symbols. Say numbers the way you'd say them.
- If there is a safety risk (tipping furniture, wall anchors, power tools, sharp edges, heavy lifting, small parts near young children), say the warning first.
- You may get a photo from their camera. Describe pieces by color, size and shape. If the photo is blurry, dark, or doesn't show what you need, say so and ask them to move closer or show a specific part. Don't guess.
- Use the current step from the manual when it's given. If what you see doesn't match it, say what's off and how to fix it.
- Be warm and calm, like a patient senior colleague.`;

function context(req: AssistRequest): string {
  const lines: string[] = [];
  if (req.manual) lines.push(`Building: ${req.manual}.`);
  if (req.step) {
    lines.push(`Current manual step ${req.step.number}: ${req.step.instruction}`);
    if (req.step.parts?.length) lines.push(`Parts for this step: ${req.step.parts.join(", ")}.`);
    if (req.step.watchFor?.length) lines.push(`Common mistakes here: ${req.step.watchFor.join("; ")}.`);
  }
  return lines.join("\n");
}

export async function POST(request: Request) {
  let body: AssistRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const question = body.question?.trim();
  if (!question) return Response.json({ error: "No question heard." }, { status: 400 });
  const frame = body.frame && body.frame.length < MAX_IMAGE_CHARS ? body.frame : undefined;

  const ctx = context(body);
  const turns: Turn[] = [
    ...(body.history ?? []).slice(-MAX_TURNS).filter((t) => t.text?.trim()),
    {
      role: "user",
      text: `${ctx ? `${ctx}\n\n` : ""}${frame ? "Camera photo attached. " : "No camera photo this time. "}They said: "${question}"`,
      image: frame,
    },
  ];
  // History must start with the user.
  while (turns.length && turns[0].role !== "user") turns.shift();

  const chunks = streamClaude(SYSTEM_PROMPT, turns);

  // Wait for the first chunk so an early failure comes back as a clear error, not a broken stream.
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (e) {
    const status = e instanceof ClaudeError ? e.status : 502;
    return Response.json({ error: e instanceof Error ? e.message : "Claude failed." }, { status });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        for await (const text of chunks) controller.enqueue(encoder.encode(text));
      } catch {
        controller.enqueue(encoder.encode(" ...sorry, I lost the connection. Ask me again."));
      }
      controller.close();
    },
    cancel() {
      chunks.return(undefined);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
