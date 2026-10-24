# PARALLAX — Blackthorn House

Two players enter an old, dark mansion. One hunts through brief glimpses of the other's eyes. A local Node server owns movement, damage, ammunition, role assignment and round progression.

## Start

Node 20+ and a desktop browser with WebGL:

```powershell
npm install
npm start
```

Default address: http://localhost:3000. The server prints a LAN address for the other laptop. Both players must use the **same server**, room code, and ready up. The first player is host and hunts first. Exactly two players are required; spectators are disabled.

For another port in PowerShell:

```powershell
$env:PORT = '3001'
npm start
```

## Controls

WASD move; mouse look; Shift sprint; Ctrl crouch; left click fire. Click the game to capture the mouse, then click to shoot. Escape releases it. F3 toggles diagnostics. Gamepads support sticks, left-stick press for sprint, A for crouching, and right trigger for shooting. Settings do not pause the online match.

There is one revolver with six rounds per hunter per round. No reloads, other weapons, ammunition pickups, health pickups, or grenades. Each player has 100 health: body damage is 50, head damage is 100. The hider has no weapon. Crouching lowers both the camera and hitbox. Jumping is disabled in the mansion.

## Three rounds

| Round | Roles | Setup | Search |
| --- | --- | --- | --- |
| 1 | Host hunts, guest hides | 20 seconds hiding; hunter locked and blinded | 20s own POV + 7s hider POV, five cycles |
| 2 | Guest hunts, host hides | Same setup and spawn positions with roles reversed | Same five cycles |
| 3 | Both hunt | Five-second countdown at opposing room spawns | Same cycle, with reciprocal POV swaps; first kill wins |

Five cycles take **135 seconds**, not 120. This follows the final requested cycle count and durations. Both players move during reveals; movement and firing always belong to the original body. The hider controls the direction of the live view. The camera owner's body is hidden, and their illumination travels with the view. Everyone's FOV is fixed at 75 degrees; visibility distance is limited by an 11m light and fog fading to black at 13m.

A kill ends a round immediately. In rounds 1–2, timeout or the hunter using all six bullets without killing awards the hider a point. In round 3, timeout or both players exhausting their ammunition produces a draw. Five seconds separate rounds. All three rounds are played, even at 2–0. Most round wins takes the match; equal points give a match draw.

A disconnect pauses the match for up to 30 seconds. Rejoining with the browser session token restores the same player and shifts the deadlines. Failure to return forfeits the match to the connected player. A rematch resets scores, ammo and roles and requires both players to ready up again.

## Mansion and performance

The mansion occupies 42 × 42 metres: Library, Study, Dining Room, Kitchen, Chapel and Bedroom, joined by a central hall and doors between adjacent rooms. Wardrobes, freestanding screens, bookcases, desks, counters, beds and pews provide cover. Walkable space behind tall furniture allows hiding and repositioning. Rugs, wall panels, clocks and patterned ceilings provide clues even when the hider avoids looking at a doorway.

Geometry and textures are generated locally. Static boxes share geometry and are batched by material with instancing. Two human figures use faceted heads, coats, arms and animated legs. A single point light follows the current viewpoint. There are no expensive real-time shadows or external assets. Pixel ratio is capped and drops to 0.55 after sustained low FPS. The scene is approximately 5,200 triangles and 50 draw calls; actual FPS depends on the machine.

## Implementation

- `shared/mansion.mjs`: room layout, furniture and common collision boxes.
- `shared/hunt.mjs`: timing, roles, movement and firing permissions.
- `shared/game.mjs`: shared movement, crouching, ray tests and gun positions.
- `server.mjs`: two-player admission, authoritative round states, damage, reconnect and snapshots.
- `public/mansion.mjs`: generated architecture, surface patterns and human figures.
- `public/client.mjs`: input prediction, camera borrowing, interpolation, HUD and audio.

Existing 28-byte inputs and delta snapshots remain. Snapshots now include crouching in their flags. The server clamps lag compensation to 200ms, checks barrel cover and enforces the single weapon regardless of requested weapon index. Old arena geometry remains solely for legacy movement tests.

## Verify

```powershell
npx playwright install chromium
npm test
```

The browser check uses the repository's `.browsers` installation if present. It launches its own isolated server, inspects two browser clients, and accelerates round deadlines in the fixture. See `TEST_REPORT.md` for the current checks and limits. Earlier arena screenshots, soak scripts and POV regression harness are historical and do not validate the mansion rules.
