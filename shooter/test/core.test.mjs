import { test } from "node:test";
import assert from "node:assert/strict";
import { move, hit, swap, validInput, blocked } from "../shared/game.mjs";
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
