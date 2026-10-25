# Verification — दृश्य

Verified on Windows with Node 24.13 and Playwright Chromium.

## Automated results

All 16 unit/server tests pass. The two-browser integration test passes with no browser JavaScript or console errors. The browser fixture advances server deadlines to exercise the match quickly; exact timing is covered by the server tests.

Coverage includes:

- Exact boundaries of five 20-second / 7-second cycles and the 135-second hunt.
- Both players exchanging viewpoints while movement, shooting and interactions are blocked server-side.
- Independent mouse rotation at the opponent's position, frozen physical aim, and restoration of original aim.
- No extension to the round deadline during swaps; 3-second round intermissions.
- Hunter waiting lock, hider movement, six-shot limits, ignored reload/weapon/grenade attempts, damage, role reversal, final duel and match results.
- Hider-only, proximity-checked portrait passage; one use across rounds and reset on rematch. Real E-key activation is exercised in-browser.
- Toilet interaction and flush state, health bar/value updates, authoritative cat proximity, and the hider's red shrinking-vision warning.
- Last-10-second boost boundaries and hunter-only client prediction.
- Room reachability using actual collision geometry, admission rules, reconnect and disconnect forfeit.
- Hindi entrance, newspaper navigation, compact settings, round-result card and return to lobby.

The visual fixture `node test/visuals.mjs` captures the actual rendered rooms and checks that settings require no scrolling at 1280×800, 960×600 and 1366×768.

## Rendering and limits

The completed two-client software-rendered run sampled 67 draw calls and 22,654 triangles, at approximately 18 FPS. This is a software-rendering measurement under concurrent browser load, not a hardware-GPU benchmark. Static repeated furnishings are instanced by material and geometry; quality reduces resolution under sustained low FPS.

Audio is implemented with Web Audio: filtered footstep transients, attenuated/panned nearby opponent steps, flushing, ambient drone and cues. Automated Chromium runs mute hardware output; headphone listening still needs a human check.

No real two-laptop network session or human balance study was performed. The approved 10% hunter speed and 15% illumination boosts are deliberately modest; hider win rates still require playtesting. Furniture uses conservative collision boxes, so players cannot crawl under tables.

Current screenshots are in `docs/drishya-*.png`; tutorial images are local gameplay screenshots in `public/assets/guide-*.png`. Detailed test output is written to ignored `test-results/mansion-browser.json`. Legacy arena and earlier POV scripts describe historical mechanics only.
