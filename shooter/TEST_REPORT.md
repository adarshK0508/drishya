# PARALLAX — measured verification

Executed on Windows / Node 24.13.0, 24 October 2026. Chromium 141, Playwright 1.56.1, headless SwiftShader. This is software rendering, not a laptop iGPU benchmark.

## Automated checks
- Seven unit/lifecycle tests pass: binary round trips, quantization, malformed packets, collision/speed, swap permutations, historical hitboxes/cover, room/reconnect/host migration/capacity.
- Two browser pages connected to one room, readied and started a match, received snapshots, opened settings, and exercised pointer-lock fallback.
- Browser FPS (smoothed rAF sample): **35.18**. Host snapshots: **91**. Console/page errors: **0**. Measured localhost RTT: **0 ms**.
- Fresh dependency reinstall with npm ci succeeded; npm audit reported zero vulnerabilities at execution.

## Eight-bot soak
- Duration: **10.00 minutes**. Initial build; later movement/ticker fixes also passed unit/browser regression. Final thirty-minute corrected-build soak recorded separately when available.
- Snapshots: 96000; errors 0; unexpected disconnects 0; server stderr "".
- Average simulation tick: **0.132 ms**; maximum **21.623 ms**. Average target <4 ms passed; peak is disclosed separately.
- Received binary snapshot bandwidth: **4.12 KiB/s/client**, below 30 KB/s. Does not include TCP/WebSocket headers or JSON events.
- Heap sampled every 10 s: 9.96–16.26 MiB. First/last 10.38 / 13.03 MiB. RSS 58.49–69.85 MiB. Bounded oscillation is evidence, not a proof of leak freedom.
- Authoritative shots/hits: 6199 / 370.

## Simulated network conditions
Each condition runs eight bots for 10 s. Latency is split across send/receive, jitter is symmetric, and 5% of application input/snapshot packets are dropped. This is an application-level impairment harness over reliable WebSockets, not OS-level TCP loss simulation.

| RTT setting ms | jitter ms | loss | mean correction m | corrections >8cm | bytes/client/s | errors / disconnects |
|---|---|---|---|---|---|---|
| 0 | 20 | 5% | 0.406 | 744 | 3497 | 0 / 0 |
| 50 | 20 | 5% | 0.451 | 1257 | 3679 | 0 / 0 |
| 100 | 20 | 5% | 0.583 | 1340 | 3818 | 0 / 0 |
| 200 | 20 | 5% | 1.078 | 1227 | 3561 | 0 / 0 |

Initial harness measured pre-replay divergence, including latency and spawn offsets; do not interpret this column as a pure prediction-error measure. The final harness corrects that definition.

## Limits
No subjective playability claim. No measured RTT-to-hit latency, hardware iGPU benchmark, or allocation profiler. FPS is a short sample, not a guarantee of never falling below 30. Docker deployment was not executed. Feature cuts are in README. Raw JSON and screenshots are retained in docs/evidence and docs.
