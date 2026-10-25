import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { WebSocket } from "ws";
import { server, wss, rooms, step } from "../server.mjs";
import { inputPacket } from "../shared/protocol.mjs";
import {
  SPECIAL,
  RULES,
  SEARCH_MS,
  mayMove,
  mayFire,
} from "../shared/hunt.mjs";
import { weapons, blocked } from "../shared/game.mjs";
import {
  canActivateSpecial,
  sameRoom,
  canTakeTorch,
  torchSpawns,
  chooseTorch,
  visibilityScale,
} from "../shared/special.mjs";

test("special eligibility ignores facing and furniture but requires same room, range and an unspent hunter round", () => {
  const r = { state: "playing", stage: "search", round: 1 };
  const a = { id: 1, role: "hunter", hp: 100, x: -8, z: -13, yaw: Math.PI };
  const b = { id: 2, role: "hider", hp: 100, x: -8, z: -10 };
  assert.equal(canActivateSpecial(r, a, b), true);
  assert.equal(canActivateSpecial(r, a, { ...b, z: -9.999 }), false);
  assert.equal(canActivateSpecial(r, { ...a, specialUsed: true }, b), false);
  assert.equal(canActivateSpecial({ ...r, round: 3 }, a, b), false);
  assert.equal(canActivateSpecial({ ...r, borrowed: true }, a, b), false);
  assert.equal(canActivateSpecial({ ...r, pausedAt: 1 }, a, b), false);
  assert.equal(sameRoom({ x: 2.5, z: 5 }, { x: 3.5, z: 5 }), false);
  assert.equal(sameRoom({ x: -8, z: -7.2 }, { x: -8, z: -6.3 }), false);
  // Opposite sides of the library screen, which is furniture rather than a wall.
  assert.equal(
    canActivateSpecial(
      r,
      { ...a, x: -9.5, z: -16.3 },
      { ...b, x: -8.1, z: -16.3 },
    ),
    true,
  );
  assert.equal(RULES.ammo, 20);
  assert.equal(weapons[0].damage, 15);
  assert.equal(weapons[1].damage, 70);
});

test("torch candidates are walkable; pickup is exclusive and eye-owned light never stacks above 15%", () => {
  assert.ok(torchSpawns.length > 20);
  for (const p of torchSpawns) assert.equal(blocked(p.x, p.z, 2, 0.8), false);
  assert.notDeepEqual(
    chooseTorch(() => 0),
    chooseTorch(() => 0.99),
  );
  const r = {
    stage: "search",
    end: 20000,
    torch: { x: -8, z: -12, owner: null },
    players: [
      { id: 1, role: "hunter" },
      { id: 2, role: "hider" },
    ],
  };
  assert.equal(canTakeTorch(r, { x: -8, z: -11 }), true);
  assert.equal(canTakeTorch(r, { x: 0, z: 0 }), false);
  r.torch.owner = 2;
  assert.equal(canTakeTorch(r, { x: -8, z: -12 }), false);
  assert.equal(visibilityScale(r, 2, 5000), 1.15);
  assert.equal(visibilityScale(r, 1, 5000), 1);
  r.torch.owner = 1;
  assert.equal(visibilityScale(r, 1, 15000), 1.15);
});

