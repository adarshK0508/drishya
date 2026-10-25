import { test } from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { once } from "node:events";
import { server, wss, rooms, step } from "../server.mjs";
import { inputPacket } from "../shared/protocol.mjs";
import {
  RULES,
  SEARCH_MS,
  huntPhase,
  hunterBoost,
  mayMove,
  mayFire,
} from "../shared/hunt.mjs";
import { blocked, hit } from "../shared/game.mjs";
import {
  mansionRooms,
  mansionSpawns,
  portraitExit,
} from "../shared/mansion.mjs";

test("last-light boost has exact boundaries and never grants hiders speed", () => {
  const room = { stage: "search", end: 20000 };
  assert.equal(hunterBoost(room, { role: "hunter" }, 9999), false);
  assert.equal(hunterBoost(room, { role: "hunter" }, 10000), true);
  assert.equal(hunterBoost(room, { role: "hunter" }, 20000), false);
  assert.equal(hunterBoost(room, { role: "hider" }, 15000), false);
  for (const role of ["hunter", "hider"]) {
    assert.equal(
      mayMove({ ...room, borrowed: true }, { role, hp: 100 }),
      false,
    );
    assert.equal(
      mayFire({ ...room, borrowed: true }, { role, hp: 100 }),
      false,
    );
  }
});

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
    assert.equal(B.view, A.id);
    const old = A.z,
      otherOld = B.z,
      end = r.end;
    await input(A, { keys: 1, fire: true, yaw: 1.2 });
    await input(B, { keys: 1, fire: true });
    assert.equal(A.z, old);
    assert.equal(B.z, otherOld);
    assert.equal(A.ammo[0], 6);
    assert.equal(r.end, end, "swap never extends the round clock");
    Object.assign(B, { x: 8, z: -19 });
    send(b.ws, { type: "interact", target: "portrait" });
    await flush();
    assert.equal(B.teleportUsed, false, "interactions disabled during swap");
    assert.equal(A.view, B.id);
    now = r.startedAt + 27000;
    step(now);
    assert.equal(A.view, A.id);
    assert.equal(B.view, B.id);
    Object.assign(A, { x: 8, z: -19 });
    send(a.ws, { type: "interact", target: "portrait" });
    await flush();
    assert.equal(A.teleportUsed, false, "hunter cannot use portrait");
    send(b.ws, { type: "interact", target: "portrait" });
    await flush();
    assert.equal(B.teleportUsed, true);
    assert.equal(B.x, portraitExit.x);
    assert.equal(B.z, portraitExit.z);
    Object.assign(B, { x: 8, z: -19 });
    send(b.ws, { type: "interact", target: "portrait" });
    await flush();
    assert.equal(B.x, 8, "cannot reuse passage");
    send(b.ws, { type: "interact", target: "toilet" });
    await flush();
    assert.ok(!r.flushed, "distant interactions rejected");
    Object.assign(B, { x: 17, z: -17.2 });
    send(b.ws, { type: "interact", target: "toilet" });
    await flush();
    assert.equal(r.flushed, true);
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
    assert.equal(r.stageEnd - now, 3000);
    now = r.stageEnd;
    step(now);
    assert.equal(r.round, 2);
    assert.equal(A.role, "hider");
    assert.equal(B.role, "hunter");
    assert.equal(B.ammo[0], 6);
    assert.equal(A.ammo[0], 0);
    assert.equal(B.teleportUsed, true, "round change preserves spent passage");
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
    // The duel also freezes both players; firing resumes only after their eyes return.
    A.x = 0;
    A.z = 4;
    A.y = 0;
    B.x = 0.24;
    B.z = 0;
    B.y = 0;
    r.history = [];
    now += 700;
    await input(A, { fire: true, pitch: 0.06 });
    assert.equal(B.hp, 100);
    assert.equal(A.ammo[0], 6);
    now = r.startedAt + 27000;
    step(now);
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
    assert.equal(B.teleportUsed, false, "new match restores passage");
    assert.equal(r.flushed, false);
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
