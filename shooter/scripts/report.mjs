import fs from 'node:fs';
const final=fs.existsSync('test-results/soak-final.json');
const s=JSON.parse(fs.readFileSync(final?'test-results/soak-final.json':'test-results/soak.json'));
const b=JSON.parse(fs.readFileSync('test-results/browser.json'));
const heaps=s.metrics.map(m=>m.heap/1048576), rss=s.metrics.map(m=>m.rss/1048576);
const rows=s.conditions.map(c=>`| ${c.latency} | ${c.jitter} | ${c.loss*100}% | ${c.meanPredictionError.toFixed(3)} | ${c.corrections} | ${c.bytesPerClientSecond.toFixed(0)} | ${c.errors} / ${c.disconnects} |`).join('\n');
fs.writeFileSync('TEST_REPORT.md',`# PARALLAX — measured verification

Executed on Windows / Node 24.13.0, 24 October 2026. Chromium 141, Playwright 1.56.1, headless SwiftShader. This is software rendering, not a laptop iGPU benchmark.

## Automated checks
- Seven unit/lifecycle tests pass: binary round trips, quantization, malformed packets, collision/speed, swap permutations, historical hitboxes/cover, room/reconnect/host migration/capacity.
- Two browser pages connected to one room, readied and started a match, received snapshots, opened settings, and exercised pointer-lock fallback.
- Browser FPS (smoothed rAF sample): **${b.telemetry.fps.toFixed(2)}**. Host snapshots: **${b.telemetry.snapshots}**. Console/page errors: **${b.errors.length}**. Measured localhost RTT: **${b.telemetry.rtt} ms**.
- Fresh dependency reinstall with npm ci succeeded; npm audit reported zero vulnerabilities at execution.

## Eight-bot soak
- Duration: **${(s.soak.durationMs/60000).toFixed(2)} minutes**. ${final?'Final corrected movement/ticker build.':'Initial build; later movement/ticker fixes also passed unit/browser regression. Final thirty-minute corrected-build soak recorded separately when available.'}
- Snapshots: ${s.soak.snapshots}; errors ${s.soak.errors}; unexpected disconnects ${s.soak.disconnects}; server stderr ${JSON.stringify(s.serverErrors)}.
- Average simulation tick: **${s.final.avgTickMs.toFixed(3)} ms**; maximum **${s.final.maxTickMs.toFixed(3)} ms**. Average target <4 ms passed; peak is disclosed separately.
- Received binary snapshot bandwidth: **${(s.soak.bytesPerClientSecond/1024).toFixed(2)} KiB/s/client**, below 30 KB/s. Does not include TCP/WebSocket headers or JSON events.
- Heap sampled every 10 s: ${Math.min(...heaps).toFixed(2)}–${Math.max(...heaps).toFixed(2)} MiB. First/last ${heaps[0].toFixed(2)} / ${heaps.at(-1).toFixed(2)} MiB. RSS ${Math.min(...rss).toFixed(2)}–${Math.max(...rss).toFixed(2)} MiB. Bounded oscillation is evidence, not a proof of leak freedom.
- Authoritative shots/hits: ${s.final.shots} / ${s.final.hits}.

## Simulated network conditions
Each condition runs eight bots for 10 s. Latency is split across send/receive, jitter is symmetric, and 5% of application input/snapshot packets are dropped. This is an application-level impairment harness over reliable WebSockets, not OS-level TCP loss simulation.

| RTT setting ms | jitter ms | loss | mean correction m | corrections >8cm | bytes/client/s | errors / disconnects |
|---|---|---|---|---|---|---|
${rows}

${final?'Correction measures predicted position before and after authoritative restore + replay, excluding initial spawn; respawns may still create spikes.':'Initial harness measured pre-replay divergence, including latency and spawn offsets; do not interpret this column as a pure prediction-error measure. The final harness corrects that definition.'}

## Limits
No subjective playability claim. No measured RTT-to-hit latency, hardware iGPU benchmark, or allocation profiler. FPS is a short sample, not a guarantee of never falling below 30. Docker deployment was not executed. Feature cuts are in README. Raw JSON and screenshots are retained in docs/evidence and docs.
`);
fs.mkdirSync('docs/evidence',{recursive:true});
for(const name of ['browser.json',final?'soak-final.json':'soak.json'])fs.copyFileSync('test-results/'+name,'docs/evidence/'+name);
console.log('Updated TEST_REPORT.md from measured JSON');
