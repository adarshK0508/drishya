import { test } from "node:test";
import assert from "node:assert/strict";
import { move, hit, swap, validInput, blocked } from "../shared/game.mjs";
import { spawnChoice, visible } from "../shared/game.mjs";
import { teamScores, shouldEnd, perspectivePhase } from "../shared/match.mjs";
import { gunPosition } from "../shared/game.mjs";
import {
  inputPacket,
  readInput,
  snapshot,
  readSnapshot,
} from "../shared/protocol.mjs";
const input = {
  seq: 4,
  keys: 1,
  yaw: 0,
  pitch: 0,
  time: 1000,
  weapon: 0,
  fire: true,
  reload: false,
  grenade: false,
  fov: 75,
};
test("input binary round trip", () =>
  assert.deepEqual(readInput(inputPacket(input)), input));
test("snapshot quantization and acknowledgement", () => {
  let p = {
    id: 1,
    x: 1.234,
    y: 0,
    vy: -2.17,
    z: -2.345,
    yaw: 0.2,
    pitch: 0.1,
    hp: 100,
    kills: 2,
    ammo: [12],
    weapon: 0,
    view: 2,
    fov: 75,
    seq: 4,
    team: 0,
  };
  let s = readSnapshot(snapshot([p], 30, 1000, 4, true));
  assert.equal(s.ack, 4);
  assert.equal(s.players[0].x, 1.23);
  assert.equal(s.players[0].view, 2);
  assert.equal(s.players[0].vy, -2.17);
});
test("60-second round contains exactly three own/borrowed cycles", () => {
  for (let cycle = 0; cycle < 3; cycle++) {
    const start = 1000,
      base = cycle * 20000;
    assert.equal(perspectivePhase(start, start + base).borrowed, false);
    assert.equal(perspectivePhase(start, start + base + 4999).borrowed, false);
    assert.equal(perspectivePhase(start, start + base + 5000).borrowed, true);
    assert.equal(perspectivePhase(start, start + base + 19999).borrowed, true);
  }
  assert.equal(perspectivePhase(1000, 60999).ended, false);
  assert.equal(perspectivePhase(1000, 61000).ended, true);
});
test("jump reconciliation replays from authoritative vertical velocity", () => {
  const p = {
    id: 1,
    x: -20,
    y: 0,
    z: -20,
    vy: 0,
    hp: 100,
    ammo: [12],
    weapon: 0,
    view: 1,
    fov: 75,
    seq: 0,
    team: 0,
  };
  const neutral = { ...input, keys: 0 };
  move(p, { ...neutral, keys: 64 });
  for (let step = 0; step < 9; step++) move(p, neutral);
  const restored = readSnapshot(snapshot([p], 1, 0, 0)).players[0];
  for (let step = 0; step < 4; step++) {
    move(p, neutral);
    move(restored, neutral);
  }
  assert.ok(Math.abs(p.y - restored.y) < 0.011);
  assert.ok(Math.abs(p.vy - restored.vy) < 0.011);
  for (let step = 0; step < 100; step++) move(restored, neutral);
  assert.equal(restored.y, 0);
  assert.equal(restored.vy, 0);
});
test("muzzle belongs to firing body regardless of camera assignment", () => {
  const p = { x: 4, y: 1, z: 9, yaw: 0, pitch: 0, view: 1 };
  assert.deepEqual(gunPosition(p), { x: 4.24, y: 2.35, z: 8.28 });
  assert.deepEqual(gunPosition({ ...p, view: 2 }), gunPosition(p));
});
test("malformed packets rejected", () => {
  assert.throws(() => readInput(new ArrayBuffer(2)));
  assert.throws(() => readSnapshot(new ArrayBuffer(20)));
  assert.equal(validInput({ ...input, yaw: NaN }), false);
  assert.equal(validInput({ ...input, keys: 255 }), false);
  assert.equal(validInput(input), true);
});
test("fixed movement speed, diagonal normalization and collision", () => {
  let p = { x: -20, y: 0, z: 0 };
  for (let n = 0; n < 60; n++) move(p, { ...input, keys: 9 });
  assert.ok(Math.abs(Math.hypot(p.x + 20, p.z) - 5.4) < 0.01);
  assert.equal(blocked(0, 0), true);
  p = { x: 4, y: 0, z: 0 };
  for (let n = 0; n < 120; n++) move(p, { ...input, keys: 4 });
  assert.ok(p.x >= 3.4);
});
test("rotation and pair permutations", () => {
  let s = swap([1, 2, 3]);
  assert.deepEqual([...s.values()], [2, 3, 1]);
  let pair = swap([1, 2, 3], "pair", () => 0);
  assert.deepEqual([...pair.values()], [2, 1, 3]);
  assert.equal(swap([1]).get(1), 1);
});
test("rewind hits historical hitbox; cover blocks line of sight", () => {
  let origin = { id: 1, x: -18, y: 0, z: 10 };
  assert.equal(
    hit(origin, 0, 0, [{ id: 2, x: -18, y: 0, z: 5, hp: 100 }]).id,
    2,
  );
  assert.equal(
    hit(origin, 0, 0, [{ id: 2, x: -15, y: 0, z: 5, hp: 100 }]),
    null,
  );
  assert.equal(
    hit({ id: 1, x: 0, y: 0, z: 10 }, 0, 0, [
      { id: 2, x: 0, y: 0, z: -10, hp: 100 },
    ]),
    null,
  );
});
test("team score, LMS and deathmatch end conditions", () => {
  const players = [
    { team: 0, kills: 2, hp: 100 },
    { team: 1, kills: 4, hp: 0 },
    { team: 0, kills: 3, hp: 100 },
    { team: 1, kills: 99, hp: 100, spectator: true },
  ];
  assert.deepEqual(teamScores(players.values()), [5, 4]);
  assert.equal(shouldEnd("team", players.values(), 5), true);
  assert.equal(shouldEnd("swap", players.values(), 5), false);
  assert.equal(shouldEnd("lms", players.values(), 5), false);
  players[2].hp = 0;
  assert.equal(shouldEnd("lms", players.values(), 5), true);
});
test("upper ground is reachable and spawn favors cover", () => {
  let p = { x: -15, y: 0, z: 7.5, yaw: 0, pitch: 0, vy: 0 };
  for (let n = 0; n < 18; n++)
    move(p, { keys: 64, yaw: 0, pitch: 0, fov: 75 }, 1 / 60, 0);
  for (let n = 0; n < 60; n++)
    move(p, { keys: 1, yaw: 0, pitch: 0, fov: 75 }, 1 / 60, 0);
  assert.ok(p.y >= 0.74);
  let selected = spawnChoice(
    [
      [8, 7],
      [-20, 20],
    ],
    [{ x: 20, z: 20, y: 0, hp: 100 }],
    0,
  );
  assert.deepEqual(selected, [8, 7]);
  assert.equal(
    visible({ x: selected[0], z: selected[1] }, { x: 20, z: 20 }, 0),
    false,
  );
  assert.equal(visible({ x: 0, z: 10 }, { x: 0, z: -10 }, 0), false);
});
