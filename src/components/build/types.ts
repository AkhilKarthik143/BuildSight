import type { CheckResult } from "@/app/api/check/route";

export const MAX_PARTS = 6;

export type Phase = { kind: "loading"; label: string } | { kind: "ready" } | { kind: "error"; message: string } | { kind: "done" };
export type Check = { state: "checking"; auto?: boolean } | { state: "result"; result: CheckResult; frame: string; id: number; sample: Uint8ClampedArray | null } | { state: "error"; message: string };
// A pending move to the next step after a pass. `id` is the check it came from: it lives only while that result is on
// screen for this step, so a step change, a new check or dismissing the result drops it. `started` once the countdown runs.
export type Advance = { id: number; delay: number; waitForVoice: boolean; started: boolean };
