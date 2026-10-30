import { isIP } from "node:net";
// In-memory token bucket, keyed by client IP and route.
// One Node process only: a restart or a second instance has its own buckets.
// The IP is the first x-forwarded-for hop. That hop is whatever the edge proxy put there;
// this is a per-instance brake, not a proof of identity.

export type Limit = { capacity: number; refillPerSec: number };

export type RouteId =
  | "speech-token"
  | "search"
  | "check"
  | "assist"
  | "extract"
  | "locate"
  | "where-am-i"
  | "vision"
  | "tts"
  | "pair"
  | "pair-publish"
  | "pair-events";

// Cheap routes are polled or searched. Expensive routes call Claude, Cartesia, or Azure.
export const ROUTE_LIMITS: Record<RouteId, Limit> = {
  "speech-token": { capacity: 20, refillPerSec: 1 / 3 },
  search: { capacity: 20, refillPerSec: 1 / 3 },
  pair: { capacity: 20, refillPerSec: 1 },
  "pair-events": { capacity: 20, refillPerSec: 1 },
  "pair-publish": { capacity: 30, refillPerSec: 10 },
  check: { capacity: 12, refillPerSec: 1 / 4 },
  assist: { capacity: 10, refillPerSec: 1 / 3 },
  extract: { capacity: 30, refillPerSec: 1 },
  locate: { capacity: 24, refillPerSec: 2 },
  "where-am-i": { capacity: 6, refillPerSec: 1 / 10 },
  vision: { capacity: 12, refillPerSec: 1 / 4 },
  tts: { capacity: 30, refillPerSec: 1 },
};
export const RATE_LIMITS = ROUTE_LIMITS;
export type ApiRoute = RouteId;

export const CLAUDE_ROUTES: ReadonlySet<RouteId> = new Set(["check", "assist", "extract", "locate", "where-am-i", "vision"]);

export type Bucket = { tokens: number; updated: number };
export type LimitStore = Map<string, Bucket>;

export const STALE_MS = 10 * 60 * 1000;
export const MAX_KEYS = 2000;

export function clientIp(request: Request): string {
  const raw = request.headers.get("x-forwarded-for");
  if (raw) {
    const hop = raw.split(",")[0]?.trim();
    if (hop && isIP(hop)) return hop;
  }
  return "unknown";
}

/** Drop only stale entries; active quotas must never be evicted to admit a new IP. */
export function evict(store: LimitStore, now: number, _maxKeys: number, staleMs = STALE_MS) {
  for (const [key, bucket] of store) if (now - bucket.updated >= staleMs) store.delete(key);
}

/**
 * Refill from elapsed time, then take one token.
 * `retryAfterSec` is at least 1 when the bucket cannot pay, so Retry-After is a real delay.
 */
export function takeToken(
  store: LimitStore,
  key: string,
  limit: Limit,
  now: number,
  maxKeys = MAX_KEYS,
  staleMs = STALE_MS,
): { ok: boolean; retryAfterSec: number } {
  evict(store, now, store.has(key) ? maxKeys + 1 : maxKeys, staleMs);
  let bucket = store.get(key);
  if (!bucket && store.size >= maxKeys) return { ok: false, retryAfterSec: Math.max(1, Math.ceil(staleMs / 1000)) };
  if (!bucket) {
    bucket = { tokens: limit.capacity, updated: now };
    store.set(key, bucket);
  }
  const elapsedSec = Math.max(0, now - bucket.updated) / 1000;
  bucket.tokens = Math.min(limit.capacity, bucket.tokens + elapsedSec * limit.refillPerSec);
  bucket.updated = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { ok: true, retryAfterSec: 0 };
  }
  const missing = 1 - bucket.tokens;
  const retryAfterSec = Math.max(1, Math.ceil(missing / limit.refillPerSec));
  return { ok: false, retryAfterSec };
}

type RateGlobal = typeof globalThis & { __buildsightBuckets?: LimitStore };
const root = globalThis as RateGlobal;

function buckets(): LimitStore {
  root.__buildsightBuckets ??= new Map();
  return root.__buildsightBuckets;
}

export function consume(ip: string, route: RouteId, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  return takeToken(buckets(), `${ip}\n${route}`, ROUTE_LIMITS[route], now);
}

export function resetLimitsForTests() {
  buckets().clear();
}

export function createRateLimiter(maxKeys = MAX_KEYS, staleMs = STALE_MS) {
  const store: LimitStore = new Map();
  return {
    get size() { return store.size; },
    take(ip: string, route: RouteId, now = Date.now()) {
      return takeToken(store, `${ip}\n${route}`, ROUTE_LIMITS[route], now, maxKeys, staleMs);
    },
  };
}
export const apiRateLimiter = { take: consume };
