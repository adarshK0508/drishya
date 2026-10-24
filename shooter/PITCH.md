# Five slides

1. **Your eyes are a shared resource.** A local-network competitive arena with periodic borrowed POV while your own body remains under your control.
2. **Original idea, modern architecture.** Original Unity exchanged JPEG camera frames. This implementation synchronizes one authoritative world and exchanges camera targets.
3. **Network engineering.** 60 Hz fixed simulation, 20 Hz binary delta snapshots, prediction/reconciliation, adaptive interpolation, bounded historical hitboxes, validation and reconnect tokens.
4. **Live demonstration and evidence.** Two players, view rotation, minimap navigation, then measured browser/bot test results. Distinguish software-rendered FPS from real laptop GPU performance.
5. **Next milestone.** Walkable vertical map geometry, ballistic grenades, complete audio/visual effects, stronger admission control, larger subjective latency trials.

## Judge Q&A
- **Can clients teleport or claim hits?** No position/target messages are accepted. Shared input semantics execute on the server; rays and health are server-owned.
- **Can clients cheat time?** Input timestamps are clamped to 200 ms. This is bounded rewind, not complete competitive-grade clock trust.
- **Scale?** Eight players per process-local room. Route rooms to shards; do not split a room's simulation across replicas.
- **Offline?** LAN requires no internet after npm install; Three.js and generated assets are local.
- **Is every requirement complete?** No. README identifies deliberate prototype limitations; TEST_REPORT lists only measurements actually run.
- **Leak-free?** Bounded history and queues reduce risk; a finite soak is evidence, never proof.
