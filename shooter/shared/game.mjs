// Shared deterministic movement and geometry: client inputs never contain positions.
export const DT = 1 / 60,
  SIZE = 24;
export const weapons = [
  { name: "Pistol", rate: 320, damage: 27, ammo: 12, spread: 0.012 },
  { name: "SMG", rate: 95, damage: 12, ammo: 30, spread: 0.045 },
  { name: "Shotgun", rate: 850, damage: 13, ammo: 6, spread: 0.12, pellets: 7 },
  { name: "Sniper", rate: 1200, damage: 80, ammo: 5, spread: 0.002 },
];
export const maps = [
  [
    [0, 0, 3, 2, 3],
    [-10, -7, 3, 5, 3],
    [10, 7, 3, 5, 3],
    [-8, 9, 5, 2, 2],
    [8, -9, 5, 2, 2],
    [-15, 4, 3, 3, 0.75],
    [15, -4, 3, 3, 0.75],
  ],
  [
    [0, 0, 2, 7, 3],
    [-10, 0, 2, 7, 2],
    [10, 0, 2, 7, 2],
    [0, 14, 8, 2, 3],
    [0, -14, 8, 2, 3],
    [-16, -15, 3, 3, 0.75],
    [16, 15, 3, 3, 0.75],
  ],
];
export const pickups = [
  [-17, 0, "health"],
  [17, 0, "health"],
  [0, 18, "ammo"],
  [0, -18, "ammo"],
];
export function blocked(x, z, map = 0, r = 0.4, y = 0) {
  return (
    Math.abs(x) > SIZE - r ||
    Math.abs(z) > SIZE - r ||
    maps[map].some(
      ([a, b, w, d, h]) =>
        y < h - 0.08 && Math.abs(x - a) < w + r && Math.abs(z - b) < d + r,
    )
  );
}
export function move(p, i, dt = DT, map = 0) {
  let x = (i.keys & 8 ? 1 : 0) - (i.keys & 4 ? 1 : 0),
    z = (i.keys & 2 ? 1 : 0) - (i.keys & 1 ? 1 : 0);
  let l = Math.hypot(x, z) || 1,
    s = i.keys & 32 ? 2.5 : i.keys & 16 ? 8 : 5.4;
  let dx = ((x * Math.cos(i.yaw) + z * Math.sin(i.yaw)) / l) * s * dt,
    dz = ((-x * Math.sin(i.yaw) + z * Math.cos(i.yaw)) / l) * s * dt;
  if (!blocked(p.x + dx, p.z, map, 0.4, p.y)) p.x += dx;
  if (!blocked(p.x, p.z + dz, map, 0.4, p.y)) p.z += dz;
  const support = maps[map].reduce(
    (height, [a, b, w, d, h]) =>
      p.y >= h - 0.1 &&
      Math.abs(p.x - a) < w + 0.4 &&
      Math.abs(p.z - b) < d + 0.4
        ? Math.max(height, h)
        : height,
    0,
  );
  if (i.keys & 64 && p.y <= support + 0.001) {
    p.vy = 6;
  }
  p.vy = (p.vy || 0) - 18 * dt;
  p.y = Math.max(support, (p.y || 0) + p.vy * dt);
  if (p.y === support && p.vy < 0) p.vy = 0;
  p.yaw = i.yaw;
  p.pitch = i.pitch;
  p.fov = i.fov;
}
// Shared gun geometry anchor: world-space barrel tip (or body center).
export function gunPosition(p, distance = 0.72) {
  const yaw = p.yaw || 0,
    pitch = p.pitch || 0;
  return {
    x: p.x + Math.cos(yaw) * 0.24 - Math.sin(yaw) * Math.cos(pitch) * distance,
    y: p.y + 1.35 + Math.sin(pitch) * distance,
    z: p.z - Math.sin(yaw) * 0.24 - Math.cos(yaw) * Math.cos(pitch) * distance,
  };
}
export function rayBox(ox, oy, oz, dx, dy, dz, min, max) {
  let lo = 0,
    hi = 100;
  for (let a = 0; a < 3; a++) {
    let o = [ox, oy, oz][a],
      d = [dx, dy, dz][a];
    if (Math.abs(d) < 1e-8) {
      if (o < min[a] || o > max[a]) return Infinity;
      continue;
    }
    let t = (min[a] - o) / d,
      u = (max[a] - o) / d;
    lo = Math.max(lo, Math.min(t, u));
    hi = Math.min(hi, Math.max(t, u));
    if (lo > hi) return Infinity;
  }
  return lo;
}
export function visible(from, to, map = 0) {
  const ox = from.x,
    oy = (from.y || 0) + 1.5,
    oz = from.z;
  const dx = to.x - ox,
    dy = (to.y || 0) + 1.5 - oy,
    dz = to.z - oz;
  for (const [x, z, w, d, h] of maps[map])
    if (
      rayBox(ox, oy, oz, dx, dy, dz, [x - w, 0, z - d], [x + w, h, z + d]) < 1
    )
      return false;
  return true;
}
export function spawnChoice(spots, players, map = 0) {
  if (!players.length) return spots[0];
  return spots.reduce((best, spot) => {
    const score = (candidate) =>
      Math.min(
        ...players.map(
          (q) =>
            Math.hypot(q.x - candidate[0], q.z - candidate[1]) -
            (visible({ x: candidate[0], z: candidate[1] }, q, map) ? 100 : 0),
        ),
      );
    return score(spot) > score(best) ? spot : best;
  });
}
export function hit(origin, yaw, pitch, players, map = 0) {
  let dx = -Math.sin(yaw) * Math.cos(pitch),
    dy = Math.sin(pitch),
    dz = -Math.cos(yaw) * Math.cos(pitch),
    best = 100,
    result = null;
  for (let [x, z, w, d, h] of maps[map])
    best = Math.min(
      best,
      rayBox(
        origin.x,
        origin.y + 1.5,
        origin.z,
        dx,
        dy,
        dz,
        [x - w, 0, z - d],
        [x + w, h, z + d],
      ),
    );
  for (let p of players) {
    if (p.id === origin.id || p.hp <= 0 || p.spectator) continue;
    let t = rayBox(
      origin.x,
      origin.y + 1.5,
      origin.z,
      dx,
      dy,
      dz,
      [p.x - 0.4, p.y, p.z - 0.4],
      [p.x + 0.4, p.y + 1.8, p.z + 0.4],
    );
    if (t < best) {
      best = t;
      result = { id: p.id, head: origin.y + 1.5 + dy * t > p.y + 1.35 };
    }
  }
  return result;
}
export function swap(ids, variant = "rotation", random = Math.random) {
  if (ids.length < 2) return new Map(ids.map((id) => [id, id]));
  if (variant === "pair") {
    let a = Math.floor(random() * ids.length),
      b = (a + 1 + Math.floor(random() * (ids.length - 1))) % ids.length;
    return new Map(
      ids.map((id, i) => [id, i === a ? ids[b] : i === b ? ids[a] : id]),
    );
  }
  return new Map(ids.map((id, i) => [id, ids[(i + 1) % ids.length]]));
}
export function validInput(i) {
  return (
    i &&
    Number.isInteger(i.seq) &&
    i.seq >= 0 &&
    i.seq <= 4294967295 &&
    Number.isInteger(i.keys) &&
    i.keys >= 0 &&
    i.keys < 128 &&
    Number.isFinite(i.yaw) &&
    Math.abs(i.yaw) <= Math.PI + 0.01 &&
    Number.isFinite(i.pitch) &&
    Math.abs(i.pitch) <= 1.55 &&
    Number.isFinite(i.time) &&
    Number.isInteger(i.weapon) &&
    i.weapon >= 0 &&
    i.weapon < 4 &&
    Number.isFinite(i.fov) &&
    i.fov >= 30 &&
    i.fov <= 110
  );
}
