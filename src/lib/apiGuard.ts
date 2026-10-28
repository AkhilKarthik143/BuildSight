// One wrapper for every API route: rate limit, body size, JSON, then the daily Claude ceiling.
// Success responses are whatever the route returns. Failures here are only 429, 413, and 400,
// and they never include an upstream body or a key.

import { recordApiRequest } from "./metrics.ts";
import { CLAUDE_ROUTES, clientIp, consume, type RouteId } from "./rateLimit.ts";
import { chargeClaudeCall, secondsUntilUtcMidnight } from "./spend.ts";

const MB = 1024 * 1024;

/** Frame routes can carry a few JPEGs. Text routes stay small. */
export const BODY_LIMITS: Record<RouteId, number> = {
  "speech-token": 64 * 1024,
  search: 64 * 1024,
  pair: 64 * 1024,
  "pair-events": 64 * 1024,
  "pair-publish": 8 * MB,
  check: 8 * MB,
  assist: 8 * MB,
  extract: 8 * MB,
  locate: 8 * MB,
  "where-am-i": 8 * MB,
  vision: 8 * MB,
  tts: 64 * 1024,
};

const JSON_ROUTES: ReadonlySet<RouteId> = new Set([
  "check",
  "assist",
  "extract",
  "locate",
  "where-am-i",
  "vision",
  "tts",
  "pair",
  "pair-publish",
]);

function tooLarge(): Response {
  return Response.json({ error: "Request body is too large." }, { status: 413 });
}

function badJson(): Response {
  return Response.json({ error: "Body must be JSON." }, { status: 400 });
}

export function guard(route: RouteId, handler: (request: Request) => Promise<Response> | Response) {
  return async (request: Request): Promise<Response> => {
    const started = Date.now();
    const finish = (response: Response): Response => {
      recordApiRequest(route, response.status, Date.now() - started);
      return response;
    };

    const limited = consume(clientIp(request), route);
    if (!limited.ok) {
      return finish(
        Response.json(
          { error: "Too many requests. Try again shortly." },
          { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
        ),
      );
    }

    const max = BODY_LIMITS[route];
    const declared = Number(request.headers.get("content-length") ?? "");
    if (Number.isFinite(declared) && declared > max) return finish(tooLarge());

    let next = request;
    if (request.method !== "GET" && request.method !== "HEAD") {
      const buf = await request.arrayBuffer();
      if (buf.byteLength > max) return finish(tooLarge());
      if (JSON_ROUTES.has(route)) {
        const text = new TextDecoder().decode(buf);
        if (!text.trim()) return finish(badJson());
        try {
          JSON.parse(text);
        } catch {
          return finish(badJson());
        }
      }
      next = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: buf,
        signal: request.signal,
      });
    }

    if (CLAUDE_ROUTES.has(route) && !chargeClaudeCall(route)) {
      return finish(
        Response.json(
          { error: "Daily limit reached. Try again tomorrow." },
          { status: 429, headers: { "Retry-After": String(secondsUntilUtcMidnight()) } },
        ),
      );
    }

    try {
      return finish(await handler(next));
    } catch {
      return finish(Response.json({ error: "Request failed." }, { status: 500 }));
    }
  };
}
