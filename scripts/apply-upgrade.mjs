/** Run with: node scripts/apply-upgrade.mjs
 * Requires the upgrade overlay files to be copied into the project root first.
 * The script modifies only known source anchors; never overwrites unknown code silently.
 */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const updates=[];
function change(file,fn){
 const p=path.join(root,file);if(!fs.existsSync(p))throw new Error(`Missing source: ${file}`);
 let s=fs.readFileSync(p,'utf8'),next=fn(s);
 if(next===s){console.log('Unchanged:',file);return}
 const b=p+'.before-bassam-upgrade';if(!fs.existsSync(b))fs.writeFileSync(b,s);
 fs.writeFileSync(p,next);updates.push(file);
}
function replace(s,from,to,label){
 if(s.includes(to))return s;
 if(!s.includes(from))throw new Error(`Cannot safely locate ${label}; source version may differ. No overwrite made.`);
 return s.replace(from,to);
}
change('src/three/GameEngine.ts',s=>{
 s=replace(s,'    this.scene.background = new THREE.Color(0x9ec6d8);','    this.scene.background = new THREE.Color(0xe4cb98);','sky tone');
 s=replace(s,'    this.scene.fog = new THREE.FogExp2(0xb8d7e0, 0.0085);','    this.scene.fog = new THREE.FogExp2(0xe8d5a8, 0.005);','fog tone');
 s=replace(s,"    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));","    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, window.innerWidth < 780 ? 1.35 : 2));",'mobile render scaling');
 s=replace(s,'    sun.shadow.mapSize.set(2048, 2048);','    sun.shadow.mapSize.set(window.innerWidth < 780 ? 1024 : 2048, window.innerWidth < 780 ? 1024 : 2048);','mobile shadow resolution');
 // Hardening against duplicate async uploads is handled in App.
 // Saved checkpoints persist at intervals between waves and after edits, no mid-wave rewind corruption.
 s=replace(s,'    this.bindEvents();\n    this.emitSnapshot(true);','    this.restoreCheckpoint();\n    this.bindEvents();\n    this.emitSnapshot(true);','restore startup');
 if(!s.includes('private restoreCheckpoint(): void')) s=replace(s,'  private emitSnapshot(force = false): void {',`  /** Save only between waves; a mid-wave reload resumes at the last safe checkpoint. */
  private saveCheckpoint(): void {
    if (this.waveState !== 'countdown') return;
    try {
      const state = {
        version: 1, waveIndex: this.waveIndex, gold: this.gold, wood: this.wood,
        houseHp: this.houseHp, score: this.score, stats: this.stats,
        towers: [...this.towers.values()].map(v=>({...v.data})),
      };
      window.localStorage.setItem('bassam-protect-house-checkpoint-v1',JSON.stringify(state));
    } catch { /* Browsers may disable storage in privacy mode. */ }
  }

  private restoreCheckpoint(): void {
    try {
      const raw=window.localStorage.getItem('bassam-protect-house-checkpoint-v1');
      if(!raw)return;
      const saved=JSON.parse(raw);
      if(saved?.version!==1||!Array.isArray(saved.towers)||
         !Number.isFinite(saved.waveIndex)||saved.waveIndex<0||saved.waveIndex>=WAVES.length)return;
      const validTowerTypes=['gun','cannon','sniper','lightning'];
      this.waveIndex=saved.waveIndex;
      this.gold=Math.max(0,Number(saved.gold)||0);
      this.wood=Math.max(0,Number(saved.wood)||0);
      this.houseHp=Math.max(1,Math.min(this.maxHouseHp,Number(saved.houseHp)||this.maxHouseHp));
      this.score=Math.max(0,Number(saved.score)||0);
      if(saved.stats&&typeof saved.stats==='object'){
        for(const k of Object.keys(this.stats) as Array<keyof GameEngine['stats']>){
          this.stats[k]=Math.max(0,Number(saved.stats[k])||0);
        }
      }
      for(const t of saved.towers.slice(0,this.environment.buildPads.length)){
        if(!validTowerTypes.includes(t.type)||![1,2,3].includes(t.level))continue;
        const pad=this.environment.buildPads.find(p=>p.id===t.padId&&!p.occupied);
        if(!pad)continue;
        const rig=createTowerRig(t.type,t.level,this.materials);
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

  private emitSnapshot(force = false): void {`,'checkpoint methods');
 s=replace(s,'    this.lastSnapshotTime = now;\n\n    const selectedTower',`    this.lastSnapshotTime = now;
    if(force && this.waveState==='countdown')this.saveCheckpoint();

    const selectedTower`,'checkpoint on snapshot');
 return s;
});
change('src/three/CombatEffects.ts',s=>{
 s=replace(s,`  public dispose(): void {
    this.bulletGeo.dispose();`,`  public dispose(): void {
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
    this.bulletGeo.dispose();`,'effects cleanup');
 return s;
});
change('src/three/environment.ts',s=>{
 s=replace(s,'const cGrass = new THREE.Color(0x6ea632);','const cGrass = new THREE.Color(0xb6b77a);','ground palette');
 s=replace(s,'const cSunlit = new THREE.Color(0x88bf3f);','const cSunlit = new THREE.Color(0xe1d292);','sunlight palette');
 s=replace(s,'const cBank = new THREE.Color(0x527c2b);','const cBank = new THREE.Color(0x889462);','river bank palette');
 s=replace(s,'    color: 0x3b9bd1,','    color: 0x528e96,','river teal');
 return s;
});
change('src/App.tsx',s=>{
 s=replace(s,"  const [claimedQuests, setClaimedQuests] = useState<string[]>([]);",`  const [claimedQuests, setClaimedQuests] = useState<string[]>(() => {
    try { const v=JSON.parse(localStorage.getItem('bassam-quest-claims-v1')||'[]');return Array.isArray(v)?v:[] }catch{return []}
  });
  const claimLockRef = useRef<Set<string>>(new Set(claimedQuests));`,'quest claim lock');
 s=replace(s,`    setClaimedQuests((prev) => (prev.includes(questId) ? prev : [...prev, questId]));
    engineRef.current?.grantQuestReward(gold, wood);`,`    if (claimLockRef.current.has(questId)) return;
    claimLockRef.current.add(questId);
    try { localStorage.setItem('bassam-quest-claims-v1', JSON.stringify([...claimLockRef.current])); } catch {}
    setClaimedQuests((prev) => (prev.includes(questId) ? prev : [...prev, questId]));
    engineRef.current?.grantQuestReward(gold, wood);`,'duplicate claims');
 s=replace(s,'    setClaimedQuests([]);\n    engineRef.current?.restartGame();',`    setClaimedQuests([]);
    claimLockRef.current.clear();
    try { localStorage.removeItem('bassam-quest-claims-v1'); } catch {}
    engineRef.current?.restartGame();`,'claim reset');
 return s;
});
change('src/three/assets/AssetManager.ts',s=>{
 s=replace(s,`      targetKeys.forEach((key) => {`, `      // For tower uploads, override only the first level; installed L2/L3 GLBs stay intact.
      const overrideKeys = slot.startsWith('tower_') ? targetKeys.slice(0, 1) : targetKeys;
      overrideKeys.forEach((key) => {`,'per-level model protection');
 return s;
});
console.log('Changed:',updates.join(', '));
console.log('Upgrade installed. Run: npm install && npm run lint && npm run build');
