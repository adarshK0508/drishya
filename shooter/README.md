# दृश्य — Drishya

Two players enter a mansion. A local Node server owns movement, damage, ammunition, roles, round progression, teleport permissions, flushing, and the cat's wake-up time.

## Start

```powershell
npm install
npm start
```

Open the printed local address on the host computer. The second laptop opens the printed LAN address on the same network. Enter the same room code. Both players select Ready; the host opens the doors. Node 20+, WebGL, and desktop browsers are required.

## Controls

WASD move; mouse look; Shift sprint; Ctrl crouch; E interact/pick up torch; F activate the hunter special; left click shoot. The on-screen special prompt is also clickable. Click the game to capture the mouse. Escape releases it. F3 shows diagnostics. Settings do not pause the match. Gamepads retain movement, looking, sprint, crouch and shooting support; use E/F or the prompt for interactions and activation.

## Three rounds

Round one: host hunts. Round two: roles reverse. Each begins with 20 seconds for the hider to disappear. Round three: both hunt after a five-second preparation countdown.

Search lasts five cycles of 20 seconds in your own view and 7 seconds in the opponent's position (135 seconds total). The last three seconds before an exchange show a large countdown and progressively narrow visibility; the hider's warning turns red. Movement remains available during that warning.

During the exchange, **both bodies freeze**, shooting and interactions are disabled, and each player independently rotates their borrowed camera. Neither player's physical aim changes. The round clock continues. Your own original aim returns when the exchange ends. Return labels, sounds, a breathing frame, and a seven-second progress bar mark the boundaries.

Hunters have 20 revolver rounds, each dealing 15 damage. Health is 100 and head hits have the same damage. Hiders have no gun. Surviving or exhausting the hunter's ammunition and special opportunity wins rounds one and two for the hider. In round three, timeout or both guns being empty is a draw. In the last 10 seconds, hunters gain 10% speed and 15% illumination radius; a simultaneous exchange still freezes movement. These are starting balance values, not a guarantee of equal win rates.

## Hunter special and torch

In their own hunter round (1 or 2), a player has one special use. Within 3 metres of the hider in the same room, a prompt appears; press F or click it. Facing/visibility does not matter, furniture does not block activation, and structural walls/room boundaries do. The special is unavailable during a normal exchange, hiding, round 3, or a disconnect pause.

Activation instantly consumes the use and freezes both bodies. The hunter has 3 seconds to turn the camera through the hider's eyes; the hider sees these changes and cannot move, look, shoot or interact. It locks automatically. For the next 3 seconds, the hunter can move and aim their own body while seeing from the hider's completely fixed camera. A distinct gun provides one 70-damage shot, with no revolver ammunition cost. Its projected reticle follows the gun's aim rather than the fixed camera centre; it disappears when the aim leaves the screen.

Firing immediately ends the locked phase, even on a miss. Not firing before the deadline also consumes the opportunity. Either outcome frees the hider and makes their body and held torch invisible to the hunter for 5 seconds. The hunter returns to their own eyes and revolver; both can move and damage remains active. The universal round clock and automatic swapping pause throughout all three special phases, including invisibility, then resume their exact remaining time. A lethal hit ends the round and clears the special. Disconnects pause the branch's timer too.

Each round, including round 3, spawns one torch at a random reachable location away from starting positions. Press E within 1.8m to claim it; the first owner carries it in the left hand until round end with no dropping or stealing. It always grants 15% farther visibility through the holder's eyes, including traditional exchanges and the special camera. It has no projected beam or extra world light, reveals no invisible opponent, and does not stack with the last-light radius increase beyond 15%. Ownership resets next round.

A centered round-specific card stays for 3 seconds after every round. The final card leads to results. All three rounds are played. Most round wins wins the match.

A disconnected player gets a 30-second reconnect grace period, during which the match pauses. A browser session token restores their identity, including a spent portrait passage. A fresh match resets the passage, cat, toilet, scores and ammunition.

## The house

The 42 × 42 metre mansion has a library, dining room, chapel, kitchen, bathroom and master bedroom. Shared geometry defines movement and bullet cover. The bathroom has a claw-foot bath, pedestal basin, porcelain toilet, towel rail, tiled floor and framed portrait. Press E nearby to flush the poop away. Only the hider can enter the bathroom portrait: **one use per player per match**, arriving beside the large corridor portrait. Each round, the first player entering the master bedroom startles the sleeping cat. It jumps clear of the bed, passes through the bedroom doorway, runs down the corridor and fades into the dark library with a rounded route and directional running gait. Nearby players hear its recorded cry; it cannot retrigger until the next round.

