# Drishya implementation and model handoff

Updated: 2026-10-25 (India). Read this file first when continuing with another model.

**Current status: requested visual/outcome revision complete and verified, alongside previous special/torch/audio/cat work. Eye-video entrance, scratched oxblood surface, six-panel no-scroll newspaper, distressed local fonts, personalized ending tracks and fading room names are implemented. Final release destination: `origin/main` at the user's request; use `git status -sb` and `git log -1` to verify publication state. Next useful work: human visual/audio feedback and two-laptop LAN playtesting. Special timing remains 3s setup / 3s action / 5s invisibility.**

## Current correction: shared louder hider damage sound

- Latest user instruction supersedes earlier victim-only audio: every hit on the hider broadcasts `damage_received` to BOTH hunter and hider, including regular/special, invisible and lethal hits.
- Server broadcasts the existing authoritative hurt event; both clients play the supplied compatible damage WAV once. Centered with no distance attenuation so the hunter always hears it too.
- Effect gain raised from 0.9 to 2.4 (about +8.5 dB), still controlled by the master Sound slider. Original recording unchanged.
- [x] Verified: all 22 unit/server tests and two-browser flow (22 groups) pass, zero browser/audio/console errors. Special and regular hits broadcast identical events once to both clients; real invisible-hider shot increments both playback counters exactly once. Evidence: `shooter/test-results/browser-1792895696372/`. Whitespace check passed. Human headphone loudness remains subjective; browser hardware output was muted.

## Completed visual/outcome revision

- Supplied Halloween eye WebM is the entrance background; maintain dark indigo/copper identity with a scratched oxblood surface visible through video's black background. Muted looping video, paused during gameplay.
- How to Play becomes a fixed, no-scroll newspaper spread inspired by supplied Daily Prophet reference: six real gameplay screenshots, captions close to pictures, distressed typewriter text and antique newspaper masthead. Portrait image mandatory; exact requested caption: `Potraits are Interesting , try to get close`.
- Use distressed typewriter-style UI matching supplied alphabet image; bundle local Special Elite and IM Fell English SC from official Google Fonts repository with licenses (screenshot is a reference, not an actual font file). Subtle deterministic uneven letter sizes on headings, without scrambling numbers/inputs or breaking accessibility.
- Personalized match outcome: winner popup + supplied Pacific Rim track and `Adrenaline is the drug. You won.`; loser popup + supplied Heather track and `Death knocked. You opened the door.` Draw retains neutral/home music. Play outcome tracks once while popup is open; return to home music on lobby button. These outcome tracks supersede older home-on-results behavior.
- Physical room entry shows a fading top-screen room name; borrowed POV alone must not trigger it.
- [x] Implement media/font assets, background and six-panel guide. Supplied media copied locally; font licenses bundled. Video streamed with range support and paused in match. Guide verified no-scroll at 1280x800, 960x600, 1366x768, 1440x900 and 600x900.
- [x] Implement outcome dialog/music, room banner and type distortion. Real win/loss and room banner browser verification passed. Intro/home/gameplay routing preserved; explicit ended-roster guard prevents outcome track being overwritten.
- [x] Six current gameplay guide images published. Five clean composed photos from `visuals-1792894981631/guide/`, automatic swap photo from `browser-1792894681325/public/assets/guide-swap.png`. Portrait is the actual bathroom passage. No scroll/image/caption overflow at five viewport sizes; screenshots visually inspected.
- [x] Full `npm test` PASSED: 22 unit/server + 22 gameplay browser groups + 6 visual groups. Zero JS/console/media errors. Browser evidence `shooter/test-results/browser-1792895049460/`; visual evidence `shooter/test-results/visuals-1792895089888/`. Docs and asset/source/license mapping updated. All new media bytecopies SHA-256 match supplied originals.
- [x] Final native end-of-track recheck PASSED: `npm run test:visual`, evidence `shooter/test-results/visuals-1792895152803/`, 6 groups, zero errors. Both actual MP3 players seek to their real end; another key gesture leaves them ended/paused. Native `ended` guard prevents accidental restart from the global unlock listener. Selected menu/guide/win/loss/room-entry captures saved in `shooter/docs/`.
- [x] Final source formatting and whitespace check; no runtime dependencies added. Original supplied media preserved. Fonts include official source README/licenses.
- Package `npm test` now runs unit/server, gameplay browser, then visual/outcome suite sequentially; `npm run test:visual` runs the last alone. Do not run software-browser suites concurrently: extra GPU contention can exhaust the genuine 3s special window in tests. Duplicate action screenshot was replaced with a filesystem copy.

