import { Effects } from "./effects.mjs";
import { fixedTicker } from "/shared/ticker.mjs";
import * as THREE from "./vendor/three.module.js";
import { move, weapons, gunPosition } from "/shared/game.mjs";
import { inputPacket, readSnapshot } from "/shared/protocol.mjs";
import { buildMansion, createFigure } from "./mansion.mjs";
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
  map = 2,
  syncPose = true,
  lastFrame = performance.now(),
  fps = 60,
  lowSince = 0,
  jitter = 0,
  lastArrival = 0,
  lostSnapshots = 0,
  hitLatency = 0,
  lastStep = 0,
  lastHealth = 100,
  connecting = false,
  buffer = 100;
let lastCountdown = 4;
window.telemetry = { snapshots: 0, fps: 0, corrections: 0, predictionError: 0 };
const renderer = new THREE.WebGLRenderer({
  canvas: $("game"),
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 0.9));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x050707, 4.5, 13);
scene.background = new THREE.Color(0x050707);
const camera = new THREE.PerspectiveCamera(
  75,
  innerWidth / innerHeight,
  0.04,
  65,
);
camera.rotation.order = "YXZ";
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
scene.add(new THREE.HemisphereLight(0x73858a, 0x241c18, 0.22));
// A small sphere of light follows the viewed eyes, not the controller's body.
const lantern = new THREE.PointLight(0xffdab0, 28, 11, 1.45);
scene.add(lantern);
buildMansion(scene);
const effects = new Effects(scene);
const figures = [createFigure(scene, 0), createFigure(scene, 1)];
function myRole() {
  return room?.players.find((p) => p.id === id)?.role || "hider";
}
function canMove() {
  return (
    !room?.paused &&
    (room?.stage === "search" ||
      (room?.stage === "hide" && myRole() === "hider"))
  );
}
let audio;
let musicGain;
function startMusic() {
  if (musicGain || !audio) return;
  musicGain = audio.createGain();
  musicGain.gain.value = +$("volume").value * 0.012;
  musicGain.connect(audio.destination);
  for (const [frequency, type] of [
    [55, "sine"],
    [82.41, "triangle"],
  ]) {
    const oscillator = audio.createOscillator();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    oscillator.connect(musicGain);
    oscillator.start();
  }
}
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
  o.onended = () => {
    o.disconnect();
    g.disconnect();
  };
}
function send(m) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(m));
}
function connect() {
  if (ws?.readyState === 1) {
    send({ type: "join", name: $("name").value, code: $("code").value, token });
    return;
  }
  if (connecting) return;
  connecting = true;
  ws = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`,
  );
  ws.binaryType = "arraybuffer";
  ws.onopen = () => {
    connecting = false;
    retries = 0;
    send({
      type: "join",
      name: $("name").value,
      code: $("code").value,
      token,
      spectator: false,
    });
  };
  ws.onmessage = (e) => {
    if (e.data instanceof ArrayBuffer) {
      let s = readSnapshot(e.data);
      if (s.tick <= lastTick) return;
      if (lastTick && s.tick - lastTick > 3)
        lostSnapshots += Math.floor((s.tick - lastTick) / 3) - 1;
      lastTick = s.tick;
      if (s.full) players.clear();
      snapshots++;
      window.telemetry.snapshots = snapshots;
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
        if (syncPose || snapshots === 1) {
          syncPose = false;
          yaw = me.yaw;
          pitch = 0;
        }
        const oldX = local.x,
          oldZ = local.z;
        local = { ...me };
        pending = pending.filter((i) => i.seq > s.ack);
        if (me.hp > 0 && canMove())
          for (let i of pending) move(local, i, 1 / 60, map);
        let error = Math.hypot(oldX - local.x, oldZ - local.z);
        if (snapshots > 1) {
          errorSum += error;
          if (error > 0.08) corrections++;
        }
        if (active && me.hp < lastHealth) {
          $("damageflash").style.opacity = "1";
          setTimeout(() => ($("damageflash").style.opacity = "0"), 150);
          beep(95, 0.13);
        }
        lastHealth = me.hp;
      }
      return;
    }
    let m = JSON.parse(e.data);
    if (m.type === "joined") {
      id = m.id;
      lastTick = 0;
      frames = [];
      players.clear();
      pending = [];
      snapshots = 0;
      seq = Math.max(seq, m.seq || 0);
      token = m.token;
      sessionStorage.setItem("parallax-token", token);
      $("menu").classList.add("hidden");
      $("lobby").classList.remove("hidden");
      $("roomcode").textContent = m.code;
      $("connection").classList.add("hidden");
    }
    if (m.type === "error") {
      $("status").textContent = m.message;
      $("lobbyhint").textContent = m.message;
    }
    if (m.type === "room") {
      if (room?.round !== m.round || room?.stage !== m.stage) {
        pending = [];
        frames = [];
        keys = 0;
        fire = false;
        if (room?.round !== m.round) syncPose = true;
      }
      room = m;
      map = 2;
      $("roster").replaceChildren(
        ...m.players.map((p) => {
          let el = document.createElement("div");
          el.textContent = `${p.ready ? "●" : "○"} ${p.name}${p.id === m.host ? " / HOST" : ""}${!p.connected ? " / DISCONNECTED" : ""}`;
          return el;
        }),
      );
      $("start").disabled =
        id !== m.host ||
        m.players.length !== 2 ||
        m.players.some((p) => !p.ready || !p.connected);
      $("ready").disabled = !!m.players.find((p) => p.id === id)?.ready;
      $("lobbyhint").textContent =
        m.players.length < 2
          ? "Waiting for a second player on this server…"
          : "Both players ready up. The host opens the doors.";
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
      room.borrowed = m.borrowed;
      room.cycle = m.cycle;
      lastCountdown = 6;
      beep(m.borrowed ? 900 : 600, 0.25);
    }
    if (m.type === "shot") {
      beep(m.id === id ? 180 : 100, 0.06);
      const ownCamera = players.get(id)?.view === id;
      effects.shot(
        m.id === id ? { ...local, yaw, pitch } : m,
        m.id === id && ownCamera,
      );
      window.telemetry.lastShot = {
        shooterId: m.id,
        viewId: players.get(id)?.view,
        muzzle: gunPosition(m),
        screenShake: m.id === id && ownCamera,
      };
      if (m.id === id) pitch = Math.min(1.5, pitch + 0.008);
    }
    if (m.type === "grenade") effects.grenade(m);
    if (m.type === "blast") {
      effects.blast(m);
      beep(70, 0.3);
    }
    if (m.type === "hit") {
      if (Number.isFinite(m.inputTime))
        hitLatency = Date.now() + offset - m.inputTime;
      $("hitmarker").textContent = (m.head ? "✳ " : "") + m.damage;
      beep(1300);
      setTimeout(() => ($("hitmarker").textContent = ""), 300);
    }
    if (m.type === "kill") {
      $("feed").textContent = m.text;
      setTimeout(() => ($("feed").textContent = ""), 5000);
    }
    if (m.type === "roundResult") {
      $("feed").textContent = m.name + " · " + m.reason;
      beep(m.winner === id ? 650 : 160, 0.3);
    }
    if (m.type === "ended") {
      active = false;
      $("resulttitle").textContent = m.winner
        ? (m.scores.find((p) => p.id === m.winner)?.name || "Player") + " wins"
        : "A draw in the dark";
      $("resultreason").textContent = m.reason;
      $("scores").replaceChildren(
        ...m.scores.map((s) => {
          const e = document.createElement("p");
          e.textContent =
            s.name + " — " + s.points + " rounds won · " + s.kills + " kills";
          return e;
        }),
        ...(m.rounds || []).map((r) => {
          const e = document.createElement("p");
          e.className = "round-detail";
          e.textContent =
            "Round " + r.round + " · " + r.name + " · " + r.reason;
          return e;
        }),
      );
      $("results").showModal();
      document.exitPointerLock?.();
    }
  };
  ws.onclose = () => {
    connecting = false;
    keys = 0;
    fire = false;
    $("status").textContent = "Connection lost. Reconnecting…";
    $("connection").textContent =
      retries < 8
        ? "Signal lost · reconnecting…"
        : "Unable to reconnect · reload to retry";
    $("connection").classList.remove("hidden");
    if (retries++ < 8) setTimeout(connect, Math.min(8000, 500 * 2 ** retries));
  };
  ws.onerror = () => {
    $("status").textContent = "Server unavailable";
  };
}
$("join").onclick = () => {
  audio ||= new AudioContext();
  startMusic();
  connect();
};
$("volume").oninput = () => {
  if (musicGain) musicGain.gain.value = +$("volume").value * 0.012;
};
$("ready").onclick = () => send({ type: "ready" });
$("start").onclick = () => send({ type: "start" });
$("help").onclick = $("settingsbtn").onclick = () => {
  document.exitPointerLock?.();
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
      Low: 0.55,
      Medium: Math.min(devicePixelRatio, 0.9),
      High: Math.min(devicePixelRatio, 1.5),
    }[$("quality").value],
  );
const keymap = {
  KeyW: 1,
  KeyS: 2,
  KeyA: 4,
  KeyD: 8,
  ShiftLeft: 16,
  ControlLeft: 32,
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
});
addEventListener("keyup", (e) => {
  keys &= ~(keymap[e.code] || 0);
});
function pause() {
  keys = 0;
  fire = false;
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
    if (e.button === 0 && document.pointerLockElement) fire = true;
  }
};
addEventListener("mouseup", () => {
  fire = false;
});
addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
fixedTicker(() => {
  if (ws?.readyState !== 1 || !active) return;
  if (players.get(id)?.spectator) return;
  const pad = navigator.getGamepads?.()[0];
  let inputKeys = keys,
    inputFire = fire;
  if (pad) {
    const dead = 0.22;
    if (pad.axes[1] < -dead) inputKeys |= 1;
    if (pad.axes[1] > dead) inputKeys |= 2;
    if (pad.axes[0] < -dead) inputKeys |= 4;
    if (pad.axes[0] > dead) inputKeys |= 8;
    if (pad.buttons[0]?.pressed) inputKeys |= 32;
    if (pad.buttons[10]?.pressed) inputKeys |= 16;
    inputFire ||= !!pad.buttons[7]?.pressed;
    yaw -=
      (Math.abs(pad.axes[2]) > dead ? pad.axes[2] : 0) *
      0.045 *
      +$("sensitivity").value;
    yaw = ((yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    pitch = Math.max(
      -1.5,
      Math.min(
        1.5,
        pitch -
          (Math.abs(pad.axes[3]) > dead ? pad.axes[3] : 0) *
            0.035 *
            +$("sensitivity").value,
      ),
    );
  }
  if (!canMove() || $("settings").open) inputKeys = 0;
  inputFire &&=
    canMove() &&
    room.stage === "search" &&
    myRole() === "hunter" &&
    !$("settings").open;
  let i = {
    seq: ++seq,
    keys: inputKeys,
    yaw,
    pitch,
    time: Date.now() + offset,
    weapon: 0,
    fire: inputFire,
    reload: false,
    grenade: false,
    fov: 75,
  };
  ws.send(inputPacket(i));
  pending.push(i);
  if (pending.length > 120) pending.shift();
  if (players.get(id)?.hp > 0 && canMove()) move(local, i, 1 / 60, map);
  if (
    inputKeys & 15 &&
    Date.now() - lastStep > (inputKeys & 16 ? 250 : 390) &&
    players.get(id)?.hp > 0
  ) {
    lastStep = Date.now();
    beep(inputKeys & 16 ? 108 : 88, 0.025);
  }
});
setInterval(() => send({ type: "ping", time: Date.now() }), 1000);
let lastHud = 0,
  lastDebug = 0;
function render(now) {
  let delta = Math.min(0.1, (now - lastFrame) / 1000);
  lastFrame = now;
  fps = fps * 0.95 + (1 / delta) * 0.05;
  if (fps < 45) {
    lowSince += delta;
    if (lowSince > 2) {
      renderer.setPixelRatio(0.55);
      $("quality").value = "Low";
      lowSince = 0;
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
    // Own body uses the same predicted pose as controls, including during swaps.
    const pose =
      p.id === id
        ? { ...local, yaw, pitch }
        : {
            ...p,
            x,
            z,
            y: pa.y + (pb.y - pa.y) * factor,
          };
    const figure = figures[index++];
    if (!figure) continue;
    figure.group.visible = active && p.hp > 0 && p.id !== view?.id;
    figure.group.position.set(pose.x, pose.y, pose.z);
    figure.group.rotation.y = pose.yaw;
    figure.group.scale.set(1, pose.crouched ? 0.64 : 1, 1);
    const speed = Math.hypot(pose.x - figure.lastX, pose.z - figure.lastZ);
    figure.stride += Math.min(speed, 0.2) * 6;
    figure.legs.forEach(
      (leg, n) =>
        (leg.rotation.x =
          speed > 0.002 ? Math.sin(figure.stride + n * Math.PI) * 0.45 : 0),
    );
    const armed = room?.players.find((q) => q.id === p.id)?.role === "hunter";
    figure.arms.forEach((arm, n) => {
      arm.rotation.x =
        armed && n === 1
          ? -1.25
          : speed > 0.002
            ? -Math.sin(figure.stride + n * Math.PI) * 0.25
            : 0;
      arm.position.y = armed && n === 1 ? 1.35 : 1.13;
      arm.position.z = armed && n === 1 ? -0.22 : 0;
    });
    figure.lastX = pose.x;
    figure.lastZ = pose.z;
    const gun = gunPosition(pose, 0.52);
    figure.gun.position.set(gun.x, gun.y, gun.z);
    figure.gun.rotation.order = "YXZ";
    figure.gun.rotation.set(pose.pitch, pose.yaw, 0);
    figure.gun.visible =
      active &&
      p.hp > 0 &&
      room?.players.find((q) => q.id === p.id)?.role === "hunter";
  }
  for (let n = index; n < figures.length; n++) {
    figures[n].group.visible = false;
    figures[n].gun.visible = false;
  }
  if (active && view) {
    let own = view.id === id,
      va = a?.players.get(view.id) || view,
      vb = b?.players.get(view.id) || va;
    camera.position.set(
      own ? local.x : va.x + (vb.x - va.x) * factor,
      (own ? local.y : va.y + (vb.y - va.y) * factor) +
        ((own ? local.crouched : view.crouched) ? 0.95 : 1.5),
      own ? local.z : va.z + (vb.z - va.z) * factor,
    );
    camera.rotation.y = own ? yaw : view.yaw;
    camera.rotation.x = own ? pitch : view.pitch;
    const desiredFov = 75;
    if (camera.fov !== desiredFov) {
      camera.fov = desiredFov;
      camera.updateProjectionMatrix();
    }
    if (now - lastHud >= 100) {
      lastHud = now;
      const waiting = room.stage === "hide" && myRole() === "hunter";
      const frozen = waiting || room.stage === "countdown" || room.paused;
      $("waiting").classList.toggle("hidden", !frozen);
      $("waitingtitle").textContent = room.paused
        ? "A presence has vanished"
        : waiting
          ? "Let them hide."
          : "The final hunt";
      $("waitingtext").textContent = room.paused
        ? "Waiting up to 30 seconds for your opponent to reconnect."
        : waiting
          ? "Your eyes are closed. The mansion belongs to them for now."
          : "Both armed. First kill takes the round.";
      $("viewlabel").textContent =
        room.stage === "intermission"
          ? "ROUND COMPLETE"
          : room.stage === "hide"
            ? waiting
              ? "HUNTER · WAITING"
              : "HIDER · FIND COVER"
            : room.stage === "countdown"
              ? "BOTH HUNTERS · GET READY"
              : own
                ? myRole() === "hider"
                  ? "HIDER · SURVIVE"
                  : "HUNTER · YOUR EYES"
                : "BORROWED EYES · YOU STILL MOVE YOUR OWN BODY";
      document.body.classList.toggle(
        "borrowed",
        !own && room.stage === "search",
      );
      const untilEnd = room.stage === "search" ? room.end : room.stageEnd;
      const clockNow = room.pausedAt || Date.now() + offset;
      const left = Math.max(0, Math.ceil((untilEnd - clockNow) / 1000));
      $("timer").textContent =
        Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
      const count = Math.max(0, Math.ceil((room.swapAt - clockNow) / 1000));
      if (
        room.stage === "search" &&
        count <= 3 &&
        count > 0 &&
        count !== lastCountdown
      ) {
        beep(330 + count * 90, 0.07);
        lastCountdown = count;
      }
      if (count > 3) lastCountdown = 4;
      $("countdown").textContent =
        room.stage === "search"
          ? (room.borrowed
              ? myRole() === "hider"
                ? "YOUR EYES ARE EXPOSED · "
                : "REVEAL · "
              : "NEXT REVEAL · ") +
            count +
            "s"
          : room.stage === "intermission"
            ? "NEXT · " + left + "s"
            : left + "s";
      $("health").textContent = (me?.hp || 0) + " / VITALITY";
      $("weapon").textContent =
        myRole() === "hider" ? "UNARMED · STAY HIDDEN" : "SIX-SHOT REVOLVER";
      $("ammo").textContent =
        myRole() === "hider" ? "—" : (me?.ammo || 0) + " / 6 ROUNDS";
      $("crosshair").style.opacity =
        myRole() === "hunter" && own && room.stage === "search" ? ".7" : "0";
      $("matchscore").textContent =
        "ROUND " +
        room.round +
        " / 3 · " +
        room.players.map((p) => p.name + " " + p.points).join(" : ");
      $("cycle").textContent =
        room.stage === "search"
          ? "CYCLE " + (room.cycle || 1) + " / 5"
          : room.stage === "hide"
            ? "20 SECONDS TO DISAPPEAR"
            : "BLACKTHORN HOUSE";
      $("objective").textContent =
        room.stage === "intermission"
          ? room.results.at(-1)?.name + " · " + room.results.at(-1)?.reason
          : room.round === 3
            ? "Both players hunt. First kill wins this round."
            : myRole() === "hider"
              ? "Use furniture as cover. Your gaze reveals the room."
              : "Read the rugs, clocks and wallpaper. Make every shot count.";
    }
  } else {
    camera.position.set(0.7, 1.65, 17.5);
    camera.rotation.set(-0.03, Math.sin(now * 0.00008) * 0.12, 0);
    $("waiting").classList.add("hidden");
  }
  lantern.position.copy(camera.position);
  lantern.position.y += 0.15;
  if (now - lastDebug >= 200) {
    lastDebug = now;
    $("stats").textContent =
      `${fps.toFixed(0)} FPS | ${rtt} ms RTT | ${hitLatency.toFixed(0)} ms last input→hit | ${snapshots} snapshots | ${lostSnapshots} estimated gaps | buffer ${buffer.toFixed(0)} ms | ${corrections} corrections`;
    Object.assign(window.telemetry, {
      snapshots,
      fps,
      corrections,
      predictionError: errorSum / Math.max(1, snapshots),
      rtt,
      hitLatency,
      position: { x: local.x, y: local.y, z: local.z },
      keys,
      active,
      ownId: id,
      yaw,
      roundEnd: room?.end,
      phaseEnd: room?.swapAt,
      lastAck: me?.seq,
      viewId: view?.id,
      borrowed: !!room?.borrowed,
      visibleBodyIds: [...players.values()]
        .filter((p) => p.hp > 0 && !p.spectator && p.id !== view?.id)
        .map((p) => p.id),
      stage: room?.stage,
      round: room?.round,
      role: myRole(),
      cycle: room?.cycle,
      ammo: me?.ammo,
      hp: me?.hp,
      points: room?.players.map((p) => p.points),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    });
  }
  effects.update(delta);
  if (active) camera.rotation.z = (Math.random() - 0.5) * effects.shake;
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
requestAnimationFrame(render);
