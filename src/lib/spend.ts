// Optional per-process ceiling on Claude routes. Unset, blank, or 0 means off.
// The counter is memory in this process and resets at UTC midnight (and on restart).

import { CLAUDE_ROUTES, type RouteId } from "./rateLimit.ts";

type Spend = { day: string; count: number };
type SpendGlobal = typeof globalThis & { __buildsightSpend?: Spend };
const root = globalThis as SpendGlobal;

function state(): Spend {
  root.__buildsightSpend ??= { day: "", count: 0 };
  return root.__buildsightSpend;
}

export function utcDay(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Positive integer ceiling, or null when the env var is off. */
export function dailyClaudeLimit(): number | null {
  const raw = process.env.DAILY_CLAUDE_CALL_LIMIT?.trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export function secondsUntilUtcMidnight(now = Date.now()): number {
  const next = Date.parse(`${utcDay(now)}T00:00:00.000Z`) + 24 * 60 * 60 * 1000;
  return Math.max(1, Math.ceil((next - now) / 1000));
}

/**
 * Count one well-formed request to a Claude route.
 * Returns false when the ceiling is on and already reached (the caller should respond 429).
 */
export function chargeClaudeCall(route: RouteId, now = Date.now()): boolean {
  if (!CLAUDE_ROUTES.has(route)) return true;
  const limit = dailyClaudeLimit();
  if (limit == null) return true;
  const spend = state();
  const day = utcDay(now);
  if (spend.day !== day) {
    spend.day = day;
    spend.count = 0;
  }
  if (spend.count >= limit) return false;
  spend.count += 1;
  return true;
}

export function resetSpendForTests() {
  const spend = state();
  spend.day = "";
  spend.count = 0;
}
