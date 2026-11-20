export type TowerType = 'gun' | 'cannon' | 'sniper' | 'lightning';

export type EnemyType = 'infantry' | 'scout' | 'heavy' | 'shielded' | 'drone';

export type TargetPriority = 'first' | 'strongest' | 'closest';

export type ModelSlotId =
  | 'house'
  | 'tower_gun'
  | 'tower_cannon'
  | 'tower_sniper'
  | 'tower_lightning'
  | 'enemy_infantry'
  | 'enemy_scout'
  | 'enemy_heavy'
  | 'enemy_shielded'
  | 'enemy_drone';

export interface TowerLevelStats {
  level: 1 | 2 | 3;
  upgradeGold: number;
  upgradeWood: number;
  damage: number;
  fireRate: number; // shots per second
  range: number;
  splashRadius?: number;
  chainCount?: number;
  shieldDamageMult?: number;
}

export interface TowerDefinition {
  id: TowerType;
  name: string;
  costGold: number;
  costWood: number;
  accentColor: string;
  canHitAir: boolean;
  canHitGround: boolean;
  armorPiercing: boolean;
  projectileSpeed: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  effectiveness: Record<EnemyType, 'strong' | 'normal' | 'weak' | 'immune'>;
  levels: [TowerLevelStats, TowerLevelStats, TowerLevelStats];
}

export interface EnemyDefinition {
  id: EnemyType;
  name: string;
  maxHp: number;
  maxShield: number;
  speed: number;
  isFlying: boolean;
  cannonDodgeChance: number;
  gunDeflectFactor: number; // multiplier applied to gun turret damage (e.g. 0.15 = deflects 85%)
  cannonResistance: number; // multiplier when shielded or resistant
  rewardGold: number;
  rewardWood: number;
  houseDamage: number;
  accentColor: string;
  traits: string[];
  counterTip: string;
}

export interface WaveGroup {
  type: EnemyType;
  count: number;
  interval: number;
  delay: number;
}

export interface WaveDefinition {
  waveNumber: number;
  title: string;
  groups: WaveGroup[];
  bonusGold: number;
  bonusWood: number;
}

export interface BuildPadData {
  id: string;
  x: number;
  z: number;
}

export interface TowerInstance {
  id: string;
  padId: string;
  type: TowerType;
  level: 1 | 2 | 3;
  x: number;
  y: number;
  z: number;
  turretYaw: number;
  modelSource: 'glb' | 'procedural';
  cooldown: number;
  priority: TargetPriority;
  kills: number;
  totalDamage: number;
  investedGold: number;
  investedWood: number;
}

export interface EnemyInstance {
  id: string;
  type: EnemyType;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  pathProgress: number; // 0 to 1 along S-road
  speed: number;
  x: number;
  y: number;
  z: number;
  rotationY: number;
  isFlying: boolean;
  hitFlash: number;
  slowTimer: number;
  shieldBrokenFlash: number;
  dodgeCooldown: number;
  dead: boolean;
  deathTimer: number;
}

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  target: number;
  rewardGold: number;
  rewardWood: number;
  metric: 'towersBuilt' | 'enemiesDefeated' | 'shieldsBroken' | 'dronesDowned' | 'level3Towers';
}

export interface QuestProgress {
  id: string;
  current: number;
  claimed: boolean;
}

export interface GameSnapshot {
  gold: number;
  wood: number;
  houseHp: number;
  maxHouseHp: number;
  wave: number;
  totalWaves: number;
  waveState: 'countdown' | 'active' | 'victory' | 'defeat';
  countdownSeconds: number;
  speedMultiplier: 1 | 2;
  paused: boolean;
  selectedBuildType: TowerType | null;
  selectedTower: TowerInstance | null;
  enemiesRemaining: number;
  score: number;
  stats: {
    towersBuilt: number;
    enemiesDefeated: number;
    shieldsBroken: number;
    dronesDowned: number;
    level3Towers: number;
  };
  minimapEnemies: Array<{ x: number; z: number; type: EnemyType }>;
  minimapTowers: Array<{ x: number; z: number; type: TowerType }>;
}
