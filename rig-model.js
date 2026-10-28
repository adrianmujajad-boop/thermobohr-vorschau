/*
 * THERMOBOHR — ROTOMAX line reconstruction.
 * Drawn from Volragen/Bohrer Rotomax.webp, not a generic offshore tower.
 * No dependencies, textures, image tracing, or network calls.
 * X is vehicle length (rear = negative X), Y is up, Z is track width.
 * The photographed controls face +Z. A yaw of about -0.48 and pitch 0.10
 * keeps the engine on the left, the drill on the right, and the cage visible.
 */
(function () {
  'use strict';
  const segments = [];
  const TAU = Math.PI * 2;
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const mul = (a, s) => a.map(v => v * s);
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm = a => { const n = Math.hypot(...a) || 1; return mul(a, 1/n); };
  function line(a, b, tone = 1, weight = 1) {
    segments.push({ a, b, tone, weight });
  }
  function path(points, tone = 1, closed = false, weight = 1) {
    for (let i=1;i<points.length;i++) line(points[i-1],points[i],tone,weight);
    if (closed) line(points[points.length-1],points[0],tone,weight);
  }
  function quad(a,b,c,d,nu=0,nv=0,tone=1) {
    path([a,b,c,d],tone,true);
    for(let i=1;i<nu;i++) line(lerp(a,b,i/nu),lerp(d,c,i/nu),tone);
    for(let i=1;i<nv;i++) line(lerp(a,d,i/nv),lerp(b,c,i/nv),tone);
  }
  function box(c,s,tone=1,div=[0,0,0]) {
    const [x,y,z]=c,[w,h,d]=s.map(n=>n/2);
    const a=[x-w,y-h,z-d],b=[x+w,y-h,z-d],cc=[x+w,y+h,z-d],dd=[x-w,y+h,z-d];
    const e=[x-w,y-h,z+d],f=[x+w,y-h,z+d],g=[x+w,y+h,z+d],hh=[x-w,y+h,z+d];
    path([a,b,cc,dd],tone,true);path([e,f,g,hh],tone,true);
    line(a,e,tone);line(b,f,tone);line(cc,g,tone);line(dd,hh,tone);
    for(let i=1;i<div[0];i++) {let t=i/div[0];line(lerp(a,b,t),lerp(dd,cc,t),tone);line(lerp(e,f,t),lerp(hh,g,t),tone);line(lerp(dd,cc,t),lerp(hh,g,t),tone);}
    for(let i=1;i<div[1];i++) {let t=i/div[1];line(lerp(a,dd,t),lerp(b,cc,t),tone);line(lerp(e,hh,t),lerp(f,g,t),tone);line(lerp(a,dd,t),lerp(e,hh,t),tone);line(lerp(b,cc,t),lerp(f,g,t),tone);}
    for(let i=1;i<div[2];i++) {let t=i/div[2];line(lerp(a,e,t),lerp(dd,hh,t),tone);line(lerp(b,f,t),lerp(cc,g,t),tone);line(lerp(dd,hh,t),lerp(cc,g,t),tone);}
  }
  function cylinder(a,b,r,tone=1,n=16,rings=2,r2=r) {
    // Fine curves retain their silhouette while avoiding redundant tiny strokes.
    if(n>12)n=Math.round(n*.82);
    if(rings>2)rings-=1;
    const axis=norm(sub(b,a));
    const u=norm(cross(axis,Math.abs(axis[1])<0.9?[0,1,0]:[0,0,1]));
    const v=norm(cross(axis,u));
    const ringsPoints=[];
    for(let j=0;j<=rings;j++) {
      const t=j/rings,center=lerp(a,b,t),radius=r+(r2-r)*t,ps=[];
      for(let i=0;i<n;i++){const th=TAU*i/n;ps.push(add(center,add(mul(u,Math.cos(th)*radius),mul(v,Math.sin(th)*radius))));}
      path(ps,tone,true);ringsPoints.push(ps);
    }
    for(let i=0;i<n;i++) line(ringsPoints[0][i],ringsPoints[rings][i],tone);
    return ringsPoints;
  }
  function ring(c,r,axis='z',tone=2,n=24) {
    if(n>14)n=Math.round(n*.86);
    const p=[];for(let i=0;i<n;i++){const t=TAU*i/n;if(axis==='z')p.push([c[0]+Math.cos(t)*r,c[1]+Math.sin(t)*r,c[2]]);else if(axis==='x')p.push([c[0],c[1]+Math.cos(t)*r,c[2]+Math.sin(t)*r]);else p.push([c[0]+Math.cos(t)*r,c[1],c[2]+Math.sin(t)*r]);}path(p,tone,true);
  }
  function tube(points,r,tone=0,n=8,stride=3) {
    let previous=null;
    points.forEach((center,i)=>{
      const tangent=norm(sub(points[Math.min(i+1,points.length-1)],points[Math.max(0,i-1)]));
      const u=norm(cross(tangent,Math.abs(tangent[2])<.9?[0,0,1]:[1,0,0]));
      const v=cross(tangent,u), ps=[];
      for(let k=0;k<n;k++){const th=TAU*k/n;ps.push(add(center,add(mul(u,Math.cos(th)*r),mul(v,Math.sin(th)*r))));}
      if(i%stride===0||i===points.length-1)path(ps,tone,true);
      if(previous)for(let k=0;k<n;k++)line(previous[k],ps[k],tone);
      previous=ps;
    });
  }
  function bezier(a,b,c,d,steps=28) {
    const out=[];for(let i=0;i<=steps;i++){const t=i/steps,q=1-t;out.push(a.map((v,k)=>v*q*q*q+3*b[k]*q*q*t+3*c[k]*q*t*t+d[k]*t*t*t));}return out;
  }
  function bolt(c,axis='z',r=.036,tone=2) {ring(c,r,axis,tone,6);}
  function beam(a,b,w=.07,tone=1) {cylinder(a,b,w,tone,4,1);}
  function flange(y,x,z,r=.25) {
    cylinder([x,y-.045,z],[x,y+.045,z],r,2,24,1);
    for(let i=0;i<8;i++){const t=i*TAU/8;bolt([x+Math.cos(t)*r*.78,y+.048,z+Math.sin(t)*r*.78],'y',.026);}
  }

  // Two complete rubber crawler assemblies, with individual track shoes.
  function crawler(z) {
    const left=-1.95,right=.22,cy=.74,r=.52,width=.55;
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

  // Undercarriage, cross-members, jacking legs and pivoting foot plates.
  box([-.82,1.38,0],[3.24,.29,1.74],0,[8,2,3]);
  for(const x of [-1.7,-.2,.62])box([x,1.33,0],[.19,.23,1.95],0);
  box([-.84,1.59,0],[3.8,.22,1.89],1,[7,0,4]);
  for(const x of [-2.25,1.24])for(const z of [-1.02,1.02]){
    box([x,1.04,z],[.19,1.27,.2],0,[0,6,0]);
    cylinder([x,.12,z],[x,1.32,z],.064,2,12,3);
    cylinder([x,.08,z],[x,.16,z],.17,2,16,1);
    box([x,.047,z],[.36,.075,.32],1);
    cylinder([x,1.24,z],[x,1.39,z],.13,1,12,1);
    beam([x,.99,z],[x+(x<0?.25:-.23),1.55,z],.039,2);
  }

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

  // Rear horizontal pipe holder / work table, as on the supplied machine.
  box([.05,3.34,-.49],[1.64,.18,.61],0,[7,0,4]);
  quad([-.79,3.46,-.82],[.82,3.46,-.82],[.82,3.39,-.16],[-.79,3.39,-.16],8,3,2);
  beam([.82,3.29,-.56],[1.1,3.47,-.56],.045,2);
  beam([.82,3.29,-.34],[1.1,3.47,-.34],.045,2);

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

  // Small but legible hardware: amber beacons, rear tie-downs and hose ports.
  for(const z of [-.68,.68]){
    box([.57,1.73,z],[.16,.14,.1],0);
    ring([.57,1.73,z+(z>0?.065:-.065)],.045,'z',2,12);
  }
  for(let i=0;i<5;i++){
    const z=-.33+i*.16;
    cylinder([.59,2.55,z],[.84,2.55,z],.036,2,10,1);
  }

  // Adjacent mechanical components sometimes share an exact edge. Draw it once.
  const unique=new Map();
  segments.forEach(s=>{
    const aa=s.a.map(v=>v.toFixed(5)).join(','),bb=s.b.map(v=>v.toFixed(5)).join(',');
    const key=aa<bb?aa+'|'+bb:bb+'|'+aa,old=unique.get(key);
    if(!old||s.tone>old.tone)unique.set(key,s);
  });
  segments.length=0;segments.push(...unique.values());
  const minimum=[Infinity,Infinity,Infinity],maximum=[-Infinity,-Infinity,-Infinity];
  segments.forEach(s=>[s.a,s.b].forEach(p=>p.forEach((v,i)=>{minimum[i]=Math.min(minimum[i],v);maximum[i]=Math.max(maximum[i],v);})));
  window.ThermobohrModel={
    segments,
    bounds:{min:minimum,max:maximum},
    source:'Volragen/Bohrer Rotomax.webp',
    axes:{x:'vehicle length; engine at negative X',y:'up',z:'controls face positive Z'},
    recommendedView:{yaw:-.48,pitch:.10,target:[.03,6.3,0]}
  };
})();
