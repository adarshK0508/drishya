import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
import { inputPacket } from "../shared/protocol.mjs";
test("room lifecycle, schema rejection, reconnect, host migration and capacity", async () => {
  let server = spawn(process.execPath, ["server.mjs"], {
      env: { ...process.env, PORT: "3093" },
      stdio: "ignore",
    }),
    clients = [];
  function wait(ws, predicate) {
    return new Promise((resolve, reject) => {
      let timer = setTimeout(() => {
        ws.off("message", listener);
        reject(Error("message timeout"));
      }, 5000);
      function listener(b, binary) {
        if (binary) return;
        let m = JSON.parse(b);
        if (predicate(m)) {
          clearTimeout(timer);
          ws.off("message", listener);
          resolve(m);
        }
      }
      ws.on("message", listener);
    });
  }
  async function join(m) {
    let ws = new WebSocket("ws://127.0.0.1:3093");
    clients.push(ws);
    await new Promise((r) => ws.on("open", r));
    let result = wait(ws, (m) => m.type === "joined" || m.type === "error");
    ws.send(JSON.stringify({ type: "join", ...m }));
    return [ws, await result];
  }
  try {
    for (let i = 0; i < 100; i++) {
      try {
        await fetch("http://127.0.0.1:3093/metrics");
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    let [a, one] = await join({ name: "Same" }),
      [b, two] = await join({ name: "Same", code: one.code });
    assert.match(one.code, /^[A-Z]{4}$/);
    let ready = wait(a, (m) => m.type === "room");
    a.send(JSON.stringify({ type: "ready" }));
    let roster = await ready;
    assert.notEqual(roster.players[0].name, roster.players[1].name);
    let bad = wait(a, (m) => m.type === "error");
    a.send("{");
    assert.equal((await bad).message, "Invalid message rejected");
    let missing = await join({ code: "1234" });
    assert.equal(missing[1].type, "error");
    let migration = wait(b, (m) => m.type === "room" && m.host === two.id);
    a.close();
    await migration;
    let [reconnected, again] = await join({ token: one.token });
    assert.equal(again.id, one.id);
    for (let n = 0; n < 6; n++) await join({ code: one.code });
    let overflow = await join({ code: one.code });
    assert.equal(overflow[1].message, "Room full (8 players)");
    let metric = await (await fetch("http://127.0.0.1:3093/metrics")).json();
    assert.ok(metric.rejected >= 1);
    assert.equal(metric.players, 8);
  } finally {
    for (let ws of clients) ws.terminate();
    server.kill();
  }
});
