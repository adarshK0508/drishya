# Changelog

## 2026-10-25 — shared hider damage cry

- Broadcast the supplied damage_received cue to both players on every hider hit. Increased effect gain from 0.9 to 2.4, centered without attenuation, keeping master volume. Includes special, invisible and lethal hits.

## 2026-10-25 — entrance, newspaper and match outcomes

- Blended the supplied looping eye video over a scratched oxblood entrance; pause video during matches.
- Rebuilt How to Play as a no-scroll six-photo newspaper with close captions and the requested portrait hint.
- Bundled licensed distressed typewriter/antique newspaper fonts and subtle accessible letter-size variation.
- Personalized victory/defeat popups with supplied Pacific Rim/Heather tracks; draw and lobby use home music.
- Added fading physical-room entry names, independent of borrowed viewpoints; extended video/font media serving and visual checks.

## 2026-10-25 — supplied combat recordings

- Connected regular revolver fire to pistol audio and special gun fire to its separate recording, replacing firing placeholder beeps.
- Added authoritative hider-only per-hit damage audio, including invisible and lethal hits, plus M4A media support and local asset copies. Preserved original damage M4A and derived a PCM WAV for compatible playback.

## 2026-10-25 — supplied audio and cat escape

- Added one-time page intro, looping home/help/lobby music, and continuous three-round gameplay music with fades and autoplay gesture fallback.
- Replaced generated footsteps with supplied boot impacts, distinct hunter/hider tones, sprint/crouch cadence and centered self versus positional opponent audio. Added recorded spatial cat cry.
- Fixed cat facing/gait and a collision-checked route from bed through the bedroom doorway/corridor into darkness. Trigger once on bedroom entry each round; special pauses no longer rewind its animation.
- Bundled all recordings locally, retained master volume and added streamed audio MIME/range support for seeking and looping.

## 2026-10-25 — shorter special timing

- Reduced special camera setup to 3s and the locked second-person action window to 3s. Invisibility remains 5s; the whole special pauses universal time for up to 11s.

## 2026-10-25 — special second-person ability and torch

- Increased revolver ammunition to 20 and set flat per-hit damage to 15, keeping 100 health.
- Added one special opportunity in each player's hunter round: proximity activation, 5s hider-camera setup, up to 5s locked second-person movement, and a separate 70-damage single-shot gun.
- Added 5s of hider invisibility after firing or timing out. All special phases pause universal time and automatic swaps, then restore the exact remaining durations.
- Added authoritative one-per-round torch spawning/pickup, exclusive left-hand ownership and 15% visibility through the holder's eyes, including borrowed views.
- Added branch countdown/prompt/status UI, projected special aiming reticle, models, guide updates and persistent implementation handoff.

## Blackthorn House — 24 October 2026

- Replaced the active arena with a six-room horror mansion, furniture cover, room clues and limited spherical illumination.
- Added exactly two players, three rounds, role reversal, 20s hiding, five 20s/7s cycles, and a final simultaneous hunt.
- Added six-shot revolvers, unarmed hiders, crouching hitboxes, survival wins, match scoring, disconnect pauses and rematches.
- Replaced capsules with low-poly human figures and rebuilt menu/HUD for the mansion.
- Instanced static geometry; current scene is about 5,200 triangles / 52 draw calls.
- Passed 15 unit/server checks and a two-browser full-flow check; updated documentation and retired obsolete arena script shortcuts.

## POV and close-range fixes — 24 October 2026

- Replaced random swaps with three fixed 5s-own / 15s-borrowed cycles in a 60-second round, with countdown sounds.
- Fixed dynamic capsule culling, reduced near clipping, and expanded visibility coverage around body and camera.
- Added authoritative vertical velocity to snapshots and interpolated remote jump height.
- Added simple world-space guns; shots and sparks originate at the shooter's gun, with own-view-only firing shake.

## Milestone 0 — discovery

- Inspected original Unity LAN POV prototype and preserved its README as UNITY_README.md.
- Planned the authoritative web shooter.

## Milestone 1 - shooter

- Built PARALLAX with authoritative rooms, binary netcode, prediction, rewind, perspective swaps, procedural rendering and audio.
- Seven unit/lifecycle tests and a two-browser smoke test pass; long-running soak evidence follows.
- Preserved feature limitations explicitly in shooter/README.md.

## Milestone 1b — shooter completion pass

- Added jumpable platforms, sight-line-aware spawns, thrown grenades, spectator follow, team scoring, score/time settings, generated music/footsteps and gamepad support.
- Expanded browser coverage to movement, host-synced map/theme and spectators; adjusted graphics quality after a software-renderer FPS regression.
- Started a new 30-minute active-tick soak so system sleep cannot falsely satisfy its duration.

## Project scope — shooter only

- Narrowed the repository to the shooter and updated root documentation to reflect the final project choice.

## 2026-10-25 — Drishya identity and reciprocal sight exchange

- Rebranded the browser game as दृश्य, with an indigo, aged-paper and copper identity, English newspaper guide, and a two-step entrance.
- Made every seven-second sight exchange reciprocal: frozen bodies, independent looking, disabled shooting/interactions, unchanged round clock, countdown iris and return animations.
- Added three-second round-end cards, a centered clock, vitality meter, six cartridge icons and compact themed settings.
- Added distinct bathroom fixtures, flushing, the supplied framed portraits, hider-only once-per-match escape, four-poster master bedroom and a sleeping/fleeing cat.
- Added textured revolver details and footstep audio; applied the approved final-10-second hunter speed/light boosts.
- Verified server rules and two-browser interaction flow; documented remaining headphone/LAN/balance playtesting.
