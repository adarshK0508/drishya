import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { once } from "node:events";
import { server, wss, rooms, step } from "../server.mjs";
import { inputPacket } from "../shared/protocol.mjs";
import { RULES, SEARCH_MS, huntPhase } from "../shared/hunt.mjs";
import { blocked, hit } from "../shared/game.mjs";
import { mansionRooms, mansionSpawns } from "../shared/mansion.mjs";

test("five 20/7 cycles have exact phase boundaries", () => {
  for (let c = 0; c < 5; c++) {
    assert.equal(huntPhase(1000, 1000 + c * 27000 + 19999).borrowed, false);
    assert.equal(huntPhase(1000, 1000 + c * 27000 + 20000).borrowed, true);
    assert.equal(huntPhase(1000, 1000 + c * 27000 + 26999).cycle, c + 1);
  }
  assert.equal(SEARCH_MS, 135000);
  assert.equal(huntPhase(0, 134999).ended, false);
  assert.equal(huntPhase(0, 135000).ended, true);
});
test("mansion rooms and both spawn sets are connected by walkable routes", () => {
  const key = (x, z) => x + "," + z,
    seen = new Set(["0,0"]),
    queue = [[0, 0]];
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i];
    for (const [dx, dz] of [
      [0.5, 0],
      [-0.5, 0],
      [0, 0.5],
      [0, -0.5],
    ]) {
      const a = x + dx,
        b = z + dz,
        k = key(a, b);
      if (!seen.has(k) && !blocked(a, b, 2)) {
        seen.add(k);
        queue.push([a, b]);
      }
    }
  }
  for (const spot of [
    mansionSpawns.hunter,
    mansionSpawns.hider,
    ...mansionSpawns.duel,
    ...mansionRooms.map((r) => [r.x, r.z + 4]),
  ])
    assert.ok(seen.has(key(...spot)), `reachable ${spot}`);
  assert.equal(blocked(22, 0, 2), true);
  assert.equal(
    hit(
      { id: 1, x: 0, y: 0, z: 0 },
      Math.PI / 2,
      0,
      [{ id: 2, x: -6, y: 0, z: 4, hp: 100 }],
      2,
    ),
    null,
  );
});
test("authoritative two-player match: hiding lock, live reveals, limited ammo, role reversal, duel and rematch", async () => {
  const clients = [];
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const wait = (ws, check) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        ws.off("message", handle);
        reject(Error("message timeout"));
      }, 3000);
      function handle(data, binary) {
        if (binary) return;
        const m = JSON.parse(data);
        if (check(m)) {
          clearTimeout(timer);
          ws.off("message", handle);
          resolve(m);
        }
      }
      ws.on("message", handle);
    });
  const send = (ws, m) => ws.send(JSON.stringify(m));
  async function join(code, name, token) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    clients.push(ws);
    await once(ws, "open");
    const joined = wait(ws, (m) => m.type === "joined" || m.type === "error");
    send(ws, { type: "join", code, name, token });
    return { ws, ...(await joined) };
  }
  const flush = () => new Promise((r) => setTimeout(r, 15));
  try {
    const a = await join("", "A");
    let r = rooms.get(a.code);
    const solo = wait(a.ws, (m) => m.type === "error");
    send(a.ws, { type: "ready" });
    send(a.ws, { type: "start" });
    assert.match((await solo).message, /Exactly two/);
    const b = await join(a.code, "B");
    const c = await join(a.code, "C");
    assert.equal(c.type, "error");
    send(b.ws, { type: "ready" });
    await flush();
    send(a.ws, { type: "start" });
    await flush();
    const A = r.players.get(a.id),
      B = r.players.get(b.id);
    let now = r.startedAt - RULES.hide + 10;
    assert.equal(r.round, 1);
    assert.equal(A.role, "hunter");
    assert.equal(B.role, "hider");
    let seqA = 0,
      seqB = 0;
    async function input(p, data = {}) {
      const who = p === A ? a : b;
      who.ws.send(
        inputPacket({
          seq: p === A ? ++seqA : ++seqB,
          keys: 0,
          yaw: 0,
          pitch: 0,
          weapon: 0,
          fov: 75,
          time: now,
          ...data,
        }),
      );
      await flush();
      step(now);
    }
    const az = A.z,
      bz = B.z;
    await input(A, { keys: 1, fire: true });
    await input(B, {
      keys: 1,
      fire: true,
      weapon: 3,
      reload: true,
      grenade: true,
    });
    assert.equal(A.z, az);
    assert.equal(A.ammo[0], 6);
    assert.notEqual(B.z, bz);
    assert.equal(B.ammo[0], 0);
    assert.equal(B.weapon, 0);
    assert.equal(r.grenades.length, 0);
    now = r.startedAt;
    step(now);
    assert.equal(r.stage, "search");
    now = r.startedAt + 20000;
    step(now);
    assert.equal(A.view, B.id);
    assert.equal(B.view, B.id);
    const old = A.z;
    await input(A, { keys: 1 });
    assert.ok(A.z < old);
    assert.equal(A.view, B.id);
    now = r.startedAt + 27000;
    step(now);
    assert.equal(A.view, A.id);
    // Reset in clear hallway; six deliberately missed shots must end the round.
    A.x = 0;
    A.z = 18;
    B.x = 10;
    B.z = 10;
    for (let n = 0; n < 6; n++) {
      now += 700;
      await input(A, { fire: true, reload: true, weapon: 3 });
    }
    assert.equal(A.ammo[0], 0);
    assert.equal(B.points, 1);
    assert.equal(r.stage, "intermission");
    now = r.stageEnd;
    step(now);
    assert.equal(r.round, 2);
    assert.equal(A.role, "hider");
    assert.equal(B.role, "hunter");
    assert.equal(B.ammo[0], 6);
    assert.equal(A.ammo[0], 0);
    now = r.startedAt;
    step(now);
    now = r.end;
    step(now);
    assert.equal(A.points, 1);
    assert.equal(r.stage, "intermission");
    now = r.stageEnd;
    step(now);
    assert.equal(r.round, 3);
    assert.equal(r.stage, "countdown");
    assert.equal(A.role, "hunter");
    assert.equal(B.role, "hunter");
    now = r.startedAt;
    step(now);
    now += 20000;
    step(now);
    assert.equal(A.view, B.id);
    assert.equal(B.view, A.id);
    // Fire from A's own body while seeing B's eyes. One headshot ends the duel.
    A.x = 0;
    A.z = 4;
    A.y = 0;
    B.x = 0.24;
    B.z = 0;
    B.y = 0;
    r.history = [];
    now += 700;
    await input(A, { fire: true, pitch: 0.06 });
    assert.equal(B.hp, 0);
    assert.equal(A.points, 2);
    assert.equal(r.stage, "intermission");
    const ended = wait(a.ws, (m) => m.type === "ended");
    now = r.stageEnd;
    step(now);
    const result = await ended;
    assert.equal(result.winner, A.id);
    assert.equal(result.rounds.length, 3);
    assert.equal(r.state, "ended");
    assert.equal(A.ready, false);
    send(a.ws, { type: "ready" });
    send(b.ws, { type: "ready" });
    await flush();
    send(a.ws, { type: "start" });
    await flush();
    assert.equal(r.round, 1);
    assert.equal(A.points, 0);
    assert.equal(r.results.length, 0);
    // Disconnect pauses the hiding clock; token rejoin restores the same player.
    b.ws.close();
    await once(b.ws, "close");
    await flush();
    now = Date.now();
    step(now);
    assert.ok(r.pausedAt);
    const re = await join(a.code, "B", b.token);
    assert.equal(re.id, b.id);
    step(now + 1000);
    assert.equal(r.pausedAt, 0);
    re.ws.close();
    await once(re.ws, "close");
    await flush();
    step(now + 2000);
    const forfeit = wait(a.ws, (m) => m.type === "ended");
    step(now + 33000);
    assert.equal((await forfeit).winner, A.id);
  } finally {
    for (const ws of clients) ws.terminate();
    for (const ws of wss.clients) ws.terminate();
    await new Promise((resolve) => server.close(resolve));
    wss.close();
    rooms.clear();
  }
});