## Prior audio implementation (retained context)

- [x] Combat audio: supplied `pistol sound.mp3` -> `public/assets/audio/pistol.mp3` for normal revolver shots; `spl_feature sound.mp3` -> `special-shot.mp3` for special gun firing only. Hit hider gets supplied damage cue from an authoritative per-hit `hurt` message; shooter does not. Shot/victim placeholder beeps replaced; hit-confirmation/swap/UI cues retained. Own shots centered, opponent shots positional, shared master volume.
- [x] Three original combat copies verified byte-for-byte. Bundled Chromium could not decode M4A in Web Audio (`hurt: Unable to decode audio data`), so runtime uses derived `damage_received.wav` (44.1kHz mono 16-bit PCM, 3.093s, nonzero validated waveform). Original M4A preserved. Temporary FFmpeg tool under ignored `shooter/test-results/audio-tools` is conversion-only, not a game dependency. M4A retains proper audio/mp4 MIME support.
- [x] Combat revision full `npm test` PASSED: 22 unit/server checks plus two-browser flow with 22 listed check groups, zero decoding/audio/JS/console errors. Server checks verify 70/15 hit notifications belong only to hider. Browser checks decode all effects, fire special + regular gun through actual mouse controls, apply a real 15-damage hit to invisible hider, verify correct shot names on both clients, hider hurt cue increments once and hunter hurt cue stays zero. Latest evidence: `shooter/test-results/browser-1792893132160/`; manifest `shooter/test-results/mansion-browser.json`. Docs/asset mapping updated; whitespace check passed.

- Sources in `C:/Users/DELL/Downloads/`: run_once.wav, home_screen_bgm.wav, gameplay_bg.mp3, boots.mpeg, cat.mp3. Copy into local game assets; never depend on Downloads at runtime.
- On page load attempt run_once once; if autoplay is blocked, start on first real click/key. After it ends, loop home_screen_bgm across home, How to Play and lobby. Returning home/lobby does not replay intro.
- Starting a match interrupts intro/menu music with a short fade; gameplay_bg loops across hiding, all three rounds, intermissions, POV swaps and special. Return to home music on match results.
- Cat runs/plays cat.mp3 on first master-bedroom entry each round; nearby opponent can hear it spatially. Reset cat next round. Fix escape: jump off bed, go through the real bedroom doorway into corridor, continue into darkness (no clipping through walls).
- boots.mpeg replaces generated footstep noise for both self and opponent. Sprint faster, crouch quieter; no footsteps while stationary/frozen. Differentiate hunter/hider via a subtle boot tone/pitch contrast plus spatial direction and distance for opponent. Keep footsteps tied to bodies, not swapped eyes, for consistent navigation clues.
- Keep background music below footsteps/cat and retain the existing master volume control.
- [x] Copied all five supplied assets locally; boots.mpeg contains MP3 frames and is served as boots.mp3. Added audio MIME types, streaming byte-range/HEAD support.
- [x] Added Soundscape: attempted intro autoplay with gesture fallback, one-time intro -> menu loop, short fades, match-wide gameplay loop -> menu on results, master volume and light music ducking.
- [x] Added recorded footstep slices, lower/heavier hunter vs lighter hider tone/pitch, centered self vs directional attenuated opponent, movement-distance cadence and crouch/sprint behavior. Audio listener remains at original body.
- [x] Added recorded positional cat one-shot; collision-checked rounded escape from bed through bedroom door/corridor into dark library. Corrected facing, eyes, gait, final fade, per-round reset and first bedroom-entry trigger. Cat animation uses independent wall time so special timer pause cannot rewind it; disconnect pauses shift cat epoch.
- [x] Added audio/path checks, browser verification and docs. All five copied recordings verified byte-for-byte against supplied files, including renamed boots.
- Full `npm test` PASSED: 22 unit/server checks plus extended browser flow, zero audio/JS/console errors. Includes route sampled every 10ms, streaming/range/header support, per-round cat entry, real music autoplay fallback/intro-ended sequencing, decoded effects (7 boot slices), separate simultaneous footstep roles/panning, master mute preserving playhead and old game regressions. Full-run evidence: `shooter/test-results/browser-1792891250757/`.
- Final targeted `node test/browser.mjs` PASSED after aligning cat audio with reconnect-shifted epoch and correcting screenshot camera orientation (portrait teleport had left camera facing backward). Latest evidence: `shooter/test-results/browser-1792891370087/`, 21 listed browser check groups, zero errors. Visually inspected and saved `shooter/docs/drishya-cat-corridor.png`; `cat-frame.json` records actual camera/cat pose. Manifest: `shooter/test-results/mansion-browser.json`.
- Updated README/DECISIONS/CHANGELOG/TEST_REPORT, in-game footstep guidance and audio asset README. Final whitespace check passed. No package dependency changes. Speaker/headphone output was muted by the automated browser; subjective footstep separation and music balance still require listening on actual laptops.

