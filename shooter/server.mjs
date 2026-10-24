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
import {
  RULES,
  SEARCH_MS,
  huntPhase,
  roleFor,
  mayMove,
  mayFire,
} from "./shared/hunt.mjs";
import { mansionSpawns } from "./shared/mansion.mjs";
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
    stage: r.stage,
    round: r.round || 0,
    end: r.end,
    swapAt: r.swapAt,
    borrowed: !!r.borrowed,
    cycle: r.cycle || 1,
    stageEnd: r.stageEnd,
    paused: !!r.pausedAt,
    pausedAt: r.pausedAt || 0,
    results: r.results || [],
    players: [...r.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      ready: p.ready,
      spectator: p.spectator,
      team: p.team,
      role: p.role,
      points: p.points || 0,
      connected: !!p.ws,
    })),
  });
}
function spawn(r, p, index = 0) {
  const spot =
    r.round === 3
      ? mansionSpawns.duel[index % 2]
      : mansionSpawns[p.role] || mansionSpawns.hunter;
  [p.x, p.z] = spot;
  Object.assign(p, {
    y: 0,
    vy: 0,
    hp: 100,
    yaw: p.z > 0 ? 0 : Math.PI,
    pitch: 0,
    fov: 75,
    weapon: 0,
    ammo: [p.role === "hunter" ? RULES.ammo : 0, 0, 0, 0],
    reloadAt: 0,
    grenades: 0,
    view: p.id,
    keys: 0,
    crouched: false,
    inputAt: 0,
    queue: [],
    lastFire: 0,
  });
  p.seq = p.lastSeq;
  p.cache.clear();
}
function beginRound(r, now) {
  r.round++;
  r.stage = r.round === 3 ? "countdown" : "hide";
  r.stageEnd = now + (r.round === 3 ? 5000 : RULES.hide);
  r.startedAt = r.stageEnd;
  r.end = r.startedAt + SEARCH_MS;
  r.borrowed = false;
  r.cycle = 1;
  r.swapAt = r.startedAt + RULES.own;
  r.history = [];
  [...r.players.values()].forEach((p, i) => {
    p.role = roleFor(r.round, i);
    spawn(r, p, i);
  });
  roster(r);
}
function doSwap(r) {
  const alive = [...r.players.values()].filter((p) => p.hp > 0);
  for (const p of alive)
    p.view =
      r.stage === "search" && r.borrowed && p.role === "hunter"
        ? alive.find((q) => q.id !== p.id)?.id || p.id
        : p.id;
}
function finish(r, reason, forfeitWinner) {
  if (r.state !== "playing") return;
  r.state = "ended";
  r.stage = "ended";
  const scores = [...r.players.values()]
    .map((p) => ({
      id: p.id,
      name: p.name,
      points: p.points || 0,
      kills: p.kills,
      deaths: p.deaths,
    }))
    .sort((a, b) => b.points - a.points);
  const winner =
    forfeitWinner ||
    (scores[0]?.points > scores[1]?.points ? scores[0].id : null);
  emit(r, {
    type: "ended",
    scores,
    winner,
    reason: reason || "Three rounds complete",
    rounds: r.results,
  });
  for (const p of r.players.values()) p.ready = false;
  roster(r);
}
function endRound(r, winner, reason, now) {
  if (r.stage !== "search") return;
  if (winner) winner.points++;
  r.results.push({
    round: r.round,
    winner: winner?.id || null,
    name: winner?.name || "Draw",
    reason,
  });
  r.stage = "intermission";
  r.stageEnd = now + RULES.intermission;
  r.borrowed = false;
  for (const p of r.players.values()) {
    p.view = p.id;
    p.keys = 0;
    p.queue = [];
  }
  emit(r, {
    type: "roundResult",
    round: r.round,
    winner: winner?.id || null,
    name: winner?.name || "Draw",
    reason,
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
              (q) => q.players.size < 2 && q.state !== "playing",
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
              mode: "hunt",
              variant: "rotation",
              map: 2,
              theme: 0,
              limit: 20,
              duration: SEARCH_MS / 1000,
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
        if (r.players.size >= 2) {
          send(ws, { type: "error", message: "Room full (2 players)" });
          return;
        }
        if (m.spectator || r.state === "playing") {
          send(ws, {
            type: "error",
            message:
              "This game requires exactly two players; observers are disabled",
          });
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
          spectator: false,
          role: "hider",
          points: 0,
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
      if (m.type === "start" && r.host === p.id && r.state !== "playing") {
        if (
          r.players.size !== 2 ||
          [...r.players.values()].some((q) => !q.ws || !q.ready)
        ) {
          send(ws, {
            type: "error",
            message: "Exactly two connected players must ready up",
          });
          return;
        }
        r.state = "playing";
        r.round = 0;
        r.results = [];
        r.pausedAt = 0;
        for (const q of r.players.values()) q.points = q.kills = q.deaths = 0;
        beginRound(r, now);
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
export function step(now = Date.now()) {
  let begin = performance.now();
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
      const disconnected = [...r.players.values()].find((p) => !p.ws);
      if (r.players.size < 2 || disconnected) {
        if (!r.pausedAt) {
          r.pausedAt = now;
          roster(r);
        }
        if (r.players.size < 2 || now - r.pausedAt >= 30000) {
          finish(
            r,
            "Opponent disconnected",
            [...r.players.values()].find((p) => p.ws)?.id,
          );
        }
      } else {
        if (r.pausedAt) {
          const pause = now - r.pausedAt;
          r.startedAt += pause;
          r.end += pause;
          r.swapAt += pause;
          r.stageEnd += pause;
          r.pausedAt = 0;
          r.history = [];
          for (const p of r.players.values()) {
            p.queue = [];
            p.keys = 0;
            p.inputAt = 0;
          }
          roster(r);
        }
        if (r.stage === "intermission" && now >= r.stageEnd) {
          if (r.round >= 3) finish(r);
          else beginRound(r, now);
        }
        if (
          (r.stage === "hide" || r.stage === "countdown") &&
          now >= r.stageEnd
        ) {
          r.stage = "search";
          for (const p of r.players.values()) {
            p.queue = [];
            p.keys = 0;
            p.inputAt = 0;
          }
          roster(r);
        }
        if (r.stage === "search") {
          if (now >= r.end)
            endRound(
              r,
              r.round < 3
                ? [...r.players.values()].find((p) => p.role === "hider")
                : null,
              r.round < 3
                ? "Survived the hunt"
                : "Neither hunter secured a kill",
              now,
            );
          else {
            const phase = huntPhase(r.startedAt, now);
            if (phase.borrowed !== r.borrowed || phase.endsAt !== r.swapAt) {
              r.borrowed = phase.borrowed;
              r.swapAt = phase.endsAt;
              r.cycle = phase.cycle;
              emit(r, {
                type: "swap",
                swapAt: r.swapAt,
                borrowed: r.borrowed,
                cycle: r.cycle,
              });
            }
          }
        }
        doSwap(r);
        for (const p of r.players.values()) {
          let i = p.queue.shift();
          if (i) {
            p.seq = i.seq;
            p.inputAt = now;
            p.weapon = 0;
            // View assignment never changes whose body this input moves or fires.
            if (mayMove(r, p)) {
              p.keys = i.keys;
              move(p, { ...i, fov: 75 }, 1 / 60, 2);
            } else p.keys = 0;
            if (
              i.fire &&
              mayFire(r, p) &&
              now - p.lastFire >= weapons[0].rate &&
              p.ammo[0] > 0
            ) {
              const w = weapons[0];
              p.lastFire = now;
              p.ammo[0]--;
              metrics.shots++;
              const rewind = Math.max(now - 200, Math.min(now, i.time - 100));
              const past = r.history.findLast((h) => h.time <= rewind)
                ?.players || [...r.players.values()];
              const muzzle = gunPosition(p);
              const origin = {
                ...p,
                x: muzzle.x,
                y: muzzle.y - 1.5,
                z: muzzle.z,
              };
              // Check barrel clearance from the actual eye height, including crouching.
              const eye = { ...p, y: p.y + (p.crouched ? -0.55 : 0) };
              const h =
                visible(eye, origin, 2) && hit(origin, p.yaw, p.pitch, past, 2);
              emit(r, {
                type: "shot",
                id: p.id,
                weapon: 0,
                x: p.x,
                y: p.y,
                z: p.z,
                yaw: p.yaw,
                pitch: p.pitch,
                crouched: p.crouched,
              });
              if (h) {
                const q = r.players.get(h.id);
                if (q?.hp > 0) {
                  const damage = w.damage * (h.head ? 2 : 1);
                  q.hp = Math.max(0, q.hp - damage);
                  metrics.hits++;
                  send(p.ws, {
                    type: "hit",
                    damage,
                    head: h.head,
                    inputTime: i.time,
                  });
                  if (!q.hp) {
                    p.kills++;
                    q.deaths++;
                    endRound(r, p, "Caught in the dark", now);
                  }
                }
              }
            }
          } else if (mayMove(r, p) && now - (p.inputAt || 0) < 150) {
            move(
              p,
              { keys: p.keys, yaw: p.yaw, pitch: p.pitch, fov: 75 },
              1 / 60,
              2,
            );
          }
        }
        if (r.stage === "search") {
          const armed = [...r.players.values()].filter(
            (p) => p.role === "hunter",
          );
          if (armed.every((p) => p.ammo[0] === 0))
            endRound(
              r,
              r.round < 3
                ? [...r.players.values()].find((p) => p.role === "hider")
                : null,
              r.round < 3
                ? "Hunter ran out of ammunition"
                : "Both hunters ran out of ammunition",
              now,
            );
        }
        doSwap(r);
        r.history.push({
          time: now,
          players: [...r.players.values()].map((p) => ({
            id: p.id,
            x: p.x,
            y: p.y,
            z: p.z,
            hp: p.hp,
            crouched: p.crouched,
          })),
        });
        if (r.history.length > 15) r.history.shift();
      }
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
let timer;
export { server, wss };
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  timer = setInterval(() => {
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
}
