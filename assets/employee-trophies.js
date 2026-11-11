import * as THREE from './three.module.js';
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const views=[];
function buildTrophy(color){
 const g=new THREE.Group();
 const metal=new THREE.MeshPhysicalMaterial({color,metalness:1,roughness:.19,clearcoat:1,clearcoatRoughness:.13});
 const trim=new THREE.MeshPhysicalMaterial({color,metalness:1,roughness:.12});
 const black=new THREE.MeshPhysicalMaterial({color:0x111a17,metalness:.65,roughness:.22,clearcoat:1});
 function lathe(points,mat=metal){const mesh=new THREE.Mesh(new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r,y)),96),mat);g.add(mesh);return mesh}
 function ring(r,y,t=.025){const m=new THREE.Mesh(new THREE.TorusGeometry(r,t,12,96),trim);m.rotation.x=Math.PI/2;m.position.y=y;g.add(m)}
 // Solid stepped plinth and turned stem, with a hollow, double-walled cup.
 lathe([[0,0],[.84,0],[.89,.06],[.88,.12],[.8,.15],[.74,.48],[.74,.53],[0,.53]],black);
 ring(.86,.09,.035);ring(.76,.5,.03);
 lathe([[0,.53],[.73,.53],[.73,.6],[.67,.65],[.6,.66],[.58,.75],[.55,.78],[.55,.92],[.48,.94],[.48,1.04],[.4,1.06],[.39,1.17],[.28,1.22],[.19,1.3],[.14,1.42],[.13,1.52],[.21,1.59],[.22,1.68],[.16,1.75],[.14,1.9],[.23,2.02],[0,2.02]]);
 for(const [r,y] of [[.57,.79],[.47,.96],[.38,1.08],[.21,1.65],[.16,1.82]])ring(r,y,.018);
 lathe([[0,1.97],[.18,1.97],[.3,2.03],[.43,2.15],[.55,2.32],[.65,2.58],[.73,2.91],[.78,3.25],[.8,3.5],[.79,3.56],[.735,3.56],[.73,3.48],[.72,3.24],[.66,2.91],[.59,2.6],[.48,2.36],[.36,2.19],[.22,2.11],[0,2.11]]);
 ring(.78,3.51,.035);ring(.76,3.36,.014);
 for(const side of [-1,1]){
  const coords=[[.68,3.15],[.96,3.5],[1.2,3.52],[1.39,3.29],[1.43,2.99],[1.3,2.64],[1.03,2.37],[.7,2.18],[.2,1.84]];
  const curve=new THREE.CatmullRomCurve3(coords.map(([x,y])=>new THREE.Vector3(side*x,y,0)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve,72,.055,12,false),metal));
  const inner=new THREE.CatmullRomCurve3([[.72,3.13],[1.0,3.39],[1.2,3.39],[1.3,3.23]].map(([x,y])=>new THREE.Vector3(side*x,y,0)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(inner,24,.025,8,false),trim));
  // Swept handle finials.
  const tip=new THREE.CatmullRomCurve3([[1.2,3.48],[1.4,3.61],[1.47,3.76]].map(([x,y])=>new THREE.Vector3(side*x,y,0)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(tip,24,.025,8,false),trim));
 }
 const starShape=new THREE.Shape();for(let i=0;i<10;i++){const a=Math.PI/2+i*Math.PI/5,r=i%2?.43:1;const x=Math.cos(a)*r,y=Math.sin(a)*r;i?starShape.lineTo(x,y):starShape.moveTo(x,y)}starShape.closePath();
 const starGeo=new THREE.ExtrudeGeometry(starShape,{depth:.035,bevelEnabled:true,bevelThickness:.008,bevelSize:.012,bevelSegments:2,steps:1});
 for(let i=0;i<8;i++){const a=i*Math.PI/4;const star=new THREE.Mesh(starGeo,trim);star.scale.setScalar(.115);star.position.set(Math.sin(a)*.805,.3,Math.cos(a)*.805);star.rotation.y=a;g.add(star)}
 for(let i=0;i<5;i++){const a=(i-2)*.3;const y=2.85+i*.075;const r=.73;const star=new THREE.Mesh(starGeo,trim);star.scale.setScalar(.047);star.position.set(Math.sin(a)*r,y,Math.cos(a)*r);star.rotation.y=a;g.add(star)}
 return g;
}
function createView(el,rank){
 let stage='WebGL context creation';
 let renderer,holder,environment;
 try{
 renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
 renderer.debug.checkShaderErrors=true;
 stage='renderer configuration';
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 const scene=new THREE.Scene();
 // Photographic studio reflection panels create moving highlights on real metal.
 const studio=new THREE.Scene();studio.background=new THREE.Color(0x1b211e);
 function softbox(x,y,z,w,h,power){const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(power,power*.97,power*.88),side:THREE.DoubleSide}));p.position.set(x,y,z);p.lookAt(0,1.8,0);studio.add(p)}
 softbox(-4,4,3,2.8,7,7);softbox(4,3,2,1.2,6,5);softbox(0,7,-1,5,3,6);softbox(1,2,-5,2,5,4);softbox(-1,1,5,.6,5,2);
 stage='studio reflection environment generation';
 const pmrem=new THREE.PMREMGenerator(renderer);try{environment=pmrem.fromScene(studio,.04);scene.environment=environment.texture}finally{pmrem.dispose()}
 const camera=new THREE.PerspectiveCamera(33,1,.1,100);camera.position.set(0,3.6,8.5);camera.lookAt(0,1.9,0);
 scene.add(new THREE.HemisphereLight(0xfff6dc,0x21392b,1.4));const light=new THREE.DirectionalLight(0xfff3cf,3);light.position.set(-3,5,4);scene.add(light);
 const model=buildTrophy(rank===1?0xe8b749:rank===2?0xc3d3df:0xc98b56);model.rotation.y=-.22;scene.add(model);
 holder=document.createElement('div');holder.className='trophy-3d';holder.setAttribute('role','img');holder.setAttribute('aria-label',`${['','Gold','Silver','Bronze'][rank]} trophy, rotating in 3D`);holder.append(renderer.domElement);el.querySelector('.employee-trophy').insertAdjacentElement('afterend',holder);
 stage='initial trophy render';
 const resize=()=>{const w=holder.clientWidth,h=holder.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera)};
 const observer=new ResizeObserver(resize);observer.observe(holder);resize();el.classList.add('has-3d');
 views.push({el,holder,observer,renderer,scene,camera,model,environment,phase:rank*.13});
 }catch(error){environment?.dispose();renderer?.dispose();holder?.remove();throw new Error(`Trophy ${rank} failed during ${stage}`,{cause:error})}
}

