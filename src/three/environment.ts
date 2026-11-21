import * as THREE from 'three';
import { BUILD_PADS, ROAD_CONTROL_POINTS } from '../game/data';
import { assetManager } from './assets/AssetManager';
import type { SharedMaterials } from './materials';
import type { ProceduralTextures } from './textures';

export interface BuildPadVisual {
  id: string;
  x: number;
  z: number;
  group: THREE.Group;
  ringMesh: THREE.Mesh;
  hitMesh: THREE.Mesh;
  occupied: boolean;
}

export interface EnvironmentRig {
  group: THREE.Group;
  roadCurve: THREE.CatmullRomCurve3;
  buildPads: BuildPadVisual[];
  houseGroup: THREE.Group;
  ground: THREE.Mesh;
  canBuild(x:number,z:number):boolean;
  addPad(pad:{id:string;x:number;z:number}):BuildPadVisual;
  update: (time: number, dt: number) => void;
  dispose: () => void;
}

// Deterministic pseudo-random helper so terrain & groves match every session
function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// River path points from upper-center-right waterfall down to lower-right foreground
const RIVER_POINTS: Array<[number, number]> = [
  [8.5, -28],
  [10.2, -21],
  [16.0, -17.5],
  [21.8, -12.5],
  [23.2, -4.5],
  [21.8, 3.5],
  [20.2, 10.5],
  [23.5, 18.5],
  [27.5, 28.0],
  [30.0, 42.0],
  [33.0, 62.0],
];

