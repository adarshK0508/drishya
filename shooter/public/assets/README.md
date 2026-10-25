# Entrance and guide assets

- `entrance-eye.webm`: byte-identical copy of the user's `Halloween-Projection-Loop-SnapYT.App.webm` (10-second, silent VP9 loop). Muted video, blended over the scratched surface, paused during gameplay.
- `blood-scratches.svg`: code-drawn oxblood surface, directional scratches and grain. No external texture request.
- `guide-{hide,swap,weapon,special,torch,portrait}.png`: screenshots captured from this game's actual rendered clients. The portrait panel shows the interactable bathroom portrait. Newspaper color treatment is CSS; all pictures and captions remain in one spread.
- `bathroom-portrait.png` / `corridor-portrait.png`: existing supplied house portraits, retained.
- `fonts/`: locally bundled licensed print faces; see its README and license files.
- `audio/`: supplied music/effects and source mapping, including separate match winner/loser tracks.

`npm run test:visual` captures to a new ignored `test-results/visuals-*/` directory, validates guide fitting and real outcome routing, and composes five clean guide photos under `guide/`. It never overwrites published assets. Inspect captures before explicitly copying selected images into this directory. The automatic-swap photograph is captured by `test/browser.mjs` under its own ignored evidence directory.
