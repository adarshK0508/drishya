# Changelog

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

