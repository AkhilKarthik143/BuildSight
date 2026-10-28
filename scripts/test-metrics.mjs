// Request metrics stay off unless Application Insights is configured. No exporter, no network.
import { bindApiMetrics, installApiRecorder, recordApiRequest } from "../src/lib/metrics.ts";

const saved = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
let failed = 0;
function check(name, ok) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
let called = false;
installApiRecorder(() => {
  called = true;
});
recordApiRequest("check", 200, 5);
check("no-op without the connection string", called === false);

process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = "InstrumentationKey=local-test";
const seen = [];
installApiRecorder(
  bindApiMetrics(
    { add: (value, attributes) => seen.push(["add", value, attributes]) },
    { record: (value, attributes) => seen.push(["record", value, attributes]) },
  ),
);
recordApiRequest("check", 429, 12);
recordApiRequest("x".repeat(80), 200, Number.NaN);
check("counter", seen[0]?.[0] === "add" && seen[0][1] === 1 && seen[0][2].route === "check" && seen[0][2].status === "429");
check("latency", seen[1]?.[0] === "record" && seen[1][1] === 12 && seen[1][2].route === "check" && !("status" in seen[1][2]));
check("route name is bounded", seen[2]?.[2].route.length === 40);
check("bad latency is zero", seen[3]?.[1] === 0);

if (saved === undefined) delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
else process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = saved;
installApiRecorder(() => {});

console.log(failed ? `\n${failed} failed` : "\nmetrics tests passed");
if (failed) process.exit(1);
