export function teamScores(players) {
  const roster = [...players];
  return [0, 1].map((team) =>
    roster
      .filter((p) => !p.spectator && p.team === team)
      .reduce((n, p) => n + p.kills, 0),
  );
}
export function shouldEnd(mode, players, limit) {
  const active = [...players].filter((p) => !p.spectator);
  if (mode === "lms")
    return active.length > 1 && active.filter((p) => p.hp > 0).length <= 1;
  if (mode === "team") return Math.max(...teamScores(active)) >= limit;
  return active.some((p) => p.kills >= limit);
}
// Three identical cycles: own camera for 5s, borrowed camera for 15s.
export function perspectivePhase(start, now) {
  const elapsed = Math.max(0, now - start);
  const cycle = Math.min(2, Math.floor(elapsed / 20000));
  const borrowed = elapsed - cycle * 20000 >= 5000;
  return {
    borrowed,
    endsAt: start + cycle * 20000 + (borrowed ? 20000 : 5000),
    ended: elapsed >= 60000,
  };
}
