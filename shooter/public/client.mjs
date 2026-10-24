import { Effects, texture } from "./effects.mjs";
import { fixedTicker } from "/shared/ticker.mjs";
import * as THREE from "./vendor/three.module.js";
import { move, maps, pickups, weapons } from "/shared/game.mjs";
import { inputPacket, readSnapshot } from "/shared/protocol.mjs";
const $ = (id) => document.getElementById(id);
let ws,
  id = 0,
  token = sessionStorage.getItem("parallax-token"),
  room,
  players = new Map(),
  frames = [],
  pending = [],
  seq = 0,
  yaw = 0,
  pitch = 0,
  keys = 0,
  fire = false,
  reload = false,
  grenade = false,
  weapon = 0,
  scope = false,
  local = { x: 0, y: 0, z: 0, vy: 0 },
  offset = 0,
  rtt = 0,
  snapshots = 0,
  lastTick = 0,
  corrections = 0,
  errorSum = 0,
  retries = 0,
  active = false,
  debug = false,
  theme = 0,
  map = 0,
  lastFrame = performance.now(),
  fps = 60,
  lowSince = 0,
  jitter = 0,
  lastArrival = 0,
  buffer = 100;
window.telemetry = { snapshots: 0, fps: 0, corrections: 0, predictionError: 0 };
const renderer = new THREE.WebGLRenderer({
  canvas: $("game"),
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x071319, 0.018);
scene.background = new THREE.Color(0x071319);
const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.1,
  150,
);
camera.rotation.order = "YXZ";
scene.add(new THREE.HemisphereLight(0xc9f5ff, 0x18232a, 2.4));
let sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(8, 20, 5);
scene.add(sun);
const effects = new Effects(scene);
const textures = [0, 1, 2, 3].map(texture);
const palettes = [
  [0x14343b, 0x243c48, 0xcfff48],
  [0xb19770, 0x826244, 0x61d9cc],
  [0x26333a, 0x64727a, 0xf5a85d],
  [0x322a52, 0x66507a, 0x70fdb7],
];
let floorMat = new THREE.MeshStandardMaterial({
    color: palettes[0][0],
    roughness: 0.9,
  }),
  coverMat = new THREE.MeshStandardMaterial({ color: palettes[0][1] }),
  accentMat = new THREE.MeshStandardMaterial({
    color: palettes[0][2],
    emissive: palettes[0][2],
    emissiveIntensity: 0.3,
  });
let floor = new THREE.Mesh(new THREE.BoxGeometry(50, 0.3, 50), floorMat);
floorMat.map = textures[0];
floor.position.y = -0.2;
scene.add(floor);
const grid = new THREE.GridHelper(48, 24, 0x8bba8c, 0x315359);
grid.position.y = 0.01;
scene.add(grid);
let obstacles = [];
const box = new THREE.BoxGeometry(1, 1, 1);
function buildMap() {
  for (let o of obstacles) scene.remove(o);
  obstacles = [];
  for (let [x, z, w, d, h] of maps[map]) {
    let mesh = new THREE.Mesh(box, coverMat);
    mesh.position.set(x, h / 2, z);
    mesh.scale.set(w * 2, h, d * 2);
    scene.add(mesh);
    obstacles.push(mesh);
    let stripe = new THREE.Mesh(box, accentMat);
    stripe.position.set(x, h + 0.025, z);
    stripe.scale.set(w * 2, 0.05, d * 2);
    scene.add(stripe);
    obstacles.push(stripe);
  }
}
buildMap();
for (let [x, z, t] of pickups) {
  let mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.45),
    new THREE.MeshStandardMaterial({
      color: t === "health" ? 0x78f5bb : 0xffbb50,
      emissive: t === "health" ? 0x226644 : 0x775500,
    }),
  );
  mesh.position.set(x, 0.7, z);
  scene.add(mesh);
}
const bodies = new THREE.InstancedMesh(
  new THREE.CapsuleGeometry(0.38, 1, 3, 6),
  new THREE.MeshStandardMaterial({ color: 0xffffff }),
  8,
);
bodies.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(bodies);
const dummy = new THREE.Object3D(),
  color = new THREE.Color();
