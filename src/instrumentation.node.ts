// Application Insights for the Azure deployment (Container Apps). Next.js already emits OpenTelemetry spans:
// one per incoming request ("POST /api/check") and one per server-side fetch (Claude, Cartesia, Azure Speech).
// Azure Monitor exports them as requests and dependencies, plus Live Metrics for a real-time dashboard.
// The connection string comes from a Container App secret (APPLICATIONINSIGHTS_CONNECTION_STRING).
import { useAzureMonitor as startAzureMonitor } from "@azure/monitor-opentelemetry";

process.env.OTEL_SERVICE_NAME ??= "buildsight"; // the "cloud role" name shown on the dashboard

startAzureMonitor({
  azureMonitorExporterOptions: { connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING },
  enableLiveMetrics: true,
  // Keep everything (a demo's worth of traffic). tracesPerSecond defaults to 5, a rate limit that overrides
  // samplingRatio and silently drops request traces in bursts; 0 turns it off.
  samplingRatio: 1,
  tracesPerSecond: 0,
  // Next.js's own spans already cover incoming requests and fetch calls; the package's HTTP hooks would count them twice.
  instrumentationOptions: { http: { enabled: false } },
});
