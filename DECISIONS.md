# Decisions — Blackthorn House revision

- Continue the browser/LAN implementation in `shooter/`. Preserve the original Unity prototype.
- Exactly two players; the host hunts first. All three rounds play, one point per round, most points wins. This is the chosen interpretation of the unspecified overall match scoring.
- Use the final explicit cycle timings: 20 seconds own POV, 7 seconds borrowed POV, five cycles. This totals 135 seconds of search, plus 20 seconds hiding in rounds 1–2. It supersedes the earlier 2-minute target.
- Traditional exchanges are reciprocal in every round: both bodies freeze, both can independently look from the opponent's position, shooting/interactions stop and universal time continues. Original body aim returns afterward.
- Final round: both armed, reciprocal swaps, five-second countdown, first kill wins that round. Timeout or both empty guns draws the round. Equal match points draw the match.
- One revolver, 20 rounds at flat 15 damage per hit, no reloads/ammo pickups, health 100. Hiders have no weapons. Exhaustion ends a hunt after regular ammunition and special opportunity are spent; do not interrupt an active special/invisibility phase for ammo exhaustion.
- Crouching lowers camera and hitbox. Disable jumping so furniture and room partitions cannot be climbed out of.
- A 42m square mansion has six connected rooms, cover alcoves, distinguishable patterns and clocks. Pattern ceilings to reduce the usefulness of staring straight up during a reveal.
- No minimap or opponent labels. A single camera-local light and fog limit sight distance. Characters are low-poly figures with body parts and simple leg motion.
- Shared furniture descriptions drive drawing and collision. Batch static boxes by material, share geometry, use small local textures and cap resolution. No external models or texture downloads.
- Pause on disconnect for 30 seconds, resume with shifted timers, otherwise forfeit. No respawns within a round. Clear queued inputs and lag history at round boundaries.
- Prior arena soak metrics and demo claims are historical. Current acceptance checks cover the mansion rules and browser flow; human balance and real-LAN latency require playtesting.

## 25 October 2026 — special ability and torch

- Special is once per player in their hunter round, never round 3. F activates instantly within 3m in the same structural room, with no facing/visibility check and no infection timer. Available during own-view search only.
- Separate 3s camera setup, up to 3s second-person action, and 5s invisibility timers (latest timing revision). Universal countdown and automatic swapping pause for the entire branch, resuming exact remaining time. Disconnect pauses both systems.
- Setup: bodies frozen, hunter turns hider's camera, hider sees it with no controls. Action: fixed camera, moving/aiming hunter, frozen hider, separate one-shot 70-damage gun. All damage is flat (no head multiplier).
- Shot or timeout grants the moving hider 5s invisibility to hunter, including held items. Damage and regular revolver remain active. Death/round termination cleans up branch state.
- One random reachable torch every round, exclusive ownership until round end, E pickup, left-hand model, 15% sight-distance boost belonging to viewed eyes. No beam, through-wall reveal or invisibility bypass. Cap combined torch/last-light sight boost at 15%.
- `IMPLEMENTATION_PROGRESS.md` is the ongoing model handoff; update it at milestones and before stopping.

## 25 October 2026 — supplied sound and cat

- Play supplied run_once once per page load, attempting autoplay and falling back to the first click/key. Then loop home_screen_bgm across home, How to Play and lobby. Starting a match interrupts intro/home with a short fade; gameplay_bg loops through the entire three-round match and all branch/round phases. Results return to home music without replaying intro.
- Preserve supplied recordings locally. boots.mpeg is MP3 audio, renamed boots.mp3 without re-encoding. Stream music with audio MIME/byte-range support; decode small effects through Web Audio.
- Footsteps belong to original bodies: own centered, opponent attenuated/panned by physical direction/distance. Use lower/heavier hunter and higher/lighter hider treatment of individual boot impacts so simultaneous steps can be distinguished. Movement distance drives cadence; crouch is quieter, sprint faster, frozen/stationary adds none.
- First master-bedroom entry each round starts cat cry/escape. Reset next round. Jump off bed, take a collision-safe rounded route through bedroom doorway and corridor, fade in dark library. Animation uses independent wall time during special; disconnect shifts its epoch.
- Keep music below effects, apply slight ducking for important sounds, and keep the existing master Sound slider. Headphone listening/balance remains a human check.
- Combat recordings: pistol sound for regular revolver, spl_feature sound for special gun firing (not activation), damage_received for BOTH players whenever the hider is hit (latest correction). Broadcast a per-hit event so damage sound is independent of snapshot coalescing and still occurs on lethal/invisible hits. Preserve shooter hit-confirmation and other existing UI cues. Preserve all original recordings. Bundled Chromium could not decode supplied M4A through Web Audio, so use a derived 44.1kHz mono PCM WAV compatibility copy; keep original M4A and audio/mp4 serving support.


## 25 October 2026 — requested visual revision

- Use supplied eye WebM as a muted looping entrance layer with screen blending over scratched oxblood; no runtime Downloads links. Pause it in matches. Hindi title and copper/teal accents stay.
- Six guide photographs fit a single fixed newspaper spread. Captions stay adjacent; portrait hint uses the user's exact wording. Use real rendered game images, rather than invented controls/art.
- User supplied a font specimen image, so approximate its distressed print style with licensed, locally bundled Special Elite and IM Fell English SC. Small deterministic heading letter-size changes; stable numeric HUD and accessible complete text labels.
- Personalized final-match winner/loser screens use Pacific Rim/Heather respectively, playing once until lobby exit; draw remains neutral with home music. This supersedes earlier home music for every result. Ignore ended roster updates for track selection.
- Room arrival follows the actual controlled body's structural room, never the borrowed camera. Fade over 4.5 seconds. No universal timer changes.

Latest damage-audio correction: both clients hear the same centered damage_received cue once on each hider hit, without distance attenuation, including special/invisible/lethal hits. Gain 2.4 replaces 0.9; master volume still applies. Earlier victim-only behavior is superseded.
