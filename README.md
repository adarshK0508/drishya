# दृश्य — Drishya

A two-player LAN horror game about borrowed sight. The active browser game is in `shooter/`; the original Unity prototype remains at the repository root.

## Play

```powershell
cd shooter
npm install
npm start
```

Open the printed address in two desktop browsers. The second laptop uses the host laptop's LAN address and the same room code. Both players ready up; the host starts. Node.js 20+ and WebGL are required.

## Rules

- Round 1: host hunts. Round 2: roles reverse. Each begins with 20 seconds to hide while the hunter waits.
- Five cycles of 20 seconds hunting and 7 seconds of exchanged vision make a 135-second hunt.
- A three-second warning narrows both players' illumination, with a red tint for the hider.
- During each exchange, both bodies freeze. Each player independently looks around from the other's position. Shooting and interactions are disabled. **The round timer keeps running.** Original aim returns afterward.
- Hunters have 20 revolver rounds at 15 damage per hit, with 100 health. Head hits have the same damage.
- In rounds 1–2, each hunter has one special opportunity: press F within 3m of the hider in the same room. Choose their view for 3s; then move and aim a separate 70-damage single-shot gun through that fixed second-person view for up to 3s. Firing or timing out frees the hider with 5s of invisibility (damage still applies). Universal time and automatic swaps pause across the entire event, then resume their exact remaining time.
- One random reachable torch per round, including round 3: E picks it up in the left hand for the rest of the round. It increases visibility distance 15% through its holder's eyes, including borrowed views. No beam, dropping, stealing, invisibility reveal, or stacking beyond the existing 15% last-light radius boost.
- The hider wins by surviving or exhausting both the regular ammunition and the special opportunity.
- During the last 10 seconds, hunters gain 10% movement speed and 15% illumination radius. The swap freeze still takes priority.
- Round 3: both hunt; first kill wins. Timeout or both empty guns means a draw.
- Each round ends with a centered announcement for 3 seconds, including the final round before results. Most round wins takes the match.
- The bathroom portrait teleports only hiders to the corridor portrait, once per player per entire match. Press E nearby. E also flushes the toilet. On first bedroom entry each round, the cat cries, jumps off the bed and escapes through the corridor into darkness.
- Supplied intro plays once per page load (first click/key if autoplay is blocked), then home music loops across home/help/lobby. Gameplay music loops across all three rounds. At match end, Pacific Rim plays for the winner and Heather for the loser; draw/lobby uses home music. Hunter footsteps are heavier, hider footsteps lighter; nearby opponent steps are directional.

See [controls and implementation](shooter/README.md). Run `npm test` inside `shooter/` for server and two-browser verification.

For implementation status and continuation with another model, read [IMPLEMENTATION_PROGRESS.md](IMPLEMENTATION_PROGRESS.md).

The entrance blends the supplied eye video over a scratched oxblood surface. How to Play fits six gameplay photographs and their captions in a fixed newspaper spread. Local distressed fonts, subtly uneven heading letters, personalized outcome popups and fading room-entry names complete the interface.
