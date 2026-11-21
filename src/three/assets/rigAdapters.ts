import * as THREE from 'three';
import type { EnemyType, TowerType } from '../../game/types';
import type { SharedMaterials } from '../materials';
import type { EnemyRig } from '../models/enemies';
import type { TowerRig } from '../models/towers';
import type { ClonedAssetInstance, ClonedTowerAssetInstance } from './AssetManager';

const LOCOMOTION_CLIP_PATTERN = /(walk|run|sprint|march|move|fly|hover|glide)/i;
const DEATH_CLIP_PATTERN = /(death|die|defeat|fall)/i;
const FIRE_CLIP_PATTERN = /(fire|shoot|attack|shot|zap)/i;
const IDLE_CLIP_PATTERN = /(idle|stand|hover)/i;

function pickClip(clips: THREE.AnimationClip[], pattern: RegExp): THREE.AnimationClip | null {
  for (const clip of clips) {
    if (pattern.test(clip.name)) return clip;
  }
  return null;
}

/**
 * Adapts a normalized GLB/GLTF tower clone into a TowerRig using AssetManager's
 * mapped 'Base', 'Turret', and 'Muzzle' nodes:
 * - Stationary 'Base' node grounded at (0, 0, 0)
 * - Independent `turretHead` ('Turret') yaw rotation toward enemies
 * - Independent `recoilGroup` kickback for barrel sub-nodes or full turret
 * - Exact 'Muzzle' node for projectile/beam emission
 * - Optional GLTF AnimationMixer (Idle + Fire clips)
 */
export function adaptTowerGLB(
  asset: ClonedTowerAssetInstance,
  _type: TowerType,
  _level: 1 | 2 | 3,
  mats: SharedMaterials,
): TowerRig {
  const root = new THREE.Group();

  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  const modelRoot = asset.scene;
  root.add(modelRoot);
  modelRoot.updateMatrixWorld(true);

  const { baseNode, turretNode, muzzleNode: resolvedMuzzle, recoilNode, muzzleLocal } = asset.nodes;

  const turretHead = new THREE.Group();
  turretHead.name = 'Turret';
  const recoilGroup = new THREE.Group();

  if (turretNode) {
    // Re-parent Turret inside turretHead centered at its world XZ pivot so it rotates cleanly around Y
    // while Base remains stationary inside modelRoot.
    const pivotPos = new THREE.Vector3();
    turretNode.getWorldPosition(pivotPos);
    turretHead.position.set(pivotPos.x, 0, pivotPos.z);
    root.add(turretHead);
    turretHead.add(recoilGroup);

    if (recoilNode && recoilNode !== turretNode && isDescendantOf(recoilNode, turretNode)) {
      // Keep Turret directly under turretHead and recoil only the barrel/weapon assembly inside it
      turretHead.attach(turretNode);
      turretNode.add(recoilGroup);
      recoilGroup.attach(recoilNode);
    } else {
      recoilGroup.attach(turretNode);
    }
  } else {
    // Fallback when GLB lacks a dedicated Turret node: rotate upper model so weapon tracking still works.
    turretHead.position.set(0, 0, 0);
    root.add(turretHead);
    turretHead.add(recoilGroup);
    recoilGroup.attach(modelRoot);
  }

  root.updateMatrixWorld(true);

  // Ensure a live Muzzle Object3D exists inside the rotating assembly so world muzzle queries
  // always reflect Turret rotation + recoil.
  let muzzleNode = resolvedMuzzle;
  if (!muzzleNode) {
    muzzleNode = new THREE.Object3D();
    muzzleNode.name = 'Muzzle';
    muzzleNode.position.copy(turretHead.worldToLocal(muzzleLocal.clone()));
    turretHead.add(muzzleNode);
  }

  // AnimationMixer support for animated GLB towers (e.g. rotating radar/crystal, firing recoil clip)
  let mixer: THREE.AnimationMixer | undefined;
  let fireAction: THREE.AnimationAction | undefined;
  if (asset.animations.length > 0) {
    mixer = new THREE.AnimationMixer(root);
    const idleClip = pickClip(asset.animations, IDLE_CLIP_PATTERN);
    const fireClip = pickClip(asset.animations, FIRE_CLIP_PATTERN);
    if (idleClip) {
      mixer.clipAction(idleClip).play();
    }
    if (fireClip) {
      fireAction = mixer.clipAction(fireClip);
      fireAction.setLoop(THREE.LoopOnce, 1);
      fireAction.clampWhenFinished = false;
    }
  }

  return {
    root,
    turretHead,
    recoilGroup,
    muzzleLocal: muzzleLocal.clone(),
    baseNode: baseNode ?? undefined,
    turretNode: turretNode ?? turretHead,
    muzzleNode,
    isExternalGLB: true,
    mappedNodes: {
      base: asset.nodes.hasBase,
      turret: asset.nodes.hasTurret,
      muzzle: asset.nodes.hasMuzzle,
    },
    mixer,
    onFire: fireAction
      ? () => {
          fireAction!.reset().play();
        }
      : undefined,
  };
}

