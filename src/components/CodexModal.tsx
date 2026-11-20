import React, { useState } from 'react';
import { Check, Shield, ShieldAlert, X, Zap } from 'lucide-react';
import { ENEMY_DEFINITIONS, ENEMY_ORDER, TOWER_DEFINITIONS, TOWER_ORDER } from '../game/data';
import { EnemyIconSVG, TowerIconSVG } from './TowerArtwork';

interface CodexModalProps {
  onClose: () => void;
}

export const CodexModal: React.FC<CodexModalProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'towers' | 'enemies' | 'matrix'>('towers');

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col rounded-2xl bg-[#181c15] border border-amber-500/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-700/70 px-5 py-3.5">
          <div>
            <h2 className="font-display text-lg sm:text-xl font-bold text-amber-200">
              Field Codex — Towers & Enemies
            </h2>
            <p className="text-xs text-stone-400">
              Match tower counters against armor deflection, shell dodging, energy shields, and flight.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close codex"
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-800 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1.5 border-b border-stone-800 px-5 py-2.5 bg-[#141711]">
          {(
            [
              { id: 'towers', label: 'Towers (4)' },
              { id: 'enemies', label: 'Enemies (5)' },
              { id: 'matrix', label: 'Counter Matrix' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === item.id
                  ? 'bg-amber-500 text-stone-950'
                  : 'text-stone-300 hover:bg-stone-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="custom-scroll flex-1 overflow-y-auto p-4 sm:p-5">
          {tab === 'towers' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TOWER_ORDER.map((type) => {
                const t = TOWER_DEFINITIONS[type];
                return (
                  <div
                    key={type}
                    className="rounded-xl bg-[#21271d] border border-stone-700/70 p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-[#181c15] p-2 border border-stone-700">
                          <TowerIconSVG type={type} className="w-12 h-12" />
                        </div>
                        <div>
                          <h3 className="font-display text-base font-bold text-amber-100">
                            {t.name}
                          </h3>
                          <div className="text-xs font-mono-nums text-amber-300 font-bold">
                            {t.costGold} Gold
                          </div>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-stone-300 leading-relaxed">{t.summary}</p>

                    <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[#171b14] p-2 text-[11px]">
                      {t.levels.map((lvl) => (
                        <div key={lvl.level} className="text-center">
                          <div className="font-bold text-amber-300">L{lvl.level}</div>
                          <div className="font-mono-nums text-stone-200">{lvl.damage} dmg</div>
                          <div className="font-mono-nums text-stone-400">{lvl.fireRate}/s</div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1 text-xs">
                      {t.strengths.map((s) => (
                        <div key={s} className="flex items-center gap-1.5 text-emerald-300">
                          <Check className="h-3.5 w-3.5 shrink-0" />
                          <span>{s}</span>
                        </div>
                      ))}
                      {t.weaknesses.map((w) => (
                        <div key={w} className="flex items-center gap-1.5 text-rose-300">
                          <X className="h-3.5 w-3.5 shrink-0" />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'enemies' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ENEMY_ORDER.map((type) => {
                const e = ENEMY_DEFINITIONS[type];
                return (
                  <div
                    key={type}
                    className="rounded-xl bg-[#21271d] border border-stone-700/70 p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-[#181c15] p-2 border border-stone-700">
                        <EnemyIconSVG type={type} className="w-11 h-11" />
                      </div>
                      <div>
                        <h3 className="font-display text-base font-bold text-stone-100">
                          {e.name}
                        </h3>
                        <div className="text-xs text-stone-400 font-mono-nums">
                          HP {e.maxHp}
                          {e.maxShield > 0 && ` · Shield ${e.maxShield}`}
                          {' · '}Reward {e.rewardGold}g / {e.rewardWood}w
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-1 text-xs text-stone-300">
                      {e.traits.map((trait) => (
                        <li key={trait} className="flex items-center gap-2">
                          <span className="text-amber-400">·</span>
                          <span>{trait}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="rounded-lg bg-[#171b14] border border-amber-500/25 px-3 py-2 text-xs text-amber-200">
                      <strong className="text-amber-400">Tactical Tip:</strong> {e.counterTip}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'matrix' && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-stone-700 text-stone-300">
                    <th className="py-2.5 pr-3">Tower</th>
                    {ENEMY_ORDER.map((eType) => (
                      <th key={eType} className="px-2 py-2.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <EnemyIconSVG type={eType} className="w-8 h-8" />
                          <span className="text-[11px] font-semibold">
                            {ENEMY_DEFINITIONS[eType].name.split(' ')[0]}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800">
                  {TOWER_ORDER.map((tType) => {
                    const t = TOWER_DEFINITIONS[tType];
                    return (
                      <tr key={tType}>
                        <td className="py-3 pr-3 font-semibold text-amber-100 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <TowerIconSVG type={tType} className="w-8 h-8" />
                            <span>{t.name}</span>
                          </div>
                        </td>
                        {ENEMY_ORDER.map((eType) => {
                          const eff = t.effectiveness[eType];
                          return (
                            <td key={eType} className="px-2 py-3 text-center">
                              {eff === 'strong' && tType === 'lightning' && eType === 'shielded' ? (
                                <span className="inline-flex items-center gap-1 text-sky-400 font-bold">
                                  <Zap className="h-4 w-4" />
                                  Breaks
                                </span>
                              ) : eff === 'strong' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                                  <Check className="h-4 w-4" />
                                  Strong
                                </span>
                              ) : eff === 'normal' ? (
                                <span className="text-amber-300 font-medium">Normal</span>
                              ) : eff === 'weak' ? (
                                <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                                  <Shield className="h-3.5 w-3.5" />
                                  Weak
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-stone-500 font-medium">
                                  <ShieldAlert className="h-3.5 w-3.5" />
                                  Immune
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
