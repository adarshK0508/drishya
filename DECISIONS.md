# Decisions — Blackthorn House revision

- Continue the browser/LAN implementation in `shooter/`. Preserve the original Unity prototype.
- Exactly two players; the host hunts first. All three rounds play, one point per round, most points wins. This is the chosen interpretation of the unspecified overall match scoring.
- Use the final explicit cycle timings: 20 seconds own POV, 7 seconds borrowed POV, five cycles. This totals 135 seconds of search, plus 20 seconds hiding in rounds 1–2. It supersedes the earlier 2-minute target.
- Only the hunter borrows the hider's view in rounds 1–2. Hiders retain their view. Both can move and aim during reveals; inputs always control the original body.
- Final round: both armed, reciprocal swaps, five-second countdown, first kill wins that round. Timeout or both empty guns draws the round. Equal match points draw the match.
- One revolver, six shots per hunter per round, no reloads or pickups. Two body hits or one headshot kills. Hiders have no weapons. Exhaustion ends a hunt early with a survival win.
- Crouching lowers camera and hitbox. Disable jumping so furniture and room partitions cannot be climbed out of.
- A 42m square mansion has six connected rooms, cover alcoves, distinguishable patterns and clocks. Pattern ceilings to reduce the usefulness of staring straight up during a reveal.
- No minimap or opponent labels. A single camera-local light and fog limit sight distance. Characters are low-poly figures with body parts and simple leg motion.
- Shared furniture descriptions drive drawing and collision. Batch static boxes by material, share geometry, use small local textures and cap resolution. No external models or texture downloads.
- Pause on disconnect for 30 seconds, resume with shifted timers, otherwise forfeit. No respawns within a round. Clear queued inputs and lag history at round boundaries.
- Prior arena soak metrics and demo claims are historical. Current acceptance checks cover the mansion rules and browser flow; human balance and real-LAN latency require playtesting.
