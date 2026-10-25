# दृश्य — Drishya

Two players enter a mansion. A local Node server owns movement, damage, ammunition, roles, round progression, teleport permissions, flushing, and the cat's wake-up time.

## Start

```powershell
npm install
npm start
```

Open the printed local address on the host computer. The second laptop opens the printed LAN address on the same network. Enter the same room code. Both players select Ready; the host opens the doors. Node 20+, WebGL, and desktop browsers are required.

## Controls

WASD move; mouse look; Shift sprint; Ctrl crouch; E interact; left click shoot. Click the game to capture the mouse. Escape releases it. F3 shows diagnostics. Settings do not pause the match. Gamepads retain movement, looking, sprint, crouch and shooting support; use E for house interactions.

## Three rounds

Round one: host hunts. Round two: roles reverse. Each begins with 20 seconds for the hider to disappear. Round three: both hunt after a five-second preparation countdown.

Search lasts five cycles of 20 seconds in your own view and 7 seconds in the opponent's position (135 seconds total). The last three seconds before an exchange show a large countdown and progressively narrow visibility; the hider's warning turns red. Movement remains available during that warning.

During the exchange, **both bodies freeze**, shooting and interactions are disabled, and each player independently rotates their borrowed camera. Neither player's physical aim changes. The round clock continues. Your own original aim returns when the exchange ends. Return labels, sounds, a breathing frame, and a seven-second progress bar mark the boundaries.

Hunters have six bullets. Two body hits or one headshot kills. Hiders have no gun. Surviving or exhausting the hunter's ammunition wins rounds one and two for the hider. In round three, timeout or both guns being empty is a draw. In the last 10 seconds, hunters gain 10% speed and 15% illumination radius; a simultaneous exchange still freezes movement. These are starting balance values, not a guarantee of equal win rates.

A centered round-specific card stays for 3 seconds after every round. The final card leads to results. All three rounds are played. Most round wins wins the match.

A disconnected player gets a 30-second reconnect grace period, during which the match pauses. A browser session token restores their identity, including a spent portrait passage. A fresh match resets the passage, cat, toilet, scores and ammunition.

## The house

The 42 × 42 metre mansion has a library, dining room, chapel, kitchen, bathroom and master bedroom. Shared geometry defines movement and bullet cover. The bathroom has a claw-foot bath, pedestal basin, porcelain toilet, towel rail, tiled floor and framed portrait. Press E nearby to flush the poop away. Only the hider can enter the bathroom portrait: **one use per player per match**, arriving beside the large corridor portrait. The four-poster bedroom includes a vanity, curtains and a sleeping cat that jumps down and flees when a player approaches.

The supplied photographs live locally in `public/assets/`. Their original files are preserved; scene materials add muted engraved coloring. Other textures and geometry are generated locally. Footsteps use filtered noise transients with material-dependent tone; nearby opponent steps are attenuated and panned. Flush audio and the ambient drone use Web Audio. There are no external runtime asset requests.

The visual identity uses indigo ink, aged paper, oxidized copper and vermilion. The entrance title appears only in Hindi; instructions are in English. How to Play is an illustrated newspaper with screenshots and captions.

## Implementation

- `shared/hunt.mjs`: phase durations, server action permissions, hunter boost.
- `shared/mansion.mjs`: rooms, fixtures, collision, interaction locations and portrait exit.
- `shared/game.mjs`: deterministic movement, ray tests and weapon anchors.
- `server.mjs`: authoritative matches and house interaction state.
- `public/mansion.mjs`: architecture, generated textures and figures/revolvers.
- `public/house-details.mjs`: furnishings, portraits, animated flushing and cat.
- `public/client.mjs`: prediction, independent borrowed camera, HUD, interaction prompts and audio.

Static repeated details are instanced by geometry/material. A point light follows the viewed location. Quality adjusts rendering resolution; performance depends on the GPU and viewport.

## Verify

```powershell
npm test
```

Tests use the existing `.browsers` Chromium installation if present. Otherwise install the matching Playwright browser first. The browser test uses two isolated clients and accelerates round deadlines in its fixture. Server tests check the real exact timing boundaries. Historical arena/POV scripts are retained for reference and do not validate the current mansion rules.
