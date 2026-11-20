import React from 'react';
import { FastForward, Heart, Pause, Play, Send, Trees, Volume2, VolumeX } from 'lucide-react';
import { WAVES } from '../game/data';
import type { GameSnapshot } from '../game/types';
import { Minimap } from './Minimap';

interface TopHUDProps {
  snapshot: GameSnapshot;
  muted: boolean;
  onToggleSpeed: () => void;
  onTogglePause: () => void;
  onToggleMute: () => void;
  onSendWave: () => void;
}

export const TopHUD: React.FC<TopHUDProps> = ({
  snapshot,
  muted,
  onToggleSpeed,
  onTogglePause,
  onToggleMute,
  onSendWave,
}) => {
  const currentWaveDef = WAVES[snapshot.wave - 1];
  const mins = Math.floor(snapshot.countdownSeconds / 60);
  const secs = String(snapshot.countdownSeconds % 60).padStart(2, '0');

  return (
    <header className="pointer-events-none fixed top-0 left-0 right-0 z-20 flex items-start justify-between gap-2 p-2.5 sm:p-4">
      {/* Top-Left: Resources (Gold, Wood, House Health) */}
      <div className="pointer-events-auto flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl bg-[#181c15]/92 border border-amber-500/35 px-3 py-2 shadow-lg">
        <div className="flex items-center gap-1.5" title="Gold">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-extrabold text-amber-950 shadow-inner">
            G
          </span>
          <span className="font-mono-nums text-sm sm:text-base font-bold text-amber-200">
            {snapshot.gold.toLocaleString()}
          </span>
        </div>

        <span className="text-stone-600" aria-hidden="true">
          ·
        </span>

        <div className="flex items-center gap-1.5" title="Wood">
          <Trees className="h-4 w-4 text-amber-500" />
          <span className="font-mono-nums text-sm sm:text-base font-bold text-stone-100">
            {snapshot.wood.toLocaleString()}
          </span>
        </div>

        <span className="text-stone-600" aria-hidden="true">
          ·
        </span>

        <div className="flex items-center gap-1.5" title="House Integrity">
          <Heart className="h-4 w-4 fill-red-500 text-red-500" />
          <span className="font-mono-nums text-sm sm:text-base font-bold text-rose-200">
            {snapshot.houseHp}/{snapshot.maxHouseHp}
          </span>
        </div>
      </div>

      {/* Top-Center: Level & Wave Status Banner */}
      <div className="pointer-events-auto flex flex-col items-center gap-1.5">
        <div className="rounded-xl bg-[#181c15]/92 border border-amber-500/40 px-4 py-1.5 text-center shadow-lg">
          <div className="font-display text-xs sm:text-sm font-bold tracking-wide text-amber-100 whitespace-nowrap">
            The Forest Path <span className="text-stone-400 font-normal">·</span> Wave{' '}
            <span className="font-mono-nums text-amber-300">
              {snapshot.wave}/{snapshot.totalWaves}
            </span>
          </div>
          <div className="text-[11px] text-stone-300 whitespace-nowrap">
            {currentWaveDef?.title ?? 'Final Siege'}
            {snapshot.waveState === 'active' && (
              <>
                {' · '}
                <span className="font-mono-nums text-rose-300">{snapshot.enemiesRemaining} foes left</span>
              </>
            )}
          </div>
        </div>

        {snapshot.waveState === 'countdown' && (
          <button
            type="button"
            onClick={onSendWave}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 active:scale-95 px-3 py-1.5 text-xs font-bold text-stone-950 shadow-md transition-all whitespace-nowrap cursor-pointer min-h-[34px]"
          >
            <Send className="h-3.5 w-3.5" />
            <span>
              Next Wave {mins}:{secs}
            </span>
          </button>
        )}
      </div>

      {/* Top-Right: Speed / Pause / Sound + Circular Minimap */}
      <div className="pointer-events-auto flex items-start gap-2.5">
        <div className="flex items-center gap-1 rounded-xl bg-[#181c15]/92 border border-stone-600/50 p-1 shadow-lg">
          <button
            type="button"
            onClick={onToggleSpeed}
            title="Toggle Simulation Speed"
            className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-bold transition-colors cursor-pointer min-h-[38px] ${
              snapshot.speedMultiplier === 2
                ? 'bg-amber-500 text-stone-950'
                : 'text-stone-200 hover:bg-stone-800'
            }`}
          >
            <FastForward className="h-3.5 w-3.5" />
            <span className="font-mono-nums">{snapshot.speedMultiplier}x</span>
          </button>

          <button
            type="button"
            onClick={onTogglePause}
            title={snapshot.paused ? 'Resume' : 'Pause'}
            aria-label={snapshot.paused ? 'Resume game' : 'Pause game'}
            className={`rounded-lg p-2 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center ${
              snapshot.paused
                ? 'bg-rose-500 text-white'
                : 'text-stone-200 hover:bg-stone-800'
            }`}
          >
            {snapshot.paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            title={muted ? 'Unmute Sound' : 'Mute Sound'}
            aria-label={muted ? 'Unmute sound' : 'Mute sound'}
            className="rounded-lg p-2 text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center"
          >
            {muted ? <VolumeX className="h-4 w-4 text-rose-400" /> : <Volume2 className="h-4 w-4 text-emerald-400" />}
          </button>
        </div>

        <div className="hidden sm:block">
          <Minimap enemies={snapshot.minimapEnemies} towers={snapshot.minimapTowers} />
        </div>
      </div>
    </header>
  );
};
