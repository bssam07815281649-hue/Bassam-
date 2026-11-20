import React, { useState } from 'react';
import { Check, ChevronDown, ChevronUp, ShieldAlert, X, Zap } from 'lucide-react';
import { TOWER_DEFINITIONS, TOWER_ORDER } from '../game/data';
import type { EnemyType, TowerType } from '../game/types';
import { TowerIconSVG } from './TowerArtwork';

interface TowerDockProps {
  gold: number;
  selectedBuildType: TowerType | null;
  onSelectBuildType: (type: TowerType) => void;
}

const MINI_MATRIX_ENEMIES: Array<{ type: EnemyType; label: string }> = [
  { type: 'infantry', label: 'Infantry' },
  { type: 'scout', label: 'Scout' },
  { type: 'heavy', label: 'Heavy' },
  { type: 'shielded', label: 'Shield' },
  { type: 'drone', label: 'Drone' },
];

export const TowerDock: React.FC<TowerDockProps> = ({
  gold,
  selectedBuildType,
  onSelectBuildType,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="pointer-events-none fixed bottom-2.5 sm:bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center max-w-[96vw]">
      {/* Collapse / Expand toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="pointer-events-auto mb-1.5 flex items-center gap-1 rounded-t-lg bg-[#181c15]/92 border border-b-0 border-amber-500/40 px-3 py-1 text-[11px] font-semibold text-amber-200 hover:text-white transition-colors cursor-pointer"
      >
        {collapsed ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" />
            <span>Towers</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            <span>Hide Dock</span>
          </>
        )}
      </button>

      {!collapsed && (
        <div className="pointer-events-auto flex items-stretch gap-1.5 sm:gap-2.5 rounded-2xl bg-[#181c15]/94 border border-amber-500/40 p-1.5 sm:p-2 shadow-2xl">
          {TOWER_ORDER.map((type) => {
            const def = TOWER_DEFINITIONS[type];
            const canAfford = gold >= def.costGold;
            const isSelected = selectedBuildType === type;

            return (
              <button
                key={type}
                type="button"
                onClick={() => onSelectBuildType(type)}
                className={`relative flex flex-col items-center justify-between rounded-xl px-2 py-1.5 sm:px-3.5 sm:py-2 transition-all cursor-pointer min-w-[78px] sm:min-w-[132px] border ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.6)] -translate-y-0.5'
                    : canAfford
                      ? 'bg-[#23291f] border-stone-600/60 hover:border-amber-400/70 hover:bg-[#2a3225]'
                      : 'bg-[#1a1e18] border-stone-700/50 opacity-65'
                }`}
              >
                <div className="flex flex-col items-center">
                  <TowerIconSVG type={type} className="w-10 h-10 sm:w-12 sm:h-12" />
                  <span className="mt-0.5 font-display text-[11px] sm:text-xs font-bold text-stone-100 whitespace-nowrap">
                    {def.name}
                  </span>
                </div>

                {/* Gold Price */}
                <div className="mt-0.5 flex items-center gap-1">
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-extrabold text-amber-950">
                    G
                  </span>
                  <span
                    className={`font-mono-nums text-xs sm:text-sm font-bold ${
                      canAfford ? 'text-amber-300' : 'text-rose-400'
                    }`}
                  >
                    {def.costGold}
                  </span>
                </div>

                {/* Mini Effectiveness Strip (visible on sm+) */}
                <div className="hidden sm:flex items-center justify-center gap-1.5 mt-1.5 pt-1 border-t border-stone-700/70 w-full">
                  {MINI_MATRIX_ENEMIES.map(({ type: eType, label }) => {
                    const eff = def.effectiveness[eType];
                    return (
                      <span
                        key={eType}
                        title={`${label}: ${eff}`}
                        className="flex items-center justify-center"
                      >
                        {eff === 'strong' && type === 'lightning' && eType === 'shielded' ? (
                          <Zap className="h-3 w-3 text-sky-400" />
                        ) : eff === 'strong' ? (
                          <Check className="h-3 w-3 text-emerald-400 stroke-[3]" />
                        ) : eff === 'normal' ? (
                          <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                        ) : eff === 'weak' ? (
                          <X className="h-3 w-3 text-rose-400 stroke-[2.5]" />
                        ) : (
                          <ShieldAlert className="h-3 w-3 text-stone-500" />
                        )}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedBuildType && !collapsed && (
        <div className="mt-1.5 rounded-lg bg-[#181c15]/95 border border-emerald-400/50 px-3 py-1 text-xs font-medium text-emerald-200 shadow-lg">
          Tap any glowing stone pad on the map to build{' '}
          <strong className="text-white">{TOWER_DEFINITIONS[selectedBuildType].name}</strong>
        </div>
      )}
    </div>
  );
};
