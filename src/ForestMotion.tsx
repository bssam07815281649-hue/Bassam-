import type {Point} from './game/forestGround';
import type {TowerType} from './game/types';

const river='M 508 450 Q 548 411 598 395 Q 652 378 671 346 Q 707 312 725 277 Q 748 243 800 225 L 800 243 Q 763 254 749 286 Q 731 322 712 354 Q 675 407 618 430 L 584 450 Z';
const currents=[
 'M790 236 Q752 253 739 288 T694 357 Q671 393 606 417 L540 452',
 'M770 249 Q744 270 731 302 Q719 332 691 355 Q660 395 588 423 L526 450',
 'M792 231 Q756 252 740 278 Q727 311 702 344 Q675 381 647 393',
 'M595 46 Q574 55 562 69 Q545 84 512 89 L488 94'
];
export function ForestMotion({url}:{url:string}){
 return <g pointerEvents="none"><defs>
 <clipPath id="water-surface"><path d={river}/><path d="M482 93 Q506 76 545 65 L566 40 L604 41 Q585 59 571 77 Q539 98 491 100Z"/></clipPath>
 <clipPath id="forest-crown"><path d="M0 0H142Q135 31 107 53Q97 81 57 79Q31 105 0 102Z M179 0H279Q267 30 247 39Q217 53 194 35Z"/></clipPath>
 </defs>
 <g clipPath="url(#water-surface)"><image className="water-drift" href={url} width="800" height="450"/>{currents.map((d,i)=><path key={d} className="forest-current" d={d} fill="none" stroke="#c4f7ee" strokeWidth={1+i%2*.5} strokeLinecap="round" strokeDasharray="5 18 2 12 11 31" style={{animationDelay:-i*.63+'s'}}/>)}</g>
 <g clipPath="url(#forest-crown)"><image className="crown-sway" href={url} width="800" height="450"/></g>
 {[0,1,2,3,4].map(i=><ellipse key={i} className="forest-leaf" cx={70+i*17} cy={68+(i%3)*9} rx="2" ry=".85" fill={i%2?'#ecc459':'#91ab4a'} style={{animationDelay:-i*1.37+'s'}}/>)}
 </g>;
}
export type Shot={from:Point;to:Point;life:number;type:TowerType};
export const flight=.46;
export function Projectile({shot:b}:{shot:Shot}){
 const t=Math.min(1,1-b.life/flight),dx=b.to.x-b.from.x,dy=b.to.y-b.from.y;
 const arc=b.type==='cannon'?24:b.type==='lightning'?10:0;
 const at=(f:number)=>({x:b.from.x+dx*f,y:b.from.y+dy*f-4*arc*f*(1-f)});
 const head=at(t),tail=at(Math.max(0,t-(b.type==='sniper'?.26:.12)));
 if(t>.87)return <circle cx={head.x} cy={head.y} r={2+(t-.87)*38} stroke="#fff1a0" fill="#ffae41" fillOpacity=".45" opacity={(1-t)*7.7}/>;
 return <g><line x1={tail.x} y1={tail.y} x2={head.x} y2={head.y} stroke="#5b341c" strokeWidth="3.4"/><line x1={tail.x} y1={tail.y} x2={head.x} y2={head.y} stroke={b.type==='sniper'?'#bff5ff':'#ffe171'} strokeWidth="1.7"/><circle cx={head.x} cy={head.y} r={b.type==='cannon'?3.6:1.9} fill={b.type==='cannon'?'#493321':'#fff6b7'} stroke="#ffc45b" strokeWidth=".8"/></g>;
}
