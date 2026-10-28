// Request counters. A no-op unless Application Insights was started, which only happens when
// APPLICATIONINSIGHTS_CONNECTION_STRING is set (see src/instrumentation.ts). The recorder is
// installed from src/instrumentation.node.ts onto this process.

export type ApiRecorder = (route: string, status: number, ms: number) => void;

type MetricsGlobal = typeof globalThis & { __buildsightRecordApi?: ApiRecorder };
const root = globalThis as MetricsGlobal;

export function recordApiRequest(route: string, status: number, ms: number) {
  if (!process.env.APPLICATIONINSIGHTS_CONNECTION_STRING?.trim()) return;
  root.__buildsightRecordApi?.(route, status, ms);
}

export function installApiRecorder(recorder: ApiRecorder) {
  root.__buildsightRecordApi = recorder;
}
