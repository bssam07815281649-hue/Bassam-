import type { EnemyType, ModelSlotId, TowerType } from '../../game/types';

export type AssetKey =
  | 'enemy_giant'
  | 'env_ridge'
  | 'env_cottage'
  | 'env_mill'
  | 'house'
  | 'tower_gun_l1'
  | 'tower_gun_l2'
  | 'tower_gun_l3'
  | 'tower_cannon_l1'
  | 'tower_cannon_l2'
  | 'tower_cannon_l3'
  | 'tower_sniper_l1'
  | 'tower_sniper_l2'
  | 'tower_sniper_l3'
  | 'tower_lightning_l1'
  | 'tower_lightning_l2'
  | 'tower_lightning_l3'
  | 'enemy_infantry'
  | 'enemy_scout'
  | 'enemy_heavy'
  | 'enemy_shielded'
  | 'enemy_drone'
  | 'env_tree_deciduous'
  | 'env_tree_pine'
  | 'env_rock'
  | 'env_bridge'
  | 'env_fence'
  | 'env_lantern'
  | 'env_sandbag'
  | 'env_barrel'
  | 'env_crate'
  | 'env_flower';

export interface ModelSpec {
  key: AssetKey;
  category: 'building' | 'tower' | 'enemy' | 'environment';
  /** Expected URL path served from public/assets/models/... */
  path: string;
  /** Target world-unit height after uniform normalization scaling */
  targetHeight: number;
  /** Optional Y rotation offset (radians) if model faces -Z instead of +Z */
  forwardYawOffset: number;
  /** Offset added after grounding min.y to y=0 (e.g. hover altitude for drone) */
  groundOffsetY: number;
  castShadow: boolean;
  receiveShadow: boolean;
}

