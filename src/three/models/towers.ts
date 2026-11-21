import * as THREE from 'three';
import type { TowerType } from '../../game/types';
import { assetManager } from '../assets/AssetManager';
import { adaptTowerGLB } from '../assets/rigAdapters';
import type { SharedMaterials } from '../materials';

export interface TowerRig {
  root: THREE.Group;
  turretHead: THREE.Group;
  recoilGroup: THREE.Group;
  muzzleLocal: THREE.Vector3;
  baseNode?: THREE.Object3D;
  turretNode?: THREE.Object3D;
  muzzleNode?: THREE.Object3D;
  isExternalGLB?: boolean;
  mappedNodes?: { base: boolean; turret: boolean; muzzle: boolean };
  rotaryBarrels?: THREE.Object3D[];
  crystal?: THREE.Object3D;
  electricRings?: THREE.Object3D[];
  boltTips?: THREE.Vector3[];
  rangeRing?: THREE.Mesh;
  mixer?: THREE.AnimationMixer;
  onFire?: () => void;
}

function enableShadows(obj: THREE.Object3D): void {
  obj.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });
}

function createOctagonShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createBeveledOctagon(radius: number, depth: number, bevel = 0.06): THREE.ExtrudeGeometry {
  const geo = new THREE.ExtrudeGeometry(createOctagonShape(radius), {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  return geo;
}

function createShieldCrest(mats: SharedMaterials): THREE.Group {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-0.18, 0.22);
  s.lineTo(0.18, 0.22);
  s.lineTo(0.18, -0.02);
  s.quadraticCurveTo(0.14, -0.18, 0, -0.26);
  s.quadraticCurveTo(-0.14, -0.18, -0.18, -0.02);
  s.closePath();

  const crest = new THREE.Mesh(
    new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }),
    mats.flagBlue,
  );
  g.add(crest);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.018, 6, 16), mats.goldTrim);
  rim.position.set(0, 0.02, 0.045);
  g.add(rim);

  const bolt = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), mats.goldTrim);
  bolt.position.set(0, 0.02, 0.05);
  bolt.scale.set(0.7, 1.3, 0.5);
  g.add(bolt);
  return g;
}

function buildGunTurret(level: 1 | 2 | 3, mats: SharedMaterials): TowerRig {
  const root = new THREE.Group();

  // Contact shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  // Stepped concrete & stone octagonal bunker base
  const baseLower = new THREE.Mesh(createBeveledOctagon(0.98, 0.24, 0.07), mats.stoneDark);
  baseLower.position.y = 0.05;
  root.add(baseLower);

  const baseMid = new THREE.Mesh(createBeveledOctagon(0.8, 0.28, 0.06), mats.stone);
  baseMid.position.y = 0.3;
  root.add(baseMid);

  // Amber-gold armor skirt plates around the bunker
  const skirtCount = 4;
  for (let i = 0; i < skirtCount; i++) {
    const angle = (i / skirtCount) * Math.PI * 2 + Math.PI / 4;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.14), mats.goldTrim);
    plate.position.set(Math.sin(angle) * 0.78, 0.28, Math.cos(angle) * 0.78);
    plate.rotation.y = angle;
    root.add(plate);
  }

  // Turret ring bearing
  const bearing = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.64, 0.14, 16), mats.gunmetal);
  bearing.position.y = 0.66;
  root.add(bearing);

  // Rotating turret head
  const turretHead = new THREE.Group();
  turretHead.position.y = 0.94;
  root.add(turretHead);

  const recoilGroup = new THREE.Group();
  turretHead.add(recoilGroup);

  // Main beveled turret housing
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-0.46, -0.52);
  bodyShape.lineTo(0.46, -0.52);
  bodyShape.lineTo(0.52, 0.15);
  bodyShape.lineTo(0.38, 0.45);
  bodyShape.lineTo(-0.38, 0.45);
  bodyShape.lineTo(-0.52, 0.15);
  bodyShape.closePath();

  const housingGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.44,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  housingGeo.rotateX(Math.PI / 2);
  const housing = new THREE.Mesh(housingGeo, mats.gunmetal);
  housing.position.y = 0.24;
  recoilGroup.add(housing);

  // Top amber armor canopy & optic sensor
  const topCap = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.68), level >= 2 ? mats.goldTrim : mats.steel);
  topCap.position.set(0, 0.28, -0.05);
  recoilGroup.add(topCap);

  const optic = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.18), mats.warmGlow);
  optic.position.set(0, 0.34, 0.24);
  recoilGroup.add(optic);

  // Side ammo hoppers
  [-0.56, 0.56].forEach((x) => {
    const hopper = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.46), level === 3 ? mats.goldTrim : mats.copper);
    hopper.position.set(x, 0.02, -0.08);
    recoilGroup.add(hopper);
  });

  // Barrels (scale by level: L1 dual, L2 shrouded heavy twin, L3 quad gatling)
  const rotaryBarrels: THREE.Object3D[] = [];
  const offsets = level === 3 ? [-0.26, -0.1, 0.1, 0.26] : [-0.18, 0.18];
  const barrelLen = level === 1 ? 0.88 : level === 2 ? 1.02 : 1.12;
  const barrelRad = level === 3 ? 0.065 : 0.082;

  offsets.forEach((bx) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, 0.04, 0.42);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelRad, barrelRad * 1.12, barrelLen, 10), mats.steel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = barrelLen * 0.5;
    bGroup.add(barrel);

    // Muzzle brake collar
    const brake = new THREE.Mesh(
      new THREE.CylinderGeometry(barrelRad * 1.38, barrelRad * 1.38, 0.14, 10),
      level >= 2 ? mats.goldTrim : mats.gunmetal,
    );
    brake.rotation.x = Math.PI / 2;
    brake.position.z = barrelLen - 0.04;
    bGroup.add(brake);

    if (level >= 2) {
      const jacket = new THREE.Mesh(new THREE.CylinderGeometry(barrelRad * 1.3, barrelRad * 1.3, barrelLen * 0.45, 8), mats.gunmetal);
      jacket.rotation.x = Math.PI / 2;
      jacket.position.z = barrelLen * 0.24;
      bGroup.add(jacket);
    }

    recoilGroup.add(bGroup);
    rotaryBarrels.push(bGroup);
  });

  if (level >= 2) {
    // Rear twin exhaust stacks / vents
    [-0.22, 0.22].forEach((x) => {
      const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.26, 8), mats.steel);
      vent.position.set(x, 0.26, -0.48);
      vent.rotation.x = -0.3;
      recoilGroup.add(vent);
    });
  }

  enableShadows(root);
  return {
    root,
    turretHead,
    recoilGroup,
    muzzleLocal: new THREE.Vector3(0, 0.98, 1.45),
    rotaryBarrels,
  };
}

