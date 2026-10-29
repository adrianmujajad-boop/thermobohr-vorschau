/**
 * Linie & Realität v002 – echte 3D-Ebene unter der Linienzeichnung der Website.
 *
 * kombi.js (Website v006) zeichnet wie bisher die Linien auf #szene und ruft danach
 * ThermobohrEcht.zeichne(K, z, p, zeit, spin, ende) auf. Mit genau dieser Kamera
 * (Position, Blickhöhe, Brennweite, Bildmitte) entsteht hier das echte Bild auf
 * #echt, durchsichtig über der Bühnenfarbe der Website:
 * - das Bohrgerät in den Logofarben, die Baustelle als Insel (ohne Wiese und Himmel –
 *   die Landschaft bleibt das Linienrelief der Website),
 * - unter Tage Gestänge, Imlochhammer, Krone, Schutzverrohrung, Erdsonde und
 *   Hinterfüllung in den Massen der Website (dort zur Sichtbarkeit überhöht),
 * - feine Kanten auf den Baustellenteilen, die die Website nicht zeichnet.
 * Weltkoordinaten wie kombi.js: Bohrachse x = z = 0, Gelände y = 0, Gerät dreifach.
 */
import * as THREE from 'three';
import { EffectComposer } from './vendor/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './vendor/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from './vendor/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from './vendor/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from './vendor/examples/jsm/postprocessing/ShaderPass.js';
import { Pass } from './vendor/examples/jsm/postprocessing/Pass.js';
import { createRig } from './rig-solid.js';
import { createBaustelle } from './baustelle.js';
import { verwittern } from './verwitterung.js';

const canvas = document.getElementById('echt');
if (canvas) start();