## Scope and repository

- Active game: browser/Node/Three.js LAN game in `shooter/`. Root Unity assets are historical.
- Exactly two players, three rounds. A hunts in round 1; B hunts in round 2; both have guns in round 3.
- Branch `main`, remote `https://github.com/adarshK0508/drishya`. Working tree was clean at implementation start. User explicitly requested publishing the final code on 2026-10-25. Commit and push this completed implementation to origin/main; never force-push.
- User explicitly requested implementation and an ongoing Markdown handoff. Update this file after meaningful milestones and before stopping.
- No applicable AGENTS.md found in project or ancestors. No subagents authorized.

## Confirmed requirements

1. Revolver: 20 rounds, 15 damage per hit; health 100.
2. Separate special gun: one shot, 70 damage, no revolver ammo consumption.
3. Hunter can activate once in their hunter round (rounds 1/2 only, never round 3).
4. Eligibility: close proximity, same room, no activation through walls. No screen visibility/facing requirement. No infection/countdown. Suggested range is 3 metres; use that configurable starting value.
5. On activation consume ability; freeze hider completely and hunter body. For 3 seconds hunter rotates camera through hider's eyes. Hider sees that rotation with no input/control. Automatic lock; no confirmation button. Latest user revision replaces the original 5s setup.
6. Then camera position and direction stay fixed for up to 3 seconds. Hunter can move and independently aim/fire from their own body, while viewing from hider's fixed eyes (second-person POV). Hider remains frozen. Latest revision replaces the original 5s action window.
7. Shot immediately ends action phase (hit or miss). If no shot, 3-second timeout still consumes ability. Both cases start 5 seconds of hider invisibility and restored hider control. Hunter returns to own eyes and original revolver. Hider still takes damage while invisible. Maximum branch duration is now 11 seconds.
8. Universal countdown AND traditional automatic POV swaps pause across ALL special phases, including invisibility. Independent branch timers only. Resume exact remaining universal/swap time after invisibility.
9. Preserve existing traditional swaps: 20s own / 7s reciprocal frozen-body looking, 5 cycles; their usual timer runs during normal swaps.
10. One torch per round (including round 3), random reachable location. Either player picks it up; first owner keeps it in left hand until round end, always on, cannot drop/steal.
11. Torch = modest 15% visibility-distance boost, same FOV, no beam, no through-wall vision/highlight/invisibility reveal. Benefit belongs to holder's eyes, including traditional swaps and special borrowed camera.

## Implementation decisions to preserve

- Ability prompt/button uses F; E remains house interaction/torch pickup. Allow activation during normal own-view search only; automatic swaps retain their existing control restrictions.
- Same-room and structural-wall test does not require player facing or visibility past furniture.
- Treat specified damage as flat 15/70, including head hits; old x2 headshot multiplier must not turn special into 140 damage.
- Round termination/death/disconnect must safely clear/pause branch state. Disconnect pauses branch timers as well as existing round state.
- Keep ammo-exhaustion outcome, but account for an unused special round and do not end the hunt mid-special/invisibility solely for empty regular ammo.
- Torch boost should not multiply last-light bonus beyond 15% total visibility increase (use strongest applicable boost), so it stays modest.

## Completed

- Latest timing revision: setup 3000ms, action 3000ms, invisibility unchanged at 5000ms (maximum branch 11s). Runtime, in-game guide and current documentation updated. `npm test` PASSED for this revision: 19 unit/server checks, exact 3s/3s/5s phase-boundary assertions, and the two-browser flow with 17 check groups and zero errors. Latest evidence: `shooter/test-results/browser-1792889449002/`. Refreshed saved guide and special screenshots; Git whitespace check passed. Older verification entries below describe earlier runs.