function buildCannonTower(level: 1 | 2 | 3, mats: SharedMaterials): TowerRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  // Carved stone masonry foundation pad
  const stonePad = new THREE.Mesh(createBeveledOctagon(1.04, 0.22, 0.07), mats.stone);
  stonePad.position.y = 0.05;
  root.add(stonePad);

  // Decorative stacked cannonballs on corner of pad
  const ballGeo = new THREE.SphereGeometry(0.1, 10, 10);
  const stackPositions = [
    [-0.65, 0.36, 0.55],
    [-0.48, 0.36, 0.62],
    [-0.58, 0.36, 0.72],
    [-0.57, 0.49, 0.63],
  ];
  stackPositions.forEach(([x, y, z]) => {
    const ball = new THREE.Mesh(ballGeo, mats.gunmetal);
    ball.position.set(x, y, z);
    root.add(ball);
  });

  // Rotating turret carriage
  const turretHead = new THREE.Group();
  turretHead.position.y = 0.32;
  root.add(turretHead);

  // Oak timber carriage base & side cheeks
  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.16, 1.24), mats.wood);
  deck.position.y = 0.08;
  turretHead.add(deck);

  [-0.44, 0.44].forEach((x) => {
    const cheekShape = new THREE.Shape();
    cheekShape.moveTo(-0.56, 0);
    cheekShape.lineTo(0.46, 0);
    cheekShape.lineTo(0.46, 0.46);
    cheekShape.lineTo(0.18, 0.58);
    cheekShape.lineTo(-0.56, 0.22);
    cheekShape.closePath();
    const cheekGeo = new THREE.ExtrudeGeometry(cheekShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    cheekGeo.rotateY(Math.PI / 2);
    const cheek = new THREE.Mesh(cheekGeo, mats.woodDark);
    cheek.position.set(x - 0.07, 0.14, 0);
    turretHead.add(cheek);

    // Iron bracket strap & wheels
    const strap = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.38, 0.12),
      level >= 2 ? mats.goldTrim : mats.gunmetal,
    );
    strap.position.set(x, 0.36, 0.16);
    turretHead.add(strap);

    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 14), mats.gunmetal);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x * 1.28, 0.14, 0.28);
    turretHead.add(wheel);
  });

  // Recoil group holds the massive LatheGeometry siege cannon barrel
  const recoilGroup = new THREE.Group();
  recoilGroup.position.set(0, 0.62, 0.02);
  recoilGroup.rotation.x = -0.26; // Elevated mortar/siege angle!
  turretHead.add(recoilGroup);

  const scale = level === 1 ? 1.0 : level === 2 ? 1.1 : 1.22;
  const profile = [
    new THREE.Vector2(0.0, -0.62),
    new THREE.Vector2(0.13, -0.58), // Cascabel knob
    new THREE.Vector2(0.09, -0.5),
    new THREE.Vector2(0.32, -0.44), // Breech
    new THREE.Vector2(0.34, -0.22),
    new THREE.Vector2(0.28, 0.12),
    new THREE.Vector2(0.24, 0.56),
    new THREE.Vector2(0.3, 0.68), // Flared muzzle swell
    new THREE.Vector2(0.32, 0.74),
    new THREE.Vector2(0.22, 0.74),
    new THREE.Vector2(0.2, 0.52), // Hollow bore lip
  ];
  const barrelGeo = new THREE.LatheGeometry(profile, 20);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, mats.gunmetal);
  barrel.scale.setScalar(scale);
  recoilGroup.add(barrel);

  // Brass/gold reinforcement rings
  const ringMat = level === 1 ? mats.copper : mats.goldTrim;
  [-0.25, 0.15, 0.58].forEach((rz, idx) => {
    if (level === 1 && idx === 1) return;
    const rad = (idx === 0 ? 0.345 : idx === 1 ? 0.28 : 0.29) * scale;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.032, 8, 20), ringMat);
    ring.position.z = rz * scale;
    recoilGroup.add(ring);
  });

  if (level === 3) {
    // Gilded crest plate on top of barrel
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.42), mats.goldTrim);
    crest.position.set(0, 0.32, -0.05);
    recoilGroup.add(crest);
  }

  const bore=new THREE.Object3D();
  bore.position.z=.74*scale;
  recoilGroup.add(bore);
  enableShadows(root);
  return {
    root,turretHead,recoilGroup,muzzleNode:bore,
    muzzleLocal:new THREE.Vector3(0,1.15,.85),
  };
}

