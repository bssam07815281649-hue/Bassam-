import {useEffect,useReducer,useRef,useState} from 'react';
import type {PointerEvent as Pointer} from 'react';
import {TOWER_DEFINITIONS as defs,TOWER_ORDER,WAVES,ENEMY_DEFINITIONS as enemies} from './game/data';
import type {TowerType,EnemyType} from './game/types';
import {along,routeLength,obstacle,radius} from './game/forestGround';
import type {Point} from './game/forestGround';
import './forest.css';
const asset=(name:string)=>import.meta.env.BASE_URL+'assets/forest/'+name+'.webp';
const names={gun:'الرشاش',cannon:'المدفع',sniper:'القنّاص',lightning:'برج الرماة'};
const heights={gun:43,cannon:36,sniper:48,lightning:66};
type Tower=Point & {type:TowerType;level:number;cool:number};
type Enemy=Point & {type:EnemyType;d:number;hp:number;id:number};
type Shot={from:Point;to:Point;life:number;type:TowerType};
function fresh(){return {gold:480,wood:140,hp:20,wave:0,towers:[] as Tower[],units:[] as Enemy[],shots:[] as Shot[],queue:[] as {type:EnemyType;at:number}[],active:false,time:0,id:0};}
type State=ReturnType<typeof fresh>;
const key='forest-2d-checkpoint-v1';
function save(s:State){try{localStorage.setItem(key,JSON.stringify({wave:s.wave,hp:s.hp,gold:s.gold,wood:s.wood,towers:s.towers}));}catch{/* storage unavailable */}}
function restore(){const s=fresh();try{const v=JSON.parse(localStorage.getItem(key)||'null');if(v&&Number.isInteger(v.wave)&&v.wave>=0&&v.wave<=WAVES.length&&[v.hp,v.gold,v.wood].every(Number.isFinite)&&Array.isArray(v.towers)){Object.assign(s,{wave:v.wave,hp:v.hp,gold:v.gold,wood:v.wood});for(const t of v.towers)if(TOWER_ORDER.includes(t.type)&&[1,2,3].includes(t.level)&&!obstacle(t,s.towers))s.towers.push({...t,cool:0});}}catch{/* fresh game */}return s;}
function start(s:State){
 if(s.active||s.hp<=0||s.wave>=WAVES.length)return;
 save(s);s.active=true;s.time=0;
 for(const g of WAVES[s.wave].groups)for(let i=0;i<g.count;i++)s.queue.push({at:g.delay+i*g.interval,type:g.type});
 s.queue.sort((a,b)=>a.at-b.at);
}
function tick(s:State,dt:number){
 if(!s.active)return;
 s.time+=dt;
 while(s.queue.length&&s.queue[0].at<=s.time){const {type}=s.queue.shift()!;s.units.push({...along(0),d:0,type,id:++s.id,hp:enemies[type].maxHp+enemies[type].maxShield});}
 for(const u of s.units){u.d+=dt*enemies[u.type].speed*9;Object.assign(u,along(u.d));if(u.d>=routeLength)s.hp=Math.max(0,s.hp-enemies[u.type].houseDamage);}
 s.units=s.units.filter(u=>u.d<routeLength);
 for(const t of s.towers){
  t.cool-=dt;if(t.cool>0)continue;
  const def=defs[t.type],stats=def.levels[t.level-1];
  const target=s.units.filter(u=>u.hp>0&&(def.canHitAir||!enemies[u.type].isFlying)&&Math.hypot(t.x-u.x,(t.y-u.y)*1.25)<=stats.range*14).sort((a,b)=>b.d-a.d)[0];
  if(!target)continue;
  t.cool=1/stats.fireRate;s.shots.push({from:{x:t.x,y:t.y-heights[t.type]*.65},to:{x:target.x,y:target.y-5},life:.17,type:t.type});
  for(const u of s.units){if(u!==target&&!(t.type==='cannon'&&!enemies[u.type].isFlying&&Math.hypot(u.x-target.x,u.y-target.y)<24))continue;
   u.hp-=stats.damage*(t.type==='gun'?enemies[u.type].gunDeflectFactor:1);}
 }
 for(const u of s.units)if(u.hp<=0){s.gold+=enemies[u.type].rewardGold;s.wood+=enemies[u.type].rewardWood;}
 s.units=s.units.filter(u=>u.hp>0);s.shots=s.shots.filter(p=>(p.life-=dt)>0);
 if(s.hp<=0){s.active=false;s.shots=[];save(s);}
 else if(!s.units.length&&!s.queue.length){const w=WAVES[s.wave++];s.gold+=w.bonusGold;s.wood+=w.bonusWood;s.active=false;s.shots=[];save(s);}
}
export default function ForestGame(){
 const [s]=useState(restore),[,draw]=useReducer(i=>i+1,0);
 const map=useRef<SVGSVGElement>(null),pointer=useRef<number|null>(null);
 const [kind,select]=useState<TowerType|null>(null),[ghost,preview]=useState<Point|null>(null),[hint,say]=useState('اسحب الدفاع من الشريط إلى العشب'),[paused,pause]=useState(false),[speed,rate]=useState(1),[inspect,look]=useState<Tower|null>(null);
 useEffect(()=>{let last=performance.now();const id=setInterval(()=>{const now=performance.now();if(!paused&&s.active){tick(s,Math.min(.12,(now-last)/1000)*speed);draw();}last=now;},32);return ()=>clearInterval(id);},[s,paused,speed]);
 function point(e:Pointer){const m=map.current?.getScreenCTM();if(!m)return null;const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(m.inverse());return p.x>=0&&p.x<=800&&p.y>=0&&p.y<=450?{x:p.x,y:p.y}:null;}
 function build(p:Point,type:TowerType){
  const error=obstacle({...p,type},s.towers);if(error){say(error);return;}
  if(s.gold<defs[type].costGold){say('الذهب غير كافي');return;}
  s.gold-=defs[type].costGold;s.towers.push({...p,type,level:1,cool:0});if(!s.active)save(s);select(null);say('تم بناء '+names[type]);draw();
 }
 const over=s.hp<=0||s.wave===WAVES.length;
 const bad=ghost&&kind?obstacle({...ghost,type:kind},s.towers):'';
 function sprite(t:TowerType,p:Point,h:number,opacity=1){return <image href={asset(t)} x={p.x-h*.54} y={p.y-h} width={h*1.08} height={h} preserveAspectRatio="xMidYMax meet" opacity={opacity}/>;}
 return <main className="forest-game" dir="rtl" onPointerMove={e=>{if(pointer.current===e.pointerId)preview(point(e));}} onPointerCancel={()=>{pointer.current=null;preview(null);select(null);}} onPointerUp={e=>{if(pointer.current!==e.pointerId)return;pointer.current=null;const p=point(e);if(kind&&p&&!over)build(p,kind);preview(null);}}>
 <header><strong>طريق الحصن</strong><span>🪙 {s.gold}</span><span>🪵 {s.wood}</span><span>♥ {s.hp}</span><small>الموجة {Math.min(s.wave+1,WAVES.length)} / {WAVES.length}</small></header>
 <section className="forest-board"><svg ref={map} viewBox="0 0 800 450" role="img" aria-label="ساحة الدفاع" onPointerDown={e=>{if(over)return;const p=point(e);if(!p)return;if(kind){pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);preview(p);}else{look([...s.towers].sort((a,b)=>b.y-a.y).find(t=>Math.abs(t.x-p.x)<radius[t.type]&&p.y<=t.y+3&&p.y>t.y-heights[t.type])||null);}}}>
 <image href={asset('map')} width="800" height="450"/>
 {[...s.towers.map((t,i)=>({y:t.y,node:<g key={'t'+i}>{sprite(t.type,t,heights[t.type]*(1+.06*(t.level-1)))}{t.level>1&&<text x={t.x} y={t.y} fill="gold" fontSize="8">★{t.level}</text>}</g>})),...s.units.map(u=>{const h=u.type==='heavy'?20:u.type==='scout'?13:16,fly=enemies[u.type].isFlying?9:0;return {y:u.y,node:<g key={u.id} transform={`translate(${u.x} ${u.y-fly+Math.sin(u.d*.42)*.7})`}><image href={asset('soldier')} x={-h/2} y={-h} width={h} height={h} style={{filter:u.type==='shielded'?'hue-rotate(165deg)':u.type==='drone'?'grayscale(1)':''}}/><rect x="-5" y={-h-2} width={10*Math.max(0,u.hp)/(enemies[u.type].maxHp+enemies[u.type].maxShield)} height="1.3" fill="#bdeb73"/></g>};})].sort((a,b)=>a.y-b.y).map(v=>v.node)}
 {s.shots.map((b,i)=><line key={i} x1={b.from.x} y1={b.from.y} x2={b.to.x} y2={b.to.y} stroke={b.type==='lightning'?'#fff1ac':'#ffc477'} strokeWidth={b.type==='cannon'?2:1} opacity={b.life/.17}/>)}
 {ghost&&kind&&<g><ellipse cx={ghost.x} cy={ghost.y} rx={radius[kind]} ry={radius[kind]*.53} fill={bad?'#d72c36':'#82cf69'} opacity=".8"/>{sprite(kind,ghost,heights[kind],.74)}</g>}</svg></section>
 <footer><div className="forest-actions">{TOWER_ORDER.map(t=><button key={t} className={kind===t?'active':''} disabled={over||s.gold<defs[t].costGold} onPointerDown={e=>{select(t);look(null);preview(null);pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);say('اسحب إلى العشب أو المس مكان البناء');}} onClick={e=>{if(e.detail===0)select(t);}}><img src={asset(t)} draggable="false"/><span>{names[t]}<small>🪙 {defs[t].costGold}</small></span></button>)}</div>
 <div className="forest-controls">{over?<button onClick={()=>{Object.assign(s,fresh());save(s);look(null);select(null);pause(false);draw();}}>العب مجدداً</button>:<button onClick={()=>{if(s.active)pause(!paused);else{pause(false);start(s);draw();}}}>{s.active?(paused?'استئناف':'توقف مؤقت'):'ابدأ الموجة'}</button>}<button onClick={()=>rate(speed===1?2:1)}>{speed}×</button></div></footer>
 <aside aria-live="polite">{over?(s.hp?'انتصار! بقي الحصن صامداً':'سقط الحصن'):inspect?<>{names[inspect.type]} · مستوى {inspect.level} {inspect.level<3&&<button onClick={()=>{const n=defs[inspect.type].levels[inspect.level];if(s.gold<n.upgradeGold||s.wood<n.upgradeWood){say('موارد الترقية غير كافية');look(null);return;}s.gold-=n.upgradeGold;s.wood-=n.upgradeWood;inspect.level++;if(!s.active)save(s);draw();}}>ترقية · {defs[inspect.type].levels[inspect.level].upgradeGold} ذهب / {defs[inspect.type].levels[inspect.level].upgradeWood} خشب</button>}</>:bad||hint}</aside></main>;
}
