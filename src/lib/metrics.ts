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

type CounterLike = { add(value: number, attributes: Record<string, string>): void };
type HistogramLike = { record(value: number, attributes: Record<string, string>): void };

/** The recorder installed when Application Insights is on. Attributes stay short and contain no request bodies. */
export function bindApiMetrics(requests: CounterLike, latency: HistogramLike): ApiRecorder {
  return (route, status, ms) => {
    const name = route.slice(0, 40);
    requests.add(1, { route: name, status: String(status) });
    latency.record(Number.isFinite(ms) && ms > 0 ? ms : 0, { route: name });
  };
}
