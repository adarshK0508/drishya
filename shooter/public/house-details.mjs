import * as THREE from "./vendor/three.module.js";
import { mansionRooms } from "/shared/mansion.mjs";

export function buildDetails(scene) {
  const existing = new Set(scene.children);
  const unitBox = new THREE.BoxGeometry(1, 1, 1),
    unitSphere = new THREE.SphereGeometry(1, 20, 12),
    unitRing = new THREE.TorusGeometry(1, 0.12, 10, 40);
  const ivory = new THREE.MeshStandardMaterial({
    color: 0xc4c8b5,
    roughness: 0.28,
    metalness: 0.12,
  });
  const copper = new THREE.MeshStandardMaterial({
    color: 0x9c7950,
    roughness: 0.5,
    metalness: 0.6,
  });
  const wood = new THREE.MeshStandardMaterial({
    color: 0x382a2c,
    roughness: 0.9,
  });
  const water = new THREE.MeshStandardMaterial({
    color: 0x426961,
    roughness: 0.18,
    metalness: 0.35,
  });
  const indigo = new THREE.MeshStandardMaterial({
    color: 0x34384c,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x141c23,
    roughness: 0.9,
  });
  function mesh(geometry, material, x, y, z, parent = scene) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  }
  const box = (x, y, z, w, h, d, m = wood) => {
    const o = mesh(unitBox, m, x, y, z);
    o.scale.set(w, h, d);
    return o;
  };
  function ellipsoid(x, y, z, w, h, d, m, parent = scene) {
    const o = mesh(unitSphere, m, x, y, z, parent);
    o.scale.set(w, h, d);
    return o;
  }
  function rim(x, y, z, w, d, m = ivory) {
    const o = mesh(unitRing, m, x, y, z);
    o.rotation.x = Math.PI / 2;
    o.scale.set(w, d, 1);
    return o;
  }
  function bowl(x, y, z, w, h, d) {
    const profile = [
      [0, 0],
      [0.5, 0],
      [0.8, 0.25],
      [1, 0.85],
      [1, 1],
      [0.9, 1],
      [0.78, 0.3],
      [0, 0.2],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const o = mesh(new THREE.LatheGeometry(profile, 40), ivory, x, y, z);
    o.scale.set(w, h, d);
    return o;
  }
  function tap(x, y, z) {
    box(x, y, z, 0.07, 0.4, 0.07, copper);
    box(x, y + 0.18, z + 0.14, 0.07, 0.07, 0.35, copper);
    for (const s of [-1, 1])
      box(x + s * 0.17, y - 0.1, z, 0.1, 0.1, 0.13, copper);
  }
  // A claw-foot bath, pedestal basin, and porcelain toilet, with actual open bowls.
  ellipsoid(17, 0.26, -18.7, 0.28, 0.27, 0.35, ivory);
  bowl(17, 0.43, -18.6, 0.47, 0.3, 0.61);
  ellipsoid(17, 0.61, -18.59, 0.34, 0.008, 0.44, water);
  rim(17, 0.76, -18.6, 0.44, 0.57);
  box(17, 1.02, -19.2, 0.83, 0.65, 0.32, ivory);
  box(17, 1.36, -19.2, 0.88, 0.07, 0.37, ivory);
  box(17.32, 1.15, -19, 0.15, 0.045, 0.045, copper);
  const poop = new THREE.Group();
  scene.add(poop);
  poop.position.set(17, 0.64, -18.58);
  const brown = new THREE.MeshStandardMaterial({
    color: 0x59402a,
    roughness: 0.96,
  });
  for (let n = 0; n < 3; n++)
    ellipsoid(
      n * 0.022,
      n * 0.065,
      0,
      0.15 - n * 0.035,
      0.065,
      0.12 - n * 0.025,
      brown,
      poop,
    );
  const swirl = rim(17, 0.63, -18.59, 0.25, 0.32, water);
  ellipsoid(12, 0.45, -19, 0.23, 0.45, 0.25, ivory);
  bowl(12, 0.84, -19, 0.8, 0.27, 0.46);
  ellipsoid(12, 1.01, -18.97, 0.61, 0.008, 0.3, water);
  rim(12, 1.14, -18.97, 0.72, 0.39);
  tap(12, 1.33, -19.3);
  box(12, 2.05, -20.55, 1.6, 1.4, 0.1, copper);
  box(
    12,
    2.05,
    -20.48,
    1.42,
    1.2,
    0.02,
    new THREE.MeshStandardMaterial({
      color: 0x687d79,
      metalness: 0.65,
      roughness: 0.22,
    }),
  );
  bowl(18.5, 0.16, -12, 0.98, 0.6, 1.95);
  ellipsoid(18.5, 0.59, -12, 0.8, 0.008, 1.59, water);
  rim(18.5, 0.79, -12, 0.91, 1.83);
  tap(18.5, 1, -13.65);
  for (const dx of [-0.65, 0.65])
    for (const dz of [-1.4, 1.4])
      ellipsoid(18.5 + dx, 0.15, -12 + dz, 0.13, 0.16, 0.18, copper);
  const tileA = new THREE.MeshStandardMaterial({
      color: 0x76928a,
      roughness: 0.6,
    }),
    tileB = new THREE.MeshStandardMaterial({ color: 0x293d43, roughness: 0.6 });
  const tileGeo = new THREE.BoxGeometry(0.97, 0.025, 0.97);
  for (const [parity, material] of [
    [0, tileA],
    [1, tileB],
  ]) {
    const tiles = [];
    for (let x = 4; x <= 20; x++)
      for (let z = -20; z <= -8; z++)
        if ((x + z + 40) % 2 === parity) tiles.push([x, z]);
    const batch = new THREE.InstancedMesh(tileGeo, material, tiles.length),
      dummy = new THREE.Object3D();
    tiles.forEach(([x, z], i) => {
      dummy.position.set(x, 0.017, z);
      dummy.updateMatrix();
      batch.setMatrixAt(i, dummy.matrix);
    });
    scene.add(batch);
  }
  // Towel rail, folded linen, and a copper plumbing riser.
  box(20.5, 1.45, -16, 0.08, 0.08, 1.5, copper);
  box(20.42, 1.15, -16, 0.05, 0.65, 0.8, ivory);
  // Master bedroom: tall posts, canopy rails, vanity and ragged curtain panels.
  for (const x of [10.5, 13.5])
    for (const z of [11.95, 16.05]) {
      box(x, 1.5, z, 0.12, 3, 0.12);
      ellipsoid(x, 3.06, z, 0.14, 0.14, 0.14, copper);
    }
  box(12, 2.9, 11.95, 3.2, 0.16, 0.15);
  box(12, 2.9, 16.05, 3.2, 0.16, 0.15);
  for (const x of [10.5, 13.5]) box(x, 2.9, 14, 0.15, 0.16, 4.2);
  box(12, 2.98, 14, 3.1, 0.04, 4.1, indigo);
  for (const x of [10.65, 13.35]) box(x, 2, 15.7, 0.045, 1.7, 0.55, indigo);
  box(18.8, 2.05, 19.3, 1.7, 1.5, 0.08, copper);
  box(18.8, 2.05, 19.24, 1.5, 1.3, 0.03, dark);
  for (let n = 0; n < 9; n++)
    box(13.8 + n * 0.3, 2.1, 7.6, 0.24, 1.8 + (n % 3) * 0.25, 0.1, indigo);
  // Recognizable dining table settings, library ladder, kitchen stove and chapel candles.
  for (const x of [-13.4, -10.6])
    for (const z of [-0.6, 0.6]) {
      const plate = mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.025, 20),
        ivory,
        x,
        1.08,
        z,
      );
      box(x + 0.38, 1.09, z, 0.035, 0.025, 0.32, copper);
    }
  for (const x of [-12.3, -11.7]) box(x, 1.4, 0, 0.07, 0.7, 0.07, copper);
  for (const x of [-19.7, -18.9]) box(x, 1.3, -17.9, 0.07, 2.6, 0.07, copper);
  for (let n = 0; n < 7; n++)
    box(-19.3, 0.25 + n * 0.35, -17.9, 0.8, 0.06, 0.07, copper);
  for (const x of [17.2, 18.6])
    for (const z of [-5.2, -4.6]) {
      const burner = mesh(
        new THREE.TorusGeometry(0.23, 0.045, 6, 16),
        dark,
        x,
        1.37,
        z,
      );
      burner.rotation.x = Math.PI / 2;
    }
  for (let n = 0; n < 5; n++) {
    box(-18.6 + n * 0.44, 1.95, 18.8, 0.07, 0.5, 0.07, ivory);
    ellipsoid(
      -18.6 + n * 0.44,
      2.24,
      18.8,
      0.035,
      0.09,
      0.035,
      new THREE.MeshBasicMaterial({ color: 0xcfa266 }),
    );
  }
  // Original supplied photographs remain local. Tint and engraved framing belong to the scene.
  const loader = new THREE.TextureLoader();
  function portrait(url, x, y, z, w, h) {
    box(x, y, z, w + 0.23, h + 0.23, 0.13, copper);
    box(x, y, z + 0.08, w + 0.07, h + 0.07, 0.04, wood);
    const texture = loader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xb7ad87,
      roughness: 1,
    });
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <map_fragment>",
        `#include <map_fragment>
      float ink = dot(diffuseColor.rgb, vec3(.299,.587,.114));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(ink)*vec3(1.12,1.0,.8),.72);
      diffuseColor.rgb *= .91 + .09*sin(vMapUv.y*900.0);`,
      );
    };
    material.customProgramCacheKey = () => "drishya-engraving";
    mesh(new THREE.PlaneGeometry(w, h), material, x, y, z + 0.11);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1])
        ellipsoid(
          x + sx * (w / 2 + 0.06),
          y + sy * (h / 2 + 0.06),
          z + 0.13,
          0.085,
          0.085,
          0.035,
          copper,
        );
  }
  portrait("/assets/bathroom-portrait.png", 8, 2, -20.55, 1.35, 1.5);
  portrait("/assets/corridor-portrait.png", 0, 2, -20.55, 3.35, 3.1);
  for (const r of mansionRooms) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 80;
    const g = c.getContext("2d");
    g.fillStyle = "#18202b";
    g.fillRect(0, 0, 512, 80);
    g.strokeStyle = "#b38460";
    g.strokeRect(4, 4, 504, 72);
    g.fillStyle = "#dfceb0";
    g.font = "30px Palatino Linotype, serif";
    g.textAlign = "center";
    g.fillText(r.name.toUpperCase(), 256, 51);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const plaque = mesh(
      new THREE.PlaneGeometry(1.8, 0.28),
      new THREE.MeshBasicMaterial({ map: t }),
      Math.sign(r.x) * 2.75,
      2.7,
      r.z,
    );
    plaque.rotation.y = (-Math.sign(r.x) * Math.PI) / 2;
  }
  const cat = new THREE.Group();
  scene.add(cat);
  cat.position.set(12, 0.98, 14);
  const fur = new THREE.MeshStandardMaterial({ color: 0x837e72, roughness: 1 });
  ellipsoid(0, 0.13, 0, 0.43, 0.2, 0.25, fur, cat);
  ellipsoid(-0.3, 0.22, -0.12, 0.19, 0.18, 0.17, fur, cat);
  for (const x of [-0.41, -0.21])
    mesh(new THREE.ConeGeometry(0.075, 0.18, 3), fur, x, 0.41, -0.12, cat);
  for (const x of [-0.38, -0.24]) {
    const eye = mesh(
      new THREE.BoxGeometry(0.055, 0.012, 0.015),
      dark,
      x,
      0.24,
      -0.275,
      cat,
    );
    eye.rotation.z = 0.12;
  }
  const tail = mesh(
    new THREE.TorusGeometry(0.31, 0.06, 6, 16, Math.PI * 1.45),
    fur,
    0.12,
    0.15,
    0,
    cat,
  );
  tail.rotation.x = Math.PI / 2;
  const paws = [];
  for (const x of [-0.25, 0.25])
    for (const z of [-0.12, 0.12])
      paws.push(ellipsoid(x, 0, z, 0.085, 0.12, 0.08, fur, cat));
  // Batch static repeated geometry to keep the richer rooms inexpensive on laptops.
  const batches = new Map();
  for (const child of [...scene.children]) {
    if (
      existing.has(child) ||
      !child.isMesh ||
      child.isInstancedMesh ||
      child === swirl
    )
      continue;
    const key = child.geometry.uuid + child.material.uuid;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(child);
  }
  for (const items of batches.values()) {
    if (items.length < 2) continue;
    const batch = new THREE.InstancedMesh(
      items[0].geometry,
      items[0].material,
      items.length,
    );
    items.forEach((o, i) => {
      o.updateMatrix();
      batch.setMatrixAt(i, o.matrix);
      scene.remove(o);
    });
    batch.computeBoundingSphere();
    scene.add(batch);
  }
  let flushStarted = 0;
  return {
    flush() {
      flushStarted = performance.now();
    },
    update(now, world, clockNow) {
      if (!world?.flushed) flushStarted = 0;
      const f = flushStarted
        ? Math.min(1, (now - flushStarted) / 1600)
        : world?.flushed
          ? 1
          : 0;
      poop.visible = f < 1;
      poop.scale.setScalar(Math.max(0.001, 1 - f));
      poop.rotation.y = f * 14;
      poop.position.y = 0.64 - f * 0.2;
      swirl.rotation.z = f * 15;
      swirl.visible = f > 0 && f < 1;
      const t = world?.catAt ? Math.max(0, (clockNow - world.catAt) / 1000) : 0;
      if (!t) {
        cat.position.set(12, 0.98 + Math.sin(now * 0.002) * 0.012, 14);
        cat.rotation.y = 0;
        cat.visible = true;
      } else {
        const travel = Math.min(t * 4, 12),
          jump = Math.min(1, t / 0.7);
        cat.position.set(
          12 + Math.min(travel, 4.2),
          0.98 -
            jump * 0.76 +
            Math.sin(jump * Math.PI) * 0.65 +
            Math.abs(Math.sin(t * 19)) * 0.07,
          14 + Math.max(0, travel - 4.2) * 0.54,
        );
        cat.rotation.y = travel < 4.2 ? Math.PI : 2.3;
        cat.visible = t < 4;
        paws.forEach(
          (p, i) => (p.position.y = Math.sin(t * 19 + i * Math.PI) * 0.09),
        );
      }
    },
  };
}
