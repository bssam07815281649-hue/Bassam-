import React from 'react';
import {BookOpen,Settings,Trophy} from 'lucide-react';
interface LeftQuickMenuProps{claimableQuestsCount:number;onOpenCodex:()=>void;onOpenQuests:()=>void;onOpenSettings:()=>void}
export const LeftQuickMenu:React.FC<LeftQuickMenuProps>=({claimableQuestsCount,onOpenCodex,onOpenQuests,onOpenSettings})=>{
 const btn='relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#112a22]/85 border border-[#aac397]/25 text-[#f4e4bd] shadow-lg backdrop-blur active:scale-95';
 return <aside className="pointer-events-auto fixed left-2 bottom-28 z-20 flex flex-col gap-1.5 sm:bottom-32">
  <button className={btn} title="Guide" aria-label="Guide" onClick={onOpenCodex}><BookOpen size={17}/></button>
  <button className={btn} title="Quests" aria-label="Quests" onClick={onOpenQuests}><Trophy size={17}/>{claimableQuestsCount>0&&<span className="absolute -top-1 -right-1 rounded-full bg-amber-400 text-[#152c21] text-[9px] font-black px-1">{claimableQuestsCount}</span>}</button>
  <button className={btn} title="Settings" aria-label="Settings" onClick={onOpenSettings}><Settings size={17}/></button>
 </aside>
};
