import { SPECIAL, TORCH } from "./hunt.mjs";
import { mansionProps, mansionSpawns } from "./mansion.mjs";
import { blocked, rayBox } from "./game.mjs";

// Walls determine room boundaries; orientation and furniture never gate the prompt.
export function roomAt(p) {
  const row = p.z < -6.75 ? 0 : p.z > 6.75 ? 2 : 1;
  return p.x < -3 ? `west-${row}` : p.x > 3 ? `east-${row}` : "corridor";
}
export function sameRoom(a, b) {
  return (
    roomAt(a) === roomAt(b) &&
    !mansionProps.some(
      (p) =>
        p.kind === "wall" &&
        rayBox(
          a.x,
          1.5,
          a.z,
          b.x - a.x,
          0,
          b.z - a.z,
          [p.x - p.w, 0, p.z - p.d],
          [p.x + p.w, p.h, p.z + p.d],
        ) <= 1,
    )
  );
}
export function canActivateSpecial(room, hunter, hider) {
  return !!(
    room?.state === "playing" &&
    room.stage === "search" &&
    room.round < 3 &&
    !room.pausedAt &&
    !room.paused &&
    !room.borrowed &&
    !room.special &&
    hunter?.role === "hunter" &&
    !hunter.specialUsed &&
    hunter.hp > 0 &&
    hider?.hp > 0 &&
    hider.role === "hider" &&
    Math.hypot(hunter.x - hider.x, hunter.z - hider.z) <= SPECIAL.range &&
    sameRoom(hunter, hider)
  );
}
// Every candidate is in the connected, walkable grid, away from either role's spawn.
function reachableTorchSpawns() {
  const queue = [[0, 0]],
    seen = new Set(["0,0"]),
    candidates = [];
  const starts = [
    mansionSpawns.hunter,
    mansionSpawns.hider,
    ...mansionSpawns.duel,
  ];
  for (let n = 0; n < queue.length; n++) {
    const [x, z] = queue[n];
    if (
      Math.abs(x) >= 6 &&
      x % 2 === 0 &&
      z % 2 === 0 &&
      !blocked(x, z, 2, 0.8) &&
      starts.every(([a, b]) => Math.hypot(x - a, z - b) >= 6)
    )
      candidates.push({ x, z });
    for (const [dx, dz] of [
      [0.5, 0],
      [-0.5, 0],
      [0, 0.5],
      [0, -0.5],
    ]) {
      const a = x + dx,
        b = z + dz,
        key = `${a},${b}`;
      if (!seen.has(key) && !blocked(a, b, 2)) {
        seen.add(key);
        queue.push([a, b]);
      }
    }
  }
  return candidates;
}
export const torchSpawns = reachableTorchSpawns();
export function chooseTorch(random = Math.random) {
  return {
    ...torchSpawns[
      Math.min(
        torchSpawns.length - 1,
        Math.floor(random() * torchSpawns.length),
      )
    ],
    owner: null,
  };
}
export function canTakeTorch(room, player) {
  return !!(
    room.torch &&
    !room.torch.owner &&
    sameRoom(player, room.torch) &&
    Math.hypot(player.x - room.torch.x, player.z - room.torch.z) <= TORCH.range
  );
}
export function visibilityScale(room, viewId, now) {
  const viewed = room?.players.find((p) => p.id === viewId);
  const lastLight =
    viewed?.role === "hunter" &&
    room.stage === "search" &&
    room.end > now &&
    room.end - now <= 10000;
  return room?.torch?.owner === viewId || lastLight ? TORCH.boost : 1;
}
