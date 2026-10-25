import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { server, wss, rooms, step } from "../server.mjs";
import { SEARCH_MS } from "../shared/hunt.mjs";
if (fs.existsSync(new URL("../.browsers", import.meta.url)))
  process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
    new URL("../.browsers", import.meta.url),
  );
const { chromium } = await import("playwright");
fs.mkdirSync("test-results", { recursive: true });
const evidenceDir = path.resolve("test-results", `browser-${Date.now()}`);
async function capture(page, relativePath) {
  const output = path.join(evidenceDir, relativePath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await page.screenshot({ path: output });
}
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}`;
const timer = setInterval(() => step(), 1000 / 60);
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--mute-audio",
      "--autoplay-policy=user-gesture-required",
    ],
  });
  const a = await browser.newPage({ viewport: { width: 960, height: 640 } }),
    b = await browser.newPage({ viewport: { width: 960, height: 640 } }),
    errors = [];
  for (const page of [a, b]) {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
    await page.goto(url);
  }
  await capture(a, "docs/drishya-menu.png");
  await a.waitForFunction(() => window.telemetry.sound?.blocked);
  await a.locator("#help").click();
  await a.waitForFunction(
    () =>
      (window.telemetry.sound?.unlocked &&
        window.telemetry.sound.bootsReady &&
        window.telemetry.sound.catReady &&
        window.telemetry.sound.combatReady &&
        window.telemetry.sound.playing) ||
      window.telemetry.sound?.errors.length,
  );
  assert.deepEqual(
    await a.evaluate(() => window.telemetry.sound.errors),
    [],
    "supplied effects must decode",
  );
  assert.equal(await a.evaluate(() => window.telemetry.sound.track), "intro");
  assert.equal(
    await a.locator("#music-intro").evaluate((el) => el.loop),
    false,
  );
  await a.waitForFunction(
    () => document.getElementById("music-intro").currentTime > 0,
  );
  // Advance only the intro-ended fixture, rather than waiting through the whole recording.
  await a.locator("#music-intro").dispatchEvent("ended");
  await a.waitForFunction(
    () =>
      window.telemetry.sound.track === "home" && window.telemetry.sound.playing,
  );
  assert.equal(await a.locator("#music-home").evaluate((el) => el.loop), true);
  assert.equal(await a.locator("#tutorial").isVisible(), true);
  await capture(a, "docs/drishya-guide.png");
  await a.locator("#home").click();
  await a.locator("#enter").click();
  await b.locator("#enter").click();
  // Deterministic activation for concurrent software-rendered clients; physical menu clicking is also checked separately.
  await a.locator("#name").fill("Ash");
  await a.locator("#join").dispatchEvent("click");
  await a.locator("#roomcode").waitFor();
  assert.equal(
    await a.evaluate(() => window.telemetry.sound.track),
    "home",
    "lobby does not replay the intro",
  );
  const code = await a.locator("#roomcode").innerText();
  await b.locator("#name").fill("Wren");
  await b.locator("#code").fill(code);
  await b.locator("#join").dispatchEvent("click");
  await b.locator("#roomcode").waitFor();
  await a.locator("#ready").click();
  await b.locator("#ready").click();
  await a.locator("#start").click();
  await b.waitForFunction(() => window.telemetry.stage === "hide");
  await a.waitForFunction(
    () =>
      window.telemetry.sound.track === "gameplay" &&
      window.telemetry.sound.playing,
  );
  assert.equal(
    await a.locator("#music-gameplay").evaluate((el) => el.loop),
    true,
  );
  await b.waitForFunction(
    () =>
      window.telemetry.sound.introDone &&
      window.telemetry.sound.track === "gameplay",
  );
  await b.waitForFunction(() => window.telemetry.sound.combatReady);
  assert.equal(await a.locator("#waiting").isVisible(), true);
  assert.equal(await b.locator("#weapon").innerText(), "UNARMED · STAY HIDDEN");
  const r = rooms.get(code),
    [A, B] = [...r.players.values()];
  const start = A.z;
  await a.keyboard.down("w");
  await a.waitForTimeout(200);
  await a.keyboard.up("w");
  assert.equal(A.z, start);
  await b.bringToFront();
  const before = B.z;
  await b.keyboard.down("w");
  await b.waitForTimeout(400);
  await b.keyboard.up("w");
  assert.ok(Math.abs(B.z - before) > 0.2, "hider can move during hiding");
  // Place the clients in the library to inspect room clues and the other figure.
  Object.assign(A, { x: -8, z: -13, yaw: Math.PI });
  Object.assign(B, { x: -8, z: -10, yaw: 0 });
  A.queue = [];
  B.queue = [];
  // Client aim belongs to the player's mouse; sync it with real relative mouse input.
  await b.evaluate(() =>
    document.getElementById("game").dispatchEvent(
      new MouseEvent("mousemove", {
        bubbles: true,
        buttons: 1,
        movementX: Math.PI / 0.002,
        movementY: 0,
      }),
    ),
  );
  await b.waitForTimeout(300);
  await b.setViewportSize({ width: 1280, height: 800 });
  await b.waitForTimeout(200);
  await capture(b, "docs/mansion-library.png");
  await capture(b, "public/assets/guide-hide.png");
  r.stageEnd = Date.now() - 1;
  r.startedAt = r.stageEnd;
  r.end = r.startedAt + SEARCH_MS;
  await a.waitForFunction(() => window.telemetry.stage === "search");
  await a.locator("#waiting").waitFor({ state: "hidden" });
  assert.equal(await a.locator("#waiting").isVisible(), false);
  r.startedAt = Date.now() - 17200;
  r.swapAt = 0;
  await b.waitForFunction(
    () => document.getElementById("swapNumber").textContent !== "",
  );
  assert.ok(
    await b
      .locator("#iris")
      .evaluate((e) => +e.style.getPropertyValue("--iris-opacity") > 0),
  );
  assert.equal(
    await b
      .locator("#iris")
      .evaluate((e) => e.style.getPropertyValue("--iris-color")),
    "#390b13",
  );
  await capture(b, "docs/drishya-swap-warning.png");
  r.startedAt = Date.now() - 20050;
  await a.waitForFunction(
    () =>
      window.telemetry.borrowed &&
      window.telemetry.viewId !== window.telemetry.ownId,
  );
  await b.waitForFunction(
    () =>
      window.telemetry.borrowed &&
      window.telemetry.viewId !== window.telemetry.ownId,
  );
  const old = A.x;
  await a.bringToFront();
  await a.keyboard.down("d");
  await a.waitForTimeout(350);
  await a.keyboard.up("d");
  assert.equal(A.x, old, "hunter frozen during borrowed view");
  const frozenSteps = await a.evaluate(
    () => window.telemetry.sound.steps.length,
  );
  const bOld = { x: B.x, z: B.z, yaw: B.yaw };
  const aYaw = A.yaw;
  const cameraBefore = await a.evaluate(() => window.telemetry.cameraYaw);
  await a.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent("mousemove", {
        buttons: 1,
        movementX: 180,
        movementY: 15,
      }),
    ),
  );
  await a.waitForFunction(
    (previous) => window.telemetry.cameraYaw !== previous,
    cameraBefore,
    { timeout: 3000 },
  );
  assert.notEqual(
    await a.evaluate(() => window.telemetry.cameraYaw),
    cameraBefore,
    "borrowed camera rotates independently",
  );
  assert.equal(A.yaw, aYaw, "looking does not rotate own frozen body");
  assert.equal(B.yaw, bOld.yaw, "looking does not rotate opponent body");
  await b.keyboard.down("w");
  await b.waitForTimeout(250);
  await b.keyboard.up("w");
  assert.equal(B.x, bOld.x);
  assert.equal(B.z, bOld.z);
  assert.equal(
    await a.evaluate(() => window.telemetry.sound.steps.length),
    frozenSteps,
    "frozen bodies add no footsteps",
  );
  await capture(a, "public/assets/guide-swap.png");
  await capture(a, "docs/mansion-borrowed.png");
  await a.locator("#settingsbtn").click();
  assert.equal(
    await a
      .locator("#settings")
      .evaluate((e) => e.scrollHeight <= e.clientHeight),
    true,
    "settings fits without scroll",
  );
  await capture(a, "docs/drishya-settings.png");
  await a.locator("#volume").evaluate((el) => {
    el.value = "0";
    el.dispatchEvent(new Event("input"));
  });
  await a.waitForFunction(
    () =>
      window.telemetry.sound.masterVolume === 0 &&
      window.telemetry.sound.musicVolume === 0,
  );
  assert.equal(
    await a.evaluate(() => window.telemetry.sound.playing),
    true,
    "mute preserves the music playhead",
  );
  await a.locator("#volume").evaluate((el) => {
    el.value = "0.3";
    el.dispatchEvent(new Event("input"));
  });
  await a.waitForFunction(() => window.telemetry.sound.musicVolume > 0);
  await a.locator("#quality").selectOption("Low");
  await a.locator("#closeSettings").click();
  r.startedAt = Date.now() - 27050;
  await a.waitForFunction(() => !window.telemetry.borrowed);
  assert.equal(await a.evaluate(() => window.telemetry.canMove), true);
  assert.ok(
    Math.abs((await a.evaluate(() => window.telemetry.cameraYaw)) - aYaw) <
      0.01,
    "own aim restored",
  );
  // Parallel motion produces separate centered self and directional opponent samples.
  Object.assign(A, { x: -8, z: -13 });
  Object.assign(B, { x: -6, z: -13 });
  A.queue = [];
  B.queue = [];
  await a.waitForTimeout(250);
  for (const page of [a, b])
    await page.evaluate(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { code: "KeyW", bubbles: true }),
      ),
    );
  await a.waitForTimeout(850);
  for (const page of [a, b])
    await page.evaluate(() =>
      window.dispatchEvent(
        new KeyboardEvent("keyup", { code: "KeyW", bubbles: true }),
      ),
    );
  await a.waitForFunction(
    () =>
      window.telemetry.sound.steps.some((s) => s.own) &&
      window.telemetry.sound.steps.some((s) => !s.own),
  );
  const footstepPair = await a.evaluate(() => ({
    own: window.telemetry.sound.steps.find((s) => s.own),
    other: window.telemetry.sound.steps.find((s) => !s.own),
  }));
  assert.equal(footstepPair.own.role, "hunter");
  assert.equal(footstepPair.other.role, "hider");
  assert.ok(footstepPair.own.rate < footstepPair.other.rate);
  assert.ok(Math.abs(footstepPair.own.pan) < 0.1);
  assert.ok(Math.abs(footstepPair.other.pan) > 0.3);
  await capture(a, "public/assets/guide-weapon.png");
  // A torch stays with its holder's eyes, including the special second-person camera.
  Object.assign(A, { x: -8, z: -13 });
  Object.assign(B, { x: -8, z: -10.5 });
  A.queue = [];
  B.queue = [];
  r.torch = { x: -8, z: -10.5, owner: null };
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
  await capture(b, "public/assets/guide-torch.png");
  assert.equal(await b.evaluate(() => window.telemetry.visibilityScale), 1.15);
  assert.equal(await a.evaluate(() => window.telemetry.visibilityScale), 1);
  await a.waitForFunction(() => window.telemetry.specialAvailable);
  await a.bringToFront();
  await a.keyboard.press("f");
  await a.waitForFunction(() => window.telemetry.specialPhase === "setup");
  await b.waitForFunction(() => window.telemetry.specialPhase === "setup");
  const frozenClock = await a.locator("#timer").innerText();
  assert.equal(
    await a.evaluate(() => window.telemetry.visibilityScale),
    1.15,
    "borrowed torch eyes improve hunter visibility",
  );
  const setupPose = { ax: A.x, az: A.z, bx: B.x, bz: B.z };
  const setupAngle = await b.evaluate(() => window.telemetry.cameraYaw);
  await a.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent("mousemove", { buttons: 1, movementX: 80, movementY: 12 }),
    ),
  );
  await b.waitForFunction(
    (angle) => Math.abs(window.telemetry.cameraYaw - angle) > 0.05,
    setupAngle,
  );
  const controlledAngle = await b.evaluate(() => window.telemetry.cameraYaw);
  await b.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent("mousemove", {
        buttons: 1,
        movementX: 250,
        movementY: 30,
      }),
    ),
  );
  await a.keyboard.down("d");
  await b.keyboard.down("w");
  await a.waitForTimeout(250);
  await a.keyboard.up("d");
  await b.keyboard.up("w");
  assert.deepEqual(
    { ax: A.x, az: A.z, bx: B.x, bz: B.z },
    setupPose,
    "both bodies stay frozen during setup",
  );
  assert.equal(
    await b.evaluate(() => window.telemetry.cameraYaw),
    controlledAngle,
    "hider cannot turn their camera",
  );
  assert.equal(await a.locator("#timer").innerText(), frozenClock);
  r.special.phaseEnd = Date.now() + 50;
  await a.waitForFunction(() => window.telemetry.specialPhase === "action");
  const lockedAngle = await a.evaluate(() => window.telemetry.cameraYaw);
  await a.keyboard.down("d");
  await a.waitForTimeout(350);
  await a.keyboard.up("d");
  assert.ok(
    Math.abs(A.x - setupPose.ax) > 0.2,
    "hunter moves under fixed second-person camera",
  );
  await a.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent("mousemove", { buttons: 1, movementX: 120, movementY: 0 }),
    ),
  );
  await a.waitForTimeout(200);
  assert.equal(
    await a.evaluate(() => window.telemetry.cameraYaw),
    lockedAngle,
    "weapon aiming cannot rotate locked camera",
  );
  assert.equal(B.x, setupPose.bx);
  assert.equal(B.z, setupPose.bz);
  await capture(a, "docs/drishya-special-locked.png");
  fs.mkdirSync(path.join(evidenceDir, "public/assets"), { recursive: true });
  fs.copyFileSync(
    path.join(evidenceDir, "docs/drishya-special-locked.png"),
    path.join(evidenceDir, "public/assets/guide-special.png"),
  );
  // Use the real pointer/mouse firing path, aimed away from the hider.
  await a.mouse.click(450, 340);
  await a.waitForFunction(() => !!document.pointerLockElement);
  await a.mouse.down();
  await a.waitForTimeout(120);
  await a.mouse.up();
  await a.waitForFunction(() => window.telemetry.specialPhase === "invisible");
  await b.waitForFunction(() => window.telemetry.specialPhase === "invisible");
  assert.equal(A.ammo[0], 20);
  assert.equal(A.ammo[1], 0);
  await a.waitForFunction(() =>
    window.telemetry.sound.shots.some((s) => s.name === "specialShot" && s.own),
  );
  await b.waitForFunction(() =>
    window.telemetry.sound.shots.some(
      (s) => s.name === "specialShot" && !s.own,
    ),
  );
  assert.equal(
    await a.evaluate(() => window.telemetry.viewId === window.telemetry.ownId),
    true,
  );
  assert.equal(
    await a.evaluate(() =>
      window.telemetry.visibleBodyIds.includes(window.telemetry.invisibleId),
    ),
    false,
  );
  assert.equal(
    await a.evaluate(() =>
      window.telemetry.visibleTorchIds.includes(window.telemetry.invisibleId),
    ),
    false,
    "invisibility hides held torch too",
  );
  assert.equal(await b.evaluate(() => window.telemetry.canMove), true);
  assert.equal(
    await a.locator("#timer").innerText(),
    frozenClock,
    "invisibility still pauses universal clock",
  );
  await capture(a, "docs/drishya-special-invisible.png");
  // A real revolver hit plays the new shot sample and the damaged hider's local cue.
  Object.assign(A, { x: 0, y: 0, z: 4 });
  Object.assign(B, { x: 0.24, y: 0, z: 0, hp: 100 });
  A.queue = [];
  B.queue = [];
  r.history = [];
  await a.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent("mousemove", {
        buttons: 1,
        movementX: window.telemetry.yaw / 0.002,
        movementY: window.telemetry.cameraPitch / 0.002,
      }),
    ),
  );
  await a.waitForTimeout(750);
  const hunterHurtBefore = await a.evaluate(
    () => window.telemetry.sound.hurtPlays,
  );
  const hurtBefore = await b.evaluate(() => window.telemetry.sound.hurtPlays);
  await a.mouse.down();
  await a.waitForTimeout(120);
  await a.mouse.up();
  await b.waitForFunction(
    (previous) => window.telemetry.sound.hurtPlays === previous + 1,
    hurtBefore,
  );
  await a.waitForFunction(() =>
    window.telemetry.sound.shots.some((s) => s.name === "pistol" && s.own),
  );
  assert.equal(B.hp, 85);
  await a.waitForFunction(
    (previous) => window.telemetry.sound.hurtPlays === previous + 1,
    hunterHurtBefore,
  );
  assert.equal(
    hunterHurtBefore,
    hurtBefore,
    "both clients receive one cue for each hider hit",
  );
  await a.evaluate(() => document.exitPointerLock());
  r.special.phaseEnd = Date.now() + 50;
  await a.waitForFunction(() => window.telemetry.specialPhase === null);
  assert.equal(
    await a.evaluate(() => window.telemetry.specialAvailable),
    false,
    "special stays spent",
  );
  assert.equal(r.borrowed, false);
  r.startedAt = Date.now() - 20050;
  r.swapAt = 0;
  await a.waitForFunction(() => window.telemetry.borrowed);
  await b.waitForFunction(() => window.telemetry.borrowed);
  assert.equal(
    await a.evaluate(() => window.telemetry.visibilityScale),
    1.15,
    "traditional swapped torch eyes grant the boost",
  );
  assert.equal(
    await b.evaluate(() => window.telemetry.visibilityScale),
    1,
    "torch holder sees normal range through other eyes",
  );
  r.startedAt = Date.now() - 27050;
  r.swapAt = 0;
  await a.waitForFunction(() => !window.telemetry.borrowed);
  await b.waitForFunction(() => !window.telemetry.borrowed);
  // Portrait endpoint and bathroom are rendered from real game camera positions.
  Object.assign(B, { x: 0, z: -16, yaw: 0 });
  B.queue = [];
  await b.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent("mousemove", {
        buttons: 1,
        movementX: window.telemetry.yaw / 0.002,
        movementY: 0,
      }),
    ),
  );
  await b.waitForTimeout(400);
  await capture(b, "public/assets/guide-portrait.png");
  Object.assign(B, { x: 8, z: -19, yaw: 0 });
  B.queue = [];
  await b.waitForFunction(() =>
    document
      .getElementById("interaction")
      .textContent.includes("Enter the portrait"),
  );
  await b.keyboard.press("e");
  await b.waitForFunction(
    () =>
      window.telemetry.teleportUsed &&
      Math.abs(window.telemetry.position.x) < 0.1,
  );
  assert.equal(B.teleportUsed, true);
  Object.assign(B, { x: 17, z: -17.2 });
  B.queue = [];
  await b.waitForFunction(() =>
    document.getElementById("interaction").textContent.includes("Flush"),
  );
  await b.keyboard.press("e");
  await b.waitForFunction(
    () => !document.getElementById("interaction").textContent.includes("Flush"),
  );
  assert.equal(r.flushed, true);
  B.hp = 50;
  await b.waitForFunction(
    () => document.getElementById("healthFill").style.width === "50%",
  );
  assert.equal(
    await b.locator(".health-track").getAttribute("aria-valuenow"),
    "50",
  );
  B.hp = 100;
  Object.assign(B, { x: 14, z: -15, yaw: 0 });
  B.queue = [];
  await b.waitForTimeout(400);
  await capture(b, "docs/drishya-bathroom.png");
  Object.assign(B, { x: 12, z: 18, yaw: 0 });
  B.queue = [];
  await b.waitForTimeout(400);
  await capture(b, "docs/drishya-bedroom.png");
  await b.waitForFunction(
    () =>
      window.telemetry.sound.catPlays === 1 && window.telemetry.cat?.running,
  );
  r.catAt = Date.now() - 4000;
  Object.assign(B, { x: 0, z: 12 });
  B.queue = [];
  await b.evaluate(() =>
    window.dispatchEvent(
      new MouseEvent("mousemove", {
        buttons: 1,
        movementX: window.telemetry.yaw / 0.002,
        movementY: (window.telemetry.cameraPitch + 0.25) / 0.002,
      }),
    ),
  );
  await a.locator("#ready").dispatchEvent("click");
  await b.waitForFunction(
    () =>
      Math.abs(window.telemetry.cat.x) < 0.5 &&
      window.telemetry.cat.z < 10 &&
      window.telemetry.cat.visible &&
      Math.abs(window.telemetry.cameraPosition.x) < 0.1 &&
      Math.abs(window.telemetry.cameraPosition.z - 12) < 0.1,
  );
  fs.writeFileSync(
    path.join(evidenceDir, "cat-frame.json"),
    JSON.stringify(await b.evaluate(() => window.telemetry), null, 2),
  );
  await capture(b, "docs/drishya-cat-corridor.png");
  Object.assign(B, { x: 14.2, z: 14 });
  B.queue = [];
  await b.waitForTimeout(150);
  assert.ok(r.catAt, "cat wakes on authoritative bedroom entry");
  // Last-light aid is small, role-limited, and leaves vitality/ammo alone.
  r.end = Date.now() + 9500;
  r.startedAt = Date.now() - 30000;
  r.swapAt = 0; // force a phase update after changing the test clock
  await a.waitForTimeout(400);
  // Room timer normally stays fixed; refresh metadata via a harmless ready roster.
  await a.locator("#ready").dispatchEvent("click");
  await a.waitForTimeout(300);
  assert.equal(await a.evaluate(() => window.telemetry.speedScale), 1.1);
  assert.equal(await b.evaluate(() => window.telemetry.speedScale), 1);
  // Finish both survival rounds through the actual server clock/state machine.
  r.end = Date.now() - 1;
  await b.waitForFunction(() => window.telemetry.stage === "intermission");
  await b.locator("#roundEnd").waitFor({ state: "visible" });
  assert.match(await b.locator("#roundTitle").innerText(), /ROUND 1 ENDED/);
  await capture(b, "docs/drishya-round-end.png");
  r.stageEnd = Date.now() - 1;
  await a.waitForFunction(() => window.telemetry.round === 2);
  assert.equal(
    await a.evaluate(() => window.telemetry.sound.track),
    "gameplay",
    "gameplay music continues across rounds",
  );
  await a.waitForFunction(
    () =>
      document.getElementById("weapon").textContent === "UNARMED · STAY HIDDEN",
  );
  await b.locator("#waiting").waitFor();
  r.stageEnd = Date.now() - 1;
  r.startedAt = r.stageEnd;
  r.end = Date.now() + 20;
  await a.waitForFunction(() => window.telemetry.stage === "intermission");
  r.stageEnd = Date.now() - 1;
  await a.waitForFunction(() => window.telemetry.round === 3);
  assert.equal(A.role, "hunter");
  assert.equal(B.role, "hunter");
  r.stageEnd = Date.now() - 1;
  r.startedAt = r.stageEnd;
  r.end = Date.now() + 30;
  await a.waitForFunction(() => window.telemetry.stage === "intermission");
  r.stageEnd = Date.now() - 1;
  await a.locator("#results").waitFor();
  await a.waitForFunction(
    () =>
      window.telemetry.sound.track === "home" && window.telemetry.sound.playing,
  );
  assert.equal(await a.evaluate(() => window.telemetry.sound.introDone), true);
  assert.match(await a.locator("#resulttitle").innerText(), /draw/i);
  await a.locator("#returnLobby").click();
  assert.equal(await a.locator("#lobby").isVisible(), true);
  assert.equal(await a.locator("#ready").isEnabled(), true);
  assert.deepEqual(errors, []);
  assert.deepEqual(await a.evaluate(() => window.telemetry.sound.errors), []);
  assert.deepEqual(await b.evaluate(() => window.telemetry.sound.errors), []);
  const telemetry = await b.evaluate(() => window.telemetry);
  fs.writeFileSync(
    "test-results/mansion-browser.json",
    JSON.stringify(
      {
        errors,
        evidenceDir,
        telemetry,
        checks: [
          "two players",
          "autoplay fallback, one-time intro then looping home music",
          "gameplay music across rounds and home music on results",
          "decoded supplied footsteps with separate hunter/hider timbres and opponent panning",
          "nearby cat audio and doorway-to-corridor escape",
          "recorded regular/special gun shots and shared hider damage cue on both clients",
          "hunter hiding lock",
          "hider movement",
          "unarmed hider",
          "both bodies frozen during reveal",
          "independent reciprocal camera and own aim restoration",
          "special proximity activation and camera setup synchronization",
          "fixed second-person camera with independent hunter movement and firing",
          "paused universal clock through invisible escape and one-use consumption",
          "torch eye ownership during special and traditional swapped POV",
          "invisible body and held torch rendering",
          "compact settings and newspaper navigation",
          "last-light role-limited boost",
          "round reversal",
          "final duel",
          "draw",
          "rematch lobby",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      errors,
      evidenceDir,
      drawCalls: telemetry.drawCalls,
      triangles: telemetry.triangles,
      fps: telemetry.fps,
      checks: 22,
    }),
  );
} finally {
  clearInterval(timer);
  await browser?.close();
  for (const ws of wss.clients) ws.terminate();
  await new Promise((r) => server.close(r));
  wss.close();
  rooms.clear();
}
