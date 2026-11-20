import React from 'react';
import { BookOpen, Settings, Trophy } from 'lucide-react';

interface LeftQuickMenuProps {
  claimableQuestsCount: number;
  onOpenCodex: () => void;
  onOpenQuests: () => void;
  onOpenSettings: () => void;
}

export const LeftQuickMenu: React.FC<LeftQuickMenuProps> = ({
  claimableQuestsCount,
  onOpenCodex,
  onOpenQuests,
  onOpenSettings,
}) => {
  return (
    <aside className="pointer-events-auto fixed left-2.5 sm:left-4 bottom-28 sm:bottom-32 z-20 flex flex-col gap-2">
      <button
        type="button"
        onClick={onOpenCodex}
        className="group flex flex-col items-center justify-center rounded-xl bg-[#181c15]/92 border border-amber-500/40 hover:border-amber-400 px-2.5 py-2 text-stone-100 shadow-lg transition-all cursor-pointer min-w-[54px] min-h-[54px]"
        title="Codex & Field Guide"
      >
        <BookOpen className="h-5 w-5 text-amber-400 group-hover:scale-110 transition-transform" />
        <span className="mt-0.5 text-[10px] font-semibold text-stone-200 whitespace-nowrap">Codex</span>
      </button>

      <button
        type="button"
        onClick={onOpenQuests}
        className="relative group flex flex-col items-center justify-center rounded-xl bg-[#181c15]/92 border border-amber-500/40 hover:border-amber-400 px-2.5 py-2 text-stone-100 shadow-lg transition-all cursor-pointer min-w-[54px] min-h-[54px]"
        title="Battle Quests"
      >
        <Trophy className="h-5 w-5 text-amber-300 group-hover:scale-110 transition-transform" />
        <span className="mt-0.5 text-[10px] font-semibold text-stone-200 whitespace-nowrap">Quests</span>
        {claimableQuestsCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-extrabold text-stone-950 shadow">
            {claimableQuestsCount}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={onOpenSettings}
        className="group flex flex-col items-center justify-center rounded-xl bg-[#181c15]/92 border border-stone-600/60 hover:border-amber-400 px-2.5 py-2 text-stone-100 shadow-lg transition-all cursor-pointer min-w-[54px] min-h-[54px]"
        title="Settings & Custom GLB Models"
      >
        <Settings className="h-5 w-5 text-stone-300 group-hover:rotate-45 transition-transform" />
        <span className="mt-0.5 text-[10px] font-semibold text-stone-200 whitespace-nowrap">Settings</span>
      </button>
    </aside>
  );
};
