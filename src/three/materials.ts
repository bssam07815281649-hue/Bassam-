import * as THREE from 'three';
import type { ProceduralTextures } from './textures';

export function detectSoftwareWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export interface SharedMaterials {
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  wood: THREE.MeshStandardMaterial;
  woodDark: THREE.MeshStandardMaterial;
  roofTile: THREE.MeshStandardMaterial;
  plasterWall: THREE.MeshStandardMaterial;
  sandbag: THREE.MeshStandardMaterial;
  gunmetal: THREE.MeshStandardMaterial;
  steel: THREE.MeshStandardMaterial;
  goldTrim: THREE.MeshStandardMaterial;
  copper: THREE.MeshStandardMaterial;
  warmGlow: THREE.MeshStandardMaterial;
  cyanCrystal: THREE.MeshPhysicalMaterial;
  redGlow: THREE.MeshStandardMaterial;
  flagBlue: THREE.MeshStandardMaterial;
  contactShadowMat: THREE.MeshBasicMaterial;
  dispose: () => void;
}

export function createSharedMaterials(tex: ProceduralTextures, isSoftwareGl: boolean): SharedMaterials {
  const stone = new THREE.MeshStandardMaterial({
    map: tex.stoneMap,
    bumpMap: tex.stoneBump,
    bumpScale: 0.04,
    roughness: 0.88,
    metalness: 0.04,
  });

  const stoneDark = new THREE.MeshStandardMaterial({
    map: tex.stoneMap,
    bumpMap: tex.stoneBump,
    bumpScale: 0.05,
    color: 0x8b8680,
    roughness: 0.9,
    metalness: 0.06,
  });

  const wood = new THREE.MeshStandardMaterial({
    map: tex.woodMap,
    roughness: 0.82,
    metalness: 0.04,
  });

  const woodDark = new THREE.MeshStandardMaterial({
    map: tex.woodMap,
    color: 0x9b7152,
    roughness: 0.86,
    metalness: 0.04,
  });

  const roofTile = new THREE.MeshStandardMaterial({
    map: tex.roofTileMap,
    bumpMap: tex.roofTileBump,
    bumpScale: 0.05,
    roughness: 0.65,
    metalness: 0.05,
  });

  const plasterWall = new THREE.MeshStandardMaterial({
    color: 0xf1dec2,
    roughness: 0.9,
    metalness: 0.02,
  });

  const sandbag = new THREE.MeshStandardMaterial({
    map: tex.burlapMap,
    roughness: 0.94,
    metalness: 0.0,
  });

  const gunmetal = new THREE.MeshStandardMaterial({
    color: 0x3b424d,
    roughness: 0.34,
    metalness: 0.84,
  });

  const steel = new THREE.MeshStandardMaterial({
    color: 0x7e8896,
    roughness: 0.28,
    metalness: 0.88,
  });

  const goldTrim = new THREE.MeshStandardMaterial({
    color: 0xf4a825,
    roughness: 0.26,
    metalness: 0.82,
  });

  const copper = new THREE.MeshStandardMaterial({
    color: 0xc97336,
    roughness: 0.32,
    metalness: 0.78,
  });

  const warmGlow = new THREE.MeshStandardMaterial({
    color: 0xffd07a,
    emissive: 0xff9d2e,
    emissiveIntensity: 1.45,
    roughness: 0.3,
    metalness: 0.05,
  });

  const cyanCrystal = new THREE.MeshPhysicalMaterial({
    color: 0x56d8ff,
    emissive: 0x0ea5e9,
    emissiveIntensity: 1.35,
    roughness: 0.12,
    metalness: 0.15,
    clearcoat: 1.0,
    transmission: isSoftwareGl ? 0 : 0.45,
    transparent: true,
    opacity: isSoftwareGl ? 0.88 : 0.96,
    ior: 1.6,
  });

  const redGlow = new THREE.MeshStandardMaterial({
    color: 0xff4938,
    emissive: 0xef4444,
    emissiveIntensity: 1.6,
    roughness: 0.25,
    metalness: 0.2,
  });

  const flagBlue = new THREE.MeshStandardMaterial({
    color: 0x1e4fc2,
    roughness: 0.75,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });

  const contactShadowMat = new THREE.MeshBasicMaterial({
    map: tex.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });

  const all = [
    stone,
    stoneDark,
    wood,
    woodDark,
    roofTile,
    plasterWall,
    sandbag,
    gunmetal,
    steel,
    goldTrim,
    copper,
    warmGlow,
    cyanCrystal,
    redGlow,
    flagBlue,
    contactShadowMat,
  ];

  return {
    stone,
    stoneDark,
    wood,
    woodDark,
    roofTile,
    plasterWall,
    sandbag,
    gunmetal,
    steel,
    goldTrim,
    copper,
    warmGlow,
    cyanCrystal,
    redGlow,
    flagBlue,
    contactShadowMat,
    dispose: () => {
      all.forEach((m) => m.dispose());
    },
  };
}
