import * as THREE from 'three';
import type { EnemyType } from '../../game/types';
import { assetManager } from '../assets/AssetManager';
import { adaptEnemyGLB } from '../assets/rigAdapters';
import type { SharedMaterials } from '../materials';

export interface EnemyRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  head?: THREE.Object3D;
  scarfSegments?: THREE.Object3D[];
  shieldBubble?: THREE.Mesh;
  shieldWire?: THREE.Mesh;
  rotors?: THREE.Object3D[];
  hitMaterials: THREE.MeshStandardMaterial[];
  mixer?: THREE.AnimationMixer;
  locomotionAction?: THREE.AnimationAction;
  deathAction?: THREE.AnimationAction;
  isExternalGLB?: boolean;
}

function enableShadows(obj: THREE.Object3D): void {
  obj.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = false;
    }
  });
}

function makeMat(color: number, roughness: number, metalness: number, emissive = 0x000000, emissiveIntensity = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    emissive,
    emissiveIntensity,
  });
}

function buildInfantry(mats: SharedMaterials): EnemyRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  const tunicMat = makeMat(0xc83e2b, 0.85, 0.05);
  const pantsMat = makeMat(0x3b4248, 0.88, 0.05);
  const skinMat = makeMat(0xe7b68d, 0.72, 0.02);
  const helmetMat = makeMat(0x5b646f, 0.35, 0.72);
  const packMat = makeMat(0x825e3c, 0.88, 0.04);

  // Legs + Boots
  const makeLeg = (x: number) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.42, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.22, 4, 8), pantsMat);
    thigh.position.y = -0.14;
    leg.add(thigh);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.22), mats.gunmetal);
    boot.position.set(0, -0.35, 0.03);
    leg.add(boot);
    return leg;
  };
  const leftLeg = makeLeg(-0.11);
  const rightLeg = makeLeg(0.11);
  bodyGroup.add(leftLeg, rightLeg);

  // Red Tunic Torso + Backpack
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.22, 6, 10), tunicMat);
  torso.position.y = 0.65;
  bodyGroup.add(torso);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.07, 10), mats.woodDark);
  belt.position.y = 0.5;
  bodyGroup.add(belt);

  const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.16), packMat);
  backpack.position.set(0, 0.68, -0.2);
  bodyGroup.add(backpack);

  // Head + Steel Helmet + Goggles
  const head = new THREE.Group();
  head.position.y = 0.96;
  bodyGroup.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), skinMat);
  head.add(skull);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), helmetMat);
  helmet.position.y = 0.03;
  head.add(helmet);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.178, 0.02, 6, 16), helmetMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.03;
  head.add(rim);

  const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.08), mats.gunmetal);
  goggles.position.set(0, 0.03, 0.14);
  head.add(goggles);

  // Arms + Rifle
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.23, 0.74, 0.05);
  const lMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), tunicMat);
  lMesh.rotation.x = -Math.PI / 3;
  lMesh.position.set(0.06, -0.06, 0.14);
  leftArm.add(lMesh);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.23, 0.74, 0.05);
  const rMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.2, 4, 8), tunicMat);
  rMesh.rotation.x = -Math.PI / 2.6;
  rMesh.position.set(-0.04, -0.06, 0.14);
  rightArm.add(rMesh);

  const rifleStock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.42), mats.woodDark);
  rifleStock.position.set(-0.08, -0.08, 0.28);
  rightArm.add(rifleStock);
  const rifleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.46, 8), mats.gunmetal);
  rifleBarrel.rotation.x = Math.PI / 2;
  rifleBarrel.position.set(-0.08, -0.05, 0.56);
  rightArm.add(rifleBarrel);
  bodyGroup.add(rightArm);

  enableShadows(root);
  return {
    root,
    bodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
    hitMaterials: [tunicMat, pantsMat, helmetMat],
  };
}

