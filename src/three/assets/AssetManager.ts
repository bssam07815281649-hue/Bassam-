import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import type { EnemyType, ModelSlotId, TowerType } from '../../game/types';
import {
  getEnemyAssetKey,
  getTowerAssetKey,
  mapUiSlotToAssetKeys,
  MODEL_CATALOG,
  type AssetKey,
  type ModelSpec,
} from './modelCatalog';

const BASE_NODE_PATTERN = /^(base|pedestal|foundation|stand|towerbase|plinth|platform)/i;
const TURRET_NODE_PATTERN =
  /(turret|head|weapon|gun|cannon|barrel|marksman|sniper|crystal|emitter|rotator|carriage|top)/i;
const RECOIL_NODE_PATTERN = /(barrel|gun|cannon|rifle|muzzle_assembly|weapon)/i;
const MUZZLE_NODE_PATTERN = /(muzzle|firepoint|barreltip|tip|emit)/i;

export interface TowerNodeMapping {
  baseNode: THREE.Object3D | null;
  turretNode: THREE.Object3D | null;
  muzzleNode: THREE.Object3D | null;
  recoilNode: THREE.Object3D | null;
  muzzleLocal: THREE.Vector3;
  hasBase: boolean;
  hasTurret: boolean;
  hasMuzzle: boolean;
}

export interface LoadedAssetEntry {
  key: AssetKey;
  spec: ModelSpec;
  template: THREE.Group;
  animations: THREE.AnimationClip[];
  bounds: THREE.Box3;
  size: THREE.Vector3;
  sourceLabel: string;
  towerNodes?: { hasBase: boolean; hasTurret: boolean; hasMuzzle: boolean };
}

export interface ClonedAssetInstance {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  spec: ModelSpec;
  size: THREE.Vector3;
}

export interface ClonedTowerAssetInstance extends ClonedAssetInstance {
  nodes: TowerNodeMapping;
  resolvedKey: AssetKey;
}

function isDescendantOf(node: THREE.Object3D, ancestor: THREE.Object3D | null): boolean {
  if (!ancestor) return false;
  let curr: THREE.Object3D | null = node.parent;
  while (curr) {
    if (curr === ancestor) return true;
    curr = curr.parent;
  }
  return false;
}

function findNode(
  root: THREE.Object3D,
  exactName: string,
  fallbackPattern: RegExp,
  excludeSubtreeOf: THREE.Object3D | null = null,
  excludeNode: THREE.Object3D | null = null,
): THREE.Object3D | null {
  const lowerExact = exactName.toLowerCase();
  let exactCI: THREE.Object3D | null = null;
  let patternMatch: THREE.Object3D | null = null;

  root.traverse((child) => {
    if (!child.name) return;
    if (child === excludeNode || child === excludeSubtreeOf || isDescendantOf(child, excludeSubtreeOf)) {
      return;
    }
    if (child.name === exactName) {
      if (!exactCI || exactCI.name !== exactName) exactCI = child;
    } else if (!exactCI && child.name.toLowerCase() === lowerExact) {
      exactCI = child;
    } else if (!patternMatch && fallbackPattern.test(child.name)) {
      patternMatch = child;
    }
  });

  return exactCI ?? patternMatch;
}

class AssetManager {
  private entries = new Map<AssetKey, LoadedAssetEntry>();
  private failedKeys = new Set<AssetKey>();
  private uiFilenames = new Map<ModelSlotId, string>();
  private gltfLoader: GLTFLoader;
  private manifestLoaded = false;
  private preloadPromise: Promise<number> | null = null;
  private maxAnisotropy = 4;

  constructor() {
    this.gltfLoader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    draco.preload();
    this.gltfLoader.setDRACOLoader(draco);
    this.gltfLoader.setMeshoptDecoder(MeshoptDecoder);
  }

  public setMaxAnisotropy(anisotropy: number): void {
    this.maxAnisotropy = Math.min(Math.max(1, anisotropy || 4), 8);
  }

