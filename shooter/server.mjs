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
  maps,
  spawnChoice,
  visible,
  gunPosition,
} from "./shared/game.mjs";
import { readInput, snapshot, signature } from "./shared/protocol.mjs";
import { teamScores, perspectivePhase } from "./shared/match.mjs";
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
  try {
    let u = new URL(req.url, "http://local");
    if (u.pathname === "/metrics") {
      res.setHeader("Content-Type", "application/json");
      return res.end(
        JSON.stringify({
          ...metrics,
          avgTickMs:
            metrics.totalTickMs /
            Math.max(1, metrics.ticks - (metrics.excludedTicks || 0)),
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
  } catch {
    res.writeHead(400);
    res.end("Bad request");
  }
});
const wss = new WebSocketServer({
  server,
  maxPayload: 2048,
  perMessageDeflate: false,
  verifyClient(info, done) {
    if (wss.clients.size >= 128) return done(false, 503, "Capacity reached");
    if (!info.origin) return done(true);
    try {
      return done(new URL(info.origin).host === info.req.headers.host);
    } catch {
      return done(false, 403, "Origin rejected");
    }
  },
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
    borrowed: !!r.borrowed,
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
  [p.x, p.z] = spawnChoice(
    spots,
    [...r.players.values()].filter(
      (q) => q.id !== p.id && q.hp > 0 && !q.spectator,
    ),
    r.settings.map,
  );
  p.y = 0;
  p.vy = 0;
  p.hp = 100;
  p.ammo = weapons.map((w) => w.ammo);
  p.reloadAt = 0;
  p.grenades = 2;
  p.view = p.id;
}
function doSwap(r) {
  let ids = [...r.players.values()]
    .filter((p) => !p.spectator && p.hp > 0)
    .map((p) => p.id);
  for (let [id, view] of swap(ids, "rotation"))
    r.players.get(id).view = r.borrowed ? view : id;
}
function finish(r) {
  if (r.state !== "playing") return;
  r.state = "ended";
  emit(r, {
    type: "ended",
    scores: [...r.players.values()]
      .map((p) => ({
        name: p.name,
        kills: p.kills,
        deaths: p.deaths,
        team: p.team,
        spectator: p.spectator,
      }))
      .sort((a, b) => b.kills - a.kills),
    teams: teamScores(r.players.values()),
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
              duration: 60,
            },
            state: "lobby",
            history: [],
            grenades: [],
            swapAt: now + 5000,
            borrowed: false,
            startedAt: 0,
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
        if (p.spectator && r.state === "playing")
          p.view =
            [...r.players.values()].find((q) => !q.spectator)?.id || p.id;
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
      if (m.type === "spectate" && p.spectator) {
        const targets = [...r.players.values()].filter(
          (q) => !q.spectator && q.hp > 0,
        );
        const index = targets.findIndex((q) => q.id === p.view);
        p.view = targets[(index + 1) % targets.length]?.id || p.id;
        return;
      }
      if (m.type === "ready") {
        p.ready = true;
        roster(r);
      }
      if (m.type === "settings" && r.host === p.id && r.state !== "playing") {
        let s = m.settings || {};
        if (["swap", "team", "lms"].includes(s.mode)) r.settings.mode = s.mode;
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
        r.startedAt = now;
        r.end = now + 60000;
        r.borrowed = false;
        r.swapAt = now + 5000;
        r.history = [];
        r.grenades = [];
        for (let q of r.players.values()) {
          spawn(r, q);
          q.kills = q.deaths = 0;
          q.cache.clear();
        }
        const first = [...r.players.values()].find((q) => !q.spectator);
        for (let q of r.players.values())
          if (q.spectator) q.view = first?.id || q.id;
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
      const phase = perspectivePhase(r.startedAt, now);
      if (phase.borrowed !== r.borrowed || phase.endsAt !== r.swapAt) {
        r.borrowed = phase.borrowed;
        r.swapAt = phase.endsAt;
        emit(r, { type: "swap", swapAt: r.swapAt, borrowed: r.borrowed });
      }
      // Rebuild assignments after deaths, respawns and disconnects as well.
      doSwap(r);
      for (let n = r.grenades.length - 1; n >= 0; n--) {
        const g = r.grenades[n];
        g.x += g.vx / 60;
        g.y += g.vy / 60;
        g.z += g.vz / 60;
        g.vy -= 18 / 60;
        const collision =
          g.y <= 0 ||
          Math.abs(g.x) >= 24 ||
          Math.abs(g.z) >= 24 ||
          maps[r.settings.map].some(
            ([x, z, w, d, h]) =>
              Math.abs(g.x - x) < w && Math.abs(g.z - z) < d && g.y < h,
          );
        if (!collision && now < g.end) continue;
        r.grenades.splice(n, 1);
        emit(r, { type: "blast", x: g.x, y: Math.max(0, g.y), z: g.z });
        const owner = r.players.get(g.owner);
        for (const q of r.players.values()) {
          const range = Math.hypot(q.x - g.x, q.z - g.z);
          if (
            q.id === g.owner ||
            q.spectator ||
            q.hp <= 0 ||
            range >= 5 ||
            (r.settings.mode === "team" && owner?.team === q.team) ||
            !visible(
              { x: g.x, y: Math.max(0, g.y) - 1.3, z: g.z },
              q,
              r.settings.map,
            )
          )
            continue;
          const damage = Math.round(75 * (1 - range / 5));
          q.hp = Math.max(0, q.hp - damage);
          if (owner) send(owner.ws, { type: "hit", damage, head: false });
          if (!q.hp && owner) {
            q.deaths++;
            q.died = now;
            q.view = owner.id;
            owner.kills++;
            emit(r, {
              type: "kill",
              text: `${owner.name} → ${q.name} · GRENADE`,
            });
          }
        }
      }
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
              const muzzle = gunPosition(p);
              const gunOrigin = {
                ...p,
                x: muzzle.x,
                y: muzzle.y - 1.5,
                z: muzzle.z,
              };
              const clearBarrel = visible(p, gunOrigin, r.settings.map);
              for (let n = 0; n < (w.pellets || 1); n++) {
                let h =
                  clearBarrel &&
                  hit(
                    gunOrigin,
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
                    send(p.ws, {
                      type: "hit",
                      damage,
                      head: h.head,
                      inputTime: i.time,
                    });
                    if (!q.hp) {
                      q.deaths++;
                      q.died = now;
                      q.view = p.id;
                      p.kills++;
                      emit(r, {
                        type: "kill",
                        text: `${p.name} → ${q.name}${h.head ? " · HEADSHOT" : ""}`,
                      });
                    }
                  }
                }
              }
              emit(r, {
                type: "shot",
                id: p.id,
                weapon: p.weapon,
                x: p.x,
                y: p.y,
                z: p.z,
                yaw: i.yaw,
                pitch: i.pitch,
              });
            }
          }
          if (
            i.grenade &&
            p.grenades > 0 &&
            now - (p.lastGrenade || 0) > 1500
          ) {
            p.grenades--;
            p.lastGrenade = now;
            const speed = 12,
              horiz = Math.cos(i.pitch);
            const g = {
              owner: p.id,
              x: p.x,
              y: p.y + 1.45,
              z: p.z,
              vx: -Math.sin(i.yaw) * horiz * speed,
              vy: Math.sin(i.pitch) * speed + 3,
              vz: -Math.cos(i.yaw) * horiz * speed,
              end: now + 2000,
            };
            r.grenades.push(g);
            emit(r, {
              type: "grenade",
              x: g.x,
              y: g.y,
              z: g.z,
              vx: g.vx,
              vy: g.vy,
              vz: g.vz,
            });
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
      doSwap(r);
      for (const spectator of r.players.values())
        if (
          spectator.spectator &&
          (!r.players.get(spectator.view) ||
            r.players.get(spectator.view).hp <= 0)
        )
          spectator.view =
            [...r.players.values()].find((q) => !q.spectator && q.hp > 0)?.id ||
            spectator.id;
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
            Math.hypot(q.x - p.x, q.z - p.z) > 80 &&
            Math.hypot(
              q.x - (r.players.get(p.view)?.x ?? p.x),
              q.z - (r.players.get(p.view)?.z ?? p.z),
            ) > 80
          ) {
            p.cache.delete(q.id);
            continue;
          }
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
  if (elapsed > 250) {
    metrics.suspendedMs = (metrics.suspendedMs || 0) + elapsed;
    metrics.excludedTicks = (metrics.excludedTicks || 0) + 1;
  } else {
    metrics.totalTickMs += elapsed;
    metrics.maxTickMs = Math.max(metrics.maxTickMs, elapsed);
  }
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
process.on("uncaughtException", (error) => {
  console.error("Fatal server error:", error);
  close();
});
process.on("unhandledRejection", (error) => {
  console.error("Unhandled server rejection:", error);
  close();
});
server.on("error", (error) => {
  console.error("Server listener error:", error.message);
  clearInterval(timer);
  process.exit(1);
});
wss.on("error", (error) => {
  console.error("WebSocket listener error:", error.message);
  close();
});
