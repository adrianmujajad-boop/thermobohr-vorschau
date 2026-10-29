/**
 * Claude-Kopie von Codex/Geraet-3D-Studie-v001/rig-solid.js (Geometrie unveraendert).
 * Ergaenzt: Farbmodus 'thermobohr' zweifarbig nach dem Logo (Koerper Dunkelgruen
 * #1d5c2e wie «Thermobohr», Mast/Bohrkopf/Kran Hellgruen #6aaa3a wie Blatt und «AG»),
 * 'gruen' einfarbig, 'original' orange; Beschriftung wechselt mit dem Farbmodus.
 *
 * ROTOMAX XL GTi — shaded, manually reconstructed mechanical study.
 * Source of dimensions and silhouette: Volragen/Bohrer Rotomax.webp and the
 * existing Thermobohr line reconstruction. This is neither a scan nor a splat.
 * Concealed sides are an engineering approximation, not recovered image data.
 * Units match rig-model.js: Y up; drill axis X=2.04, Z=0; feet on Y=0.
 * No external imports. Pass the viewer's THREE namespace to createRig().
 */
export function createRig(THREE, { colorMode = 'original' } = {}) {
  const group = new THREE.Group();
  group.name = 'Rotomax XL GTi — mechanische Flaechenstudie';
  const TAU = Math.PI * 2;
  const V = a => new THREE.Vector3(...a);
  const add = (a,b) => a.map((v,i) => v+b[i]);
  const sub = (a,b) => a.map((v,i) => v-b[i]);
  const mul = (a,s) => a.map(v=>v*s);
  const lerp = (a,b,t) => a.map((v,i) => v+(b[i]-v)*t);
  const materials = {};
  function material(name, color, roughness=.55, metalness=.25) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    m.name = name; materials[name] = m; return m;
  }
  material('paint', '#e76c14', .43, .25);
  material('paintShade', '#bc4d0e', .48, .22);
  material('paintLight', '#f78c32', .44, .2);
  material('accent', '#e76c14', .42, .24);
  material('chassis', '#30373c', .65, .45);
  material('rubber', '#1e2428', .96, .04);
  material('track', '#394249', .77, .32);
  material('steel', '#bec7ca', .32, .8);
  material('steelDark', '#66767c', .47, .66);
  material('black', '#11191d', .71, .18);
  material('panel', '#c9d0d0', .49, .4);
  material('glass', '#222e34', .28, .35);
  material('amber', '#ffad2a', .29, .08);
  material('red', '#bd3426', .48, .12);
  material('white', '#e9ebe5', .6, .1);
  materials.amber.emissive.set('#7d3500');
  materials.amber.emissiveIntensity = .18;
  // Lackierte Teile, die im zweifarbigen Thermobohr-Modus hellgruen werden.
  const ACCENT_PARTS = new Set(['mast','feed','crane','hydraulics']);
  const buckets = new Map();
  let part = 'hardware';
  function setPart(next) { part = next; }
  function toneMaterial(tone) {
    if (part === 'tracks') return tone===2 ? 'steelDark' : tone===1 ? 'track' : 'rubber';
    if (part === 'chassis') return tone===2 ? 'steel' : 'chassis';
    if (part === 'console') return tone===2 ? 'panel' : tone===1 ? 'paint' : 'black';
    if (part === 'cage') return tone===2 ? 'steelDark' : 'steel';
    if (part === 'pipeRack') return tone===2 ? 'steel' : 'chassis';
    if (part === 'hoses') return tone===1 ? 'paint' : tone===2 ? 'steelDark' : 'rubber';
    return tone===2 ? 'steel' : tone===1 ? (ACCENT_PARTS.has(part) ? 'accent' : 'paint') : 'black';
  }
  const dummy = new THREE.Object3D();
  const Y = new THREE.Vector3(0,1,0);
  function instanced(key, geometry, matName, position, scale, quaternion) {
    const bucketKey = `${part}|${key}|${matName}`;
    let bucket = buckets.get(bucketKey);
    if (!bucket) { bucket = { part, geometry, matName, matrices: [] }; buckets.set(bucketKey,bucket); }
    dummy.position.set(...position);
    dummy.scale.set(...scale);
    dummy.quaternion.copy(quaternion || new THREE.Quaternion());
    dummy.updateMatrix();
    bucket.matrices.push(dummy.matrix.clone());
  }
  const unitBox = new THREE.BoxGeometry(1,1,1);
  const cylinderGeometries = new Map();
  function cylinderGeometry(n=12,r2=1) {
    const key = `${n}:${r2.toFixed(4)}`;
    if (!cylinderGeometries.has(key)) cylinderGeometries.set(key,new THREE.CylinderGeometry(r2,1,1,n,1,false));
    return cylinderGeometries.get(key);
  }
  function solidBox(c,s,matName) { instanced('box',unitBox,matName,c,s); }
  function box(c,s,tone=1,div=[0,0,0]) {
    solidBox(c,s,toneMaterial(tone));
    // Fine cabinet panel seams remain recess-coloured geometry, not wireframe.
    if (part==='engine' && s[0]>1 && s[1]>.5) {
      for (let i=1;i<Math.min(div[0],6);i++) {
        const x=c[0]-s[0]/2+s[0]*i/div[0];
        for(const sign of [-1,1]) line([x,c[1]-s[1]*.44,c[2]+sign*(s[2]/2+.003)], [x,c[1]+s[1]*.44,c[2]+sign*(s[2]/2+.003)],0);
      }
    }
  }
  function rod(a,b,r,matName,n=10,r2=r) {
    const aa=V(a), bb=V(b), delta=bb.clone().sub(aa), len=delta.length();
    if (len<.00001 || r<=0) return;
    const quaternion=new THREE.Quaternion().setFromUnitVectors(Y,delta.divideScalar(len));
    const ratio=r2/r;
    instanced(`cyl${n}:${ratio.toFixed(4)}`,cylinderGeometry(n,ratio),matName,aa.add(bb).multiplyScalar(.5).toArray(),[r,len,r],quaternion);
  }
  function cylinder(a,b,r,tone=1,n=16,rings=2,r2=r) { rod(a,b,r,toneMaterial(tone),Math.min(n,24),r2); }
  function line(a,b,tone=1,weight=1) { rod(a,b,(tone===0?.004:.0055)*weight,toneMaterial(tone),5); }
  function path(points,tone=1,closed=false,weight=1) {
    for(let i=1;i<points.length;i++) line(points[i-1],points[i],tone,weight);
    if(closed)line(points[points.length-1],points[0],tone,weight);
  }
  function surface(points,matName) {
    const geom=new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(),3));
    geom.setIndex([0,1,2,0,2,3]); geom.computeVertexNormals();
    const mat=materials[matName];
    const mesh=new THREE.Mesh(geom,mat); mesh.name=`${part}: gefaltetes Blech`;
    mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
    // Add a reverse-facing inner surface without making every material double-sided.
    const reverse=geom.clone();reverse.setIndex([2,1,0,3,2,0]);reverse.computeVertexNormals();
    const inner=new THREE.Mesh(reverse,mat);inner.name=`${part}: Blech Innenseite`;group.add(inner);
  }
  function quad(a,b,c,d,nu=0,nv=0,tone=1) {
    // A grille must stay physically open; panels and the sloped hood get faces.
    if(part!=='cage' && !(part==='engine' && a[0]===-2.64)) {
      const roof=part==='engine' && Math.abs(a[2]-d[2])>.3 && Math.abs(a[1]-d[1])<.01;
      surface([a,b,c,d],roof?'paintLight':toneMaterial(tone));
    }
    path([a,b,c,d],tone,true);
    if(part==='cage' || (part==='engine' && a[0]===-2.64)) {
      for(let i=1;i<nu;i++)line(lerp(a,b,i/nu),lerp(d,c,i/nu),tone);
      for(let i=1;i<nv;i++)line(lerp(a,d,i/nv),lerp(b,c,i/nv),tone);
    }
  }
  const torusGeometries = new Map();
  function ring(c,r,axis='z',tone=2,n=24) {
    const minor=Math.min(.012,r*.13), key=`${r}:${minor}:${n}`;
    if(!torusGeometries.has(key))torusGeometries.set(key,new THREE.TorusGeometry(r,minor,5,Math.min(n,24)));
    const q=new THREE.Quaternion();
    if(axis==='y')q.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2);
    if(axis==='x')q.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
    instanced('torus'+key,torusGeometries.get(key),toneMaterial(tone),c,[1,1,1],q);
  }
  function tube(points,r,tone=0,n=8,stride=3) {
    if(points.length<2)return;
    const curve=new THREE.CatmullRomCurve3(points.map(V));
    const geometry=new THREE.TubeGeometry(curve,Math.min(72,Math.max(16,points.length)),r,n,false);
    const mesh=new THREE.Mesh(geometry,materials[toneMaterial(tone)]);
    mesh.name=`${part}: Hydraulikleitung`;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  function bezier(a,b,c,d,steps=28) {
    const out=[];for(let i=0;i<=steps;i++) { const t=i/steps,q=1-t; out.push(a.map((v,k)=>v*q*q*q+3*b[k]*q*q*t+3*c[k]*q*t*t+d[k]*t*t*t)); }return out;
  }
  function bolt(c,axis='z',r=.036,tone=2) {
    const d=axis==='x'?[1,0,0]:axis==='y'?[0,1,0]:[0,0,1];
    rod(add(c,mul(d,-.009)),add(c,mul(d,.012)),r,toneMaterial(tone),6);
  }
  function beam(a,b,w=.07,tone=1) { cylinder(a,b,w,tone,8,1); }
  function flange(y,x,z,r=.25) {
    cylinder([x,y-.035,z],[x,y+.035,z],r,2,24,1);
    for(let i=0;i<8;i++) {const t=i*TAU/8;bolt([x+Math.cos(t)*r*.78,y+.04,z+Math.sin(t)*r*.78],'y',.025);}
  }

  setPart('tracks');
  // Two complete rubber crawler assemblies, with individual track shoes.
  function crawler(z) {
    const left=-1.95,right=.22,cy=.74,r=.52,width=.55;
    // A closed rubber belt, including both side walls. The line reconstruction
    // only described its perimeter; real surfaces carry highlights and shadow.
    function capsule(target,radius) {
      target.moveTo(left,cy-radius);target.lineTo(right,cy-radius);
      target.absarc(right,cy,radius,-Math.PI/2,Math.PI/2,false);
      target.lineTo(left,cy+radius);
      target.absarc(left,cy,radius,Math.PI/2,Math.PI*1.5,false);
      target.closePath();
    }
    const beltShape=new THREE.Shape();capsule(beltShape,.525);
    const opening=new THREE.Path();capsule(opening,.375);beltShape.holes.push(opening);
    const beltGeometry=new THREE.ExtrudeGeometry(beltShape,{depth:width,bevelEnabled:true,bevelSize:.012,bevelThickness:.01,bevelSegments:1,steps:1,curveSegments:18});
    const belt=new THREE.Mesh(beltGeometry,materials.rubber);
    belt.name='tracks: geschlossener Gummiraupenkoerper';belt.position.z=z-width/2;
    belt.castShadow=true;belt.receiveShadow=true;group.add(belt);
    const contour=[];
    for(let i=0;i<18;i++){const t=-Math.PI/2+Math.PI*i/17;contour.push([right+Math.cos(t)*r,cy+Math.sin(t)*r]);}
    for(let i=0;i<18;i++){const t=Math.PI/2+Math.PI*i/17;contour.push([left+Math.cos(t)*r,cy+Math.sin(t)*r]);}
    const layers=7;
    for(let j=0;j<=layers;j++)path(contour.map(p=>[p[0],p[1],z-width/2+width*j/layers]),0,true);
    for(let i=0;i<contour.length;i++)line([contour[i][0],contour[i][1],z-width/2],[contour[i][0],contour[i][1],z+width/2],1);
    // Flat shoe spacing includes the straight runs between both end wheels.
    const shoe=[];
    for(let i=0;i<22;i++)shoe.push([left+(right-left)*i/22,cy-r,-Math.PI/2]);
    for(let i=0;i<16;i++){const t=-Math.PI/2+Math.PI*i/16;shoe.push([right+Math.cos(t)*r,cy+Math.sin(t)*r,t]);}
    for(let i=0;i<22;i++)shoe.push([right-(right-left)*i/22,cy+r,Math.PI/2]);
    for(let i=0;i<16;i++){const t=Math.PI/2+Math.PI*i/16;shoe.push([left+Math.cos(t)*r,cy+Math.sin(t)*r,t]);}
    shoe.forEach(([x,y,t],i)=>{
      const nx=Math.cos(t),ny=Math.sin(t),tx=-ny,ty=nx;
      const p=[x+nx*.036,y+ny*.036];
      const shoeRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),t-Math.PI/2);
      instanced('box',unitBox,'rubber',[p[0],p[1],z],[.089,.065,width*1.1],shoeRotation);
      // Raised transverse tread ribs have an actual profile in side lighting.
      instanced('box',unitBox,'track',[p[0]+nx*.035,p[1]+ny*.035,z],[.035,.018,width*1.04],shoeRotation);
      const q1=[p[0]-tx*.036,p[1]-ty*.036,z-width*.54],q2=[p[0]+tx*.036,p[1]+ty*.036,z-width*.54];
      const q3=[q2[0],q2[1],z+width*.54],q4=[q1[0],q1[1],z+width*.54];
      path([q1,q2,q3,q4],1,true);
      line([x,y,z-width/2],[p[0],p[1],z-width*.54],0);
      line([x,y,z+width/2],[p[0],p[1],z+width*.54],0);
      if(i%2===0)line([p[0],p[1],z-width*.42],[p[0],p[1],z+width*.42],2);
    });
    // Drive wheels and recessed bogie rollers; fine concentric rims read as machinery.
    [left,right].forEach((x,k)=>{
      cylinder([x,cy,z-width*.42],[x,cy,z+width*.42],.414,0,28,3);
      [-1,1].forEach(side=>{
        const zz=z+side*width*.46;
        ring([x,cy,zz],.342,'z',1,28);ring([x,cy,zz],.231,'z',0,24);
        cylinder([x,cy,zz],[x,cy,zz+side*.037],.116,2,16,1);
        for(let i=0;i<8;i++){const t=TAU*i/8;line([x+Math.cos(t)*.14,cy+Math.sin(t)*.14,zz],[x+Math.cos(t)*.32,cy+Math.sin(t)*.32,zz],0);bolt([x+Math.cos(t)*.18,cy+Math.sin(t)*.18,zz],'z',.025);}
      });
    });
    for(let i=0;i<6;i++) {
      const x=left+.28+i*.32;
      cylinder([x,.53,z-.23],[x,.53,z+.23],.235,0,18,2);
      ring([x,.53,z+width*.47],.135,'z',1,16);bolt([x,.53,z+width*.48],'z',.055);
    }
    box([-.87,.79,z+width*.5],[2.16,.32,.075],0,[3,2,0]);
    for(const x of [-1.66,-.15])bolt([x,.8,z+width*.55],'z',.056);
    box([-.85,1.31,z],[2.84,.17,.47],1,[8,0,2]);
  }
  crawler(-.73);crawler(.73);

  setPart('chassis');
  // Undercarriage, cross-members, jacking legs and pivoting foot plates.
  box([-.82,1.38,0],[3.24,.29,1.74],0,[8,2,3]);
  for(const x of [-1.7,-.2,.62])box([x,1.33,0],[.19,.23,1.95],0);
  box([-.84,1.59,0],[3.8,.22,1.89],1,[7,0,4]);
  for(const x of [-2.25,1.24])for(const z of [-1.02,1.02]){
    box([x,1.04,z],[.19,1.27,.2],0,[0,6,0]);
    cylinder([x,.12,z],[x,1.32,z],.064,2,12,3);
    cylinder([x,.08,z],[x,.16,z],.17,2,16,1);
    box([x,.0375,z],[.36,.075,.32],1);
    cylinder([x,1.24,z],[x,1.39,z],.13,1,12,1);
    beam([x,.99,z],[x+(x<0?.25:-.23),1.55,z],.039,2);
  }

  setPart('engine');
  // Engine cabinet: the photo's long orange rear enclosure and sloping bonnet.
  box([-1.14,2.16,0],[3.12,1.09,1.59],1,[6,2,4]);
  box([-2.48,2.25,0],[.28,1.47,1.68],1,[0,3,3]);
  const topRear=[-2.34,2.92,-.795],topRearFront=[-2.34,2.92,.795];
  const topFront=[-.35,2.71,-.795],topFrontFront=[-.35,2.71,.795];
  quad(topRear,topFront,topFrontFront,topRearFront,7,6,1);
  quad([-2.34,2.63,-.795],[-.35,2.63,-.795],topFront,topRear,5,0,1);
  quad([-2.34,2.63,.795],[-.35,2.63,.795],topFrontFront,topRearFront,5,0,1);
  box([-.08,2.2,0],[.61,1.1,1.6],1,[0,2,3]);
  // Folded seams and hinges on the photographed service panels.
  for(const z of [-.809,.809]){
    for(const x of [-2.28,-1.63,-.92,-.39])line([x,1.71,z],[x,2.65,z],0);
    line([-2.34,1.79,z],[-.38,1.79,z],2);
    line([-2.34,2.59,z],[-.38,2.59,z],0);
    for(const x of [-2.25,-1.66,-1.59,-.95,-.88,-.42]){
      box([x,1.83,z],[.034,.13,.023],2);box([x,2.52,z],[.034,.10,.023],2);
    }
    for(const x of [-2.04,-1.36,-.66]){
      box([x,2.15,z+(z>0?.018:-.018)],[.068,.17,.035],0);
      bolt([x,2.34,z],'z',.025);
    }
    // Rear cooling louvres, each with an upper fold and a dark inner rail.
    for(let i=0;i<15;i++){
      const x=-2.41+i*.078;
      line([x,2.77,z],[x+.035,2.87,z],2);
      if(i<11)line([-2.5,1.91+i*.049,z],[-2.37,1.91+i*.049,z],0);
    }
  }
  for(let i=0;i<21;i++)line([-2.19+i*.073,2.94-i*.0077,-.49],[-2.19+i*.073,2.94-i*.0077,.22],0);
  box([-1.72,2.99,-.28],[.42,.055,.39],0,[4,0,4]);
  cylinder([-1.95,2.93,.23],[-1.95,3.07,.23],.065,2,12,1);
  box([-2.02,3.095,.23],[.27,.055,.15],1);
  tube(bezier([-1.15,2.82,-.44],[-1.12,2.99,-.44],[-1.01,3.01,-.44],[-.99,2.85,-.44],8),.034,2,6,2);
  // Perforated rear grille and low bumper.
  quad([-2.64,1.79,-.63],[-2.64,2.56,-.63],[-2.64,2.56,.63],[-2.64,1.79,.63],13,18,0);
  box([-2.64,1.56,0],[.15,.19,1.91],0,[0,0,4]);
  for(const z of [-.7,.7])ring([-2.74,1.78,z],.083,'x',2,14);

  setPart('console');
  // Dense operator console, gauged hydraulic circuits and lever bank (+Z).
  const panelZ=.847;
  box([-.05,2.34,panelZ],[1.09,.66,.087],2,[2,2,0]);
  box([-.05,1.94,panelZ+.022],[1.09,.18,.1],1,[13,0,0]);
  box([-.56,2.38,panelZ],[.35,.49,.09],2);
  box([.25,2.34,panelZ+.054],[.16,.2,.025],0);
  for(let row=0;row<3;row++)for(let col=0;col<4;col++){
    const x=-.45+col*.12,y=2.51-row*.126;
    ring([x,y,panelZ+.052],.042,'z',2,14);
    line([x,y,panelZ+.055],[x+.025*Math.cos(row+col),y+.025*Math.sin(row+col),panelZ+.055],0);
  }
  for(let row=0;row<4;row++)for(let col=0;col<4;col++)bolt([-.68+col*.064,2.53-row*.083,panelZ+.051],'z',.017,0);
  for(let i=0;i<12;i++){
    const x=-.49+i*.084;
    cylinder([x,1.86,panelZ+.05],[x,1.78,panelZ+.21],.012,2,6,1);
    cylinder([x,1.77,panelZ+.19],[x,1.79,panelZ+.24],.025,0,8,1);
    box([x,1.975,panelZ+.08],[.052,.057,.02],0);
  }
  for(let i=0;i<6;i++)ring([.42,2.5-i*.08,panelZ+.055],.021,'z',1,10);
  for(const x of [-.6,.49])for(const y of [2.03,2.65])bolt([x,y,panelZ+.053],'z',.023);

  setPart('mastBase');
  // Mast base turret, hinge cheeks and hydraulic erection rams.
  box([1.11,1.52,0],[1.09,.34,1.59],1,[4,0,5]);
  cylinder([1.22,1.55,0],[1.22,1.82,0],.57,0,32,3);
  flange(1.83,1.22,0,.49);
  box([1.15,2.2,0],[.43,1.17,.91],0,[0,4,0]);
  for(const z of [-.49,.49]){
    box([1.18,2.3,z],[.62,.58,.12],1);
    cylinder([1.18,2.3,z-.085],[1.18,2.3,z+.085],.2,2,20,1);
    ring([1.18,2.3,z+(z>0?.1:-.1)],.11,'z',0,16);
    cylinder([.49,1.63,z],[1.03,4.51,z],.09,0,12,3);
    cylinder([.83,3.48,z],[1.09,4.67,z],.048,2,12,2);
  }

  setPart('mast');
  // Tall slim ROTOMAX feed mast: paired box rails and exposed ladder/rack.
  const bottom=1.84,top=10.48;
  for(const z of [-.28,.28]){
    box([1.12,(bottom+top)/2,z],[.16,top-bottom,.15],1,[0,23,0]);
    box([1.46,(bottom+top)/2,z],[.095,top-bottom,.105],2,[0,24,0]);
    line([1.502,bottom,z],[1.502,top,z],0);
  }
  for(let i=0;i<44;i++){
    const y=bottom+.07+i*(top-bottom-.14)/43;
    // Open rectangular rung mesh, not a tapered lattice oil derrick.
    box([1.29,y,0],[.41,.046,.68],2);
    line([1.03,y,-.34],[1.03,y,.34],0);
  }
  for(const z of [-.37,.37]){
    line([1.035,2.1,z],[1.035,10.13,z],2);
    line([1.515,2.1,z],[1.515,10.13,z],2);
  }
  // Roller chain along the outer feed rail.
  for(let i=0;i<91;i++){
    const y=2.02+i*.09;
    box([1.54,y,-.315],[.048,.058,.065],0);
    if(i%3===0)bolt([1.57,y,-.315],'x',.022,2);
  }
  box([1.29,10.45,0],[.59,.16,.8],2,[3,0,4]);
  box([1.29,9.83,0],[.52,.13,.76],1);
  box([1.28,2.04,0],[.58,.2,.77],1,[3,0,3]);
  cylinder([1.25,10.49,0],[1.25,10.74,0],.17,1,18,2);
  cylinder([1.25,10.71,0],[1.25,10.81,0],.265,2,24,1);

  setPart('hoses');
  // Double hanging hydraulic hose loops down the front of the mast.
  for(let j=0;j<4;j++){
    const zz=-.19+j*.12;
    const hose=bezier([1.51,4.18,zz],[1.82,5.33,zz],[1.84,7.68,zz],[1.78,8.91,zz],23)
      .concat(bezier([1.78,8.91,zz],[1.75,10.11,zz],[.73,10.04,zz],[.77,8.88,zz],14).slice(1))
      .concat(bezier([.77,8.88,zz],[.8,7.49,zz],[.78,5.64,zz],[1.15,4.94,zz],23).slice(1));
    tube(hose,.042,j%2===0?0:2,6,3);
  }
  for(let i=0;i<18;i++){
    const y=5.07+i*.22;
    line([.69,y,-.28],[.69,y,.29],2);
  }
  // A small spotlight at the mast shoulder, visible in the reference.
  beam([1.08,9.81,.26],[.58,9.92,.32],.034,2);
  box([.48,9.95,.34],[.28,.19,.23],0,[2,2,0]);
  ring([.48,9.95,.466],.065,'z',2,12);

  setPart('feed');
  // Sliding feed carriage and orange drive motor at the right of the mast.
  box([1.69,4.18,0],[.45,2.05,.89],1,[0,7,2]);
  for(const y of [3.32,4.99])for(const z of [-.47,.47]){
    box([1.65,y,z],[.6,.23,.15],2);
    cylinder([1.42,y,z-.09],[1.42,y,z+.09],.13,0,16,1);
    bolt([1.42,y,z+(z>0?.1:-.1)],'z',.035);
  }
  // Compact cylindrical rotary drive, flanged sections and lower spindle.
  cylinder([2.04,3.56,.0],[2.04,4.88,.0],.29,1,28,8);
  cylinder([2.04,4.77,0],[2.04,5.06,0],.24,1,24,3);
  cylinder([2.04,3.4,0],[2.04,3.61,0],.34,2,24,2);
  for(const y of [3.58,4.13,4.7,4.94])flange(y,2.04,0,y===4.13?.34:.31);
  box([2.04,3.37,0],[.58,.22,.57],2,[3,0,3]);
  for(const z of [-.3,.3]){
    beam([1.64,3.27,z],[2.31,3.27,z],.033,2);
    beam([1.64,5.14,z],[2.31,5.14,z],.033,2);
    beam([2.31,3.27,z],[2.31,5.14,z],.033,2);
  }
  cylinder([2.04,2.85,0],[2.04,3.29,0],.16,2,24,4);
  cylinder([2.04,2.76,0],[2.04,2.94,0],.22,0,20,2);
  cylinder([2.04,.38,0],[2.04,2.85,0],.079,2,16,9);
  for(let i=0;i<6;i++)ring([2.04,.46+i*.42,0],.09,'y',0,16);
  // Lower breakout clamp and articulated jaws.
  box([1.97,1.18,0],[.92,.22,.76],1,[3,0,2]);
  cylinder([1.98,.67,0],[1.98,.9,0],.36,1,24,3);
  for(const z of [-.32,.32]){
    box([1.94,.96,z],[.83,.18,.17],1,[3,0,0]);
    cylinder([1.69,.85,z-.07],[1.69,.85,z+.07],.105,2,16,1);
    beam([1.67,.95,z],[1.99,.73,z],.04,2);
  }
  flange(.7,1.98,0,.35);

  setPart('hydraulics');
  // Curving drill-head pipe elbow and armoured hydraulic hose bundle.
  tube(bezier([2.05,4.78,-.06],[2.53,5.07,-.06],[2.64,4.37,-.06],[2.57,4.04,-.06],21),.105,1,12,3);
  cylinder([2.54,4.02,-.06],[2.54,3.83,-.06],.135,2,18,2);
  const loop=bezier([1.89,4.91,.31],[1.48,5.89,.31],[2.47,6.13,.31],[2.55,4.75,.31],26)
    .concat(bezier([2.55,4.75,.31],[3.03,2.59,.31],[2.21,2.48,.31],[1.66,2.78,.31],29).slice(1));
  tube(loop,.095,0,10,2);
  for(let j=0;j<3;j++){
    const zz=.4+j*.063;
    tube(bezier([1.62,4.87,zz],[1.05,5.53,zz],[1.09,3.71,zz],[1.88,4.05,zz],28),.026,2,6,3);
    tube(bezier([.52,2.38,zz],[.93,2.31,zz],[.88,3.37,zz],[1.3,3.82,zz],23),.025,0,6,3);
  }
  for(const y of [3.89,4.08])cylinder([2.53,y,-.06],[2.53,y+.06,-.06],.15,2,18,1);
  for(let i=0;i<8;i++){
    const t=i/7;
    cylinder([1.78+t*.37,4.5+t*.04,.29],[1.78+t*.37,4.5+t*.04,.4],.025,2,8,1);
  }

  setPart('cage');
  // Folded mesh guard around the lower working zone: hinged steel frames.
  const cageY0=1.46,cageY1=2.64;
  function cagePanel(a,b) {
    const pa=[a[0],cageY0,a[1]],pb=[b[0],cageY0,b[1]],pc=[b[0],cageY1,b[1]],pd=[a[0],cageY1,a[1]];
    quad(pa,pb,pc,pd,18,17,0);
    beam(pa,pb,.025,2);beam(pb,pc,.025,2);beam(pc,pd,.025,2);beam(pd,pa,.025,2);
    const inset=.04;
    line([a[0],cageY0+inset,a[1]],[b[0],cageY0+inset,b[1]],2);
    line([a[0],cageY1-inset,a[1]],[b[0],cageY1-inset,b[1]],2);
  }
  cagePanel([1.25,.73],[2.28,.73]);
  cagePanel([2.28,.73],[2.63,.32]);
  cagePanel([2.63,.32],[2.63,-.59]);
  cagePanel([2.63,-.59],[1.38,-.73]);
  for(const y of [1.72,2.37])cylinder([1.23,y,.73],[1.23,y+.12,.73],.037,2,10,1);
  box([2.37,2.11,.64],[.035,.16,.065],2);

  setPart('pipeRack');
  // Rear horizontal pipe holder / work table, as on the supplied machine.
  box([.05,3.34,-.49],[1.64,.18,.61],0,[7,0,4]);
  quad([-.79,3.46,-.82],[.82,3.46,-.82],[.82,3.39,-.16],[-.79,3.39,-.16],8,3,2);
  beam([.82,3.29,-.56],[1.1,3.47,-.56],.045,2);
  beam([.82,3.29,-.34],[1.1,3.47,-.34],.045,2);

  setPart('crane');
  // Small articulated service crane above the mast — characteristic silhouette.
  cylinder([1.25,10.76,0],[1.25,11.13,0],.115,1,18,3);
  const base=[1.25,11.02,0],elbow=[1.39,11.63,0],tip=[2.64,12.77,0];
  beam(base,elbow,.092,1);beam(elbow,tip,.074,1);
  beam([1.16,11.03,-.1],[1.26,11.63,-.1],.035,2);
  beam([1.16,11.03,.1],[1.26,11.63,.1],.035,2);
  beam([1.32,11.19,-.12],[2.01,12.18,-.12],.042,0);
  cylinder([1.37,11.29,-.13],[1.68,11.75,-.13],.044,2,10,2);
  beam([1.16,11.7,0],[1.98,12.13,0],.034,1);
  for(const c of [base,elbow,tip]){
    cylinder([c[0],c[1],-.105],[c[0],c[1],.105],.1,2,18,1);
    bolt([c[0],c[1],.12],'z',.038);
  }
  // Wire rope, pulley, hanging swivel and open hook.
  line([1.28,11.76,-.04],[2.67,12.84,-.04],2);
  ring([2.66,12.77,0],.085,'z',0,18);
  line([2.7,12.76,0],[2.7,12.28,0],2);
  line([2.65,12.75,0],[2.65,12.28,0],0);
  cylinder([2.675,12.16,0],[2.675,12.29,0],.061,2,12,2);
  line([2.675,12.16,0],[2.675,11.98,0],2);
  const hook=[];for(let i=0;i<17;i++){const t=.08+Math.PI*1.58*i/16;hook.push([2.71-Math.sin(t)*.083,11.94+Math.cos(t)*.083,0]);}
  tube(hook,.015,2,6,2);
  // Mast crane slewing handle and offset pivot bracket.
  beam([1.2,10.84,0],[.93,10.97,.05],.041,1);
  cylinder([.9,10.97,.05],[.95,10.97,.05],.07,2,12,1);

  setPart('hardware');
  // Small but legible hardware: amber beacons, rear tie-downs and hose ports.
  for(const z of [-.68,.68]){
    box([.57,1.73,z],[.16,.14,.1],0);
    ring([.57,1.73,z+(z>0?.065:-.065)],.045,'z',2,12);
  }
  for(let i=0;i<5;i++){
    const z=-.33+i*.16;
    cylinder([.59,2.55,z],[.84,2.55,z],.036,2,10,1);
  }



  // Small, readable manufactured surfaces above the structural reconstruction.
  setPart('console');
  for(let row=0;row<3;row++)for(let col=0;col<4;col++) {
    const x=-.45+col*.12,y=2.51-row*.126,z=.906;
    rod([x,y,z-.005],[x,y,z+.006],.033,'white',20);
    const t=-.8+row*.65+col*.32;
    rod([x,y,z+.008],[x+Math.cos(t)*.024,y+Math.sin(t)*.024,z+.008],.0025,'black',4);
  }
  for(const x of [.1,.22,.34])rod([x,2.07,.92],[x,2.07,.932],.026,x===.34?'red':'black',12);

  // Distinct panel plates, hinges and split rubber crawler shoes.
  setPart('engine');
  for(const z of [-.825,.825])for(const x of [-2.04,-1.36,-.66]) {
    solidBox([x,2.19,z],[.052,.15,.025],'black');
    rod([x,2.12,z+.02],[x,2.25,z+.02],.013,'steelDark',8);
  }
  setPart('hardware');
  rod([-2.04,2.96,.23],[-2.04,3.05,.23],.044,'black',12);
  rod([-2.04,3.05,.23],[-2.04,3.15,.23],.056,'amber',16);
  for(const z of [-.76,.76]) {
    solidBox([-2.735,1.66,z],[.03,.095,.14],'red');
    solidBox([.79,1.71,z],[.05,.09,.12],'white');
  }
  // A pale rating plate on the service panel supplies the photo's visual scale.
  solidBox([-.66,2.49,.832],[.19,.095,.008],'panel');
  for(let i=0;i<4;i++)solidBox([-.72+i*.035,2.51,.838],[.018,.008,.002],'black');

  // Efficient instancing keeps hundreds of bolts, shoes and steel mesh bars cheap.
  let instanceCount=0;
  for(const [key,bucket] of buckets) {
    const mesh=new THREE.InstancedMesh(bucket.geometry,materials[bucket.matName],bucket.matrices.length);
    mesh.name=`${bucket.part}: ${bucket.matName}`;
    bucket.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
    mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=true;mesh.receiveShadow=true;
    mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
    instanceCount+=bucket.matrices.length;
  }

  let drawLettering=()=>{};
  function addLettering() {
    if(typeof document==='undefined')return;
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=160;
    const ctx=canvas.getContext('2d');
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    drawLettering=mode=>{
      ctx.clearRect(0,0,1024,160);
      if(mode==='original'){
        ctx.fillStyle='#f2eee4';
        ctx.font='italic 800 93px Arial, sans-serif';ctx.fillText('BOHRTECHNIK',6,108);
        ctx.font='500 44px Arial, sans-serif';ctx.fillText('',620,107);
      }else{
        // Firmenschrift wie im Logo: «Thermobohr» hell auf dunklem Lack, «AG» hellgruen.
        ctx.fillStyle='#eef3ea';ctx.font='300 92px "Helvetica Neue", Arial, sans-serif';
        ctx.fillText('Thermobohr',8,106);
        const w=ctx.measureText('Thermobohr').width;
        ctx.fillStyle=mode==='gruen'?'#d9ecc4':'#8cc95a';ctx.fillText('AG',w+34,106);
      }
      tex.needsUpdate=true;
    };
    const mat=new THREE.MeshStandardMaterial({map:tex,transparent:true,depthWrite:false,roughness:.6,metalness:.1});
    mat.name='Foto-orientierte Modellbeschriftung';
    for(const side of [-1,1]) {
      const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.63,.17),mat);
      mesh.position.set(-1.4,2.73,side*.805);mesh.rotation.y=side<0?Math.PI:0;
      mesh.rotation.z=side<0?.105:-.105;
      mesh.renderOrder=2;mesh.name='ROTOMAX XL GTi Modellschrift';group.add(mesh);
    }
  }
  addLettering();

  // paint / paintShade / paintLight / accent je Farbmodus.
  const PALETTES={
    original:['#e76c14','#bc4d0e','#f78c32','#e76c14'],
    thermobohr:['#1d5c2e','#164a25','#2a7340','#6aaa3a'],
    gruen:['#1d5c2e','#164a25','#2a7340','#1d5c2e'],
  };
  function setColorMode(next='original') {
    colorMode=PALETTES[next]?next:'original';
    const [paint,shade,light,accent]=PALETTES[colorMode];
    materials.paint.color.set(paint);
    materials.paintShade.color.set(shade);
    materials.paintLight.color.set(light);
    materials.accent.color.set(accent);
    drawLettering(colorMode);
    group.userData.colorMode=colorMode;
  }
  setColorMode(colorMode);
  group.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(group);
  const metadata={
    type:'manual-photo-guided-mesh',
    source:'Volragen/Bohrer Rotomax.webp',
    drillAxis:{x:2.04,z:0,groundY:0},
    bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},
    dimensions:bounds.getSize(new THREE.Vector3()).toArray(),
    instances:instanceCount,drawGroups:group.children.length,
    accuracy:'Manuelle Formstudie nach Einzelbild; keine photogrammetrische Vermessung. Rueckseiten und verdeckte Details sind angenaehert.',
    axes:{x:'vehicle length; engine negative X',y:'up',z:'operator console positive Z'},
    recommendedView:{position:[-10,6.4,18],target:[.1,6.2,0]},
  };
  group.userData.metadata=metadata;
  return {group,materials,metadata,setColorMode};
}
