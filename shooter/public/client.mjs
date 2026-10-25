import { Effects } from "./effects.mjs";
import { InterfaceView } from "./interface.mjs";
import { Soundscape } from "./audio.mjs";
import { catPose } from "/shared/cat.mjs";
import { fixedTicker } from "/shared/ticker.mjs";
import * as THREE from "./vendor/three.module.js";
import { move, weapons, gunPosition, rayBox, maps } from "/shared/game.mjs";
import { inputPacket, readSnapshot } from "/shared/protocol.mjs";
import { buildMansion, createFigure, createTorch } from "./mansion.mjs";
import { buildDetails } from "./house-details.mjs";
import { hunterBoost, RULES, mayMove } from "/shared/hunt.mjs";
import {
  canActivateSpecial,
  canTakeTorch,
  visibilityScale,
} from "/shared/special.mjs";
import { interactions } from "/shared/mansion.mjs";
const $ = (id) => document.getElementById(id);
const interfaceView = new InterfaceView();
let ws,
  id = 0,
  token = sessionStorage.getItem("drishya-token"),
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
  lastHealth = 100,
  connecting = false,
  buffer = 100;
let lastCountdown = 4;
let lookYaw = 0,
  lookPitch = 0,
  borrowedCamera = false,
  noticeTimer;
let currentInteraction = null;
let specialSession = null,
  specialPhase = null;
const ammoIcons = Array.from({ length: RULES.ammo }, () => {
  const e = document.createElement("i");
  e.className = "bullet";
  $("ammoIcons").append(e);
  return e;
});
window.telemetry = { snapshots: 0, fps: 0, corrections: 0, predictionError: 0 };
const renderer = new THREE.WebGLRenderer({
  canvas: $("game"),
  antialias: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 0.9));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0a101b, 4.5, 13);
