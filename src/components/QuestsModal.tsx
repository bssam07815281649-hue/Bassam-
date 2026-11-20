import React from 'react';
import { CheckCircle2, Coins, Trees, Trophy, X } from 'lucide-react';
import { QUESTS } from '../game/data';
import type { GameSnapshot } from '../game/types';

interface QuestsModalProps {
  snapshot: GameSnapshot;
  claimedIds: string[];
  onClaim: (questId: string, gold: number, wood: number) => void;
  onClose: () => void;
}

export const QuestsModal: React.FC<QuestsModalProps> = ({
  snapshot,
  claimedIds,
  onClaim,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-3 sm:p-6">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl bg-[#181c15] border border-amber-500/50 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-700/70 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <Trophy className="h-5 w-5 text-amber-400" />
            <h2 className="font-display text-lg font-bold text-amber-200">Battle Quests</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quests"
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-800 hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="custom-scroll flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {QUESTS.map((q) => {
            const current = Math.min(q.target, snapshot.stats[q.metric]);
            const pct = Math.round((current / q.target) * 100);
            const completed = current >= q.target;
            const claimed = claimedIds.includes(q.id);

            return (
              <div
                key={q.id}
                className="rounded-xl bg-[#21271d] border border-stone-700/70 p-4 flex flex-col gap-2.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-sm sm:text-base font-bold text-stone-100">
                      {q.title}
                    </h3>
                    <p className="text-xs text-stone-400 mt-0.5">{q.description}</p>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono-nums font-bold shrink-0">
                    <span className="flex items-center gap-1 text-amber-300">
                      <Coins className="h-3.5 w-3.5" />+{q.rewardGold}
                    </span>
                    <span className="flex items-center gap-1 text-amber-500">
                      <Trees className="h-3.5 w-3.5" />+{q.rewardWood}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2.5 rounded-full bg-stone-900 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        completed ? 'bg-emerald-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono-nums text-xs font-semibold text-stone-300 w-12 text-right">
                    {current}/{q.target}
                  </span>
                </div>

                {claimed ? (
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Reward Claimed</span>
                  </div>
                ) : completed ? (
                  <button
                    type="button"
                    onClick={() => onClaim(q.id, q.rewardGold, q.rewardWood)}
                    className="self-end rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3.5 py-1.5 text-xs font-bold text-stone-950 transition-colors cursor-pointer"
                  >
                    Claim Reward
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
