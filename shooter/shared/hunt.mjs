export const RULES = Object.freeze({
  hide: 20000,
  own: 20000,
  reveal: 7000,
  cycles: 5,
  intermission: 5000,
  ammo: 6,
});
export const SEARCH_MS = (RULES.own + RULES.reveal) * RULES.cycles;
export function huntPhase(start, now) {
  const elapsed = Math.max(0, now - start);
  const cycle = Math.min(
    RULES.cycles - 1,
    Math.floor(elapsed / (RULES.own + RULES.reveal)),
  );
  const borrowed = elapsed - cycle * (RULES.own + RULES.reveal) >= RULES.own;
  return {
    cycle: cycle + 1,
    borrowed,
    endsAt:
      start +
      cycle * (RULES.own + RULES.reveal) +
      (borrowed ? RULES.own + RULES.reveal : RULES.own),
    ended: elapsed >= SEARCH_MS,
  };
}
export function roleFor(round, index) {
  return round === 3 ? "hunter" : index === round - 1 ? "hunter" : "hider";
}
export function mayMove(room, player) {
  return (
    !room.pausedAt &&
    player.hp > 0 &&
    (room.stage === "search" ||
      (room.stage === "hide" && player.role === "hider"))
  );
}
export function mayFire(room, player) {
  return (
    !room.pausedAt &&
    room.stage === "search" &&
    player.hp > 0 &&
    player.role === "hunter"
  );
}