- Read current chat, project README/decisions/changelog and relevant authoritative/server/client/shared code.
- Confirmed old code has six rounds/50 base damage and no special/torch; existing reciprocal swaps are the baseline to preserve.
- Created this handoff before implementation.
- Added shared rules, same-room/no-structural-wall eligibility, 3m range and reachable random torch spawn candidates.
- Added server setup/action/invisibility phases, one-use round tracking, flat 15/70 damage, 20-round revolver, independent special ammunition, input freezing and synchronized hider camera.
- Added universal-deadline restoration after branch and disconnect handling for branch timers; ammo exhaustion includes unused special opportunity.
- Added client F/prompt activation, camera setup/lock and body aiming, projected aiming reticle, invisible hider rendering, E torch pickup, eye-owned visibility boost capped at 15%, new separate gun and held torch models.
- Updated in-game guide and lobby copy, expanded ammo display.
- Verification passed: all 19 unit/server checks and the extended two-browser flow (no JS/console errors). Exact boundary tests include special hit/miss/timeout, 70/15 damage, independent ammo, one-use/reset, normal swap time restoration, reconnect pause, torch exclusivity and round-3 rejection.
- Inspected locked-view/invisibility screenshots. Corrected a misleading normal-swap freeze banner, crowded ammo label, and stale normal-swap return announcement during special. Final browser verification and visual inspection passed.
- Updated README, game README, DECISIONS and CHANGELOG to the new mechanics.
- Two repeated browser runs hit Windows UNKNOWN file-open errors while overwriting different tracked screenshots (cause unknown; no assertion/JS failure). Changed browser evidence to unique ignored output folders. Final full `npm test` PASSED: 19 unit/server checks plus the browser flow, zero errors. Full-run evidence: `shooter/test-results/browser-1792888097842/`.
- A targeted repeat exposed a browser-test race: stage telemetry may update before the waiting overlay's next HUD refresh. Added an explicit wait for the overlay. The final targeted `node test/browser.mjs` PASSED with zero errors and 17 listed check groups. Latest evidence: `shooter/test-results/browser-1792888221589/`; manifest: `shooter/test-results/mansion-browser.json`.
- Refreshed TEST_REPORT and demo script; formatted changed source/tests with the existing Prettier installation.
- Saved final `docs/drishya-special-locked.png`, `docs/drishya-special-invisible.png`, updated guide screenshot and three tutorial assets from the latest verified run; verified copied image hashes. Restored unrelated screenshot churn generated by earlier tests.
- Final Git whitespace check passes. Root Unity/Packages/ProjectSettings files were not modified.

## In progress / next

- [x] Shared special/torch rules, eligibility, permissions, ammo/damage values.
- [x] Server special state machine, paused universal deadlines, camera synchronization, one-use tracking, invisibility, round/disconnect cleanup, torch spawning/ownership.
- [x] Client independent camera/body control, prompts, branch countdown, invisibility rendering, special gun and left-hand torch visuals, visibility ownership.
- [x] Update guide, README/decisions/changelog and relevant tests for actual rules.
- [x] Automated verification and browser screenshot inspection.
- [x] Final diff review and handoff update.
- [ ] Human playtest on two actual laptops: camera usability, gun aim, darkness, sound and balance.
- [ ] Listen on headphones to simultaneous heavier hunter/lighter hider steps, opponent stereo position and music/effect balance; tune gains only if feedback warrants it.
- [ ] Tune range/light only if user feedback warrants it (3m/15% are initial values).
- [x] User requested the final Git push. Release preparation: remote fetched, local main matches origin/main before this release, reviewed all changed/untracked files, verified assets below GitHub size limits and generated dependencies/test output ignored. Release commit includes implementation, assets, documentation and this handoff. Verify final publication with `git status -sb` and matching `git rev-parse HEAD` / `git ls-remote origin refs/heads/main`.

## Where to continue

