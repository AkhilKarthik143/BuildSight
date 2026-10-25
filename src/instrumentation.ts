// Next.js calls register() once when the server starts. Telemetry only runs on the Node server
// (the Azure container), and only when an Application Insights connection string is set.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
    await import("./instrumentation.node");
  }
}
