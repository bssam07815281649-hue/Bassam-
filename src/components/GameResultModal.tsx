import React from 'react';
import { RotateCcw, ShieldCheck, Skull } from 'lucide-react';
import type { GameSnapshot } from '../game/types';

interface GameResultModalProps {
  snapshot: GameSnapshot;
  onRestart: () => void;
}

export const GameResultModal: React.FC<GameResultModalProps> = ({ snapshot, onRestart }) => {
  if (snapshot.waveState !== 'victory' && snapshot.waveState !== 'defeat') {
    return null;
  }

  const isVictory = snapshot.waveState === 'victory';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#181c15] border border-amber-500/60 p-6 text-center shadow-2xl">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full border ${
            isVictory
              ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
              : 'bg-rose-500/20 border-rose-400 text-rose-300'
          }`}
        >
          {isVictory ? <ShieldCheck className="h-9 w-9" /> : <Skull className="h-9 w-9" />}
        </div>

        <h2 className="mt-4 font-display text-2xl font-extrabold text-amber-100">
          {isVictory ? 'Homestead Defended!' : 'Homestead Overrun'}
        </h2>
        <p className="mt-1.5 text-sm text-stone-300">
          {isVictory
            ? 'All 10 waves along The Forest Path were repelled.'
            : `Enemy forces breached the courtyard on Wave ${snapshot.wave}.`}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2.5 rounded-xl bg-[#21271d] p-3.5 text-left text-xs">
          <div>
            <div className="text-stone-400">Wave Reached</div>
            <div className="font-mono-nums text-base font-bold text-amber-300">
              {snapshot.wave}/{snapshot.totalWaves}
            </div>
          </div>
          <div>
            <div className="text-stone-400">Battle Score</div>
            <div className="font-mono-nums text-base font-bold text-stone-100">
              {snapshot.score.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="text-stone-400">Enemies Defeated</div>
            <div className="font-mono-nums text-base font-bold text-emerald-300">
              {snapshot.stats.enemiesDefeated}
            </div>
          </div>
          <div>
            <div className="text-stone-400">Shields Shattered</div>
            <div className="font-mono-nums text-base font-bold text-sky-300">
              {snapshot.stats.shieldsBroken}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRestart}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-3 text-sm font-extrabold text-stone-950 shadow-lg transition-colors cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Play Again</span>
        </button>
      </div>
    </div>
  );
};
