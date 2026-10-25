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
- Hunters have six bullets: two body hits or one headshot kills. The hider wins by surviving or exhausting the hunter's ammunition.
- During the last 10 seconds, hunters gain 10% movement speed and 15% illumination radius. The swap freeze still takes priority.
- Round 3: both hunt; first kill wins. Timeout or both empty guns means a draw.
- Each round ends with a centered announcement for 3 seconds, including the final round before results. Most round wins takes the match.
- The bathroom portrait teleports only hiders to the corridor portrait, once per player per entire match. Press E nearby. E also flushes the toilet. The bedroom cat flees when approached.

See [controls and implementation](shooter/README.md). Run `npm test` inside `shooter/` for server and two-browser verification.
