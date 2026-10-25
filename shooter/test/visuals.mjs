// Repeatable screenshots from the actual game, using one rendered client and a LAN peer.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { WebSocket } from "ws";
import { server, wss, rooms, step } from "../server.mjs";
if (fs.existsSync(new URL("../.browsers", import.meta.url)))
  process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(
    new URL("../.browsers", import.meta.url),
  );
const { chromium } = await import("playwright");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
const ticker = setInterval(() => step(), 1000 / 60);
let browser, peer;
try {
  browser = await chromium.launch({
    headless: true,
    args: [
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
      "--mute-audio",
    ],
  });
  const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.screenshot({ path: "docs/drishya-menu.png" });
  await page.locator("#help").click();
  // Capture the entire scrolling newspaper within its own surface.
  await page.setViewportSize({ width: 1440, height: 1250 });
  await page.screenshot({ path: "docs/drishya-guide.png" });
  await page.locator("#home").click();
  await page.setViewportSize({ width: 1280, height: 800 });
  peer = new WebSocket(url.replace("http:", "ws:"));
  await once(peer, "open");
  const joined = new Promise((resolve) =>
    peer.on("message", (data, binary) => {
      if (!binary) {
        const m = JSON.parse(data);
        if (m.type === "joined") resolve(m);
      }
    }),
  );
  peer.send(JSON.stringify({ type: "join", name: "Ash" }));
  const host = await joined;
  await page.locator("#enter").click();
  await page.locator("#name").fill("Wren");
  await page.locator("#code").fill(host.code);
  await page.locator("#join").click();
  await page.locator("#ready").click();
  peer.send(JSON.stringify({ type: "ready" }));
  await page.waitForTimeout(100);
  peer.send(JSON.stringify({ type: "start" }));
  await page.waitForFunction(() => window.telemetry.stage === "hide");
  const room = rooms.get(host.code),
    p = [...room.players.values()].find((p) => p.id !== host.id);
  room.stageEnd = Date.now() - 1;
  room.startedAt = room.stageEnd;
  room.end = Date.now() + 135000;
  await page.waitForFunction(() => window.telemetry.stage === "search");
  async function position(x, z, angle = 0) {
    Object.assign(p, { x, z, keys: 0, queue: [] });
    await page.evaluate(
      (angle) =>
        window.dispatchEvent(
          new MouseEvent("mousemove", {
            buttons: 1,
            movementX: (window.telemetry.yaw - angle) / 0.002,
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
    await page.waitForTimeout(180);
  }
  await position(14, -15, 0);
  await page.screenshot({ path: "docs/drishya-bathroom.png" });
  await position(14, -11, -1.25);
  await page.screenshot({ path: "docs/drishya-bath.png" });
  await position(8, 17, -0.927);
  await page.screenshot({ path: "docs/drishya-bedroom.png" });
  await position(0, -16, 0);
  await page.screenshot({ path: "public/assets/guide-portrait.png" });
  await position(-8, -11, 1.1);
  await page.screenshot({ path: "public/assets/guide-hide.png" });
  await page.locator("#settingsbtn").click();
  for (const [width, height] of [
    [1280, 800],
    [960, 600],
    [1366, 768],
  ]) {
    await page.setViewportSize({ width, height });
    if (
      !(await page
        .locator("#settings")
        .evaluate((e) => e.scrollHeight <= e.clientHeight))
    )
      throw Error(`Settings scroll at ${width}x${height}`);
  }
  await page.screenshot({ path: "docs/drishya-settings.png" });
  if (errors.length) throw Error(errors.join("\n"));
  console.log("Visuals captured; settings fit 1280×800, 960×600 and 1366×768.");
} finally {
  clearInterval(ticker);
  peer?.terminate();
  await browser?.close();
  for (const ws of wss.clients) ws.terminate();
  await new Promise((resolve) => server.close(resolve));
  wss.close();
  rooms.clear();
}
