// Rate limit, body size, JSON errors, and the manual-host allowlist. No network.
import { guard } from "../src/lib/apiGuard.ts";
import { ikeaManualPath, isAllowedManualUrl, isIkeaSearchUrl, isSafeManualPdfPath } from "../src/lib/hosts.ts";
import { resetLimitsForTests, takeToken } from "../src/lib/rateLimit.ts";
import { resetSpendForTests } from "../src/lib/spend.ts";

let failed = 0;
function assert(cond, message) {
  if (!cond) {
    failed++;
    console.error("FAIL", message);
  }
}

const limit = { capacity: 3, refillPerSec: 1 };
const t0 = 1_000_000;

// Burst: three succeed, the fourth is refused, Retry-After is at least 1s.
{
  const store = new Map();
  assert(takeToken(store, "a", limit, t0).ok, "burst 1");
  assert(takeToken(store, "a", limit, t0).ok, "burst 2");
  assert(takeToken(store, "a", limit, t0).ok, "burst 3");
  const denied = takeToken(store, "a", limit, t0);
  assert(!denied.ok && denied.retryAfterSec >= 1, `burst denied (${denied.retryAfterSec})`);
}

// Refill: one second later a single token is available.
{
  const store = new Map();
  for (let i = 0; i < 3; i++) takeToken(store, "a", limit, t0);
  assert(!takeToken(store, "a", limit, t0).ok, "still empty before refill");
  assert(takeToken(store, "a", limit, t0 + 1000).ok, "one token after 1s");
  assert(!takeToken(store, "a", limit, t0 + 1000).ok, "no second token yet");
}

// Per-key isolation (IP + route is the key the guard uses).
{
  const store = new Map();
  for (let i = 0; i < 3; i++) takeToken(store, "1.1.1.1\nsearch", limit, t0);
  assert(!takeToken(store, "1.1.1.1\nsearch", limit, t0).ok, "same ip exhausted");
  assert(takeToken(store, "2.2.2.2\nsearch", limit, t0).ok, "other ip has its own bucket");
  assert(takeToken(store, "1.1.1.1\ncheck", limit, t0).ok, "other route has its own bucket");
}

// Stale keys are dropped, and the store stays bounded.
{
  const store = new Map();
  const staleMs = 1000;
  assert(takeToken(store, "old", { capacity: 1, refillPerSec: 0.01 }, 0, 10, staleMs).ok, "first token");
  assert(!takeToken(store, "old", { capacity: 1, refillPerSec: 0.01 }, 10, 10, staleMs).ok, "fresh empty bucket stays empty");
  // The deny above touches the bucket, so it goes stale only after another full window.
  assert(takeToken(store, "old", { capacity: 1, refillPerSec: 0.01 }, 10 + staleMs + 1, 10, staleMs).ok, "stale key is evicted and starts full");

  const bounded = new Map();
  for (let i = 0; i < 6; i++) takeToken(bounded, `k${i}`, { capacity: 1, refillPerSec: 1 }, t0 + i, 3);
  assert(bounded.size <= 3, `store size ${bounded.size} stayed <= 3`);
  // k0 was the oldest and was evicted, so it is a new full bucket (a survivor would still be empty: 0.1s is not a token).
  assert(takeToken(bounded, "k0", { capacity: 1, refillPerSec: 1 }, t0 + 100, 3).ok, "evicted key can burst again");
}

resetLimitsForTests();
resetSpendForTests();
delete process.env.DAILY_CLAUDE_CALL_LIMIT;

const search = guard("search", async () => Response.json({ ok: true }));
function searchReq(ip) {
  return new Request("http://localhost/api/search?q=a", { headers: { "x-forwarded-for": `${ip}, 10.0.0.1` } });
}

let saw429 = false;
let retry = "";
for (let i = 0; i < 40; i++) {
  const res = await search(searchReq("9.9.9.9"));
  if (res.status === 429) {
    saw429 = true;
    retry = res.headers.get("Retry-After") ?? "";
    break;
  }
  assert(res.status === 200, `search before the cap was ${res.status}`);
}
assert(saw429, "40 fast requests produced a 429");
assert(Number(retry) >= 1, `Retry-After was ${retry}`);

// A different IP is not blocked by that burst.
{
  const res = await search(searchReq("8.8.8.8"));
  assert(res.status === 200, `other ip status ${res.status}`);
}

// After the window, the limited IP can try again. Refill is 1 token/sec and Retry-After is the wait.
{
  const wait = Number(retry) * 1000 + 50;
  const realNow = Date.now;
  const start = realNow();
  Date.now = () => start + wait;
  try {
    const res = await search(searchReq("9.9.9.9"));
    assert(res.status === 200, `after the window status ${res.status}`);
  } finally {
    Date.now = realNow;
  }
}

const tts = guard("tts", async (request) => {
  const body = await request.json();
  return Response.json({ heard: body.text });
});
function ttsReq(body, ip, extraHeaders) {
  return new Request("http://localhost/api/tts", {
    method: "POST",
    body,
    headers: { "content-type": "application/json", "x-forwarded-for": ip, ...extraHeaders },
  });
}