function buildSniperTower(level: 1 | 2 | 3, mats: SharedMaterials): TowerRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  // Stone foundation
  const base = new THREE.Mesh(createBeveledOctagon(0.95, 0.22, 0.06), mats.stoneDark);
  base.position.y = 0.05;
  root.add(base);

  // Tapered carved stone watchtower shaft
  const shaftHeight = level === 1 ? 1.55 : level === 2 ? 1.72 : 1.9;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, shaftHeight, 12), mats.stone);
  shaft.position.y = 0.25 + shaftHeight * 0.5;
  root.add(shaft);

  // Level 2+ stone corner buttresses
  if (level >= 2) {
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const buttress = new THREE.Mesh(new THREE.BoxGeometry(0.22, shaftHeight * 0.78, 0.26), mats.stoneDark);
      buttress.position.set(Math.sin(a) * 0.7, 0.25 + shaftHeight * 0.38, Math.cos(a) * 0.7);
      buttress.rotation.y = a;
      root.add(buttress);
    }
  }

  // Blue & gold shield crest on front wall
  const crest = createShieldCrest(mats);
  crest.position.set(0, 0.95, 0.72);
  root.add(crest);

  // Parapet platform & crenellated battlements
  const topY = 0.25 + shaftHeight;
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.66, 0.22, 12), mats.stoneDark);
  deck.position.y = topY + 0.08;
  root.add(deck);

  const merlonCount = 8;
  for (let i = 0; i < merlonCount; i++) {
    const a = (i / merlonCount) * Math.PI * 2;
    const merlon = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.26, 0.16),
      level === 3 ? mats.steel : mats.stone,
    );
    merlon.position.set(Math.sin(a) * 0.68, topY + 0.28, Math.cos(a) * 0.68);
    merlon.rotation.y = a;
    root.add(merlon);
  }

  if (level >= 2) {
    const trimRing = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.03, 8, 24), mats.goldTrim);
    trimRing.rotation.x = Math.PI / 2;
    trimRing.position.y = topY + 0.04;
    root.add(trimRing);
  }

  // Rotating Sniper Marksman atop the tower!
  const turretHead = new THREE.Group();
  turretHead.position.y = topY + 0.2;
  root.add(turretHead);

  // Marksman torso & tactical cloak
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.42, 10), mats.gunmetal);
  torso.position.y = 0.24;
  turretHead.add(torso);

  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.42, 8, 1, true, Math.PI * 0.6, Math.PI * 0.8), mats.flagBlue);
  cloak.position.set(0, 0.26, -0.08);
  turretHead.add(cloak);

  // Helmet & glowing red tactical goggles
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mats.gunmetal);
  head.position.y = 0.56;
  turretHead.add(head);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.12), mats.redGlow);
  visor.position.set(0, 0.57, 0.13);
  turretHead.add(visor);

  // Long Precision Sniper Rifle
  const recoilGroup = new THREE.Group();
  recoilGroup.position.set(0.08, 0.4, 0.18);
  turretHead.add(recoilGroup);

  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.55), mats.woodDark);
  stock.position.z = 0.15;
  recoilGroup.add(stock);

  const rifleLen = level === 1 ? 1.15 : level === 2 ? 1.32 : 1.48;
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.042, rifleLen, 8), mats.steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.03, 0.45 + rifleLen * 0.5 - 0.35);
  recoilGroup.add(barrel);

  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.34, 8), mats.goldTrim);
  scope.rotation.x = Math.PI / 2;
  scope.position.set(0, 0.12, 0.28);
  recoilGroup.add(scope);

  if (level === 3) {
    const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.32, 10), mats.gunmetal);
    suppressor.rotation.x = Math.PI / 2;
    suppressor.position.set(0, 0.03, rifleLen + 0.02);
    recoilGroup.add(suppressor);
  }

  enableShadows(root);
  return {
    root,
    turretHead,
    recoilGroup,
    muzzleLocal: new THREE.Vector3(0.08, topY + 0.62, 1.4),
  };
}

