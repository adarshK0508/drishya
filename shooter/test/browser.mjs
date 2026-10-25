import { fileURLToPath } from "node:url";
import fs from "node:fs";
import assert from "node:assert/strict";
import { server, wss, rooms, step } from "../server.mjs";
import { SEARCH_MS } from "../shared/hunt.mjs";
if (fs.existsSync(new URL("../.browsers", import.meta.url)))
  process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
    new URL("../.browsers", import.meta.url),
  );
const { chromium } = await import("playwright");
fs.mkdirSync("test-results", { recursive: true });
fs.mkdirSync("docs", { recursive: true });
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
  await a.screenshot({ path: "docs/drishya-menu.png" });
  await a.locator("#help").click();
  assert.equal(await a.locator("#tutorial").isVisible(), true);
  await a.screenshot({ path: "docs/drishya-guide.png" });
  await a.locator("#home").click();
  await a.locator("#enter").click();
  await b.locator("#enter").click();
  // Deterministic activation for concurrent software-rendered clients; physical menu clicking is also checked separately.
  await a.locator("#name").fill("Ash");
  await a.locator("#join").dispatchEvent("click");
  await a.locator("#roomcode").waitFor();
  const code = await a.locator("#roomcode").innerText();
  await b.locator("#name").fill("Wren");
  await b.locator("#code").fill(code);
  await b.locator("#join").dispatchEvent("click");
  await b.locator("#roomcode").waitFor();
  await a.locator("#ready").click();
  await b.locator("#ready").click();
  await a.locator("#start").click();
  await b.waitForFunction(() => window.telemetry.stage === "hide");
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
  await b.screenshot({ path: "docs/mansion-library.png" });
  await b.screenshot({ path: "public/assets/guide-hide.png" });
  r.stageEnd = Date.now() - 1;
  r.startedAt = r.stageEnd;
  r.end = r.startedAt + SEARCH_MS;
  await a.waitForFunction(() => window.telemetry.stage === "search");
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
  await b.screenshot({ path: "docs/drishya-swap-warning.png" });
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
  await a.screenshot({ path: "public/assets/guide-swap.png" });
  await a.screenshot({ path: "docs/mansion-borrowed.png" });
  await a.locator("#settingsbtn").click();
  assert.equal(
    await a
      .locator("#settings")
      .evaluate((e) => e.scrollHeight <= e.clientHeight),
    true,
    "settings fits without scroll",
  );
  await a.screenshot({ path: "docs/drishya-settings.png" });
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
  await b.screenshot({ path: "public/assets/guide-portrait.png" });
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
  await b.screenshot({ path: "docs/drishya-bathroom.png" });
  Object.assign(B, { x: 12, z: 18, yaw: 0 });
  B.queue = [];
  await b.waitForTimeout(400);
  await b.screenshot({ path: "docs/drishya-bedroom.png" });
  Object.assign(B, { x: 14.2, z: 14 });
  B.queue = [];
  await b.waitForTimeout(150);
  assert.ok(r.catAt, "cat wakes on authoritative player proximity");
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
  await b.screenshot({ path: "docs/drishya-round-end.png" });
  r.stageEnd = Date.now() - 1;
  await a.waitForFunction(() => window.telemetry.round === 2);
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
  assert.match(await a.locator("#resulttitle").innerText(), /draw/i);
  await a.locator("#returnLobby").click();
  assert.equal(await a.locator("#lobby").isVisible(), true);
  assert.equal(await a.locator("#ready").isEnabled(), true);
  assert.deepEqual(errors, []);
  const telemetry = await b.evaluate(() => window.telemetry);
  fs.writeFileSync(
    "test-results/mansion-browser.json",
    JSON.stringify(
      {
        errors,
        telemetry,
        checks: [
          "two players",
          "hunter hiding lock",
          "hider movement",
          "unarmed hider",
          "both bodies frozen during reveal",
          "independent reciprocal camera and own aim restoration",
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
      drawCalls: telemetry.drawCalls,
      triangles: telemetry.triangles,
      fps: telemetry.fps,
      checks: 10,
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
