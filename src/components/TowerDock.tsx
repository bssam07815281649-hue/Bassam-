import React,{useState} from 'react';
import {ChevronUp,ChevronDown,Coins,Check} from 'lucide-react';
import {TOWER_ORDER,TOWER_DEFINITIONS} from '../game/data';
import type {TowerType} from '../game/types';
import {TowerIconSVG} from './TowerArtwork';
interface TowerDockProps{buildsLeft:number;gold:number;selectedBuildType:TowerType|null;onSelectBuildType:(type:TowerType)=>void;onDrag:(x:number,y:number,type:TowerType,drop:boolean)=>void}
export const TowerDock:React.FC<TowerDockProps>=({buildsLeft,gold,selectedBuildType,onSelectBuildType,onDrag})=>{
 const origin=React.useRef<{x:number;y:number}|null>(null);
 const [collapsed,setCollapsed]=useState(false);
 return <nav aria-label="Build towers" className="pointer-events-none fixed bottom-[max(.5rem,env(safe-area-inset-bottom))] inset-x-0 z-20 flex flex-col items-center gap-1 px-1.5">
  <button onClick={()=>setCollapsed(v=>!v)} className="pointer-events-auto flex items-center gap-1 rounded-full bg-[#19362a]/95 border border-[#729e7e]/40 text-[#f4e3b8] px-3 py-1 text-[10px] shadow-lg">
   {collapsed?<ChevronUp size={12}/>:<ChevronDown size={12}/>} {collapsed?'Show weapons':'Weapons'}
  </button>
  {!collapsed&&<div className="pointer-events-auto flex w-fit max-w-full items-center justify-center gap-1.5 rounded-2xl bg-[#152836]/95 border border-[#9bb18c]/35 px-1.5 py-1.5 shadow-2xl backdrop-blur-lg">
   {TOWER_ORDER.map(type=>{const d=TOWER_DEFINITIONS[type],selected=type===selectedBuildType,affordable=gold>=d.costGold;
    return <button disabled={buildsLeft===0||!affordable} key={type} style={{touchAction:'none'}} onPointerDown={e=>{origin.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);onSelectBuildType(type);}} onPointerMove={e=>{if(origin.current&&e.currentTarget.hasPointerCapture(e.pointerId))onDrag(e.clientX,e.clientY,type,false);}} onPointerCancel={()=>{origin.current=null;}} onPointerUp={e=>{const p=origin.current;origin.current=null;if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>10&&e.clientY<e.currentTarget.getBoundingClientRect().top)onDrag(e.clientX,e.clientY,type,true);}} onClick={e=>{if(e.detail===0)onSelectBuildType(type);}} title={d.name} aria-label={`Build ${d.name}`} className={`relative flex min-w-[69px] w-[19vw] max-w-[100px] flex-col items-center rounded-lg border border-b-[3px] p-1 transition ${selected?'bg-[#4e7750]/80 border-amber-300':'bg-[#263f50]/95 border-[#6f8b75]/25'} ${!affordable?'opacity-55':''}`}>
      {selected&&<Check size={12} className="absolute top-1 right-1 text-amber-300"/>}
      <img src={import.meta.env.BASE_URL+"assets/citadel/tower_"+type+"_l1.webp"} className="h-10 w-10 object-contain" draggable={false}/>
      <span className="mt-0.5 block max-w-full truncate text-[10px] text-[#f4e9d1] font-semibold">{type==='gun'?'الرشاش':type==='cannon'?'المدفع':type==='sniper'?'القنّاص':'برج الرماة'}</span>
      <span className="flex items-center gap-0.5 text-[10px] text-amber-300 font-bold"><Coins size={11}/>{d.costGold}</span>
     </button>})}
  </div>}
  {selectedBuildType&&!collapsed&&<span className="pointer-events-none rounded-full bg-[#1b382a]/95 px-3 py-0.5 text-[10px] text-[#e5e4c0]">اسحب الدفاع إلى العشب أو المس مكان البناء</span>}
 </nav>
};
