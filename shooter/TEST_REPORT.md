# PARALLAX — measured verification

Executed on Windows / Node 24.13.0, 24 October 2026. Chromium 141, Playwright 1.56.1, headless SwiftShader. FPS is a software-renderer sample, not an iGPU benchmark.

## Automated checks
- Thirteen unit/lifecycle tests pass, including new cycle boundaries, vertical-velocity reconciliation and muzzle ownership regressions.
- Three browser pages connected, host settings synced, players moved, snapshots arrived, a spectator cycled views, the scheduled POV swap occurred, settings and pointer-lock fallback opened without errors.
- Browser FPS (smoothed requestAnimationFrame sample): **48.35**. Snapshots at sample: **91**. Console/page errors: **0**. Local RTT: **0 ms**.
- npm ci fresh reinstall and npm audit were run; see commit history and command output. Docker build could not be run because Docker is not installed on this host.

## POV / close-range regression
- Full 60-second two-browser regression: **pass**, 3 own/borrowed cycles, completion observed 121 ms after scheduled expiry.
- Closest tested body separation: **0.199 m**. Living body visibility verified in both POVs; dynamic instances no longer use stale culling bounds. Screenshots: docs/close-own.png and docs/close-borrowed.png.
- Jump sampled at **0.350 m** and returned to ground. Quantized vertical-velocity replay also passes its unit regression.
- Borrowed shot shooter/view IDs: **1/2**, firing camera shake **false**. Own-view shot IDs: **1/1**, shake **true**. Page errors: **0**.
- Beeps and swap tones are synthesized via WebAudio; the automated run does not certify speaker output.

## Historical eight-bot soak (before the 60-second POV revision)
These measurements belong to the previous build and 26-byte entity protocol. The current 28-byte protocol and rendering changes have not had a new endurance/performance soak.
- Duration: **10.00 wall-clock minutes**. Initial 10-minute build; no valid completed 30-minute release result is available.
- Snapshots: **96000**; bot errors **0**; unexpected disconnects **0**; server stderr **""**.
- Average simulation tick during the eight-bot sample: **0.131 ms**; peak **21.623 ms**. Target <4 ms average: **pass**. Suspended time is not observed in this sample.
- Binary snapshots received: **4.12 KiB/s/client**, below 30 KB/s. The count excludes TCP/WebSocket headers and JSON events.
- Local input-to-hit event latency in a separate 60-second eight-bot run: **64.6 ms mean**, **126 ms p95**, **29 hit samples**. This is bot input to server hit acknowledgement on the same computer, not human display-to-hit latency.
- Heap sample range: **9.96–16.26 MiB**; first/last **10.38/13.03 MiB**. RSS sample range: **58.49–69.85 MiB**. A finite soak cannot prove leak freedom.
- Server shots/hits at sample end: **5560/311**.

## Simulated network conditions
Eight bots per condition. Artificial latency is split over send and receive; jitter 20 ms and application-level loss 5%. The 10-second targets sometimes run longer under host load. This is not OS-level TCP impairment or subjective playability evidence.

| RTT setting ms | jitter ms | loss | mean correction m | corrections >8 cm | binary KiB/client/s | errors / disconnects |
|---|---|---|---|---|---|---|
| 0 | 20 | 5% | 0.406 | 744 | 3.42 | 0 / 0 |
| 50 | 20 | 5% | 0.451 | 1257 | 3.59 | 0 / 0 |
| 100 | 20 | 5% | 0.583 | 1340 | 3.73 | 0 / 0 |
| 200 | 20 | 5% | 1.078 | 1227 | 3.48 | 0 / 0 |

Correction is the difference in predicted position before and after authoritative restore plus input replay, excluding the first spawn. Respawns can still create spikes. A previous wall-clock soak in test-results/soak-final.json crossed a system sleep: its aggregate tick average is invalid and it is excluded from this report.

## Limits
No measured human RTT-to-hit latency, hardware iGPU benchmark, or allocation profiler. FPS is a short sample; it cannot guarantee a 30-FPS floor on every laptop. Rooms are process-local. Internet deployment has not been performed. See README for feature/security boundaries. Screenshots and raw results are in docs/ and docs/evidence/.
