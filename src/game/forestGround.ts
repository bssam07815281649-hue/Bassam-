export type Point = {x:number; y:number};
const points = (pairs:number[][]):Point[] => pairs.map(([x,y])=>({x,y}));
export const route = points([[-8,430],[12,411],[39,391],[72,373],[113,357],[166,347],[223,342],[281,337],[334,326],[374,312],[402,297],[416,282],[413,269],[399,254],[382,242],[374,230],[377,218],[387,208],[409,199],[438,192],[477,189],[516,187],[549,181],[568,169],[579,152],[593,142],[615,134],[639,125]]);
// Scene coordinates correspond to the painted ground at 800 by 450.
const grass = points([[5,305],[97,279],[111,217],[132,192],[145,150],[171,117],[215,108],[294,104],[344,85],[406,99],[486,107],[549,100],[557,128],[610,139],[666,152],[713,170],[751,157],[761,195],[721,219],[697,248],[682,269],[670,293],[637,314],[608,327],[586,352],[546,373],[506,387],[463,382],[422,359],[382,345],[331,351],[291,359],[244,354],[205,365],[171,375],[125,383],[88,399],[46,407],[0,424]]);
const road=points([[0,389],[43,363],[85,344],[132,334],[213,328],[275,321],[330,310],[366,295],[384,282],[379,266],[361,251],[345,237],[341,224],[348,207],[364,194],[395,184],[434,179],[488,177],[529,174],[548,166],[560,152],[569,141],[590,132],[636,117],[651,128],[613,145],[600,153],[588,176],[570,188],[548,196],[517,200],[475,201],[441,204],[421,210],[408,218],[405,229],[411,239],[433,253],[446,265],[454,282],[451,298],[435,315],[408,330],[373,342],[324,352],[281,358],[223,361],[169,368],[116,382],[77,401],[40,426],[21,450],[0,450]]);
function inside(p:Point,poly:Point[]){
 let yes=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
 }
 return yes;
}
function touchesEdge(p:Point,poly:Point[],rx:number,ry:number){
 return poly.some((a,i)=>{
  const b=poly[(i+1)%poly.length],x=(a.x-p.x)/rx,y=(a.y-p.y)/ry,dx=(b.x-a.x)/rx,dy=(b.y-a.y)/ry;
  const t=Math.max(0,Math.min(1,-(x*dx+y*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x+t*dx,y+t*dy)<1;
 });
}
export const radius={gun:15,cannon:20,sniper:16,lightning:22};
type Structure=Point & {type:keyof typeof radius};
export function obstacle(p:Structure,towers:Structure[]){
 const r=radius[p.type];
 if(inside(p,road)||touchesEdge(p,road,r,r*.53))return 'خلّي الطريق مفتوح';
 if(!inside(p,grass)||touchesEdge(p,grass,r,r*.53))return 'اختار أرض عشبية مفتوحة';
 if(towers.some(t=>Math.hypot(t.x-p.x,(t.y-p.y)/.53)<r+radius[t.type]+1))return 'المكان محجوز لدفاع ثاني';
 return '';
}
const lengths=route.slice(1).map((p,i)=>Math.hypot(p.x-route[i].x,p.y-route[i].y));
export const routeLength=lengths.reduce((a,b)=>a+b,0);
export function along(distance:number):Point{
 for(let i=0;i<lengths.length;i++){
  if(distance<=lengths[i]){const t=distance/lengths[i];return {x:route[i].x+(route[i+1].x-route[i].x)*t,y:route[i].y+(route[i+1].y-route[i].y)*t};}
  distance-=lengths[i];
 }
 return route[route.length-1];
}
