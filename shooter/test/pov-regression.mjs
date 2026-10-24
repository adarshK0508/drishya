import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import assert from "node:assert/strict";
if (fs.existsSync(new URL("../.browsers", import.meta.url)))
  process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
    new URL("../.browsers", import.meta.url),
  );
const { chromium } = await import("playwright");
const server = spawn(process.execPath, ["server.mjs"], {
  env: { ...process.env, PORT: "3093" },
  stdio: "ignore",
});
let browser;
const errors = [];
async function key(page, code, down) {
  await page.evaluate(
    ({ code, down }) =>
      window.dispatchEvent(
        new KeyboardEvent(down ? "keydown" : "keyup", { code }),
      ),
    { code, down },
  );
}
async function aim(page, target) {
  await page.bringToFront();
  await page.evaluate(
    (target) =>
      window.dispatchEvent(
        new MouseEvent("mousemove", {
          buttons: 1,
          movementX:
            (window.telemetry.yaw - target) /
            (0.002 * +document.getElementById("sensitivity").value),
        }),
      ),
    target,
  );
  await page.waitForTimeout(250);
}
async function shoot(page) {
  await page.bringToFront();
  await page.evaluate(() =>
    document
      .getElementById("game")
      .dispatchEvent(new MouseEvent("mousedown", { button: 0 })),
  );
  await page.waitForTimeout(80);
  await page.evaluate(() => window.dispatchEvent(new MouseEvent("mouseup")));
  await page.waitForTimeout(250);
}
try {
  for (let n = 0; n < 100; n++) {
    try {
      await fetch("http://localhost:3093");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
    ],
  });
  const a = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const b = await browser.newPage({ viewport: { width: 960, height: 600 } });
  for (const [page, name] of [
    [a, "Alpha"],
    [b, "Beta"],
  ]) {
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://localhost:3093");
    await page.locator("#name").fill(name);
    if (page === b)
      await page
        .locator("#code")
        .fill(await a.locator("#roomcode").innerText());
    await page.locator("#join").click();
    await page.locator("#ready").click();
  }
  await a.locator("#start").click();
  await a.waitForFunction(
    () => window.telemetry.active && window.telemetry.ownId,
  );
  const first = await a.evaluate(() => ({ ...window.telemetry }));
  assert.equal(first.borrowed, false);
  assert.ok((await a.locator("#countdown").innerText()).startsWith("SWAP IN"));
  assert.ok(Math.abs(first.roundEnd - first.phaseEnd - 55000) < 1);
  // Walk along clear arena edges to meet within 1.5m, with ordinary player inputs.
  await aim(b, Math.PI / 2);
  await key(b, "KeyW", true);
  await key(b, "ShiftLeft", true);
  await b.waitForFunction(() => window.telemetry.position.x < -19, undefined, {
    timeout: 10000,
  });
  await key(b, "KeyW", false);
  await key(b, "ShiftLeft", false);
  await aim(a, -Math.PI);
  await key(a, "KeyW", true);
  await key(a, "ShiftLeft", true);
  await a.waitForFunction(() => window.telemetry.position.z > 19.7, undefined, {
    timeout: 10000,
  });
  await key(a, "KeyW", false);
  await key(a, "ShiftLeft", false);
  await aim(a, -Math.PI / 2);
  const nearA = await a.evaluate(() => ({ ...window.telemetry }));
  const nearB = await b.evaluate(() => ({ ...window.telemetry }));
  const distance = Math.hypot(
    nearA.position.x - nearB.position.x,
    nearA.position.z - nearB.position.z,
  );
  assert.ok(distance < 1.5, `close range ${distance}`);
  assert.equal(nearA.borrowed, true);
  assert.ok(nearA.visibleBodyIds.includes(nearA.ownId));
  assert.equal(nearA.bodiesFrustumCulled, false);
  assert.equal(await a.locator("#countdown").innerText(), "");
  // Also capture readable, face-to-face views after the overlap stress case.
  await aim(
    a,
    Math.atan2(
      nearA.position.x - nearB.position.x,
      nearA.position.z - nearB.position.z,
    ),
  );
  await key(a, "KeyS", true);
  await a.waitForTimeout(180);
  await key(a, "KeyS", false);
  await a.waitForTimeout(250);
  const separated = await a.evaluate(() => window.telemetry.position);
  await aim(
    b,
    Math.atan2(nearB.position.x - separated.x, nearB.position.z - separated.z),
  );
  await shoot(a);
  const borrowedShot = await a.evaluate(() => window.telemetry.lastShot);
  assert.equal(borrowedShot.shooterId, nearA.ownId);
  assert.equal(borrowedShot.screenShake, false);
  assert.notEqual(borrowedShot.viewId, nearA.ownId);
  await a.screenshot({ path: "docs/close-borrowed.png" });
  await a.waitForFunction(
    () => document.getElementById("countdown").textContent === "OWN POV IN 3",
    undefined,
    { timeout: 10000 },
  );
  await a.waitForFunction(() => !window.telemetry.borrowed, undefined, {
    timeout: 6000,
  });
  assert.ok(
    (await a.evaluate(() => window.telemetry.visibleBodyIds)).includes(
      nearB.ownId,
    ),
  );
  await shoot(a);
  const ownShot = await a.evaluate(() => window.telemetry.lastShot);
  assert.equal(ownShot.screenShake, true);
  assert.equal(ownShot.viewId, nearA.ownId);
  await key(a, "Space", true);
  await a.waitForTimeout(100);
  await key(a, "Space", false);
  await a.waitForFunction(() => window.telemetry.position.y > 0.35);
  const jumpHeight = await a.evaluate(() => window.telemetry.position.y);
  await a.waitForFunction(() => window.telemetry.position.y === 0, undefined, {
    timeout: 2500,
  });
  await a.screenshot({ path: "docs/close-own.png" });
  await a.waitForFunction(() => window.telemetry.borrowed, undefined, {
    timeout: 6000,
  });
  await a.waitForFunction(() => !window.telemetry.borrowed, undefined, {
    timeout: 18000,
  });
  await a.waitForFunction(() => window.telemetry.borrowed, undefined, {
    timeout: 6000,
  });
  await a.locator("#results").waitFor({ state: "visible", timeout: 17000 });
  const endOffsetMs = Date.now() - first.roundEnd;
  assert.ok(
    endOffsetMs >= -50 && endOffsetMs < 1500,
    `round expiry offset ${endOffsetMs}`,
  );
  assert.deepEqual(errors, []);
  const result = {
    passed: true,
    distance,
    jumpHeight,
    endOffsetMs,
    cycles: 3,
    borrowedShot,
    ownShot,
    errors,
  };
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(
    "test-results/pov-regression.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  server.kill();
}