test("authoritative special sequence, damage, independent clock, miss/timeout escapes, torch ownership and duel restrictions", async () => {
  const clients = [];
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `ws://127.0.0.1:${server.address().port}`;
  const flush = () => new Promise((resolve) => setTimeout(resolve, 15));
  const send = (ws, m) => ws.send(JSON.stringify(m));
  async function join(code, name, token) {
    const ws = new WebSocket(url);
    clients.push(ws);
    await once(ws, "open");
    const joined = new Promise((resolve) =>
      ws.on("message", (data, binary) => {
        if (!binary) {
          const m = JSON.parse(data);
          if (m.type === "joined") resolve(m);
        }
      }),
    );
    send(ws, { type: "join", code, name, token });
    return { ws, ...(await joined) };
  }
  try {
    const a = await join("", "A"),
      b = await join(a.code, "B");
    const receivedA = [],
      receivedB = [];
    for (const [client, messages] of [
      [a, receivedA],
      [b, receivedB],
    ])
      client.ws.on("message", (data, binary) => {
        if (!binary) messages.push(JSON.parse(data));
      });
    send(a.ws, { type: "ready" });
    send(b.ws, { type: "ready" });
    await flush();
    send(a.ws, { type: "start" });
    await flush();
    const r = rooms.get(a.code),
      A = r.players.get(a.id),
      B = r.players.get(b.id);
    let now = Date.now();
    r.startedAt = now - 1000;
    r.stageEnd = r.startedAt;
    r.end = r.startedAt + SEARCH_MS;
    step(now);
    const sequences = new Map();
    async function input(player, ws, data = {}) {
      const seq = (sequences.get(player.id) || 0) + 1;
      sequences.set(player.id, seq);
      ws.send(
        inputPacket({
          seq,
          keys: 0,
          yaw: 0,
          pitch: 0,
          fov: 75,
          time: now,
          weapon: 0,
          ...data,
        }),
      );
      await flush();
      step(now);
    }
    Object.assign(A, { x: 0, z: 3, y: 0, yaw: Math.PI });
    Object.assign(B, { x: 0.24, z: 0, y: 0 });
    r.torch = { x: 0, z: 3, owner: null };
    send(a.ws, { type: "interact", target: "torch" });
    await flush();
    assert.equal(r.torch.owner, A.id);
    send(b.ws, { type: "interact", target: "torch" });
    await flush();
    assert.equal(r.torch.owner, A.id, "ownership cannot be stolen");
    // Move within 3m; no need to be looking at the hider.
    A.z = 2.5;
    const end = r.end,
      swapAt = r.swapAt,
      startedAt = r.startedAt;
    send(a.ws, { type: "special" });
    await flush();
    assert.equal(r.special.phase, "setup");
    assert.equal(r.special.phaseEnd - r.special.startedAt, 3000);
    assert.equal(A.specialUsed, true);
    assert.equal(A.view, B.id);
    assert.equal(B.view, B.id);
    now = r.special.startedAt + 100;
    await input(A, a.ws, { keys: 8, yaw: 1.2, pitch: 0.2, fire: true });
    await input(B, b.ws, { keys: 1, yaw: 2, fire: true });
    assert.equal(A.x, 0);
    assert.equal(B.z, 0);
    assert.equal(A.yaw, Math.PI);
    assert.equal(B.yaw, Math.PI);
    assert.ok(Math.abs(r.special.camera.yaw - 1.2) < 0.001);
    assert.equal(A.ammo[0], 20);
    assert.equal(A.ammo[1], 1);
    assert.equal(mayMove(r, A), false);
    assert.equal(mayFire(r, A), false);
    now = r.special.phaseEnd - 1;
    step(now);
    assert.equal(
      r.special.phase,
      "setup",
      "vision stays adjustable until 3 seconds",
    );
    now++;
    step(now);
    assert.equal(r.special.phase, "action");
    assert.equal(r.special.phaseEnd - now, 3000);
    const camera = { ...r.special.camera };
    assert.equal(mayMove(r, A), true);
    assert.equal(mayMove(r, B), false);
    now += 50;
    await input(A, a.ws, { keys: 8, yaw: 0 });
    assert.ok(A.x > 0);
    assert.deepEqual(r.special.camera, camera);
    A.x = 0;
    r.history = [];
    now += 700;
    await input(A, a.ws, { fire: true });
    assert.equal(B.hp, 30, "special hit does exactly 70 damage");
    await flush();
    assert.deepEqual(
      receivedB
        .filter((m) => m.type === "hurt")
        .map(({ damage, weapon }) => ({ damage, weapon })),
      [{ damage: 70, weapon: 1 }],
    );
    assert.deepEqual(
      receivedA.filter((m) => m.type === "hurt"),
      receivedB.filter((m) => m.type === "hurt"),
      "both players hear the same special-hit hider damage cue",
    );
    assert.equal(A.ammo[0], 20);
    assert.equal(A.ammo[1], 0);
    assert.equal(r.special.phase, "invisible");
    assert.equal(A.view, A.id);
    assert.equal(B.view, B.id);
    assert.equal(mayMove(r, B), true);
    assert.equal(mayFire(r, A), true);
    assert.equal(r.end, end, "universal deadline stays frozen during special");
    now += 700;
    await input(A, a.ws, { fire: true, pitch: 0.06 });
    assert.equal(
      B.hp,
      15,
      "invisible hider can take flat 15 damage even at head height",
    );
    assert.equal(A.ammo[0], 19);
    await flush();
    assert.deepEqual(
      receivedB
        .filter((m) => m.type === "hurt")
        .map(({ damage, weapon }) => ({ damage, weapon })),
      [
        { damage: 70, weapon: 1 },
        { damage: 15, weapon: 0 },
      ],
    );
    assert.deepEqual(
      receivedA.filter((m) => m.type === "hurt"),
      receivedB.filter((m) => m.type === "hurt"),
      "both players also hear regular hits on an invisible hider exactly once",
    );
    const finishAt = r.special.phaseEnd,
      duration = finishAt - r.special.startedAt;
    now = finishAt - 1;
    step(now);
    assert.equal(r.special.phase, "invisible");
    now = finishAt;
    step(now);
    assert.equal(r.special, null);
    assert.equal(r.end, end + duration);
    assert.equal(r.swapAt, swapAt + duration);
    assert.equal(r.startedAt, startedAt + duration);
    send(a.ws, { type: "special" });
    await flush();
    assert.equal(r.special, null);
    // The next scheduled normal exchange retains its exact remaining time.
    now = r.swapAt - 1;
    step(now);
    assert.equal(r.borrowed, false);
    now = r.swapAt;
    step(now);
    assert.equal(r.borrowed, true);
    assert.equal(A.view, B.id);
    assert.equal(B.view, A.id);
    now = r.end;
    step(now);
    now = r.stageEnd;
    step(now);
    assert.equal(r.round, 2);
    assert.equal(B.specialUsed, false);
    assert.equal(r.torch.owner, null);
    // Timeout path grants invisibility without firing or spending revolver ammo.
    now = Date.now();
    r.stage = "search";
    r.startedAt = now - 1000;
    r.end = r.startedAt + SEARCH_MS;
    r.swapAt = r.startedAt + RULES.own;
    Object.assign(B, { x: -8, z: -12, y: 0 });
    Object.assign(A, { x: -8, z: -10, y: 0 });
    send(b.ws, { type: "special" });
    await flush();
    assert.equal(r.special.phase, "setup");
    now = r.special.phaseEnd;
    step(now);
    const actionEnd = r.special.phaseEnd;
    now = actionEnd - 1;
    step(now);
    assert.equal(
      r.special.phase,
      "action",
      "kill window stays open until 3 seconds",
    );
    now = actionEnd;
    step(now);
    assert.equal(r.special.phase, "invisible");
    assert.equal(r.special.phaseEnd - now, 5000);
    assert.equal(B.ammo[0], 20);
    assert.equal(B.ammo[1], 1);
    assert.equal(B.specialUsed, true);
    // Reconnection pauses the branch and does not consume invisibility time.
    b.ws.close();
    await once(b.ws, "close");
    await flush();
    step(now + 100);
    const pausedEnd = r.special.phaseEnd,
      pausedAt = r.pausedAt;
    const re = await join(a.code, "B", b.token);
    step(pausedAt + 1000);
    assert.equal(r.special.phaseEnd, pausedEnd + 1000);
    now = r.special.phaseEnd;
    step(now);
    assert.equal(r.special, null);
    now = r.end;
    step(now);
    now = r.stageEnd;
    step(now);
    assert.equal(r.round, 3);
    assert.equal(r.torch.owner, null);
    now = r.startedAt;
    step(now);
    Object.assign(A, { x: 0, z: 2 });
    Object.assign(B, { x: 0, z: 0 });
    send(a.ws, { type: "special" });
    send(re.ws, { type: "special" });
    await flush();
    assert.equal(r.special, null, "neither player may use special in round 3");
    // Start a fresh match through real messages, then exercise a missed shot.
    now = r.end;
    step(now);
    now = r.stageEnd;
    step(now);
    send(a.ws, { type: "ready" });
    send(re.ws, { type: "ready" });
    await flush();
    send(a.ws, { type: "start" });
    await flush();
    r.stage = "search";
    now = Date.now();
    r.startedAt = now - 1000;
    r.end = r.startedAt + SEARCH_MS;
    r.swapAt = now + 19000;
    Object.assign(A, { x: 0, z: 2 });
    Object.assign(B, { x: 0, z: 0 });
    assert.equal(A.specialUsed, false);
    send(a.ws, { type: "special" });
    await flush();
    now = r.special.phaseEnd;
    step(now);
    now += 50;
    await input(A, a.ws, { fire: true, yaw: Math.PI });
    assert.equal(B.hp, 100);
    assert.equal(r.special.phase, "invisible", "a miss still grants escape");
    assert.equal(A.ammo[0], 20);
    assert.equal(A.ammo[1], 0);
    B.hp = 15;
    r.history = [];
    now += 700;
    await input(A, a.ws, { fire: true, yaw: 0 });
    assert.equal(B.hp, 0);
    assert.equal(r.stage, "intermission");
    assert.equal(
      r.special,
      null,
      "a lethal shot during invisibility clears branch state",
    );
    assert.equal(A.view, A.id);
    assert.equal(B.view, B.id);
  } finally {
    for (const ws of clients) ws.terminate();
    for (const ws of wss.clients) ws.terminate();
    await new Promise((resolve) => server.close(resolve));
    wss.close();
    rooms.clear();
  }
});
