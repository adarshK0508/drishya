# Verification — दृश्य

Verified on Windows with Node 24.13 and Playwright Chromium.

## Automated results

Latest damage-audio correction: the authoritative hider-hit event is now broadcast to both clients. Both play the same centered damage_received recording once per hit, including special hits and hits during invisibility. Effect gain is 2.4 (formerly 0.9, about +8.5 dB); the source and master volume remain unchanged. This supersedes the historical victim-only checks below. All 22 unit/server checks and the two-browser playback flow (22 groups) passed, zero JS/audio/console errors. Both clients increment their damage playback counter once for the same real invisible-hider hit. Evidence: `test-results/browser-1792895696372/`. Hardware playback is muted in automation; final loudness is a headphone check.

Latest visual/outcome revision: full `npm test` passed (22 unit/server checks, 22 gameplay browser check groups and 6 visual/outcome groups), with zero JavaScript, console or media errors. Gameplay evidence: `test-results/browser-1792895049460/`; full-run visual evidence: `test-results/visuals-1792895089888/`. Final targeted `npm run test:visual` also passed: `test-results/visuals-1792895152803/`, 6 groups, zero errors. Both native MP3 players reached their real end; a new gesture left them ended/paused, verifying no accidental replay from the global audio unlock handler.

The visual suite verifies six complete guide images with adjacent visible captions and no scrolling at 1280x800, 960x600, 1366x768, 1440x900 and 600x900. It checks local font loading, muted looping video paused during matches, room arrival/fade driven by the physical body (no false entry during swapped POV), and real three-round match completion delivering separate winner/loser dialogs and Pacific Rim/Heather media playback. Result tracks do not loop; lobby restores home music. Both popups fit a 960x600 screen. All three new supplied media copies match source SHA-256 hashes.

Final guide assets use five composed current-game photos with transient HUD text hidden during capture, plus an actual automatic-swap screenshot. The portrait is the interactable bathroom portrait. All captures write to fresh ignored evidence folders; publishing selected screenshots is an explicit copy. `npm test` now includes the visual suite sequentially to avoid contention between software-rendered clients.

All 22 unit/server tests pass. The extended two-browser integration test checks traditional exchanges, special/torch flows, supplied music/effects and cat escape with no browser JavaScript or console errors. The browser fixture advances server deadlines to exercise the match quickly; exact timing is covered by the server tests.

Reverified with the latest timing: 3 seconds choosing vision, 3 seconds to act, then 5 seconds of invisibility. Boundary assertions verify the precise setup/action deadlines and the unchanged escape duration. Full `npm test` passed; latest evidence is `test-results/browser-1792889449002/`.

Supplied audio/cat revision: full `npm test` passed (22 checks + browser flow); final targeted browser recheck also passed with 21 listed check groups and zero errors. Latest evidence: `test-results/browser-1792891370087/`; saved cat route image: `docs/drishya-cat-corridor.png`. Master mute/unmute preserves playback, and the screenshot camera confirms the cat actually runs down the corridor. All supplied asset copies match their original bytes.

Coverage includes:

- Combat recordings: correct regular/special sample on both clients and a real invisible-hider hit playing the victim cue once while the hunter receives none. Full `npm test` passed with 22 unit/server checks and 22 browser check groups; latest evidence `test-results/browser-1792893132160/`. All effects decode without errors. Original damage M4A is preserved; validated PCM WAV copy handles bundled Chromium's M4A Web Audio decoder limitation.

- Exact boundaries of five 20-second / 7-second cycles and the 135-second hunt.
- Both players exchanging viewpoints while movement, shooting and interactions are blocked server-side.
- Independent mouse rotation at the opponent's position, frozen physical aim, and restoration of original aim.
- No extension to the round deadline during swaps; 3-second round intermissions.
- Hunter waiting lock, hider movement, 20-round limits, flat 15 damage including head hits, ignored reload/weapon/grenade attempts, role reversal, final duel and match results.
- Special activation within 3m in the same structural room, ignoring facing/furniture, with one use in each hunter round and rejection in round 3.
- Frozen bodies and synchronized hunter-controlled hider camera during the 3-second setup; a 3-second locked camera window during independent hunter movement and gun aiming. Invisibility remains 5 seconds.
- Separate special ammunition and 70 damage; immediate escape on hit/miss, timeout escape without firing, moving/damageable invisible hider, held-torch hiding, and cleanup on a lethal hit.
- Paused universal countdown and swaps through all branch phases, exact remaining-time restoration, and branch pause during reconnect.
- Reachable randomized torch locations, exclusive pickup/reset, and 15% visibility belonging to viewed eyes during special and traditional exchanges, without stacked last-light bonuses.
- Hider-only, proximity-checked portrait passage; one use across rounds and reset on rematch. Real E-key activation is exercised in-browser.
- Toilet interaction and flush state, health bar/value updates, authoritative first-bedroom-entry cat trigger/reset each round, and the hider's red shrinking-vision warning.
- Cat route sampled every 10ms against actual collision geometry, verifying bed clearance, doorway/corridor passage and final fade.
- Audio asset media types, HEAD and byte-range streaming; recorded footstep impact extraction and separate role treatments.
- Actual browser autoplay blocking/gesture fallback, intro playing then its ended event starting home loop, interruption on match start, gameplay continuing across rounds, home music on draw results, decoded boot/cat effects and simultaneous self/opponent footstep panning. The fixture dispatches intro-ended rather than waiting for the full recording.
- Last-10-second boost boundaries and hunter-only client prediction.
- Room reachability using actual collision geometry, admission rules, reconnect and disconnect forfeit.
- Hindi entrance, newspaper navigation, compact settings, round-result card and return to lobby.

The visual fixture `node test/visuals.mjs` captures the actual rendered rooms and checks that settings require no scrolling at 1280×800, 960×600 and 1366×768.

## Rendering and limits

The initial completed two-client run for this revision sampled 102 draw calls and 23,354 triangles at approximately 23 FPS. This is a software-rendering measurement under concurrent browser load, not a hardware-GPU benchmark. Static repeated furnishings are instanced by material and geometry; quality reduces resolution under sustained low FPS.

The latest audio/cat fixture sampled 66 draw calls, 22,642 triangles and approximately 31 FPS. Different camera views/host load change these numbers; no new hardware benchmark is claimed.

Music uses native media elements and all ten supplied recordings are bundled locally, plus the compatible damage WAV. Recorded boots/cat/gunfire/damage use Web Audio, with original-body spatial hearing and distinct hunter/hider boot tone. Existing synthesized flush/swap/hit-confirmation/UI cues remain. Automated Chromium checks real loading, decoding, playback state and audio graph settings with hardware output muted; headphone listening and subjective effect balance still need a human check.

No real two-laptop network session or human balance study was performed. The 3m activation distance, 15% torch boost and 70-damage special remain starting balance values. Furniture uses conservative collision boxes, so players cannot crawl under tables.

Saved screenshots are in `docs/drishya-*.png`; tutorial images are local gameplay screenshots in `public/assets/guide-*.png`. New test captures go to a unique ignored `test-results/browser-<timestamp>/` folder, reported as `evidenceDir` in `test-results/mansion-browser.json`, so verification does not overwrite game assets. Repeated overwriting of tracked screenshots intermittently failed with Windows UNKNOWN file-open errors; unique output paths avoid that overwrite path. Legacy arena and earlier POV scripts describe historical mechanics only.
