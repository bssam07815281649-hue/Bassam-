import {arcane} from './models/arcane';
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../game/audio';
import {
  ENEMY_DEFINITIONS,
  TOWER_DEFINITIONS,
  WAVES,
} from '../game/data';
import type {
  EnemyInstance,
  EnemyType,
  GameSnapshot,
  TargetPriority,
  TowerInstance,
  TowerType,
  WaveGroup,
} from '../game/types';
import { CombatEffects } from './CombatEffects';
import { assetManager } from './assets/AssetManager';
import {enchantedForest,px,pz,toWorld} from './enchantedForest';
import { type EnvironmentRig } from './environment';
import { createSharedMaterials, detectSoftwareWebGL, type SharedMaterials } from './materials';
import { createEnemyRig, type EnemyRig } from './models/enemies';
import { type TowerRig } from './models/towers';
import { createProceduralTextures, type ProceduralTextures } from './textures';

interface ActiveTower {
  data: TowerInstance;
  rig: TowerRig;
  recoil: number;
  buildPop: number;
}

interface ActiveEnemy {
  data: EnemyInstance;
  rig: EnemyRig;
  walkPhase: number;
  dodgeOffset: number;
  hpBarCanvas: HTMLCanvasElement;
  hpBarCtx: CanvasRenderingContext2D;
  hpBarTexture: THREE.CanvasTexture;
  hpBarSprite: THREE.Sprite;
  giant?: boolean;
}

interface SpawnQueueItem {
  type: EnemyType;
  spawnAt: number; // seconds since wave start
  giant?: boolean;
}

interface FloatingLabel {
  sprite: THREE.Sprite;
  texture: THREE.CanvasTexture;
  age: number;
  lifetime: number;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();

export class GameEngine {
  private container: HTMLElement;
  private onSnapshot: (snap: GameSnapshot) => void;
  private onContextLost: (lost: boolean) => void;

  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private controls: MapControls;

  private textures: ProceduralTextures;
  private materials: SharedMaterials;
  private environment: EnvironmentRig;
  private vfx: CombatEffects;

  private towerLayerGroup = new THREE.Group();
  private enemyLayerGroup = new THREE.Group();
  private labelLayerGroup = new THREE.Group();
  private rangeIndicatorMesh: THREE.Mesh;
  private selectionRingMesh: THREE.Mesh;

  private towers = new Map<string, ActiveTower>();
  private enemies = new Map<string, ActiveEnemy>();
  private labels: FloatingLabel[] = [];
  private spawnQueue: SpawnQueueItem[] = [];
  private waveElapsed = 0;

  private raycaster = new THREE.Raycaster();
  private pointerDownPos = new THREE.Vector2();
  private hoveredPadId: string | null = null;

  // Game State
  private gold = 480;
  private wood = 140;
  private houseHp = 20;
  private maxHouseHp = 20;
  private buildsLeft=2;
  private upgradesLeft=1;
  private waveIndex = 0; // 0-indexed into WAVES
  private waveState: GameSnapshot['waveState'] = 'countdown';
  private countdownSeconds = 1;
  private speedMultiplier: 1 | 2 = 1;
  private paused = false;
  private selectedBuildType: TowerType | null = null;
  private selectedTowerId: string | null = null;
  private score = 0;
  private idCounter = 1;

  private stats = {
    towersBuilt: 0,
    enemiesDefeated: 0,
    shieldsBroken: 0,
    dronesDowned: 0,
    level3Towers: 0,
  };

  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private simTime = 0;
  private lastSnapshotTime = 0;

  constructor(
    container: HTMLElement,
    onSnapshot: (snap: GameSnapshot) => void,
    onContextLost: (lost: boolean) => void,
  ) {
    this.container = container;
    this.onSnapshot = onSnapshot;
    this.onContextLost = onContextLost;

    this.isSoftwareGl = detectSoftwareWebGL();
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, window.innerWidth < 780 ? 1.35 : 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // Scene & Atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe4cb98);
    this.scene.fog = new THREE.FogExp2(0xe8d5a8, 0.005);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Camera (Isometric miniature diorama angle)
    const aspect = Math.max(0.5, container.clientWidth / Math.max(1, container.clientHeight));
    this.camera = new THREE.OrthographicCamera(-12*aspect,12*aspect,12,-12,.1,210);
    this.camera.position.set(-6,40,Math.sqrt(5)*20);

    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.07;
    this.controls.screenSpacePanning = false;
    this.controls.enableRotate=false;
    this.controls.zoomToCursor=false;
    this.controls.minZoom=0.9;this.controls.maxZoom=2.8;
    this.controls.touches.ONE=THREE.TOUCH.PAN;
    this.controls.touches.TWO=THREE.TOUCH.DOLLY_PAN;
    this.controls.mouseButtons.LEFT=THREE.MOUSE.PAN;
    this.controls.minDistance = 16;
    this.controls.maxDistance = 58;
    this.controls.minPolarAngle = Math.PI / 6;
    this.controls.maxPolarAngle = Math.PI / 2.65;
    this.controls.target.set(0,0,0);
    this.controls.update();

    this.handleResize();
    // Lighting Rig (Warm golden sun + cool sky/earth hemisphere + gentle fill)
    const hemi = new THREE.HemisphereLight(0xcbe8ff, 0x4b5c2b, 0.85);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xffe2ae, 2.45);
    sun.position.set(20, 32, -14);
    sun.castShadow = !this.isSoftwareGl;
    sun.shadow.mapSize.set(window.innerWidth < 780 ? 1024 : 2048, window.innerWidth < 780 ? 1024 : 2048);
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 95;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);

    const rim = new THREE.DirectionalLight(0x9bd2ff, 0.55);
    rim.position.set(-24, 18, -22);
    this.scene.add(rim);

    // Assets & Environment
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    assetManager.setMaxAnisotropy(maxAnisotropy);
    this.textures = createProceduralTextures(maxAnisotropy);
    this.materials = createSharedMaterials(this.textures, this.isSoftwareGl);
    this.environment = enchantedForest();
    this.scene.add(this.environment.group);
    this.scene.add(this.towerLayerGroup);
    this.scene.add(this.enemyLayerGroup);
    this.scene.add(this.labelLayerGroup);
    this.vfx = new CombatEffects(this.scene);

