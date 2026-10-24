import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import os from "node:os";
import { WebSocketServer } from "ws";
import qr from "qrcode-terminal";
import {
  move,
  hit,
  swap,
  validInput,
  weapons,
  pickups,
} from "./shared/game.mjs";
import { readInput, snapshot, signature } from "./shared/protocol.mjs";
const root = path.dirname(fileURLToPath(import.meta.url));
export const rooms = new Map();
let nextId = 1,
  tick = 0;
const metrics = {
  ticks: 0,
  totalTickMs: 0,
  maxTickMs: 0,
  bytes: 0,
  shots: 0,
  hits: 0,
  rejected: 0,
};
const server = http.createServer((req, res) => {
  let u = new URL(req.url, "http://local");
  if (u.pathname === "/metrics") {
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        ...metrics,
        avgTickMs: metrics.totalTickMs / Math.max(1, metrics.ticks),
        rss: process.memoryUsage().rss,
        heap: process.memoryUsage().heapUsed,
        rooms: rooms.size,
        players: [...rooms.values()].reduce((n, r) => n + r.players.size, 0),
      }),
    );
  }
  let name = u.pathname === "/" ? "/index.html" : u.pathname;
  let base = name.startsWith("/shared/") ? root : path.join(root, "public");
  let file = path.resolve(base, "." + name);
  if (!file.startsWith(base + path.sep)) {
    res.writeHead(403);
    return res.end();
  }
  fs.readFile(file, (e, data) => {
    if (e) {
      res.writeHead(404);
      return res.end("Not found");
    }
    res.setHeader(
      "Content-Type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
      }[path.extname(file)] || "application/octet-stream",
    );
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(data);
  });
});
const wss = new WebSocketServer({
  server,
  maxPayload: 2048,
  perMessageDeflate: false,
});
function send(ws, data) {
  if (ws?.readyState === 1 && ws.bufferedAmount < 65536)
    ws.send(typeof data === "string" ? data : JSON.stringify(data));
}
function emit(r, data) {
  for (let p of r.players.values()) send(p.ws, data);
}
function roster(r) {
  emit(r, {
    type: "room",
    code: r.code,
    host: r.host,
    settings: r.settings,
    state: r.state,
    end: r.end,
    swapAt: r.swapAt,
    players: [...r.players.values()].map(
      ({ id, name, ready, spectator, team }) => ({
        id,
        name,
        ready,
        spectator,
        team,
      }),
    ),
  });
}
function spawn(r, p) {
  let spots = [
    [-20, -20],
    [20, 20],
    [-20, 20],
    [20, -20],
    [-18, 12],
    [18, -12],
  ];
  spots.sort(
    (a, b) =>
      Math.min(
        ...[...r.players.values()]
          .filter((q) => q.id !== p.id && q.hp > 0)
          .map((q) => Math.hypot(q.x - b[0], q.z - b[1])),
        99,
      ) -
      Math.min(
        ...[...r.players.values()]
          .filter((q) => q.id !== p.id && q.hp > 0)
          .map((q) => Math.hypot(q.x - a[0], q.z - a[1])),
        99,
      ),
  );
  [p.x, p.z] = spots[0];
  p.y = 0;
  p.vy = 0;
  p.hp = 100;
  p.ammo = weapons.map((w) => w.ammo);
  p.reloadAt = 0;
  p.grenades = 2;
}
function doSwap(r) {
  let ids = [...r.players.values()]
    .filter((p) => !p.spectator && p.hp > 0)
    .map((p) => p.id);
  for (let [id, view] of swap(ids, r.settings.variant))
    r.players.get(id).view = view;
  r.swapAt = Date.now() + 20000 + Math.random() * 10000;
  emit(r, { type: "swap", swapAt: r.swapAt });
}
function finish(r) {
  r.state = "ended";
  emit(r, {
    type: "ended",
    scores: [...r.players.values()]
      .map((p) => ({ name: p.name, kills: p.kills, deaths: p.deaths }))
      .sort((a, b) => b.kills - a.kills),
  });
  roster(r);
}
wss.on("connection", (ws, req) => {
  let p = null,
    r = null,
    budget = 0,
    windowAt = Date.now();
  ws.on("error", () => {});
  ws.on("message", (data, binary) => {
    try {
      let now = Date.now();
      if (now - windowAt > 1000) {
        windowAt = now;
        budget = 0;
      }
      if (++budget > 100) {
        ws.close(1008, "rate limit");
        return;
      }
      if (binary) {
        if (!p || p.spectator || r.state !== "playing") return;
        let i = readInput(
          data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        );
        if (!validInput(i) || i.seq <= p.lastSeq) {
          metrics.rejected++;
          return;
        }
        p.lastSeq = i.seq;
        p.queue.push(i);
        if (p.queue.length > 8) p.queue.shift();
        return;
      }
      let m = JSON.parse(data.toString());
      if (!m || typeof m.type !== "string") throw Error("schema");
      if (m.type === "ping") {
        if (!Number.isFinite(m.time)) throw Error("ping schema");
        send(ws, { type: "pong", client: m.time, server: now });
        return;
      }
      if (m.type === "join" && !p) {
        if (m.token) {
          for (let room of rooms.values()) {
            let old = [...room.players.values()].find(
              (q) => q.token === m.token && !q.ws && now - q.left < 30000,
            );
            if (old) {
              p = old;
              r = room;
              p.ws = ws;
              p.queue = [];
              p.cache = new Map();
              send(ws, {
                type: "joined",
                id: p.id,
                token: p.token,
                code: r.code,
                seq: p.lastSeq,
              });
              roster(r);
              return;
            }
          }
        }
        let code = String(m.code || "").toUpperCase();
        r = code
          ? rooms.get(code)
          : [...rooms.values()].find(
              (q) => q.players.size < 8 && q.state === "lobby",
            );
        if (code && !r) {
          send(ws, { type: "error", message: "Room not found" });
          return;
        }
        if (!r) {
          do {
            code = Array.from(randomBytes(4), (n) =>
              String.fromCharCode(65 + (n % 26)),
            ).join("");
          } while (rooms.has(code));
          r = {
            code,
            players: new Map(),
            host: 0,
            settings: {
              mode: "swap",
              variant: "rotation",
              map: 0,
              theme: 0,
              limit: 20,
              duration: 180,
            },
            state: "lobby",
            history: [],
            swapAt: now + 23000,
            end: 0,
          };
          rooms.set(code, r);
        }
        if (r.players.size >= 8) {
          send(ws, { type: "error", message: "Room full (8 players)" });
          return;
        }
        let name =
          String(m.name || "Pilot")
            .replace(/[^\w -]/g, "")
            .slice(0, 18) || "Pilot";
        if ([...r.players.values()].some((q) => q.name === name))
          name += " " + nextId;
        p = {
          id: nextId++,
          name,
          token: randomBytes(24).toString("hex"),
          ws,
          ready: false,
          spectator: !!m.spectator,
          x: 0,
          y: 0,
          z: 0,
          yaw: 0,
          pitch: 0,
          fov: 75,
          seq: 0,
          lastSeq: 0,
          queue: [],
          keys: 0,
          weapon: 0,
          kills: 0,
          deaths: 0,
          team: r.players.size % 2,
          view: 0,
          lastFire: 0,
          cache: new Map(),
          left: 0,
        };
        p.view = p.id;
        spawn(r, p);
        r.players.set(p.id, p);
        if (!r.host) r.host = p.id;
        send(ws, {
          type: "joined",
          id: p.id,
          token: p.token,
          code: r.code,
          seq: p.lastSeq,
        });
        roster(r);
        return;
      }
      if (!p) return;
      if (m.type === "ready") {
        p.ready = true;
        roster(r);
      }
      if (m.type === "settings" && r.host === p.id && r.state !== "playing") {
        let s = m.settings || {};
        if (["swap", "team", "lms"].includes(s.mode)) r.settings.mode = s.mode;
        if (["rotation", "pair", "kill"].includes(s.variant))
          r.settings.variant = s.variant;
        if ([0, 1].includes(s.map)) r.settings.map = s.map;
        if ([0, 1, 2, 3].includes(s.theme)) r.settings.theme = s.theme;
        roster(r);
      }
      if (m.type === "start" && r.host === p.id && r.state !== "playing") {
        if (
          [...r.players.values()].some((q) => q.ws && !q.spectator && !q.ready)
        ) {
          send(ws, { type: "error", message: "All pilots must ready up" });
          return;
        }
        r.state = "playing";
        r.end = now + r.settings.duration * 1000;
        r.swapAt = now + 23000;
        r.history = [];
        for (let q of r.players.values()) {
          spawn(r, q);
          q.kills = q.deaths = 0;
          q.view = q.id;
        }
        roster(r);
      }
    } catch {
      metrics.rejected++;
      send(ws, { type: "error", message: "Invalid message rejected" });
    }
  });
  ws.on("close", () => {
    if (!p) return;
    p.ws = null;
    p.left = Date.now();
    p.queue = [];
    p.keys = 0;
    if (r.host === p.id)
      r.host = [...r.players.values()].find((q) => q.ws)?.id || p.id;
    roster(r);
  });
});
function step() {
  let begin = performance.now(),
    now = Date.now();
  tick++;
  for (let [code, r] of rooms) {
    for (let [id, p] of r.players)
      if (!p.ws && now - p.left > 30000) {
        r.players.delete(id);
        roster(r);
      }
    if (!r.players.size) {
      rooms.delete(code);
      continue;
    }
    if (r.state === "playing") {
      if (now >= r.end) {
        finish(r);
        continue;
      }
      if (now >= r.swapAt && r.settings.variant !== "kill") doSwap(r);
      for (let p of r.players.values()) {
        if (p.spectator) continue;
        if (p.hp <= 0) {
          if (r.settings.mode !== "lms" && now - p.died > 3000) spawn(r, p);
          continue;
        }
        let i = p.queue.shift();
        if (i) {
          p.seq = i.seq;
          p.keys = i.keys;
          p.inputAt = now;
          p.weapon = i.weapon;
          move(p, i, 1 / 60, r.settings.map);
          if (i.reload && !p.reloadAt) p.reloadAt = now + 1400;
          if (p.reloadAt && now >= p.reloadAt) {
            p.ammo[p.weapon] = weapons[p.weapon].ammo;
            p.reloadAt = 0;
          }
          if (i.fire && !p.reloadAt) {
            let w = weapons[p.weapon];
            if (now - p.lastFire >= w.rate && p.ammo[p.weapon] > 0) {
              p.lastFire = now;
              p.ammo[p.weapon]--;
              metrics.shots++;
              let rewind = Math.max(now - 200, Math.min(now, i.time - 100));
              let past = r.history.findLast((h) => h.time <= rewind)
                ?.players || [...r.players.values()];
              for (let n = 0; n < (w.pellets || 1); n++) {
                let h = hit(
                  p,
                  i.yaw + (Math.random() - 0.5) * w.spread,
                  i.pitch + (Math.random() - 0.5) * w.spread,
                  past,
                  r.settings.map,
                );
                if (h) {
                  let q = r.players.get(h.id);
                  if (
                    q &&
                    q.hp > 0 &&
                    (r.settings.mode !== "team" || q.team !== p.team)
                  ) {
                    metrics.hits++;
                    let damage = w.damage * (h.head ? 2 : 1);
                    q.hp = Math.max(0, q.hp - damage);
                    send(p.ws, { type: "hit", damage, head: h.head });
                    if (!q.hp) {
                      q.deaths++;
                      q.died = now;
                      p.kills++;
                      emit(r, {
                        type: "kill",
                        text: `${p.name} → ${q.name}${h.head ? " · HEADSHOT" : ""}`,
                      });
                      if (r.settings.variant === "kill") doSwap(r);
                      if (p.kills >= r.settings.limit) finish(r);
                    }
                  }
                }
              }
              emit(r, { type: "shot", id: p.id, weapon: p.weapon });
            }
          }
          if (
            i.grenade &&
            p.grenades > 0 &&
            now - (p.lastGrenade || 0) > 1500
          ) {
            p.grenades--;
            p.lastGrenade = now;
            emit(r, {
              type: "kill",
              text: p.name + " deployed a shock grenade",
            });
            for (let q of r.players.values())
              if (
                q.id !== p.id &&
                Math.hypot(q.x - p.x, q.z - p.z) < 6 &&
                q.hp > 0
              ) {
                q.hp = Math.max(1, q.hp - 40);
              }
          }
        } else if (now - (p.inputAt || 0) < 150) {
          move(
            p,
            { keys: p.keys, yaw: p.yaw, pitch: p.pitch, fov: p.fov },
            1 / 60,
            r.settings.map,
          );
        }
        for (let [x, z, type] of pickups)
          if (
            Math.hypot(p.x - x, p.z - z) < 1.2 &&
            now - (p.pickupAt || 0) > 5000
          ) {
            p.pickupAt = now;
            if (type === "health") p.hp = Math.min(100, p.hp + 35);
            else p.ammo[p.weapon] = weapons[p.weapon].ammo;
          }
      }
      if (
        r.settings.mode === "lms" &&
        r.players.size > 1 &&
        [...r.players.values()].filter((p) => !p.spectator && p.hp > 0)
          .length <= 1
      )
        finish(r);
      r.history.push({
        time: now,
        players: [...r.players.values()].map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          z: p.z,
          hp: p.hp,
          spectator: p.spectator,
        })),
      });
      if (r.history.length > 15) r.history.shift();
    }
    if (tick % 3 === 0) {
      for (let p of r.players.values()) {
        if (p.ws?.readyState !== 1) continue;
        let full = tick % 60 === 0 || !p.cache.size,
          changed = [];
        for (let q of r.players.values()) {
          if (
            q.id !== p.id &&
            q.id !== p.view &&
            Math.hypot(q.x - p.x, q.z - p.z) > 55
          )
            continue;
          let sig = signature(q);
          if (full || p.cache.get(q.id) !== sig) {
            changed.push(q);
            p.cache.set(q.id, sig);
          }
        }
        let b = snapshot(changed, tick, now, p.seq, full);
        if (p.ws.bufferedAmount < 65536) {
          p.ws.send(b);
          metrics.bytes += b.byteLength;
        }
      }
    }
  }
  let elapsed = performance.now() - begin;
  metrics.ticks++;
  metrics.totalTickMs += elapsed;
  metrics.maxTickMs = Math.max(metrics.maxTickMs, elapsed);
}
// Deadline accumulator keeps simulation steps fixed even when timer callbacks jitter.
let last = performance.now(),
  acc = 0;
const timer = setInterval(() => {
  let now = performance.now();
  acc += Math.min(100, now - last);
  last = now;
  while (acc >= 1000 / 60) {
    step();
    acc -= 1000 / 60;
  }
}, 4);
const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`PARALLAX http://localhost:${port}`);
  for (let list of Object.values(os.networkInterfaces()))
    for (let n of list || [])
      if (n.family === "IPv4" && !n.internal) {
        let url = `http://${n.address}:${port}`;
        console.log("LAN " + url);
        qr.generate(url, { small: true });
      }
});
function close() {
  clearInterval(timer);
  for (let ws of wss.clients) ws.terminate();
  server.close(() => process.exit());
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
