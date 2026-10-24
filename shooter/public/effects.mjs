import * as THREE from "./vendor/three.module.js";
// Fixed pool: shot sparks recycle slots and never create geometry during gameplay.
export class Effects {
  constructor(scene) {
    this.pool = Array.from({ length: 96 }, () => ({
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
      96,
    );
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.shake = 0;
  }
  shot(p, own) {
    if (!p) return;
    for (let n = 0; n < 6; n++) {
      let q = this.pool[this.next++ % 96];
      q.life = 0.13 + Math.random() * 0.2;
      q.x = p.x - Math.sin(p.yaw) * 0.7;
      q.y = p.y + 1.3;
      q.z = p.z - Math.cos(p.yaw) * 0.7;
      q.vx = (Math.random() - 0.5) * 3;
      q.vy = Math.random() * 2;
      q.vz = (Math.random() - 0.5) * 3;
    }
    if (own) this.shake = 0.035;
  }
  update(dt) {
    for (let n = 0; n < 96; n++) {
      let p = this.pool[n];
      p.life -= dt;
      if (p.life > 0) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.scale.setScalar(p.life > 0 ? 1 : 0);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(n, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
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
