import * as THREE from 'three';

/** Decorative layer: batched meadow vegetation, mossy stones, glowing lanterns,
 * ruins and distant cliffs. All items avoid the active road and build pads. */
export function createEnvironmentUpgrade(roadCurve: THREE.Curve<THREE.Vector3>): {
 group: THREE.Group; update: (time:number)=>void; dispose:()=>void
} {
 const group = new THREE.Group();
 const disposeItems: Array<THREE.BufferGeometry|THREE.Material> = [];
 const track=<T extends THREE.BufferGeometry|THREE.Material>(x:T):T=>{disposeItems.push(x);return x};
 const mk=(color:number,roughness=.9)=>track(new THREE.MeshStandardMaterial({color,roughness,metalness:0}));
 const moss=mk(0x6e8362),grass=mk(0x719b58),deep=mk(0x456e4a),flower=mk(0xe8cdb6),stone=mk(0x696c62),stoneLight=mk(0x929080);
 const torch=track(new THREE.MeshBasicMaterial({color:0xffcb72}));
 const rand=(()=>{let s=814792;return ()=>{s=(Math.imul(1664525,s)+1013904223)|0;return (s>>>0)/4294967296}})();
 const samples: THREE.Vector3[]=[];for(let i=0;i<=140;i++)samples.push(roadCurve.getPointAt(i/140));
 const safe=(x:number,z:number,min=3)=>samples.every(p=>Math.hypot(p.x-x,p.z-z)>min)&&Math.hypot(x-16,z+10)>7;
 const scatter=(count:number,span:number,min:number)=>{const a:Array<[number,number,number]>=[];let tries=0;while(a.length<count&&tries++<count*24){const x=(rand()-.5)*span,z=(rand()-.5)*span;if(safe(x,z,min))a.push([x,z,rand()])}return a};
 function inst(geo:THREE.BufferGeometry,mat:THREE.Material,spots:Array<[number,number,number]>,transform:(p:[number,number,number],i:number,o:THREE.Object3D)=>void){
  const mesh=new THREE.InstancedMesh(track(geo),mat,spots.length);const d=new THREE.Object3D();
  spots.forEach((p,i)=>{transform(p,i,d);d.updateMatrix();mesh.setMatrixAt(i,d.matrix)});
  mesh.instanceMatrix.needsUpdate=true; mesh.castShadow=false;mesh.receiveShadow=true;group.add(mesh);
 }
 // Dense low-poly meadow blades with varied tilt & scale; 1 draw call.
 const weeds=scatter(480,58,2.7);
 inst(new THREE.ConeGeometry(.18,.68,3),grass,weeds,([x,z,n],i,o)=>{o.position.set(x,.19,z);o.rotation.set(.15*Math.sin(i),i*2.399,.1*Math.cos(i));o.scale.setScalar(.5+n*1.2)});
 const weeds2=scatter(240,58,2.6);
 inst(new THREE.ConeGeometry(.13,.55,3),deep,weeds2,([x,z,n],i,o)=>{o.position.set(x,.15,z);o.rotation.set(0,i*2.12,.17);o.scale.setScalar(.6+n*.9)});
 const blooms=scatter(90,55,3.5);
 inst(new THREE.IcosahedronGeometry(.10,0),flower,blooms,([x,z,n],i,o)=>{o.position.set(x,.42+n*.24,z);o.scale.setScalar(.75+n*.75)});
 // Moss covered scattered boulders.
 const boulders=scatter(68,58,4.5);
 inst(new THREE.DodecahedronGeometry(.55,0),stone,boulders,([x,z,n],i,o)=>{o.position.set(x,.22,z);o.rotation.set(n,i*.7,n*3);o.scale.set(.6+n*1.4,.3+n*.45,.6+n*1.1)});
 const groundMoss=scatter(100,58,3.3);
 inst(new THREE.IcosahedronGeometry(.5,0),moss,groundMoss,([x,z,n],i,o)=>{o.position.set(x,.04,z);o.scale.set(.4+n*.8,.08,.3+n*.6)});
 // Distant fractured rock escarpments provide a visual boundary to the diorama.
 const rimSpots:Array<[number,number,number]>=[];
 for(let i=0;i<42;i++){
  const a=(i/42)*Math.PI*2,r=31+rand()*3;
  rimSpots.push([Math.cos(a)*r,Math.sin(a)*r,rand()]);
 }
 inst(new THREE.DodecahedronGeometry(2.4,0),stoneLight,rimSpots,([x,z,n],i,o)=>{o.position.set(x,-.55,z);o.rotation.set(.1*i,i*.55,0);o.scale.set(.7+n*.5,.6+n*.65,.8+n*.5)});
 // Ancient weathered gateway ruins far from the road; create a silhouette and story.
 function column(x:number,z:number,h:number){
  const geo=track(new THREE.CylinderGeometry(.48,.56,h,8));const m=new THREE.Mesh(geo,stoneLight);m.position.set(x,h/2,z);m.castShadow=true;group.add(m);
  const cap=new THREE.Mesh(track(new THREE.BoxGeometry(1.25,.22,1.25)),stone);cap.position.set(x,h+.12,z);group.add(cap);
 }
 column(-21,-17,2.9);column(-17,-17,3.7);column(-14,-19,2.5);
 const lintel=new THREE.Mesh(track(new THREE.BoxGeometry(4.8,.5,.85)),stoneLight);lintel.position.set(-19,3.5,-17);lintel.rotation.z=-.08;group.add(lintel);
 // Subtle warm light beacons along the far edges, low draw count.
 for(const [x,z] of [[-21,4],[-9,-14],[5,17],[23,4],[-22,19]] as const){
  if(!safe(x,z,1.5))continue;
  const post=new THREE.Mesh(track(new THREE.CylinderGeometry(.07,.1,1.5,6)),stone);post.position.set(x,.75,z);group.add(post);
  const bulb=new THREE.Mesh(track(new THREE.OctahedronGeometry(.19,0)),torch);bulb.position.set(x,1.62,z);group.add(bulb);
  // Ambient glow via translucent shell, no expensive dynamic shadows.
  const haloMat=track(new THREE.MeshBasicMaterial({color:0xffd99a,transparent:true,opacity:.16,depthWrite:false}));
  const halo=new THREE.Mesh(track(new THREE.SphereGeometry(.34,8,6)),haloMat);halo.position.copy(bulb.position);group.add(halo);
 }
 return {group,update:(_time:number)=>{},dispose:()=>{group.parent?.remove(group);for(const item of disposeItems)item.dispose();}};
}
