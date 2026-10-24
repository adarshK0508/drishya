import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import fs from "node:fs";
import assert from "node:assert/strict";
if (fs.existsSync(new URL("../.browsers", import.meta.url)))
  process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
    new URL("../.browsers", import.meta.url),
  );
const { chromium } = await import("playwright");
fs.mkdirSync("test-results", { recursive: true });
fs.mkdirSync("docs", { recursive: true });
let server = spawn(process.execPath, ["server.mjs"], {
  env: { ...process.env, PORT: "3092" },
  stdio: "ignore",
});
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch("http://localhost:3092");
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  browser = await chromium.launch({
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  let a = await browser.newPage({ viewport: { width: 1440, height: 900 } }),
    b = await browser.newPage(),
    errors = [];
  for (let page of [a, b]) {
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (e) => {
      if (e.type() === "error") errors.push(e.text());
    });
    await page.goto("http://localhost:3092");
  }
  await a.screenshot({ path: "docs/menu.png" });
  await a.locator("#name").fill("Alpha");
  await a.locator("#join").click();
  await a.locator("#roomcode").waitFor();
  let code = await a.locator("#roomcode").innerText();
  await b.locator("#name").fill("Beta");
  await b.locator("#code").fill(code);
  await b.locator("#join").click();
  await a.locator("#map").selectOption("1");
  await a.locator("#theme").selectOption("2");
  await b.waitForFunction(
    () =>
      document.getElementById("map").value === "1" &&
      document.getElementById("theme").value === "2",
  );
  await a.locator("#ready").click();
  await b.locator("#ready").click();
  await a.locator("#start").click();
  await a.waitForFunction(() => window.telemetry.snapshots > 30);
  await a.waitForTimeout(3000);
  let telemetry = await a.evaluate(() => window.telemetry);
  await a.screenshot({ path: "docs/arena.png" });
  assert.ok(telemetry.snapshots > 30);
  assert.ok(await b.evaluate(() => window.telemetry.snapshots > 10));
  await b.waitForFunction(
    () => !document.getElementById("hud").classList.contains("hidden"),
  );
  await b.bringToFront();
  await b.waitForTimeout(300);
  const before = await b.evaluate(() => window.telemetry.position);
  await b.keyboard.down("w");
  await b.waitForTimeout(1100);
  await b.keyboard.up("w");
  const after = await b.evaluate(() => ({ ...window.telemetry }));
  assert.ok(
    Math.hypot(after.position.x - before.x, after.position.z - before.z) > 0.2,
    `authoritative movement reached client: ${JSON.stringify({ before, after })}`,
  );
  const c = await browser.newPage();
  c.on("pageerror", (e) => errors.push(e.message));
  await c.goto("http://localhost:3092");
  await c.locator("#name").fill("Observer");
  await c.locator("#code").fill(code);
  await c.locator("#spectator").check();
  await c.locator("#join").click();
  await c.waitForFunction(() =>
    document.getElementById("viewlabel").textContent.startsWith("SPECTATING"),
  );
  await c.locator("#spectateNext").click();
  assert.equal(await c.locator("#spectateNext").isVisible(), true);
  await a.waitForFunction(
    () =>
      document
        .getElementById("viewlabel")
        .textContent.startsWith("BORROWED EYES"),
    undefined,
    { timeout: 35000 },
  );
  await a.screenshot({ path: "docs/borrowed.png" });
  await a.keyboard.press("F3");
  assert.equal(await a.locator("#stats").isVisible(), true);
  await a.locator("#settingsbtn").click();
  await a.locator("#closeSettings").click();
  await a.evaluate(() => document.getElementById("game").click());
  await a.waitForTimeout(300);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    "test-results/browser.json",
    JSON.stringify(
      {
        telemetry,
        errors,
        browser: "Chromium headless SwiftShader",
        fpsPass: telemetry.fps >= 30,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ telemetry, errors }));
  assert.ok(telemetry.fps >= 30, `FPS ${telemetry.fps}`);
} finally {
  await browser?.close();
  server.kill();
}
