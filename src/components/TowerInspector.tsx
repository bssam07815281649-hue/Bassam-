import React from 'react';
import {ArrowUp,Trash2,X,Target} from 'lucide-react';
import {TOWER_DEFINITIONS} from '../game/data';
import {TowerIconSVG} from './TowerArtwork';
import type {TargetPriority,TowerInstance} from '../game/types';
interface TowerInspectorProps{tower:TowerInstance;upgradesLeft:number;gold:number;wood:number;onUpgrade:()=>void;onSell:()=>void;onChangePriority:(p:TargetPriority)=>void;onClose:()=>void}
export const TowerInspector:React.FC<TowerInspectorProps>=({tower,upgradesLeft,gold,wood,onUpgrade,onSell,onChangePriority,onClose})=>{
 const d=TOWER_DEFINITIONS[tower.type],next=tower.level===1?d.levels[1]:tower.level===2?d.levels[2]:null,can=upgradesLeft>0&&!!next&&gold>=next.upgradeGold&&wood>=next.upgradeWood;
 return <div className="pointer-events-auto fixed z-30 bottom-[104px] sm:bottom-[120px] left-1/2 -translate-x-1/2 w-[min(94vw,370px)] rounded-2xl border border-[#d8c394]/35 bg-[#112b23]/95 p-2.5 shadow-2xl backdrop-blur-md text-[#f5edda]">
  <div className="flex justify-between items-center gap-2">
   <div className="flex items-center gap-2"><span className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#456c4d]"><img src={import.meta.env.BASE_URL+"assets/citadel/tower_"+tower.type+"_l"+tower.level+".webp"} className="h-8 w-8"/><span className="absolute -bottom-1 -right-1 rounded bg-amber-300 px-1 text-[9px] font-bold text-[#17291f]">L{tower.level}</span></span><div className="leading-tight"><strong className="text-xs">{d.name}</strong><div className="text-[10px] text-[#adc5b0]">Level {tower.level}/3 · {tower.kills} kills</div></div></div>
   <button aria-label="Close inspector" onClick={onClose}><X size={17}/></button>
  </div>
  <div className="mt-2 flex items-center justify-between gap-1.5 text-[10px]">
   <span className="text-[#c1d2bd]">DMG <b className="text-white">{d.levels[tower.level-1].damage}</b></span>
   <span className="text-[#c1d2bd]">SPD <b className="text-white">{d.levels[tower.level-1].fireRate.toFixed(1)}</b></span>
   <span className="text-[#c1d2bd]">RNG <b className="text-white">{d.levels[tower.level-1].range}</b></span>
  </div>
  <div className="mt-2 flex gap-1 items-center"><Target size={13} className="text-amber-300"/>{(['first','strongest','closest'] as TargetPriority[]).map(p=><button key={p} onClick={()=>onChangePriority(p)} className={`rounded-md px-2 py-1 text-[10px] ${tower.priority===p?'bg-[#d5b36e] text-[#1c261d] font-bold':'bg-[#2e5141] text-[#e2eddf]'}`}>{p}</button>)}</div>
  <div className="mt-2 flex gap-1.5"><button disabled={!can} onClick={onUpgrade} className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-[#d7b872] disabled:bg-[#465a47] disabled:text-[#a0ab9b] text-[#17291f] font-bold text-xs py-2"><ArrowUp size={14}/>{next?`Upgrade · ${next.upgradeGold}g + ${next.upgradeWood}w`:'MAX LEVEL'}</button>
  <button title="Sell" aria-label="Sell tower" onClick={onSell} className="flex items-center gap-1 rounded-lg bg-[#6d3432] px-2.5 text-[#fff1e9] text-xs"><Trash2 size={14}/>{Math.round(tower.investedGold*.75)}g</button></div>
 </div>
};
