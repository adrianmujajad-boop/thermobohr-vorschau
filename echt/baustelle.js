/**
 * Baustelle rund um das Rotomax-Modell – prozedural aus three.js-Grundformen.
 * Einheiten Meter, Y oben, Boden Y=0, Bohrachse X=2.04 / Z=0 wie rig-solid.js.
 * Gelände mit Hügeln, Einfamilienhaus mit Fassadengerüst (Heizungsersatz),
 * Bauzaun, Erdsonden-Ringbunde, Gestängelager, Schlammmulde, Kompressor,
 * Baucontainer, Lieferwagen, Bauschild und zwei Arbeiter (leicht animiert).
 * Keine externen Modelle oder Bilder ausser dem Thermobohr-Logo.
 */
export const BOHRACHSE = [2.04, 0];

export function createBaustelle(THREE, { logoUrl, nurBaustelle = false } = {}) {
  // nurBaustelle: ohne Wiese, Hügel, Bäume, Hecken, Nachbarhäuser und Alpen –
  // die Landschaft zeichnet dann die Linienansicht der Website.
  const group = new THREE.Group();
  group.name = 'Baustelle';
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const UP = V3(0, 1, 0);
  const TAU = Math.PI * 2;

  // Reproduzierbarer Zufall, damit jede Ansicht gleich aussieht.
  let seed = 20261028;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const range = (a, b) => a + (b - a) * rnd();
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, z) => noise(x, z) * .55 + noise(x * 2.1, z * 2.1) * .28 + noise(x * 4.3, z * 4.3) * .17;

  // ---------------------------------------------------------------- Materialien
  const mats = {};
  const mat = (name, color, roughness = .8, metalness = 0, extra = {}) =>
    (mats[name] = Object.assign(new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }), { name }));
  mat('putz', '#ece8df', .93); mat('sockel', '#8d8c86', .95); mat('dach', '#45494b', .82);
  mat('glas', '#1f2b33', .12, .5); mat('rahmen', '#3a3f42', .6, .25); mat('laden', '#5e6b63', .7);
  mat('weiss', '#e6e7e2', .55, .15); mat('verzinkt', '#aeb5b3', .38, .82); mat('stahl', '#8c969a', .45, .75);
  mat('stahlDunkel', '#4f585c', .55, .6); mat('holz', '#8d6a43', .92); mat('holzHell', '#b89a72', .9);
  mat('beton', '#a3a29b', .96); mat('gummi', '#1a1c1e', .93); mat('pe', '#151819', .42, .05);
  mat('gruen', '#1d5c2e', .5, .2); mat('hellgruen', '#6aaa3a', .52, .12); mat('mulde', '#4a585e', .62, .45);
  mat('schlamm', '#3d3125', .22, 0); mat('bigbag', '#eceee9', .97); mat('kegel', '#ff6418', .55);
  mat('reflex', '#f2f2ee', .35); mat('laub', '#46642f', .95); mat('nadel', '#2b4a2c', .95);
  mat('stamm', '#4a3a2c', .95); mat('hecke', '#2e4a27', 1); mat('scheibe', '#dfe7ea', .1, .6);
  mat('signal', '#ffb52e', .35, 0, { emissive: '#7a3d00', emissiveIntensity: .25 });

  // --------------------------------------------------------- Instanz-Baukasten
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const cylCache = new Map();
  const cyl = n => { if (!cylCache.has(n)) cylCache.set(n, new THREE.CylinderGeometry(1, 1, 1, n, 1)); return cylCache.get(n); };
  const buckets = new Map();
  const stack = [new THREE.Matrix4()];
  const tmp = new THREE.Object3D();
  function put(geometry, matName, position, quaternion, scale) {
    const key = geometry.uuid + '|' + matName;
    let b = buckets.get(key);
    if (!b) { b = { geometry, matName, list: [] }; buckets.set(key, b); }
    tmp.position.set(...position);
    if (quaternion) tmp.quaternion.copy(quaternion); else tmp.quaternion.identity();
    tmp.scale.set(...scale); tmp.updateMatrix();
    b.list.push(new THREE.Matrix4().multiplyMatrices(stack[stack.length - 1], tmp.matrix));
  }
  // Lokales Koordinatensystem: alles in fn() wird verschoben und um Y gedreht.
  function at(position, rotY, fn) {
    const m = new THREE.Matrix4().compose(V3(...position), new THREE.Quaternion().setFromAxisAngle(UP, rotY), V3(1, 1, 1));
    stack.push(stack[stack.length - 1].clone().multiply(m)); fn(); stack.pop();
  }
  const euler = (x, y, z) => (x || y || z) ? new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)) : null;
  const box = (m, c, s, rx = 0, ry = 0, rz = 0) => put(unitBox, m, c, euler(rx, ry, rz), s);
  function rod(m, a, b, r, n = 8) {
    const A = V3(...a), B = V3(...b), d = B.clone().sub(A), len = d.length();
    if (len < 1e-5) return;
    put(cyl(n), m, A.add(B).multiplyScalar(.5).toArray(), new THREE.Quaternion().setFromUnitVectors(UP, d.divideScalar(len)), [r, len, r]);
  }
  function flush(target = group) {
    for (const b of buckets.values()) {
      const im = new THREE.InstancedMesh(b.geometry, mats[b.matName], b.list.length);
      b.list.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere();
      im.name = 'Baustelle: ' + b.matName; target.add(im);
    }
    buckets.clear();
  }
  function add(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], { cast = true, receive = true, name } = {}) {
    const mesh = new THREE.Mesh(geometry, typeof material === 'string' ? mats[material] : material);
    mesh.position.set(...position); mesh.rotation.set(...rotation);
    mesh.castShadow = cast; mesh.receiveShadow = receive; if (name) mesh.name = name;
    // Einzelne Meshes folgen ebenfalls dem aktuellen at()-Koordinatensystem.
    mesh.applyMatrix4(stack[stack.length - 1]);
    group.add(mesh); return mesh;
  }
  function canvasTexture(w, h, draw, { repeat, srgb = true } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
    t.userData.redraw = () => { draw(ctx, w, h); t.needsUpdate = true; };
    return t;
  }

  // Logo wird asynchron geladen; Schilder zeichnen sich danach neu.
  const logo = new Image();
  const logoTextures = [];
  if (logoUrl) { logo.onload = () => logoTextures.forEach(t => t.userData.redraw()); logo.src = logoUrl; }
  const drawLogo = (g, x, y, w) => { if (logo.complete && logo.naturalWidth) g.drawImage(logo, x, y, w, w * logo.naturalHeight / logo.naturalWidth); };

  // ------------------------------------------------------------------- Gelände
  function terrainHeight(x, z) {
    const r = Math.hypot(x * .8, z + 12);
    const far = smooth(48, 170, r);
    return far * (5 + 7 * fbm(x * .012 + 3, z * .012) + 4 * Math.sin(x * .017 + 1.3) * Math.cos(z * .013)) + smooth(150, 380, r) * 18 * fbm(x * .006, z * .006 + 7);
  }
  if (!nurBaustelle) {
    const size = 900, seg = 150;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, colors = new Float32Array(p.count * 3);
    const meadow = new THREE.Color('#71844a'), dry = new THREE.Color('#9b9a5e'), deep = new THREE.Color('#566b39'), field = new THREE.Color('#b0a565'), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, terrainHeight(x, z));
      const n = fbm(x * .05, z * .05);
      c.copy(meadow).lerp(deep, smooth(.35, .75, n)).lerp(dry, smooth(.55, .9, fbm(x * .013 + 9, z * .013)) * .6);
      // Ferne Ackerflächen als gedrehte Rechtecke.
      const r = Math.hypot(x, z);
      if (r > 70) { const fx = Math.floor((x * .8 + z * .6) / 38), fz = Math.floor((-x * .6 + z * .8) / 26); if (hash(fx, fz) > .72) c.lerp(field, .75); }
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geo.computeVertexNormals();
    const grass = canvasTexture(512, 512, (g, w, h) => {
      g.fillStyle = '#d8d8d8'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const l = 150 + rnd() * 105 | 0; g.strokeStyle = `rgba(${l},${l},${l},.55)`; g.lineWidth = 1; const x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + range(-2, 2), y - range(3, 8)); g.stroke(); }
    }, { repeat: [size / 3.5, size / 3.5] });
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: grass, vertexColors: true, roughness: .97 }));
    ground.receiveShadow = true; ground.name = 'Gelände'; group.add(ground);
  }

  // Kiesplatz der Baustelle mit unregelmässigem Rand.
  const kies = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#8e897f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30000; i++) {
      const x = rnd() * w, y = rnd() * h, r = .7 + rnd() * 2.3, l = 92 + rnd() * 120 | 0, t = rnd() * 14 | 0;
      g.fillStyle = `rgb(${l + t},${l + (t >> 1)},${l - 8})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    for (let i = 0; i < 40; i++) { const x = rnd() * w, y = rnd() * h, r = range(20, 70), gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(60,52,40,.22)'); gr.addColorStop(1, 'rgba(60,52,40,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  }, { repeat: [.26, .26] });
  {
    const outline = grow => {
      const shape = new THREE.Shape();
      for (let i = 0; i <= 96; i++) {
        const a = i / 96 * TAU, wob = 1 + (fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2) - .5) * .28 + (noise(a * 9, grow * 3) - .5) * .05 * grow;
        const x = .5 + Math.cos(a) * (12.5 + grow) * wob, z = .3 + Math.sin(a) * (8.6 + grow) * wob;
        i ? shape.lineTo(x, -z) : shape.moveTo(x, -z);
      }
      const geo = new THREE.ShapeGeometry(shape, 1); geo.rotateX(-Math.PI / 2); return geo;
    };
    const pad = add(outline(0), new THREE.MeshStandardMaterial({ map: kies, bumpMap: kies, bumpScale: 1.6, color: '#ffffff', roughness: .98, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), [0, .022, 0], [0, 0, 0], { cast: false, name: 'Kiesplatz' });
    pad.userData.splatColor = '#8f8a7f';
    // Zertretener, erdiger Rand zwischen Kies und Wiese.
    const erde = canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#6f604a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { const l = rnd(); g.fillStyle = l > .7 ? 'rgba(112,124,70,.55)' : `rgba(${60 + l * 50 | 0},${50 + l * 40 | 0},${36 + l * 30 | 0},.6)`; g.fillRect(rnd() * w, rnd() * h, range(1, 3), range(1, 4)); }
    }, { repeat: [.3, .3] });
    for (const [grow, op, y] of [[2.6, .5, .006], [1.2, .85, .012]]) {
      const ring = add(outline(grow), new THREE.MeshStandardMaterial({ map: erde, transparent: true, opacity: op, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), [0, y, 0], [0, 0, 0], { cast: false, name: 'Erdrand' });
      ring.userData.noSplat = true;
    }
  }

  // Nasser Bohrschlamm um das Bohrloch und Raupenspuren.
  {
    const tex = canvasTexture(512, 512, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        const x = w / 2 + range(-90, 120), y = h / 2 + range(-80, 110), r = range(60, 150);
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(58,46,34,.9)'); gr.addColorStop(.6, 'rgba(70,56,40,.55)'); gr.addColorStop(1, 'rgba(80,66,48,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
    });
    const mud = add(new THREE.PlaneGeometry(6, 6), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: .2, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), [2.5, .032, .5], [-Math.PI / 2, 0, 0], { cast: false, name: 'Bohrschlamm' });
    mud.userData.splatColor = '#43362a';

    const tread = canvasTexture(64, 256, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let y = 0; y < h; y += 16) { g.fillStyle = 'rgba(48,42,34,.55)'; g.fillRect(4, y, w - 8, 9); }
      g.fillStyle = 'rgba(48,42,34,.25)'; g.fillRect(0, 0, w, h);
    }, { repeat: [1, 1] });
    tread.wrapT = THREE.RepeatWrapping;
    const curve = new THREE.CatmullRomCurve3([V3(-2.4, 0, 0), V3(-5.0, 0, .6), V3(-5.6, 0, 3.2), V3(-3.9, 0, 6.6), V3(-1.2, 0, 9.6), V3(.3, 0, 14)]);
    const pts = curve.getSpacedPoints(80);
    for (const off of [-.73, .73]) {
      const pos = [], uv = [], idx = [];
      let dist = 0;
      pts.forEach((pt, i) => {
        const nxt = pts[Math.min(i + 1, pts.length - 1)], prv = pts[Math.max(i - 1, 0)];
        const t = nxt.clone().sub(prv).normalize(), n = V3(-t.z, 0, t.x);
        if (i) dist += pt.distanceTo(pts[i - 1]);
        for (const s of [-.27, .27]) { const q = pt.clone().addScaledVector(n, off + s); pos.push(q.x, .03, q.z); uv.push(s < 0 ? 0 : 1, dist / 1.6); }
        if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tread, transparent: true, depthWrite: false, roughness: .95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.receiveShadow = true; m.name = 'Raupenspur'; m.userData.noSplat = true; group.add(m);
    }
  }
  // Standrohr (Schutzrohr) im Bohrloch.
  rod('verzinkt', [2.04, -.05, 0], [2.04, .2, 0], .11, 20);
  rod('stahlDunkel', [2.04, .19, 0], [2.04, .23, 0], .135, 20);

  // ----------------------------------------------------- Haus mit Fassadengerüst
  function haus({ x, z, w, d, h, rotY = 0, wall = 'putz', detail = true, laden = false }) {
    at([x, 0, z], rotY, () => {
      box(wall, [0, h / 2, 0], [w, h, d]);
      box('sockel', [0, .25, 0], [w + .04, .5, d + .04]);
      // Satteldach, First entlang X, 33° Neigung, 0.6 m Vordach.
      const pitch = .58, half = d / 2 + .6, slope = half / Math.cos(pitch), rise = Math.tan(pitch) * (d / 2);
      for (const s of [-1, 1]) box('dach', [0, h + rise / 2 - .08, s * half / 2], [w + 1.0, .2, slope], s * pitch, 0, 0);
      const gable = new THREE.Shape([new THREE.Vector2(-d / 2, 0), new THREE.Vector2(d / 2, 0), new THREE.Vector2(0, rise)]);
      const gGeo = new THREE.ExtrudeGeometry(gable, { depth: w - .02, bevelEnabled: false });
      gGeo.translate(0, 0, -(w - .02) / 2); gGeo.rotateY(Math.PI / 2);
      add(gGeo, wall, [0, h, 0]);
      box('dach', [0, h + rise + .12, 0], [w + 1.0, .14, .28]);
      if (!detail) {
        for (const fz of [d / 2 + .01, -d / 2 - .01]) for (let i = 0; i < Math.floor(w / 2.6); i++) for (const fy of [1.4, h - 1.4]) box('glas', [-w / 2 + 1.6 + i * 2.6, fy, fz], [1.1, 1.2, .04]);
        return;
      }
      // Fenster der Front (+Z): Erdgeschoss mit Tür, Obergeschoss.
      const front = d / 2;
      const fenster = (fx, fy, fw, fh) => {
        box('glas', [fx, fy, front + .005], [fw, fh, .04]);
        box('rahmen', [fx, fy + fh / 2, front + .04], [fw + .12, .07, .08]);
        box('rahmen', [fx, fy - fh / 2, front + .04], [fw + .12, .07, .08]);
        for (const sx of [-1, 1]) box('rahmen', [fx + sx * fw / 2, fy, front + .04], [.07, fh, .08]);
        box('rahmen', [fx, fy, front + .03], [.05, fh, .05]);
        box('weiss', [fx, fy - fh / 2 - .06, front + .09], [fw + .2, .05, .18]);
        if (laden) for (const sx of [-1, 1]) box('laden', [fx + sx * (fw / 2 + .32), fy, front + .06], [.6, fh + .05, .05]);
      };
      const cols = Math.max(2, Math.floor(w / 2.7));
      for (let i = 0; i < cols; i++) {
        const fx = -w / 2 + w * (i + .5) / cols;
        fenster(fx, h * .72, 1.3, 1.35);
        if (i === 1) { box('rahmen', [fx, 1.15, front + .02], [1.1, 2.2, .1]); box('holz', [fx, 1.15, front + .03], [.95, 2.08, .08]); }
        else fenster(fx, 1.65, 1.3, 1.45);
      }
      // Seitenfenster.
      for (const sx of [-1, 1]) for (const fy of [1.65, h * .72]) box('glas', [sx * (w / 2 + .005), fy, 0], [.04, 1.3, 1.2]);
      // Kamin und Dachrinne.
      box('sockel', [w * .28, h + rise * .8, -d * .12], [.55, 1.6, .55]);
      const eave = h - .6 * Math.tan(pitch) - .05;
      rod('verzinkt', [-w / 2 - .45, eave, front + .52], [w / 2 + .45, eave, front + .52], .07, 10);
      rod('verzinkt', [w / 2 + .3, .1, front + .45], [w / 2 + .3, eave, front + .45], .05, 10);
    });
  }
  const HAUSER = [[24, -26], [-31, -12], [6, -48], [-22, -44]];
  haus({ x: -3, z: -15, w: 12, d: 8, h: 6.2, laden: true });
  // Nachbarhäuser.
  if (!nurBaustelle) haus({ x: 24, z: -26, w: 10, d: 8, h: 5.8, rotY: -.35, wall: 'weiss', detail: false });
  if (!nurBaustelle) haus({ x: -31, z: -12, w: 11, d: 9, h: 6.4, rotY: .5, detail: false });
  if (!nurBaustelle) haus({ x: 6, z: -48, w: 14, d: 10, h: 8.5, rotY: .12, wall: 'weiss', detail: false });
  if (!nurBaustelle) haus({ x: -22, z: -44, w: 9, d: 8, h: 5.6, rotY: -.2, detail: false });

  // Fassadengerüst vor dem Haupthaus (Front bei z=-11).
  {
    const fz = -11, xs = [], levels = [2.0, 4.0, 6.0], rows = [fz + .35, fz + 1.05];
    for (let x = -9.2; x <= 1.4; x += 2.57) xs.push(x);
    for (const x of xs) for (const z of rows) {
      rod('verzinkt', [x, 0, z], [x, 7.3, z], .024, 8);
      box('stahlDunkel', [x, .02, z], [.16, .02, .16]);
      for (const y of levels) rod('verzinkt', [x, y, rows[0]], [x, y, rows[1]], .024, 6);
    }
    for (const z of rows) for (const y of [...levels, .25]) rod('verzinkt', [xs[0], y, z], [xs[xs.length - 1], y, z], .024, 6);
    for (let i = 0; i < xs.length - 1; i++) {
      for (const y of levels) {
        for (let k = 0; k < 2; k++) box('holzHell', [(xs[i] + xs[i + 1]) / 2, y + .04, rows[0] + .17 + k * .36], [2.5, .045, .32]);
        box('holz', [(xs[i] + xs[i + 1]) / 2, y + .12, rows[1] + .02], [2.5, .15, .025]);
        for (const g of [.5, 1.0]) rod('verzinkt', [xs[i], y + g, rows[1]], [xs[i + 1], y + g, rows[1]], .02, 6);
      }
      if (i % 2 === 0) rod('verzinkt', [xs[i], .2, rows[1] + .03], [xs[i + 1], 6.0, rows[1] + .03], .02, 6);
    }
    // Gerüstnetz über den oberen Lagen (halbtransparent).
    const netz = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = 'rgba(52,96,60,.42)'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(30,60,36,.5)'; for (let i = 0; i < w; i += 6) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    }, { repeat: [12, 4] });
    const net = add(new THREE.PlaneGeometry(xs[xs.length - 1] - xs[0], 3.4), new THREE.MeshStandardMaterial({ map: netz, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1 }), [(xs[0] + xs[xs.length - 1]) / 2, 5.6, rows[1] + .08], [0, 0, 0], { cast: false, name: 'Gerüstnetz' });
    net.userData.noSplat = true;
  }

  // Thujahecken am Grundstücksrand.
  function hecke(x0, z0, x1, z1, hgt = 1.8) {
    const len = Math.hypot(x1 - x0, z1 - z0), geo = new THREE.BoxGeometry(len, hgt, .9, Math.ceil(len * 3), 6, 3);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = (fbm(x * 1.7 + x0, y * 1.7 + z * 2) - .5) * .22; p.setXYZ(i, x, y + (y > 0 ? n * .6 : 0), z + Math.sign(z) * n); }
    geo.computeVertexNormals();
    const h = add(geo, 'hecke', [(x0 + x1) / 2, hgt / 2, (z0 + z1) / 2], [0, -Math.atan2(z1 - z0, x1 - x0), 0], { name: 'Hecke' });
    h.userData.noND = true;   // in der Linienansicht keine Kritzelkanten
  }
  if (!nurBaustelle) { hecke(-18, -24, -18, 11); hecke(16, -24, 16, 9); hecke(-18, -24.4, 16, -24.4, 1.6); }

  // ---------------------------------------------------------------- Bauzaun
  function zaunfeld(withFeet = true) {
    const W = 3.45, H = 2.0;
    rod('verzinkt', [.04, .14, 0], [.04, H, 0], .021, 8); rod('verzinkt', [W - .04, .14, 0], [W - .04, H, 0], .021, 8);
    rod('verzinkt', [.04, .2, 0], [W - .04, .2, 0], .018, 6); rod('verzinkt', [.04, H - .04, 0], [W - .04, H - .04, 0], .018, 6);
    for (let x = .14; x < W - .1; x += .1) box('verzinkt', [x, (H + .2) / 2, 0], [.006, H - .24, .006]);
    for (let y = .4; y < H - .1; y += .2) box('verzinkt', [W / 2, y, 0], [W - .1, .006, .006]);
    if (withFeet) { box('beton', [0, .075, 0], [.66, .15, .22]); box('beton', [W, .075, 0], [.66, .15, .22]); }
    for (const y of [.35, H - .25]) box('stahlDunkel', [W, y, 0], [.08, .1, .06]);
  }
  const zaunPunkte = [];
  function zaunLinie(x0, z0, x1, z1) {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 3.45), ry = -Math.atan2(z1 - z0, x1 - x0);
    for (let i = 0; i < n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      at([x, 0, z], ry + (hash(i, x) - .5) * .03, () => zaunfeld()); zaunPunkte.push([x, z, ry]);
    }
  }
  zaunLinie(-13.8, -8.5, 12.2, -8.5);
  zaunLinie(-13.8, 8.8, -13.8, -8.5);
  zaunLinie(12.2, -8.5, 12.2, 5.3);
  zaunLinie(-13.8, 8.8, -3.45, 8.8);

  // Banner am vorderen Zaun.
  {
    const tex = canvasTexture(1024, 288, (g, w, h) => {
      g.fillStyle = '#f6f6f2'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d5c2e'; g.fillRect(0, h - 46, w, 46);
      drawLogo(g, 40, 46, 560);
      g.fillStyle = '#1d5c2e'; g.font = '500 40px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'right';
      g.fillText('Erdwärme aus der Tiefe', w - 40, 100); g.fillStyle = '#5c6a60'; g.font = '400 30px "Helvetica Neue", Arial, sans-serif';
      g.fillText('Erdsondenbohrungen', w - 40, 150); g.fillStyle = '#ffffff'; g.font = '500 24px "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center';
      g.fillText('THERMOBOHR AG  ·  ERDSONDEN  ·  WÄRMEPUMPEN', w / 2, h - 15);
    });
    logoTextures.push(tex);
    const banner = add(new THREE.PlaneGeometry(3.25, .92), new THREE.MeshStandardMaterial({ map: tex, roughness: .75, side: THREE.DoubleSide }), [-5.2, 1.18, 8.83], [0, 0, 0], { name: 'Banner Thermobohr' });
    banner.userData.splatColor = '#e8ebe4';
  }

  // Bauschild beim Eingang.
  {
    const tex = canvasTexture(1024, 640, (g, w, h) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d5c2e'; g.fillRect(0, 0, w, 120);
      g.fillStyle = '#ffffff'; g.font = '600 54px "Helvetica Neue", Arial, sans-serif'; g.fillText('Erdwärmesonden', 48, 80);
      g.fillStyle = '#26332a'; g.font = '400 34px "Helvetica Neue", Arial, sans-serif';
      g.fillText('Heizungsersatz Einfamilienhaus', 48, 190);
      g.fillText('Erdwärmesonde bis 500 m · Wärmepumpe Sole/Wasser', 48, 240);
      g.fillStyle = '#6aaa3a'; g.fillRect(48, 290, w - 96, 4);
      g.fillStyle = '#5c6a60'; g.font = '400 28px "Helvetica Neue", Arial, sans-serif'; g.fillText('Bohrunternehmen', 48, 350);
      drawLogo(g, 48, 380, 640);
      g.fillStyle = '#5c6a60'; g.font = '400 26px "Helvetica Neue", Arial, sans-serif'; g.fillText('Platzhalter-Angaben · Studie', 48, h - 40);
    });
    logoTextures.push(tex);
    at([-10.6, 0, 9.6], .35, () => {
      for (const x of [-1.15, 1.15]) { box('holz', [x, 1.2, 0], [.1, 2.4, .1]); }
      box('weiss', [0, 1.75, -.03], [2.66, 1.7, .04]);
      const s = add(new THREE.PlaneGeometry(2.6, 1.625), new THREE.MeshStandardMaterial({ map: tex, roughness: .7 }), [0, 1.75, .0], [0, 0, 0], { name: 'Bauschild' });
      s.userData.splatColor = '#f2f3ef';
    });
  }

  // ------------------------------------------------------- Erdsonden-Ringbunde
  {
    const stripe = canvasTexture(8, 64, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#7fbf4c'; g.fillRect(0, 12, w, 7); g.fillRect(0, 44, w, 7); });
    const peMat = new THREE.MeshStandardMaterial({ color: '#202425', map: stripe, roughness: .4, metalness: .05 });
    const ringMeshes = [];
    function ringbund(x, z, rot) {
      const tori = [];
      for (let layer = 0; layer < 7; layer++) for (let k = 0; k < 5; k++) tori.push([.78 + k * .066 + (layer % 2) * .033, .2 + layer * .062]);
      const geo = new THREE.TorusGeometry(1, .032 / .9, 6, 56);
      const im = new THREE.InstancedMesh(geo, peMat, tori.length);
      tori.forEach(([R, y], i) => { tmp.position.set(0, y, 0); tmp.rotation.set(Math.PI / 2, 0, hash(i, R) * TAU); tmp.scale.set(R, R, .9); tmp.updateMatrix(); im.setMatrixAt(i, tmp.matrix); });
      im.position.set(x, 0, z); im.rotation.y = rot; im.castShadow = im.receiveShadow = true; im.name = 'Erdsonden-Ringbund';
      im.userData.splatColor = '#1f2324'; ringMeshes.push(im); group.add(im);
      at([x, 0, z], rot, () => {
        for (const s of [-1, 1]) box('holz', [0, .08, s * .55], [2.4, .16, .14]);
        for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .4; box('stahlDunkel', [Math.cos(a) * .92, .41, Math.sin(a) * .92], [.05, .48, .36], 0, -a, 0); }
        // Sondenfuss mit Gewicht obenauf.
        rod('weiss', [.1, .66, .2], [.5, .66, .25], .07, 12); rod('stahl', [.25, .66, .55], [.25, .66, .95], .06, 12);
      });
    }
    ringbund(6.2, 3.3, .3); ringbund(8.4, 1.0, -.2);
  }

  // ------------------------------------------------------------ Gestängelager
  at([7.0, 0, -3.3], .12, () => {
    for (const x of [-1.1, 1.1]) box('holz', [x, .08, 0], [.18, .16, 1.5]);
    const layers = [6, 5, 4, 3], r = .057;
    layers.forEach((n, L) => {
      for (let i = 0; i < n; i++) {
        const z = (i - (n - 1) / 2) * (r * 2.05), y = .16 + r + L * r * 1.78;
        rod('stahlDunkel', [-1.55, y, z], [1.55, y, z], r, 12);
        for (const s of [-1, 1]) rod('verzinkt', [s * 1.55, y, z], [s * 1.68, y, z], r * .82, 12);
      }
    });
    // Ein Bohrrohr wartet bereits am Mast.
  });
  rod('stahlDunkel', [3.3, .05, .9], [2.5, 3.05, .55], .057, 12);
  rod('verzinkt', [2.5, 3.05, .55], [2.47, 3.17, .53], .047, 12);

  // ----------------------------------------------------------- Schlammmulde
  at([5.6, 0, -6.0], -.18, () => {
    const L0 = 3.2, L1 = 4.0, W0 = 1.75, W1 = 2.0, H = 1.25;
    const pos = [], idx = [];
    const c = [[-L0 / 2, 0, -W0 / 2], [L0 / 2, 0, -W0 / 2], [L0 / 2, 0, W0 / 2], [-L0 / 2, 0, W0 / 2], [-L1 / 2, H, -W1 / 2], [L1 / 2, H, -W1 / 2], [L1 / 2, H, W1 / 2], [-L1 / 2, H, W1 / 2]];
    const faces = [[0, 1, 2, 3], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]];
    for (const f of faces) { const b = pos.length / 3; f.forEach(i => pos.push(...c[i])); idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const shell = mats.mulde.clone(); shell.side = THREE.DoubleSide;
    add(geo, shell, [0, .12, 0], [0, 0, 0], { name: 'Schlammmulde' });
    add(new THREE.PlaneGeometry(L1 - .2, W1 - .1), 'schlamm', [0, .12 + H * .82, 0], [-Math.PI / 2, 0, 0], { cast: false, name: 'Schlamm' });
    for (const x of [-1.2, 0, 1.2]) box('mulde', [x, .07, 0], [.12, .14, 1.9]);
    for (const s of [-1, 1]) { box('stahlDunkel', [s * (L1 / 2 + .05), H * .7, 0], [.1, .12, 1.6]); rod('stahlDunkel', [s * (L1 / 2 + .12), H * .9, -.5], [s * (L1 / 2 + .12), H * .9, .5], .05, 8); }
  });
  // Spülleitung vom Bohrloch zur Mulde.
  {
    const curve = new THREE.CatmullRomCurve3([V3(2.25, .22, .25), V3(3.0, .06, .9), V3(4.4, .07, .2), V3(4.9, .07, -3.2), V3(4.9, .9, -5.1), V3(4.75, 1.4, -5.5)]);
    add(new THREE.TubeGeometry(curve, 60, .07, 8), 'gummi', [0, 0, 0], [0, 0, 0], { name: 'Spülleitung' });
  }

  // ------------------------------------------------------- Kompressor-Anhänger
  at([-6.3, 0, -2.5], .3, () => {
    box('weiss', [0, 1.18, 0], [2.6, 1.15, 1.35]);
    box('gruen', [0, .72, 0], [2.62, .24, 1.37]);
    box('weiss', [0, 1.8, 0], [2.4, .1, 1.25]);
    for (const s of [-1, 1]) { for (let i = 0; i < 9; i++) box('stahlDunkel', [-.9 + i * .07, 1.3, s * .68], [.03, .5, .01]); box('rahmen', [.6, 1.2, s * .68], [.9, .6, .01]); }
    for (const s of [-1, 1]) {
      rod('gummi', [0, .38, s * .75], [0, .38, s * .98], .38, 20);
      rod('stahl', [0, .38, s * .99], [0, .38, s * 1.0], .2, 16);
      box('stahlDunkel', [0, .78, s * .86], [.95, .06, .26]);
    }
    rod('stahlDunkel', [-.3, .6, -.5], [2.3, .52, 0], .045, 8); rod('stahlDunkel', [-.3, .6, .5], [2.3, .52, 0], .045, 8);
    rod('stahlDunkel', [2.3, .52, 0], [2.6, .5, 0], .06, 10); rod('stahl', [1.9, .1, .14], [1.9, .6, .14], .03, 8);
    rod('gummi', [1.9, .08, .14], [1.9, .08, .2], .08, 12);
  });
  {
    const curve = new THREE.CatmullRomCurve3([V3(-5.6, .95, -1.95), V3(-5.0, .06, -1.6), V3(-3.0, .06, -1.7), V3(-1.3, .06, -1.45), V3(-.6, .6, -1.1), V3(-.2, 1.5, -.95)]);
    add(new THREE.TubeGeometry(curve, 60, .045, 8), 'gummi', [0, 0, 0], [0, 0, 0], { name: 'Luftschlauch' });
  }

  // ------------------------------------------------------------- Baucontainer
  at([-10.2, 0, -5.0], .08, () => {
    const L = 6.06, H = 2.6, W = 2.44;
    box('weiss', [0, H / 2 + .1, 0], [L, H, W]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box('rahmen', [sx * (L / 2 - .08), H / 2 + .1, sz * (W / 2 - .08)], [.17, H + .02, .17]);
    for (const y of [.15, H + .07]) for (const sz of [-1, 1]) box('rahmen', [0, y, sz * (W / 2 - .06)], [L, .14, .14]);
    box('gruen', [0, .52, W / 2 + .005], [L - .3, .12, .02]);
    for (const x of [-1.7, .9]) { box('glas', [x, 1.7, W / 2 + .01], [1.1, .9, .03]); box('rahmen', [x, 1.7, W / 2 + .02], [1.18, .98, .015]); }
    box('rahmen', [2.2, 1.2, W / 2 + .01], [.9, 2.1, .04]); box('stahl', [1.92, 1.15, W / 2 + .05], [.05, .14, .05]);
    box('stahlDunkel', [2.2, .08, W / 2 + .35], [1.1, .16, .7]);
    rod('verzinkt', [-L / 2 + .3, H + .25, 0], [-L / 2 + .3, H + .7, 0], .03, 6);
  });
  {
    const tex = canvasTexture(1024, 146, (g, w, h) => { g.clearRect(0, 0, w, h); drawLogo(g, 0, 0, w); });
    logoTextures.push(tex);
    at([-10.2, 0, -5.0], .08, () => {
      const p = add(new THREE.PlaneGeometry(2.8, .4), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .6, polygonOffset: true, polygonOffsetFactor: -1 }), [-.35, 2.42, 1.235], [0, 0, 0], { cast: false, name: 'Logo Container' });
      p.userData.noSplat = true;
    });
  }

  // Big Bags mit Hinterfüllmaterial.
  {
    const bag = new THREE.BoxGeometry(.95, .95, .95, 6, 6, 6), p = bag.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const b = 1 + .1 * (1 - (2 * y) ** 2); p.setXYZ(i, x * b, y - (Math.abs(x) + Math.abs(z)) * .04 * (y > .3 ? 1 : 0), z * b); }
    bag.computeVertexNormals();
    [[-4.4, -4.6, .1], [-3.2, -4.8, -.15], [-3.8, -5.9, .3]].forEach(([x, z, r]) => {
      at([x, 0, z], r, () => {
        for (let i = 0; i < 3; i++) box('holzHell', [0, .06, (i - 1) * .45], [1.2, .12, .14]);
        box('holzHell', [0, .13, 0], [1.2, .025, 1.0]);
        add(bag, 'bigbag', [0, .62, 0], [0, 0, 0], { name: 'Big Bag' });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const loop = add(new THREE.TorusGeometry(.1, .018, 5, 12, Math.PI), 'bigbag', [sx * .4, 1.08, sz * .4], [0, Math.PI / 4 * sx * sz, 0]);
          loop.userData.noSplat = true;
        }
      });
    });
  }

  // Leitkegel.
  function kegel(x, z) {
    at([x, 0, z], hash(x, z) * TAU, () => {
      box('gummi', [0, .02, 0], [.38, .04, .38]);
      const cone = add(new THREE.CylinderGeometry(.025, .16, .52, 18), 'kegel', [0, .3, 0]);
      cone.userData.splatColor = '#ff6418';
      for (const y of [.25, .4]) add(new THREE.CylinderGeometry(.12 - (y - .25) * .25, .125 - (y - .25) * .25, .06, 18, 1, true), 'reflex', [0, y, 0], [0, 0, 0], { cast: false });
    });
  }
  [[4.1, 2.1], [4.4, -2.3], [.6, 2.4], [-1.5, 9.0], [6.2, 8.6]].forEach(([x, z]) => kegel(x, z));

  // ---------------------------------------------------------------- Lieferwagen
  const VAN = [[-10.4, 0, 3.6], .2];
  const vanGlas = mats.glas.clone(); vanGlas.side = THREE.DoubleSide;
  at(...VAN, () => {
    const s = new THREE.Shape();
    s.moveTo(0, .42); s.lineTo(0, 2.38); s.quadraticCurveTo(.02, 2.5, .2, 2.5); s.lineTo(3.7, 2.5);
    s.quadraticCurveTo(3.95, 2.48, 4.05, 2.3); s.lineTo(4.55, 1.38); s.quadraticCurveTo(4.62, 1.25, 4.8, 1.2);
    s.lineTo(5.25, 1.08); s.quadraticCurveTo(5.38, 1.04, 5.38, .9); s.lineTo(5.38, .42); s.lineTo(0, .42);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.9, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 3, curveSegments: 10 });
    geo.translate(-2.69, 0, -.95);
    add(geo, 'weiss', [0, 0, 0], [0, 0, 0], { name: 'Lieferwagen' });
    // Seitenfenster der Fahrerkabine folgen der Neigung der Frontscheibe.
    const win = new THREE.Shape([new THREE.Vector2(.72, 1.42), new THREE.Vector2(1.76, 1.42), new THREE.Vector2(1.42, 2.08), new THREE.Vector2(.72, 2.08)]);
    const winGeo = new THREE.ShapeGeometry(win);
    for (const sz of [-1, 1]) {
      const z = sz * 1.0;
      add(winGeo, vanGlas, [0, 0, sz * 1.004], [0, 0, 0], { cast: false });
      box('gruen', [-.3, .7, z], [4.5, .16, .02]);
      box('hellgruen', [-.3, .84, z], [4.5, .05, .02]);
      for (const x of [-1.75, 1.65]) { rod('gummi', [x, .37, sz * .78], [x, .37, sz * 1.0], .37, 22); rod('stahl', [x, .37, sz * 1.005], [x, .37, sz * 1.01], .2, 14); box('gummi', [x, .62, sz * .98], [.95, .18, .06]); }
    }
    box('glas', [1.645, 1.86, 0], [.03, .86, 1.72], 0, 0, .497);
    box('rahmen', [2.74, .55, 0], [.08, .3, 1.95]);
    for (const sz of [-1, 1]) box('signal', [2.72, .97, sz * .7], [.04, .1, .32]);
  });
  {
    const tex = canvasTexture(1024, 146, (g, w, h) => { g.clearRect(0, 0, w, h); drawLogo(g, 0, 0, w); });
    logoTextures.push(tex);
    at(...VAN, () => {
      for (const sz of [-1, 1]) {
        const p = add(new THREE.PlaneGeometry(2.6, .37), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: .5, polygonOffset: true, polygonOffsetFactor: -1 }), [-.9, 1.45, sz * 1.003], [0, sz < 0 ? Math.PI : 0, 0], { cast: false, name: 'Logo Lieferwagen' });
        p.userData.noSplat = true;
      }
    });
  }

  // ------------------------------------------------------------------ Bäume
  // Laubkronen aus mehreren weichen Büscheln, Fichten aus gezackten Etagen.
  // Nahe Bäume detailliert und schattenwerfend, ferne als einfache Formen.
  function smoothNormals(geo) {
    geo.computeVertexNormals();
    const p = geo.attributes.position, n = geo.attributes.normal, groups = new Map(), v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      const k = p.getX(i).toFixed(4) + ',' + p.getY(i).toFixed(4) + ',' + p.getZ(i).toFixed(4);
      if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i);
    }
    for (const ids of groups.values()) {
      if (ids.length < 2) continue;
      v.set(0, 0, 0); for (const i of ids) v.x += n.getX(i), v.y += n.getY(i), v.z += n.getZ(i);
      v.normalize(); for (const i of ids) n.setXYZ(i, v.x, v.y, v.z);
    }
    return geo;
  }
  function clumpGeo(w, h) {
    const g = new THREE.SphereGeometry(1, w, h), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + (fbm(x * 2.4 + 5, y * 2.4 + z * 1.8) - .5) * .55; p.setXYZ(i, x * n, y * n, z * n); }
    return smoothNormals(g);
  }
  function tierGeo(seg) {
    const g = new THREE.ConeGeometry(1, 1, seg, 3, true), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.hypot(x, z);
      if (r < 1e-4) continue;
      const a = Math.atan2(z, x), w = .5 - y, j = Math.sin(a * 9) * .5 + Math.sin(a * 4 + 1.3) * .3 + (noise(a * 3 + 9, y * 4) - .5) * .6;
      p.setXYZ(i, x * (1 + w * .3 * j), y - w * .14 * Math.max(0, j), z * (1 + w * .3 * j));
    }
    return smoothNormals(g);
  }
  if (!nurBaustelle) {
    const leafTex = canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#c4c4c4'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) { const l = 105 + rnd() * 150 | 0; g.fillStyle = `rgb(${l},${l},${l})`; g.beginPath(); g.ellipse(rnd() * w, rnd() * h, range(1.5, 4.5), range(1, 2.6), rnd() * TAU, 0, TAU); g.fill(); }
    }, { repeat: [4, 3] });
    const foliage = new THREE.MeshStandardMaterial({ color: '#ffffff', map: leafTex, roughness: .96 });
    const sets = { near: { clumps: [], tiers: [], trunks: [] }, far: { clumps: [], tiers: [], trunks: [] } };
    const laubbaum = (x, z, s, set, detail) => {
      const y = terrainHeight(x, z), H = range(8, 13) * s, R = H * range(.3, .38);
      const col = new THREE.Color('#4b6b32').offsetHSL(range(-.03, .03), range(-.12, .04), range(-.07, .04));
      set.trunks.push([x, y + H * .3, z, .28 * s, H * .6]);
      const cy = y + H * .62;
      if (!detail) { set.clumps.push([x, cy, z, R, R * .85, col]); return; }
      const n = 6 + (rnd() * 4 | 0);
      for (let k = 0; k < n; k++) {
        const a = rnd() * TAU, rr = Math.sqrt(rnd()) * R * .55, cr = R * range(.42, .62);
        set.clumps.push([x + Math.cos(a) * rr, cy + range(-.35, .5) * R * .8, z + Math.sin(a) * rr, cr, cr * range(.8, .95), col.clone().offsetHSL(0, 0, range(-.045, .045))]);
      }
    };
    const nadelbaum = (x, z, s, set, detail) => {
      const y = terrainHeight(x, z), H = range(14, 24) * s, R = H * range(.17, .22);
      const col = new THREE.Color('#2f4c2f').offsetHSL(range(-.02, .02), range(-.1, .03), range(-.05, .03));
      set.trunks.push([x, y + H * .12, z, .24 * s, H * .3]);
      const tiers = detail ? 5 : 2;
      for (let k = 0; k < tiers; k++) {
        const t = k / tiers;
        set.tiers.push([x, y + H * (.2 + t * .72), z, R * (1 - t * .78), H * (detail ? .32 : .55), col.clone().offsetHSL(0, 0, k * .012)]);
      }
    };
    for (let i = 0; i < 1600; i++) {
      const x = range(-430, 430), z = range(-470, 130), r = Math.hypot(x, z + 10);
      if (r < 32 || (z > 0 && Math.abs(x) < 85 && r < 120)) continue;
      if (HAUSER.some(([hx, hz]) => Math.hypot(x - hx, z - hz) < 10)) continue;
      const dense = fbm(x * .011 + 2, z * .011 - 3) > .55;
      if (!dense && rnd() > .06) continue;
      const detail = r < 85;
      (rnd() < (dense ? .6 : .25) ? nadelbaum : laubbaum)(x, z, range(.8, 1.2), detail ? sets.near : sets.far, detail);
    }
    laubbaum(-15.4, -9.5, 1.05, sets.near, true); laubbaum(-15.6, 4, .85, sets.near, true);
    laubbaum(14.6, -15, 1.1, sets.near, true); nadelbaum(-12.5, -21.5, .8, sets.near, true); laubbaum(10.5, -21, .95, sets.near, true);
    const build = (geo, material, list, name, cast) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach(([x, y, z, r, h, c], i) => {
        tmp.position.set(x, y, z); tmp.rotation.set(0, rnd() * TAU, 0); tmp.scale.set(r, h, r); tmp.updateMatrix();
        im.setMatrixAt(i, tmp.matrix); if (c) im.setColorAt(i, c);
      });
      im.castShadow = cast; im.receiveShadow = true; im.computeBoundingSphere(); im.name = name; im.userData.noND = true; group.add(im);
    };
    const trunkGeo = new THREE.CylinderGeometry(.6, 1, 1, 7);
    build(clumpGeo(18, 13), foliage, sets.near.clumps, 'Laubkronen nah', true);
    build(tierGeo(20), foliage, sets.near.tiers, 'Fichten nah', true);
    build(trunkGeo, mats.stamm, sets.near.trunks, 'Stämme nah', true);
    build(clumpGeo(10, 7), foliage, sets.far.clumps, 'Laubkronen fern', false);
    build(tierGeo(10), foliage, sets.far.tiers, 'Fichten fern', false);
    build(trunkGeo, mats.stamm, sets.far.trunks, 'Stämme fern', false);
    group.children.slice(-3).forEach(o => { o.userData.fern = true; });
  }

  // Ferne Alpenkette als blasse Silhouette am Horizont.
  if (!nurBaustelle) {
    const pts = [], segs = 180, R = 1100;
    for (let i = 0; i <= segs; i++) {
      const a = -Math.PI * .95 + i / segs * Math.PI * .9, t = i / segs;
      const h = 55 + 150 * Math.pow(fbm(t * 9, 3.1), 1.6) + 70 * Math.pow(Math.abs(Math.sin(t * 23.0 + fbm(t * 4, 1) * 3)), 3);
      pts.push([Math.cos(a) * R, h, Math.sin(a) * R - 10]);
    }
    const pos = [], col = [], idx = [], base = new THREE.Color('#9aaab8'), snow = new THREE.Color('#e9eef2');
    pts.forEach(([x, h, z], i) => {
      pos.push(x, -20, z, x, h, z);
      col.push(base.r, base.g, base.b); const c = base.clone().lerp(snow, smooth(150, 230, h)); col.push(c.r, c.g, c.b);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
    const alps = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide, transparent: true, opacity: .55 }));
    alps.name = 'Alpen'; alps.userData.noSplat = true; alps.userData.fern = true; alps.renderOrder = -1; group.add(alps);
  }

  flush();

  // ---------------------------------------------------------------- Arbeiter
  const workers = [];
  function arbeiter({ position, face, helmet = '#f3f3ef', vest = '#d4e93a', remote = false, pose = 'stand', phase = 0, skin = '#c8987a' }) {
    const g = new THREE.Group(); g.name = 'Arbeiter';
    const m = (c, r = .8, extra = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, ...extra });
    // Warnkleidung leuchtet leicht (fluoreszierendes Gewebe), Reflexstreifen glänzen.
    const mVest = m(vest, .66, { emissive: new THREE.Color(vest).multiplyScalar(.1) });
    const mPants = m('#363b41', .92), mSkin = m(skin, .62), mBoot = m('#2b241f', .75), mSole = m('#141414', .9);
    const mRefl = m('#d9dedd', .28, { metalness: .55 }), mHelmet = m(helmet, .32), mGlove = m('#59604f', .92), mHair = m('#3a2c22', .95);
    const mesh = (geo, mat, parent, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) => { const o = new THREE.Mesh(geo, mat); o.position.set(...pos); o.rotation.set(...rot); o.scale.set(...scale); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
    const pivot = (parent, pos) => { const p = new THREE.Group(); p.position.set(...pos); parent.add(p); return p; };
    const lathe = (pts, seg = 20) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

    const hips = pivot(g, [0, .92, 0]);
    // Becken/Hosenbund.
    mesh(lathe([[.0, -.1], [.13, -.09], [.155, -.02], [.15, .06], [.0, .07]]), mPants, hips, [0, 0, 0], [0, 0, 0], [1.08, 1, .78]);
    const legs = [-1, 1].map(s => {
      const hip = pivot(hips, [s * .09, -.05, 0]);
      mesh(lathe([[.0, -.42], [.058, -.41], [.062, -.3], [.072, -.12], [.078, 0], [.0, .02]], 14), mPants, hip);
      const knee = pivot(hip, [0, -.42, 0]);
      mesh(lathe([[.0, -.4], [.05, -.39], [.052, -.3], [.06, -.12], [.06, 0], [.0, .02]], 14), mPants, knee);
      mesh(new THREE.CylinderGeometry(.062, .058, .035, 14, 1, true), mRefl, knee, [0, -.24, 0]);
      mesh(new THREE.CapsuleGeometry(.055, .15, 4, 10), mBoot, knee, [0, -.4, .05], [Math.PI / 2, 0, 0], [1.05, 1, .8]);
      mesh(new THREE.BoxGeometry(.11, .025, .27), mSole, knee, [0, -.45, .05]);
      return { hip, knee };
    });
    const torso = pivot(hips, [0, .04, 0]);
    // Rumpf mit breiterer Brust und schmalerer Taille; Jacke darüber.
    mesh(lathe([[.0, -.02], [.148, 0], [.152, .12], [.168, .3], [.18, .42], [.165, .5], [.11, .56], [.06, .58], [.0, .585]], 24), mVest, torso, [0, 0, 0], [0, 0, 0], [1.13, 1, .72]);
    for (const y of [.14, .26]) mesh(new THREE.CylinderGeometry(.162 + y * .06, .158 + y * .06, .035, 24, 1, true), mRefl, torso, [0, y, 0], [0, 0, 0], [1.14, 1, .74]);
    for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.035, .5, .01), mRefl, torso, [s * .085, .33, .132], [0, 0, 0]);
    mesh(new THREE.CylinderGeometry(.045, .052, .09, 12), mSkin, torso, [0, .6, 0]);
    // Kragen.
    mesh(new THREE.TorusGeometry(.065, .022, 6, 16), mVest, torso, [0, .575, 0], [Math.PI / 2, 0, 0], [1.1, 1, 1]);
    const neck = pivot(torso, [0, .63, 0]);
    mesh(new THREE.SphereGeometry(.098, 22, 16), mSkin, neck, [0, .1, .012], [0, 0, 0], [.9, 1.12, 1]);
    mesh(new THREE.SphereGeometry(.097, 18, 10, Math.PI * 1.05, Math.PI * .9, Math.PI * .3, Math.PI * .42), mHair, neck, [0, .1, .004], [0, 0, 0], [.94, 1.12, 1.02]);
    mesh(new THREE.BoxGeometry(.022, .035, .03), mSkin, neck, [0, .09, .1]);
    for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(.022, 8, 6), mSkin, neck, [s * .088, .1, .0], [0, 0, 0], [.5, 1, .8]);
    mesh(new THREE.BoxGeometry(.165, .032, .03), m('#1a2227', .15, { metalness: .5 }), neck, [0, .125, .088]);
    // Schutzhelm: Kuppe, umlaufende Krempe mit Schirm, Mittelrippe.
    mesh(new THREE.SphereGeometry(.118, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), mHelmet, neck, [0, .16, .0], [0, 0, 0], [1, .86, 1.12]);
    mesh(new THREE.CylinderGeometry(.13, .132, .01, 30), mHelmet, neck, [0, .162, .018], [0, 0, 0], [1, 1, 1.16]);
    mesh(new THREE.BoxGeometry(.026, .02, .24), mHelmet, neck, [0, .262, -.005]);
    const arms = [-1, 1].map(s => {
      const sh = pivot(torso, [s * .19, .47, 0]);
      mesh(new THREE.SphereGeometry(.058, 14, 10), mVest, sh, [0, -.01, 0]);
      mesh(lathe([[.0, -.29], [.045, -.28], [.05, -.15], [.056, -.02], [.0, .02]], 14), mVest, sh);
      mesh(new THREE.CylinderGeometry(.053, .052, .03, 14, 1, true), mRefl, sh, [0, -.12, 0]);
      const el = pivot(sh, [0, -.28, 0]);
      mesh(lathe([[.0, -.25], [.042, -.24], [.046, -.12], [.049, -.01], [.0, .02]], 14), mVest, el);
      // Handschuh: Hand als abgeflachte Kapsel mit Daumen.
      mesh(new THREE.CapsuleGeometry(.038, .055, 4, 10), mGlove, el, [0, -.3, 0], [0, 0, 0], [1, 1, .62]);
      mesh(new THREE.CapsuleGeometry(.014, .03, 3, 6), mGlove, el, [s * -.03, -.28, .025], [.5, 0, s * .4]);
      return { sh, el };
    });
    if (remote) {
      // Funkfernsteuerung am Brustgurt, wie bei modernen Bohrgeräten üblich.
      mesh(new THREE.BoxGeometry(.3, .08, .17), m('#2b3033', .55), torso, [0, .2, .2], [.35, 0, 0]);
      mesh(new THREE.BoxGeometry(.3, .018, .17), m('#ffc226', .5), torso, [0, .244, .186], [.35, 0, 0]);
      for (const x of [-.08, .08]) mesh(new THREE.CylinderGeometry(.012, .012, .055, 8), m('#111', .6), torso, [x, .285, .2], [.35, 0, 0]);
      mesh(new THREE.SphereGeometry(.014, 8, 6), m('#e0302a', .4), torso, [0, .27, .225]);
      mesh(new THREE.CylinderGeometry(.006, .006, .16, 6), m('#111', .6), torso, [.13, .34, .14], [.1, 0, 0]);
      for (const s of [-1, 1]) mesh(new THREE.BoxGeometry(.025, .36, .012), m('#1e2326', .8), torso, [s * .11, .4, .105], [-.38, 0, s * .1]);
    }
    g.position.set(...position);
    g.rotation.y = Math.atan2(face[0] - position[0], face[1] - position[2]);
    group.add(g);
    const w = { g, hips, torso, neck, legs, arms, pose, phase };
    workers.push(w); return w;
  }
  arbeiter({ position: [4.9, 0, 1.9], face: [2.2, .1], remote: true, pose: 'remote', phase: 0 });
  arbeiter({ position: [3.35, 0, -1.25], face: [2.0, .35], helmet: '#6aaa3a', pose: 'hand', phase: 2.1, skin: '#b88466' });

  function poseWorker(w, t) {
    const k = t + w.phase;
    const breathe = Math.sin(k * 1.6) * .01;
    w.hips.rotation.z = Math.sin(k * .35) * .022;
    w.torso.rotation.z = -w.hips.rotation.z * .7;
    w.torso.rotation.x = .03 + breathe;
    w.neck.rotation.y = Math.sin(k * .23) * .3 + Math.sin(k * .71) * .05;
    w.neck.rotation.x = -.08 + Math.sin(k * .19) * .05;
    const [L, R] = w.legs;
    L.hip.rotation.set(-.03, 0, -.04 - w.hips.rotation.z); R.hip.rotation.set(.07, 0, .04 - w.hips.rotation.z);
    L.knee.rotation.x = .05; R.knee.rotation.x = .02;
    const [aL, aR] = w.arms;
    if (w.pose === 'remote') {
      // Beide Hände an der Fernsteuerung, Blick nach oben zum Bohrkopf.
      for (const [a, s] of [[aL, -1], [aR, 1]]) {
        a.sh.rotation.set(-.32, 0, s * .1);
        a.el.rotation.set(-1.32 + Math.sin(k * 2.3 + s) * .03, 0, -s * .42);
      }
      w.neck.rotation.x = -.32 + Math.sin(k * .19) * .05;
    } else {
      // Einweiser: linker Arm locker, rechter gibt dem Bediener Handzeichen.
      aL.sh.rotation.set(.04 + Math.sin(k * .5) * .03, 0, -.1); aL.el.rotation.set(-.18, 0, .04);
      const sign = .5 + .5 * Math.sin(k * .6);
      aR.sh.rotation.set(-1.05 - sign * .4, 0, .16); aR.el.rotation.set(-.5 + sign * .2, 0, -.08);
      w.torso.rotation.x = .08 + breathe;
    }
  }
  function update(t) { for (const w of workers) poseWorker(w, t); }
  update(0);

  return { group, workers, update, terrainHeight, materials: mats, zaunPunkte };
}
