import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
import { inputPacket, readSnapshot } from "../shared/protocol.mjs";

test("team lobby, spectator camera and grenade lifecycle", async () => {
  const port = 3097,
    server = spawn(process.execPath, ["server.mjs"], {
      env: { ...process.env, PORT: String(port) },
      stdio: "ignore",
    }),
    clients = [];
  const wait = (ws, check) =>
    new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        ws.off("message", handle);
        reject(Error("event timeout"));
      }, 5000);
      function handle(data, binary) {
        let message = binary
          ? readSnapshot(
              data.buffer.slice(
                data.byteOffset,
                data.byteOffset + data.byteLength,
              ),
            )
          : JSON.parse(data);
        if (check(message)) {
          clearTimeout(timeout);
          ws.off("message", handle);
          resolve(message);
        }
      }
      ws.on("message", handle);
    });
  async function join(code, name, spectator = false) {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    clients.push(ws);
    await new Promise((resolve) => ws.on("open", resolve));
    const joined = wait(ws, (m) => m.type === "joined");
    ws.send(JSON.stringify({ type: "join", code, name, spectator }));
    return { ws, ...(await joined) };
  }
  try {
    for (let n = 0; n < 100; n++) {
      try {
        await fetch(`http://127.0.0.1:${port}/metrics`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    const a = await join("", "Alpha"),
      b = await join(a.code, "Beta");
    a.ws.send(
      JSON.stringify({
        type: "settings",
        settings: { mode: "team", map: 1, limit: 5, duration: 60 },
      }),
    );
    a.ws.send(JSON.stringify({ type: "ready" }));
    const allReady = wait(
      a.ws,
      (m) =>
        m.type === "room" &&
        m.players.filter((p) => !p.spectator).length === 2 &&
        m.players.filter((p) => !p.spectator).every((p) => p.ready),
    );
    b.ws.send(JSON.stringify({ type: "ready" }));
    await allReady;
    const started = wait(
      b.ws,
      (m) => m.type === "room" && m.state === "playing",
    );
    a.ws.send(JSON.stringify({ type: "start" }));
    assert.equal((await started).settings.mode, "team");
    const c = await join(a.code, "Observer", true),
      observed = wait(c.ws, (m) =>
        m.players?.some((p) => p.id === c.id && p.view !== c.id),
      );
    const state = await observed;
    assert.ok(state.players.find((p) => p.id === c.id).view !== c.id);
    const thrown = wait(b.ws, (m) => m.type === "grenade"),
      blast = wait(b.ws, (m) => m.type === "blast");
    a.ws.send(
      inputPacket({
        seq: 1,
        keys: 0,
        yaw: 0,
        pitch: 0,
        time: Date.now(),
        weapon: 0,
        grenade: true,
        fov: 75,
      }),
    );
    assert.ok(Number.isFinite((await thrown).x));
    assert.ok(Number.isFinite((await blast).x));
    c.ws.send(JSON.stringify({ type: "spectate" }));
    const next = wait(c.ws, (m) =>
      m.players?.some((p) => p.id === c.id && p.view === b.id),
    );
    assert.equal((await next).players.find((p) => p.id === c.id).view, b.id);
  } finally {
    for (let ws of clients) ws.terminate();
    server.kill();
  }
});
