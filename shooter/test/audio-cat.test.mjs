import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { server, wss } from "../server.mjs";
import { catPose, CAT_ESCAPE_SECONDS } from "../shared/cat.mjs";
import { blocked } from "../shared/game.mjs";
import { footstepSlices, FOOTSTEP_PROFILES } from "../public/audio.mjs";

test("cat jumps clear of bed, passes real doorway/corridor and fades in dark room without crossing collision", () => {
  let doorway = false,
    corridor = false;
  for (let t = 0; t < CAT_ESCAPE_SECONDS; t += 0.01) {
    const p = catPose(t);
    assert.equal(
      blocked(p.x, p.z, 2, 0.25, p.y - 0.1),
      false,
      `blocked cat at ${t}: ${p.x},${p.z}`,
    );
    if (Math.abs(p.x - 3) < 0.15 && Math.abs(p.z - 13.5) < 0.8) doorway = true;
    if (Math.abs(p.x) < 0.15 && p.z < 10 && p.z > -10) corridor = true;
  }
  assert.equal(doorway, true);
  assert.equal(corridor, true);
  assert.equal(catPose(CAT_ESCAPE_SECONDS).visible, false);
  assert.equal(catPose(CAT_ESCAPE_SECONDS).opacity, 0);
  assert.equal(catPose(0).running, false);
});

test("recorded steps are isolated as short impacts and hunter/hider timbres differ", () => {
  const sampleRate = 44100,
    data = new Float32Array(sampleRate * 2);
  for (const offset of [0.2, 0.7, 1.2, 1.7])
    for (let n = 0; n < 2000; n++)
      data[Math.floor(offset * sampleRate) + n] =
        Math.sin(n / 3) * Math.exp(-n / 400);
  const slices = footstepSlices({
    sampleRate,
    length: data.length,
    numberOfChannels: 1,
    duration: 2,
    getChannelData: () => data,
  });
  assert.equal(slices.length, 4);
  for (const s of slices) {
    assert.ok(s.duration <= 0.24);
    assert.ok(s.offset >= 0);
  }
  assert.ok(FOOTSTEP_PROFILES.hunter.rate < FOOTSTEP_PROFILES.hider.rate);
  assert.ok(FOOTSTEP_PROFILES.hunter.cutoff < FOOTSTEP_PROFILES.hider.cutoff);
});

test("local audio assets serve correct media types and byte ranges for streaming/looping", async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const root = `http://127.0.0.1:${server.address().port}/assets/audio/`;
  try {
    for (const file of [
      "run_once.wav",
      "home_screen_bgm.wav",
      "gameplay_bg.mp3",
      "victory.mp3",
      "defeat.mp3",
      "boots.mp3",
      "cat.mp3",
      "pistol.mp3",
      "special-shot.mp3",
      "damage_received.m4a",
      "damage_received.wav",
    ]) {
      const response = await fetch(root + file, {
        headers: { Range: "bytes=0-15" },
      });
      assert.equal(response.status, 206);
      assert.equal(
        response.headers.get("content-type"),
        file.endsWith(".wav")
          ? "audio/wav"
          : file.endsWith(".m4a")
            ? "audio/mp4"
            : "audio/mpeg",
      );
      const original = fs.readFileSync(
        new URL(`../public/assets/audio/${file}`, import.meta.url),
      );
      assert.deepEqual(
        Buffer.from(await response.arrayBuffer()),
        original.subarray(0, 16),
      );
      const head = await fetch(root + file, { method: "HEAD" });
      assert.equal(Number(head.headers.get("content-length")), original.length);
    }
    const video = await fetch(root + "../entrance-eye.webm", {
      headers: { Range: "bytes=0-31" },
    });
    assert.equal(video.status, 206);
    assert.equal(video.headers.get("content-type"), "video/webm");
    assert.equal((await video.arrayBuffer()).byteLength, 32);
    for (const face of [
      "SpecialElite-Regular.ttf",
      "IMFellEnglishSC-Regular.ttf",
    ]) {
      const font = await fetch(root + "../fonts/" + face);
      assert.equal(font.status, 200);
      assert.equal(font.headers.get("content-type"), "font/ttf");
      assert.ok((await font.arrayBuffer()).byteLength > 100000);
    }
    const bad = await fetch(root + "boots.mp3", {
      headers: { Range: "bytes=9999999999-" },
    });
    assert.equal(bad.status, 416);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    wss.close();
  }
});
