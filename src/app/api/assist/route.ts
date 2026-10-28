// Voice assistant: answers the builder's spoken question, looking at the latest camera frame.
// Streams the reply so the browser can start speaking after the first sentence.
// Default: plain text. With `format: "json"`: one JSON object, transcript first, then an action the app carries out
// ({"transcript", "action": none|next|prev|goto|add_substeps, "goto_step"?, "substeps"?}; see src/lib/assistReply.ts).

import { guard } from "@/lib/apiGuard";
import { asImage, asText } from "@/lib/apiInput";
import { ClaudeError, streamClaude, type Turn } from "@/lib/claude";

const MAX_IMAGE_CHARS = 4_000_000;
const MAX_TURNS = 8; // recent history only, to keep it fast

export type AssistRequest = {
  question: string;
  frame?: string; // camera frame, JPEG data URL
  history?: { role: "user" | "assistant"; text: string }[];
  step?: { number: number | string; instruction: string; parts?: string[]; watchFor?: string[]; selectedPart?: string };
  manual?: string; // title of what they're building
  format?: "text" | "json"; // "json": structured reply with an action (older clients leave it out and get plain text)
};

const SYSTEM_PROMPT = `You are BuildSight, an expert builder talking someone through a LEGO set or IKEA furniture build, hands-free.
Your words are spoken aloud by a voice, so write for the ear:
- Keep it short: one to three sentences, under 50 words unless asked for more.
- One physical action per sentence. Short sentences.
- Name the part ("the lime green 2x4 plate") instead of saying "it" or "that".
- Never invent numbers: step numbers, counts and sizes only when they're in the context or clearly visible.
- One step at a time. Give the next action, then stop. Don't list several steps at once.
- Plain words. No markdown, lists, emoji, or symbols. Say numbers the way you'd say them.
- If there is a safety risk (tipping furniture, wall anchors, power tools, sharp edges, heavy lifting, small parts near young children), say the warning first.
- You may get a photo from their camera. Describe pieces by color, size and shape. If the photo is blurry, dark, or doesn't show what you need, say so and ask them to move closer or show a specific part. Don't guess.
- Use the current step from the manual when it's given. If what you see doesn't match it, say what's off and how to fix it.
- Be warm and calm, like a patient senior colleague.`;

const JSON_RULES = `

Reply with ONE JSON object and nothing else, with "transcript" first:
{"transcript": "what you say aloud", "action": "none" | "next" | "prev" | "goto" | "add_substeps", "goto_step": 5, "substeps": ["..."]}
- transcript: follows all the speaking rules above.
- action "next" / "prev": they want to move on / go back a step. Transcript: a few words ("Moving on.").
- action "goto" with goto_step: they asked for a specific step number. Only a number they said; never guess one.
- action "add_substeps" with 2 to 6 substeps: whenever they say they're stuck, lost or confused, or ask for help
  with this step ("I'm stuck", "I don't get it", "help", "break it down", "this is confusing"). Don't ask a question
  first: break the current step into small physical actions right away, at most 12 words each, naming the parts.
  Transcript: say the first one and that the smaller steps are on screen.
- Otherwise "none". Leave out goto_step and substeps unless the action needs them.`;

function context(req: AssistRequest): string {
  const lines: string[] = [];
  if (req.manual) lines.push(`Building: ${req.manual}.`);
  if (req.step) {
    lines.push(`Current manual step ${req.step.number}: ${req.step.instruction}`);
    if (req.step.parts?.length) lines.push(`Parts for this step: ${req.step.parts.join(", ")}.`);
    if (req.step.selectedPart) lines.push(`They tapped this part on screen, so "this piece" likely means: ${req.step.selectedPart}.`);
    if (req.step.watchFor?.length) lines.push(`Common mistakes here: ${req.step.watchFor.join("; ")}.`);
  }
  return lines.join("\n");
}

function readHistory(value: unknown): { role: "user" | "assistant"; text: string }[] {
  if (!Array.isArray(value)) return [];
  const out: { role: "user" | "assistant"; text: string }[] = [];
  for (const turn of value) {
    if (!turn || typeof turn !== "object") continue;
    const role = (turn as { role?: unknown }).role;
    const text = asText((turn as { text?: unknown }).text, 2000);
    if ((role === "user" || role === "assistant") && text) out.push({ role, text });
  }
  return out.slice(-MAX_TURNS);
}

function readStep(value: AssistRequest["step"]): AssistRequest["step"] {
  if (!value || typeof value !== "object") return undefined;
  const number = typeof value.number === "number" && Number.isFinite(value.number) ? value.number : asText(value.number, 40);
  const instruction = asText(value.instruction, 500);
  if (number === "" || !instruction) return undefined;
  return {
    number,
    instruction,
    parts: Array.isArray(value.parts) ? value.parts.filter((p): p is string => typeof p === "string").slice(0, 24).map((p) => p.slice(0, 80)) : undefined,
    watchFor: Array.isArray(value.watchFor) ? value.watchFor.filter((p): p is string => typeof p === "string").slice(0, 8).map((p) => p.slice(0, 200)) : undefined,
    selectedPart: asText(value.selectedPart, 120) || undefined,
  };
}

async function post(request: Request) {
  let body: AssistRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const question = asText(body.question, 2000);
  if (!question) return Response.json({ error: "No question heard." }, { status: 400 });
  if (body.frame !== undefined && body.frame !== "" && !asImage(body.frame, MAX_IMAGE_CHARS)) {
    return Response.json({ error: "Send `frame` as a JPEG, PNG, GIF, or WebP data URL." }, { status: 400 });
  }
  const frame = asImage(body.frame, MAX_IMAGE_CHARS) ?? undefined;
  body = { ...body, question, history: readHistory(body.history), manual: asText(body.manual, 200) || undefined, step: readStep(body.step), frame };

  const ctx = context(body);
  const json = body.format === "json";
  const turns: Turn[] = [
    // In JSON mode, earlier answers go back as JSON too: plain-text examples make the model answer in prose and
    // then add the JSON, which the app would show and speak twice.
    ...(body.history ?? [])
      .slice(-MAX_TURNS)
      .filter((t) => t.text?.trim())
      .map((t) => (json && t.role === "assistant" ? { ...t, text: JSON.stringify({ transcript: t.text, action: "none" }) } : t)),
    {
      role: "user",
      text: `${ctx ? `${ctx}\n\n` : ""}${frame ? "Camera photo attached. " : "No camera photo this time. "}They said: "${question}"`,
      image: frame,
    },
  ];
  // History must start with the user.
  while (turns.length && turns[0].role !== "user") turns.shift();

  const chunks = streamClaude(json ? SYSTEM_PROMPT + JSON_RULES : SYSTEM_PROMPT, turns);

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

export const POST = guard("assist", post);
