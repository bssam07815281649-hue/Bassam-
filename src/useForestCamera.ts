import {useEffect,useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import type {Point} from './game/forestGround';
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(n,b));
export function useForestCamera(){
 const map=useRef<SVGSVGElement>(null),[aspect,resize]=useState(.7),[zoom,setZoom]=useState(1);
 const [center,setCenter]=useState<Point>({x:323,y:236});
 const touches=useRef(new Map<number,Point>());
 useEffect(()=>{if(!map.current)return;const obs=new ResizeObserver(([e])=>{const r=e.contentRect;if(r.height>0)resize(r.width/r.height);});obs.observe(map.current);return ()=>obs.disconnect();},[]);
 const height=Math.min(450,800/aspect)/zoom,width=height*aspect;
 const x=clamp(center.x-width/2,0,800-width),y=clamp(center.y-height/2,0,450-height);
 const viewBox=[x,y,width,height].join(' ');
 function point(e:PointerEvent){
  const el=map.current;if(!el)return null;const r=el.getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return null;
  return {x:x+width*(e.clientX-r.left)/r.width,y:y+height*(e.clientY-r.top)/r.height};
 }
 function begin(e:PointerEvent){touches.current.set(e.pointerId,{x:e.clientX,y:e.clientY});e.currentTarget.setPointerCapture(e.pointerId);}
 function move(e:PointerEvent){
  const fingers=touches.current,old=fingers.get(e.pointerId),el=map.current;if(!old||!el)return;
  const next={x:e.clientX,y:e.clientY},other=[...fingers].find(([id])=>id!==e.pointerId)?.[1];fingers.set(e.pointerId,next);
  const rect=el.getBoundingClientRect(),scale=width/rect.width;
  if(other){
   const before=Math.hypot(old.x-other.x,old.y-other.y),after=Math.hypot(next.x-other.x,next.y-other.y);if(before<5)return;
   const z=clamp(zoom*after/before,1,3),f=zoom/z;
   const px=(old.x+other.x)/2-rect.left,py=(old.y+other.y)/2-rect.top;
   setCenter({x:x+px*scale+(width/2-(px+(next.x-old.x)/2)*scale)*f,y:y+py*scale+(height/2-(py+(next.y-old.y)/2)*scale)*f});setZoom(z);
  }else setCenter({x:clamp(x+width/2-(next.x-old.x)*scale,width/2,800-width/2),y:clamp(y+height/2-(next.y-old.y)*scale,height/2,450-height/2)});
 }
 return {map,viewBox,point,begin,move,end:(id:number)=>touches.current.delete(id),zoom,step:(n:number)=>{setCenter({x:x+width/2,y:y+height/2});setZoom(clamp(zoom+n,1,3));}};
}
