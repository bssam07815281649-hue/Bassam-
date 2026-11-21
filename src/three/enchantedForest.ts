import * as T from 'three';
import {obstacle,route} from '../game/forestGround';
import {FOREST_MAP_EMBEDDED_URL} from './forestMapEmbedded';
import type {BuildPadVisual,EnvironmentRig} from './environment';

export const px=11, pz=px*2/3;
export const toWorld=(x:number,y:number)=>new T.Vector3((x-400)/px,0,(y-225)/pz);
export function enchantedForest():EnvironmentRig{
 const group=new T.Group(),pads:BuildPadVisual[]=[];
 const path=[toWorld(-85,492),toWorld(-53,452),...route.map(p=>toWorld(p.x,p.y))];
 const roadCurve=new T.CatmullRomCurve3(path,false,'centripetal');
 // Use a standard textured surface. Custom map_fragment shader hooks caused
 // incompatible WebGL rendering on some Android devices (black terrain).
 // Keep the original forest image and render it without runtime shader injection.
 // Bundled original forest map: no external asset URL or GitHub Pages path to break.
 // If the browser cannot decode the image, fall back to visible grass rather than black.
 const surface=new T.MeshBasicMaterial({color:0x79a951,toneMapped:false,fog:false});
 const map=new T.TextureLoader().load(
   FOREST_MAP_EMBEDDED_URL,
   texture=>{
     texture.colorSpace=T.SRGBColorSpace;
     texture.anisotropy=4;
     surface.map=texture;
     surface.color.setHex(0xffffff);
     surface.needsUpdate=true;
   },
   undefined,
   error=>{
     console.error('[Forest] Embedded battlefield image failed to decode:',error);
     surface.map=null;
     surface.color.setHex(0x79a951);
     surface.needsUpdate=true;
   },
 );
 map.colorSpace=T.SRGBColorSpace;
 map.anisotropy=4;
 const ground=new T.Mesh(new T.PlaneGeometry(800/px,450/pz),surface);
 ground.rotation.x=-Math.PI/2;group.add(ground);
 const shadow=new T.Mesh(ground.geometry,new T.ShadowMaterial({opacity:.3}));shadow.rotation.copy(ground.rotation);shadow.position.y=.018;shadow.receiveShadow=true;group.add(shadow);
 const hitGeo=new T.CylinderGeometry(1.3,1.3,3,10),hitMat=new T.MeshBasicMaterial({visible:false});
 return {group,ground,roadCurve,houseGroup:new T.Group(),buildPads:pads,
  canBuild:(x,z)=>x*px+400>46&&!obstacle({x:x*px+400,y:z*pz+225,type:'lightning'},[]),
  addPad(p){const marker=new T.Group();marker.position.set(p.x,0,p.z);const hit=new T.Mesh(hitGeo,hitMat);hit.position.y=1.5;hit.layers.enable(1);hit.userData.padId=p.id;marker.add(hit);group.add(marker);
   const pad={...p,group:marker,hitMesh:hit,ringMesh:hit,occupied:false};pads.push(pad);return pad;},
  update(_time){},dispose(){ground.geometry.dispose();surface.dispose();map.dispose();shadow.material.dispose();hitGeo.dispose();hitMat.dispose();}
 };
}