  /**
   * Maps the required 'Base', 'Turret', and 'Muzzle' nodes (with regex fallback)
   * from a GLTF/GLB tower hierarchy so the game state can keep 'Base' stationary,
   * rotate 'Turret' independently toward targets, and emit projectiles from 'Muzzle'.
   */
  public mapTowerNodes(modelRoot: THREE.Object3D, size?: THREE.Vector3): TowerNodeMapping {
    modelRoot.updateMatrixWorld(true);

    const baseNode = findNode(modelRoot, 'Base', BASE_NODE_PATTERN);
    const turretNode = findNode(modelRoot, 'Turret', TURRET_NODE_PATTERN, baseNode);

    // Prefer resolving Muzzle inside Turret first, then anywhere outside Base
    const muzzleSearchRoot = turretNode ?? modelRoot;
    const muzzleNode =
      findNode(muzzleSearchRoot, 'Muzzle', MUZZLE_NODE_PATTERN, baseNode, turretNode) ??
      (turretNode ? findNode(modelRoot, 'Muzzle', MUZZLE_NODE_PATTERN, baseNode, turretNode) : null);

    // Optional recoil sub-node (e.g. QuadBarrels) inside Turret
    let recoilNode: THREE.Object3D | null = null;
    if (turretNode) {
      turretNode.traverse((child) => {
        if (recoilNode || !child.name || child === turretNode || child === muzzleNode) return;
        if (RECOIL_NODE_PATTERN.test(child.name)) {
          recoilNode = child;
        }
      });
    }

    const fallbackSize = size ?? new THREE.Box3().setFromObject(modelRoot).getSize(new THREE.Vector3());
    let muzzleLocal = new THREE.Vector3(0, fallbackSize.y * 0.68, fallbackSize.z * 0.48);
    if (muzzleNode) {
      const wp = new THREE.Vector3();
      muzzleNode.getWorldPosition(wp);
      muzzleLocal = wp;
    }

    return {
      baseNode,
      turretNode,
      muzzleNode,
      recoilNode,
      muzzleLocal,
      hasBase: Boolean(baseNode),
      hasTurret: Boolean(turretNode),
      hasMuzzle: Boolean(muzzleNode),
    };
  }

  /**
   * Reads /assets/models/manifest.json (always 200 OK via Vite plugin or static public file)
   * and preloads only the GLB/GLTF files that exist on disk. Missing or invalid files fall back
   * gracefully to procedural meshes without breaking the game.
   */
  public preloadFromManifest(): Promise<number> {
    if (this.manifestLoaded) return Promise.resolve(this.entries.size);
    if (this.preloadPromise) return this.preloadPromise;

    this.preloadPromise = (async () => {
      try {
        const res = await fetch('/assets/models/manifest.json', { cache: 'no-store' });
        if (!res.ok) {
          this.manifestLoaded = true;
          return 0;
        }
        const data = (await res.json()) as { present?: string[] };
        const presentSet = new Set(data.present ?? []);
        const tasks: Array<Promise<boolean>> = [];

        (Object.keys(MODEL_CATALOG) as AssetKey[]).forEach((key) => {
          const spec = MODEL_CATALOG[key];
          if (presentSet.has(spec.path) && !this.entries.has(key)) {
            tasks.push(
              this.loadFromUrl(key, spec.path, spec.path.split('/').pop() || spec.path)
                .then((entry) => Boolean(entry))
                .catch((err) => {
                  this.failedKeys.add(key);
                  console.warn(`[AssetManager] Falling back to procedural mesh for ${spec.path}:`, err);
                  return false;
                }),
            );
          }
        });

        const results = await Promise.all(tasks);
        this.manifestLoaded = true;
        return results.filter(Boolean).length;
      } catch {
        this.manifestLoaded = true;
        return 0;
      }
    })();

    return this.preloadPromise;
  }