    // Range & Selection indicators
    this.rangeIndicatorMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.94, 1.0, 48),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.rangeIndicatorMesh.rotation.x = -Math.PI / 2;
    this.rangeIndicatorMesh.visible = false;
    this.scene.add(this.rangeIndicatorMesh);

    this.selectionRingMesh = new THREE.Mesh(
      new THREE.RingGeometry(1.15, 1.35, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.selectionRingMesh.rotation.x = -Math.PI / 2;
    this.selectionRingMesh.visible = false;
    this.scene.add(this.selectionRingMesh);

    // Pre-warm shaders on hardware WebGL
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.restoreCheckpoint();
    this.bindEvents();
    this.emitSnapshot(true);
    this.scheduleNextTick();
  }

  private bindEvents(): void {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', this.handlePointerDown);
    dom.addEventListener('pointerup', this.handlePointerUp);
    dom.addEventListener('pointermove', this.handlePointerMove);
    dom.addEventListener('webglcontextlost', this.handleContextLost);
    dom.addEventListener('webglcontextrestored', this.handleContextRestored);
    window.addEventListener('resize', this.handleResize);
  }

  private unbindEvents(): void {
    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.handlePointerDown);
    dom.removeEventListener('pointerup', this.handlePointerUp);
    dom.removeEventListener('pointermove', this.handlePointerMove);
    dom.removeEventListener('webglcontextlost', this.handleContextLost);
    dom.removeEventListener('webglcontextrestored', this.handleContextRestored);
    window.removeEventListener('resize', this.handleResize);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.onContextLost(true);
  };

  private handleContextRestored = (): void => {
    this.onContextLost(false);
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth;
    const h = Math.max(1, this.container.clientHeight);
    const aspect=w/h;
    const half=Math.min(19,(390/px)/aspect);
    this.camera.top=half;this.camera.bottom=-half;this.camera.left=-half*aspect;this.camera.right=half*aspect;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private handlePointerDown = (e: PointerEvent): void => {
    soundEngine.unlock();
    this.pointerDownPos.set(e.clientX, e.clientY);
  };

  private ghost?:{type:TowerType;root:THREE.Group};
  private placement: {point:THREE.Vector3; valid:boolean}|null=null;
  public previewBuild(x:number,y:number,type:TowerType):void {
    const rect=this.renderer.domElement.getBoundingClientRect();
    this.raycaster.layers.set(0);
    this.raycaster.setFromCamera(new THREE.Vector2((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2),this.camera);
    const hit=this.raycaster.intersectObject(this.environment.ground,false)[0];
    this.placement=hit?{point:hit.point,valid:this.buildsLeft>0&&this.environment.canBuild(hit.point.x,hit.point.z)&&
      !Array.from(this.towers.values()).some(t=>Math.hypot(t.data.x-hit.point.x,t.data.z-hit.point.z)<2.4)&&this.gold>=TOWER_DEFINITIONS[type].costGold}:null;
    if(hit){
      if(this.ghost?.type!==type){
        this.ghost?.root.removeFromParent();
        const root=arcane(type,1).root;
        this.ghost={type,root};this.scene.add(root);
      }
      this.ghost.root.position.copy(hit.point);
    }
    this.updateIndicators();
  }
  public dropBuild(x:number,y:number,type:TowerType):void {
    this.previewBuild(x,y,type);
    const spot=this.placement;this.placement=null;
    if(!spot?.valid)return;
    const pad=this.environment.addPad({id:'ground-'+this.idCounter++,x:spot.point.x,z:spot.point.z});
    this.buildTowerAtPad(pad.id,type);
  }
  private handlePointerMove = (e: PointerEvent): void => {
    if (this.disposed) return;
    if(this.selectedBuildType){this.previewBuild(e.clientX,e.clientY,this.selectedBuildType);return;}
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.layers.set(1);
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hitTargets = this.environment.buildPads.map((p) => p.hitMesh);
    const hits = this.raycaster.intersectObjects(hitTargets, false);
    if (hits.length > 0) {
      this.hoveredPadId = hits[0].object.userData.padId as string;
      this.renderer.domElement.style.cursor = 'pointer';
    } else {
      this.hoveredPadId = null;
      this.renderer.domElement.style.cursor = 'grab';
    }
  };

  private handlePointerUp = (e: PointerEvent): void => {
    const dist = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (dist > 9) return; // Was a camera pan/drag, not a tap/click

    if(this.selectedBuildType){this.dropBuild(e.clientX,e.clientY,this.selectedBuildType);return;}
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.layers.set(1);
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const hitTargets = this.environment.buildPads.map((p) => p.hitMesh);
    const hits = this.raycaster.intersectObjects(hitTargets, false);

    if (hits.length === 0) {
      this.selectedTowerId = null;
      this.updateIndicators();
      this.emitSnapshot(true);
      return;
    }

    const padId = hits[0].object.userData.padId as string;
    const pad = this.environment.buildPads.find((p) => p.id === padId);
    if (!pad) return;

    // Check if pad already has a tower
    const existing = Array.from(this.towers.values()).find((t) => t.data.padId === padId);
    if (existing) {
      this.selectedTowerId = existing.data.id;
      this.selectedBuildType = null;
      this.updateIndicators();
      this.emitSnapshot(true);
      return;
    }

    // Build tower if a build type is selected
    if (this.selectedBuildType) {
      this.buildTowerAtPad(pad.id, this.selectedBuildType);
    } else {
      this.selectedTowerId = null;
      this.updateIndicators();
      this.emitSnapshot(true);
    }
  };

  // Public Controls API
  public setSelectedBuildType(type: TowerType | null): void {
    soundEngine.unlock();
    this.selectedBuildType = type;this.placement=null;
    if (this.selectedBuildType) {
      this.selectedTowerId = null;
    }
    this.updateIndicators();
    this.emitSnapshot(true);
  }

  public clearSelection(): void {
    this.selectedTowerId = null;
    this.selectedBuildType = null;
    this.updateIndicators();
    this.emitSnapshot(true);
  }

  public setSpeedMultiplier(mult: 1 | 2): void {
    this.speedMultiplier = mult;
    this.emitSnapshot(true);
  }

  public togglePause(): void {
    this.paused = !this.paused;
    this.emitSnapshot(true);
  }

  public startNextWaveNow(): void {
    soundEngine.unlock();
    if (this.waveState !== 'countdown') return;
    const bonus = Math.ceil(this.countdownSeconds * 2);
    this.gold += bonus;
    this.beginWave(this.waveIndex);
    this.emitSnapshot(true);
  }

  public zoomBy(factor:number):void {this.camera.zoom=THREE.MathUtils.clamp(this.camera.zoom*factor,0.9,2.8);this.camera.updateProjectionMatrix();this.boundCamera();}
  public resetCamera(): void {
    this.camera.zoom=1;this.camera.updateProjectionMatrix();
    this.camera.position.set(-6,40,Math.sqrt(5)*20);
    this.controls.target.set(0,0,0);
    this.controls.update();
  }

  public grantQuestReward(goldAmount: number, woodAmount: number): void {
    this.gold += goldAmount;
    this.wood += woodAmount;
    soundEngine.playBuild();
    this.emitSnapshot(true);
  }

  public buildTowerAtPad(padId: string, type: TowerType): boolean {
    const pad = this.environment.buildPads.find((p) => p.id === padId);
    if (!pad || pad.occupied || this.buildsLeft<=0) return false;
    const def = TOWER_DEFINITIONS[type];
    if (this.gold < def.costGold || this.wood < def.costWood) {
      return false;
    }

    this.gold -= def.costGold;
    this.wood -= def.costWood;
    pad.occupied = true;this.buildsLeft--;

    const rig = arcane(type,1);
    const id = `tower-${this.idCounter++}`;
    const data: TowerInstance = {
      id,
      padId: pad.id,
      type,
      level: 1,
      x: pad.x,
      y: pad.group.position.y + 0.1,
      z: pad.z,
      turretYaw: 0,
      modelSource: rig.isExternalGLB ? 'glb' : 'procedural',
      cooldown: 0,
      priority: 'first',
      kills: 0,
      totalDamage: 0,
      investedGold: def.costGold,
      investedWood: def.costWood,
    };

    rig.root.position.set(data.x, data.y, data.z);
    rig.root.scale.setScalar(0.1);
    this.towerLayerGroup.add(rig.root);

    this.towers.set(id, { data, rig, recoil: 0, buildPop: 1 });
    this.stats.towersBuilt += 1;
    this.selectedTowerId = id;
    this.selectedBuildType = null;
    soundEngine.playBuild();
    this.updateIndicators();
    this.emitSnapshot(true);
    return true;
  }

  public upgradeSelectedTower(): boolean {
    if (!this.selectedTowerId || this.upgradesLeft<=0) return false;
    const active = this.towers.get(this.selectedTowerId);
    if (!active || active.data.level >= 3) return false;

    const def = TOWER_DEFINITIONS[active.data.type];
    const nextLevel = (active.data.level + 1) as 2 | 3;
    const nextStats = def.levels[nextLevel - 1];

    if (this.gold < nextStats.upgradeGold || this.wood < nextStats.upgradeWood) {
      return false;
    }

    this.gold -= nextStats.upgradeGold;
    this.wood -= nextStats.upgradeWood;
    active.data.level = nextLevel;this.upgradesLeft--;
    active.data.investedGold += nextStats.upgradeGold;
    active.data.investedWood += nextStats.upgradeWood;
    if (nextLevel === 3) {
      this.stats.level3Towers += 1;
    }

    // Replace 3D rig with upgraded tier model preserving Turret node yaw!
    const prevRotY = active.rig.turretHead.rotation.y;
    active.data.turretYaw = prevRotY;
    active.rig.mixer?.stopAllAction();
    this.towerLayerGroup.remove(active.rig.root);
    const newRig = arcane(active.data.type,nextLevel);
    newRig.root.position.set(active.data.x, active.data.y, active.data.z);
    newRig.turretHead.rotation.y = prevRotY;
    this.towerLayerGroup.add(newRig.root);
    active.rig = newRig;
    active.data.modelSource = newRig.isExternalGLB ? 'glb' : 'procedural';
    active.buildPop = 1;

    soundEngine.playBuild();
    this.spawnFloatingLabel(active.data.x, active.data.y + 2.4, active.data.z, `LVL ${nextLevel}!`, '#fde047');
    this.updateIndicators();
    this.emitSnapshot(true);
    return true;
  }

  public setSelectedTowerPriority(priority: TargetPriority): void {
    if (!this.selectedTowerId) return;
    const active = this.towers.get(this.selectedTowerId);
    if (!active) return;
    active.data.priority = priority;
    this.emitSnapshot(true);
  }

  public sellSelectedTower(): void {
    if (!this.selectedTowerId) return;
    const active = this.towers.get(this.selectedTowerId);
    if (!active) return;

    const refundGold = Math.round(active.data.investedGold * 0.75);
    const refundWood = Math.round(active.data.investedWood * 0.75);
    this.gold += refundGold;
    this.wood += refundWood;

    const pad = this.environment.buildPads.find((p) => p.id === active.data.padId);
    if (pad) pad.occupied = false;

    active.rig.mixer?.stopAllAction();
    this.towerLayerGroup.remove(active.rig.root);
    this.towers.delete(active.data.id);
    this.selectedTowerId = null;
    soundEngine.playBuild();
    this.updateIndicators();
    this.emitSnapshot(true);
  }

  public restartGame(): void {
    // Clear towers
    this.towers.forEach((t) => {
      t.rig.mixer?.stopAllAction();
      this.towerLayerGroup.remove(t.rig.root);
    });
    this.towers.clear();
    this.environment.buildPads.forEach((p) => (p.occupied = false));

    // Clear enemies
    this.enemies.forEach((e) => {
      e.rig.mixer?.stopAllAction();
      this.enemyLayerGroup.remove(e.rig.root);
      e.hpBarTexture.dispose();
    });
    this.enemies.clear();
    this.spawnQueue = [];

    this.gold = 480;
    this.wood = 140;
    this.houseHp = 20;
    this.waveIndex = 0;this.buildsLeft=2;this.upgradesLeft=1;
    this.waveState = 'countdown';
    this.countdownSeconds = 1;
    this.paused = false;
    this.selectedBuildType = null;
    this.selectedTowerId = null;
    this.score = 0;
    this.stats = {
      towersBuilt: 0,
      enemiesDefeated: 0,
      shieldsBroken: 0,
      dronesDowned: 0,
      level3Towers: 0,
    };

    this.updateIndicators();
    this.emitSnapshot(true);
  }

  public rebuildAllCustomModels(): void {
    // Rebuild environment (house, props) and live towers/enemies after GLB load
    this.scene.remove(this.environment.group);
    this.environment.dispose();
    this.environment = enchantedForest();
    this.scene.add(this.environment.group);

    this.towers.forEach((active) => {
      const pad=this.environment.addPad({id:active.data.padId,x:active.data.x,z:active.data.z});
      pad.occupied=true;
      const rot = active.rig.turretHead.rotation.y;
      active.data.turretYaw = rot;
      active.rig.mixer?.stopAllAction();
      this.towerLayerGroup.remove(active.rig.root);
      const rig = arcane(active.data.type,active.data.level);
      rig.root.position.set(active.data.x, active.data.y, active.data.z);
      rig.turretHead.rotation.y = rot;
      this.towerLayerGroup.add(rig.root);
      active.rig = rig;
      active.data.modelSource = rig.isExternalGLB ? 'glb' : 'procedural';
    });

    this.enemies.forEach((active) => {
      active.rig.mixer?.stopAllAction();
      this.enemyLayerGroup.remove(active.rig.root);
      const rig = createEnemyRig(active.data.type, this.materials);
      rig.root.scale.setScalar(active.giant ? 1.95 : 1.35);
      rig.root.position.set(active.data.x, active.data.y, active.data.z);
      rig.root.rotation.y = active.data.rotationY;
      if (active.data.shield <= 0) {
        if (rig.shieldBubble) rig.shieldBubble.visible = false;
        if (rig.shieldWire) rig.shieldWire.visible = false;
      }
      rig.root.add(active.hpBarSprite);
      this.enemyLayerGroup.add(rig.root);
      active.rig = rig;
    });
  }

  private beginWave(index: number): void {
    const wave = WAVES[index];
    if (!wave) return;
    this.waveState = 'active';
    this.waveElapsed = 0;
    this.spawnQueue = [];

    wave.groups.forEach((grp: WaveGroup) => {
      for (let i = 0; i < grp.count; i++) {
        this.spawnQueue.push({
          type: grp.type,
          spawnAt: grp.delay + i * grp.interval,
        });
      }
    });
    if (index >= 3 && index % 2 === 1) this.spawnQueue.push({type: 'heavy', spawnAt: 9 + index * 0.8, giant: true});
    this.spawnQueue.sort((a, b) => a.spawnAt - b.spawnAt);
    soundEngine.playWaveHorn();
  }

  private spawnEnemy(type: EnemyType, giant = false): void {
    const def = ENEMY_DEFINITIONS[type];
    const waveScale = 1 + this.waveIndex * 0.17;
    const maxHp = Math.round(def.maxHp * waveScale * (giant ? 4.5 : 1));
    const maxShield = Math.round(def.maxShield * (1 + this.waveIndex * 0.08));

    const startPt = this.environment.roadCurve.getPointAt(0);
    const id = `enemy-${this.idCounter++}`;
    const data: EnemyInstance = {
      id,
      type,
      hp: maxHp,
      maxHp,
      shield: maxShield,
      maxShield,
      pathProgress: 0,
      speed: giant ? def.speed * 0.72 : def.speed,
      x: startPt.x,
      y: 0,
      z: startPt.z,
      rotationY: 0,
      isFlying: def.isFlying,
      hitFlash: 0,
      slowTimer: 0,
      shieldBrokenFlash: 0,
      dodgeCooldown: 0,
      dead: false,
      deathTimer: 0,
    };

    const rig = createEnemyRig(type, this.materials);
    rig.root.position.set(data.x, data.y, data.z);
    rig.root.scale.setScalar(giant ? 1.95 : 1.35);
    this.enemyLayerGroup.add(rig.root);

    // Floating crisp HP + Shield bar sprite
    const hpBarCanvas = document.createElement('canvas');
    hpBarCanvas.width = 128;
    hpBarCanvas.height = 28;
    const hpBarCtx = hpBarCanvas.getContext('2d')!;
    const hpBarTexture = new THREE.CanvasTexture(hpBarCanvas);
    const hpBarSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: hpBarTexture, transparent: true, depthTest: false }),
    );
    hpBarSprite.position.set(0, def.isFlying ? 3.25 : 1.78, 0);
    hpBarSprite.scale.set(1.25, 0.28, 1);
    hpBarSprite.renderOrder = 20;
    rig.root.add(hpBarSprite);

    const active: ActiveEnemy = {
      data,
      rig,
      walkPhase: Math.random() * Math.PI * 2,
      dodgeOffset: 0,
      hpBarCanvas,
      hpBarCtx,
      hpBarTexture,
      hpBarSprite,
      giant,
    };
    this.redrawHealthBar(active);
    this.enemies.set(id, active);
  }

  private redrawHealthBar(e: ActiveEnemy): void {
    const { hp, maxHp, shield, maxShield } = e.data;
    const show = hp < maxHp || shield > 0;
    e.hpBarSprite.visible = show && !e.data.dead;
    if (!show) return;

    const ctx = e.hpBarCtx;
    ctx.clearRect(0, 0, 128, 28);

    // Background pill frame
    ctx.fillStyle = 'rgba(15, 20, 18, 0.86)';
    ctx.beginPath();
    ctx.roundRect(4, 6, 120, maxShield > 0 ? 18 : 12, 4);
    ctx.fill();

    // HP bar
    const hpFrac = Math.max(0, Math.min(1, hp / maxHp));
    ctx.fillStyle = hpFrac > 0.5 ? '#22c55e' : hpFrac > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(7, 9, Math.round(114 * hpFrac), 6);

    // Energy Shield bar underneath
    if (maxShield > 0) {
      const shFrac = Math.max(0, Math.min(1, shield / maxShield));
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(7, 17, Math.round(114 * shFrac), 4);
    }

    e.hpBarTexture.needsUpdate = true;
  }

  private spawnFloatingLabel(x: number, y: number, z: number, text: string, color: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.font = 'bold 28px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.lineWidth = 6;
    ctx.strokeText(text, 128, 32);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(2.2, 0.55, 1);
    sprite.renderOrder = 30;
    this.labelLayerGroup.add(sprite);

    this.labels.push({ sprite, texture, age: 0, lifetime: 0.85 });
  }

  private applyDamage(
    target: ActiveEnemy,
    rawDamage: number,
    sourceTower: ActiveTower,
    damageType: TowerType,
    shieldMult = 1,
  ): void {
    if (target.data.dead) return;
    const eDef = ENEMY_DEFINITIONS[target.data.type];
    let dmg = rawDamage;

    // 1. Check Energy Shield first (Shielded Vanguard)
    if (target.data.shield > 0) {
      let effShieldMult = shieldMult;
      if (damageType === 'gun') effShieldMult = 0.25;
      else if (damageType === 'cannon') effShieldMult = 0.35;
      else if (damageType === 'sniper') effShieldMult = 0.5;

      const shieldDmg = dmg * effShieldMult;
      target.data.shield -= shieldDmg;
      sourceTower.data.totalDamage += shieldDmg;

      if (target.data.shield <= 0) {
        const overflow = Math.abs(target.data.shield) * 0.4;
        target.data.shield = 0;
        if (target.rig.shieldBubble) target.rig.shieldBubble.visible = false;
        if (target.rig.shieldWire) target.rig.shieldWire.visible = false;
        this.stats.shieldsBroken += 1;
        soundEngine.playShieldBreak();
        this.vfx.spawnShieldBreakBurst(new THREE.Vector3(target.data.x, 0.85, target.data.z));
        this.spawnFloatingLabel(target.data.x, 2.0, target.data.z, 'SHIELD BROKEN!', '#38bdf8');
        dmg = overflow;
      } else {
        target.data.hitFlash = 0.1;
        this.redrawHealthBar(target);
        return;
      }
    }

    // 2. Check Heavy Armor bullet deflection vs Gun Turret
    if (damageType === 'gun' && eDef.gunDeflectFactor < 0.5) {
      dmg *= eDef.gunDeflectFactor;
      soundEngine.playRicochet();
      this.vfx.spawnRicochetSparks(new THREE.Vector3(target.data.x, 0.9, target.data.z));
      if (Math.random() < 0.28) {
        this.spawnFloatingLabel(target.data.x, 1.85, target.data.z, 'DEFLECT', '#94a3b8');
      }
    } else if (damageType === 'sniper' && target.data.type === 'heavy') {
      dmg *= 1.5; // Armor piercing!
    } else if (damageType === 'sniper' && target.data.type === 'drone') {
      dmg *= 1.6;
    } else if (damageType === 'lightning' && target.data.type === 'drone') {
      dmg *= 1.75;
    } else if (damageType === 'cannon' && target.data.type === 'heavy') {
      dmg *= 1.35;
    }

    target.data.hp -= dmg;
    target.data.hitFlash = 0.12;
    sourceTower.data.totalDamage += dmg;

    if (target.data.hp <= 0) {
      target.data.hp = 0;
      target.data.dead = true;
      if (target.rig.deathAction) {
        target.rig.locomotionAction?.fadeOut(0.1);
        target.rig.deathAction.reset().play();
        target.data.deathTimer = Math.max(0.45, Math.min(1.2, target.rig.deathAction.getClip().duration));
      } else {
        target.data.deathTimer = 0.38;
      }
      sourceTower.data.kills += 1;
      this.gold += eDef.rewardGold;
      this.wood += eDef.rewardWood;
      this.score += eDef.rewardGold * 10;
      this.stats.enemiesDefeated += 1;
      if (target.data.type === 'drone') this.stats.dronesDowned += 1;
      target.hpBarSprite.visible = false;
    } else {
      this.redrawHealthBar(target);
    }
  }

  private findTarget(tower: ActiveTower): ActiveEnemy | null {
    const def = TOWER_DEFINITIONS[tower.data.type];
    const lvl = def.levels[tower.data.level - 1];
    const rangeSq = lvl.range * lvl.range;

    let best: ActiveEnemy | null = null;
    let bestMetric = -Infinity;

    this.enemies.forEach((enemy) => {
      if (enemy.data.dead) return;
      if (enemy.data.isFlying && !def.canHitAir) return;
      if (!enemy.data.isFlying && !def.canHitGround) return;

      const dx = enemy.data.x - tower.data.x;
      const dz = enemy.data.z - tower.data.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > rangeSq) return;

      let metric = 0;
      if (tower.data.priority === 'first') {
        metric = enemy.data.pathProgress;
      } else if (tower.data.priority === 'strongest') {
        metric = enemy.data.hp + enemy.data.shield;
      } else {
        metric = -distSq;
      }

      if (metric > bestMetric) {
        bestMetric = metric;
        best = enemy;
      }
    });

    return best;
  }

  private aimPoint(tower:ActiveTower,target:ActiveEnemy):THREE.Vector3{
    const def=TOWER_DEFINITIONS[tower.data.type];
    if(tower.data.type!=='cannon' && tower.data.type!=='gun')
      return new THREE.Vector3(target.data.x,target.data.isFlying?2.35:.72,target.data.z);
    const curve=this.environment.roadCurve;
    const seconds=Math.hypot(target.data.x-tower.data.x,target.data.z-tower.data.z)/def.projectileSpeed;
    const next=curve.getPointAt(Math.min(1,target.data.pathProgress+seconds*target.data.speed/curve.getLength()));
    const now=curve.getPointAt(target.data.pathProgress);
    return new THREE.Vector3(target.data.x+next.x-now.x,target.data.isFlying?2.35:.72,target.data.z+next.z-now.z);
  }
  private fireTower(tower: ActiveTower, target: ActiveEnemy): void {
    const def = TOWER_DEFINITIONS[tower.data.type];
    const lvl = def.levels[tower.data.level - 1];

    // Calculate world-space muzzle origin directly from the mapped 'Muzzle' node (with local fallback)
    if (tower.rig.muzzleNode) {
      tower.rig.root.updateMatrixWorld(true);
      tower.rig.muzzleNode.getWorldPosition(_vec3A);
    } else {
      _vec3A.copy(tower.rig.muzzleLocal);
      _vec3A.applyAxisAngle(_vec3C.set(0, 1, 0), tower.rig.turretHead.rotation.y);
      _vec3A.add(tower.rig.root.position);
    }

    const targetPos=this.aimPoint(tower,target);
    tower.recoil = 1.0;
    tower.rig.onFire?.();

    if (tower.data.type === 'gun') {
      soundEngine.playGunShot();
      this.vfx.spawnMuzzleFlash(_vec3A, 0xfbbf24, 0.25);
      const targetId = target.data.id;
      this.vfx.spawnBullet(_vec3A, targetPos, def.projectileSpeed, () => {
        const liveTarget = this.enemies.get(targetId);
        if (liveTarget) {
          this.applyDamage(liveTarget, lvl.damage, tower, 'gun');
        }
      });
    } else if (tower.data.type === 'cannon') {
      soundEngine.playCannonShot();
      this.vfx.spawnMuzzleFlash(_vec3A, 0xff6b1a, 0.45);
      const impactPoint = targetPos.clone();
      impactPoint.y = 0.2;
      const splashRad = lvl.splashRadius || 3.0;
      this.vfx.spawnCannonball(_vec3A, impactPoint, def.projectileSpeed, () => {
        soundEngine.playExplosion();
        this.vfx.spawnExplosion(impactPoint, splashRad);

        // Splash damage to ground enemies within radius
        this.enemies.forEach((e) => {
          if (e.data.dead || e.data.isFlying) return;
          const d = Math.hypot(e.data.x - impactPoint.x, e.data.z - impactPoint.z);
          if (d <= splashRad) {
            const eDef = ENEMY_DEFINITIONS[e.data.type];
            if (eDef.cannonDodgeChance > 0 && Math.random() < eDef.cannonDodgeChance && e.data.dodgeCooldown <= 0) {
              e.data.dodgeCooldown = 1.1;
              e.dodgeOffset = (Math.random() > 0.5 ? 1 : -1) * 0.75;
              this.vfx.spawnDodgePuff(new THREE.Vector3(e.data.x, 0.5, e.data.z));
              this.spawnFloatingLabel(e.data.x, 1.85, e.data.z, 'DODGE!', '#f97316');
              return;
            }
            const falloff = Math.max(0.45, 1 - (d / splashRad) * 0.45);
            this.applyDamage(e, lvl.damage * falloff, tower, 'cannon');
          }
        });
      });
    } else if (tower.data.type === 'sniper') {
      soundEngine.playSniperShot();
      this.vfx.spawnSniperBeam(_vec3A, targetPos);
      this.applyDamage(target, lvl.damage, tower, 'sniper');
    } else if (tower.data.type === 'lightning') {
      soundEngine.playLightningZap();
      const shieldMult = lvl.shieldDamageMult || 3.8;
      this.vfx.spawnLightningArc(_vec3A, targetPos);
      this.applyDamage(target, lvl.damage, tower, 'lightning', shieldMult);

      // Chain lightning hops to nearby enemies!
      const chainCount = lvl.chainCount || 1;
      if (chainCount > 0) {
        const hitIds = new Set<string>([target.data.id]);
        let lastPos = targetPos.clone();
        for (let hop = 0; hop < chainCount; hop++) {
          let nearest: ActiveEnemy | null = null;
          let nearDist = 4.5;
          this.enemies.forEach((cand) => {
            if (cand.data.dead || hitIds.has(cand.data.id)) return;
            const d = Math.hypot(cand.data.x - lastPos.x, cand.data.z - lastPos.z);
            if (d < nearDist) {
              nearDist = d;
              nearest = cand;
            }
          });
          if (!nearest) break;
          const n = nearest as ActiveEnemy;
          hitIds.add(n.data.id);
          const nPos = new THREE.Vector3(n.data.x, n.data.isFlying ? 2.35 : 0.72, n.data.z);
          this.vfx.spawnLightningArc(lastPos, nPos);
          this.applyDamage(n, lvl.damage * 0.65, tower, 'lightning', shieldMult);
          lastPos = nPos;
        }
      }
    }
  }

  private updateIndicators(): void {
    if(this.ghost)this.ghost.root.visible=Boolean(this.placement&&this.selectedBuildType);
    const material=this.rangeIndicatorMesh.material as THREE.MeshBasicMaterial;
    if(this.placement && this.selectedBuildType){
      const {point,valid}=this.placement;
      this.rangeIndicatorMesh.position.copy(point);this.rangeIndicatorMesh.position.y+=.15;
      this.rangeIndicatorMesh.scale.setScalar(TOWER_DEFINITIONS[this.selectedBuildType].levels[0].range);
      material.color.setHex(valid?0x64ee90:0xff5252);this.rangeIndicatorMesh.visible=true;
      this.selectionRingMesh.position.copy(point);this.selectionRingMesh.position.y+=.16;this.selectionRingMesh.visible=true;return;
    }
    material.color.setHex(0x38bdf8);
    // Selected tower range & selection circle
    const sel = this.selectedTowerId ? this.towers.get(this.selectedTowerId) : undefined;
    if (sel) {
      const def = TOWER_DEFINITIONS[sel.data.type];
      const lvl = def.levels[sel.data.level - 1];
      this.rangeIndicatorMesh.visible = true;
      this.rangeIndicatorMesh.position.set(sel.data.x, sel.data.y + 0.08, sel.data.z);
      this.rangeIndicatorMesh.scale.setScalar(lvl.range);

      this.selectionRingMesh.visible = true;
      this.selectionRingMesh.position.set(sel.data.x, sel.data.y + 0.07, sel.data.z);
    } else {
      this.rangeIndicatorMesh.visible = false;
      this.selectionRingMesh.visible = false;
    }
  }

  private stepSimulation(dt: number): void {
    const simDt = this.paused ? 0 : dt * this.speedMultiplier;
    this.simTime += dt;

    // Environment animations (water, flag, chimney smoke)
    this.environment.update(this.simTime, dt * (this.paused ? 0.2 : this.speedMultiplier));
    this.updateIndicators();

    if (this.paused || this.waveState === 'victory' || this.waveState === 'defeat') {
      return;
    }

    // Wave countdown / active spawn
    if (this.waveState === 'countdown') {
      this.countdownSeconds -= simDt;
      if (this.countdownSeconds <= 0) {
        this.countdownSeconds = 0;
        this.beginWave(this.waveIndex);
      }
    } else if (this.waveState === 'active') {
      this.waveElapsed += simDt;
      while (this.spawnQueue.length > 0 && this.spawnQueue[0].spawnAt <= this.waveElapsed) {
        const next = this.spawnQueue.shift()!;
        this.spawnEnemy(next.type, !!next.giant);
      }
    }

    // Update Towers
    this.towers.forEach((tower) => {
      if (tower.buildPop > 0) {
        tower.buildPop = Math.max(0, tower.buildPop - dt * 4.5);
        const s = 1 + Math.sin((1 - tower.buildPop) * Math.PI) * 0.14;
        tower.rig.root.scale.setScalar(tower.buildPop > 0.7 ? 0.5 + (1 - tower.buildPop) * 1.6 : s);
      } else {
        tower.rig.root.scale.setScalar(1);
      }

      // Recoil spring back & optional GLTF AnimationMixer
      if (tower.recoil > 0) {
        tower.recoil = Math.max(0, tower.recoil - dt * 6.5);
      }
      tower.rig.recoilGroup.position.z = -tower.recoil * 0.16;
      tower.rig.mixer?.update(simDt);

      // Ambient crystal / electric ring animations on Lightning Tower
      if (tower.rig.crystal) {
        tower.rig.crystal.rotation.y += simDt * 1.8;
      }
      if (tower.rig.electricRings) {
        tower.rig.electricRings.forEach((r, idx) => {
          r.rotation.y += simDt * (idx === 0 ? 2.5 : -3.1);
          r.rotation.z += simDt * 1.1;
        });
      }

      // Target acquisition & firing
      tower.data.cooldown -= simDt;
      const target = this.findTarget(tower);
      if (target) {
        const aim=this.aimPoint(tower,target);
        const desiredYaw=Math.atan2(aim.x-tower.data.x,aim.z-tower.data.z);
        let diff = desiredYaw - tower.rig.turretHead.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        tower.rig.turretHead.rotation.y += diff * Math.min(1, simDt * 11);
        tower.data.turretYaw = tower.rig.turretHead.rotation.y;

        if (tower.rig.rotaryBarrels && tower.data.type === 'gun') {
          tower.rig.rotaryBarrels.forEach((b) => {
            b.rotation.z += simDt * 16;
          });
        }

        if (tower.data.cooldown <= 0 && Math.abs(diff) < 0.055) {
          const def = TOWER_DEFINITIONS[tower.data.type];
          const lvl = def.levels[tower.data.level - 1];
          tower.data.cooldown = 1 / lvl.fireRate;
          this.fireTower(tower, target);
        }
      }
    });

    // Update Enemies
    const roadLen = this.environment.roadCurve.getLength();
    this.enemies.forEach((enemy, id) => {
      if (enemy.data.dead) {
        enemy.data.deathTimer -= simDt;
        if (enemy.rig.deathAction && enemy.rig.mixer) {
          enemy.rig.mixer.update(simDt);
          if (enemy.data.deathTimer < 0.2) {
            enemy.rig.root.position.y -= simDt * 1.2;
          }
        } else {
          const t = Math.max(0, enemy.data.deathTimer / 0.38);
          enemy.rig.root.scale.setScalar(t);
          enemy.rig.root.position.y -= simDt * 1.2;
        }
        if (enemy.data.deathTimer <= 0) {
          enemy.rig.mixer?.stopAllAction();
          this.enemyLayerGroup.remove(enemy.rig.root);
          enemy.hpBarTexture.dispose();
          this.enemies.delete(id);
        }
        return;
      }

      if (enemy.data.dodgeCooldown > 0) enemy.data.dodgeCooldown -= simDt;
      enemy.dodgeOffset = THREE.MathUtils.damp(enemy.dodgeOffset, 0, 7, simDt);

      // Advance along road curve
      const progressStep = (enemy.data.speed * simDt) / roadLen;
      enemy.data.pathProgress += progressStep;

      if (enemy.data.pathProgress >= 1) {
        const eDef = ENEMY_DEFINITIONS[enemy.data.type];
        this.houseHp = Math.max(0, this.houseHp - eDef.houseDamage);
        soundEngine.playHouseHit();
        this.vfx.spawnExplosion(toWorld(639,125).setY(.8),1.8);
        enemy.rig.mixer?.stopAllAction();
        this.enemyLayerGroup.remove(enemy.rig.root);
        enemy.hpBarTexture.dispose();
        this.enemies.delete(id);

        if (this.houseHp <= 0) {
          this.waveState = 'defeat';
          this.emitSnapshot(true);
        }
        return;
      }

      const pt = this.environment.roadCurve.getPointAt(enemy.data.pathProgress, _vec3A);
      const tan = this.environment.roadCurve.getTangentAt(enemy.data.pathProgress, _vec3B);
      const sideX = -tan.z * enemy.dodgeOffset;
      const sideZ = tan.x * enemy.dodgeOffset;

      enemy.data.x = pt.x + sideX;
      enemy.data.z = pt.z + sideZ;
      enemy.data.rotationY = Math.atan2(tan.x, tan.z);

      enemy.rig.root.position.set(enemy.data.x, 0.05, enemy.data.z);
      enemy.rig.root.rotation.y = enemy.data.rotationY;

      // Animate GLB AnimationMixer or procedural fallback limbs / scarf / rotors / energy shield
      enemy.walkPhase += simDt * enemy.data.speed * 3.4;
      if (enemy.rig.mixer) {
        if (enemy.rig.locomotionAction) {
          const baseSpeed = ENEMY_DEFINITIONS[enemy.data.type].speed || 1;
          enemy.rig.locomotionAction.timeScale = Math.max(0.4, enemy.data.speed / baseSpeed);
        }
        enemy.rig.mixer.update(simDt);
      }

      if (!enemy.rig.isExternalGLB) {
        const stride = Math.sin(enemy.walkPhase);

        if (enemy.rig.leftLeg && enemy.rig.rightLeg) {
          enemy.rig.leftLeg.rotation.x = stride * 0.65;
          enemy.rig.rightLeg.rotation.x = -stride * 0.65;
          enemy.rig.bodyGroup.position.y = Math.abs(stride) * 0.06;
        }
        if (enemy.rig.scarfSegments) {
          enemy.rig.scarfSegments.forEach((seg, idx) => {
            seg.position.x = Math.sin(enemy.walkPhase * 1.4 - idx * 0.9) * 0.06 * (idx + 1);
            seg.rotation.y = Math.sin(enemy.walkPhase * 1.4 - idx) * 0.22;
          });
        }
        if (enemy.rig.rotors) {
          enemy.rig.bodyGroup.position.y = 2.35 + Math.sin(this.simTime * 4.5 + enemy.walkPhase) * 0.14;
          enemy.rig.bodyGroup.rotation.x = 0.14;
          enemy.rig.rotors.forEach((r) => {
            r.rotation.y += simDt * 28;
          });
        }
      } else if (enemy.data.isFlying) {
        enemy.rig.bodyGroup.position.y = Math.sin(this.simTime * 4.5 + enemy.walkPhase) * 0.12;
      }

      if (enemy.rig.shieldBubble && enemy.rig.shieldWire && enemy.data.shield > 0) {
        enemy.rig.shieldBubble.rotation.y += simDt * 1.2;
        enemy.rig.shieldWire.rotation.y -= simDt * 1.6;
      }

      // Hit flash feedback
      if (enemy.data.hitFlash > 0) {
        enemy.data.hitFlash -= simDt;
        enemy.rig.hitMaterials.forEach((m) => m.emissive.setHex(0xffffff));
      } else {
        enemy.rig.hitMaterials.forEach((m) => m.emissive.setHex(0x000000));
      }
    });

    // Update combat effects & floating labels
    this.vfx.update(simDt);
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const lbl = this.labels[i];
      lbl.age += simDt;
      lbl.sprite.position.y += simDt * 1.1;
      const mat = lbl.sprite.material as THREE.SpriteMaterial;
      mat.opacity = Math.max(0, 1 - lbl.age / lbl.lifetime);
      if (lbl.age >= lbl.lifetime) {
        this.labelLayerGroup.remove(lbl.sprite);
        lbl.texture.dispose();
        mat.dispose();
        this.labels.splice(i, 1);
      }
    }

    // Check Wave Completion
    if (this.waveState === 'active' && this.spawnQueue.length === 0 && this.enemies.size === 0 && this.houseHp > 0) {
      const finishedWave = WAVES[this.waveIndex];
      if (finishedWave) {
        this.gold += finishedWave.bonusGold;
        this.wood += finishedWave.bonusWood;
      }
      if (this.waveIndex >= WAVES.length - 1) {
        this.waveState = 'victory';
      } else {
        this.waveIndex += 1;this.buildsLeft=2;this.upgradesLeft=1;
        this.waveState = 'countdown';
        this.countdownSeconds = 0;
      }
      this.emitSnapshot(true);
    }
  }

  /** Save only between waves; a mid-wave reload resumes at the last safe checkpoint. */
  private saveCheckpoint(): void {
    if (this.waveState !== 'countdown') return;
    try {
      const state = {
        buildsLeft:this.buildsLeft,upgradesLeft:this.upgradesLeft,version: 1, waveIndex: this.waveIndex, gold: this.gold, wood: this.wood,
        houseHp: this.houseHp, score: this.score, stats: this.stats,
        towers: [...this.towers.values()].map(v=>({...v.data})),
      };
      window.localStorage.setItem('bassam-enchanted-pass-v1',JSON.stringify(state));
    } catch { /* Browsers may disable storage in privacy mode. */ }
  }

  private restoreCheckpoint(): void {
    try {
      const raw=window.localStorage.getItem('bassam-enchanted-pass-v1');
      if(!raw)return;
      const saved=JSON.parse(raw);
      if(saved?.version!==1||!Array.isArray(saved.towers)||
         !Number.isFinite(saved.waveIndex)||saved.waveIndex<0||saved.waveIndex>=WAVES.length)return;
      const validTowerTypes=['gun','cannon','sniper','lightning'];
      this.waveIndex=saved.waveIndex;this.buildsLeft=saved.buildsLeft??2;this.upgradesLeft=saved.upgradesLeft??1;
      this.gold=Math.max(0,Number(saved.gold)||0);
      this.wood=Math.max(0,Number(saved.wood)||0);
      this.houseHp=Math.max(1,Math.min(this.maxHouseHp,Number(saved.houseHp)||this.maxHouseHp));
      this.score=Math.max(0,Number(saved.score)||0);
      if(saved.stats&&typeof saved.stats==='object'){
        for(const k of Object.keys(this.stats) as Array<keyof GameEngine['stats']>){
          this.stats[k]=Math.max(0,Number(saved.stats[k])||0);
        }
      }
      for(const t of saved.towers){
        if(!validTowerTypes.includes(t.type)||![1,2,3].includes(t.level))continue;
        if(!Number.isFinite(t.x)||!Number.isFinite(t.z))continue;
        const pad=this.environment.addPad({id:t.padId,x:t.x,z:t.z});
        if(!pad)continue;
        const rig=arcane(t.type,t.level);
        const data: TowerInstance={...t,x:pad.x,z:pad.z,y:pad.group.position.y+.1,modelSource:rig.isExternalGLB?'glb':'procedural'};
        rig.root.position.set(data.x,data.y,data.z);
        rig.turretHead.rotation.y=Number(t.turretYaw)||0;
        this.towerLayerGroup.add(rig.root);
        this.towers.set(data.id,{data,rig,recoil:0,buildPop:0});
        pad.occupied=true;
        const parsed=Number(String(data.id).split('-').at(-1));
        if(Number.isFinite(parsed))this.idCounter=Math.max(this.idCounter,parsed+1);
      }
    }catch(e){console.warn('[Save] Failed to restore checkpoint:',e)}
  }

  private emitSnapshot(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastSnapshotTime < 120) return;
    this.lastSnapshotTime = now;
    if(force && this.waveState==='countdown')this.saveCheckpoint();

    const selectedTower = this.selectedTowerId ? this.towers.get(this.selectedTowerId)?.data ?? null : null;

    const minimapEnemies: GameSnapshot['minimapEnemies'] = [];
    this.enemies.forEach((e) => {
      if (!e.data.dead) minimapEnemies.push({ x: e.data.x, z: e.data.z, type: e.data.type });
    });

    const minimapTowers: GameSnapshot['minimapTowers'] = [];
    this.towers.forEach((t) => {
      minimapTowers.push({ x: t.data.x, z: t.data.z, type: t.data.type });
    });

    this.onSnapshot({buildsLeft:this.buildsLeft,upgradesLeft:this.upgradesLeft,
      gold: this.gold,
      wood: this.wood,
      houseHp: this.houseHp,
      maxHouseHp: this.maxHouseHp,
      wave: this.waveIndex + 1,
      totalWaves: WAVES.length,
      waveState: this.waveState,
      countdownSeconds: Math.ceil(this.countdownSeconds),
      speedMultiplier: this.speedMultiplier,
      paused: this.paused,
      selectedBuildType: this.selectedBuildType,
      selectedTower: selectedTower ? { ...selectedTower } : null,
      enemiesRemaining: this.enemies.size + this.spawnQueue.length,
      score: this.score,
      stats: { ...this.stats },
      minimapEnemies,
      minimapTowers,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private boundCamera():void{
    const dx=this.camera.right/this.camera.zoom,dz=this.camera.top/this.camera.zoom*1.5;
    const t=this.controls.target;
    const minX=(52-400)/px+dx,maxX=(768-400)/px-dx;
    const minZ=Math.max((125-225)/pz,(23-225)/pz+dz),maxZ=(432-225)/pz-dz;
    const x=minX<=maxX?THREE.MathUtils.clamp(t.x,minX,maxX):(minX+maxX)/2;
    const z=minZ<=maxZ?THREE.MathUtils.clamp(t.z,minZ,maxZ):(minZ+maxZ)/2;
    this.camera.position.x+=x-t.x;this.camera.position.z+=z-t.z;
    t.x=x;t.z=z;this.camera.updateMatrixWorld();
  }
  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.controls.update();this.boundCamera();
    this.stepSimulation(dt);
    this.renderer.render(this.scene, this.camera);
    this.emitSnapshot(false);
    this.scheduleNextTick();
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.unbindEvents();
    this.towers.forEach((t) => t.rig.mixer?.stopAllAction());
    this.enemies.forEach((e) => {
      e.rig.mixer?.stopAllAction();
      e.hpBarTexture.dispose();
    });
    this.controls.dispose();
    this.vfx.dispose();
    this.environment.dispose();
    this.materials.dispose();
    this.textures.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
