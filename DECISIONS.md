# Decisions

- Preserve the existing Unity prototype untouched; its LAN JPEG camera exchange establishes the core mechanic: another player's eyes while controlling your own body.
- Focus this repository on the local Node multiplayer shooter, following the user's final project choice.
- Use Node 24 (installed); the shooter requires Node 20 or newer.
- User-confirmed revision: 60-second rounds repeat 5 seconds own POV and 15 seconds borrowed POV three times; this replaces randomized and kill-triggered timing. Score targets no longer end rounds early.
- Show and beep all five own-POV seconds, but only the final three borrowed-POV seconds; the last cycle announces round end.
- Keep control and firing on the original body while the camera follows the other pilot's position, aim and FOV. Muzzle effects remain in world space at the shooter; only own-view firing shakes the camera.
- Transmit vertical velocity for jump reconciliation and disable stale aggregate capsule culling; keep all arena players within the interest radius.

- Repository-local Git identity is Hackathon Builder <builder@localhost>, because no author identity was configured; no global Git settings changed.
- A previous wall-clock soak crossed a machine sleep; its tick average is invalid. The final endurance gate counts active simulation ticks and excludes suspension gaps from tick-time averages.
- Low graphics quality uses a 0.55 pixel ratio when FPS stays below 45 for two seconds; this preserves headless/software-renderer playability while a user can select higher quality on a GPU.
