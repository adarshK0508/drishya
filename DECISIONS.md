# Decisions

- Preserve the existing Unity prototype untouched; its LAN JPEG camera exchange establishes the core mechanic: another player's eyes while controlling your own body.
- Implement independent local Node applications; no Sites hosting or shared application code.
- Use Node 24 (installed) for both projects; product uses built-in SQLite, therefore requires Node >=22.13 rather than Node 20.
- Use periodic 20–30 second perspective rotation, pair and kill variants in the shooter; authoritative world state replaces the original video stream.
- Treat the supplied S1–S13 text as the source brief; do not fetch the video.
- Allocate the missing 10 camera points in the car table to surveillance, as requested; weights are design hypotheses, not validated safety predictors.

