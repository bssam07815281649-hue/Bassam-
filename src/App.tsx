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

const INITIAL_SNAPSHOT: GameSnapshot = {
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
  const [contextLost, setContextLost] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.55);
  const [activeModal, setActiveModal] = useState<'codex' | 'quests' | 'settings' | null>(null);
  const [claimedQuests, setClaimedQuests] = useState<string[]>([]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const engine = new GameEngine(
      container,
      (nextSnap) => setSnapshot(nextSnap),
      (lost) => setContextLost(lost),
    );
    engineRef.current = engine;

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
    setClaimedQuests((prev) => (prev.includes(questId) ? prev : [...prev, questId]));
    engineRef.current?.grantQuestReward(gold, wood);
  }, []);

  const handleRestart = useCallback(() => {
    setClaimedQuests([]);
    engineRef.current?.restartGame();
  }, []);

  const handleChangePriority = useCallback((priority: TargetPriority) => {
    engineRef.current?.setSelectedTowerPriority(priority);
  }, []);

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#182016]">
      {/* Isolated WebGL Viewport Container */}
      <div ref={mountRef} className="absolute inset-0 h-full w-full" />

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
          onUpgrade={() => engineRef.current?.upgradeSelectedTower()}
          onSell={() => engineRef.current?.sellSelectedTower()}
          onChangePriority={handleChangePriority}
          onClose={() => engineRef.current?.clearSelection()}
        />
      )}

      <TowerDock
        gold={snapshot.gold}
        selectedBuildType={snapshot.selectedBuildType}
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
    </main>
  );
}
