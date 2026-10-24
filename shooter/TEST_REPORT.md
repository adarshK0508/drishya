# Verification — Blackthorn House

Current checks run with Node 24.13 and Playwright Chromium on Windows.

## Automated coverage

`npm test` runs 15 unit/server tests plus a two-browser integration check.

- Binary inputs and snapshots, quantization, input rejection, muzzle ownership and shared collision tests.
- Exact boundaries of all five 20-second / 7-second reveal cycles (135 seconds search).
- Flood-fill reachability of all six rooms and all spawn positions using the actual movement collision geometry.
- Admission requires two players; capacity is two. Ready checks, reconnect tokens and host migration.
- Hunter cannot move or fire during hiding; hider can move but cannot obtain a weapon by forging inputs.
- Live asymmetric reveal assignment; hunter can move their own body while viewing the hider.
- Six shots total, ignored reloads/weapon switching/grenades, early survival on ammo exhaustion.
- Survival on timeout, round-two role reversal, round-three reciprocal swaps, and a kill from the shooter's body during borrowed POV.
- Match scoring, three-round completion, rematch reset, disconnect pause/resume and forfeits.
- Browser HUD, hiding blackout, unarmed display, role transition, results, draw and return to lobby. No browser JavaScript/console errors in the completed run.

The browser fixture advances server deadlines to exercise the entire match quickly. It places players in the library for screenshots and character visibility, and uses actual keyboard events for movement. The concurrent-client test dispatches the join button directly for deterministic setup. A separate Chromium check also passed with a physical mouse click on the menu join button.

## Rendering

Observed 5,198 triangles and 52 draw calls in the completed run. Static geometry is instanced by material, characters share per-figure materials, and effects use a fixed pool. Only one point light is active, without shadow maps. Quality automatically drops to a 0.55 pixel ratio under sustained low FPS.

A two-client software-rendered Chromium run reported roughly 25 FPS on the last sampled frame. This is not a gaming-GPU benchmark or a guarantee of performance on other machines. F3 shows current FPS and network diagnostics.

Screenshots: `docs/mansion-menu.png`, `docs/mansion-library.png`, `docs/mansion-borrowed.png`. Machine-readable browser output is written to ignored `test-results/mansion-browser.json`.

## Remaining playtest questions

Human play is still needed to tune map knowledge, six-shot pressure, darkness, and the hider's ability to suppress useful location clues. Audio currently provides a synthetic ambience, local footsteps and gun cues; it does not yet implement directional opponent footsteps. Furniture uses conservative solid collision boxes, so tables provide cover but cannot be crawled beneath. No Internet deployment or real two-laptop LAN session was performed for this revision. Historical arena soak files and screenshots are not evidence for the mansion revision.
