import React from 'react';
import { ArrowUpCircle, Coins, Crosshair, Trash2, Trees, X } from 'lucide-react';
import { TOWER_DEFINITIONS } from '../game/data';
import type { TargetPriority, TowerInstance } from '../game/types';
import { TowerIconSVG } from './TowerArtwork';

interface TowerInspectorProps {
  tower: TowerInstance;
  gold: number;
  wood: number;
  onUpgrade: () => void;
  onSell: () => void;
  onChangePriority: (priority: TargetPriority) => void;
  onClose: () => void;
}

const PRIORITIES: Array<{ id: TargetPriority; label: string }> = [
  { id: 'first', label: 'First' },
  { id: 'strongest', label: 'Strongest' },
  { id: 'closest', label: 'Closest' },
];

export const TowerInspector: React.FC<TowerInspectorProps> = ({
  tower,
  gold,
  wood,
  onUpgrade,
  onSell,
  onChangePriority,
  onClose,
}) => {
  const def = TOWER_DEFINITIONS[tower.type];
  const currentStats = def.levels[tower.level - 1];
  const nextStats = tower.level === 1 ? def.levels[1] : tower.level === 2 ? def.levels[2] : null;
  const canUpgrade =
    nextStats !== null && gold >= nextStats.upgradeGold && wood >= nextStats.upgradeWood;
  const sellGold = Math.round(tower.investedGold * 0.75);
  const sellWood = Math.round(tower.investedWood * 0.75);

  return (
    <div className="pointer-events-auto fixed bottom-32 sm:bottom-36 left-1/2 -translate-x-1/2 z-30 w-[92vw] max-w-md rounded-2xl bg-[#181c15]/96 border border-amber-400/50 p-3.5 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-[#252c20] border border-stone-600/60 p-1.5">
            <TowerIconSVG type={tower.type} className="w-10 h-10" />
          </div>
          <div>
            <h3 className="font-display text-sm sm:text-base font-bold text-amber-100 leading-tight">
              {def.name}
            </h3>
            <div className="text-xs text-stone-300 mt-0.5">
              Level <span className="font-mono-nums font-bold text-amber-300">{tower.level}/3</span>
              <span className="mx-1.5 text-stone-600">·</span>
              <span className="font-mono-nums">{tower.kills}</span> kills
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-800 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Stats row */}
      <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-xl bg-[#22281e] px-3 py-2 text-xs">
        <div>
          <div className="text-stone-400">Damage</div>
          <div className="font-mono-nums font-bold text-stone-100">
            {currentStats.damage}
            {nextStats && <span className="text-emerald-400"> → {nextStats.damage}</span>}
          </div>
        </div>
        <div>
          <div className="text-stone-400">Rate/s</div>
          <div className="font-mono-nums font-bold text-stone-100">
            {currentStats.fireRate.toFixed(1)}
            {nextStats && <span className="text-emerald-400"> → {nextStats.fireRate.toFixed(1)}</span>}
          </div>
        </div>
        <div>
          <div className="text-stone-400">Range</div>
          <div className="font-mono-nums font-bold text-stone-100">
            {currentStats.range.toFixed(1)}
            {nextStats && <span className="text-emerald-400"> → {nextStats.range.toFixed(1)}</span>}
          </div>
        </div>
      </div>

      {/* Target Priority */}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-medium text-stone-300">
          <Crosshair className="h-3.5 w-3.5 text-amber-400" />
          Target
        </span>
        <div className="flex items-center gap-1 rounded-lg bg-[#22281e] p-1">
          {PRIORITIES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onChangePriority(p.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                tower.priority === p.id
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Upgrade & Sell Actions */}
      <div className="mt-3 flex items-center gap-2">
        {nextStats ? (
          <button
            type="button"
            disabled={!canUpgrade}
            onClick={onUpgrade}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              canUpgrade
                ? 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-md'
                : 'bg-stone-800 text-stone-500 cursor-not-allowed'
            }`}
          >
            <ArrowUpCircle className="h-4 w-4 shrink-0" />
            <span>Upgrade L{nextStats.level}</span>
            <span className="font-mono-nums text-xs flex items-center gap-1">
              ({nextStats.upgradeGold}g · {nextStats.upgradeWood}w)
            </span>
          </button>
        ) : (
          <div className="flex-1 flex items-center justify-center rounded-xl bg-amber-500/15 border border-amber-400/40 px-3 py-2.5 text-xs font-bold text-amber-300">
            Maximum Level Reached
          </div>
        )}

        <button
          type="button"
          onClick={onSell}
          className="flex items-center gap-1.5 rounded-xl bg-rose-950/70 hover:bg-rose-900 border border-rose-500/40 px-3 py-2.5 text-xs font-bold text-rose-200 transition-colors cursor-pointer"
          title="Sell tower for 75% refund"
        >
          <Trash2 className="h-4 w-4" />
          <span className="font-mono-nums flex items-center gap-1">
            <Coins className="h-3 w-3 text-amber-300" />
            {sellGold}
            {sellWood > 0 && (
              <>
                <Trees className="h-3 w-3 text-amber-500 ml-0.5" />
                {sellWood}
              </>
            )}
          </span>
        </button>
      </div>
    </div>
  );
};