{
  const res = await tts(ttsReq("{", "3.3.3.3"));
  assert(res.status === 400, `bad json ${res.status}`);
  const payload = await res.json();
  assert(payload.error === "Body must be JSON.", `bad json body ${payload.error}`);
}

{
  const res = await tts(ttsReq("   ", "3.3.3.4"));
  assert(res.status === 400, `blank body ${res.status}`);
}

{
  const big = `{"text":"${"a".repeat(70 * 1024)}"}`;
  const res = await tts(ttsReq(big, "3.3.3.5"));
  assert(res.status === 413, `oversize body ${res.status}`);
}

{
  const res = await tts(ttsReq('{"text":"hi"}', "3.3.3.6", { "content-length": String(9 * 1024 * 1024) }));
  assert(res.status === 413, `declared content-length ${res.status}`);
}

{
  const res = await tts(ttsReq('{"text":"hi"}', "3.3.3.7"));
  assert(res.status === 200, `small tts reached the handler (${res.status})`);
  const payload = await res.json();
  assert(payload.heard === "hi", "handler saw the parsed text");
}

// Daily ceiling: well-formed Claude-route requests, off by default, 429 once exceeded.
{
  let calls = 0;
  const check = guard("check", async () => {
    calls++;
    return Response.json({ ok: true });
  });
  const body = JSON.stringify({ frame: "data:image/jpeg;base64," + "A".repeat(40) });
  const once = (ip) =>
    new Request("http://localhost/api/check", {
      method: "POST",
      body,
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
    });
  process.env.DAILY_CLAUDE_CALL_LIMIT = "1";
  resetSpendForTests();
  const first = await check(once("4.4.4.1"));
  const second = await check(once("4.4.4.2"));
  assert(first.status === 200 && calls === 1, `first claude request ${first.status} calls=${calls}`);
  assert(second.status === 429 && calls === 1, `ceiling blocked the handler (${second.status}, calls=${calls})`);
  assert(second.headers.get("Retry-After"), "ceiling sets Retry-After");
  const msg = await second.json();
  assert(!JSON.stringify(msg).includes("sk-"), "ceiling error has no key");
  delete process.env.DAILY_CLAUDE_CALL_LIMIT;
  resetSpendForTests();
}

// Host allowlist.
assert(isAllowedManualUrl("https://www.lego.com/cdn/product-assets/product.bi.core.pdf/1.pdf"), "lego pdf");
assert(isAllowedManualUrl("https://www.ikea.com/us/en/assembly_instructions/x.pdf"), "ikea pdf");
assert(!isAllowedManualUrl("https://evil.com/x.pdf"), "reject other host");
assert(!isAllowedManualUrl("https://www.lego.com.evil.com/x.pdf"), "reject lookalike host");
assert(!isAllowedManualUrl("https://user:pass@www.lego.com/x.pdf"), "reject userinfo");
assert(!isAllowedManualUrl("http://www.lego.com/x.pdf"), "reject http");
assert(!isAllowedManualUrl("https://www.ikea.com.evil.com/x.pdf"), "reject ikea lookalike");
assert(!isAllowedManualUrl("not a url"), "reject junk");
assert(isIkeaSearchUrl("https://sik.search.blue.cdtapps.com/us/en/search-result-page?q=kallax"), "fixed ikea search host");
assert(!isIkeaSearchUrl("https://sik.search.blue.cdtapps.com.evil.com/"), "search host is exact");
assert(!isAllowedManualUrl("https://sik.search.blue.cdtapps.com/us/en/search-result-page"), "search host is not a manual host");

assert(isSafeManualPdfPath("/manual-pdf/lego/6455750.pdf"), "lego path");
assert(!isSafeManualPdfPath("/manual-pdf/lego/../../etc/passwd"), "lego traversal");
assert(!isSafeManualPdfPath("/manual-pdf/lego/notes.txt"), "lego non-pdf");
assert(!isSafeManualPdfPath("/manual-pdf/evil/1.pdf"), "unknown manual host path");
const ikea = "/manual-pdf/ikea/us/en/assembly_instructions/kallax-shelf-unit-white__AA-2703433-1-100.pdf";
assert(isSafeManualPdfPath(ikea), "ikea assembly pdf");
assert(!isSafeManualPdfPath("/manual-pdf/ikea/us/en/p/kallax/"), "ikea html page");
assert(!isSafeManualPdfPath("/manual-pdf/ikea/us/en/assembly_instructions/../../secret.pdf"), "ikea traversal");
assert(
  ikeaManualPath("https://www.ikea.com/us/en/assembly_instructions/kallax-shelf-unit-white__AA-2703433-1-100.pdf") === ikea,
  "ikea url becomes a safe path",
);
assert(ikeaManualPath("https://evil.com/us/en/assembly_instructions/x.pdf") === null, "other host pdf rejected");

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log("api guard tests passed");