The supplied photographs live locally in `public/assets/`. Their original files are preserved; scene materials add muted engraved coloring. Other textures and geometry are generated locally. There are no external runtime asset requests.

## Sound

The ten supplied recordings are bundled under `public/assets/audio/`. On page load `run_once.wav` is attempted once; if the browser requires a gesture, the first click/key enables sound. When it ends, `home_screen_bgm.wav` loops on home, How to Play and lobby without restarting the intro. Starting a match fades out the current track, marks the intro spent and loops `gameplay_bg.mp3` throughout hiding, all three rounds, intermissions and special phases. At match end, the winner hears the supplied Pacific Rim track and the loser hears Heather, each once on their own result screen. A draw uses the home loop. Returning to the lobby restores home music. Music does not pause the match or restart at round boundaries.

`boots.mpeg` was an MP3 recording and is bundled unchanged as `boots.mp3`. Individual impacts are selected from the recording, with distance-based cadence: sprinting is faster, crouching softer, stationary/frozen bodies add no steps. Hunters sound lower/heavier and hiders higher/lighter. Your steps remain centered; the nearby opponent is panned and attenuated from your original body's position, including while viewing through other eyes. That separates simultaneous footsteps without granting extra visual information.

`cat.mp3` plays once on that round's first bedroom entry, with direction/distance following the cat. Regular gunfire uses the supplied pistol recording, while only the special gun's shot uses the special-feature recording. Own shots are centered and opponent shots directional. Both players hear the supplied damage recording once whenever the hider is hit, including special hits, invisibility and lethal hits. It plays centered, without distance attenuation, at a stronger gain (2.4, about 8.5 dB louder than the former victim-only cue), while retaining the master Sound control. Its original M4A is preserved and a PCM WAV copy is used for browser-compatible playback. Existing swap, flush, hit-confirmation and other synthesized cues remain.

Gameplay music stays below effects and briefly ducks for important cues; intro and outcome tracks have a stronger foreground level. The Sound slider controls music and effects, including mute without losing the music playhead. Automated checks verify playback/decoding/state; headphone balance still needs listening on the intended laptops.

The entrance uses the supplied muted eye-video loop over a scratched oxblood surface, preserving the Hindi title and copper/teal accents. How to Play is one fixed newspaper spread: six current gameplay images with close captions, including the portrait hint. Locally bundled Special Elite and IM Fell English SC follow the supplied type reference; headings have subtle stable letter-size variation. Room entry announces the body's actual room at the top and fades over 4.5 seconds, independent of borrowed vision. Victory and defeat have personalized result screens.

## Implementation

- `shared/hunt.mjs`: phase durations, server action permissions, hunter boost.
- `shared/special.mjs`: special eligibility, structural room checks, reachable torch spawns and eye-owned visibility.
- `shared/cat.mjs`: deterministic rounded cat route and animation pose.
- `shared/mansion.mjs`: rooms, fixtures, collision, interaction locations and portrait exit.
- `shared/game.mjs`: deterministic movement, ray tests and weapon anchors.
- `server.mjs`: authoritative matches and house interaction state.
- `public/mansion.mjs`: architecture, generated textures and figures/revolvers.
- `public/house-details.mjs`: furnishings, portraits, animated flushing and cat.
- `public/client.mjs`: prediction, independent borrowed camera, HUD, interaction prompts and audio.
- `public/interface.mjs`: entrance-video lifecycle, accessible distressed headings, body-room notices and personalized outcomes.
- `public/audio.mjs`: supplied music sequencing, autoplay fallback, recorded footstep sampling and positional cat audio.

Static repeated details are instanced by geometry/material. A point light follows the viewed location. Quality adjusts rendering resolution; performance depends on the GPU and viewport.

## Verify

```powershell
npm test
```

Tests use the existing `.browsers` Chromium installation if present. Otherwise install the matching Playwright browser first. The browser test uses two isolated clients and accelerates round deadlines in its fixture. Server tests check the real exact timing boundaries. The sequential visual suite (`npm run test:visual` alone) checks all six guide images/captions at five viewport sizes, local fonts/video, body-based room banners and both personalized outcomes with their native music players. Historical arena/POV scripts are retained for reference and do not validate the current mansion rules.

Each browser verification writes screenshots into a fresh `test-results/browser-<timestamp>/` folder. Its path is recorded in `test-results/mansion-browser.json`; tests do not overwrite the saved game/tutorial assets.
