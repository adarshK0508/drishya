# PARALLAX — Blackthorn House

A two-player LAN horror game with live perspective borrowing. The active implementation is in `shooter/`; the original Unity prototype is preserved at the repository root.

## Play

```powershell
cd shooter
npm install
npm start
```

Open the printed address on two desktop browsers. The second laptop uses the host laptop's LAN address, then the same room code. Both players ready up; the host starts. Node.js 20+ and WebGL are required.

The mansion has six rooms, real furniture cover, room-specific rugs and patterned ceilings, clocks, low-poly human figures, and a small sphere of illumination. See [game rules and controls](shooter/README.md).

## Revised rules

- Round 1: host hunts, other player hides. Round 2 reverses the roles.
- Each starts with 20 seconds for hiding while the hunter waits behind a blackout screen.
- Search repeats 20 seconds of own POV and 7 seconds of live hider POV, five times. **That is 135 seconds of search**, plus hiding time.
- Both players may move during reveals. Only the hunter borrows eyes; the hider retains their own view.
- Hunters have one six-shot revolver. Hiders are unarmed. Two body shots or one headshot kills.
- Survival or an empty hunter's gun wins the round for the hider.
- Round 3 starts with a five-second countdown. Both players hunt and exchange POV. First kill wins the round; timeout or both empty guns is a draw.
- All three rounds are played. Most round wins takes the match; equal scores produce a draw.

Run `npm test` inside `shooter/` for the unit, server and two-browser checks. [Verification details](shooter/TEST_REPORT.md).
