import * as THREE from "./vendor/three.module.js";
import { mansionRooms, mansionProps } from "/shared/mansion.mjs";

function surface(kind, color = "#685044", motif = "") {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = color;
  g.fillRect(0, 0, 256, 256);
  // Deterministic wear: no asset downloads and identical clues on both clients.
  for (let i = 0; i < 700; i++) {
    g.fillStyle = i % 2 ? "#00000016" : "#fff0cb09";
    g.fillRect((i * 47) % 256, (i * 89) % 256, 1 + (i % 7), 1 + (i % 3));
  }
  if (kind === "wood") {
    g.strokeStyle = "#1b1411";
    g.lineWidth = 2;
    for (let y = 0; y < 256; y += 32) {
      g.strokeRect(0, y, 256, 32);
      g.strokeRect(y % 64 ? 75 : 170, y, 256, 32);
    }
    g.strokeStyle = "#a3896225";
    for (let i = 0; i < 50; i++) {
      g.beginPath();
      g.moveTo((i * 47) % 256, i * 5);
      g.lineTo(256, i * 5 + 2);
      g.stroke();
    }
  } else if (kind === "wall") {
    g.strokeStyle = "#d9bd7b28";
    for (let x = 16; x < 256; x += 32)
      for (let y = 16; y < 256; y += 48) {
        g.beginPath();
        g.moveTo(x, y - 12);
        g.lineTo(x + 8, y);
        g.lineTo(x, y + 12);
        g.lineTo(x - 8, y);
        g.closePath();
        g.stroke();
      }
    g.fillStyle = "#131511";
    g.fillRect(0, 180, 256, 76);
    g.strokeStyle = "#6d5335";
    for (let x = 0; x < 256; x += 42) g.strokeRect(x + 4, 188, 34, 58);
  } else {
    g.strokeStyle = "#c4a573";
    g.lineWidth = 3;
    g.strokeRect(9, 9, 238, 238);
    g.strokeRect(17, 17, 222, 222);
    g.globalAlpha = 0.65;
    for (let x = 42; x < 240; x += 43)
      for (let y = 42; y < 240; y += 43) {
        g.save();
        g.translate(x, y);
        g.strokeStyle = "#d9c395";
        g.fillStyle = "#d9c395";
        if (motif === "tiles") {
          g.fillRect(-13, -13, 26, 26);
        } else if (motif === "cross") {
          g.fillRect(-2, -13, 4, 26);
          g.fillRect(-10, -4, 20, 4);
        } else if (motif === "flower") {
          for (let n = 0; n < 5; n++) {
            g.rotate((Math.PI * 2) / 5);
            g.beginPath();
            g.ellipse(0, 7, 3, 7, 0, 0, 7);
            g.stroke();
          }
        } else if (motif === "clock") {
          g.beginPath();
          g.arc(0, 0, 12, 0, 7);
          g.stroke();
          g.beginPath();
          g.moveTo(-6, 0);
          g.lineTo(0, 0);
          g.lineTo(0, -8);
          g.stroke();
        } else if (motif === "books") {
          g.strokeRect(-10, -12, 20, 24);
          g.fillRect(-2, -12, 2, 24);
        } else {
          g.rotate(Math.PI / 4);
          g.strokeRect(-9, -9, 18, 18);
        }
        g.restore();
      }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 2;
  return t;
}
export function buildMansion(scene) {
  const group = new THREE.Group();
  scene.add(group);
  const box = new THREE.BoxGeometry(1, 1, 1),
    batches = new Map();
  const mat = (color, map) =>
    new THREE.MeshStandardMaterial({
      color,
      map,
      roughness: 0.94,
      flatShading: true,
    });
  const wood = mat(0x9e8062, surface("wood")),
    dark = mat(0x302923),
    brass = mat(0x9b7950),
    black = mat(0x101514),
    fabric = mat(0x4b4940),
    plaster = mat(0x665e51),
    wall = mat(0xb0a58b, surface("wall", "#51473d"));
  function cube(x, y, z, w, h, d, m = wood) {
    if (!batches.has(m)) batches.set(m, []);
    batches.get(m).push([x, y, z, w, h, d]);
  }
  const floorTexture = surface("wood", "#6f5741");
  floorTexture.repeat.set(12, 12);
  cube(0, -0.14, 0, 42, 0.28, 42, mat(0xb9ab92, floorTexture));
  cube(0, 3.9, 0, 42, 0.2, 42, dark);
  for (const p of mansionProps) {
    const { x, z, w, d, h, kind } = p;
    if (kind === "wall") {
      cube(x, h / 2, z, w * 2, h, d * 2, wall);
      cube(x, 0.12, z, w * 2 + 0.06, 0.22, d * 2 + 0.06, dark);
      cube(x, 1.02, z, w * 2 + 0.04, 0.09, d * 2 + 0.04, brass);
      cube(x, 3.55, z, w * 2 + 0.12, 0.2, d * 2 + 0.12, dark);
    } else if (
      ["desk", "table", "counter", "bed", "pew", "altar", "dresser"].includes(
        kind,
      )
    ) {
      cube(x, h - 0.1, z, w * 2, 0.2, d * 2, wood);
      if (kind === "bed") {
        cube(x, h + 0.1, z, w * 1.9, 0.2, d * 1.9, fabric);
        cube(x, h + 0.25, z - d + 0.5, w * 1.7, 0.15, 0.6, plaster);
        cube(x, h, z + d - 0.1, w * 2, 1.3, 0.15, dark);
      } else if (kind === "pew")
        cube(x, h - 0.25, z + d - 0.1, w * 2, 0.6, 0.15, wood);
      else if (["counter", "dresser", "altar"].includes(kind))
        cube(x, h / 2, z, w * 1.95, h - 0.2, d * 1.95, dark);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          cube(
            x + sx * (w - 0.14),
            h / 2,
            z + sz * (d - 0.14),
            0.16,
            h,
            0.16,
            dark,
          );
    } else if (kind === "chair") {
      cube(x, 0.5, z, w * 2, 0.15, d * 2, wood);
      cube(x, 0.94, z + d - 0.06, w * 2, 0.65, 0.12, wood);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          cube(x + sx * 0.3, 0.26, z + sz * 0.3, 0.1, 0.52, 0.1, dark);
    } else if (kind === "screen") {
      cube(x, h / 2, z, w * 2, h, d * 2, dark);
      cube(x, h / 2, z, w * 2 + 0.02, h - 0.2, d * 2 - 0.2, fabric);
      for (const zz of [-d, d])
        cube(x, h / 2, z + zz, 0.6, h + 0.1, 0.1, brass);
    } else if (kind === "bookcase") {
      cube(x, h / 2, z, w * 2, h, d * 2, dark);
      for (let row = 0; row < 4; row++) {
        cube(x, 0.3 + row * 0.65, z - 0.1, w * 2, 0.09, d * 2, wood);
        for (let j = 0; j < 7; j++)
          cube(
            x - w + 0.15 + j * 0.25,
            0.58 + row * 0.65,
            z - d - 0.03,
            0.16,
            0.4 + (j % 3) * 0.04,
            0.15,
            [brass, fabric, wood][j % 3],
          );
      }
    } else {
      cube(x, h / 2, z, w * 2, h, d * 2, dark);
      for (const side of [-1, 1]) {
        cube(
          x + side * w * 0.49,
          h / 2,
          z - d - 0.025,
          w * 0.92,
          h - 0.18,
          0.06,
          wood,
        );
        cube(x + side * 0.12, 1.15, z - d - 0.08, 0.045, 0.2, 0.05, brass);
      }
    }
  }
  // Door lintels, beams, and portraits make the hallway feel like an old house.
  for (const x of [-3, 3])
    for (const z of [-13.5, 0, 13.5]) {
      cube(x, 3.2, z, 0.62, 0.45, 3.2, dark);
      for (const dz of [-1.45, 1.45])
        cube(x, 1.6, z + dz, 0.58, 3.2, 0.12, wood);
    }
  for (const z of [-18, -9, 0, 9, 18]) cube(0, 3.65, z, 6, 0.25, 0.28, wood);
  const carpetMat = mat(0xffffff, surface("rug", "#502c29", "diamond"));
  carpetMat.map.repeat.set(1, 10);
  cube(0, 0.012, 0, 2.6, 0.018, 39, carpetMat);
  for (const [i, r] of mansionRooms.entries()) {
    const col = "#" + r.color.toString(16).padStart(6, "0");
    const rug = mat(0xffffff, surface("rug", col, r.motif));
    cube(r.x, 0.018, r.z, 8, 0.025, 8, rug);
    // A coloured wall panel keeps even wall-facing reveals readable.
    const wallpaper = mat(0xffffff, surface("wall", col));
    cube(Math.sign(r.x) * 20.66, 2.05, r.z, 0.025, 2.5, 10, wallpaper);
    // Looking straight up still reveals this room's patterned ceiling.
    cube(
      r.x,
      3.77,
      r.z,
      17.5,
      0.035,
      12.5,
      mat(0x8f8a7d, surface("rug", col, r.motif)),
    );
    const frameX = Math.sign(r.x) * 20.59;
    cube(frameX, 2.2, r.z, 0.13, 1.65, 1.25, brass);
    cube(frameX - Math.sign(r.x) * 0.08, 2.2, r.z, 0.03, 1.46, 1.06, black);
    const silhouette = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.24, 0),
      mat(0x6f6651),
    );
    silhouette.position.set(frameX - Math.sign(r.x) * 0.12, 2.4, r.z);
    silhouette.scale.set(0.3, 1, 1);
    group.add(silhouette);
    cube(frameX - Math.sign(r.x) * 0.12, 1.96, r.z, 0.05, 0.52, 0.55, dark);
    // Clock faces have distinct times, giving a second clue beyond room colour.
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#c2b089";
    g.beginPath();
    g.arc(64, 64, 60, 0, 7);
    g.fill();
    g.strokeStyle = "#292820";
    g.lineWidth = 3;
    for (let k = 0; k < 12; k++) {
      let a = (k * Math.PI) / 6;
      g.beginPath();
      g.moveTo(64 + 46 * Math.sin(a), 64 + 46 * Math.cos(a));
      g.lineTo(64 + 53 * Math.sin(a), 64 + 53 * Math.cos(a));
      g.stroke();
    }
    g.beginPath();
    g.moveTo(64, 22);
    g.lineTo(64, 64);
    g.lineTo(64 + 28 * Math.sin(i + 1), 64 + 28 * Math.cos(i + 1));
    g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const clock = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.75),
      mat(0xffffff, t),
    );
    clock.position.set(r.x, 2.65, r.z - 5.95);
    group.add(clock);
    cube(r.x, 2.65, r.z - 6, 0.86, 0.86, 0.08, dark);
    // Frosted windows are dim, so distant rooms still fall into darkness.
    cube(r.x + 3, 2.25, r.z - 6.13, 1.9, 2, 0.1, dark);
    const glass = mat(0x3b4d50);
    glass.emissive.setHex(0x121b21);
    glass.emissiveIntensity = 0.25;
    cube(r.x + 3, 2.25, r.z - 6.05, 1.7, 1.8, 0.04, glass);
    cube(r.x + 3, 2.25, r.z - 6, 0.07, 1.8, 0.05, wood);
    cube(r.x + 3, 2.25, r.z - 6, 1.7, 0.07, 0.05, wood);
  }
  for (const [m, items] of batches) {
    const mesh = new THREE.InstancedMesh(box, m, items.length),
      dummy = new THREE.Object3D();
    items.forEach(([x, y, z, w, h, d], i) => {
      dummy.position.set(x, y, z);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

export function createFigure(scene, index) {
  const group = new THREE.Group();
  scene.add(group);
  const coat = new THREE.MeshStandardMaterial({
    color: index ? 0x5b4f3c : 0x465351,
    roughness: 1,
    flatShading: true,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0xaca18a,
    roughness: 1,
    flatShading: true,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x242421,
    roughness: 1,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: 0x707478,
    metalness: 0.6,
    roughness: 0.4,
  });
  const mesh = (geometry, material, x, y, z) => {
    const o = new THREE.Mesh(geometry, material);
    o.position.set(x, y, z);
    group.add(o);
    return o;
  };
  mesh(new THREE.CylinderGeometry(0.28, 0.37, 0.65, 5), coat, 0, 1.12, 0);
  mesh(new THREE.BoxGeometry(0.48, 0.23, 0.3), dark, 0, 0.72, 0);
  mesh(new THREE.IcosahedronGeometry(0.25, 0), skin, 0, 1.62, 0);
  mesh(new THREE.BoxGeometry(0.31, 0.08, 0.06), dark, 0, 1.66, -0.2);
  const legs = [-1, 1].map((s) =>
    mesh(new THREE.BoxGeometry(0.19, 0.65, 0.22), dark, s * 0.16, 0.36, 0),
  );
  const arms = [-1, 1].map((s) =>
    mesh(new THREE.BoxGeometry(0.17, 0.58, 0.2), coat, s * 0.36, 1.13, 0),
  );
  const gun = new THREE.Group();
  scene.add(gun);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.42), metal);
  gun.add(barrel);
  const cylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.16, 6),
    metal,
  );
  cylinder.rotation.x = Math.PI / 2;
  cylinder.position.z = 0.1;
  gun.add(cylinder);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.12), dark);
  grip.position.set(0, -0.11, 0.16);
  grip.rotation.x = -0.25;
  gun.add(grip);
  return { group, legs, arms, gun, lastX: 0, lastZ: 0, stride: 0 };
}
