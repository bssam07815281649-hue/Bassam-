import * as THREE from 'three';

interface Projectile {
  kind: 'bullet' | 'cannonball';
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  end: THREE.Vector3;
  progress: number;
  duration: number;
  arcHeight: number;
  onImpact: () => void;
}

interface BurstEffect {
  mesh: THREE.Mesh;
  age: number;
  lifetime: number;
  startScale: number;
  endScale: number;
  velocity?: THREE.Vector3;
}

interface BeamEffect {
  line: THREE.Line;
  age: number;
  lifetime: number;
}

export class CombatEffects {
  private group = new THREE.Group();
  private projectiles: Projectile[] = [];
  private bursts: BurstEffect[] = [];
  private beams: BeamEffect[] = [];

  private bulletGeo = new THREE.CapsuleGeometry(0.045, 0.26, 4, 6);
  private cannonGeo = new THREE.SphereGeometry(0.18, 10, 8);
  private sphereGeo = new THREE.SphereGeometry(1, 10, 8);

  private bulletMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  private cannonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });

  constructor(scene: THREE.Scene) {
    this.bulletGeo.rotateX(Math.PI / 2);
    scene.add(this.group);
  }

  public spawnBullet(start: THREE.Vector3, end: THREE.Vector3, speed: number, onImpact: () => void): void {
    const mesh = new THREE.Mesh(this.bulletGeo, this.bulletMat);
    mesh.position.copy(start);
    mesh.lookAt(end);
    this.group.add(mesh);

    const dist = start.distanceTo(end);
    this.projectiles.push({
      kind: 'bullet',
      mesh,
      start: start.clone(),
      end: end.clone(),
      progress: 0,
      duration: Math.max(0.05, dist / speed),
      arcHeight: 0,
      onImpact,
    });
  }

  public spawnCannonball(start: THREE.Vector3, end: THREE.Vector3, speed: number, onImpact: () => void): void {
    const mesh = new THREE.Mesh(this.cannonGeo, this.cannonMat);
    mesh.position.copy(start);
    mesh.castShadow = true;
    this.group.add(mesh);

    const dist = start.distanceTo(end);
    this.projectiles.push({
      kind: 'cannonball',
      mesh,
      start: start.clone(),
      end: end.clone(),
      progress: 0,
      duration: Math.max(0.18, dist / speed),
      arcHeight: Math.min(3.8, 1.2 + dist * 0.16),
      onImpact,
    });
  }

  public spawnMuzzleFlash(pos: THREE.Vector3, color = 0xffb703, scale = 0.35): void {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.sphereGeo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(scale * 0.6);
    this.group.add(mesh);
    this.bursts.push({
      mesh,
      age: 0,
      lifetime: 0.11,
      startScale: scale * 0.6,
      endScale: scale * 1.45,
    });
  }

  public spawnExplosion(pos: THREE.Vector3, radius: number): void {
    // Inner fiery core
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xff6b1a,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const fire = new THREE.Mesh(this.sphereGeo, fireMat);
    fire.position.copy(pos);
    this.group.add(fire);
    this.bursts.push({
      mesh: fire,
      age: 0,
      lifetime: 0.32,
      startScale: 0.35,
      endScale: radius * 0.72,
    });

    // Outer dust / shockwave cloud
    const dustMat = new THREE.MeshBasicMaterial({
      color: 0xd6bfa3,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const dust = new THREE.Mesh(this.sphereGeo, dustMat);
    dust.position.set(pos.x, pos.y + 0.15, pos.z);
    this.group.add(dust);
    this.bursts.push({
      mesh: dust,
      age: 0,
      lifetime: 0.45,
      startScale: 0.45,
      endScale: radius * 0.92,
    });
  }

  public spawnSniperBeam(start: THREE.Vector3, end: THREE.Vector3): void {
    const pts = [start.clone(), end.clone()];
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0xff3b30,
      transparent: true,
      opacity: 0.95,
    });
    const line = new THREE.Line(geo, mat);
    this.group.add(line);
    this.beams.push({ line, age: 0, lifetime: 0.18 });
    this.spawnMuzzleFlash(start, 0xff453a, 0.28);
    this.spawnMuzzleFlash(end, 0xff6b4a, 0.32);
  }

  public spawnLightningArc(start: THREE.Vector3, end: THREE.Vector3): void {
    const segments = 6;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const p = new THREE.Vector3().lerpVectors(start, end, t);
      if (i > 0 && i < segments) {
        p.x += (Math.random() - 0.5) * 0.55;
        p.y += (Math.random() - 0.5) * 0.45;
        p.z += (Math.random() - 0.5) * 0.55;
      }
      pts.push(p);
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 1.0,
    });
    const line = new THREE.Line(geo, mat);
    this.group.add(line);
    this.beams.push({ line, age: 0, lifetime: 0.16 });
    this.spawnMuzzleFlash(end, 0x38bdf8, 0.35);
  }

  public spawnRicochetSparks(pos: THREE.Vector3): void {
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.sphereGeo, mat);
      mesh.position.copy(pos);
      this.group.add(mesh);
      this.bursts.push({
        mesh,
        age: 0,
        lifetime: 0.22,
        startScale: 0.08,
        endScale: 0.02,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 4.5,
          1.5 + Math.random() * 2.5,
          (Math.random() - 0.5) * 4.5,
        ),
      });
    }
  }

  public spawnShieldBreakBurst(pos: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.sphereGeo, mat);
    mesh.position.copy(pos);
    this.group.add(mesh);
    this.bursts.push({
      mesh,
      age: 0,
      lifetime: 0.36,
      startScale: 0.65,
      endScale: 1.85,
    });
  }

  public spawnDodgePuff(pos: THREE.Vector3): void {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.sphereGeo, mat);
    mesh.position.copy(pos);
    this.group.add(mesh);
    this.bursts.push({
      mesh,
      age: 0,
      lifetime: 0.25,
      startScale: 0.25,
      endScale: 0.75,
    });
  }

  public update(dt: number): void {
    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.progress += dt / p.duration;
      if (p.progress >= 1) {
        this.group.remove(p.mesh);
        this.projectiles.splice(i, 1);
        p.onImpact();
        continue;
      }
      p.mesh.position.lerpVectors(p.start, p.end, p.progress);
      if (p.arcHeight > 0) {
        p.mesh.position.y += Math.sin(p.progress * Math.PI) * p.arcHeight;
      }
    }

    // Update burst expansions
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      const t = b.age / b.lifetime;
      if (t >= 1) {
        this.group.remove(b.mesh);
        (b.mesh.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
        continue;
      }
      if (b.velocity) {
        b.mesh.position.addScaledVector(b.velocity, dt);
        b.velocity.y -= 9.5 * dt;
      }
      const s = THREE.MathUtils.lerp(b.startScale, b.endScale, t);
      b.mesh.scale.setScalar(s);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - t);
    }

    // Update sniper & lightning beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const bm = this.beams[i];
      bm.age += dt;
      const t = bm.age / bm.lifetime;
      if (t >= 1) {
        this.group.remove(bm.line);
        bm.line.geometry.dispose();
        (bm.line.material as THREE.Material).dispose();
        this.beams.splice(i, 1);
        continue;
      }
      (bm.line.material as THREE.LineBasicMaterial).opacity = 1 - t;
    }
  }

  public dispose(): void {
    // Release active effects without triggering their onImpact damage callbacks.
    for (const p of this.projectiles) this.group.remove(p.mesh);
    for (const b of this.bursts) {
      this.group.remove(b.mesh);
      (b.mesh.material as THREE.Material).dispose();
    }
    for (const beam of this.beams) {
      this.group.remove(beam.line);
      beam.line.geometry.dispose();
      (beam.line.material as THREE.Material).dispose();
    }
    this.projectiles.length = 0;
    this.bursts.length = 0;
    this.beams.length = 0;
    this.group.parent?.remove(this.group);
    this.bulletGeo.dispose();
    this.cannonGeo.dispose();
    this.sphereGeo.dispose();
    this.bulletMat.dispose();
    this.cannonMat.dispose();
  }
}
