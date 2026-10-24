import { WebSocket } from "ws";
import { inputPacket, readSnapshot } from "../shared/protocol.mjs";
import { move } from "../shared/game.mjs";
import { fixedTicker } from "../shared/ticker.mjs";
export async function runBots({
  url = "ws://127.0.0.1:3000",
  count = 8,
  duration = 600000,
  latency = 0,
  jitter = 0,
  loss = 0,
  activeTicks = 0,
  metricsUrl = "",
} = {}) {
  let bots = [],
    timers = new Set(),
    stats = {
      snapshots: 0,
      bytes: 0,
      corrections: 0,
      errorSum: 0,
      samples: 0,
      disconnects: 0,
      errors: 0,
      hitLatencies:[],
      latency,
      jitter,
      loss,
    },
    code = "";
  let seed = 19;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  function later(fn) {
    let t = setTimeout(
      () => {
        timers.delete(t);
        fn();
      },
      Math.max(0, latency / 2 + (rand() - 0.5) * jitter),
    );
    timers.add(t);
  }
  for (let n = 0; n < count; n++) {
    let ws = new WebSocket(url);
    let b = {
      ws,
      seq: 0,
      pending: [],
      local: { x: 0, y: 0, z: 0, vy: 0 },
      id: 0,
    };
    bots.push(b);
    await new Promise((resolve, reject) => {
      ws.on("error", reject);
      ws.on("open", () =>
        ws.send(JSON.stringify({ type: "join", name: "Bot " + (n + 1), code })),
      );
      ws.on("message", (data, binary) => {
        if (binary) {
          if (rand() < loss) return;
          later(() => {
            let s = readSnapshot(
              data.buffer.slice(
                data.byteOffset,
                data.byteOffset + data.byteLength,
              ),
            );
            if (s.tick <= (b.tick || 0)) return;
            b.tick = s.tick;
            stats.snapshots++;
            stats.bytes += data.length;
            let p = s.players.find((p) => p.id === b.id);
            if (p) {
              const oldX = b.local.x,
                oldZ = b.local.z;
              b.local = { ...p };
              b.pending = b.pending.filter((i) => i.seq > s.ack);
              if (p.hp > 0) for (let i of b.pending) move(b.local, i);
              const err = Math.hypot(oldX - b.local.x, oldZ - b.local.z);
              if (b.initialized && p.hp > 0) {
                stats.errorSum += err;
                stats.samples++;
                if (err > 0.08) stats.corrections++;
              }
              b.initialized = true;
            }
          });
          return;
        }
        let m = JSON.parse(data);
        if (m.type === "joined") {
          b.id = m.id;
          code = m.code;
          ws.send(JSON.stringify({ type: "ready" }));
          resolve();
        }
        if (m.type === "error") stats.errors++;
        if(m.type==='hit'&&Number.isFinite(m.inputTime)){
          const elapsed=Date.now()-m.inputTime;
          if(elapsed>=0&&elapsed<3000&&stats.hitLatencies.length<10000)stats.hitLatencies.push(elapsed);
        }
        if (m.type === "ended" && n === 0)
          later(() => {
            if (ws.readyState === 1) ws.send(JSON.stringify({ type: "start" }));
          });
      });
      ws.on("close", () => stats.disconnects++);
    });
  }
  bots[0].ws.send(JSON.stringify({ type: "start" }));
  let start = Date.now();
  let stop = fixedTicker(() => {
    for (let [n, b] of bots.entries()) {
      let i = {
        seq: ++b.seq,
        keys: Date.now() % 6000 < 3000 ? 9 : 5,
        yaw: Math.sin((Date.now() - start) / 1700 + n) * Math.PI,
        pitch: 0,
        time: Date.now(),
        weapon: n % 4,
        fire: true,
        reload: b.seq % 90 === 0,
        grenade: b.seq % 180 === 0,
        fov: 75,
      };
      b.pending.push(i);
      if (b.pending.length > 120) b.pending.shift();
      if (b.local.hp > 0) move(b.local, i);
      if (rand() >= loss)
        later(() => {
          if (b.ws.readyState === 1) b.ws.send(inputPacket(i));
        });
    }
  });
  let completedTicks = 0;
  if (activeTicks) {
    const baseline = (await (await fetch(metricsUrl)).json()).ticks;
    while (completedTicks < activeTicks) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      completedTicks =
        (await (await fetch(metricsUrl)).json()).ticks - baseline;
    }
  } else await new Promise((r) => setTimeout(r, duration));
  stop();
  for (let t of timers) clearTimeout(t);
  let unexpectedDisconnects = stats.disconnects;
  for (let b of bots) b.ws.close();
  const sorted=stats.hitLatencies.sort((a,b)=>a-b);
  const hitSamples=sorted.length,hitLatencyMean=hitSamples?sorted.reduce((n,x)=>n+x,0)/hitSamples:null,hitLatencyP95=hitSamples?sorted[Math.floor(.95*(hitSamples-1))]:null;
  delete stats.hitLatencies;
  return {
    ...stats,
    disconnects: unexpectedDisconnects,
    durationMs: Date.now() - start,
    activeTicks: completedTicks,
    meanPredictionError: stats.errorSum / Math.max(1, stats.samples),
    bytesPerClientSecond:
      stats.bytes /
      count /
      (activeTicks ? completedTicks / 60 : duration / 1000),
    room: code,
    hitSamples,hitLatencyMean,hitLatencyP95,
  };
}
if (process.argv[1]?.endsWith("bots.mjs")) {
  console.log("Populating a room with 8 moving bots for 10 minutes");
  console.log(
    await runBots({ duration: Number(process.env.DURATION || 600000) }),
  );
}