const mini = $("mini").getContext("2d");
let audio;
function beep(freq = 440, duration = 0.06) {
  if (!audio || +$("volume").value === 0) return;
  let o = audio.createOscillator(),
    g = audio.createGain();
  o.type = "triangle";
  o.frequency.setValueAtTime(freq, audio.currentTime);
  o.frequency.exponentialRampToValueAtTime(
    freq * 0.4,
    audio.currentTime + duration,
  );
  g.gain.setValueAtTime(+$("volume").value * 0.12, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  o.connect(g).connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + duration);
}
function send(m) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(m));
}
function connect() {
  ws = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`,
  );
  ws.binaryType = "arraybuffer";
  ws.onopen = () => {
    retries = 0;
    send({
      type: "join",
      name: $("name").value,
      code: $("code").value,
      token,
      spectator: $("spectator").checked,
    });
  };
  ws.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) {
      let s = readSnapshot(e.data);
      if (s.tick <= lastTick) return;
      lastTick = s.tick;
      snapshots++;
      let now = performance.now();
      if (lastArrival)
        jitter = jitter * 0.9 + Math.abs(now - lastArrival - 50) * 0.1;
      lastArrival = now;
      buffer = Math.min(180, 100 + jitter);
      for (let p of s.players) players.set(p.id, p);
      frames.push({ time: s.time, players: new Map(players) });
      if (frames.length > 10) frames.shift();
      let me = players.get(id);
      if (me) {
        if (snapshots === 1) {
          yaw = Math.atan2(me.x, me.z);
          pitch = 0;
        }
        const oldX = local.x,
          oldZ = local.z;
        local = { ...me, vy: local.vy || 0 };
        pending = pending.filter((i) => i.seq > s.ack);
        if (me.hp > 0) for (let i of pending) move(local, i, 1 / 60, map);
        let error = Math.hypot(oldX - local.x, oldZ - local.z);
        if (snapshots > 1) {
          errorSum += error;
          if (error > 0.08) corrections++;
        }
      }
      return;
    }
    let m = JSON.parse(e.data);
    if (m.type === "joined") {
      id = m.id;
      seq = Math.max(seq, m.seq || 0);
      token = m.token;
      sessionStorage.setItem("parallax-token", token);
      $("menu").classList.add("hidden");
      $("lobby").classList.remove("hidden");
      $("roomcode").textContent = m.code;
    }
    if (m.type === "error") {
      $("status").textContent = m.message;
      $("lobbyhint").textContent = m.message;
    }
    if (m.type === "room") {
      room = m;
      theme = m.settings.theme;
      map = m.settings.map;
      buildMap();
      let pal = palettes[theme];
      floorMat.color.setHex(pal[0]);
      floorMat.map = textures[theme];
      coverMat.color.setHex(pal[1]);
      accentMat.color.setHex(pal[2]);
      accentMat.emissive.setHex(pal[2]);
      $("roster").replaceChildren(
        ...m.players.map((p) => {
          let el = document.createElement("div");
          el.textContent = `${p.ready ? "●" : "○"} ${p.name}${p.id === m.host ? " / HOST" : ""}${p.spectator ? " / OBSERVER" : ""}`;
          return el;
        }),
      );
      for (let k of ["mode", "variant", "map", "theme"]) {
        $(k).value = m.settings[k];
        $(k).disabled = id !== m.host;
      }
      $("start").disabled = id !== m.host;
      active = m.state === "playing";
      document.querySelector(".grain").style.opacity = active ? "0" : "1";
      if (active) {
        $("lobby").classList.add("hidden");
        $("hud").classList.remove("hidden");
      }
      for (let pid of players.keys())
        if (!m.players.some((p) => p.id === pid)) players.delete(pid);
    }
    if (m.type === "pong") {
      rtt = Date.now() - m.client;
      let sample = m.server + rtt / 2 - Date.now();
      offset = offset * 0.8 + sample * 0.2;
    }
    if (m.type === "swap") {
      room.swapAt = m.swapAt;
      beep(900, 0.4);
    }
    if (m.type === "shot") {
      beep(m.id === id ? 180 : 100, 0.06);
      effects.shot(players.get(m.id), m.id === id);
      if (m.id === id) pitch = Math.min(1.5, pitch + 0.008);
    }
    if (m.type === "hit") {
      $("hitmarker").textContent = (m.head ? "✳ " : "") + m.damage;
      beep(1300);
      setTimeout(() => ($("hitmarker").textContent = ""), 300);
    }
    if (m.type === "kill") {
      $("feed").textContent = m.text;
      setTimeout(() => ($("feed").textContent = ""), 5000);
    }
    if (m.type === "ended") {
      active = false;
      $("scores").replaceChildren(
        ...m.scores.map((s, i) => {
          let e = document.createElement("p");
          e.textContent = `${i === 0 ? "★ MVP · " : ""}${s.name} — ${s.kills} kills / ${s.deaths} deaths`;
          return e;
        }),
      );
      $("results").showModal();
      document.exitPointerLock?.();
    }
  };
  ws.onclose = () => {
    keys = 0;
    fire = false;
    $("status").textContent = "Connection lost. Reconnecting…";
    if (retries++ < 8) setTimeout(connect, Math.min(8000, 500 * 2 ** retries));
  };
  ws.onerror = () => {
    $("status").textContent = "Server unavailable";
  };
}
$("join").onclick = () => {
  audio ||= new AudioContext();
  connect();
};
$("ready").onclick = () => send({ type: "ready" });
$("start").onclick = () => send({ type: "start" });
for (let k of ["mode", "variant", "map", "theme"])
  $(k).onchange = () =>
    send({
      type: "settings",
      settings: {
        [k]: ["map", "theme"].includes(k) ? +$(k).value : $(k).value,
      },
    });
$("help").onclick = $("settingsbtn").onclick = () => {
  $("settings").showModal();
  keys = 0;
  fire = false;
};
$("closeSettings").onclick = () => $("settings").close();
$("returnLobby").onclick = () => {
  $("results").close();
  $("lobby").classList.remove("hidden");
  $("hud").classList.add("hidden");
};
$("quality").onchange = () =>
  renderer.setPixelRatio(
    {
      Low: 1,
      Medium: Math.min(devicePixelRatio, 1.5),
      High: Math.min(devicePixelRatio, 2),
    }[$("quality").value],
  );
const keymap = {
  KeyW: 1,
  KeyS: 2,
  KeyA: 4,
  KeyD: 8,
  ShiftLeft: 16,
  ControlLeft: 32,
  Space: 64,
};
addEventListener("keydown", (e) => {
  if (e.code === "F3") {
    e.preventDefault();
    debug = !debug;
    $("stats").classList.toggle("hidden", !debug);
  }
  if (!active || $("settings").open) return;
  if (keymap[e.code]) {
    keys |= keymap[e.code];
    e.preventDefault();
  }
  if (e.code === "KeyR") reload = true;
  if (e.code === "KeyG") grenade = true;
  if (/^Digit[1-4]$/.test(e.code)) weapon = +e.code.slice(-1) - 1;
});
addEventListener("keyup", (e) => {
  keys &= ~(keymap[e.code] || 0);
});
function pause() {
  keys = 0;
  fire = false;
  scope = false;
}
addEventListener("blur", pause);
document.addEventListener("visibilitychange", pause);
document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement) pause();
  $("lockhint").style.display = document.pointerLockElement ? "none" : "block";
});
$("game").onclick = async () => {
  if (!active) return;
  try {
    await $("game").requestPointerLock();
  } catch {
    $("lockhint").textContent = "Pointer capture unavailable. Drag to aim.";
  }
};
addEventListener("mousemove", (e) => {
  if (!active || (!document.pointerLockElement && !e.buttons)) return;
  yaw -= e.movementX * 0.002 * +$("sensitivity").value;
  yaw = ((yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  pitch = Math.max(
    -1.5,
    Math.min(1.5, pitch - e.movementY * 0.002 * +$("sensitivity").value),
  );
});
$("game").onmousedown = (e) => {
  if (active) {
    if (e.button === 0) fire = true;
    if (e.button === 2) scope = true;
  }
};
addEventListener("mouseup", () => {
  fire = false;
  scope = false;
});
addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
fixedTicker(() => {
  if (ws?.readyState !== 1 || !active) return;
  let i = {
    seq: ++seq,
    keys,
    yaw,
    pitch,
    time: Date.now() + offset,
    weapon,
    fire,
    reload,
    grenade,
    fov: scope && weapon === 3 ? 30 : +$("fov").value,
  };
  ws.send(inputPacket(i));
  pending.push(i);
  if (pending.length > 120) pending.shift();
  if (players.get(id)?.hp > 0) move(local, i, 1 / 60, map);
  reload = grenade = false;
});
setInterval(() => send({ type: "ping", time: Date.now() }), 1000);
function render(now) {
  let delta = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  fps = fps * 0.95 + (1 / delta) * 0.05;
  if (fps < 45) {
    lowSince += delta;
    if (lowSince > 3) {
      renderer.setPixelRatio(1);
      $("quality").value = "Low";
    }
  } else lowSince = 0;
  let me = players.get(id),
    view = players.get(me?.view) || me,
    renderPlayers = players,
    target = Date.now() + offset - buffer;
  let a = frames.findLast((f) => f.time <= target),
    b = frames.find((f) => f.time > target);
  let factor = a && b ? Math.min(1, (target - a.time) / (b.time - a.time)) : 0;
  let index = 0;
  for (let p of renderPlayers.values()) {
    let pa = a?.players.get(p.id) || p,
      pb = b?.players.get(p.id) || pa,
      x = pa.x + (pb.x - pa.x) * factor,
      z = pa.z + (pb.z - pa.z) * factor;
    dummy.position.set(x, p.y + 0.9, z);
    dummy.scale.setScalar(p.hp <= 0 || p.id === view?.id ? 0 : 1);
    dummy.updateMatrix();
    bodies.setMatrixAt(index, dummy.matrix);
    bodies.setColorAt(index++, color.setHex(p.team ? 0xff796d : 0x72c9ff));
  }
  bodies.count = index;
  bodies.instanceMatrix.needsUpdate = true;
  if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
  if (active && view) {
    let own = view.id === id,
      va = a?.players.get(view.id) || view,
      vb = b?.players.get(view.id) || va;
    camera.position.set(
      own ? local.x : va.x + (vb.x - va.x) * factor,
      (own ? local.y : view.y) + 1.5,
      own ? local.z : va.z + (vb.z - va.z) * factor,
    );
    camera.rotation.y = own ? yaw : view.yaw;
    camera.rotation.x = own ? pitch : view.pitch;
    camera.fov = own
      ? scope && weapon === 3
        ? 30
        : +$("fov").value
      : view.fov;
    camera.updateProjectionMatrix();
    $("viewlabel").textContent =
      me?.hp <= 0
        ? "SIGNAL LOST · RESPAWNING"
        : own
          ? "YOUR PERSPECTIVE"
          : `BORROWED EYES / ${room?.players.find((p) => p.id === view.id)?.name || "PILOT"}`;
    let left = Math.max(0, Math.ceil((room.end - Date.now() - offset) / 1000));
    $("timer").textContent =
      `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
    let until = (room.swapAt - Date.now() - offset) / 1000;
    $("countdown").textContent =
      until < 3 && until > 0 ? `SWAP IN ${Math.ceil(until)}` : "";
    $("health").textContent = `${me?.hp || 0} / HEALTH`;
    $("weapon").textContent = weapons[weapon].name.toUpperCase();
    $("ammo").textContent = `${me?.ammo || 0} / ${weapons[weapon].ammo}`;
  } else {
    camera.position.set(Math.sin(now * 0.00005) * 32, 24, 32);
    camera.lookAt(0, 0, 0);
  }
  mini.clearRect(0, 0, 180, 180);
  mini.fillStyle = "#627980";
  for (let [x, z, w, d] of maps[map])
    mini.fillRect(90 + (x - w) * 3.4, 90 + (z - d) * 3.4, w * 6.8, d * 6.8);
  for (let p of players.values()) {
    mini.fillStyle =
      p.id === id ? "#fff" : p.id === view?.id ? "#d6ff52" : "#fa7c73";
    mini.beginPath();
    mini.arc(
      90 + p.x * 3.4,
      90 + p.z * 3.4,
      p.id === id ? 4 : 3,
      0,
      Math.PI * 2,
    );
    mini.fill();
  }
  mini.fillStyle = "#d7e5e3";
  mini.font = "9px monospace";
  mini.fillText("WHITE = YOUR BODY", 8, 171);
  $("stats").textContent =
    `${fps.toFixed(0)} FPS | ${rtt} ms RTT | ${snapshots} snapshots | buffer ${buffer.toFixed(0)} ms | ${corrections} corrections`;
  Object.assign(window.telemetry, {
    snapshots,
    fps,
    corrections,
    predictionError: errorSum / Math.max(1, snapshots),
    rtt,
  });
  effects.update(delta);
  if (active) camera.rotation.z = (Math.random() - 0.5) * effects.shake;
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
