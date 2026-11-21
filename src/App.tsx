import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CodexModal } from './components/CodexModal';
import { GameResultModal } from './components/GameResultModal';
import { LeftQuickMenu } from './components/LeftQuickMenu';
import { SettingsModal } from './components/SettingsModal';
import { TowerDock } from './components/TowerDock';
import { TowerInspector } from './components/TowerInspector';
import { TopHUD } from './components/TopHUD';
import { QuestsModal } from './components/QuestsModal';
import { soundEngine } from './game/audio';
import { QUESTS, WAVES } from './game/data';
import type { GameSnapshot, TargetPriority, TowerType } from './game/types';
import { GameEngine } from './three/GameEngine';

// Each GitHub Pages deployment injects its commit SHA as the build identifier.
const GAME_BUILD_ID = import.meta.env.VITE_APP_BUILD_ID || 'local-preview';
const LAST_OPENED_BUILD_KEY = 'bassam-last-opened-game-build-v1';

function shouldShowUpdateScreen(): boolean {
  try {
    return localStorage.getItem(LAST_OPENED_BUILD_KEY) !== GAME_BUILD_ID;
  } catch {
    return true;
  }
}

const INITIAL_SNAPSHOT: GameSnapshot = {buildsLeft:2,upgradesLeft:1,
  gold: 480,
  wood: 140,
  houseHp: 20,
  maxHouseHp: 20,
  wave: 1,
  totalWaves: WAVES.length,
  waveState: 'countdown',
  countdownSeconds: 12,
  speedMultiplier: 1,
  paused: false,
  selectedBuildType: null,
  selectedTower: null,
  enemiesRemaining: 0,
  score: 0,
  stats: {
    towersBuilt: 0,
    enemiesDefeated: 0,
    shieldsBroken: 0,
    dronesDowned: 0,
    level3Towers: 0,
  },
  minimapEnemies: [],
  minimapTowers: [],
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);

  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_SNAPSHOT);
  const [showUpdateScreen, setShowUpdateScreen] = useState(shouldShowUpdateScreen);
  const [unavailable,setUnavailable]=useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.55);
  const [activeModal, setActiveModal] = useState<'codex' | 'quests' | 'settings' | null>(null);
  const [claimedQuests, setClaimedQuests] = useState<string[]>(() => {
    try { const v=JSON.parse(localStorage.getItem('bassam-quest-claims-v1')||'[]');return Array.isArray(v)?v:[] }catch{return []}
  });
  const claimLockRef = useRef<Set<string>>(new Set(claimedQuests));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let engine:GameEngine;
    try {engine = new GameEngine(
      container,
      (nextSnap) => setSnapshot(nextSnap),
      (lost) => setContextLost(lost),
    );
    }catch(error){console.error(error);setUnavailable(true);return;}
    engineRef.current = engine;
    if (showUpdateScreen) engine.setPaused(true);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  const claimableQuestsCount = useMemo(() => {
    return QUESTS.filter(
      (q) => !claimedQuests.includes(q.id) && snapshot.stats[q.metric] >= q.target,
    ).length;
  }, [claimedQuests, snapshot.stats]);

  const handleToggleSpeed = useCallback(() => {
    const next = snapshot.speedMultiplier === 1 ? 2 : 1;
    engineRef.current?.setSpeedMultiplier(next);
  }, [snapshot.speedMultiplier]);

  const handleTogglePause = useCallback(() => {
    engineRef.current?.togglePause();
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const handleChangeVolume = useCallback((v: number) => {
    setVolume(v);
    soundEngine.setVolume(v);
    if (v > 0 && muted) {
      setMuted(false);
      soundEngine.setMuted(false);
    }
  }, [muted]);

  const handleSelectBuildType = useCallback((type: TowerType) => {
    engineRef.current?.setSelectedBuildType(type);
  }, []);

  const handleClaimQuest = useCallback((questId: string, gold: number, wood: number) => {
    if (claimLockRef.current.has(questId)) return;
    claimLockRef.current.add(questId);
    try { localStorage.setItem('bassam-quest-claims-v1', JSON.stringify([...claimLockRef.current])); } catch {}
    setClaimedQuests((prev) => (prev.includes(questId) ? prev : [...prev, questId]));
    engineRef.current?.grantQuestReward(gold, wood);
  }, []);

  const handleRestart = useCallback(() => {
    setClaimedQuests([]);
    claimLockRef.current.clear();
    try { localStorage.removeItem('bassam-quest-claims-v1'); } catch {}
    engineRef.current?.restartGame();
  }, []);

  const closeUpdateScreen = useCallback(() => {
    try { localStorage.setItem(LAST_OPENED_BUILD_KEY, GAME_BUILD_ID); } catch {}
    setShowUpdateScreen(false);
  }, []);

  const handleContinueAfterUpdate = useCallback(() => {
    engineRef.current?.setPaused(false);
    closeUpdateScreen();
  }, [closeUpdateScreen]);

  const handleRestartAfterUpdate = useCallback(() => {
    handleRestart();
    engineRef.current?.setPaused(false);
    closeUpdateScreen();
  }, [handleRestart, closeUpdateScreen]);

  const handleChangePriority = useCallback((priority: TargetPriority) => {
    engineRef.current?.setSelectedTowerPriority(priority);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#182016]">
      {/* Isolated WebGL Viewport Container */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

      {unavailable&&<div dir="rtl" className="fixed inset-0 z-50 grid place-content-center bg-[#17291f] p-8 text-center text-white"><b>تعذّر تشغيل الرسومات الثلاثية الأبعاد</b><p>افتح رابط اللعبة في Chrome على هاتفك مع تفعيل WebGL.</p><button onClick={()=>location.reload()}>إعادة المحاولة</button></div>}
      {/* Context Lost Recovery Banner */}
      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#181c15]/95 p-6 text-center">
          <div className="max-w-sm rounded-2xl border border-amber-500/40 bg-[#21271d] p-5">
            <h2 className="font-display text-lg font-bold text-amber-200">3D Graphics Paused</h2>
            <p className="mt-1 text-xs text-stone-300">
              WebGL context was interrupted. Restoring the battlefield automatically...
            </p>
          </div>
        </div>
      )}

      <div className="fixed right-2 top-24 z-20 grid gap-1"><button aria-label="تكبير" className="rounded bg-emerald-950/90 px-3 py-1 text-xl text-amber-200" onClick={()=>engineRef.current?.zoomBy(1.25)}>＋</button><button aria-label="تصغير" className="rounded bg-emerald-950/90 px-3 py-1 text-xl text-amber-200" onClick={()=>engineRef.current?.zoomBy(.8)}>−</button></div>
      {/* Semantic HUD Overlay */}
      <TopHUD
        snapshot={snapshot}
        muted={muted}
        onToggleSpeed={handleToggleSpeed}
        onTogglePause={handleTogglePause}
        onToggleMute={handleToggleMute}
        onSendWave={() => engineRef.current?.startNextWaveNow()}
      />

      <LeftQuickMenu
        claimableQuestsCount={claimableQuestsCount}
        onOpenCodex={() => setActiveModal('codex')}
        onOpenQuests={() => setActiveModal('quests')}
        onOpenSettings={() => setActiveModal('settings')}
      />

      {snapshot.selectedTower && (
        <TowerInspector
          tower={snapshot.selectedTower}
          gold={snapshot.gold}
          wood={snapshot.wood}
          upgradesLeft={snapshot.upgradesLeft}
          onUpgrade={() => engineRef.current?.upgradeSelectedTower()}
          onSell={() => engineRef.current?.sellSelectedTower()}
          onChangePriority={handleChangePriority}
          onClose={() => engineRef.current?.clearSelection()}
        />
      )}

      <TowerDock
        gold={snapshot.gold}
        selectedBuildType={snapshot.selectedBuildType}
        buildsLeft={snapshot.buildsLeft}
        onDrag={(x,y,type,drop)=>drop?engineRef.current?.dropBuild(x,y,type):engineRef.current?.previewBuild(x,y,type)}
        onSelectBuildType={handleSelectBuildType}
      />

      {/* Modals */}
      {activeModal === 'codex' && <CodexModal onClose={() => setActiveModal(null)} />}

      {activeModal === 'quests' && (
        <QuestsModal
          snapshot={snapshot}
          claimedIds={claimedQuests}
          onClaim={handleClaimQuest}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          volume={volume}
          muted={muted}
          onChangeVolume={handleChangeVolume}
          onToggleMute={handleToggleMute}
          onResetCamera={() => engineRef.current?.resetCamera()}
          onRestartGame={handleRestart}
          onModelsChanged={() => engineRef.current?.rebuildAllCustomModels()}
          onClose={() => setActiveModal(null)}
        />
      )}

      <GameResultModal snapshot={snapshot} onRestart={handleRestart} />

      {showUpdateScreen && !unavailable && (
        <div dir="rtl" role="dialog" aria-modal="true" aria-labelledby="update-screen-title" className="fixed inset-0 z-[80] flex items-center justify-center bg-[#080f11]/90 p-5 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-amber-400/40 bg-gradient-to-b from-[#263b37] to-[#111d1c] p-6 text-center text-white shadow-2xl sm:p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-400/15 text-4xl" aria-hidden="true">🏰</div>
            <p className="mb-2 text-xs font-bold tracking-widest text-amber-300">حماية المنزل</p>
            <h1 id="update-screen-title" className="font-display text-2xl font-extrabold text-white">اللعبة تحدّثت!</h1>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-7 text-stone-200">
              وصل تحديث جديد للعبة. تگدر تكمل من آخر نقطة محفوظة، أو تبدأ لعبة جديدة.
            </p>
            <p className="mt-2 text-xs text-amber-200/80">الحفظ يكون بين الموجات، مو أثناء المعركة.</p>
            <div className="mt-7 grid gap-3">
              <button type="button" onClick={handleContinueAfterUpdate} className="min-h-14 rounded-xl border border-emerald-200/40 bg-emerald-500 px-5 py-3 text-lg font-extrabold text-[#08261b] shadow-lg transition active:scale-[0.98]">
                ▶ استمرار اللعب
              </button>
              <button type="button" onClick={handleRestartAfterUpdate} className="min-h-14 rounded-xl border border-amber-300/50 bg-amber-400/15 px-5 py-3 text-lg font-bold text-amber-100 transition active:scale-[0.98]">
                ↻ إعادة اللعب من البداية
              </button>
            </div>
            <p className="mt-5 text-xs text-stone-400">إعادة اللعب تمسح تقدّم الجولة الحالية.</p>
          </div>
        </div>
      )}
    </main>
  );
}