  /**
   * Loads and normalizes a GLB/GLTF asset from URL. Returns null (instead of throwing)
   * if the file is missing or cannot be parsed so callers fall back cleanly to procedural meshes.
   */
  public async loadFromUrl(
    key: AssetKey,
    url: string,
    sourceLabel = url,
  ): Promise<LoadedAssetEntry | null> {
    const spec = MODEL_CATALOG[key];
    try {
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        this.gltfLoader.load(url, resolve, undefined, reject);
      });
      const entry = this.normalizeGLTF(key, spec, gltf, sourceLabel);
      this.failedKeys.delete(key);
      this.entries.set(key, entry);
      return entry;
    } catch (err) {
      this.failedKeys.add(key);
      this.entries.delete(key);
      console.warn(`[AssetManager] Unable to load ${url}; using procedural fallback.`, err);
      return null;
    }
  }

  public async loadFromFile(slot: ModelSlotId, file: File): Promise<void> {
    const url = URL.createObjectURL(file);
    try {
      const targetKeys = mapUiSlotToAssetKeys(slot);
      const gltf = await new Promise<GLTF>((resolve, reject) => {
        this.gltfLoader.load(url, resolve, undefined, reject);
      });
      // For tower uploads, override only the first level; installed L2/L3 GLBs stay intact.
      const overrideKeys = slot.startsWith('tower_') ? targetKeys.slice(0, 1) : targetKeys;
      overrideKeys.forEach((key) => {
        const spec = MODEL_CATALOG[key];
        const entry = this.normalizeGLTF(key, spec, gltf, file.name);
        this.failedKeys.delete(key);
        this.entries.set(key, entry);
      });
      this.uiFilenames.set(slot, file.name);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private normalizeGLTF(
    key: AssetKey,
    spec: ModelSpec,
    gltf: GLTF,
    sourceLabel: string,
  ): LoadedAssetEntry {
    // Clone source scene so repeated normalizations from same GLTF stay pure
    const rawRoot = SkeletonUtils.clone(gltf.scene) as THREE.Group;

    // Configure shadows & mobile-optimized material/texture settings
    rawRoot.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = spec.castShadow;
        mesh.receiveShadow = spec.receiveShadow;
        mesh.frustumCulled = true;

        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((mat) => {
          if (!mat) return;
          if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
            mat.envMapIntensity = Math.min(mat.envMapIntensity || 1, 1.1);
            if (mat.map) {
              mat.map.colorSpace = THREE.SRGBColorSpace;
              mat.map.anisotropy = this.maxAnisotropy;
              mat.map.needsUpdate = true;
            }
          }
        });
      }
    });

    // Apply orientation correction before measuring final grounded box
    if (spec.forwardYawOffset !== 0) {
      rawRoot.rotation.y += spec.forwardYawOffset;
    }
    rawRoot.updateMatrixWorld(true);

    const initialBox = new THREE.Box3().setFromObject(rawRoot);
    const initialSize = new THREE.Vector3();
    initialBox.getSize(initialSize);

    const safeHeight = Math.max(initialSize.y, 0.001);
    const uniformScale = spec.targetHeight / safeHeight;
    rawRoot.scale.multiplyScalar(uniformScale);
    rawRoot.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(rawRoot);
    const scaledCenter = new THREE.Vector3();
    const scaledSize = new THREE.Vector3();
    scaledBox.getCenter(scaledCenter);
    scaledBox.getSize(scaledSize);

    // Wrap inside normalized pivot container grounded bottom-center at (0, groundOffsetY, 0)
    const template = new THREE.Group();
    template.name = `AssetRoot_${key}`;
    rawRoot.position.set(
      rawRoot.position.x - scaledCenter.x,
      rawRoot.position.y - scaledBox.min.y + spec.groundOffsetY,
      rawRoot.position.z - scaledCenter.z,
    );
    template.add(rawRoot);
    template.updateMatrixWorld(true);

    const finalBounds = new THREE.Box3().setFromObject(template);

    let towerNodes: LoadedAssetEntry['towerNodes'];
    if (spec.category === 'tower') {
      const mapping = this.mapTowerNodes(template, scaledSize);
      towerNodes = {
        hasBase: mapping.hasBase,
        hasTurret: mapping.hasTurret,
        hasMuzzle: mapping.hasMuzzle,
      };
      if (!mapping.hasBase || !mapping.hasTurret || !mapping.hasMuzzle) {
        console.warn(
          `[AssetManager] Tower GLB '${sourceLabel}' missing expected nodes:`,
          towerNodes,
        );
      }
    }

    return {
      key,
      spec,
      template,
      animations: gltf.animations ?? [],
      bounds: finalBounds,
      size: scaledSize,
      sourceLabel,
      towerNodes,
    };
  }

  public hasAsset(key: AssetKey): boolean {
    return this.entries.has(key);
  }

  public isUsingProceduralFallback(key: AssetKey): boolean {
    return !this.entries.has(key);
  }

  public cloneAsset(key: AssetKey): ClonedAssetInstance | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    // SkeletonUtils.clone preserves SkinnedMesh bone bindings while sharing BufferGeometry & Material
    const cloned = SkeletonUtils.clone(entry.template) as THREE.Group;
    return {
      scene: cloned,
      animations: entry.animations,
      spec: entry.spec,
      size: entry.size.clone(),
    };
  }

  /**
   * Resolves a tower GLB for (type, level), falling back from exact level -> L1 -> null (procedural).
   * Always returns mapped Base / Turret / Muzzle nodes from the cloned GLTF hierarchy.
   */
  public cloneTowerAsset(type: TowerType, level: 1 | 2 | 3): ClonedTowerAssetInstance | null {
    const exactKey = getTowerAssetKey(type, level);
    const exact = this.cloneAsset(exactKey);
    if (exact) {
      return {
        ...exact,
        resolvedKey: exactKey,
        nodes: this.mapTowerNodes(exact.scene, exact.size),
      };
    }

    if (level > 1) {
      const l1Key = getTowerAssetKey(type, 1);
      const l1 = this.cloneAsset(l1Key);
      if (l1) {
        const tierScale = 1 + (level - 1) * 0.08;
        l1.scene.scale.multiplyScalar(tierScale);
        l1.size.multiplyScalar(tierScale);
        return {
          ...l1,
          resolvedKey: l1Key,
          nodes: this.mapTowerNodes(l1.scene, l1.size),
        };
      }
    }

    return null;
  }

  public cloneEnemyAsset(type: EnemyType): ClonedAssetInstance | null {
    return this.cloneAsset(getEnemyAssetKey(type));
  }

  /**
   * Extracts single-mesh geometry/material for high-FPS Android InstancedMesh rendering of repeated props.
   */
  public getSingleMeshForInstancing(
    key: AssetKey,
  ): { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] } | null {
    const entry = this.entries.get(key);
    if (!entry) return null;

    const meshes: THREE.Mesh[] = [];
    entry.template.updateMatrixWorld(true);
    entry.template.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) meshes.push(c as THREE.Mesh);
    });
    if (meshes.length !== 1) return null;

    const mesh = meshes[0];
    const bakedGeo = mesh.geometry.clone();
    bakedGeo.applyMatrix4(mesh.matrixWorld);
    return {
      geometry: bakedGeo,
      material: mesh.material,
    };
  }

  public clearSlot(slot: ModelSlotId): void {
    mapUiSlotToAssetKeys(slot).forEach((k) => {
      this.entries.delete(k);
      this.failedKeys.delete(k);
    });
    this.uiFilenames.delete(slot);
  }

  public listUiOverrides(): Partial<Record<ModelSlotId, string>> {
    const out: Partial<Record<ModelSlotId, string>> = {};
    this.uiFilenames.forEach((name, slot) => {
      out[slot] = name;
    });
    return out;
  }

  public listLoadedAssets(): Array<{
    key: AssetKey;
    path: string;
    source: string;
    animated: boolean;
    towerNodes?: { hasBase: boolean; hasTurret: boolean; hasMuzzle: boolean };
  }> {
    const list: Array<{
      key: AssetKey;
      path: string;
      source: string;
      animated: boolean;
      towerNodes?: { hasBase: boolean; hasTurret: boolean; hasMuzzle: boolean };
    }> = [];
    this.entries.forEach((entry, key) => {
      list.push({
        key,
        path: entry.spec.path,
        source: entry.sourceLabel,
        animated: entry.animations.length > 0,
        towerNodes: entry.towerNodes,
      });
    });
    return list;
  }
}

export const assetManager = new AssetManager();
