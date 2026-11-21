import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import type {TowerType} from '../../game/types';
import type {TowerRig} from './towers';
const palettes={gun:[0x126763,0x40fff1],cannon:[0x912a29,0xff8036],sniper:[0x342574,0xd99bff],lightning:[0x156d48,0xa3ff5b]};
const metal=(color:number,m=.55)=>new T.MeshStandardMaterial({color,metalness:m,roughness:.32});
const brass=metal(0xf0b34e),steel=metal(0x38435a),ivory=metal(0xfde6ad,.22);
export function arcane(type:TowerType,level:1|2|3):TowerRig{
 const root=new T.Group(),turretHead=new T.Group(),recoilGroup=new T.Group();
 const [enamel,glow]=palettes[type],lacquer=metal(enamel,.42),gem=new T.MeshStandardMaterial({color:glow,emissive:glow,emissiveIntensity:.5,metalness:.24,roughness:.16});
 function part(parent:T.Object3D,geo:T.BufferGeometry,mat:T.Material,x:number,y:number,z:number){
  const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
 }
 function lathe(parent:T.Object3D,profile:number[][],mat:T.Material){return part(parent,new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(r,y)),32),mat,0,0,0);}
 function ring(parent:T.Object3D,y:number,r:number,w:number,mat:T.Material){const m=part(parent,new T.TorusGeometry(r,w,8,36),mat,0,y,0);m.rotation.x=Math.PI/2;return m;}
 function rod(parent:T.Object3D,a:T.Vector3,b:T.Vector3,r:number,mat:T.Material){const d=b.clone().sub(a);const m=part(parent,new T.CylinderGeometry(r*.7,r,d.length(),8),mat,0,0,0);m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;}
 const baseHeight={gun:.85,cannon:.67,sniper:1.48,lightning:1.24}[type]+level*.09;
 lathe(root,[[.02,.03],[1.08,.03],[1.24,.13],[1.14,.27],[.86,.31],[.78,baseHeight-.2],[.96,baseHeight-.13],[.93,baseHeight],[.02,baseHeight]],lacquer);
 ring(root,.16,1.15,.064,brass);ring(root,baseHeight-.13,.96,.05,brass);
 for(let i=0;i<6;i++){
  const a=i*Math.PI/3,x=Math.sin(a),z=Math.cos(a);
  rod(root,new T.Vector3(x*1.01,.22,z*1.01),new T.Vector3(x*.84,baseHeight-.1,z*.84),.074,brass);
  const shard=part(root,new T.OctahedronGeometry(.17),gem,x*.99,.34,z*.99);shard.scale.y=1.3;
  if(level>1 && i%2===0){const fin=part(root,new T.ConeGeometry(.16,.75,5),ivory,x*1.02,baseHeight,z*1.02);fin.rotation.z=-x*.32;fin.rotation.x=z*.32;}
 }
 turretHead.position.y=baseHeight;root.add(turretHead);turretHead.add(recoilGroup);
 part(turretHead,new T.SphereGeometry(.59,20,12),steel,0,.22,0).scale.set(1.25,.73,1);
 const muzzleNode=new T.Object3D();recoilGroup.add(muzzleNode);
 if(type==='lightning'){
  const length=1.25+level*.16;
  part(recoilGroup,new RoundedBoxGeometry(.18,.2,length,3,.06),brass,0,.39,.18);
  for(const side of [-1,1]){
   const wing=new T.CatmullRomCurve3([new T.Vector3(0,.42,.45),new T.Vector3(side*.57,.52,.29),new T.Vector3(side*(.79+.08*level),.68,-.17)]);
   part(recoilGroup,new T.TubeGeometry(wing,16,.08,8,false),ivory,0,0,0);
   rod(recoilGroup,wing.getPoint(1),new T.Vector3(0,.43,-.43),.022,gem);
  }
  part(recoilGroup,new T.OctahedronGeometry(.18),gem,0,.45,length*.5).scale.z=2.2;
  muzzleNode.position.set(0,.45,length*.5+.3);
 }else{
  const n=type==='gun'?level+1:type==='sniper'&&level===3?2:1;
  const length=type==='sniper'?1.82:type==='cannon'?1.22:1.06;
  for(let i=0;i<n;i++){
   const x=(i-(n-1)/2)*(type==='sniper'?.38:.24),r=type==='cannon'?.39:type==='sniper'?.14:.115;
   const barrel=new T.Group();barrel.position.set(x,.44,0);barrel.rotation.x=Math.PI/2;recoilGroup.add(barrel);
   lathe(barrel,[[0,-.43],[r*1.24,-.38],[r*1.26,.05],[r*.88,length*.64],[r*1.07,length*.89],[r,length],[r*.61,length],[r*.61,length-.15]],steel);
   for(const z of [.1,length*.68,length*.9])ring(barrel,z,r*(z===.1?1.2:1.01),.035,brass);
   ring(barrel,length-.025,r*.9,.028,gem);
   if(i===0)muzzleNode.position.set(x,.44,length);
  }
  if(type==='sniper'){part(turretHead,new T.SphereGeometry(.22,16,12),gem,0,.85,0);ring(turretHead,.85,.27,.04,brass);}
  if(type==='cannon'){for(const side of [-1,1]){const wheel=part(turretHead,new T.CylinderGeometry(.41,.41,.16,20),brass,side*.58,.38,0);wheel.rotation.z=Math.PI/2;}}
 }
 const rings:T.Object3D[]=[];
 if(level>=2){const r=ring(root,baseHeight+.13,1.02,.035,gem);rings.push(r);}
 if(level===3){for(let i=0;i<3;i++){const a=i*2*Math.PI/3;const p=part(root,new T.OctahedronGeometry(.23),gem,Math.cos(a)*1.05,baseHeight+.47,Math.sin(a)*1.05);p.scale.y=1.9;}ring(root,baseHeight+.54,1.06,.035,brass);}
 root.updateMatrixWorld(true);
 return {root,turretHead,recoilGroup,muzzleNode,muzzleLocal:muzzleNode.getWorldPosition(new T.Vector3()),electricRings:rings};
}
