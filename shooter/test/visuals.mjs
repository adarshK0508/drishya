// Screenshot and UI assertions against two real clients and authoritative match outcomes.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { server, wss, rooms, step } from "../server.mjs";
if (fs.existsSync(new URL("../.browsers", import.meta.url)))
  process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
    new URL("../.browsers", import.meta.url),
  );
const { chromium } = await import("playwright");
const output = path.resolve("test-results", `visuals-${Date.now()}`);
fs.mkdirSync(output, { recursive: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const ticker = setInterval(() => step(), 1000 / 60);
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--mute-audio",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
  });
  const a = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    b = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  for (const page of [a, b]) {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
  }
  await a.waitForFunction(
    () => document.getElementById("entranceVideo").currentTime > 1,
  );
  assert.equal(
    await a.locator("#entranceVideo").evaluate((e) => e.muted && e.loop),
    true,
  );
  await a.screenshot({ path: path.join(output, "drishya-menu.png") });
  await a.locator("#help").click();
  for (const [width, height] of [
    [1280, 800],
    [960, 600],
    [1366, 768],
    [1440, 900],
    [600, 900],
  ]) {
    await a.setViewportSize({ width, height });
    const layout = await a.locator("#tutorial").evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        scroll: el.scrollHeight > el.clientHeight + 1,
        count: el.querySelectorAll("img").length,
        bad: [...el.querySelectorAll("img,figcaption,article p")]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              r.top < box.top ||
              r.bottom > box.bottom ||
              r.left < box.left ||
              r.right > box.right ||
              r.height < 3 ||
              (e.tagName === "IMG" &&
                (!e.complete || !e.naturalWidth || r.height < 25))
            );
          })
          .map((e) => e.outerHTML),
      };
    });
    assert.equal(layout.scroll, false, `guide scrolls at ${width}x${height}`);
    assert.equal(layout.count, 6);
    assert.deepEqual(layout.bad, [], `guide fit at ${width}x${height}`);
    await a.screenshot({
      path: path.join(output, `drishya-guide-${width}x${height}.png`),
    });
  }
  assert.equal(
    await a.locator("[data-guide=portrait] figcaption").textContent(),
    "Potraits are Interesting , try to get close",
  );
  assert.equal(
    await a.evaluate(
      () =>
        document.fonts.check('16px "Special Elite"') &&
        document.fonts.check('16px "IM Fell"'),
    ),
    true,
  );
  assert.ok((await a.locator(".ink-letter").count()) > 100);
  await a.setViewportSize({ width: 1280, height: 800 });
  await a.locator("#home").click();
  for (const page of [a, b]) await page.locator("#enter").click();
  await a.locator("#name").fill("Ash");
  await a.locator("#join").click();
  await a.waitForFunction(
    () => document.getElementById("roomcode").textContent.length === 4,
  );
  const code = await a.locator("#roomcode").innerText();
  await b.locator("#name").fill("Wren");
  await b.locator("#code").fill(code);
  await b.locator("#join").click();
  await a.locator("#ready").click();
  await b.locator("#ready").click();
  await a.locator("#start").click();
  await b.waitForFunction(() => window.telemetry.stage === "hide");
  assert.equal(
    await a.locator("#entranceVideo").evaluate((e) => e.paused),
    true,
  );
  const room = rooms.get(code),
    [A, B] = [...room.players.values()];
  // Body enters the library, then a natural exchange views the bathroom without a new entry.
  Object.assign(A, { x: 14, z: -13, keys: 0, queue: [] });
  Object.assign(B, { x: -8, z: -11, keys: 0, queue: [] });
  await a.locator("#ready").dispatchEvent("click");
  await b.waitForFunction(
    () => window.telemetry.interface.room === "The Library",
  );
  await b.waitForTimeout(750);
  await b.screenshot({ path: path.join(output, "drishya-room-entry.png") });
  const notices = await b.evaluate(
    () => window.telemetry.interface.roomNotices,
  );
  room.stageEnd = Date.now() - 1;
  room.startedAt = Date.now() - 20020;
  room.end = Date.now() + 110000;
  room.swapAt = 0;
  await a.locator("#ready").dispatchEvent("click");
  await b.waitForFunction(() => window.telemetry.borrowed);
  assert.equal(
    await b.evaluate(() => window.telemetry.interface.room),
    "The Library",
  );
  assert.equal(
    await b.evaluate(() => window.telemetry.interface.roomNotices),
    notices,
  );
  await b.waitForTimeout(3900);
  assert.ok(
    await b
      .locator("#roomEntry")
      .evaluate((e) => Number(getComputedStyle(e).opacity) < 0.05),
    "room name fades away",
  );
  // Deliberately composed photographs from the running game, without transient HUD text.
  // They are written only to ignored evidence; publishing them is a separate explicit copy.
  const photographs = path.join(output, "guide");
  fs.mkdirSync(photographs, { recursive: true });
  async function pose(page, player, x, z, angle = 0) {
    Object.assign(player, { x, z, keys: 0, queue: [] });
    await page.evaluate(
      (angle) =>
        window.dispatchEvent(
          new MouseEvent("mousemove", {
            buttons: 1,
            movementX: (window.telemetry.yaw - angle) / 0.002,
            movementY: window.telemetry.cameraPitch / 0.002,
          }),
        ),
      angle,
    );
    await page.waitForFunction(
      ({ x, z }) =>
        Math.abs(window.telemetry.position.x - x) < 0.05 &&
        Math.abs(window.telemetry.position.z - z) < 0.05,
      { x, z },
    );
    await page.waitForTimeout(250);
  }
  async function photograph(page, name) {
    const clean = await page.addStyleTag({
      content: "#hud { visibility: hidden !important; }",
    });
    await page.screenshot({
      path: path.join(photographs, `guide-${name}.png`),
      clip: { x: 0, y: 200, width: 1280, height: 550 },
    });
    await clean.evaluate((el) => el.remove());
  }
  room.startedAt = Date.now() - 27050;
  room.swapAt = 0;
  await a.locator("#ready").dispatchEvent("click");
  await b.waitForFunction(() => !window.telemetry.borrowed);
  await pose(b, B, -8, -11, 1.1);
  await photograph(b, "hide");
  await pose(b, B, 8, -16.2, 0);
  await photograph(b, "portrait");
  await pose(a, A, 0, -16, Math.PI);
  await photograph(a, "weapon");
  await pose(a, A, -12, 0, 0);
  await pose(b, B, 0, 4, 0);
  room.torch = { x: 0, z: 4, owner: null };
  await a.locator("#ready").dispatchEvent("click");
  await b.waitForFunction(() =>
    document
      .getElementById("interaction")
      .textContent.includes("Take the torch"),
  );
  await b.keyboard.press("e");
  await b.waitForFunction(
    () => window.telemetry.torchOwner === window.telemetry.ownId,
  );
  await photograph(b, "torch");
  await pose(a, A, 0, -16, 0);
  await pose(b, B, 0, -13.5, 0);
  await a.waitForFunction(() => window.telemetry.specialAvailable);
  await a.keyboard.press("f");
  await a.waitForFunction(() => window.telemetry.specialPhase === "setup");
  room.special.phaseEnd = Date.now() + 20;
  await a.waitForFunction(() => window.telemetry.specialPhase === "action");
  await photograph(a, "special");
  room.special.phaseEnd = Date.now() - 1;
  await a.waitForFunction(() => window.telemetry.specialPhase === "invisible");
  room.special.phaseEnd = Date.now() - 1;
  await a.waitForFunction(() => window.telemetry.specialPhase === null);
  for (let round = 1; round <= 3; round++) {
    if (round > 1) {
      room.stageEnd = Date.now() - 1;
      await a.waitForFunction((n) => window.telemetry.round === n, round);
      room.stageEnd = Date.now() - 1;
      room.startedAt = Date.now() - 5;
    }
    // Known score fixture still resolves through the actual server's three-round state machine.
    if (round === 3) {
      A.points = 2;
      B.points = 0;
    }
    room.end = Date.now() - 1;
    await a.waitForFunction(() => window.telemetry.stage === "intermission");
  }
  room.stageEnd = Date.now() - 1;
  await a.locator("#results").waitFor();
  await b.locator("#results").waitFor();
  for (const [page, outcome, track, caption] of [
    [a, "win", "win", "Adrenaline"],
    [b, "loss", "loss", "Death knocked"],
  ]) {
    await page.waitForFunction(
      (track) =>
        window.telemetry.sound.track === track &&
        window.telemetry.sound.playing,
      track,
    );
    assert.equal(
      await page.locator("#results").getAttribute("data-outcome"),
      outcome,
    );
    assert.equal(
      await page.locator(`#music-${track}`).evaluate((e) => e.loop),
      false,
    );
    assert.match(
      await page.locator("#resultcaption").innerText(),
      new RegExp(caption),
    );
    await page.screenshot({
      path: path.join(output, `drishya-${outcome}.png`),
    });
    // Seek the native player to its real end; another gesture must not restart it.
    await page.locator(`#music-${track}`).evaluate((el) => {
      el.currentTime = el.duration - 0.05;
    });
    await page.waitForFunction(
      (track) => document.getElementById(`music-${track}`).ended,
      track,
    );
    await page.keyboard.press("Tab");
    await page.waitForTimeout(100);
    assert.equal(
      await page
        .locator(`#music-${track}`)
        .evaluate((el) => el.ended && el.paused),
      true,
    );
    assert.equal(
      await page.evaluate(() => window.telemetry.sound.mode),
      "result",
    );
  }
  await a.setViewportSize({ width: 960, height: 600 });
  assert.equal(
    await a
      .locator("#results")
      .evaluate((e) => e.scrollHeight <= e.clientHeight),
    true,
    "results fit small laptop",
  );
  await a.locator("#returnLobby").click();
  await a.waitForFunction(
    () =>
      window.telemetry.sound.track === "home" && window.telemetry.sound.playing,
  );
  assert.equal(
    await a.locator("#entranceVideo").evaluate((e) => e.paused),
    false,
  );
  assert.deepEqual(errors, []);
  for (const page of [a, b])
    assert.deepEqual(
      await page.evaluate(() => window.telemetry.sound.errors),
      [],
    );
  fs.writeFileSync(
    path.join(output, "checks.json"),
    JSON.stringify(
      {
        errors,
        checks: [
          "six images and captions with no scrolling at five viewports",
          "local fonts and stable distressed letters",
          "muted looping eye video, paused in match",
          "body-based room names, fade, borrowed POV ignored",
          "personalized win/loss via actual match outcome",
          "supplied nonlooping outcome tracks, lobby transition",
        ],
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ output, errors, checks: 6 }));
} finally {
  clearInterval(ticker);
  await browser?.close();
  for (const socket of wss.clients) socket.terminate();
  await new Promise((resolve) => server.close(resolve));
  wss.close();
  rooms.clear();
}