function createRoadRibbonGeometry(curve: THREE.CatmullRomCurve3, width: number, segments: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const points = curve.getSpacedPoints(segments);
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= segments; i++) {
    const p = points[i];
    const t = i / segments;
    const tangent = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();

    const halfW = width * 0.5;
    const pLeftOuter = p.clone().addScaledVector(right, -(halfW + 0.35));
    const pLeft = p.clone().addScaledVector(right, -halfW);
    const pCenter = p.clone();
    const pRight = p.clone().addScaledVector(right, halfW);
    const pRightOuter = p.clone().addScaledVector(right, halfW + 0.35);

    // Slight crown in center, beveled soft shoulder down into grass
    pLeftOuter.y = -0.06;
    pLeft.y = 0.045;
    pCenter.y = 0.065;
    pRight.y = 0.045;
    pRightOuter.y = -0.06;

    const row = [pLeftOuter, pLeft, pCenter, pRight, pRightOuter];
    const uCoords = [0, 0.14, 0.5, 0.86, 1.0];
    for (let c = 0; c < 5; c++) {
      positions.push(row[c].x, row[c].y, row[c].z);
      uvs.push(t, uCoords[c]);
    }

    if (i < segments) {
      const base = i * 5;
      const next = (i + 1) * 5;
      for (let c = 0; c < 4; c++) {
        indices.push(base + c, base + c + 1, next + c);
        indices.push(base + c + 1, next + c + 1, next + c);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildFortifiedHouse(mats: SharedMaterials): {
  group: THREE.Group;
  flagMesh: THREE.Mesh;
  smokePuffs: Array<{ mesh: THREE.Mesh; phase: number }>;
  mixer?: THREE.AnimationMixer;
} {
  const group = new THREE.Group();

  const houseAsset = assetManager.cloneAsset('house');
  if (houseAsset) {
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 8.2), mats.contactShadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, 0.02, 0.3);
    group.add(shadow);

    group.add(houseAsset.scene);
    for (const [key, x, z] of [['env_crate', -2.8, 1.5], ['env_barrel', -2.6, 2.2], ['env_sandbag', 2.4, 2]] as const) {
      const prop = assetManager.cloneAsset(key);
      if (prop) {
        prop.scene.position.set(x, 0, z);
        group.add(prop.scene);
      }
    }
    let mixer: THREE.AnimationMixer | undefined;
    if (houseAsset.animations.length > 0) {
      mixer = new THREE.AnimationMixer(houseAsset.scene);
      houseAsset.animations.forEach((clip) => mixer!.clipAction(clip).play());
    }
    const dummyFlag = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), mats.flagBlue);
    dummyFlag.visible = false;
    return { group, flagMesh: dummyFlag, smokePuffs: [], mixer };
  }

  // Ground contact shadow
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 8.2), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.02, 0.3);
  group.add(shadow);

  // Courtyard cobblestone plinth
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.22, 5.4), mats.stoneDark);
  plinth.position.set(0, 0.11, 0.2);
  plinth.receiveShadow = true;
  group.add(plinth);

  // Cottage Main Body
  const wallBox = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.0, 2.8), mats.plasterWall);
  wallBox.position.set(0.2, 1.2, -0.4);
  group.add(wallBox);

  // Stone foundation skirt around cottage
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(3.78, 0.48, 2.98), mats.stone);
  skirt.position.set(0.2, 0.44, -0.4);
  group.add(skirt);

  // Timber framing beams on cottage walls
  [-1.58, 0.2, 1.98].forEach((bx) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.04, 2.86), mats.woodDark);
    post.position.set(bx, 1.2, -0.4);
    group.add(post);
  });
  const midBeam = new THREE.Mesh(new THREE.BoxGeometry(3.7, 0.15, 2.88), mats.woodDark);
  midBeam.position.set(0.2, 1.38, -0.4);
  group.add(midBeam);

  // Gabled Red Terracotta Tile Roof
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-2.15, 0);
  roofShape.lineTo(0, 1.55);
  roofShape.lineTo(2.15, 0);
  roofShape.lineTo(1.85, -0.14);
  roofShape.lineTo(0, 1.24);
  roofShape.lineTo(-1.85, -0.14);
  roofShape.closePath();

  const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
    depth: 3.3,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.06,
    bevelSegments: 2,
  });
  roofGeo.center();
  const roof = new THREE.Mesh(roofGeo, mats.roofTile);
  roof.position.set(0.2, 2.82, -0.4);
  group.add(roof);

  // Gable wall triangles filling under roof
  const gableGeo = new THREE.ConeGeometry(1.42, 1.2, 4);
  gableGeo.rotateY(Math.PI / 4);
  gableGeo.scale(1.28, 1.0, 1.45);
  const gableFill = new THREE.Mesh(gableGeo, mats.plasterWall);
  gableFill.position.set(0.2, 2.55, -0.4);
  group.add(gableFill);

  // Roof ridge beam
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 3.55), mats.woodDark);
  ridge.position.set(0.2, 3.62, -0.4);
  group.add(ridge);

  // Stone Chimney + Smoke Puffs
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.55, 0.55), mats.stone);
  chimney.position.set(-0.95, 3.35, -0.85);
  group.add(chimney);
  const chimneyCap = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.14, 0.68), mats.stoneDark);
  chimneyCap.position.set(-0.95, 4.15, -0.85);
  group.add(chimneyCap);

  const smokePuffs: Array<{ mesh: THREE.Mesh; phase: number }> = [];
  const smokeMat = new THREE.MeshStandardMaterial({
    color: 0xf4f1ea,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.55,
  });
  for (let i = 0; i < 4; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.18 + i * 0.04, 8, 8), smokeMat);
    puff.position.set(-0.95, 4.35 + i * 0.35, -0.85);
    group.add(puff);
    smokePuffs.push({ mesh: puff, phase: i * 0.25 });
  }

  // Arched Wooden Front Door & Glowing Porch Lantern
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.86, 1.22, 0.18), mats.stone);
  doorFrame.position.set(0.2, 0.82, 1.02);
  group.add(doorFrame);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.66, 1.08, 0.2), mats.wood);
  door.position.set(0.2, 0.78, 1.04);
  group.add(door);

  // Glowing Golden Windows (front & sides)
  const winOffsets: Array<[number, number, number, number]> = [
    [-0.95, 1.28, 1.02, 0],
    [1.35, 1.28, 1.02, 0],
    [0.2, 2.48, 1.06, 0],
    [-1.62, 1.28, -0.4, Math.PI / 2],
    [2.02, 1.28, -0.4, Math.PI / 2],
  ];
  winOffsets.forEach(([wx, wy, wz, ry]) => {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.56, 0.14), mats.woodDark);
    frame.position.set(wx, wy, wz);
    frame.rotation.y = ry;
    group.add(frame);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.16), mats.warmGlow);
    glass.position.set(wx, wy, wz);
    glass.rotation.y = ry;
    group.add(glass);
  });

  // Stone Perimeter Wall with Corner Piers & Gate Gap
  const wallSegs: Array<[number, number, number, number, number]> = [
    [-3.15, 0.52, 0.2, 0.32, 5.2], // Left wall
    [3.15, 0.52, 0.2, 0.32, 5.2], // Right wall
    [0, 0.52, -2.35, 6.4, 0.32], // Back wall
    [-1.9, 0.52, 2.75, 2.5, 0.32], // Front-left wall
    [1.9, 0.52, 2.75, 2.5, 0.32], // Front-right wall
  ];
  wallSegs.forEach(([x, y, z, w, d]) => {
    const wMesh = new THREE.Mesh(new THREE.BoxGeometry(w, 0.78, d), mats.stone);
    wMesh.position.set(x, y, z);
    group.add(wMesh);
  });

  // Corner Stone Pillars
  const pillars: Array<[number, number]> = [
    [-3.15, 2.75],
    [-0.75, 2.75],
    [0.75, 2.75],
    [3.15, 2.75],
    [-3.15, -2.35],
    [3.15, -2.35],
  ];
  pillars.forEach(([px, pz]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.08, 0.46), mats.stoneDark);
    p.position.set(px, 0.65, pz);
    group.add(p);
  });

  // Stacked Burlap Sandbag Barricades (front-left & front-right)
  const addSandbagStack = (sx: number, sz: number, rotY: number) => {
    const glbSandbag = assetManager.cloneAsset('env_sandbag');
    if (glbSandbag) {
      glbSandbag.scene.position.set(sx, 0.04, sz);
      glbSandbag.scene.rotation.y = rotY;
      group.add(glbSandbag.scene);
      return;
    }
    const stack = new THREE.Group();
    stack.position.set(sx, 0.16, sz);
    stack.rotation.y = rotY;
    for (let row = 0; row < 2; row++) {
      const count = row === 0 ? 4 : 3;
      for (let i = 0; i < count; i++) {
        const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.34, 4, 8), mats.sandbag);
        bag.rotation.z = Math.PI / 2;
        bag.position.set((i - (count - 1) * 0.5) * 0.52, row * 0.22, 0);
        stack.add(bag);
      }
    }
    group.add(stack);
  };
  addSandbagStack(-2.45, 3.25, 0.25);
  addSandbagStack(2.45, 3.25, -0.2);
  addSandbagStack(-3.65, 0.85, Math.PI / 2);

  // Wooden Barrels & Crates in courtyard
  const addBarrel = (bx: number, bz: number) => {
    const glbBarrel = assetManager.cloneAsset('env_barrel');
    if (glbBarrel) {
      glbBarrel.scene.position.set(bx, 0.2, bz);
      group.add(glbBarrel.scene);
      return;
    }
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.2, 0.56, 10), mats.wood);
    barrel.position.set(bx, 0.48, bz);
    group.add(barrel);
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 6, 12), mats.gunmetal);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(bx, 0.58, bz);
    group.add(hoop);
  };
  addBarrel(-2.45, 1.6);
  addBarrel(-2.05, 1.85);
  addBarrel(2.45, 1.5);

  const glbCrate = assetManager.cloneAsset('env_crate');
  if (glbCrate) {
    glbCrate.scene.position.set(2.35, 0.2, 2.05);
    glbCrate.scene.rotation.y = 0.25;
    group.add(glbCrate.scene);
  } else {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.48, 0.55), mats.woodDark);
    crate.position.set(2.35, 0.44, 2.05);
    crate.rotation.y = 0.25;
    group.add(crate);
  }

  // Flagpole with Blue & Gold Emblem Banner
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 8), mats.woodDark);
  pole.position.set(2.85, 1.8, 1.85);
  group.add(pole);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mats.goldTrim);
  finial.position.set(2.85, 3.45, 1.85);
  group.add(finial);

  const flagGeo = new THREE.PlaneGeometry(1.25, 0.78, 8, 4);
  flagGeo.translate(0.625, 0, 0);
  const flagMesh = new THREE.Mesh(flagGeo, mats.flagBlue);
  flagMesh.position.set(2.85, 2.95, 1.85);
  group.add(flagMesh);

  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), mats.goldTrim);
  star.scale.set(1, 1, 0.25);
  star.position.set(0.62, 0, 0.03);
  flagMesh.add(star);

  // Warm porch spill light
  const porchLight = new THREE.PointLight(0xffaa44, 2.2, 8, 1.8);
  porchLight.position.set(0.2, 1.7, 1.65);
  group.add(porchLight);

  group.traverse((c) => {
    if ((c as THREE.Mesh).isMesh) {
      c.castShadow = true;
      c.receiveShadow = true;
    }
  });

  return { group, flagMesh, smokePuffs };
}

