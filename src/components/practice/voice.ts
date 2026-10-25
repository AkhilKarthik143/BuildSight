// Spoken commands in Practice Mode. "next", "back" and "repeat" use the app's matcher (src/lib/commands.ts);
// "I'm stuck", "rotate" and "restart" are practice-only. Anything else goes to Claude as a question.

import { matchCommand, normalize } from "@/lib/commands";

export type PracticeCommand = "next" | "back" | "repeat" | "stuck" | "rotate" | "restart";

const STUCK = /^(?:im stuck|i am stuck|stuck|im lost|i am lost|help|help me|hint|give me a hint|where does it go|where does this go|where does that go|show me|show me where|i dont know|i dont get it|what goes here|which one|which part)$/;
const ROTATE = /^(?:rotate|rotate it|turn|turn it|turn it around|spin it|flip|flip it|other way|the other way)$/;
const RESTART = /^(?:restart|start over|start again|reset|from the top)$/;

export function matchPractice(text: string): PracticeCommand | null {
  const t = normalize(text);
  if (!t) return null;
  if (STUCK.test(t)) return "stuck";
  if (ROTATE.test(t)) return "rotate";
  if (RESTART.test(t)) return "restart";
  const c = matchCommand(text);
  if (c?.kind === "next" || c?.kind === "back" || c?.kind === "repeat") return c.kind;
  return null;
}
