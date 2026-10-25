const root = "/assets/audio/";
export const FOOTSTEP_PROFILES = Object.freeze({
  hunter: { rate: 0.88, cutoff: 1700 },
  hider: { rate: 1.12, cutoff: 3000 },
});

// Select individual impacts from a walking recording instead of looping whole walks.
export function footstepSlices(buffer) {
  const block = Math.max(1, Math.floor(buffer.sampleRate * 0.01)),
    envelope = [];
  for (let start = 0; start < buffer.length; start += block) {
    let energy = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const data = buffer.getChannelData(channel);
      for (let n = start; n < Math.min(buffer.length, start + block); n++)
        energy += data[n] * data[n];
    }
    envelope.push(Math.sqrt(energy / (block * buffer.numberOfChannels)));
  }
  const peak = Math.max(...envelope),
    attacks = [];
  for (let n = 1; n < envelope.length - 1; n++) {
    if (
      envelope[n] < peak * 0.24 ||
      envelope[n] < envelope[n - 1] ||
      envelope[n] < envelope[n + 1]
    )
      continue;
    if (attacks.length && n - attacks.at(-1) < 22) {
      if (envelope[n] > envelope[attacks.at(-1)])
        attacks[attacks.length - 1] = n;
    } else attacks.push(n);
  }
  return (attacks.length ? attacks : [0])
    .slice(0, 12)
    .map((n, i) => {
      const offset = Math.max(0, n * 0.01 - 0.025);
      return {
        offset,
        duration: Math.min(
          0.24,
          buffer.duration - offset,
          attacks[i + 1] ? (attacks[i + 1] - n) * 0.01 - 0.025 : 0.24,
        ),
      };
    })
    .filter((s) => s.duration > 0.04);
}