function buildFastScout(mats: SharedMaterials): EnemyRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  const suitMat = makeMat(0x2d343e, 0.75, 0.15);
  const scarfMat = makeMat(0xef3e2d, 0.72, 0.05, 0x3a0705, 0.15);
  const goggleMat = makeMat(0xff6b1a, 0.2, 0.3, 0xff4500, 1.5);

  const makeLeg = (x: number) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.4, 0);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.24, 4, 8), suitMat);
    limb.position.y = -0.15;
    leg.add(limb);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.22), mats.steel);
    boot.position.set(0, -0.34, 0.04);
    leg.add(boot);
    return leg;
  };
  const leftLeg = makeLeg(-0.1);
  const rightLeg = makeLeg(0.1);
  bodyGroup.add(leftLeg, rightLeg);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.22, 6, 10), suitMat);
  torso.position.y = 0.64;
  torso.rotation.x = 0.22; // Athletic forward sprint lean!
  bodyGroup.add(torso);

  const head = new THREE.Group();
  head.position.set(0, 0.94, 0.08);
  bodyGroup.add(head);

  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mats.gunmetal);
  head.add(helmet);

  const goggles = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.075, 0.1), goggleMat);
  goggles.position.set(0, 0.02, 0.13);
  head.add(goggles);

  // Trailing animated red scarf!
  const scarfCollar = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 6, 12), scarfMat);
  scarfCollar.rotation.x = Math.PI / 2;
  scarfCollar.position.set(0, 0.82, 0.02);
  bodyGroup.add(scarfCollar);

  const scarfSegments: THREE.Object3D[] = [];
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.15 - i * 0.025, 0.04, 0.24), scarfMat);
    seg.position.set(0, 0.81 - i * 0.03, -0.15 - i * 0.2);
    bodyGroup.add(seg);
    scarfSegments.push(seg);
  }

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.2, 0.72, 0.06);
  const lMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.18, 4, 8), suitMat);
  lMesh.position.y = -0.1;
  leftArm.add(lMesh);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.2, 0.72, 0.06);
  const rMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.18, 4, 8), suitMat);
  rMesh.rotation.x = -Math.PI / 3;
  rMesh.position.set(0, -0.05, 0.1);
  rightArm.add(rMesh);

  const smg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.34), mats.gunmetal);
  smg.position.set(-0.02, -0.06, 0.25);
  rightArm.add(smg);
  bodyGroup.add(rightArm);

  enableShadows(root);
  return {
    root,
    bodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
    scarfSegments,
    hitMaterials: [suitMat, scarfMat],
  };
}

function buildHeavyArmored(mats: SharedMaterials): EnemyRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.55), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  const plateMat = makeMat(0x464e59, 0.3, 0.85);
  const trimMat = makeMat(0x8893a2, 0.26, 0.9);
  const visorMat = makeMat(0xff3824, 0.2, 0.3, 0xff2200, 1.7);

  const makeLeg = (x: number) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.48, 0);
    const greave = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.42, 8), plateMat);
    greave.position.y = -0.22;
    leg.add(greave);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.3), trimMat);
    boot.position.set(0, -0.41, 0.04);
    leg.add(boot);
    return leg;
  };
  const leftLeg = makeLeg(-0.18);
  const rightLeg = makeLeg(0.18);
  bodyGroup.add(leftLeg, rightLeg);

  // Bulky armored chestplate
  const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.52, 10), plateMat);
  chest.position.y = 0.78;
  bodyGroup.add(chest);

  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, 0.28), trimMat);
  chestPlate.position.set(0, 0.82, 0.12);
  bodyGroup.add(chestPlate);

  // Massive Pauldrons
  [-0.38, 0.38].forEach((x) => {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), plateMat);
    pauldron.position.set(x, 0.98, 0);
    pauldron.scale.set(1.1, 0.85, 1.15);
    bodyGroup.add(pauldron);
  });

  // Domed juggernaut helmet with glowing red slit visor
  const head = new THREE.Group();
  head.position.y = 1.18;
  bodyGroup.add(head);

  const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 0.28, 10), plateMat);
  head.add(helm);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.185, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), plateMat);
  dome.position.y = 0.12;
  head.add(dome);
  const slit = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.055, 0.08), visorMat);
  slit.position.set(0, 0.04, 0.17);
  head.add(slit);

  // Left arm carries massive beveled tower shield!
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.4, 0.86, 0.08);
  const shieldShape = new THREE.Shape();
  shieldShape.moveTo(-0.28, 0.44);
  shieldShape.lineTo(0.28, 0.44);
  shieldShape.lineTo(0.32, -0.15);
  shieldShape.lineTo(0, -0.48);
  shieldShape.lineTo(-0.32, -0.15);
  shieldShape.closePath();
  const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  const shield = new THREE.Mesh(shieldGeo, plateMat);
  shield.position.set(-0.08, -0.05, 0.26);
  shield.rotation.y = 0.28;
  leftArm.add(shield);

  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), trimMat);
  boss.position.set(-0.04, -0.02, 0.36);
  leftArm.add(boss);
  bodyGroup.add(leftArm);

  // Right arm with heavy power gauntlet
  const rightArm = new THREE.Group();
  rightArm.position.set(0.4, 0.86, 0.04);
  const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.36, 0.18), trimMat);
  gauntlet.position.set(0, -0.18, 0.06);
  rightArm.add(gauntlet);
  bodyGroup.add(rightArm);

  enableShadows(root);
  return {
    root,
    bodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
    hitMaterials: [plateMat, trimMat],
  };
}

