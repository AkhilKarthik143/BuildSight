// Per-process token buckets. In production the ingress must overwrite x-forwarded-for.
// These are not authentication, a distributed quota, or a provider spending limit.
import { isIP } from "node:net";

export const RATE_LIMITS = {
  "speech-token": { capacity: 20, refillPerSec: 1 / 3 },
  search: { capacity: 20, refillPerSec: 1 / 3 },
  check: { capacity: 12, refillPerSec: 1 / 4 },
  assist: { capacity: 10, refillPerSec: 1 / 3 },
  extract: { capacity: 30, refillPerSec: 1 },
  locate: { capacity: 24, refillPerSec: 2 },
  "where-am-i": { capacity: 6, refillPerSec: 1 / 10 },
  vision: { capacity: 12, refillPerSec: 1 / 4 },
  tts: { capacity: 30, refillPerSec: 1 },
} as const;
export type ApiRoute = keyof typeof RATE_LIMITS;
type Bucket = { tokens: number; at: number; seen: number };

export function clientIp(request: Request): string {
  const first = request.headers.get("x-forwarded-for")?.split(",", 1)[0].trim();
  return first && isIP(first) ? first : "unknown";
}

export function createRateLimiter(maxKeys = 10_000, staleMs = 600_000) {
  const buckets = new Map<string, Bucket>();
  let swept = 0;
  return {
    get size() { return buckets.size; },
    take(ip: string, route: ApiRoute, now = Date.now()): { ok: boolean; retryAfterSec: number } {
      if (now - swept >= 60_000 || buckets.size >= maxKeys) {
        for (const [key, b] of buckets) if (now - b.seen >= staleMs) buckets.delete(key);
        swept = now;
      }
      const key = `${route}:${ip}`;
      const limits = RATE_LIMITS[route];
      let b = buckets.get(key);
      // Fail closed at the memory bound; never evict an active bucket to bypass its quota.
      if (!b && buckets.size >= maxKeys) return { ok: false, retryAfterSec: Math.ceil(staleMs / 1000) };
      if (!b) { b = { tokens: limits.capacity, at: now, seen: now }; buckets.set(key, b); }
      b.tokens = Math.min(limits.capacity, b.tokens + Math.max(0, now - b.at) / 1000 * limits.refillPerSec);
      b.at = now; b.seen = now;
      if (b.tokens < 1) return { ok: false, retryAfterSec: Math.max(1, Math.ceil((1 - b.tokens) / limits.refillPerSec)) };
      b.tokens--;
      return { ok: true, retryAfterSec: 0 };
    },
  };
}
export const apiRateLimiter = createRateLimiter();
