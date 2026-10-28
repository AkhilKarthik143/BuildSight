// Claude client selection and error scrubbing. fetch is mocked; this file never calls the network.
// The host strings below are the mock's allowlist, not live requests.
import { askClaude, resetClaudeForTests } from "../src/lib/claude.ts";

const ANTHROPIC = "sk-ant-test-DO-NOT-LEAK";
const OPENROUTER = "sk-or-test-DO-NOT-LEAK";
const savedFetch = globalThis.fetch;
const savedAnthropic = process.env.ANTHROPIC_API_KEY;
const savedOpenRouter = process.env.OPENROUTER_API_KEY;

let failed = 0;
function check(name, ok) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

function restoreEnv() {
  if (savedAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedAnthropic;
  if (savedOpenRouter === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = savedOpenRouter;
  globalThis.fetch = savedFetch;
  resetClaudeForTests();
}

function message(text) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 3, output_tokens: 4 },
  };
}

/**
 * @param {(url: string, body: unknown) => { status?: number, json: unknown }} reply
 */
function install(reply) {
  const calls = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const raw = init?.body ?? (typeof input !== "string" && !(input instanceof URL) ? input.body : undefined);
    const body = typeof raw === "string" ? JSON.parse(raw) : null;
    calls.push({ url, body });
    if (!url.includes("api.anthropic.com") && !url.includes("openrouter.ai")) {
      throw new Error(`unmocked host ${url}`);
    }
    const out = reply(url, body);
    return new Response(JSON.stringify(out.json), {
      status: out.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
  return calls;
}

function noTemperature(body) {
  return body != null && !Object.prototype.hasOwnProperty.call(body, "temperature");
}

function leaked(err) {
  const text = `${err?.message ?? ""} ${err?.stack ?? ""}`;
  return text.includes(ANTHROPIC) || text.includes(OPENROUTER) || text.includes("DO-NOT-LEAK");
}

async function main() {
  resetClaudeForTests();
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENROUTER_API_KEY;

  let threw = false;
  try {
    await askClaude({ system: "s", parts: [{ type: "text", text: "hi" }] });
  } catch (e) {
    threw = true;
    check("missing key does not echo a key", !leaked(e) && /No Claude key/.test(e.message));
  }
  check("missing key throws", threw);

  process.env.OPENROUTER_API_KEY = OPENROUTER;
  delete process.env.ANTHROPIC_API_KEY;
  resetClaudeForTests();
  const openCalls = install(() => ({ json: { choices: [{ message: { content: "from openrouter" } }] } }));
  const openText = await askClaude({ system: "s", parts: [{ type: "text", text: "hi" }] });
  check("openrouter selected when it is the only key", openCalls.length === 1 && openCalls[0].url.includes("openrouter.ai") && openText === "from openrouter");
  check("openrouter body has no temperature", noTemperature(openCalls[0].body));

  process.env.ANTHROPIC_API_KEY = ANTHROPIC;
  process.env.OPENROUTER_API_KEY = OPENROUTER;
  resetClaudeForTests();
  const both = install((url) => {
    if (url.includes("openrouter.ai")) return { json: { choices: [{ message: { content: "wrong" } }] } };
    return { json: message("from anthropic") };
  });
  const anthText = await askClaude({ system: "s", parts: [{ type: "text", text: "hi" }] });
  check("anthropic wins when both keys are set", both.length === 1 && both[0].url.includes("api.anthropic.com") && anthText === "from anthropic");
  check("anthropic body has no temperature", noTemperature(both[0].body));

  resetClaudeForTests();
  install(() => ({ status: 500, json: { error: { message: `upstream said ${ANTHROPIC}` } } }));
  try {
    await askClaude({ system: "s", parts: [{ type: "text", text: "hi" }] });
    check("anthropic error throws", false);
  } catch (e) {
    check("anthropic error throws", true);
    check("anthropic error hides the key", !leaked(e) && !/upstream said/.test(e.message));
  }

  delete process.env.ANTHROPIC_API_KEY;
  process.env.OPENROUTER_API_KEY = OPENROUTER;
  resetClaudeForTests();
  install(() => ({ status: 502, json: { error: OPENROUTER } }));
  try {
    await askClaude({ system: "s", parts: [{ type: "text", text: "hi" }] });
    check("openrouter error throws", false);
  } catch (e) {
    check("openrouter error throws", true);
    check("openrouter error hides the key", !leaked(e) && e.message === "OpenRouter request failed.");
  }

  console.log(failed ? `\n${failed} failed` : "\nclaude tests passed");
  restoreEnv();
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  restoreEnv();
  process.exit(1);
});
