import { spawn } from "node:child_process";
import fs from "node:fs";
import { runBots } from "./bots.mjs";
const port = process.env.SOAK_PORT || "3091";
const url = "http://127.0.0.1:" + port;
fs.mkdirSync("test-results", { recursive: true });
let server = spawn(process.execPath, ["server.mjs"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: port },
  stdio: ["ignore", "pipe", "pipe"],
});
let errors = "";
server.stderr.on("data", (b) => (errors += b));
let metrics = [];
try {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(url + "/metrics");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  let poll = setInterval(async () => {
    try {
      metrics.push(await (await fetch(url + "/metrics")).json());
    } catch {}
  }, 10000);
  let soak = await runBots({
    url: url.replace("http:", "ws:"),
    duration: Number(process.env.SOAK_MS || 600000),
    activeTicks: Number(process.env.SOAK_TICKS || 0),
    metricsUrl: url + "/metrics",
  });
  clearInterval(poll);
  let conditions = [];
  for (let latency of [0, 50, 100, 200]) {
    conditions.push(
      await runBots({
        url: url.replace("http:", "ws:"),
        duration: 10000,
        latency,
        jitter: 20,
        loss: 0.05,
      }),
    );
  }
  let final = await (await fetch(url + "/metrics")).json();
  let result = { soak, conditions, metrics, final, serverErrors: errors };
  fs.writeFileSync(
    process.env.SOAK_OUTPUT || "test-results/soak.json",
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({ soak, conditions, final, serverErrors: errors }, null, 2),
  );
  if (final.avgTickMs >= 4 || soak.errors || errors) process.exitCode = 1;
} finally {
  server.kill();
}