function createSoftwareView(el,rank){
 const model=buildTrophy(rank===1?0xe8b749:rank===2?0xc3d3df:0xc98b56);model.updateMatrixWorld(true);
 const triangles=[];const v=new THREE.Vector3(),n=new THREE.Vector3();
 model.traverse(mesh=>{if(!mesh.isMesh)return;const geo=mesh.geometry,pos=geo.attributes.position,norm=geo.attributes.normal,indices=geo.index;const normalMat=new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);const verts=[];for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);n.fromBufferAttribute(norm,i).applyMatrix3(normalMat).normalize();verts.push({p:v.clone(),n:n.clone()})}const base=mesh.material.color.clone().convertLinearToSRGB();for(let i=0;i<(indices?indices.count:pos.count);i+=3){const ids=[0,1,2].map(j=>indices?indices.getX(i+j):i+j);triangles.push({v:ids.map(k=>verts[k]),c:base,black:base.r<.2})}});
 const holder=document.createElement('div');holder.className='trophy-3d';holder.setAttribute('role','img');holder.setAttribute('aria-label',`${['','Gold','Silver','Bronze'][rank]} trophy, rotating in 3D`);
 const canvas=document.createElement('canvas');holder.append(canvas);el.querySelector('.employee-trophy').insertAdjacentElement('afterend',holder);const ctx=canvas.getContext('2d');
 const camera=new THREE.PerspectiveCamera(33,1,.1,100);camera.position.set(0,3.6,8.5);camera.lookAt(0,1.9,0);camera.updateMatrixWorld();
 let w=0,h=0;const rot=new THREE.Matrix4();const view=new THREE.Matrix4();const projected=new THREE.Vector3();
 const light=new THREE.Vector3(-.5,.8,1).normalize(),sideLight=new THREE.Vector3(.9,.3,.5).normalize();
 const draw=()=>{if(!w)return;ctx.clearRect(0,0,w,h);rot.makeRotationY(model.rotation.y);view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);const faces=[];for(const t of triangles){const normal=new THREE.Vector3();const pts=t.v.map(a=>{v.copy(a.p).applyMatrix4(rot);n.copy(a.n).transformDirection(rot);normal.add(n);projected.copy(v).applyMatrix4(view);return{x:(projected.x*.5+.5)*w,y:(-.5*projected.y+.5)*h,z:projected.z}});normal.normalize();if(normal.z<-.3)continue;const diffuse=Math.max(0,normal.dot(light));const spec=Math.pow(Math.max(0,normal.dot(light)),34)*1.7+Math.pow(Math.max(0,normal.dot(sideLight)),65)*1.3;const reflection=.29+diffuse*.68+Math.max(0,normal.dot(sideLight))*.22;const rgb=[t.c.r,t.c.g,t.c.b].map(c=>Math.min(255,Math.round(255*(c*reflection+spec*(t.black?.18:.65)))));faces.push({pts,z:(pts[0].z+pts[1].z+pts[2].z)/3,color:`rgb(${rgb.join(',')})`})}faces.sort((a,b)=>b.z-a.z);for(const f of faces){ctx.beginPath();ctx.moveTo(f.pts[0].x,f.pts[0].y);ctx.lineTo(f.pts[1].x,f.pts[1].y);ctx.lineTo(f.pts[2].x,f.pts[2].y);ctx.closePath();ctx.fillStyle=f.color;ctx.fill();ctx.strokeStyle=f.color;ctx.lineWidth=.45;ctx.stroke()}};
 const resize=()=>{w=canvas.width=Math.round(holder.clientWidth*1.3);h=canvas.height=Math.round(holder.clientHeight*1.3);camera.aspect=w/h;camera.updateProjectionMatrix();draw()};const observer=new ResizeObserver(resize);observer.observe(holder);resize();el.classList.add('has-3d');views.push({el,holder,observer,model,phase:rank*.13,draw});
}
function disposeView(view){
 view.observer.disconnect();
 view.renderer?.dispose();
 (view.scene||view.model)?.traverse(object=>{
  object.geometry?.dispose();
  for(const material of Array.isArray(object.material)?object.material:[object.material])material?.dispose();
 });
 view.environment?.dispose();
 view.holder.remove();
 view.el.classList.remove('has-3d');
}
function initializeTrophies(){
 for(const view of views.splice(0))disposeView(view);
 for(const el of document.querySelectorAll('.employee-winner'))el.classList.remove('has-3d');
 const ranks={first:1,second:2,third:3};
 for(const el of document.querySelectorAll('.employee-winner')){
  const rank=Object.entries(ranks).find(([name])=>el.classList.contains(name))?.[1];
  if(!rank)continue;
  try{createView(el,rank)}
  catch(error){
   try{createSoftwareView(el,rank)}
   catch(fallbackError){console.error(`Unable to render employee trophy ${rank}`,new AggregateError([error,fallbackError]))}
  }
 }
}
function initializeWhenPodiumReady() {
  if (document.querySelector('.employee-winner')) {
    initializeTrophies();
  }
}

initializeWhenPodiumReady();
document.addEventListener(
  'tropica:employee-podium-updated',
  initializeWhenPodiumReady
);
document.addEventListener(
  'tropica:data-ready',
  initializeWhenPodiumReady,
  { once: true }
);
let last=0,angle=0;function tick(t){requestAnimationFrame(tick);if(document.hidden){last=t;return}if(t-last<50)return;const dt=Math.min((t-last)/1000,.1);last=t;const paused=document.body.classList.contains('motion-paused')||reduced.matches;if(!paused)angle+=dt*Math.PI*2/26;for(const v of views){if(!paused)v.model.rotation.y=angle+v.phase;v.draw?v.draw():v.renderer.render(v.scene,v.camera)}}requestAnimationFrame(tick);
