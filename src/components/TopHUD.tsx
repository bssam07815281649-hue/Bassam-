import React from 'react';
import {Coins, Trees, Heart, Pause, Play, FastForward, Volume2, VolumeX, Send} from 'lucide-react';
import type {GameSnapshot} from '../game/types';

interface TopHUDProps {
 snapshot: GameSnapshot; muted: boolean; onToggleSpeed:()=>void; onTogglePause:()=>void;
 onToggleMute:()=>void; onSendWave:()=>void;
}
const pill='flex items-center gap-1.5 rounded-lg bg-[#10251f]/90 border border-[#8db29a]/20 px-2.5 py-1.5 shadow-md backdrop-blur-md';
const button='min-w-8 min-h-8 flex items-center justify-center rounded-lg bg-[#254338]/90 text-[#f6f1df] active:scale-95 hover:bg-[#39634d] transition';
export const TopHUD:React.FC<TopHUDProps>=({snapshot,muted,onToggleSpeed,onTogglePause,onToggleMute,onSendWave})=>{
 const time=`${Math.floor(snapshot.countdownSeconds/60)}:${String(snapshot.countdownSeconds%60).padStart(2,'0')}`;
 return <header className="pointer-events-none fixed inset-x-0 top-0 z-30 px-2 pt-[max(.5rem,env(safe-area-inset-top))] text-xs text-[#f7f0df]">
  <div className="flex items-start justify-between gap-1.5">
   <div className="pointer-events-auto flex flex-wrap gap-1.5 max-w-[53%]">
    <div className={pill}><Coins size={14} className="text-amber-300"/><b>{snapshot.gold}</b></div>
    <div className={pill}><Trees size={14} className="text-lime-300"/><b>{snapshot.wood}</b></div>
    <div className={pill}><Heart size={14} className="text-rose-400"/><b>{snapshot.houseHp}/{snapshot.maxHouseHp}</b></div>
   </div>
   <div className="pointer-events-auto flex gap-1">
    <button className={button} onClick={onToggleSpeed} title="Speed" aria-label="Game speed"><FastForward size={14}/><span className="text-[10px]">{snapshot.speedMultiplier}x</span></button>
    <button className={button} onClick={onTogglePause} title="Pause" aria-label="Pause or play">{snapshot.paused?<Play size={15}/>:<Pause size={15}/>}</button>
    <button className={button} onClick={onToggleMute} title="Sound" aria-label="Toggle sound">{muted?<VolumeX size={15}/>:<Volume2 size={15}/>}</button>
   </div>
  </div>
  <div className="pointer-events-auto mt-1.5 flex items-center justify-center gap-2 mx-auto w-fit max-w-[94vw] rounded-xl border border-[#dec88c]/30 bg-[#10251f]/90 px-3 py-1.5 shadow-lg backdrop-blur-md">
   <span className="text-[#e9dfbe] font-bold tracking-wide">FOREST KEEP</span>
   <span className="text-[#88a895]">•</span><b>Wave {snapshot.wave}/{snapshot.totalWaves}</b>
   {snapshot.waveState==='active'&&<span className="text-[#dfb58e]">{snapshot.enemiesRemaining} left</span>}
  </div>
 </header>;
};
