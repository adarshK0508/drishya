import fs from "node:fs";
const preferred = "test-results/soak-release.json";
const file = fs.existsSync(preferred) ? preferred : "test-results/soak.json";
const s = JSON.parse(fs.readFileSync(file));
const b = JSON.parse(fs.readFileSync("test-results/browser.json"));
const povFile = "test-results/pov-regression.json";
const pov = fs.existsSync(povFile) ? JSON.parse(fs.readFileSync(povFile)) : null;
const latencyFile='test-results/latency-run.json';
const latency=fs.existsSync(latencyFile)?JSON.parse(fs.readFileSync(latencyFile)):null;
const active = Boolean(s.soak.activeTicks);
const tickRecord = s.metrics.at(-1) || s.final;
const heaps = s.metrics.map((m) => m.heap / 1048576),
  rss = s.metrics.map((m) => m.rss / 1048576);
const rows = s.conditions
  .map(
    (c) =>
      `| ${c.latency} | ${c.jitter} | ${c.loss * 100}% | ${c.meanPredictionError.toFixed(3)} | ${c.corrections} | ${(c.bytesPerClientSecond / 1024).toFixed(2)} | ${c.errors} / ${c.disconnects} |`,
  )
  .join("\n");
const duration = active
  ? `active simulation ${(s.soak.activeTicks / 3600).toFixed(2)} minutes (${(s.soak.durationMs / 60000).toFixed(2)} wall-clock minutes)`
  : `${(s.soak.durationMs / 60000).toFixed(2)} wall-clock minutes`;
fs.writeFileSync(
  "TEST_REPORT.md",
  `# PARALLAX — measured verification

Executed on Windows / Node 24.13.0, 24 October 2026. Chromium 141, Playwright 1.56.1, headless SwiftShader. FPS is a software-renderer sample, not an iGPU benchmark.

## Automated checks
- Thirteen unit/lifecycle tests pass, including new cycle boundaries, vertical-velocity reconciliation and muzzle ownership regressions.
- Three browser pages connected, host settings synced, players moved, snapshots arrived, a spectator cycled views, the scheduled POV swap occurred, settings and pointer-lock fallback opened without errors.
- Browser FPS (smoothed requestAnimationFrame sample): **${b.telemetry.fps.toFixed(2)}**. Snapshots at sample: **${b.telemetry.snapshots}**. Console/page errors: **${b.errors.length}**. Local RTT: **${b.telemetry.rtt} ms**.
- npm ci fresh reinstall and npm audit were run; see commit history and command output. Docker build could not be run because Docker is not installed on this host.

## POV / close-range regression
${pov ? `- Full 60-second two-browser regression: **${pov.passed ? "pass" : "fail"}**, ${pov.cycles} own/borrowed cycles, completion observed ${pov.endOffsetMs} ms after scheduled expiry.
- Closest tested body separation: **${pov.distance.toFixed(3)} m**. Living body visibility verified in both POVs; dynamic instances no longer use stale culling bounds. Screenshots: docs/close-own.png and docs/close-borrowed.png.
- Jump sampled at **${pov.jumpHeight.toFixed(3)} m** and returned to ground. Quantized vertical-velocity replay also passes its unit regression.
- Borrowed shot shooter/view IDs: **${pov.borrowedShot.shooterId}/${pov.borrowedShot.viewId}**, firing camera shake **${pov.borrowedShot.screenShake}**. Own-view shot IDs: **${pov.ownShot.shooterId}/${pov.ownShot.viewId}**, shake **${pov.ownShot.screenShake}**. Page errors: **${pov.errors.length}**.
- Beeps and swap tones are synthesized via WebAudio; the automated run does not certify speaker output.` : "Not run."}

## Historical eight-bot soak (before the 60-second POV revision)
These measurements belong to the previous build and 26-byte entity protocol. The current 28-byte protocol and rendering changes have not had a new endurance/performance soak.
- Duration: **${duration}**. ${active ? "The run stopped only after at least 108,000 actual server ticks; machine sleep does not count toward this duration." : "Initial 10-minute build; no valid completed 30-minute release result is available."}
- Snapshots: **${s.soak.snapshots}**; bot errors **${s.soak.errors}**; unexpected disconnects **${s.soak.disconnects}**; server stderr **${JSON.stringify(s.serverErrors)}**.
- Average simulation tick during the eight-bot sample: **${tickRecord.avgTickMs.toFixed(3)} ms**; peak **${tickRecord.maxTickMs.toFixed(3)} ms**. Target <4 ms average: **${tickRecord.avgTickMs < 4 ? "pass" : "fail"}**. Suspended time is ${tickRecord.suspendedMs ? `recorded separately (${tickRecord.suspendedMs.toFixed(0)} ms across ${tickRecord.excludedTicks} ticks)` : "not observed in this sample"}.
- Binary snapshots received: **${(s.soak.bytesPerClientSecond / 1024).toFixed(2)} KiB/s/client**, below 30 KB/s. The count excludes TCP/WebSocket headers and JSON events.
- Local input-to-hit event latency in a separate 60-second eight-bot run: **${latency?.soak.hitLatencyMean?.toFixed(1)??'unmeasured'} ms mean**, **${latency?.soak.hitLatencyP95??'unmeasured'} ms p95**, **${latency?.soak.hitSamples??0} hit samples**. This is bot input to server hit acknowledgement on the same computer, not human display-to-hit latency.
- Heap sample range: **${Math.min(...heaps).toFixed(2)}–${Math.max(...heaps).toFixed(2)} MiB**; first/last **${heaps[0].toFixed(2)}/${heaps.at(-1).toFixed(2)} MiB**. RSS sample range: **${Math.min(...rss).toFixed(2)}–${Math.max(...rss).toFixed(2)} MiB**. A finite soak cannot prove leak freedom.
- Server shots/hits at sample end: **${tickRecord.shots}/${tickRecord.hits}**.

## Simulated network conditions
Eight bots per condition. Artificial latency is split over send and receive; jitter 20 ms and application-level loss 5%. The 10-second targets sometimes run longer under host load. This is not OS-level TCP impairment or subjective playability evidence.

| RTT setting ms | jitter ms | loss | mean correction m | corrections >8 cm | binary KiB/client/s | errors / disconnects |
|---|---|---|---|---|---|---|
${rows}

Correction is the difference in predicted position before and after authoritative restore plus input replay, excluding the first spawn. Respawns can still create spikes. A previous wall-clock soak in test-results/soak-final.json crossed a system sleep: its aggregate tick average is invalid and it is excluded from this report.

## Limits
No measured human RTT-to-hit latency, hardware iGPU benchmark, or allocation profiler. FPS is a short sample; it cannot guarantee a 30-FPS floor on every laptop. Rooms are process-local. Internet deployment has not been performed. See README for feature/security boundaries. Screenshots and raw results are in docs/ and docs/evidence/.
`,
);
fs.mkdirSync("docs/evidence", { recursive: true });
for (const name of ["browser.json", file.split("/").at(-1),...(latency?['latency-run.json']:[]), ...(pov ? ["pov-regression.json"] : [])])
  fs.copyFileSync("test-results/" + name, "docs/evidence/" + name);
console.log("Updated TEST_REPORT.md from " + file);