export class Soundscape {
  constructor({ volume = 0.3, onBlocked = () => {} } = {}) {
    this.volume = volume;
    this.onBlocked = onBlocked;
    this.mode = "menu";
    this.introDone = false;
    this.context = null;
    this.effects = null;
    this.buffers = {};
    this.steps = new Map();
    this.activeSources = new Set();
    this.stats = {
      errors: [],
      steps: [],
      catPlays: 0,
      shots: [],
      hurtPlays: 0,
      unlocked: false,
    };
    this.tracks = {};
    for (const [name, file] of Object.entries({
      intro: "run_once.wav",
      home: "home_screen_bgm.wav",
      gameplay: "gameplay_bg.mp3",
      win: "victory.mp3",
      loss: "defeat.mp3",
    })) {
      const media = document.createElement("audio");
      media.id = `music-${name}`;
      media.src = root + file;
      media.preload = name === "intro" ? "auto" : "metadata";
      media.loop = ["home", "gameplay"].includes(name);
      media.hidden = true;
      media.volume = 0;
      media.addEventListener("error", () =>
        this.stats.errors.push(`${name}: media load error`),
      );
      document.body.append(media);
      this.tracks[name] = media;
    }
    this.tracks.intro.addEventListener("ended", () => {
      this.introDone = true;
      if (this.mode === "menu") this.switchTrack("home");
    });
    this.switchTrack("intro");
  }
  async tryPlay(track = this.track) {
    if (!track) return;
    // Later clicks unlock audio too; an already-finished outcome must stay finished.
    if (["win", "loss"].includes(track) && this.tracks[track].ended) return;
    try {
      await this.tracks[track].play();
      if (track === this.track) {
        this.blocked = false;
        this.onBlocked(false);
      }
    } catch (error) {
      if (track !== this.track || error.name === "AbortError") return;
      if (error.name === "NotAllowedError") {
        this.blocked = true;
        this.onBlocked(true);
      } else this.stats.errors.push(`${track}: ${error.message}`);
    }
  }
  unlock() {
    // Start media inside the gesture, before any fetch/await can consume activation.
    void this.tryPlay();
    if (!this.context) {
      this.context = new AudioContext();
      this.effects = this.context.createGain();
      this.effects.gain.value = this.volume;
      this.effects.connect(this.context.destination);
      this.ready = Promise.all([
        this.load("boots", "boots.mp3"),
        this.load("cat", "cat.mp3"),
        this.load("pistol", "pistol.mp3"),
        this.load("specialShot", "special-shot.mp3"),
        this.load("hurt", "damage_received.wav"),
      ]);
    }
    void this.context.resume().then(() => {
      this.stats.unlocked = this.context.state === "running";
    });
  }
  async load(name, file) {
    try {
      const response = await fetch(root + file);
      if (!response.ok) throw Error(`HTTP ${response.status}`);
      const buffer = await this.context.decodeAudioData(
        await response.arrayBuffer(),
      );
      this.buffers[name] = buffer;
      if (name === "boots") {
        // Collapse the source's stereo recording to a mono world emitter for panning.
        const mono = this.context.createBuffer(
            1,
            buffer.length,
            buffer.sampleRate,
          ),
          data = mono.getChannelData(0);
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const channel = buffer.getChannelData(c);
          for (let n = 0; n < data.length; n++)
            data[n] += channel[n] / buffer.numberOfChannels;
        }
        this.buffers.boots = mono;
        this.slices = footstepSlices(mono);
      }
    } catch (error) {
      this.stats.errors.push(`${name}: ${error.message}`);
    }
  }
  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === "gameplay") this.introDone = true;
    this.switchTrack(
      mode === "gameplay" ? "gameplay" : this.introDone ? "home" : "intro",
    );
  }
  setOutcome(outcome) {
    if (outcome === "draw") return this.setMode("menu");
    this.mode = "result";
    this.introDone = true;
    this.switchTrack(outcome);
  }
  switchTrack(name) {
    if (name === this.track) return;
    this.track = name;
    this.fadeStarted = performance.now();
    this.fadeFrom = Object.fromEntries(
      Object.entries(this.tracks).map(([k, media]) => [k, media.volume]),
    );
    this.tracks[name].currentTime = 0;
    void this.tryPlay(name);
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.effects)
      this.effects.gain.setTargetAtTime(
        this.volume,
        this.context.currentTime,
        0.03,
      );
  }
  update(now = performance.now()) {
    const f = Math.min(1, (now - this.fadeStarted) / 250);
    const duck = now < (this.duckUntil || 0) ? 0.55 : 1;
    for (const [name, media] of Object.entries(this.tracks)) {
      const target =
        name === this.track
          ? this.volume *
            (["intro", "win", "loss"].includes(name) ? 0.65 : 0.18) *
            duck
          : 0;
      media.volume = Math.max(
        0,
        Math.min(1, (this.fadeFrom?.[name] || 0) * (1 - f) + target * f),
      );
      if (name !== this.track && f === 1 && !media.paused) media.pause();
    }
    if (this.catSource) this.updateSpatial(this.catSource);
  }
  spatial({ position, listener, yaw = 0, range = 12 }) {
    const dx = position.x - listener.x,
      dz = position.z - listener.z,
      distance = Math.hypot(dx, dz);
    return {
      pan: Math.max(
        -1,
        Math.min(
          1,
          (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(1, distance),
        ),
      ),
      gain: Math.pow(Math.max(0, 1 - distance / range), 2),
      distance,
    };
  }
  sample(
    name,
    {
      gain = 1,
      pan = 0,
      rate = 1,
      cutoff = 6000,
      offset = 0,
      duration,
      spatial,
    } = {},
  ) {
    if (!this.buffers[name] || this.context?.state !== "running") return null;
    const ctx = this.context,
      source = ctx.createBufferSource(),
      volume = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      stereo = ctx.createStereoPanner();
    source.buffer = this.buffers[name];
    source.playbackRate.value = rate;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    stereo.pan.value = pan;
    const length = Math.min(
        duration ?? source.buffer.duration,
        source.buffer.duration - offset,
      ),
      end = ctx.currentTime + length / rate;
    volume.gain.setValueAtTime(0, ctx.currentTime);
    volume.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.008);
    volume.gain.setValueAtTime(
      gain,
      Math.max(ctx.currentTime + 0.008, end - 0.035),
    );
    volume.gain.linearRampToValueAtTime(0, end);
    source
      .connect(filter)
      .connect(volume)
      .connect(stereo)
      .connect(this.effects);
    const entry = { source, volume, stereo, gain, spatial, end };
    this.activeSources.add(entry);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      volume.disconnect();
      stereo.disconnect();
      this.activeSources.delete(entry);
      if (this.catSource === entry) this.catSource = null;
    };
    source.start(ctx.currentTime, offset, length);
    this.duckUntil = performance.now() + Math.min(700, length * 1000);
    return entry;
  }
  footstep(
    id,
    distance,
    {
      role = "hider",
      own = false,
      sprinting = false,
      crouched = false,
      position,
      listener,
      yaw = 0,
    } = {},
  ) {
    if (
      !this.slices?.length ||
      this.context?.state !== "running" ||
      distance <= 0 ||
      distance > 2
    )
      return;
    const previous = this.steps.get(id) || { distance: 0, index: 0 };
    previous.distance += distance;
    const stride = crouched ? 1.05 : sprinting ? 1.55 : 1.4;
    if (previous.distance < stride) {
      this.steps.set(id, previous);
      return;
    }
    previous.distance %= stride;
    const index = previous.index++;
    this.steps.set(id, previous);
    const spatial = own
      ? { gain: 1, pan: index % 2 ? 0.055 : -0.055, distance: 0 }
      : this.spatial({ position, listener, yaw });
    if (spatial.gain <= 0) return;
    const profile = FOOTSTEP_PROFILES[role] || FOOTSTEP_PROFILES.hider;
    const slice = this.slices[index % this.slices.length];
    const gain =
      (own ? 0.65 : 0.95) *
      spatial.gain *
      (crouched ? 0.22 : sprinting ? 1 : 0.8);
    const rate =
      profile.rate * (sprinting ? 1.04 : 1) * (index % 2 ? 1.015 : 0.985);
    this.sample("boots", {
      ...slice,
      rate,
      cutoff: profile.cutoff,
      pan: spatial.pan,
      gain,
    });
    this.stats.steps.push({
      id,
      role,
      own,
      pan: spatial.pan,
      gain,
      rate,
      at: performance.now(),
    });
    if (this.stats.steps.length > 32) this.stats.steps.shift();
  }
  resetSteps() {
    this.steps.clear();
  }
  shot({ weapon = 0, own = false, position, listener, yaw = 0 }) {
    const name = weapon === 1 ? "specialShot" : "pistol";
    const spatial = own
      ? { gain: 1, pan: 0 }
      : this.spatial({ position, listener, yaw, range: 32 });
    const source = this.sample(name, {
      gain: (own ? 0.95 : 1.1) * spatial.gain,
      pan: spatial.pan,
      cutoff: 16000,
    });
    if (source) {
      this.stats.shots.push({
        weapon,
        name,
        own,
        pan: spatial.pan,
        at: performance.now(),
      });
      if (this.stats.shots.length > 24) this.stats.shots.shift();
    }
  }
  hurt() {
    if (this.sample("hurt", { gain: 2.4, cutoff: 16000 }))
      this.stats.hurtPlays++;
  }
  cat(spatial) {
    if (this.catSource) this.catSource.source.stop();
    this.catSource = this.sample("cat", { gain: 0.85, spatial });
    if (this.catSource) {
      this.stats.catPlays++;
      this.updateSpatial(this.catSource);
    }
  }
  updateSpatial(entry) {
    const state = entry.spatial?.();
    if (!state) return;
    const { pan, gain } = this.spatial(state);
    entry.stereo.pan.setTargetAtTime(pan, this.context.currentTime, 0.04);
    // Cat uses the spatial gain while its one-shot source remains active.
    entry.volume.gain.cancelScheduledValues(this.context.currentTime);
    entry.volume.gain.setTargetAtTime(
      entry.gain *
        gain *
        Math.min(1, Math.max(0, (entry.end - this.context.currentTime) / 0.06)),
      this.context.currentTime,
      0.04,
    );
  }
  stopCat() {
    if (this.catSource) {
      this.catSource.source.stop();
      this.catSource = null;
    }
  }
  status() {
    return {
      ...this.stats,
      mode: this.mode,
      track: this.track,
      introDone: this.introDone,
      blocked: !!this.blocked,
      playing: !this.tracks[this.track].paused,
      loop: this.tracks[this.track].loop,
      bootsReady: !!this.buffers.boots,
      catReady: !!this.buffers.cat,
      combatReady: !!(
        this.buffers.pistol &&
        this.buffers.specialShot &&
        this.buffers.hurt
      ),
      stepSlices: this.slices?.length || 0,
      masterVolume: this.volume,
      musicVolume: this.tracks[this.track].volume,
      contextState: this.context?.state || "uninitialized",
    };
  }
}