function buildLightningTower(level: 1 | 2 | 3, mats: SharedMaterials): TowerRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  // Stone base with glowing cyan arcane trim seam
  const base = new THREE.Mesh(createBeveledOctagon(0.92, 0.24, 0.06), mats.stone);
  base.position.y = 0.05;
  root.add(base);

  const runicSeam = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.035, 8, 24), mats.cyanCrystal);
  runicSeam.rotation.x = Math.PI / 2;
  runicSeam.position.y = 0.3;
  root.add(runicSeam);

  // Blue-and-gold lightning emblem on front
  const crest = createShieldCrest(mats);
  crest.position.set(0, 0.62, 0.68);
  root.add(crest);

  // 4 Timber/stone angled spire pillars
  const spireH = level === 1 ? 1.35 : level === 2 ? 1.55 : 1.75;
  const pillarMat = level >= 2 ? mats.stoneDark : mats.wood;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, spireH, 8), pillarMat);
    pillar.position.set(Math.sin(a) * 0.44, 0.28 + spireH * 0.5, Math.cos(a) * 0.44);
    pillar.rotation.z = Math.sin(a) * 0.11;
    pillar.rotation.x = -Math.cos(a) * 0.11;
    root.add(pillar);
  }

  // Central glowing cyan crystal core inside tower
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mats.cyanCrystal);
  core.position.y = 0.28 + spireH * 0.52;
  core.scale.set(0.85, 1.45, 0.85);
  root.add(core);

  const turretHead = new THREE.Group();
  turretHead.position.y = 0.28 + spireH;
  root.add(turretHead);

  const recoilGroup = new THREE.Group();
  turretHead.add(recoilGroup);

  // Copper/gold crown platform
  const crown = new THREE.Mesh(
    createBeveledOctagon(0.58, 0.14, 0.04),
    level >= 2 ? mats.goldTrim : mats.copper,
  );
  crown.position.y = -0.05;
  recoilGroup.add(crown);

  const electricRings: THREE.Object3D[] = [];
  const boltTips: THREE.Vector3[] = [];

  if (level === 1) {
    // Level 1 matches Image 2: warm shingled red pagoda roof with side lightning emitter prongs
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.72, 4), mats.roofTile);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 0.44;
    recoilGroup.add(roof);

    const finial = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mats.cyanCrystal);
    finial.position.y = 0.88;
    finial.scale.set(0.8, 1.5, 0.8);
    recoilGroup.add(finial);

    [-0.65, 0.65].forEach((x) => {
      const prong = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.34, 6), mats.cyanCrystal);
      prong.position.set(x, 0.12, 0);
      prong.rotation.z = x > 0 ? -Math.PI / 2.3 : Math.PI / 2.3;
      recoilGroup.add(prong);
      boltTips.push(new THREE.Vector3(x * 1.15, 0.28 + spireH + 0.12, 0));
    });
  } else {
    // Level 2 & 3: Radiant floating blue crystal prism + copper/gold tesla prongs & rotating electric rings!
    const prongCount = level === 2 ? 3 : 4;
    for (let i = 0; i < prongCount; i++) {
      const a = (i / prongCount) * Math.PI * 2;
      const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.56, 6), mats.goldTrim);
      prong.position.set(Math.sin(a) * 0.42, 0.28, Math.cos(a) * 0.42);
      prong.rotation.z = -Math.sin(a) * 0.32;
      prong.rotation.x = Math.cos(a) * 0.32;
      recoilGroup.add(prong);

      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), mats.cyanCrystal);
      orb.position.set(Math.sin(a) * 0.52, 0.54, Math.cos(a) * 0.52);
      recoilGroup.add(orb);
      boltTips.push(new THREE.Vector3(Math.sin(a) * 0.52, 0.28 + spireH + 0.54, Math.cos(a) * 0.52));
    }

    const topCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(level === 3 ? 0.34 : 0.26, 0),
      mats.cyanCrystal,
    );
    topCrystal.position.y = 0.58;
    topCrystal.scale.set(0.8, 1.55, 0.8);
    recoilGroup.add(topCrystal);

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.024, 6, 20), mats.cyanCrystal);
    ring1.position.y = 0.55;
    ring1.rotation.x = 0.45;
    recoilGroup.add(ring1);
    electricRings.push(ring1);

    if (level === 3) {
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.02, 6, 20), mats.cyanCrystal);
      ring2.position.y = 0.55;
      ring2.rotation.x = -0.5;
      ring2.rotation.z = 0.4;
      recoilGroup.add(ring2);
      electricRings.push(ring2);
    }
  }

  enableShadows(root);
  return {
    root,
    turretHead,
    recoilGroup,
    muzzleLocal: new THREE.Vector3(0, 0.28 + spireH + 0.58, 0),
    crystal: core,
    electricRings,
    boltTips,
  };
}