export const MODEL_CATALOG: Record<AssetKey, ModelSpec> = {
  enemy_giant: {
    key: 'enemy_giant', category: 'enemy',
    path: '/assets/models/citadel/enemy_giant.glb', targetHeight: 1.85,
    forwardYawOffset: 0, groundOffsetY: 0, castShadow: true, receiveShadow: true,
  },
  env_ridge: {
    key: 'env_ridge', category: 'environment',
    path: '/assets/models/citadel/env_ridge.glb', targetHeight: 6.5,
    forwardYawOffset: 0, groundOffsetY: 0, castShadow: true, receiveShadow: true,
  },
  env_cottage: {
    key: 'env_cottage', category: 'environment',
    path: '/assets/models/citadel/env_cottage.glb', targetHeight: 2.7,
    forwardYawOffset: 0, groundOffsetY: 0, castShadow: true, receiveShadow: true,
  },
  env_mill: {
    key: 'env_mill', category: 'environment',
    path: '/assets/models/citadel/env_mill.glb', targetHeight: 4.2,
    forwardYawOffset: 0, groundOffsetY: 0, castShadow: true, receiveShadow: true,
  },
  // Main Base Building
  house: {
    key: 'house',
    category: 'building',
    path: '/assets/models/citadel/house.glb',
    targetHeight: 6.2,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },

  // Gun Turret (Levels 1 - 3)
  tower_gun_l1: {
    key: 'tower_gun_l1',
    category: 'tower',
    path: '/assets/models/citadel/tower_gun_l1.glb',
    targetHeight: 1.65,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  tower_gun_l2: {
    key: 'tower_gun_l2',
    category: 'tower',
    path: '/assets/models/citadel/tower_gun_l2.glb',
    targetHeight: 1.8,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  tower_gun_l3: {
    key: 'tower_gun_l3',
    category: 'tower',
    path: '/assets/models/citadel/tower_gun_l3.glb',
    targetHeight: 1.95,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },

  // Cannon Tower (Levels 1 - 3)
  tower_cannon_l1: {
    key: 'tower_cannon_l1',
    category: 'tower',
    path: '/assets/models/citadel/tower_cannon_l1.glb',
    targetHeight: 1.6,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  tower_cannon_l2: {
    key: 'tower_cannon_l2',
    category: 'tower',
    path: '/assets/models/citadel/tower_cannon_l2.glb',
    targetHeight: 1.75,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  tower_cannon_l3: {
    key: 'tower_cannon_l3',
    category: 'tower',
    path: '/assets/models/citadel/tower_cannon_l3.glb',
    targetHeight: 1.9,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },

  // Sniper Tower (Levels 1 - 3)
  tower_sniper_l1: {
    key: 'tower_sniper_l1',
    category: 'tower',
    path: '/assets/models/citadel/tower_sniper_l1.glb',
    targetHeight: 2.55,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  tower_sniper_l2: {
    key: 'tower_sniper_l2',
    category: 'tower',
    path: '/assets/models/citadel/tower_sniper_l2.glb',
    targetHeight: 2.75,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  tower_sniper_l3: {
    key: 'tower_sniper_l3',
    category: 'tower',
    path: '/assets/models/citadel/tower_sniper_l3.glb',
    targetHeight: 2.95,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },

  // Lightning-Arrow Tower (Levels 1 - 3)
  tower_lightning_l1: {
    key: 'tower_lightning_l1',
    category: 'tower',
    path: '/assets/models/citadel/tower_lightning_l1.glb',
    targetHeight: 2.55,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  tower_lightning_l2: {
    key: 'tower_lightning_l2',
    category: 'tower',
    path: '/assets/models/citadel/tower_lightning_l2.glb',
    targetHeight: 2.75,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  tower_lightning_l3: {
    key: 'tower_lightning_l3',
    category: 'tower',
    path: '/assets/models/citadel/tower_lightning_l3.glb',
    targetHeight: 3.0,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },

  // Enemies
  enemy_infantry: {
    key: 'enemy_infantry',
    category: 'enemy',
    path: '/assets/models/citadel/enemy_infantry.glb',
    targetHeight: 1.25,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: false,
  },
  enemy_scout: {
    key: 'enemy_scout',
    category: 'enemy',
    path: '/assets/models/citadel/enemy_scout.glb',
    targetHeight: 1.2,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: false,
  },
  enemy_heavy: {
    key: 'enemy_heavy',
    category: 'enemy',
    path: '/assets/models/citadel/enemy_heavy.glb',
    targetHeight: 1.55,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: false,
  },
  enemy_shielded: {
    key: 'enemy_shielded',
    category: 'enemy',
    path: '/assets/models/citadel/enemy_shielded.glb',
    targetHeight: 1.35,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: false,
  },
  enemy_drone: {
    key: 'enemy_drone',
    category: 'enemy',
    path: '/assets/models/citadel/enemy_drone.glb',
    targetHeight: 0.72,
    forwardYawOffset: 0,
    groundOffsetY: 2.15,
    castShadow: true,
    receiveShadow: false,
  },

  // Environment Objects
  env_tree_deciduous: {
    key: 'env_tree_deciduous',
    category: 'environment',
    path: '/assets/models/citadel/env_tree_deciduous.glb',
    targetHeight: 3.2,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  env_tree_pine: {
    key: 'env_tree_pine',
    category: 'environment',
    path: '/assets/models/citadel/env_tree_pine.glb',
    targetHeight: 3.4,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  env_rock: {
    key: 'env_rock',
    category: 'environment',
    path: '/assets/models/citadel/env_rock.glb',
    targetHeight: 1.35,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  env_bridge: {
    key: 'env_bridge',
    category: 'environment',
    path: '/assets/models/citadel/env_bridge.glb',
    targetHeight: 1.25,
    forwardYawOffset: 0,
    groundOffsetY: -0.1,
    castShadow: true,
    receiveShadow: true,
  },
  env_fence: {
    key: 'env_fence',
    category: 'environment',
    path: '/assets/models/citadel/env_fence.glb',
    targetHeight: 0.9,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  env_lantern: {
    key: 'env_lantern',
    category: 'environment',
    path: '/assets/models/citadel/env_lantern.glb',
    targetHeight: 1.25,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  env_sandbag: {
    key: 'env_sandbag',
    category: 'environment',
    path: '/assets/models/citadel/env_sandbag.glb',
    targetHeight: 0.65,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  env_barrel: {
    key: 'env_barrel',
    category: 'environment',
    path: '/assets/models/citadel/env_barrel.glb',
    targetHeight: 0.6,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  env_crate: {
    key: 'env_crate',
    category: 'environment',
    path: '/assets/models/citadel/env_crate.glb',
    targetHeight: 0.55,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: true,
    receiveShadow: true,
  },
  env_flower: {
    key: 'env_flower',
    category: 'environment',
    path: '/assets/models/citadel/env_flower.glb',
    targetHeight: 0.32,
    forwardYawOffset: 0,
    groundOffsetY: 0,
    castShadow: false,
    receiveShadow: true,
  },
};

export function getTowerAssetKey(type: TowerType, level: 1 | 2 | 3): AssetKey {
  return `tower_${type}_l${level}` as AssetKey;
}

export function getEnemyAssetKey(type: EnemyType): AssetKey {
  return `enemy_${type}` as AssetKey;
}

export function mapUiSlotToAssetKeys(slot: ModelSlotId): AssetKey[] {
  switch (slot) {
    case 'house':
      return ['house'];
    case 'tower_gun':
      return ['tower_gun_l1', 'tower_gun_l2', 'tower_gun_l3'];
    case 'tower_cannon':
      return ['tower_cannon_l1', 'tower_cannon_l2', 'tower_cannon_l3'];
    case 'tower_sniper':
      return ['tower_sniper_l1', 'tower_sniper_l2', 'tower_sniper_l3'];
    case 'tower_lightning':
      return ['tower_lightning_l1', 'tower_lightning_l2', 'tower_lightning_l3'];
    case 'enemy_infantry':
      return ['enemy_infantry'];
    case 'enemy_scout':
      return ['enemy_scout'];
    case 'enemy_heavy':
      return ['enemy_heavy'];
    case 'enemy_shielded':
      return ['enemy_shielded'];
    case 'enemy_drone':
      return ['enemy_drone'];
  }
}
