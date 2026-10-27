import { apiRateLimiter, clientIp, type ApiRoute } from "./rateLimit.ts";
import { validApiInput } from "./apiInput.ts";

export const BODY_LIMITS: Record<ApiRoute, number> = {
  check: 12 * 1024 * 1024, "where-am-i": 12 * 1024 * 1024,
  extract: 8 * 1024 * 1024, locate: 8 * 1024 * 1024,
  assist: 8 * 1024 * 1024, vision: 8 * 1024 * 1024,
  tts: 64 * 1024, search: 1024, "speech-token": 1024,
};
export class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function readLimitedJson(request: Request, maxBytes: number): Promise<unknown> {
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) throw new InputError("Request body too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("Body must be JSON.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { reject(new InputError("Request body timed out.", 408)); void reader.cancel().catch(() => {}); }, 10_000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), timeout]);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { void reader.cancel().catch(() => {}); throw new InputError("Request body too large.", 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new InputError("Body must be JSON."); }
  } finally { clearTimeout(timer); reader.releaseLock(); }
}

type Handler = (request: Request) => Response | Promise<Response>;
export function withApiGuard(route: ApiRoute, handler: Handler): Handler {
  return async request => {
    const quota = apiRateLimiter.take(clientIp(request), route);
    if (!quota.ok) return Response.json({ error: "Too many requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(quota.retryAfterSec), "Cache-Control": "no-store" } });
    try {
      if (request.method !== "GET" && request.method !== "HEAD") {
        const body = await readLimitedJson(request, BODY_LIMITS[route]);
        if (!validApiInput(route, body)) throw new InputError("Invalid request fields.");
        // The route keeps its existing Request API; its second parse is over this bounded, validated body.
        const headers = new Headers(request.headers);
        headers.delete("content-length"); headers.set("content-type", "application/json");
        request = new Request(request.url, { method: request.method, headers, body: JSON.stringify(body), signal: request.signal });
      } else if (Number(request.headers.get("content-length") ?? 0) > BODY_LIMITS[route]) {
        throw new InputError("Request body too large.", 413);
      }
      return await handler(request);
    } catch (error) {
      return Response.json({ error: error instanceof InputError ? error.message : "Request failed. Try again." }, { status: error instanceof InputError ? error.status : 502 });
    }
  };
}