export function createEnvironment(
  tex: ProceduralTextures,
  mats: SharedMaterials,
  isSoftwareGl: boolean,
): EnvironmentRig {
  const group = new THREE.Group();
  const rand = seededRandom(1408);

  // 1. Road & River Curves
  const roadPoints3D = ROAD_CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const roadCurve = new THREE.CatmullRomCurve3(roadPoints3D, false, 'catmullrom', 0.45);
  const roadSamples = roadCurve.getSpacedPoints(120);

  const riverPoints3D = RIVER_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const riverCurve = new THREE.CatmullRomCurve3(riverPoints3D, false, 'catmullrom', 0.45);
  const riverSamples = riverCurve.getSpacedPoints(80);

  const distToSamples = (x: number, z: number, samples: THREE.Vector3[]) => {
    let minD = Infinity;
    for (let i = 0; i < samples.length; i++) {
      const dx = x - samples[i].x;
      const dz = z - samples[i].z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < minD) minD = d;
    }
    return minD;
  };

  // Terrain Height Function: flat valley along road & pads, rolling hills on perimeter, sunken river channel
  const terrainHeight = (x: number, z: number): number => {
    const roadD = distToSamples(x, z, roadSamples);
    const riverD = distToSamples(x, z, riverSamples);

    // Riverbed trench
    let h = 0;
    if (riverD < 4.2) {
      const t = Math.max(0, 1 - riverD / 4.2);
      h -= Math.pow(t, 1.6) * 1.15;
    }

    // Back-valley waterfall cliff ridge around (8.5, -26)
    const cliffDx = x - 8.5;
    const cliffDz = z + 25.5;
    if (z < -18 && Math.abs(cliffDx) < 14) {
      const rise = Math.max(0, (-18 - z) * 0.35) * (1 - Math.min(1, Math.abs(cliffDx) / 15));
      h += rise;
    }

    // Gentle rolling outer meadow hills away from road & pads
    const distFromCenter = Math.sqrt((x * 0.85) ** 2 + (z * 1.05) ** 2);
    if (distFromCenter > 19.5 && roadD > 4.2 && riverD > 4.0) {
      const hillMask = Math.min(1, (distFromCenter - 19.5) / 14.0);
      const undulation =
        Math.sin(x * 0.14 + 0.5) * Math.cos(z * 0.16) * 1.45 +
        Math.sin((x + z) * 0.09) * 0.85 +
        1.1;
      h += hillMask * Math.max(0, undulation);
    }

    // Flatten around house courtyard
    const houseDist = Math.hypot(x - 16.5, z + 11.5);
    if (houseDist < 5.5) {
      h *= Math.max(0, (houseDist - 4.0) / 1.5);
    }

    // Smooth near road
    if (roadD < 2.8) {
      h = Math.max(-0.02, h * Math.max(0, (roadD - 1.8) / 1.0));
    }

    return h + cliffDz * 0; // keep reference clean
  };

  // Frame the playable valley without occupying any buildable ground.
  for (const [key, x, z, yaw, scale] of [
    ['env_ridge', -25, -22, .45, 1.35], ['env_ridge', -14, -28, 2, 1.7],
    ['env_ridge', 1, -31, 1.2, 1.3], ['env_ridge', 34, -18, 3, 1.5],
    ['env_cottage', 25, -13, -.55, 1.15], ['env_cottage', 27, -9, -1.1, .9],
    ['env_mill', 24, 5, -.65, 1.05], ['env_cottage', -24, -7, .45, 1],
  ] as const) {
    const prop = assetManager.cloneAsset(key);
    if (!prop) continue;
    prop.scene.position.set(x, terrainHeight(x, z), z);
    prop.scene.rotation.y = yaw;
    prop.scene.scale.setScalar(scale);
    group.add(prop.scene);
  }

  // 2. Rolling Meadow Terrain Mesh (116x116 extended so horizon blends into fog)
  const terrainGeo = new THREE.PlaneGeometry(116, 116, 96, 96);
  terrainGeo.rotateX(-Math.PI / 2);
  const posAttr = terrainGeo.attributes.position;
  const colors = new Float32Array(posAttr.count * 3);
  const cGrass = new THREE.Color(0xdceec9);
  const cSunlit = new THREE.Color(0xfff2c9);
  const cBank = new THREE.Color(0xb7d9be);

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);
    const vy = terrainHeight(vx, vz);
    posAttr.setY(i, vy);

    const riverD = distToSamples(vx, vz, riverSamples);
    const meadow = 0.28 + 0.22 * Math.sin(vx * 0.31 + Math.cos(vz * 0.28)) * Math.cos(vz * 0.42);
    const tmp = cGrass.clone().lerp(cSunlit, meadow);
    if (vy > 0.6) tmp.lerp(cSunlit, Math.min(1, vy * 0.35));
    if (riverD < 4.3) tmp.lerp(cBank, Math.max(0, 1 - riverD / 4.3) * 0.75);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: tex.grassMap,
    bumpMap: tex.grassBump,
    bumpScale: 0.04,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);

  // 3. Winding S-Shaped Dirt Road
  const roadGeo = createRoadRibbonGeometry(roadCurve, 2.65, 160);
  const roadMat = new THREE.MeshStandardMaterial({
    map: tex.dirtMap,
    bumpMap: tex.dirtBump,
    bumpScale: 0.05,
    roughness: 0.9,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // 4. Flowing Animated River & Waterfall
  const riverGeo = createRoadRibbonGeometry(riverCurve, 4.3, 90);
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x359fbc,
    map: tex.waterNormal,
    roughness: 0.14,
    metalness: 0.08,
    clearcoat: isSoftwareGl ? 0.2 : 0.95,
    clearcoatRoughness: 0.12,
    transparent: true,
    opacity: 0.88,
  });
  const riverMesh = new THREE.Mesh(riverGeo, waterMat);
  riverMesh.position.y = -0.34;
  riverMesh.receiveShadow = true;
  group.add(riverMesh);

  // Waterfall Cascade in upper valley
  const waterfallGroup = new THREE.Group();
  waterfallGroup.position.set(9.8, 1.35, -22.2);
  waterfallGroup.rotation.y = 0.45;
  const fallMat = new THREE.MeshStandardMaterial({
    color: 0x9ce2ff,
    map: tex.waterNormal,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.25,
    roughness: 0.2,
    transparent: true,
    opacity: 0.86,
  });
  const fallSheet = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.65, 3.3, 12, 1, true, -0.6, 1.2), fallMat);
  waterfallGroup.add(fallSheet);
  const foamPool = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 2.2, 20),
    new THREE.MeshBasicMaterial({ color: 0xe6f8ff, transparent: true, opacity: 0.58, side: THREE.DoubleSide }),
  );
  foamPool.rotation.x = -Math.PI / 2;
  foamPool.position.set(0, -1.62, 1.35);
  waterfallGroup.add(foamPool);
  group.add(waterfallGroup);

  // 5. Charming Wooden Plank Bridge across River (lower-right)
  const bridgeGlb = assetManager.cloneAsset('env_bridge');
  if (bridgeGlb) {
    bridgeGlb.scene.position.set(20.4, -0.1, 9.5);
    bridgeGlb.scene.rotation.y = -0.22;
    group.add(bridgeGlb.scene);
  } else {
    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(20.4, -0.1, 9.5);
    bridgeGroup.rotation.y = -0.22;
    for (let p = -4; p <= 4; p++) {
      const archY = Math.cos((p / 5) * (Math.PI / 2)) * 0.45;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 2.45), mats.wood);
      plank.position.set(p * 0.52, archY, 0);
      plank.rotation.z = -p * 0.04;
      plank.castShadow = true;
      plank.receiveShadow = true;
      bridgeGroup.add(plank);
    }
    [-1.12, 1.12].forEach((rz) => {
      [-2.1, 0, 2.1].forEach((px) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.95, 8), mats.woodDark);
        post.position.set(px, 0.38, rz);
        post.castShadow = true;
        bridgeGroup.add(post);
      });
      const rail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.09, 0.09), mats.woodDark);
      rail.position.set(0, 0.78, rz);
      rail.castShadow = true;
      bridgeGroup.add(rail);
    });
    group.add(bridgeGroup);
  }

  // 6. Fortified House (Main Base) at end of S-road
  const houseBuilt = buildFortifiedHouse(mats);
  const houseGroup = houseBuilt.group;
  houseGroup.position.set(17.5, 0, -11.4);
  houseGroup.rotation.y = -0.45; // Faces road arrival
  group.add(houseGroup);

  // 7. Roadside Wooden Fences along bottom-left road entrance
  const addFenceRun = (x1: number, z1: number, x2: number, z2: number, posts = 4) => {
    const fenceGlb = assetManager.cloneAsset('env_fence');
    if (fenceGlb) {
      const cx = (x1 + x2) * 0.5;
      const cz = (z1 + z2) * 0.5;
      fenceGlb.scene.position.set(cx, terrainHeight(cx, cz), cz);
      fenceGlb.scene.rotation.y = Math.atan2(x2 - x1, z2 - z1) + Math.PI / 2;
      group.add(fenceGlb.scene);
      return;
    }
    for (let i = 0; i < posts; i++) {
      const t = i / (posts - 1);
      const px = THREE.MathUtils.lerp(x1, x2, t);
      const pz = THREE.MathUtils.lerp(z1, z2, t);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.85, 6), mats.woodDark);
      post.position.set(px, terrainHeight(px, pz) + 0.4, pz);
      post.castShadow = true;
      group.add(post);
    }
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    const angle = Math.atan2(dx, dz);
    [0.34, 0.64].forEach((ry) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, len), mats.wood);
      rail.position.set((x1 + x2) * 0.5, terrainHeight((x1 + x2) * 0.5, (z1 + z2) * 0.5) + ry, (z1 + z2) * 0.5);
      rail.rotation.y = angle;
      rail.castShadow = true;
      group.add(rail);
    });
  };
  addFenceRun(-22.5, 11.8, -17.5, 8.8, 4);
  addFenceRun(-19.5, 16.8, -14.2, 13.8, 4);
  addFenceRun(-8.5, 13.5, -1.8, 13.2, 4);

  // Warm Stone Lanterns flanking road near the House
  const addLantern = (lx: number, lz: number) => {
    const lanternGlb = assetManager.cloneAsset('env_lantern');
    if (lanternGlb) {
      lanternGlb.scene.position.set(lx, terrainHeight(lx, lz), lz);
      group.add(lanternGlb.scene);
      return;
    }
    const lg = new THREE.Group();
    lg.position.set(lx, terrainHeight(lx, lz), lz);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.8, 6), mats.stoneDark);
    post.position.y = 0.4;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.26, 0.24), mats.warmGlow);
    head.position.y = 0.9;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.18, 4), mats.stone);
    cap.rotation.y = Math.PI / 4;
    cap.position.y = 1.1;
    lg.add(post, head, cap);
    lg.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) c.castShadow = true;
    });
    group.add(lg);
  };
  addLantern(12.2, -5.6);
  addLantern(13.6, -10.8);

  // 8. Stylized Lush Forests (Deciduous + Conifer Pines) & Rocks (InstancedMesh for crisp FPS)
  const treeCanopyGeo = new THREE.IcosahedronGeometry(1, 2);
  const leafVertices = treeCanopyGeo.attributes.position;
  for (let i = 0; i < leafVertices.count; i++) {
    const x = leafVertices.getX(i), y = leafVertices.getY(i), z = leafVertices.getZ(i);
    const r = 1 + 0.09 * Math.cos(11*x + 3*z) * Math.sin(8*y - 5*z);
    leafVertices.setXYZ(i, r*x, r*y, r*z);
  }
  treeCanopyGeo.computeVertexNormals();
  const leafRest=Array.from({length:leafVertices.count},(_,i)=>leafVertices.getX(i));
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.4, 7);
  const pineConeGeo = new THREE.ConeGeometry(1, 1.5, 7);
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);

  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88, metalness: 0.02 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.92, metalness: 0.02 });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.02 });
  const rockMat = new THREE.MeshStandardMaterial({
    map: tex.stoneMap,
    color: 0xa29c94,
    roughness: 0.9,
    metalness: 0.05,
  });

  const deciduousColors = [0x91933c, 0xb59b44, 0x697d32, 0xc68b36, 0xb4a151];
  const pineColors = [0x2b6229, 0x34732d, 0x245424];

  const deciduousSpots: Array<{ x: number; z: number; scale: number; color: number }> = [];
  const pineSpots: Array<{ x: number; z: number; scale: number; color: number }> = [];
  const rockSpots: Array<{ x: number; z: number; sx: number; sy: number; sz: number; ry: number }> = [];

  // Hand-curated scenic grove zones matching Image 1 & Image 2
  const groveZones: Array<{ cx: number; cz: number; rad: number; count: number; pineRatio: number }> = [
    { cx: -18, cz: -14, rad: 8.5, count: 32, pineRatio: 0.15 }, // Top-left thick woodland
    { cx: -24, cz: -2, rad: 7.5, count: 24, pineRatio: 0.25 }, // Mid-left forest
    { cx: -21, cz: 21, rad: 7.5, count: 24, pineRatio: 0.85 }, // Bottom-left pine grove!
    { cx: -3, cz: -18, rad: 8.0, count: 14, pineRatio: 0.2 }, // Top-center grove
    { cx: 1, cz: 19, rad: 7.5, count: 13, pineRatio: 0.35 }, // Bottom-center edge
    { cx: 26, cz: -18, rad: 6.5, count: 10, pineRatio: 0.2 }, // Top-right behind house
    { cx: 28, cz: 1, rad: 6.0, count: 10, pineRatio: 0.3 }, // Right riverbank grove
    { cx: 13, cz: 20, rad: 6.5, count: 10, pineRatio: 0.2 }, // Bottom-right grove
  ];

  groveZones.forEach((zone) => {
    for (let i = 0; i < zone.count; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * zone.rad;
      const tx = zone.cx + Math.cos(a) * r;
      const tz = zone.cz + Math.sin(a) * r;

      if (distToSamples(tx, tz, roadSamples) < 3.1) continue;
      if (distToSamples(tx, tz, riverSamples) < 3.2) continue;
      if (Math.hypot(tx - 17.5, tz + 11.4) < 5.6) continue;
      if (BUILD_PADS.some((p) => Math.hypot(tx - p.x, tz - p.z) < 2.6)) continue;

      const scale = 0.85 + rand() * 0.55;
      if (rand() < zone.pineRatio) {
        pineSpots.push({
          x: tx,
          z: tz,
          scale,
          color: pineColors[Math.floor(rand() * pineColors.length)],
        });
      } else {
        deciduousSpots.push({
          x: tx,
          z: tz,
          scale,
          color: deciduousColors[Math.floor(rand() * deciduousColors.length)],
        });
      }
    }
  });

  // Scatter organic rock clusters around waterfall, riverbank & bends
  const rockAnchors: Array<[number, number, number]> = [
    [7.2, -21, 1.3],
    [13.4, -20.5, 1.4],
    [19.5, -14.5, 1.1],
    [18.8, 3.8, 1.2],
    [24.5, 6.2, 1.3],
    [-11.5, -8.5, 1.1],
    [-19.2, 4.2, 1.0],
    [16.2, 14.5, 1.2],
  ];
  rockAnchors.forEach(([ax, az, s]) => {
    for (let k = 0; k < 4; k++) {
      const rx = ax + (rand() - 0.5) * 2.4;
      const rz = az + (rand() - 0.5) * 2.4;
      if (distToSamples(rx, rz, roadSamples) < 2.4) continue;
      rockSpots.push({
        x: rx,
        z: rz,
        sx: (0.45 + rand() * 0.65) * s,
        sy: (0.35 + rand() * 0.55) * s,
        sz: (0.45 + rand() * 0.65) * s,
        ry: rand() * Math.PI * 2,
      });
    }
  });

  // Deciduous Trees: external GLB (InstancedMesh if single-mesh, else shared-material clones) or procedural fallback
  if (deciduousSpots.length > 0) {
    const inst = assetManager.getSingleMeshForInstancing('env_tree_deciduous');
    if (inst) {
      const im = new THREE.InstancedMesh(inst.geometry, inst.material, deciduousSpots.length);
      im.castShadow = true;
      im.receiveShadow = true;
      const dummy = new THREE.Object3D();
      deciduousSpots.forEach((t, idx) => {
        dummy.position.set(t.x, terrainHeight(t.x, t.z), t.z);
        dummy.rotation.set(0, rand() * Math.PI * 2, 0);
        dummy.scale.setScalar(t.scale);
        dummy.updateMatrix();
        im.setMatrixAt(idx, dummy.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      group.add(im);
    } else if (assetManager.hasAsset('env_tree_deciduous')) {
      deciduousSpots.forEach((t) => {
        const treeClone = assetManager.cloneAsset('env_tree_deciduous');
        if (!treeClone) return;
        treeClone.scene.position.set(t.x, terrainHeight(t.x, t.z), t.z);
        treeClone.scene.rotation.y = rand() * Math.PI * 2;
        treeClone.scene.scale.setScalar(t.scale);
        group.add(treeClone.scene);
      });
    } else {
      const dTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, deciduousSpots.length);
      const dPuffs = new THREE.InstancedMesh(treeCanopyGeo, canopyMat, deciduousSpots.length * 4);
      dTrunks.castShadow = true;
      dPuffs.castShadow = true;
      dPuffs.receiveShadow = true;

      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      deciduousSpots.forEach((t, idx) => {
        const y0 = terrainHeight(t.x, t.z);
        dummy.position.set(t.x, y0 + 0.65 * t.scale, t.z);
        dummy.rotation.set(0, rand() * Math.PI, 0);
        dummy.scale.set(t.scale, t.scale, t.scale);
        dummy.updateMatrix();
        dTrunks.setMatrixAt(idx, dummy.matrix);

        col.setHex(t.color);
        const puffOffsets = [
          [0, 1.85, 0, 1.05],
          [-0.55, 1.55, 0.35, 0.78],
          [0.58, 1.6, -0.25, 0.8],
          [0.12, 2.35, 0.15, 0.72],
        ];
        puffOffsets.forEach(([ox, oy, oz, r], pIdx) => {
          dummy.position.set(t.x + ox * t.scale, y0 + oy * t.scale, t.z + oz * t.scale);
          dummy.scale.setScalar(r * t.scale);
          dummy.updateMatrix();
          const mIdx = idx * 4 + pIdx;
          dPuffs.setMatrixAt(mIdx, dummy.matrix);
          dPuffs.setColorAt(mIdx, col);
        });
      });
      dTrunks.instanceMatrix.needsUpdate = true;
      dPuffs.instanceMatrix.needsUpdate = true;
      if (dPuffs.instanceColor) dPuffs.instanceColor.needsUpdate = true;
      dTrunks.computeBoundingSphere();
      dPuffs.computeBoundingSphere();
      group.add(dTrunks, dPuffs);
    }
  }

  // Conifer Pine Trees: external GLB or procedural fallback
  if (pineSpots.length > 0) {
    const inst = assetManager.getSingleMeshForInstancing('env_tree_pine');
    if (inst) {
      const im = new THREE.InstancedMesh(inst.geometry, inst.material, pineSpots.length);
      im.castShadow = true;
      im.receiveShadow = true;
      const dummy = new THREE.Object3D();
      pineSpots.forEach((p, idx) => {
        dummy.position.set(p.x, terrainHeight(p.x, p.z), p.z);
        dummy.rotation.set(0, rand() * Math.PI * 2, 0);
        dummy.scale.setScalar(p.scale);
        dummy.updateMatrix();
        im.setMatrixAt(idx, dummy.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      group.add(im);
    } else if (assetManager.hasAsset('env_tree_pine')) {
      pineSpots.forEach((p) => {
        const pineClone = assetManager.cloneAsset('env_tree_pine');
        if (!pineClone) return;
        pineClone.scene.position.set(p.x, terrainHeight(p.x, p.z), p.z);
        pineClone.scene.rotation.y = rand() * Math.PI * 2;
        pineClone.scene.scale.setScalar(p.scale);
        group.add(pineClone.scene);
      });
    } else {
      const pTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, pineSpots.length);
      const pCones = new THREE.InstancedMesh(pineConeGeo, pineMat, pineSpots.length * 3);
      pTrunks.castShadow = true;
      pCones.castShadow = true;
      pCones.receiveShadow = true;

      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      pineSpots.forEach((p, idx) => {
        const y0 = terrainHeight(p.x, p.z);
        dummy.position.set(p.x, y0 + 0.55 * p.scale, p.z);
        dummy.rotation.set(0, rand() * Math.PI, 0);
        dummy.scale.setScalar(p.scale * 0.85);
        dummy.updateMatrix();
        pTrunks.setMatrixAt(idx, dummy.matrix);

        col.setHex(p.color);
        const tiers = [
          [1.35, 1.05, 1.0],
          [2.05, 0.84, 0.92],
          [2.68, 0.58, 0.82],
        ];
        tiers.forEach(([ty, tw, th], tIdx) => {
          dummy.position.set(p.x, y0 + ty * p.scale, p.z);
          dummy.scale.set(tw * p.scale, th * p.scale, tw * p.scale);
          dummy.updateMatrix();
          const mIdx = idx * 3 + tIdx;
          pCones.setMatrixAt(mIdx, dummy.matrix);
          pCones.setColorAt(mIdx, col);
        });
      });
      pTrunks.instanceMatrix.needsUpdate = true;
      pCones.instanceMatrix.needsUpdate = true;
      if (pCones.instanceColor) pCones.instanceColor.needsUpdate = true;
      pTrunks.computeBoundingSphere();
      pCones.computeBoundingSphere();
      group.add(pTrunks, pCones);
    }
  }

  // Rocks: external GLB or procedural fallback
  if (rockSpots.length > 0) {
    const inst = assetManager.getSingleMeshForInstancing('env_rock');
    if (inst) {
      const im = new THREE.InstancedMesh(inst.geometry, inst.material, rockSpots.length);
      im.castShadow = true;
      im.receiveShadow = true;
      const dummy = new THREE.Object3D();
      rockSpots.forEach((r, idx) => {
        dummy.position.set(r.x, terrainHeight(r.x, r.z), r.z);
        dummy.rotation.set(0, r.ry, 0);
        dummy.scale.set(r.sx, r.sy, r.sz);
        dummy.updateMatrix();
        im.setMatrixAt(idx, dummy.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      group.add(im);
    } else if (assetManager.hasAsset('env_rock')) {
      rockSpots.forEach((r) => {
        const rockClone = assetManager.cloneAsset('env_rock');
        if (!rockClone) return;
        rockClone.scene.position.set(r.x, terrainHeight(r.x, r.z), r.z);
        rockClone.scene.rotation.y = r.ry;
        rockClone.scene.scale.set(r.sx, r.sy, r.sz);
        group.add(rockClone.scene);
      });
    } else {
      const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockSpots.length);
      rocks.castShadow = true;
      rocks.receiveShadow = true;
      const dummy = new THREE.Object3D();
      rockSpots.forEach((r, idx) => {
        const y0 = terrainHeight(r.x, r.z);
        dummy.position.set(r.x, y0 + r.sy * 0.35, r.z);
        dummy.rotation.set(rand() * 0.4, r.ry, rand() * 0.4);
        dummy.scale.set(r.sx, r.sy, r.sz);
        dummy.updateMatrix();
        rocks.setMatrixAt(idx, dummy.matrix);
      });
      rocks.instanceMatrix.needsUpdate = true;
      rocks.computeBoundingSphere();
      group.add(rocks);
    }
  }

  // Soft contact shadows keep the groves grounded when mobile shadow maps are off.
  const groves = [...deciduousSpots, ...pineSpots];
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  shadowGeometry.rotateX(-Math.PI / 2);
  const shadowBatch = new THREE.InstancedMesh(shadowGeometry, mats.contactShadowMat, groves.length);
  const shadowTransform = new THREE.Object3D();
  groves.forEach((tree, index) => {
    shadowTransform.position.set(tree.x, terrainHeight(tree.x, tree.z) + .045, tree.z);
    shadowTransform.scale.set(3.9 * tree.scale, 1, 3.2 * tree.scale);
    shadowTransform.updateMatrix();
    shadowBatch.setMatrixAt(index, shadowTransform.matrix);
  });
  group.add(shadowBatch);

  // 9. Wildflowers & Shrubs scattered cleanly along meadow edges
  const flowerCount = 85;
  const flowerGeo = new THREE.OctahedronGeometry(0.14, 0);
  const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
  const flowerInst = assetManager.getSingleMeshForInstancing('env_flower');
  const flowers = flowerInst
    ? new THREE.InstancedMesh(flowerInst.geometry, flowerInst.material, flowerCount)
    : new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
  const flowerPalette = [0xfde047, 0xf472b6, 0xf8fafc, 0x60a5fa];
  const fDummy = new THREE.Object3D();
  const fCol = new THREE.Color();
  let placed = 0;
  for (let attempt = 0; attempt < 300 && placed < flowerCount; attempt++) {
    const fx = (rand() - 0.5) * 42;
    const fz = (rand() - 0.5) * 32;
    if (distToSamples(fx, fz, roadSamples) < 2.2) continue;
    if (distToSamples(fx, fz, riverSamples) < 2.7) continue;
    if (BUILD_PADS.some((p) => Math.hypot(fx - p.x, fz - p.z) < 1.8)) continue;
    const fy = terrainHeight(fx, fz);
    fDummy.position.set(fx, fy + (flowerInst ? 0 : 0.14), fz);
    fDummy.scale.setScalar(0.75 + rand() * 0.6);
    fDummy.updateMatrix();
    flowers.setMatrixAt(placed, fDummy.matrix);
    if (!flowerInst) {
      fCol.setHex(flowerPalette[placed % flowerPalette.length]);
      flowers.setColorAt(placed, fCol);
    }
    placed++;
  }
  flowers.count = placed;
  flowers.instanceMatrix.needsUpdate = true;
  if (!flowerInst && flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
  flowers.computeBoundingSphere();
  group.add(flowers);

  // 10. Tower Build Pads (12 circular carved stone foundations with subtle interactive ring)
  const buildPads: BuildPadVisual[] = [];
  const addPad = (pad:{id:string;x:number;z:number}):BuildPadVisual => {
    const marker=new THREE.Group();
    marker.position.set(pad.x,terrainHeight(pad.x,pad.z),pad.z);
    const hit=new THREE.Mesh(new THREE.CylinderGeometry(1.15,1.15,2.8,10),new THREE.MeshBasicMaterial({visible:false}));
    hit.position.y=1.4;
    hit.userData.padId=pad.id;
    hit.layers.enable(1);
    marker.add(hit);group.add(marker);
    const item={...pad,group:marker,hitMesh:hit,ringMesh:hit,occupied:false};
    buildPads.push(item);return item;
  };
  // Flag wave vertex animation buffer
  const flagGeo = houseBuilt.flagMesh.geometry;
  const flagBaseZ = new Float32Array(flagGeo.attributes.position.count);
  for (let i = 0; i < flagBaseZ.length; i++) {
    flagBaseZ[i] = flagGeo.attributes.position.getZ(i);
  }

  return {
    group,
    roadCurve,
    buildPads,addPad,ground:terrainMesh,
    canBuild:(x,z)=>Math.abs(x)<22 && Math.abs(z)<16 && terrainHeight(x,z)<.55 &&
      distToSamples(x,z,roadSamples)>2.85 && distToSamples(x,z,riverSamples)>3.8 &&
      Math.hypot(x-17.5,z+11.4)>4.5 &&
      ![...deciduousSpots,...pineSpots].some(t=>Math.hypot(x-t.x,z-t.z)<1.6*t.scale) &&
      !rockSpots.some(r=>Math.hypot(x-r.x,z-r.z)<1+Math.max(r.sx,r.sz)),
    houseGroup,
    update: (time: number, dt: number) => {
      for(let i=0;i<leafVertices.count;i++){
        const y=leafVertices.getY(i);
        leafVertices.setX(i,leafRest[i]+(.018+.02*y)*Math.sin(time*1.65+y*2));
      }
      leafVertices.needsUpdate=true;
      // Animate flowing water & waterfall ripples
      tex.waterNormal.offset.x -= dt * 0.28;
      tex.waterNormal.offset.y += dt * 0.06;

      if (houseBuilt.mixer) {
        houseBuilt.mixer.update(dt);
      }

      // Animate flag fluttering in gentle breeze
      if (houseBuilt.flagMesh.visible) {
        const fPos = flagGeo.attributes.position;
        for (let i = 0; i < fPos.count; i++) {
          const x = fPos.getX(i);
          const wave = Math.sin(time * 5.2 - x * 4.0) * 0.08 * Math.min(1, x);
          fPos.setZ(i, flagBaseZ[i] + wave);
        }
        fPos.needsUpdate = true;
      }

      // Animate rising chimney smoke puffs
      houseBuilt.smokePuffs.forEach((p) => {
        const cycle = (time * 0.28 + p.phase) % 1;
        p.mesh.position.y = 4.28 + cycle * 1.65;
        p.mesh.position.x = -0.95 + Math.sin(time * 1.4 + p.phase * 6) * 0.16 + cycle * 0.22;
        p.mesh.scale.setScalar(0.65 + cycle * 1.1);
        const mat = p.mesh.material as THREE.MeshStandardMaterial;
        mat.opacity = (1 - cycle) * 0.5;
      });
    },
    dispose: () => {
      terrainGeo.dispose();
      terrainMat.dispose();
      roadGeo.dispose();
      roadMat.dispose();
      riverGeo.dispose();
      waterMat.dispose();
      fallMat.dispose();
      treeCanopyGeo.dispose();
      trunkGeo.dispose();
      pineConeGeo.dispose();
      rockGeo.dispose();
      canopyMat.dispose();
      trunkMat.dispose();
      pineMat.dispose();
      rockMat.dispose();
      shadowGeometry.dispose();
      flowerGeo.dispose();
      flowerMat.dispose();
    },
  };
}
