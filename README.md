# PARALLAX — Syntax Error 2026

This repository contains **PARALLAX**, a LAN multiplayer shooter in [`shooter/`](shooter/). The original Unity shooter prototype remains at the repository root; its original instructions are preserved in [`UNITY_README.md`](UNITY_README.md).

## Play PARALLAX

Requires Node.js 20+ and a desktop browser with WebGL. From the repository root:

```sh
cd shooter
npm install
npm start
```

Open the printed URL. All players on a hotspot or private LAN use the same server URL and room code. The server prints LAN addresses and a QR code. Ready up, then the host starts. Full controls, architecture, Docker run command, screenshots, and evidence are in [`shooter/README.md`](shooter/README.md) and [`shooter/TEST_REPORT.md`](shooter/TEST_REPORT.md).

## Demo order

1. Open PARALLAX on two laptops. Show one world with cameras exchanged while each player still controls their own body.
2. Show the body marker on the minimap, weapons and a second match mode.
3. Use F3 diagnostics and the measured bot/browser evidence to explain the network design.

The two-minute script is [`shooter/DEMO_SCRIPT.md`](shooter/DEMO_SCRIPT.md). No public host has been deployed; the current run path is local/LAN.