function start() {
  const SKALA = 3, ACHSE = 2.04;                 // wie RIG_SKALA / RIG_ACHSE in kombi.js
  const ENDTIEFE = 500, VERROHRUNG = 24;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  const smooth = t => t * t * (3 - 2 * t);
  const tief = matchMedia('(max-width: 760px)').matches || Math.min(innerWidth, innerHeight) < 600;

  // -------------------------------------------------------------- Renderer
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  // Handy: so scharf wie die Linien der Website (bis zweifach), und nie unter 1,5-fach.
  const quality = { ratio: Math.min(devicePixelRatio, tief ? 2 : 1.5), min: tief ? 1.5 : 1 };
  renderer.setPixelRatio(quality.ratio);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, .3, 6000);   // FOV wie kombi.js

  // Spiegelungen aus einem hellen Himmel – zu sehen ist er nicht, der Hintergrund bleibt die Bühnenfarbe.
  {
    const sky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec3 vDir; void main(){
        float h = max(vDir.y, 0.0);
        vec3 c = mix(vec3(.62,.7,.72), vec3(.2,.38,.6), pow(h, .6));
        c = mix(c, vec3(.32,.33,.27), smoothstep(0.0, -.15, vDir.y));
        gl_FragColor = vec4(c, 1.0); }`,
    }));
    const envScene = new THREE.Scene(); envScene.add(sky);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(envScene, .02).texture; scene.environmentIntensity = .6;
    pmrem.dispose();
  }
  const SUN_DIR = new THREE.Vector3(-.58, .62, .53).normalize();
  const hemi = new THREE.HemisphereLight('#d6e4ec', '#5c5a44', .75); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffeeda', 3.3);
  sun.position.copy(SUN_DIR).multiplyScalar(180); sun.target.position.set(-4, 0, -6);
  scene.add(sun, sun.target);
  // Unter Tage: eine Lampe an der Kamera, damit Stahl und Krone von unten lesbar bleiben.
  const lampe = new THREE.PointLight('#fff2e2', 0, 160, 1.1); lampe.position.set(1.5, 2, 0);
  camera.add(lampe); scene.add(camera);
  const HEMI_BODEN = new THREE.Color('#5c5a44'), HEMI_BODEN_TIEF = new THREE.Color('#8c8a78');
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 30, far: 420 });
  sun.shadow.mapSize.set(tief ? 2048 : 3072, tief ? 2048 : 3072); sun.shadow.bias = -.0003; sun.shadow.normalBias = .08;

  // ---------------------------------------------------- Oberfläche (dreifach)
  const oben = new THREE.Group(); oben.name = 'Oberfläche';
  oben.scale.setScalar(SKALA); oben.position.set(-ACHSE * SKALA, 0, 0);
  scene.add(oben);
  const rig = createRig(THREE, { colorMode: 'thermobohr' });
  oben.add(rig.group);
  const site = createBaustelle(THREE, { logoUrl: 'echt/Logo-dunkel.png', nurBaustelle: true });
  oben.add(site.group);
  {
    const CLEAN = new Set(['glas', 'scheibe', 'reflex', 'signal', 'kegel', 'white', 'amber', 'red', 'panel']);
    const LESS = new Set(['putz', 'dach', 'sockel', 'weiss']);
    const seen = new Set();
    oben.traverse(o => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (seen.has(m) || !m.isMeshStandardMaterial || m.map || m.transparent || CLEAN.has(m.name)) continue;
        seen.add(m); verwittern(m, { dirt: LESS.has(m.name) ? .45 : 1, grime: LESS.has(m.name) ? .7 : 1 });
      }
    });
  }

  // ------------------------------------------- Unter Tage (Masse wie kombi.js)
  const unten = new THREE.Group(); unten.name = 'Bohrung echt'; scene.add(unten);
  const M = (color, roughness = .4, metalness = .8, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, transparent: true, ...extra });
  const mRohr = M('#8a959a', .36), mMuffe = M('#a9b2b5', .3), mHammer = M('#4f595d', .42), mKrone = M('#6c767a', .33),
    mStift = M('#e3e7e8', .18, .9), mLoch = M('#121517', .9, .2), mVerr = M('#aab2b1', .38, .82, { side: THREE.DoubleSide }),
    mFuell = M('#a5a194', .95, 0), mSonde = M('#6aaa3a', .45, .05), mFuss = M('#4a5256', .5, .6);
  const alleUnten = [mRohr, mMuffe, mHammer, mKrone, mStift, mLoch, mVerr, mFuell, mSonde, mFuss];
  const zyl = (r1, r2, h, seg = 32, open = false) => new THREE.CylinderGeometry(r1, r2, h, seg, 1, open);
  const mesh = (g, m, parent = unten) => { const o = new THREE.Mesh(g, m); o.castShadow = false; o.receiveShadow = false; parent.add(o); return o; };

  // Gestänge (dreht): Rohr, Muffen alle 3 m, Sechskant-Kupplung, Konus, Imlochhammer.
  const dreh = new THREE.Group(); unten.add(dreh);
  const rohr = mesh(zyl(.6, .6, 1, 28), mRohr, dreh);
  const MUFFEN = 190;
  const muffen = new THREE.InstancedMesh(zyl(.74, .74, .5, 28), mMuffe, MUFFEN); muffen.frustumCulled = false; dreh.add(muffen);
  const zapfen = new THREE.InstancedMesh(zyl(.66, .74, .1, 28), mMuffe, MUFFEN); zapfen.frustumCulled = false; dreh.add(zapfen);
  const kupplung = mesh(zyl(.82, .82, .5, 6), mHammer, dreh);
  const konus = mesh(zyl(.6, .82, .3, 28), mHammer, dreh);
  const hammer = mesh(zyl(.92, .92, 4, 36), mHammer, dreh);
  const hammerRinge = [0, .15, .8, .9, 3.85, 4].map(() => mesh(zyl(.95, .95, .06, 36), mMuffe, dreh));
  // Bohrkrone wie bohrkopfAlternative(): Schaft mit Keilnuten, Schulter, Kopf, Hartmetallstifte, Spülbohrungen.
  const krone = new THREE.Group(); dreh.add(krone);
  const schaft = mesh(zyl(.9, .9, 1, 32), mHammer, krone);
  mesh(zyl(.78, .78, .44, 32), mKrone, krone).position.y = .92;
  for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2, k = mesh(new THREE.BoxGeometry(.08, .4, .16), mKrone, krone); k.position.set(Math.cos(t) * .8, .9, Math.sin(t) * .8); k.rotation.y = -t; }
  mesh(zyl(.8, 1.17, .14, 40), mKrone, krone).position.y = .63;
  mesh(zyl(1.17, 1.17, .35, 40), mKrone, krone).position.y = .385;
  mesh(zyl(1.17, 1.12, .13, 40), mKrone, krone).position.y = .145;
  {
    const stifte = new THREE.InstancedMesh(new THREE.SphereGeometry(.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mStift, 16);
    const o = new THREE.Object3D();
    for (let i = 0; i < 16; i++) {
      const aussen = i < 8, t = (i % 8) / 8 * Math.PI * 2 + (aussen ? 0 : .39), r = aussen ? .98 : .5;
      o.position.set(Math.cos(t) * r, .08, Math.sin(t) * r);
      o.rotation.set(Math.PI, 0, aussen ? .45 : 0); o.rotation.y = -t; o.updateMatrix(); stifte.setMatrixAt(i, o.matrix);
    }
    krone.add(stifte);
    for (const s of [-1, 1]) mesh(zyl(.11, .11, .02, 16), mLoch, krone).position.set(s * .25, .075, 0);
  }

  // Schutzverrohrung mit Stössen alle 3 m.
  const verrohrung = new THREE.Group(); unten.add(verrohrung);
  const verrMantel = mesh(zyl(1.38, 1.38, 1, 48, true), mVerr, verrohrung);
  const STOESSE = 12;
  const stoesse = new THREE.InstancedMesh(new THREE.TorusGeometry(1.4, .05, 6, 48), mMuffe, STOESSE); stoesse.frustumCulled = false; verrohrung.add(stoesse);
  // Hinterfüllung (von unten verpresst) und Doppel-U-Sonde mit Sondenfuss.
  const fuellung = mesh(zyl(1.2, 1.2, 1, 36), mFuell);
  const sonde = new THREE.Group(); unten.add(sonde);
  const ROHRE = [[.42, 0], [-.42, 0], [0, .42], [0, -.42]];
  const schenkel = ROHRE.map(([x, zz]) => { const o = mesh(zyl(.13, .13, 1, 12), mSonde, sonde); o.position.set(x, 0, zz); return o; });
  const fuss = mesh(zyl(.52, .52, 1.7, 24), mFuss, sonde);

  const o3 = new THREE.Object3D();
  function setzeUnten(z, p, spin, ende, einstieg) {
    // Wie in kombi.js: im Hero bleibt der Untergrund unsichtbar, am Schluss tritt er zurück.
    const a = smooth(range(p, .008, .06)) * (1 - ende);
    const sichtbar = (m, w) => { m.opacity = w; m.depthWrite = w > .98; m.visible = w > .01; };
    const g = z.gestaenge * a;
    // Einstieg und Schluss: nur die Krone an der Spindel, wie die Linienzeichnung.
    const nurKrone = Math.max(ende > .02 ? smooth(ende) : 0, einstieg);
    const yb = nurKrone > g ? 0 : -z.meissel;
    const yHammer = yb + 1.6, yKupplung = yb + 5.6, yKonus = yb + 6.1, unterkante = yb + 6.4, yTop = .38 * SKALA;
    const wGest = Math.max(g, nurKrone);
    for (const m of [mRohr, mMuffe, mHammer, mKrone, mStift, mLoch]) sichtbar(m, wGest);
    dreh.rotation.y = spin;
    // Rohr und Muffen nur, solange gebohrt wird (Schluss: Schaft bis 6 m wie bohrkopfAlternative).
    const lang = yTop - unterkante;
    rohr.visible = g > .01 && lang > .05;
    if (rohr.visible) { rohr.scale.set(1, lang, 1); rohr.position.y = (unterkante + yTop) / 2; }
    let n = 0;
    if (g > .01) for (let y = unterkante + 3; y + .55 < yTop && n < MUFFEN; y += 3, n++) {
      o3.rotation.set(0, 0, 0); o3.scale.set(1, 1, 1);
      o3.position.set(0, y + .25, 0); o3.updateMatrix(); muffen.setMatrixAt(n, o3.matrix);
      o3.position.set(0, y + .55, 0); o3.updateMatrix(); zapfen.setMatrixAt(n, o3.matrix);
    }
    muffen.count = zapfen.count = n; muffen.instanceMatrix.needsUpdate = zapfen.instanceMatrix.needsUpdate = true;
    kupplung.visible = konus.visible = hammer.visible = g > .01;
    kupplung.position.y = (yKupplung + yKonus) / 2; konus.position.y = (yKonus + unterkante) / 2;
    hammer.position.y = (yHammer + yKupplung) / 2;
    [yHammer, yHammer + .15, yHammer + .8, yHammer + .9, yKupplung - .15, yKupplung].forEach((y, i) => { hammerRinge[i].position.y = y; hammerRinge[i].visible = g > .01; });
    krone.position.y = yb;
    const schaftOben = g > .01 ? yHammer : 6;
    schaft.scale.set(1, schaftOben - (yb + 1.14), 1); schaft.position.y = (schaftOben - (yb + 1.14)) / 2 + 1.14;

    // Verrohrung: bis 24 m, am Schluss gezogen.
    const verr = Math.min(z.bohrtiefe, VERROHRUNG), dy = z.verrohrungRaus * 26, wV = a * (1 - z.verrohrungRaus);
    sichtbar(mVerr, wV);
    verrohrung.visible = verr > .05 && wV > .01;
    if (verrohrung.visible) {
      const yT = 1.2 + dy, yB = -verr + dy;
      verrMantel.scale.set(1, yT - yB, 1); verrMantel.position.y = (yT + yB) / 2;
      let k = 0;
      for (let y = yT - 3; y > yB && k < STOESSE; y -= 3, k++) { o3.position.set(0, y, 0); o3.rotation.set(Math.PI / 2, 0, 0); o3.updateMatrix(); stoesse.setMatrixAt(k, o3.matrix); }
      stoesse.count = k; stoesse.instanceMatrix.needsUpdate = true;
    }
    // Hinterfüllung.
    sichtbar(mFuell, a);
    fuellung.visible = z.verpressung > 0 && a > .01;
    if (fuellung.visible) { const ob = -ENDTIEFE * (1 - z.verpressung); fuellung.scale.set(1, ob + ENDTIEFE, 1); fuellung.position.y = (ob - ENDTIEFE) / 2; }
    // Sonde: vier Rohre bis zum Fuss, im Betrieb leicht warm.
    sichtbar(mSonde, a); sichtbar(mFuss, a);
    sonde.visible = z.sonde > .01 && a > .01;
    if (sonde.visible) {
      const yf = -z.sonde, yFuss = yf + 1.7, yT = .6;
      for (const s of schenkel) { s.scale.set(1, yT - yFuss, 1); s.position.y = (yT + yFuss) / 2; }
      fuss.position.y = yf + .85;
      mSonde.emissive.set('#ff8a3a'); mSonde.emissiveIntensity = z.waerme * .45;
    }
    unten.visible = alleUnten.some(m => m.visible);
  }

  // ------------------------------------------- Normalen und Tiefe (für Kanten)
  // Wie in Linie & Realität v001: ein Durchgang speist die Umgebungsverdeckung und
  // die Kantenzeichnung. Alpha = Abstand zur Kamera, beim Gerät und unter Tage negativ
  // (diese Teile zeichnet die Website selbst in Linien).
  const ndTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthTexture: new THREE.DepthTexture(1, 1) });
  const ndMats = new Map();
  function ndMaterial(eigen, side) {
    const key = (eigen ? 'e' : 's') + side;
    if (!ndMats.has(key)) ndMats.set(key, new THREE.ShaderMaterial({
      side,
      vertexShader: `#include <common>
        varying vec3 vN; varying float vZ;
        void main(){
          #include <beginnormal_vertex>
          #include <defaultnormal_vertex>
          #include <begin_vertex>
          #include <project_vertex>
          vN = normalize(transformedNormal); vZ = -mvPosition.z;
        }`,
      fragmentShader: `varying vec3 vN; varying float vZ;
        void main(){ vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0); gl_FragColor = vec4(n * .5 + .5, ${eigen ? '-vZ' : 'vZ'}); }`,
    }));
    return ndMats.get(key);
  }
  const ndList = [];
  function collectND() {
    const eigen = new Set(); rig.group.traverse(o => eigen.add(o)); unten.traverse(o => eigen.add(o));
    scene.traverse(o => { if (o.isMesh) ndList.push({ o, eigen: eigen.has(o), m: null, v: true }); });
  }
  const keep = new THREE.Color();
  // Auf dem Handy braucht es das Normalenbild nur für die kurze Blende beim Eintauchen
  // (dort gibt es weder Umgebungsverdeckung noch feine Kanten).
  let ndNoetig = true;
  function renderND(r) {
    kanten.uniforms.uND.value = ndNoetig ? 1 : 0;
    if (!ndNoetig) return;
    if (!ndList.length) collectND();
    for (const e of ndList) {
      const o = e.o, m = o.material; e.m = m; e.v = o.visible;
      if (!o.visible) continue;
      if (m.transparent || o.userData.noND || o.userData.fern) { o.visible = false; continue; }
      o.material = ndMaterial(e.eigen, m.side === THREE.DoubleSide ? THREE.DoubleSide : THREE.FrontSide);
    }
    r.getClearColor(keep); const ka = r.getClearAlpha();
    r.setRenderTarget(ndTarget); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, camera);
    r.setClearColor(keep, ka);
    for (const e of ndList) { e.o.material = e.m; e.o.visible = e.v; }
  }
  class FnPass extends Pass {
    constructor(fn) { super(); this.fn = fn; this.needsSwap = false; this.clear = false; }
    render(r) { this.fn(r); }
  }

  // -------------------------------------------------------- Nachbearbeitung
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: tief ? 2 : 4 }));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new FnPass(renderND));
  const gtao = new GTAOPass(scene, camera, 1, 1);
  gtao.setGBuffer(ndTarget.depthTexture, ndTarget.texture);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = .9;
  gtao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.6, thickness: 3.5, scale: 1.1, samples: tief ? 8 : 12, distanceFallOff: 1, screenSpaceRadius: false });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, radiusExponent: 1, rings: 2, samples: 8 });
  gtao.setSceneClipBox(new THREE.Box3(new THREE.Vector3(-150, -6, -150), new THREE.Vector3(150, 130, 150)));
  gtao.enabled = !tief;
  composer.addPass(gtao);
  composer.addPass(new OutputPass());
  // Kanten der Baustellenteile in den Linienfarben der Website; die Bühne bleibt durchsichtig.
  const kanten = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, tND: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uBlock: { value: new THREE.Vector3(130 / 255, 185 / 255, 140 / 255) }, uKraft: { value: tief ? 0 : .7 }, uOben: { value: 1 }, uND: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      uniform sampler2D tDiffuse, tND; uniform vec2 uRes; uniform vec3 uBlock; uniform float uKraft, uOben, uND;
      varying vec2 vUv;
      void main(){
        vec4 echt = texture2D(tDiffuse, vUv);
        vec2 px = 1.0 / uRes;
        vec4 c = uND > .5 ? texture2D(tND, vUv) : vec4(0.0);
        float e = 0.0;
        if (c.a > 0.0 && uKraft > 0.0) {       // nur Baustellenteile (Gerät und Bohrung: negativ)
          float z = c.a; vec3 nc = c.rgb * 2.0 - 1.0; float sil = 0.0, knick = 0.0;
          for (int i = 0; i < 4; i++) {
            vec2 o = i == 0 ? vec2(px.x, 0.0) : i == 1 ? vec2(-px.x, 0.0) : i == 2 ? vec2(0.0, px.y) : vec2(0.0, -px.y);
            vec4 k = texture2D(tND, vUv + o);
            if (k.a == 0.0) { sil = 1.0; continue; }
            float rel = (abs(k.a) - z) / z;
            sil = max(sil, smoothstep(.03, .08, rel));
            if (i == 0 || i == 2) knick = max(knick, smoothstep(.1, .32, 1.0 - dot(nc, k.rgb * 2.0 - 1.0)) * (1.0 - step(.05, abs(rel))));
          }
          e = max(sil, knick * .75) * (1.0 - smoothstep(180.0, 700.0, z));
        }
        // Auf die Marke abgestimmt: Lichter etwas zurück (heller Kies überstrahlt sonst die Bühne),
        // Farben leicht ins Thermobohr-Grün. Bild ist vormultipliziert (Alpha 0 = Bühne).
        vec3 g = echt.rgb / (1.0 + .38 * echt.rgb);
        float l = dot(g, vec3(.3, .59, .11));
        g = mix(g, vec3(l) * vec3(.84, 1.0, .9), .28) * .95;
        // Oberfläche blendet beim Eintauchen aus (die Linien der Website übernehmen).
        float blende = c.a != 0.0 ? uOben : 1.0;
        gl_FragColor = vec4(g + uBlock * e * uKraft * echt.a, echt.a) * blende;
      }`,
  });
  kanten.uniforms.tND.value = ndTarget.texture;   // ShaderPass klont Uniforms ohne Render-Target-Texturen
  composer.addPass(kanten);

  // ------------------------------------------------------------- Kamera
  let W = 0, H = 0;
  function groesse() {
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    if (w === W && h === H) return;
    W = w; H = h;
    renderer.setSize(W, H, false); composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(W, H);
    const pw = W * renderer.getPixelRatio(), ph = H * renderer.getPixelRatio();
    gtao.setSize(Math.round(pw * .5), Math.round(ph * .5));
    const nd = tief ? .5 : 1;   // Handy: nur Blende, halbe Auflösung genügt
    ndTarget.setSize(pw * nd, ph * nd); kanten.uniforms.uRes.value.set(pw * nd, ph * nd);
    camera.aspect = W / H;
  }
  // Kamera aus kombi.js übernehmen: Standort, Blick auf (0, lookY, 0), Bildmitte (cx, cy) in CSS-Pixeln.
  function kameraAus(K) {
    camera.position.set(K.px, K.py, K.pz);
    camera.lookAt(0, K.lookY, 0);
    camera.setViewOffset(W, H, W / 2 - K.cx, H / 2 - K.cy, W, H);
  }

  // Qualität: bei langsamen Bildern zuerst die Auflösung (Handy nie unter 1,5-fach), dann die Umgebungsverdeckung zurücknehmen.
  const perf = { n: 0, sum: 0, stufe: 0 };
  function anpassen(ms) {
    if (perf.stufe > 1) return;
    perf.n++; perf.sum += ms;
    if (perf.n < 60) return;
    const mittel = perf.sum / perf.n; perf.n = perf.sum = 0;
    if (mittel < (tief ? 30 : 22)) { perf.stufe = 2; return; }
    if (perf.stufe === 0 && quality.ratio > quality.min) { quality.ratio = quality.min; renderer.setPixelRatio(quality.ratio); W = H = 0; groesse(); perf.stufe = 1; }
    else { gtao.enabled = false; perf.stufe = 2; }
  }

  let bild = 0;
  const obenDurchsichtig = [];
  {
    const seen = new Set();
    oben.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m.transparent && !seen.has(m)) { seen.add(m); m.userData.basisDeckung = m.opacity; obenDurchsichtig.push(m); } });
  }
  function zeichne(K, z, p, zeit, spin, ende) {
    const t0 = performance.now();
    groesse(); kameraAus(K);
    // Unter dem Gelände bleibt die Oberfläche weg (wie die Landschaft in kombi.js).
    // Je näher die Kamera dem Boden kommt, desto mehr übernehmen die Linien (wie beim Tauchgang).
    const obenSicht = smooth(range(K.py, .4, 9));
    oben.visible = obenSicht > .002;
    kanten.uniforms.uOben.value = obenSicht;
    ndNoetig = !tief || (obenSicht > .002 && obenSicht < .998);
    for (const m of obenDurchsichtig) m.opacity = m.userData.basisDeckung * obenSicht;
    const unter = smooth(range(-K.py, -2, 6));
    lampe.intensity = unter * 90;
    hemi.groundColor.lerpColors(HEMI_BODEN, HEMI_BODEN_TIEF, unter);
    const ein = window.ThermobohrEinstieg;
    const einstieg = ein && ein.active ? 1 - smooth(range(ein.cameraMix || 0, .35, .72)) : 0;
    setzeUnten(z, p, spin, ende, einstieg);
    site.update(zeit);
    if (bild++ % (tief ? 30 : 6) === 0) renderer.shadowMap.needsUpdate = true;   // Handy: Schatten seltener
    composer.render();
    anpassen(performance.now() - t0);
  }

  window.ThermobohrEcht = { zeichne, renderer, scene, camera, rig, site, composer, kanten, ndTarget, gtao };
  // Falls kombi.js schon ein Bild gezeichnet hat, sofort nachziehen.
  const b = window.ThermobohrBohrung;
  if (b && b.vorschau) b.vorschau(b.fortschritt());
}