scene.background = new THREE.Color(0x0a101b);
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
const details = buildDetails(scene);
const effects = new Effects(scene);
const figures = [createFigure(scene, 0), createFigure(scene, 1)];
const pickupTorch = createTorch();
scene.add(pickupTorch);
function myPlayer() {
  return room?.players.find((p) => p.id === id);
}
function specialSetting() {
  return room?.special?.phase === "setup" && room.special.hunter === id;
}
function specialFrozenHider() {
  return (
    room?.special &&
    room.special.phase !== "invisible" &&
    room.special.hider === id
  );
}
function specialAvailable() {
  const other = [...players.values()].find((p) => p.id !== id);
  return canActivateSpecial(
    room,
    { ...players.get(id), ...myPlayer(), ...local },
    other && { ...other, ...room.players.find((p) => p.id === other.id) },
  );
}
$("specialActivate").onclick = () => {
  if (specialAvailable()) send({ type: "special" });
};
function myRole() {
  return room?.players.find((p) => p.id === id)?.role || "hider";
}
function canMove() {
  return (
    !room?.paused &&
    !room?.borrowed &&
    (!room?.special ||
      room.special.phase === "invisible" ||
      (room.special.phase === "action" && room.special.hunter === id)) &&
    (room?.stage === "search" ||
      (room?.stage === "hide" && myRole() === "hider"))
  );
}
function speedScale(now = Date.now() + offset) {
  return room && hunterBoost(room, { role: myRole() }, now) ? 1.1 : 1;
}
function announce(text) {
  clearTimeout(noticeTimer);
  $("swapNotice").textContent = text;
  $("swapNotice").classList.remove("announce");
  void $("swapNotice").offsetWidth;
  $("swapNotice").classList.add("announce");
  noticeTimer = setTimeout(
    () => $("swapNotice").classList.remove("announce"),
    2000,
  );
}
let audio;
const sounds = new Soundscape({
  volume: +$("volume").value,
  onBlocked: (blocked) => $("soundHint").classList.toggle("hidden", !blocked),
});
function unlockAudio() {
  sounds.unlock();
  audio = sounds.context;
}
addEventListener("pointerdown", unlockAudio, { capture: true });
addEventListener("keydown", unlockAudio, { capture: true });
let catSoundKey = null;
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
// A filtered noise transient and low heel thump, rather than a UI beep.
function noiseSound(duration, gain, frequency, pan = 0) {
  if (!audio || audio.state !== "running" || +$("volume").value === 0) return;
  const buffer = audio.createBuffer(
    1,
    Math.ceil(audio.sampleRate * duration),
    audio.sampleRate,
  );
  const data = buffer.getChannelData(0);
  for (let n = 0; n < data.length; n++)
    data[n] = (Math.random() * 2 - 1) * (1 - n / data.length);
  const source = audio.createBufferSource(),
    filter = audio.createBiquadFilter(),
    volume = audio.createGain(),
    stereo = audio.createStereoPanner();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = frequency;
  volume.gain.setValueAtTime(+$("volume").value * gain, audio.currentTime);
  volume.gain.exponentialRampToValueAtTime(
    0.0001,
    audio.currentTime + duration,
  );
  stereo.pan.value = Math.max(-1, Math.min(1, pan));
  source
    .connect(filter)
    .connect(volume)
    .connect(stereo)
    .connect(audio.destination);
  source.start();
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
    volume.disconnect();
    stereo.disconnect();
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
          for (let i of pending)
            move(local, i, 1 / 60, map, speedScale(i.time));
        let error = Math.hypot(oldX - local.x, oldZ - local.z);
        if (snapshots > 1) {
          errorSum += error;
          if (error > 0.08) corrections++;
        }
        if (active && me.hp < lastHealth) {
          $("damageflash").style.opacity = "1";
          setTimeout(() => ($("damageflash").style.opacity = "0"), 150);
          if (myRole() !== "hider") beep(95, 0.13);
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
      sessionStorage.setItem("drishya-token", token);
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
        if (room?.round !== m.round) {
          sounds.resetSteps();
          sounds.stopCat();
          catSoundKey = null;
        }
        pending = [];
        frames = [];
        keys = 0;
        fire = false;
        if (room?.round !== m.round) syncPose = true;
      }
      room = m;
      const session = m.special ? `${m.round}:${m.special.startedAt}` : null;
      const incomingPhase = m.special?.phase || null;
      if (session !== specialSession || incomingPhase !== specialPhase) {
        pending = [];
        keys = 0;
        fire = false;
        if (m.special?.phase === "setup") {
          clearTimeout(noticeTimer);
          $("swapNotice").classList.remove("announce");
          lookYaw = m.special.camera.yaw;
          lookPitch = m.special.camera.pitch;
        }
        specialSession = session;
        specialPhase = incomingPhase;
      }
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
      if (m.state !== "ended") sounds.setMode(active ? "gameplay" : "menu");
      interfaceView.setPlaying(active);
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
      pending = [];
      keys = 0;
      fire = false;
      lastCountdown = 6;
      beep(m.borrowed ? 900 : 600, 0.25);
    }
    if (m.type === "teleport") {
      if (m.id === id) {
        pending = [];
        frames = [];
        keys = 0;
        fire = false;
        syncPose = true;
        announce("THE PORTRAIT LETS YOU THROUGH");
        noiseSound(0.8, 0.2, 900);
      }
    }
    if (m.type === "specialLook" && room?.special?.phase === "setup") {
      room.special.camera = m.camera;
    }
    if (m.type === "flush") {
      details.flush();
      noiseSound(1.6, 0.5, 1500);
    }
    if (m.type === "cat") {
      room.catAt = m.at;
      const key = `${room.round}:${m.at}`;
      if (key !== catSoundKey) {
        catSoundKey = key;
        const play = () => {
          if (catSoundKey !== key || Date.now() + offset - m.at > 1000) return;
          sounds.cat(() => ({
            position: catPose(
              Math.max(
                0,
                ((room.pausedAt || Date.now() + offset) -
                  (room.catAt || m.at)) /
                  1000,
              ),
            ),
            listener: local,
            yaw,
            range: 16,
          }));
        };
        if (sounds.buffers.cat) play();
        else void sounds.ready?.then(play);
      }
    }
    if (m.type === "shot") {
      sounds.shot({
        weapon: m.weapon,
        own: m.id === id,
        position: m,
        listener: local,
        yaw,
      });
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
    if (m.type === "hurt" && m.role === "hider") sounds.hurt();
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
      interfaceView.setPlaying(false);
      const outcome = !m.winner ? "draw" : m.winner === id ? "win" : "loss";
      sounds.setOutcome(outcome);
      sounds.stopCat();
      interfaceView.showOutcome(outcome);
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
  unlockAudio();
  connect();
};
$("volume").oninput = () => {
  sounds.setVolume(+$("volume").value);
};
$("ready").onclick = () => send({ type: "ready" });
$("start").onclick = () => send({ type: "start" });
$("enter").onclick = () => {
  $("entryForm").classList.remove("hidden");
  $("enter").classList.add("hidden");
  $("name").focus();
};
$("help").onclick = () => {
  $("menu").classList.add("hidden");
  $("tutorial").classList.remove("hidden");
  $("home").focus();
};
$("home").onclick = () => {
  $("tutorial").classList.add("hidden");
  $("menu").classList.remove("hidden");
  $("help").focus();
};
$("settingsbtn").onclick = () => {
  document.exitPointerLock?.();
  $("settings").showModal();
  keys = 0;
  fire = false;
};
$("closeSettings").onclick = () => $("settings").close();
$("returnLobby").onclick = () => {
  sounds.setMode("menu");
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
  if (e.code === "KeyF" && !e.repeat && specialAvailable()) {
    send({ type: "special" });
    e.preventDefault();
  }
  if (e.code === "KeyE" && !e.repeat && currentInteraction && canMove()) {
    send({ type: "interact", target: currentInteraction });
  }
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
  if (
    !active ||
    room?.paused ||
    specialFrozenHider() ||
    $("settings").open ||
    (!document.pointerLockElement && !e.buttons)
  )
    return;
  if (room?.borrowed || specialSetting()) {
    lookYaw -= e.movementX * 0.002 * +$("sensitivity").value;
    lookYaw = ((lookYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    lookPitch = Math.max(
      -1.5,
      Math.min(1.5, lookPitch - e.movementY * 0.002 * +$("sensitivity").value),
    );
    return;
  }
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
  if (pad && !$("settings").open) {
    const dead = 0.22;
    if (pad.axes[1] < -dead) inputKeys |= 1;
    if (pad.axes[1] > dead) inputKeys |= 2;
    if (pad.axes[0] < -dead) inputKeys |= 4;
    if (pad.axes[0] > dead) inputKeys |= 8;
    if (pad.buttons[0]?.pressed) inputKeys |= 32;
    if (pad.buttons[10]?.pressed) inputKeys |= 16;
    inputFire ||= !!pad.buttons[7]?.pressed;
    const savedYaw = yaw,
      savedPitch = pitch;
    const viewing = room.borrowed || specialSetting();
    if (viewing) {
      yaw = lookYaw;
      pitch = lookPitch;
    }
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
    if (viewing) {
      lookYaw = yaw;
      lookPitch = pitch;
      yaw = savedYaw;
      pitch = savedPitch;
    }
    if (specialFrozenHider() || room.paused) {
      yaw = savedYaw;
      pitch = savedPitch;
    }
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
    yaw: specialSetting() ? lookYaw : yaw,
    pitch: specialSetting() ? lookPitch : pitch,
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
  const oldX = local.x,
    oldZ = local.z;
  if (players.get(id)?.hp > 0 && canMove())
    move(local, i, 1 / 60, map, speedScale(i.time));
  if (
    inputKeys & 15 &&
    Math.hypot(local.x - oldX, local.z - oldZ) > 0.001 &&
    players.get(id)?.hp > 0
  ) {
    sounds.footstep(id, Math.hypot(local.x - oldX, local.z - oldZ), {
      role: myRole(),
      own: true,
      sprinting: !!(inputKeys & 16),
      crouched: !!(inputKeys & 32),
    });
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
    view =
      room?.special && room.special.phase !== "invisible"
        ? players.get(room.special.hider)
        : room?.borrowed
          ? [...players.values()].find((p) => p.id !== id) || me
          : me,
    renderPlayers = players,
    target = Date.now() + offset - buffer;
  const special = room?.special;
  const invisibleId = special?.phase === "invisible" ? special.hider : null;
  const hiddenFromMe = (p) => p.id === invisibleId && special.hunter === id;
  let a = frames.findLast((f) => f.time <= target),
    b = frames.find((f) => f.time > target);
  let factor = a && b ? Math.min(1, (target - a.time) / (b.time - a.time)) : 0;
  let index = 0;
  for (let p of renderPlayers.values()) {
    let pa = a?.players.get(p.id) || p,
      pb = b?.players.get(p.id) || pa,
      x = pa.x + (pb.x - pa.x) * factor,
      z = pa.z + (pb.z - pa.z) * factor;
    // Borrowed looking never rotates either physical body.
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
    figure.playerId = p.id;
    figure.group.visible =
      active && p.hp > 0 && p.id !== view?.id && !hiddenFromMe(p);
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
    const hasTorch = room?.torch?.owner === p.id;
    figure.arms.forEach((arm, n) => {
      arm.rotation.x =
        (armed && n === 1) || (hasTorch && n === 0)
          ? -1.25
          : speed > 0.002
            ? -Math.sin(figure.stride + n * Math.PI) * 0.25
            : 0;
      arm.position.y =
        (armed && n === 1) || (hasTorch && n === 0) ? 1.35 : 1.13;
      arm.position.z = (armed && n === 1) || (hasTorch && n === 0) ? -0.22 : 0;
    });
    figure.lastX = pose.x;
    figure.lastZ = pose.z;
    if (
      active &&
      p.id !== id &&
      mayMove(room, { ...p, role: armed ? "hunter" : "hider" }) &&
      speed > 0.002
    ) {
      sounds.footstep(p.id, speed, {
        role: armed ? "hunter" : "hider",
        own: false,
        sprinting: speed / delta > 4.7,
        crouched: !!p.crouched,
        position: pose,
        listener: local,
        yaw,
      });
    }
    const gun = gunPosition(pose, 0.52);
    figure.gun.position.set(gun.x, gun.y, gun.z);
    figure.gun.rotation.order = "YXZ";
    figure.gun.rotation.set(pose.pitch, pose.yaw, 0);
    const specialGun =
      special?.hunter === p.id && special.phase !== "invisible";
    figure.specialGun.position.copy(figure.gun.position);
    figure.specialGun.rotation.copy(figure.gun.rotation);
    figure.gun.visible =
      active &&
      !room?.borrowed &&
      p.hp > 0 &&
      room?.players.find((q) => q.id === p.id)?.role === "hunter";
    figure.gun.visible &&= !specialGun && !hiddenFromMe(p);
    figure.specialGun.visible = active && specialGun && p.hp > 0;
    // A held torch is an object, not an additional light source or beam.
    figure.torch.position.set(
      pose.x - Math.cos(pose.yaw) * 0.32 - Math.sin(pose.yaw) * 0.35,
      pose.y + (pose.crouched ? 0.8 : 1.3),
      pose.z + Math.sin(pose.yaw) * 0.32 - Math.cos(pose.yaw) * 0.35,
    );
    figure.torch.rotation.y = pose.yaw;
    figure.torch.visible =
      active &&
      hasTorch &&
      p.hp > 0 &&
      !hiddenFromMe(p) &&
      !(special && special.phase !== "invisible" && view?.id === p.id);
  }
  for (let n = index; n < figures.length; n++) {
    figures[n].group.visible = false;
    figures[n].gun.visible = false;
    figures[n].specialGun.visible = false;
    figures[n].torch.visible = false;
  }
  pickupTorch.visible = active && !!room?.torch && !room.torch.owner;
  if (room?.torch) pickupTorch.position.set(room.torch.x, 0.3, room.torch.z);
  if (active && view) {
    const isBorrowed = !!room.borrowed && room.stage === "search";
    if (isBorrowed !== borrowedCamera) {
      borrowedCamera = isBorrowed;
      if (isBorrowed) {
        lookYaw = view.yaw;
        lookPitch = view.pitch;
        announce("YOU ARE IN THEIR EYES");
      } else if (room.stage === "search") announce("YOUR EYES RETURN · MOVE");
    }
    let own = view.id === id,
      va = a?.players.get(view.id) || view,
      vb = b?.players.get(view.id) || va;
    camera.position.set(
      own ? local.x : va.x + (vb.x - va.x) * factor,
      (own ? local.y : va.y + (vb.y - va.y) * factor) +
        ((own ? local.crouched : view.crouched) ? 0.95 : 1.5),
      own ? local.z : va.z + (vb.z - va.z) * factor,
    );
    camera.rotation.y = own ? yaw : lookYaw;
    camera.rotation.x = own ? pitch : lookPitch;
    if (special && special.phase !== "invisible") {
      camera.position.set(special.camera.x, special.camera.y, special.camera.z);
      camera.rotation.y = specialSetting() ? lookYaw : special.camera.yaw;
      camera.rotation.x = specialSetting() ? lookPitch : special.camera.pitch;
    }
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
                : "BORROWED EYES · LOOK AROUND";
      document.body.classList.toggle(
        "borrowed",
        !own && room.stage === "search",
      );
      document.body.classList.toggle("special", !!special);
      const untilEnd = room.stage === "search" ? room.end : room.stageEnd;
      const clockNow =
        special?.startedAt || room.pausedAt || Date.now() + offset;
      const branchNow = room.pausedAt || Date.now() + offset;
      const branchLeft = special
        ? Math.max(0, Math.ceil((special.phaseEnd - branchNow) / 1000))
        : 0;
      const left = Math.max(0, Math.ceil((untilEnd - clockNow) / 1000));
      $("timer").classList.toggle(
        "urgent",
        room.stage === "search" && left <= 10,
      );
      $("timer").textContent =
        Math.floor(left / 60) + ":" + String(left % 60).padStart(2, "0");
      const count = Math.max(0, Math.ceil((room.swapAt - clockNow) / 1000));
      if (
        !special &&
        room.stage === "search" &&
        count <= 3 &&
        count > 0 &&
        count !== lastCountdown
      ) {
        beep(330 + count * 90, 0.07);
        lastCountdown = count;
      }
      if (count > 3) lastCountdown = 4;
      $("countdown").textContent = special
        ? `MATCH CLOCK PAUSED · ${special.phase === "setup" ? "CHOOSE VIEW" : special.phase === "action" ? "LOCKED VIEW" : "INVISIBILITY"} · ${branchLeft}s`
        : room.stage === "search"
          ? (room.borrowed ? "YOUR EYES RETURN IN " : "NEXT REVEAL · ") +
            count +
            "s"
          : room.stage === "hide"
            ? "THE HUNT BEGINS IN " + left + "s"
            : "";
      const warning =
        !special &&
        room.stage === "search" &&
        !room.borrowed &&
        count <= 3 &&
        count > 0;
      $("swapNumber").textContent = warning ? count : "";
      document.body.style.setProperty(
        "--swap-progress",
        Math.max(0, (room.swapAt - clockNow) / 7000),
      );
      const intermission = room.stage === "intermission";
      $("roundEnd").classList.toggle("hidden", !intermission);
      if (intermission) {
        $("roundTitle").textContent = "ROUND " + room.round + " ENDED";
        const result = room.results.at(-1);
        $("roundReason").textContent =
          (result?.name || "Draw") + " · " + (result?.reason || "");
        $("roundNext").textContent =
          (room.round === 3 ? "MATCH RESULTS IN " : "NEXT ROUND IN ") +
          left +
          "s";
      }
      $("health").textContent = (me?.hp || 0) + " / VITALITY";
      $("healthFill").style.width = (me?.hp || 0) + "%";
      $("healthFill").parentElement.setAttribute("aria-valuenow", me?.hp || 0);
      $("vitality").classList.toggle("hurt", me.hp <= 50);
      $("weapon").textContent =
        myRole() === "hider" ? "UNARMED · STAY HIDDEN" : "";
      $("ammo").textContent =
        myRole() === "hider"
          ? "STAY HIDDEN"
          : special && special.phase !== "invisible"
            ? "SPECIAL · 1 SHOT"
            : (me?.ammo || 0) + " / 20 ROUNDS";
      $("ammoIcons").classList.toggle(
        "hidden",
        myRole() === "hider" || (special && special.phase !== "invisible"),
      );
      ammoIcons.forEach((icon, n) =>
        icon.classList.toggle("spent", n >= me.ammo),
      );
      $("crosshair").style.opacity = room.stage === "search" ? ".7" : "0";
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
            : "THE HOUSE IS LISTENING";
      $("objective").textContent =
        room.stage === "intermission"
          ? room.results.at(-1)?.name + " · " + room.results.at(-1)?.reason
          : room.round === 3
            ? "Both players hunt. First kill wins this round."
            : myRole() === "hider"
              ? "Find cover. Remember where their eyes take you."
              : "Read the rugs, clocks and wallpaper. Make every shot count.";
      if (room.borrowed)
        $("objective").textContent =
          "Both bodies frozen · Mouse to look · Round clock continues";
      else if (hunterBoost(room, { role: myRole() }, clockNow))
        $("objective").textContent =
          "LAST LIGHT · Speed +10% · Illumination +15%";
      if (special) {
        $("viewlabel").textContent =
          special.phase === "invisible"
            ? myRole() === "hider"
              ? "INVISIBLE · MOVE"
              : "YOUR EYES · HIDER INVISIBLE"
            : special.phase === "setup"
              ? "HIDER'S EYES · CHOOSING VIEW"
              : "SECOND-PERSON · VIEW LOCKED";
        $("objective").textContent =
          special.phase === "setup"
            ? special.hunter === id
              ? "Mouse to choose their view · Your body is still · Locks automatically"
              : "The hunter controls your eyes · All controls frozen"
            : special.phase === "action"
              ? special.hunter === id
                ? "WASD to move · Mouse to aim your gun · Left click fires your one special shot"
                : "Your eyes are locked · The hunter is moving · Hold on"
              : "Hider invisible and able to move · Damage still applies · Match clock and swaps remain paused";
      }
      $("specialActivate").classList.toggle(
        "hidden",
        !specialAvailable() || room.paused,
      );
      $("torchStatus").textContent =
        room.torch?.owner === id ? "TORCH HELD · SIGHT +15%" : "";
      $("specialStatus").textContent =
        room.round === 3
          ? "SPECIAL UNAVAILABLE IN ROUND 3"
          : myRole() === "hunter"
            ? myPlayer()?.specialUsed
              ? "SPECIAL USED THIS ROUND"
              : "SPECIAL READY · GET WITHIN 3m IN THE SAME ROOM"
            : "";
      currentInteraction = null;
      $("interaction").textContent = "";
      if (canMove() && me.hp > 0) {
        for (const [name, target] of Object.entries(interactions)) {
          if (
            Math.hypot(local.x - target.x, local.z - target.z) > target.radius
          )
            continue;
          if (name === "portrait") {
            if (myRole() !== "hider") continue;
            if (room.players.find((p) => p.id === id)?.teleportUsed) {
              $("interaction").textContent =
                "The portrait is silent. Your passage is spent.";
              continue;
            }
            $("interaction").textContent =
              "[E] Enter the portrait · Once this match";
          } else {
            if (room.flushed) continue;
            $("interaction").textContent = "[E] Flush the toilet";
          }
          currentInteraction = name;
          break;
        }
        if (canTakeTorch(room, { ...local, id })) {
          currentInteraction = "torch";
          $("interaction").textContent =
            "[E] Take the torch · Sight +15% for this round";
        }
      }
    }
  } else {
    camera.position.set(0.7, 1.65, 17.5);
    camera.rotation.set(-0.03, Math.sin(now * 0.00008) * 0.12, 0);
    $("waiting").classList.add("hidden");
    document.body.classList.remove("borrowed");
    document.body.classList.remove("special");
  }
  const clockNow = special?.startedAt || room?.pausedAt || Date.now() + offset;
  const warning =
    active && room?.stage === "search" && !room.borrowed && !special
      ? Math.max(0, 1 - (room.swapAt - clockNow) / 3000)
      : 0;
  const boost = active && room ? visibilityScale(room, view?.id, clockNow) : 1;
  lantern.distance = 11 * boost * (1 - warning * 0.78);
  lantern.intensity = 28 * (1 - warning * 0.55);
  lantern.color.setHex(warning && myRole() === "hider" ? 0xd94936 : 0xffdab0);
  scene.fog.near = 4.5 * (1 - warning * 0.8) * boost;
  scene.fog.far = 13 * (1 - warning * 0.8) * boost;
  $("iris").style.setProperty("--iris-clear", 65 - warning * 60 + "%");
  $("iris").style.setProperty("--iris-edge", 110 - warning * 90 + "%");
  $("iris").style.setProperty(
    "--iris-color",
    myRole() === "hider" ? "#390b13" : "#070914",
  );
  $("iris").style.setProperty("--iris-opacity", warning);
  details.update(now, room, room?.pausedAt || Date.now() + offset);
  sounds.update(now);
  interfaceView.updateRoom(local, room?.round, room?.stage);
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
      cameraYaw: camera.rotation.y,
      cameraPosition: { x: camera.position.x, z: camera.position.z },
      canMove: canMove(),
      speedScale: speedScale(),
      lightRadius: lantern.distance,
      teleportUsed: room?.players.find((p) => p.id === id)?.teleportUsed,
      roundEnd: room?.end,
      phaseEnd: room?.swapAt,
      lastAck: me?.seq,
      viewId: view?.id,
      borrowed: !!room?.borrowed,
      visibleBodyIds: figures
        .filter((figure) => figure.group.visible)
        .map((figure) => figure.playerId),
      visibleTorchIds: figures
        .filter((figure) => figure.torch.visible)
        .map((figure) => figure.playerId),
      stage: room?.stage,
      round: room?.round,
      role: myRole(),
      cycle: room?.cycle,
      ammo: me?.ammo,
      specialPhase: special?.phase || null,
      specialUsed: !!myPlayer()?.specialUsed,
      specialAvailable: specialAvailable(),
      torchOwner: room?.torch?.owner || null,
      visibilityScale: boost,
      invisibleId,
      cameraPitch: camera.rotation.x,
      sound: sounds.status(),
      interface: { ...interfaceView.stats },
      cat: details.catPose,
      hp: me?.hp,
      points: room?.players.map((p) => p.points),
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    });
  }
  effects.update(delta);
  if (active)
    camera.rotation.z =
      special && special.phase !== "invisible"
        ? 0
        : (Math.random() - 0.5) * effects.shake;
  updateReticle(me);
  renderer.render(scene, camera);
  requestAnimationFrame(render);
}
function updateReticle(me) {
  const crosshair = $("crosshair"),
    s = room?.special;
  crosshair.style.left = "50%";
  crosshair.style.top = "50%";
  if (s?.phase !== "action" || s.hunter !== id || !me) {
    crosshair.style.opacity =
      active && room?.stage === "search" && canMove() && myRole() === "hunter"
        ? ".7"
        : "0";
    return;
  }
  const origin = gunPosition({ ...local, yaw, pitch });
  const direction = new THREE.Vector3(
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  );
  let distance = 40;
  for (const [x, z, w, d, h] of maps[2])
    distance = Math.min(
      distance,
      rayBox(
        origin.x,
        origin.y,
        origin.z,
        direction.x,
        direction.y,
        direction.z,
        [x - w, 0, z - d],
        [x + w, h, z + d],
      ),
    );
  for (const p of players.values())
    if (p.id !== id && p.hp > 0)
      distance = Math.min(
        distance,
        rayBox(
          origin.x,
          origin.y,
          origin.z,
          direction.x,
          direction.y,
          direction.z,
          [p.x - 0.4, p.y, p.z - 0.4],
          [p.x + 0.4, p.y + (p.crouched ? 1.15 : 1.8), p.z + 0.4],
        ),
      );
  camera.updateMatrixWorld();
  const point = new THREE.Vector3(origin.x, origin.y, origin.z)
    .addScaledVector(direction, distance)
    .project(camera);
  const visible =
    point.z >= -1 &&
    point.z <= 1 &&
    Math.abs(point.x) <= 1 &&
    Math.abs(point.y) <= 1;
  crosshair.style.opacity = visible ? ".9" : "0";
  crosshair.style.left = `${(point.x + 1) * 50}%`;
  crosshair.style.top = `${(1 - point.y) * 50}%`;
}
requestAnimationFrame(render);