function buildShieldedVanguard(mats: SharedMaterials): EnemyRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 1.35), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  const armorMat = makeMat(0x284366, 0.42, 0.55);
  const darkSuit = makeMat(0x1f2733, 0.78, 0.18);
  const cyanVisor = makeMat(0x38bdf8, 0.15, 0.2, 0x0ea5e9, 1.6);

  const makeLeg = (x: number) => {
    const leg = new THREE.Group();
    leg.position.set(x, 0.44, 0);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.22, 4, 8), darkSuit);
    l.position.y = -0.16;
    leg.add(l);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.24), armorMat);
    b.position.set(0, -0.36, 0.03);
    leg.add(b);
    return leg;
  };
  const leftLeg = makeLeg(-0.13);
  const rightLeg = makeLeg(0.13);
  bodyGroup.add(leftLeg, rightLeg);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.24, 6, 10), armorMat);
  torso.position.y = 0.68;
  bodyGroup.add(torso);

  const coreBadge = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), cyanVisor);
  coreBadge.position.set(0, 0.72, 0.2);
  bodyGroup.add(coreBadge);

  const head = new THREE.Group();
  head.position.y = 1.02;
  bodyGroup.add(head);

  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), armorMat);
  head.add(helm);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.065, 0.1), cyanVisor);
  visor.position.set(0, 0.02, 0.14);
  head.add(visor);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.26, 0.78, 0.06);
  const lA = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.2, 4, 8), darkSuit);
  lA.rotation.x = -Math.PI / 3;
  lA.position.set(0.06, -0.06, 0.14);
  leftArm.add(lA);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.26, 0.78, 0.06);
  const rA = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.2, 4, 8), darkSuit);
  rA.rotation.x = -Math.PI / 2.6;
  rA.position.set(-0.04, -0.06, 0.14);
  rightArm.add(rA);
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.55), mats.gunmetal);
  rifle.position.set(-0.06, -0.08, 0.34);
  rightArm.add(rifle);
  bodyGroup.add(rightArm);

  enableShadows(root);

  // Translucent Hexagonal Energy Shield Bubble + Wireframe
  const shieldBubble = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.76, 1),
    new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.75,
      roughness: 0.15,
      metalness: 0.1,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    }),
  );
  shieldBubble.position.y = 0.72;
  root.add(shieldBubble);

  const shieldWire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.77, 1),
    new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  shieldWire.position.y = 0.72;
  root.add(shieldWire);

  return {
    root,
    bodyGroup,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    head,
    shieldBubble,
    shieldWire,
    hitMaterials: [armorMat, darkSuit],
  };
}

function buildAerialDrone(mats: SharedMaterials): EnemyRig {
  const root = new THREE.Group();

  // Ground contact shadow beneath hovering drone
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  root.add(shadow);

  // Hovering chassis at y = 2.35
  const bodyGroup = new THREE.Group();
  bodyGroup.position.y = 2.35;
  root.add(bodyGroup);

  const hullMat = makeMat(0x2e3540, 0.35, 0.8);
  const accentMat = makeMat(0xf97316, 0.4, 0.3);
  const thrusterMat = makeMat(0x38bdf8, 0.2, 0.1, 0x0ea5e9, 2.0);
  const eyeMat = makeMat(0xff5500, 0.1, 0.2, 0xff4500, 1.8);

  // Central fuselage hull
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.22, 12), hullMat);
  bodyGroup.add(fuselage);

  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), accentMat);
  canopy.position.y = 0.08;
  bodyGroup.add(canopy);

  // Front optic camera eye
  const eyePod = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), eyeMat);
  eyePod.position.set(0, -0.02, 0.27);
  bodyGroup.add(eyePod);

  // 4 Angled Quad-Rotor Arms + Ducted Shrouds + Spinning Blades + Cyan Thrusters
  const rotors: THREE.Object3D[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const dx = Math.sin(a);
    const dz = Math.cos(a);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.56), hullMat);
    arm.position.set(dx * 0.36, 0.02, dz * 0.36);
    arm.rotation.y = a;
    bodyGroup.add(arm);

    const duct = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.045, 8, 16), hullMat);
    duct.rotation.x = Math.PI / 2;
    duct.position.set(dx * 0.62, 0.05, dz * 0.62);
    bodyGroup.add(duct);

    const thruster = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.07, 0.08, 10), thrusterMat);
    thruster.position.set(dx * 0.62, -0.04, dz * 0.62);
    bodyGroup.add(thruster);

    const bladeGroup = new THREE.Group();
    bladeGroup.position.set(dx * 0.62, 0.06, dz * 0.62);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.015, 0.05), mats.steel);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.36), mats.steel);
    bladeGroup.add(blade1, blade2);
    bodyGroup.add(bladeGroup);
    rotors.push(bladeGroup);
  }

  enableShadows(bodyGroup);
  return {
    root,
    bodyGroup,
    rotors,
    hitMaterials: [hullMat, accentMat],
  };
}

export function createEnemyRig(type: EnemyType, mats: SharedMaterials): EnemyRig {
  const glbAsset = assetManager.cloneEnemyAsset(type);
  if (glbAsset) {
    return adaptEnemyGLB(glbAsset, type, mats);
  }

  switch (type) {
    case 'infantry':
      return buildInfantry(mats);
    case 'scout':
      return buildFastScout(mats);
    case 'heavy':
      return buildHeavyArmored(mats);
    case 'shielded':
      return buildShieldedVanguard(mats);
    case 'drone':
      return buildAerialDrone(mats);
  }
}