function finalizeProceduralTowerRig(rig: TowerRig): TowerRig {
  rig.root.updateMatrixWorld(true);
  rig.turretHead.name = 'Turret';
  const muzzleNode=rig.muzzleNode ?? new THREE.Object3D();
  muzzleNode.name='Muzzle';
  if(!rig.muzzleNode){
    muzzleNode.position.copy(rig.turretHead.worldToLocal(rig.muzzleLocal.clone()));
    rig.turretHead.add(muzzleNode);
  }

  rig.baseNode = rig.root;
  rig.turretNode = rig.turretHead;
  rig.muzzleNode = muzzleNode;
  rig.isExternalGLB = false;
  rig.mappedNodes = { base: true, turret: true, muzzle: true };
  return rig;
}

export function createTowerRig(type: TowerType, level: 1 | 2 | 3, mats: SharedMaterials): TowerRig {
  const glbAsset = assetManager.cloneTowerAsset(type, level);
  if (glbAsset) {
    const rig=adaptTowerGLB(glbAsset,type,level,mats);
    if(type==='lightning' && rig.muzzleNode){
      // Use the model's normalized rotating pivot so the masonry stays planted.
      const cradle=new THREE.Group();
      cradle.position.copy(rig.turretHead.worldToLocal(rig.muzzleNode.getWorldPosition(new THREE.Vector3())));
      rig.turretHead.add(cradle);
      const stock=new THREE.Mesh(new THREE.CylinderGeometry(.048,.075,.72,10),mats.woodDark);
      stock.rotation.x=Math.PI/2;cradle.add(stock);
      const bow=new THREE.CatmullRomCurve3([new THREE.Vector3(-.38,0,-.12),new THREE.Vector3(0,.04,.16),new THREE.Vector3(.38,0,-.12)]);
      cradle.add(new THREE.Mesh(new THREE.TubeGeometry(bow,12,.028,6,false),mats.copper));
      const tip=new THREE.Object3D();tip.position.z=.37;cradle.add(tip);rig.muzzleNode=tip;
    }
    return rig;
  }

  switch (type) {
    case 'gun':
      return finalizeProceduralTowerRig(buildGunTurret(level, mats));
    case 'cannon':
      return finalizeProceduralTowerRig(buildCannonTower(level, mats));
    case 'sniper':
      return finalizeProceduralTowerRig(buildSniperTower(level, mats));
    case 'lightning':
      return finalizeProceduralTowerRig(buildLightningTower(level, mats));
  }
}
