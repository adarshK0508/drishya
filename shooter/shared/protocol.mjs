// Network byte order: 28-byte input; snapshots carry changed 26-byte entities.
export function inputPacket(i) {
  let b = new ArrayBuffer(28),
    v = new DataView(b);
  v.setUint8(0, 1);
  v.setUint32(1, i.seq);
  v.setUint8(5, i.keys);
  v.setFloat32(6, i.yaw);
  v.setFloat32(10, i.pitch);
  v.setFloat64(14, i.time);
  v.setUint8(22, i.weapon);
  v.setUint8(23, (i.fire ? 1 : 0) | (i.reload ? 2 : 0) | (i.grenade ? 4 : 0));
  v.setUint8(24, i.fov);
  return b;
}
export function readInput(b) {
  let v = new DataView(b);
  if (b.byteLength !== 28 || v.getUint8(0) !== 1)
    throw Error("input size/type");
  return {
    seq: v.getUint32(1),
    keys: v.getUint8(5),
    yaw: v.getFloat32(6),
    pitch: v.getFloat32(10),
    time: v.getFloat64(14),
    weapon: v.getUint8(22),
    fire: !!(v.getUint8(23) & 1),
    reload: !!(v.getUint8(23) & 2),
    grenade: !!(v.getUint8(23) & 4),
    fov: v.getUint8(24),
  };
}
export function signature(p) {
  return [
    Math.round(p.x * 100),
    Math.round(p.y * 100),
    Math.round(p.z * 100),
    Math.round(p.yaw * 1000),
    Math.round(p.pitch * 1000),
    p.hp,
    p.kills,
    p.ammo[p.weapon],
    p.view,
    p.fov,
    p.weapon,
    p.seq,
  ].join(",");
}
export function snapshot(players, tick, time, ack, full = false) {
  let b = new ArrayBuffer(20 + players.length * 26),
    v = new DataView(b);
  v.setUint8(0, 2);
  v.setUint8(1, full ? 1 : 0);
  v.setUint32(2, tick);
  v.setFloat64(6, time);
  v.setUint32(14, ack);
  v.setUint16(18, players.length);
  players.forEach((p, n) => {
    let o = 20 + n * 26;
    v.setUint16(o, p.id);
    v.setInt16(o + 2, Math.round(p.x * 100));
    v.setInt16(o + 4, Math.round(p.y * 100));
    v.setInt16(o + 6, Math.round(p.z * 100));
    v.setInt16(o + 8, Math.round(p.yaw * 1000));
    v.setInt16(o + 10, Math.round(p.pitch * 1000));
    v.setUint8(o + 12, p.hp);
    v.setUint16(o + 13, p.kills);
    v.setUint8(o + 15, p.ammo[p.weapon]);
    v.setUint16(o + 16, p.view);
    v.setUint8(o + 18, p.fov);
    v.setUint8(o + 19, p.weapon);
    v.setUint32(o + 20, p.seq);
    v.setUint8(o + 24, p.team);
    v.setUint8(o + 25, p.spectator ? 1 : 0);
  });
  return b;
}
export function readSnapshot(b) {
  let v = new DataView(b);
  if (
    b.byteLength < 20 ||
    v.getUint8(0) !== 2 ||
    b.byteLength !== 20 + v.getUint16(18) * 26
  )
    throw Error("snapshot size");
  let players = [];
  for (let n = 0; n < v.getUint16(18); n++) {
    let o = 20 + n * 26;
    players.push({
      id: v.getUint16(o),
      x: v.getInt16(o + 2) / 100,
      y: v.getInt16(o + 4) / 100,
      z: v.getInt16(o + 6) / 100,
      yaw: v.getInt16(o + 8) / 1000,
      pitch: v.getInt16(o + 10) / 1000,
      hp: v.getUint8(o + 12),
      kills: v.getUint16(o + 13),
      ammo: v.getUint8(o + 15),
      view: v.getUint16(o + 16),
      fov: v.getUint8(o + 18),
      weapon: v.getUint8(o + 19),
      seq: v.getUint32(o + 20),
      team: v.getUint8(o + 24),
      spectator: !!v.getUint8(o + 25),
    });
  }
  return {
    tick: v.getUint32(2),
    time: v.getFloat64(6),
    ack: v.getUint32(14),
    full: !!v.getUint8(1),
    players,
  };
}