/**
 * Adapts a normalized GLB/GLTF enemy clone into an EnemyRig with:
 * - Grounded contact shadow (plus hover altitude for Aerial Recon Drone)
 * - Skeletal/Keyframe AnimationMixer synced to path movement speed
 * - Optional Death clip playback
 * - Preserved Energy Shield bubble for Shielded Vanguard if not embedded in GLB
 */
export function adaptEnemyGLB(
  asset: ClonedAssetInstance,
  type: EnemyType,
  mats: SharedMaterials,
): EnemyRig {
  const root = new THREE.Group();

  const shadowSize = type === 'heavy' ? 1.55 : type === 'shielded' ? 1.35 : 1.05;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(shadowSize, shadowSize), mats.contactShadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  root.add(shadow);

  const bodyGroup = new THREE.Group();
  bodyGroup.add(asset.scene);
  root.add(bodyGroup);

  const hitMaterials: THREE.MeshStandardMaterial[] = [];
  let hasEmbeddedShield = false;
  asset.scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      if (/shield/i.test(m.name)) hasEmbeddedShield = true;
      // Clone material only if needed? Wait: to keep Android GPU efficient, share material by default
      // and avoid mutating shared hitMaterials across all instances! Clone per-enemy only for flash if small,
      // or track standard materials carefully. Cloning material instances on enemies (<40 live) is lightweight
      // while sharing BufferGeometry & Textures!
      if (m.material instanceof THREE.MeshStandardMaterial) {
        const instMat = m.material.clone();
        m.material = instMat;
        hitMaterials.push(instMat);
      }
    }
  });

  // Preserve visual Energy Shield bubble for Shielded Vanguard if GLB didn't supply one
  let shieldBubble: THREE.Mesh | undefined;
  let shieldWire: THREE.Mesh | undefined;
  if (type === 'shielded' && !hasEmbeddedShield) {
    shieldBubble = new THREE.Mesh(
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

    shieldWire = new THREE.Mesh(
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
  }

  let mixer: THREE.AnimationMixer | undefined;
  let locomotionAction: THREE.AnimationAction | undefined;
  let attackAction: THREE.AnimationAction | undefined;
  let deathAction: THREE.AnimationAction | undefined;

  if (asset.animations.length > 0) {
    mixer = new THREE.AnimationMixer(asset.scene);
    const locoClip =
      pickClip(asset.animations, LOCOMOTION_CLIP_PATTERN) ||
      pickClip(asset.animations, IDLE_CLIP_PATTERN) ||
      asset.animations[0];
    if (locoClip) {
      locomotionAction = mixer.clipAction(locoClip);
      locomotionAction.play();
    }
    const attackClip = pickClip(asset.animations, FIRE_CLIP_PATTERN);
    if (attackClip && type === 'infantry') {
      attackAction = mixer.clipAction(attackClip);
      attackAction.setLoop(THREE.LoopOnce, 1);
    }
    const deathClip = pickClip(asset.animations, DEATH_CLIP_PATTERN);
    if (deathClip) {
      deathAction = mixer.clipAction(deathClip);
      deathAction.setLoop(THREE.LoopOnce, 1);
      deathAction.clampWhenFinished = true;
    }
  }

  return {
    root,
    bodyGroup,
    shieldBubble,
    shieldWire,
    hitMaterials,
    mixer,
    locomotionAction,
    deathAction,
    attackAction,
    isExternalGLB: true,
  };
}

function isDescendantOf(node: THREE.Object3D, ancestor: THREE.Object3D): boolean {
  let curr: THREE.Object3D | null = node.parent;
  while (curr) {
    if (curr === ancestor) return true;
    curr = curr.parent;
  }
  return false;
}