- `shooter/shared/hunt.mjs`: RULES.ammo, SPECIAL/TORCH constants and action permissions; original 20/7 cycle unchanged.
- `shooter/shared/special.mjs`: roomAt/sameRoom, canActivateSpecial, reachable torch spawning, pickup and eye visibility. Furniture does not block special; structural walls do.
- `shooter/server.mjs`: activateSpecial/updateSpecial/startEscape; `room.special` carries phase, independent phaseEnd, hunter/hider IDs, camera and universal freeze timestamp. On branch completion, add elapsed branch duration to existing deadlines. `player.specialUsed` resets per round. `room.torch.owner` is exclusive per round.
- `shooter/public/client.mjs`: lookYaw/lookPitch control setup/normal borrowed view; yaw/pitch still control hunter body in action. Hider camera is synchronized; action camera is fixed. Render invisibility for hunter, including held torch. Reticle projects gun aim into fixed camera.
- `shooter/public/interface.mjs`: static accessible distressed heading letters, video lifecycle, physical room notices (4.5s fade) and personalized result copy. It imports shared roomAt; original body position, never view position.
- `shooter/test/visuals.mjs`: five-viewports no-scroll guide, fonts/media, room/borrow/fade checks, real win/loss and native outcome end behavior; produces five clean game photos to ignored evidence.
- `shooter/public/mansion.mjs`: separate special gun and left-hand torch models; no additional torch light/beam.
- `shooter/public/audio.mjs`: Soundscape music state, HTML media intro/home/gameplay/win/loss, Web Audio recorded boot/cat effects, role profiles and distance-driven footsteps. Main client unlocks audio on first pointer/key and calls setMode from authoritative match state; existing Sound slider remains master.
- Combat in Soundscape: preload pistol/specialShot/hurt WAV buffers; `shot()` chooses by authoritative weapon index 0/1, `hurt()` plays for the victim only. Server sends `hurt` before round-end logic so lethal hits work independently of snapshot timing. Client health snapshot still drives damage flash (and old hunter damage beep in duel), never the hider recording.
- `shooter/public/assets/audio/`: ten supplied original recordings copied locally (boots.mpeg -> boots.mp3 without re-encoding), plus derived damage_received.wav compatibility copy and README mapping. Server streams MP3/WAV/M4A with byte ranges and HEAD support. Conversion tooling is ignored and not needed to run the game.
- `shooter/shared/cat.mjs`: rounded constant-speed escape route, jump/gait pose/fade. `public/house-details.mjs` renders it; server resets catAt each round and triggers on roomAt(player)==east-2 while movement is allowed. Render/positional audio use independent wall time, not paused universal special time. Disconnect shifts catAt.
- `shooter/test/audio-cat.test.mjs`: collision route sampling, footstep extraction/timbres and real HTTP audio streaming checks. Browser flow additionally validates real asset decoding/media states and simultaneous footstep panning. Its intro-ended event is accelerated; hardware sound is muted.
- `shooter/test/special.test.mjs`: authoritative edge cases. `test/browser.mjs`: actual F/E/mouse flow and old swap regression. Binary protocol layout was not changed.
- Start from project root: `cd shooter`, `npm start`, open server URL in two browsers. F = special prompt; E = torch/house interaction; left click = fire. `npm test` runs all checks. Do not rerun tests solely because the model changed; current results are recorded above.
- Read current `git status` before further edits, preserve this implementation, and keep updating this handoff. The latest test manifest/output folder is ignored by Git; selected screenshots and source/tests/docs are intended to be committed.

## Verification / limitations

Latest visual/outcome revision: full `npm test` passed (22 unit/server, 22 gameplay browser groups, 6 visual/outcome groups), then targeted native end-of-track visual recheck passed. Final visual evidence `shooter/test-results/visuals-1792895152803/`; latest gameplay evidence `shooter/test-results/browser-1792895049460/`. Five-viewports guide, real win/loss music, non-restarting ended tracks, body-room fade and untouched swaps/special verified. Browser output was hardware-muted; human headphone balance and actual two-laptop LAN play still remain. Release publication target is origin/main, explicitly authorized by the user; verify current Git state before further changes.

Latest combat audio revision: full `npm test` passed (22 unit/server checks + two-browser flow with 22 listed check groups), zero audio/JS/console errors. Existing 3s/3s/5s special, torch, music, footsteps and cat remain covered. Manifest: `shooter/test-results/mansion-browser.json`; final evidence: `shooter/test-results/browser-1792893132160/`. Software-rendered sample: ~11.2 FPS, 67 draw calls, 22,654 triangles, varying substantially by fixture/host load; not a hardware/LAN benchmark. Human balance, headphone audio and real LAN play remain unverified.
