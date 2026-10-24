import * as THREE from "./vendor/three.module.js";
import { gunPosition } from "/shared/game.mjs";
// Fixed pool: shot sparks recycle slots and never create geometry during gameplay.
export class Effects {
  constructor(scene) {
    this.pool = Array.from({ length: 48 }, () => ({
      life: 0,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    }));
    this.next = 0;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.07),
      new THREE.MeshBasicMaterial({ color: 0xffe5a0 }),
      48,
    );
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.shake = 0;
    this.grenades = [];
    this.orbs = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.15, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xe5ff9a }),
      8,
    );
    scene.add(this.orbs);
  }
  shot(p, own) {
    if (!p) return;
    const muzzle = gunPosition(p);
    for (let n = 0; n < 6; n++) {
      let q = this.pool[this.next++ % this.pool.length];
      q.life = 0.13 + Math.random() * 0.2;
      q.x = muzzle.x;
      q.y = muzzle.y;
      q.z = muzzle.z;
      q.vx = (Math.random() - 0.5) * 3;
      q.vy = Math.random() * 2;
      q.vz = (Math.random() - 0.5) * 3;
    }
    if (own) this.shake = 0.035;
  }
  grenade(g) {
    if (this.grenades.length >= 8) this.grenades.shift();
    this.grenades.push({ ...g, life: 2 });
  }
  blast(g) {
    this.grenades = this.grenades.filter(
      (p) => Math.hypot(p.x - g.x, p.z - g.z) > 2,
    );
    for (let n = 0; n < 24; n++) {
      const p = this.pool[this.next++ % this.pool.length];
      const a = (n * Math.PI * 2) / 24;
      p.life = 0.3 + Math.random() * 0.25;
      p.x = g.x;
      p.y = g.y + 0.2;
      p.z = g.z;
      p.vx = Math.cos(a) * 8;
      p.vy = Math.random() * 5;
      p.vz = Math.sin(a) * 8;
    }
    this.shake = 0.08;
  }
  update(dt) {
    for (let n = this.grenades.length - 1; n >= 0; n--) {
      let g = this.grenades[n];
      g.life -= dt;
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.z += g.vz * dt;
      g.vy -= 18 * dt;
      if (g.life <= 0 || g.y <= 0) this.grenades.splice(n, 1);
    }
    this.orbs.count = this.grenades.length;
    this.grenades.forEach((g, n) => {
      this.dummy.position.set(g.x, g.y, g.z);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.orbs.setMatrixAt(n, this.dummy.matrix);
    });
    this.orbs.instanceMatrix.needsUpdate = true;
    let visible = 0;
    for (let n = 0; n < this.pool.length; n++) {
      let p = this.pool[n];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(visible++, this.dummy.matrix);
    }
    this.mesh.count = visible;
    if (visible) this.mesh.instanceMatrix.needsUpdate = true;
    this.shake = Math.max(0, this.shake - dt * 0.15);
  }
}
export function texture(theme) {
  let c = document.createElement("canvas");
  c.width = c.height = 128;
  let x = c.getContext("2d");
  let base = ["#173039", "#b89970", "#48555b", "#342d51"][theme];
  x.fillStyle = base;
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = ["#4d7373", "#c9b38e", "#79848a", "#725c90"][theme];
  x.lineWidth = theme === 3 ? 4 : 1;
  for (let i = 0; i < 128; i += theme === 3 ? 16 : 32) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i, 128);
    x.moveTo(0, i);
    x.lineTo(128, i);
    x.stroke();
  }
  if (theme === 1) {
    x.fillStyle = "#a88a64";
    for (let i = 0; i < 140; i++)
      x.fillRect((i * 37) % 128, (i * 71) % 128, 2, 2);
  }
  let t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 8);
  if (theme === 3) t.magFilter = THREE.NearestFilter;
  return t;
}
