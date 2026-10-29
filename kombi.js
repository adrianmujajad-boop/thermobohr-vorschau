/*
 * Thermobohr AG – kombinierte Fassung: Codex-Oberfläche + Rotomax-Modell
 * (Codex/rig-model.js) in Claudes Scroll-Animation (claude/bohranimation).
 *
 * Reines Canvas 2D, keine Abhängigkeiten. Der Scrollfortschritt der Sektion
 * #bohrung (0..1) steuert die ganze Geschichte:
 *   Bohrgerät → Bohren → Endtiefe → Gestänge ausbauen → Sonde einbauen → Hinterfüllen → Wärme.
 *
 * Weltkoordinaten in Metern: x/z horizontal, y nach oben, Geländeoberkante y = 0,
 * Bohrachse bei x = z = 0. Rohrradien sind zur Sichtbarkeit stark überhöht.
 * Das Bohrgerät wird so eingesetzt, dass seine Bohrspindel genau auf der
 * Bohrachse steht und die Raupen auf der Geländeoberkante. *
 * claude/v006-stationen: Jede Station hat eine eigene Kameraeinstellung (data-kamera,
 * einstellung()), die Stationen selbst führt stationen.js.
 */
(() => {
  'use strict';

  // ---------- Bohrgerät ----------
  // Spindelachse im Modell von Codex (rig-model.js: Drehantrieb und untere Spindel bei x = 2.04, z = 0).
  const RIG_ACHSE = [2.04, 0, 0];
  // Das Modell ist etwa in Metern gebaut. Wie die Rohrradien wird es zur Sichtbarkeit überhöht.
  const RIG_SKALA = 3;
  const RIG_SPINDEL_UNTEN = 0.38 * RIG_SKALA;   // dort übernimmt die Spindel des Geräts das Gestänge
  const HINTERGRUND = '#071b15';

  // ---------- Beispielwerte – an das echte Projekt anpassen ----------
  const ENDTIEFE = 500;       // m
  const VERROHRUNG = 24;      // Schutzverrohrung durch das Lockergestein bis in den Fels, m
  const GW_SPIEGEL = 6;       // Grundwasserspiegel, m
  const BX = 80, BZ = 80, BUNTEN = ENDTIEFE + 12;   // Erdblock: halbe Breite, halbe Tiefe, Unterkante

  // Beispielprofil Schweizer Mittelland, von oben nach unten (bis = Unterkante in m).
  // farbe/deckung: schwache Tönung des Schichtbands im Schnitt durch die Bohrachse.
  const SCHICHTEN = [
    { name: 'Oberboden', art: 'boden', bis: 1.5, amp: 0.18, farbe: '150,110,62', deckung: 0.035 },
    { name: 'Kies & Sand · Grundwasser', art: 'kies', bis: 12, amp: 0.8, farbe: '190,166,108', deckung: 0.025 },
    { name: 'Moräne', art: 'moraene', bis: 24, amp: 1.2, farbe: '138,150,122', deckung: 0.025 },
    { name: 'Obere Süsswassermolasse', art: 'molasse', bis: 115, amp: 3, farbe: '118,140,100', deckung: 0.02 },
    { name: 'Obere Meeresmolasse', art: 'molasse', bis: 180, amp: 3.5, farbe: '168,148,102', deckung: 0.025 },
    { name: 'Untere Süsswassermolasse', art: 'molasse', bis: BUNTEN, amp: 0, farbe: '132,116,96', deckung: 0.02 },
  ];
  const temperatur = d => 10.5 + 0.03 * Math.max(0, d - 15);

  // Scrollfortschritt → Bohrtiefe. Oben langsamer (viel zu sehen), in der Molasse schneller.
  const BOHRKURVE = [[0.05, 0], [0.1, 5], [0.16, 13], [0.22, 26], [0.31, ENDTIEFE * .28], [0.42, ENDTIEFE * .52], [0.51, ENDTIEFE * .78], [0.585, ENDTIEFE]];

  const TAU = Math.PI * 2;
  const FOV = 36 * Math.PI / 180;
  const NAH = 0.35;        // Nahebene der Kamera, m
  const STUFEN = 14;       // Deckkraftstufen für das Bündeln der Striche
  const REDUZIERT = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const STIL = {
    raster:    { rgb: '120,160,128', w: 1 },
    block:     { rgb: '130,185,140', w: 1 },
    schicht:   { rgb: '104,184,88',  w: 1 },
    gestein:   { rgb: '150,190,152', w: 1 },
    wasser:    { rgb: '96,190,220',  w: 1.2 },
    rohr:      { rgb: '205,218,208', w: 1 },
    wand:      { rgb: '110,165,120', w: 1 },
    gestaenge: { rgb: '120,206,86',  w: 1.1 },
    krone:     { rgb: '160,235,118', w: 1.2 },
    klein:     { rgb: '205,230,200', w: 1 },
    verpress:  { rgb: '175,196,182', w: 1 },
    sonde:     { rgb: '228,238,230', w: 1.3 },
    kalt:      { rgb: '110,196,236', w: 1.8 },
    waerme:    { rgb: '246,168,74',  w: 1.6 },
    gluehen:   { rgb: '246,150,60',  w: 4 },
  };

  // ---------- Hilfen ----------
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  const smooth = t => t * t * (3 - 2 * t);
  const sanft = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function kurve(p, kf) {
    if (p <= kf[0][0]) return kf[0][1];
    for (let i = 1; i < kf.length; i++) {
      if (p <= kf[i][0]) return lerp(kf[i - 1][1], kf[i][1], (p - kf[i - 1][0]) / (kf[i][0] - kf[i - 1][0]));
    }
    return kf[kf.length - 1][1];
  }

  function zufall(seed) {
    return () => {
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Unterkante von Schicht i an (x, z), leicht gewellt
  function grenze(i, x, z) {
    const s = SCHICHTEN[i];
    if (!s.amp) return -s.bis;
    return -(s.bis + s.amp * (0.6 * Math.sin(x * 0.031 + i * 1.7) + 0.4 * Math.sin(z * 0.043 + i * 2.3) + 0.25 * Math.sin((x - z) * 0.083 + i)));
  }
  function schichtBei(d) {
    for (let i = 0; i < SCHICHTEN.length; i++) if (d < -grenze(i, 0, 0)) return i;
    return SCHICHTEN.length - 1;
  }

  // ---------- Gesteinstextur (fest, einmal erzeugt) ----------
  // Je Gesteinsart ein einfaches Muster: Oberboden Wurzeln, Kies runde Kiesel und Sand, Moräne eckige Steine,
  // Molasse Schichtfugen, Obere Meeresmolasse zusätzlich Schrägschichtung im Sandstein.
  const GESTEIN = { punkte: [], kiesel: [], steine: [], fugen: [], wurzeln: [], schraeg: [] };
  (() => {
    const r = zufall(42);
    for (let d = 0.2; d < ENDTIEFE + 12; d += 0.5) {
      const i = schichtBei(d), art = SCHICHTEN[i].art;
      const n = art === 'kies' ? 5 : art === 'moraene' ? 5 : 2;
      for (let k = 0; k < n; k++) {
        const x = (r() * 2 - 1) * 34, z = -40 + r() * 48, y = -d - r() * 0.5;
        if (x * x + z * z < 4) continue;
        if (art === 'kies' && r() < 0.55 && z < -2) GESTEIN.kiesel.push(x, y, z, 0.05 + r() * 0.16);
        else if (art === 'moraene' && r() < 0.6 && z < -2) GESTEIN.steine.push(x, y, z, 0.16 + r() * (r() < 0.18 ? 0.8 : 0.34), r() * TAU);
        else GESTEIN.punkte.push(x, y, z);
      }
      if (art === 'boden') for (let k = 0; k < 10; k++) GESTEIN.wurzeln.push((r() * 2 - 1) * 30, -30 + r() * 34, 0.3 + r() * 1, r() * TAU);
      if (art === 'molasse' && r() < 0.55) GESTEIN.fugen.push((r() * 2 - 1) * 30, -d, -40 + r() * 48, 2 + r() * 8, (r() - 0.5) * 0.3);
      if (i === 4 && r() < 0.2) GESTEIN.schraeg.push((r() * 2 - 1) * 28, -d, -30 + r() * 34, 3 + r() * 4, r() < 0.5 ? 1 : -1);
    }
  })();

  // Bohrklein, das im Ringraum nach oben geblasen wird
  const KLEIN = Array.from({ length: 70 }, (_, i) => ({ t: (i * 2.399) % TAU, h: (i * 0.37) % 24, v: 0.7 + ((i * 0.618) % 1) * 0.6, r: (i * 0.29) % 1 }));

  // ---------- Bohrgerät aus Codex/rig-model.js in Weltkoordinaten ----------
  // Gemeinsame Eckpunkte werden einmal transformiert; Kanten verweisen per Index darauf.
  const RIG = (() => {
    const m = window.ThermobohrModel;
    if (!m || !Array.isArray(m.segments)) return null;
    const index = new Map(), welt = [], kanten = [];
    const eckpunkt = p => {
      const key = p.join(',');
      let i = index.get(key);
      if (i === undefined) {
        i = welt.length / 3;
        index.set(key, i);
        welt.push((p[0] - RIG_ACHSE[0]) * RIG_SKALA, (p[1] - RIG_ACHSE[1]) * RIG_SKALA, (p[2] - RIG_ACHSE[2]) * RIG_SKALA);
      }
      return i;
    };
    for (const s of m.segments) kanten.push(eckpunkt(s.a), eckpunkt(s.b), clamp(s.tone | 0, 0, 2));
    const n = welt.length / 3;
    return {
      welt: Float64Array.from(welt),
      kanten: Int32Array.from(kanten),
      sx: new Float64Array(n), sy: new Float64Array(n), sz: new Float64Array(n),
      hoehe: m.bounds.max[1] * RIG_SKALA,
      buendel: Array.from({ length: 12 }, () => []),
    };
  })();
  // Linienbild wie im Codex-Viewer: drei Töne, vier Tiefenstufen (vorne heller)
  const RIG_TON = ['#598c6b', '#9dcb77', '#c9e9a0'];
  const RIG_DECKUNG = [0.33, 0.48, 0.71, 0.94];
  const RIG_BREITE = [0.5, 0.7, 1];

  // ---------- Canvas ----------
  const sektion = document.getElementById('bohrung');

  // Optional: data-farben="tiefe" an #bohrung lässt die Farben mit der Bohrtiefe wandern –
  // von Grün über Türkis (Grundwasser) und Gold zu warmem Bernstein: je tiefer, desto wärmer.
  const FARBEN = sektion.dataset.farben === 'tiefe';
  const FARBVERLAUF = [
    // Anteil der Endtiefe, Gestänge, Schichten, Akzent der Texte, Hintergrund
    [0, [120, 206, 86], [104, 184, 88], [180, 216, 133], [7, 27, 21]],
    [0.05, [92, 204, 176], [82, 176, 160], [150, 214, 202], [6, 25, 27]],
    [0.25, [158, 212, 88], [140, 190, 86], [204, 224, 130], [10, 26, 18]],
    [0.6, [226, 198, 92], [200, 176, 92], [236, 208, 122], [20, 21, 13]],
    [1, [246, 156, 78], [222, 140, 86], [246, 178, 110], [24, 16, 11]],
  ];
  let hintergrund = HINTERGRUND, farbeAlt = '';
  const mischeFarbe = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  function farbenNachTiefe(t) {
    let i = 1;
    while (i < FARBVERLAUF.length - 1 && t > FARBVERLAUF[i][0]) i++;
    const [t0, ...a] = FARBVERLAUF[i - 1], [t1, ...b] = FARBVERLAUF[i];
    const u = smooth(range(t, t0, t1));
    const [linie, schicht, akzent, grund] = a.map((f, k) => mischeFarbe(f, b[k], u));
    const grau = [150, 172, 156];
    STIL.gestaenge.rgb = linie.join(',');
    STIL.krone.rgb = mischeFarbe(linie, [255, 255, 255], 0.25).join(',');
    STIL.schicht.rgb = schicht.join(',');
    STIL.gestein.rgb = mischeFarbe(schicht, grau, 0.55).join(',');
    STIL.wand.rgb = mischeFarbe(schicht, grau, 0.35).join(',');
    STIL.block.rgb = mischeFarbe(schicht, grau, 0.5).join(',');
    STIL.raster.rgb = mischeFarbe(schicht, grau, 0.6).join(',');
    hintergrund = `rgb(${grund.join(',')})`;
    // Texte und Linien der Seite folgen über CSS-Variablen an der Bühne
    const css = `${akzent.join(' ')}|${grund.join(' ')}`;
    if (css !== farbeAlt) {
      farbeAlt = css;
      stage.style.setProperty('--green', `rgb(${akzent.join(' ')})`);
      stage.style.setProperty('--buehne', grund.join(' '));
    }
  }
  const canvas = document.getElementById('szene');
  const ctx = canvas.getContext('2d');
  // Einstieg beim Öffnen (einstieg.js, aus Codex/Intro-Studien-v002 «02+»): Kamerabogen von der Krone, Gerät blendet ein
  const EINSTIEG = window.ThermobohrEinstieg;
  let W = 1, H = 1, DPR = 1;
  function groesse() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || 1;
    H = canvas.clientHeight || 1;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
  }

  // ---------- Kamera ----------
  const K = { px: 0, py: 0, pz: 0, rx: 1, rz: 0, ux: 0, uy: 1, uz: 0, fx: 0, fy: 0, fz: -1, f: 1, cx: 0, cy: 0, dist: 1, lookY: 0, nebelA: 1e9, nebelB: 2e9 };

  function kameraSetzen(c) {
    const cp = Math.cos(c.pitch);
    K.px = c.dist * Math.sin(c.yaw) * cp;
    K.py = c.lookY + c.dist * Math.sin(c.pitch);
    K.pz = c.dist * Math.cos(c.yaw) * cp;
    let fx = -K.px, fy = c.lookY - K.py, fz = -K.pz;
    const fl = Math.hypot(fx, fy, fz);
    fx /= fl; fy /= fl; fz /= fl;
    let rx = -fz, rz = fx;                       // rechts = blick × oben
    const rl = Math.hypot(rx, rz);
    rx /= rl; rz /= rl;
    K.fx = fx; K.fy = fy; K.fz = fz; K.rx = rx; K.rz = rz;
    K.ux = -rz * fy; K.uy = rz * fx - rx * fz; K.uz = rx * fy;   // oben = rechts × blick
    K.f = H / (2 * Math.tan(FOV / 2));
    K.cx = W / 2 + (c.ox || 0);
    K.cy = H / 2 + (c.oy || 0);
    K.dist = c.dist;
    K.lookY = c.lookY;
    K.nebelA = c.dist * 1.7;
    K.nebelB = c.dist * 3.6 + 40;
  }

  // tBlick: eigener Verlauf für die Blickhöhe, damit der Bohrkopf beim Eintauchen im Bild bleibt
  const mische = (a, b, t, tBlick = t) => ({
    dist: Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), t)),
    lookY: lerp(a.lookY, b.lookY, tBlick),
    yaw: lerp(a.yaw, b.yaw, t),
    pitch: lerp(a.pitch, b.pitch, t),
  });

  // Eingriffe des Besuchers in der Geräteansicht (Ziehen, Zoom, automatische Drehung)
  const NUTZER = { yaw: 0, pitch: 0, zoom: 1, auto: false };
  const finale = document.querySelector('.cap.finale');

  // ---------- Kameraeinstellungen je Station (claude/v006-stationen) ----------
  // Jede Station und jede Zwischenzeile mit data-kamera bekommt eine eigene Einstellung. Zwischen zwei
  // Fenstern fährt die Kamera weich zur nächsten – meist in der kurzen Pause, in der nur die Bohrung zu sehen ist.
  const KAMERA_FENSTER = [...document.querySelectorAll('[data-kamera]')]
    .map(el => ({ name: el.dataset.kamera, von: +el.dataset.von, bis: +el.dataset.bis, thema: el.classList.contains('thema'), rechts: el.classList.contains('text-rechts') }))
    .sort((a, b) => a.von - b.von);
  const UEBERGANG_VOR = 0.006, UEBERGANG_NACH = 0.022;
  // Gleiche Abfragen wie in stationen.css (Viewport mit Scrollleiste), damit Kamera und Layout übereinstimmen
  const SCHMAL = window.matchMedia('(max-width: 1100px)');
  const QUER = window.matchMedia('(max-width: 1100px) and (max-height: 520px) and (orientation: landscape)');
  const gewicht = {};   // aktueller Anteil jeder Einstellung, z. B. für den Massstab bei «plan»

  // t: Fortschritt innerhalb des Fensters (0..1) für eine leise Bewegung, solange die Station steht
  // quer: Handy quer – wenig Höhe, darum steht der Bohrkopf näher an der Bildmitte
  function einstellung(name, z, t, ovDist, hoch, quer = false) {
    switch (name) {
      // 01 Standort: schräg von oben auf den Ansatzpunkt – Gelände, Verrohrung und Gerätefuss
      case 'ansatz': return { dist: 46, lookY: -z.bohrtiefe * .55, yaw: 1.08 - .3 * t, pitch: .52 };
      // 02 Grundwasser: auf Augenhöhe, die Wasserlinien laufen quer durchs Bild
      case 'wasserlinie': return { dist: 36, lookY: -GW_SPIEGEL - (z.bohrtiefe - GW_SPIEGEL) * .5, yaw: .06 + .14 * t, pitch: .03 };
      // 03 Maschinenpark: ganz nah von unten an die Bohrkrone, langsam umkreisend
      case 'makro': return { dist: (hoch ? 16 : 11) * Math.max(1, 1.75 / (W / H)), lookY: -z.meissel + 1.5, yaw: .7 + 1.1 * t, pitch: -.36 };
      // 04 Erdwärme: weite Kreisfahrt um die Bohrung, die Schichten werden räumlich
      case 'orbit': return { dist: hoch ? 125 : 105, lookY: -z.bohrtiefe + (quer ? 8 : 22), yaw: 1.7 + 1.2 * t, pitch: .2 };
      // 05 Planung: gerade Seitenansicht wie eine Planzeichnung, dazu ein Massstab (massstab())
      case 'plan': return { dist: hoch ? 165 : 140, lookY: -z.bohrtiefe + (quer ? 10 : 30), yaw: .02, pitch: 0 };
      // 06 Haltung: erhöhte Weitsicht – von der Landschaft lotrecht hinunter bis zum Bohrkopf, daneben ein Lot (lotlinie())
      case 'lot': {
        const d = (z.bohrtiefe + 110) / (2 * Math.tan(FOV / 2)) * (hoch ? 1.65 : 1.12), y = -z.bohrtiefe * .5 + 20;
        return { dist: d, lookY: y, yaw: .3 + .22 * t, pitch: Math.asin(clamp((80 - y) / d, 0, .7)) };
      }
      // 500 m: nah an der Krone, die eben zum Stehen kommt
      case 'endtiefe': return { dist: hoch ? 30 : 22, lookY: -ENDTIEFE + 3, yaw: 1.05 + .3 * t, pitch: .14 };
      // Gestänge zurück: erhöhte Gesamtansicht, die Landschaft liegt obenauf, das Gestänge fährt nach oben
      case 'rueckbau': {
        const d = ovDist * 1.02, y = -ENDTIEFE * .5;
        return { dist: d, lookY: y, yaw: .72 + .1 * t, pitch: Math.asin(clamp((80 - y) / d, 0, .7)) };
      }
      // 07 Sonde: erhöhte Gesamtansicht von links, die weisse Sonde läuft durch die ganze Bohrung hinunter
      case 'sonde': {
        const d = ovDist * (hoch ? .95 : .9), y = -ENDTIEFE * .43;
        return { dist: d, lookY: y, yaw: -.45 + .2 * t, pitch: Math.asin(clamp((90 - y) / d, 0, .7)) };
      }
      // 08 Hinterfüllung: erhöhte Gesamtansicht von rechts, die Verpressung steigt von unten bis an die Oberfläche
      case 'verpressen': {
        const d = ovDist * (hoch ? .95 : .9), y = -ENDTIEFE * .43;
        return { dist: d, lookY: y, yaw: .95 - .2 * t, pitch: Math.asin(clamp((90 - y) / d, 0, .7)) };
      }
      // Tauchfahrt: der Spindel entlang ins Bohrloch (wie bisher)
      default: return { dist: hoch ? 30 : 24, lookY: -z.bohrtiefe + 4.5, yaw: .16, pitch: .05 };
    }
  }

  // Bildaufbau: breit weicht die Bohrung der Karte aus, schmal steht sie über dem Blatt unten
  function stationsAnteil(p) {
    let a = 0;
    for (const f of KAMERA_FENSTER) if (f.thema) a = Math.max(a, smooth(range(p, f.von - .01, f.von + .01)) * (1 - smooth(range(p, f.bis - .01, f.bis))));
    return a;
  }

  function kamerafahrt(p, z, ovDist) {
    const hoch = W / H < 0.8, schmal = SCHMAL.matches;
    // Handy quer: Station seitlich, die Bohrung in der Mitte des sichtbaren Teils über der Leiste
    const sichtH = Math.min(H, window.innerHeight), quer = QUER.matches;
    const querY = ((sichtH - 80) / 2 - H / 2) / H;
    let c = { ...einstellung('tauchen', z, 0, ovDist, hoch), kx: 0, ky: 0 };
    for (const k in gewicht) gewicht[k] = 0;
    gewicht.tauchen = 1;
    let vorherBis = KAMERA_FENSTER.length ? KAMERA_FENSTER[0].von - .03 : 1;
    for (const f of KAMERA_FENSTER) {
      const u = range(p, vorherBis - UEBERGANG_VOR, f.von + (f.thema ? UEBERGANG_NACH : 0));
      const t = smooth(u);
      if (t <= 0) break;
      const ziel = einstellung(f.name, z, range(p, f.von, f.bis), ovDist, hoch, quer);
      // Beim Heranfahren zielt der Blick zuerst aufs Motiv, beim Wegfahren bleibt er zuerst darauf
      const tBlick = ziel.dist < c.dist ? smooth(Math.min(1, u * 2)) : smooth(Math.max(0, u * 2 - 1));
      // Bei reduzierter Bewegung kein seitlicher Versatz von Station zu Station (quer stehen dann alle Stationen links)
      const kx = quer ? (f.thema && f.rechts && !REDUZIERT ? -.2 : .2) : schmal || REDUZIERT ? 0 : f.thema ? (f.rechts ? -.065 : .065) : 0;
      const ky = quer ? querY : schmal ? -.12 : f.thema || REDUZIERT ? 0 : -.1;
      const kxAlt = c.kx, kyAlt = c.ky;
      c = mische(c, ziel, t, tBlick);
      c.kx = lerp(kxAlt, kx, t);
      c.ky = lerp(kyAlt, ky, t);
      for (const k in gewicht) gewicht[k] *= 1 - t;
      gewicht[f.name] = (gewicht[f.name] || 0) + t;
      vorherBis = f.bis;
    }
    return c;
  }

  // Schmal steht die Station als Blatt unten. Ist es höher als gedacht (kleine Handys, lange Texte), hebt
  // freistellen() die Szene, bis der Bohrkopf (bzw. Sondenfuss, Verpressspiegel) knapp über dem Blatt steht.
  // Zwischen zwei Stationen bleibt die Hebung stehen, damit die Bohrung nicht auf und ab wippt.
  let hebung = 0;
  function fokusTiefe(z) {
    let name = 'tauchen', g = -1;
    for (const k in gewicht) if (gewicht[k] > g) { g = gewicht[k]; name = k; }
    if (name === 'endtiefe' || name === 'rueckbau') return null;
    if (name === 'sonde') return -z.sonde + 1;
    if (name === 'verpressen') return -ENDTIEFE * (1 - z.verpressung);
    return z.gestaenge > .1 ? -z.meissel : null;
  }
  function freistellen(z, p, dt) {
    let soll = 0;
    const st = window.ThermobohrStationen;
    if (SCHMAL.matches && !QUER.matches && st && st.imBereich(p)) {   // quer steht das Blatt seitlich
      const oben = st.blattOben(), y = fokusTiefe(z);
      soll = hebung;
      if (oben !== null && y !== null) {
        const q = projiziere(0, y, 0);
        if (q) soll = clamp(hebung + q.y + 1.4 * K.f / q.z + 18 - oben, 0, H * .3);
      }
    }
    hebung = REDUZIERT ? soll : hebung + (soll - hebung) * (1 - Math.exp(-dt * 5));
  }

  function kameraZustand(p, z) {
    const asp = W / H, tanV = Math.tan(FOV / 2), breit = W > 900;
    // Geräteansicht wie bei Codex: Motor links, Mast rechts, Bedienseite sichtbar
    const rigHoehe = RIG ? RIG.hoehe : 38;
    const rigPx = breit ? Math.max(260, H - 380) : H * 0.31;
    const geraet = {
      dist: rigHoehe * H / (2 * tanV * rigPx) / NUTZER.zoom,
      lookY: rigHoehe * 0.47,
      yaw: 0.49 + NUTZER.yaw,
      pitch: clamp(0.1 + NUTZER.pitch, -0.2, 0.62),
    };
    // Gesamtansicht so weit weg, dass der Block neben (breit) bzw. unter (schmal) den Text passt
    const ovDist = breit ? Math.max(ENDTIEFE * .7 / tanV, 135 / (tanV * asp * 0.62)) : Math.max(ENDTIEFE / tanV, 135 / (tanV * asp * 0.74));
    const fahrt = kamerafahrt(p, z, ovDist);
    // Schmal steht der Hero-Text über dem Gerät: die Kamera fährt erst los, wenn der Text fast ausgeblendet ist
    const los = breit ? 0.012 : 0.035;
    let c;
    if (REDUZIERT) {
      // Bei reduzierter Bewegung bleibt die ruhige Kamera von v006: nah am Bohrkopf, dann zwei Gesamtansichten
      const kopfAnsicht = smooth(range(p, .13, .22)) * (1 - smooth(range(p, .63, .66)));
      const nah = { dist: asp < 0.8 ? 30 : 24, lookY: -z.bohrtiefe + lerp(4.5, 1.3, kopfAnsicht), yaw: lerp(.16, .48, kopfAnsicht), pitch: lerp(.05, -.32, kopfAnsicht) };
      const mittel = { dist: Math.max(210, ovDist * 0.45), lookY: -ENDTIEFE * .68, yaw: 0.42, pitch: 0.12 };
      const ende = { dist: ovDist * 1.02, lookY: -ENDTIEFE * .488, yaw: 0.78, pitch: 0.2 };
      c = mische(geraet, nah, smooth(range(p, los, 0.13)));
      c = mische(c, mittel, smooth(range(p, 0.645, 0.73)));
      c = mische(c, ende, smooth(range(p, 0.8, 0.93)));
    } else {
      // Vom Gerät fährt die Kamera der Spindel entlang ins Bohrloch, danach von Einstellung zu Einstellung
      c = mische(geraet, fahrt, smooth(range(p, los, 0.13)));
    }
    // Im Intro steht das Gerät rechts neben dem Text (mobil darunter)
    const intro = 1 - smooth(range(p, los, los + 0.058)), schluss = smooth(range(p, 0.89, 0.95));
    c.ox = (breit ? W * 0.19 * intro : 0) + W * fahrt.kx * (1 - schluss);
    c.oy = (breit ? 0 : H * 0.15 * intro) + H * fahrt.ky * (1 - schluss);
    // Am Schluss passen Gerät und Erdblock in den freien Bereich neben (breit) bzw. unter (schmal) dem Text.
    // Links bleibt Platz für die Tiefenmarken, rechts (breit) für die Schichtnamen.
    // Mit den Kamerafahrten übernimmt kameraAbschluss() direkt aus der letzten Einstellung.
    if (schluss > 0 && REDUZIERT) {
      if (breit) einpassen(c, rigHoehe, finale.offsetLeft + finale.offsetWidth + 64, 40, W - 200, H - 80, schluss);
      else einpassen(c, rigHoehe, 56, finale.offsetTop + finale.offsetHeight + 24, W - 16, H - 16, schluss);
    }
    return kameraAbschluss(c, p);
  }

  function einpassen(c, rigHoehe, links, oben, rechts, unten, t) {
    const PUNKTE = [[0, rigHoehe, 0], [-BX, 0, BZ], [BX, 0, -BZ], [-BX, 0, -BZ], [-BX, -BUNTEN, BZ], [BX, -BUNTEN, BZ], [BX, -BUNTEN, -BZ]];
    const rahmen = () => {
      kameraSetzen(c);
      const r = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const [x, y, z] of PUNKTE) {
        const q = projiziere(x, y, z);
        if (!q) continue;
        r.x0 = Math.min(r.x0, q.x); r.x1 = Math.max(r.x1, q.x);
        r.y0 = Math.min(r.y0, q.y); r.y1 = Math.max(r.y1, q.y);
      }
      return r;
    };
    // Abstand anpassen (zweimal, weil die Perspektive nicht ganz linear skaliert), dann mittig ausrichten
    for (let i = 0; i < 2; i++) {
      const r = rahmen(), f = Math.max((r.x1 - r.x0) / (rechts - links), (r.y1 - r.y0) / (unten - oben));
      if (f > 1) c.dist *= lerp(1, f, t);
    }
    const r = rahmen();
    c.ox += ((links + rechts) / 2 - (r.x0 + r.x1) / 2) * t;
    c.oy += ((oben + unten) / 2 - (r.y0 + r.y1) / 2) * t;
  }

  // v003: keep the original projected Rotomax model and return to a close surface view.
  // Insert inside kombi.js's IIFE, after einpassen() and before the drawing helpers.
  // These helpers do not change any state at p <= .89.
  let closingYaw = 0, closingPitch = 0;

  function abschluss3DMix(p) {
    return smooth(range(p, 0.89, 0.95));
  }

  // Optional for dedicated closing controls: radians, deliberately limited.
  // The camera refits after each change, so the model remains inside its viewport.
  function abschlussDrehen(yawDelta, pitchDelta = 0) {
    closingYaw = clamp(closingYaw + yawDelta, -0.75, 0.75);
    closingPitch = clamp(closingPitch + pitchDelta, -0.06, 0.12);
  }

  document.addEventListener('thermobohr:orbit', event => {
    if (event.detail && event.detail.reset === true) { closingYaw = 0; closingPitch = 0; }
    else if (Number.isFinite(event.detail && event.detail.delta)) abschlussDrehen(event.detail.delta);
    if (!laeuft) requestAnimationFrame(frame);
  });

  document.addEventListener('click', event => {
    const control = event.target.closest && event.target.closest('#ending-panel [data-orbit]');
    if (!control) return;
    const value = control.dataset.orbit;
    document.dispatchEvent(new CustomEvent('thermobohr:orbit', {detail: value === 'reset' ? {reset:true} : {delta:Number(value)}}));
  });

  function abschlussRahmen() {
    const visibleH = Math.min(H, window.innerHeight);
    const breit = W > 900 || (W > 600 && visibleH <= 650);
    if (breit) return { links: W * 0.47, oben: visibleH * 0.10, rechts: W * 0.955, unten: visibleH * 0.80 };

    // The copy is above the 3D model on small screens. Read the actual text bottom
    // so wrapping/zoom cannot place the mast behind the contact button.
    const copy = document.querySelector('#ending-panel .closing-copy');
    const canvasRect = canvas.getBoundingClientRect();
    const copyBottom = copy ? copy.getBoundingClientRect().bottom - canvasRect.top : 260;
    const oben = clamp(copyBottom + 24, Math.min(238, visibleH * 0.43), Math.max(240, visibleH - 170));
    return { links: W * 0.075, oben, rechts: W * 0.925, unten: visibleH - (visibleH < 700 ? 108 : 123) };
  }

  function kameraAbschluss(c, p) {
    const t = abschluss3DMix(p);
    if (t === 0 || !RIG) return c;

    const rahmen = abschlussRahmen();
    const breite = Math.max(100, rahmen.rechts - rahmen.links);
    const hoehe = Math.max(100, rahmen.unten - rahmen.oben);
    const ziel = {
      dist: RIG.hoehe * H / (2 * Math.tan(FOV / 2) * hoehe * 0.90),
      lookY: RIG.hoehe * 0.47,
      yaw: 0.55 + closingYaw,
      pitch: 0.13 + closingPitch,
      ox: 0,
      oy: 0,
    };

    // A conservative box around the *existing* rig. Include the local collar and
    // ground marks, never the full geological block or the 500 m borehole.
    let x0 = -16, x1 = 6, z0 = -5, z1 = 5;
    for (let i = 0; i < RIG.welt.length; i += 3) {
      x0 = Math.min(x0, RIG.welt[i]); x1 = Math.max(x1, RIG.welt[i]);
      z0 = Math.min(z0, RIG.welt[i + 2]); z1 = Math.max(z1, RIG.welt[i + 2]);
    }
    const ecken = [];
    for (const x of [x0, x1]) for (const y of [-0.6, RIG.hoehe]) for (const z of [z0, z1]) ecken.push([x, y, z]);
    const messen = () => {
      kameraSetzen(ziel);
      const box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const punkt of ecken) {
        const q = projiziere(...punkt);
        if (!q) continue;
        box.x0 = Math.min(box.x0, q.x); box.x1 = Math.max(box.x1, q.x);
        box.y0 = Math.min(box.y0, q.y); box.y1 = Math.max(box.y1, q.y);
      }
      return box;
    };

    for (let i = 0; i < 4; i++) {
      const box = messen();
      const faktor = Math.max((box.x1 - box.x0) / breite, (box.y1 - box.y0) / hoehe);
      if (!Number.isFinite(faktor) || faktor <= 0) break;
      ziel.dist *= clamp(faktor, 0.65, 1.75);
    }
    const box = messen();
    if (Number.isFinite(box.x0)) {
      ziel.ox = (rahmen.links + rahmen.rechts - box.x0 - box.x1) / 2;
      ziel.oy = (rahmen.oben + rahmen.unten - box.y0 - box.y1) / 2;
    }

    // Der Blick schwenkt zuerst aufs Gerät, dann fährt die Kamera heran (claude/v006-stationen)
    const gemischt = mische(c, ziel, t, smooth(Math.min(1, range(p, 0.89, 0.95) * 1.8)));
    gemischt.ox = lerp(c.ox || 0, ziel.ox, t);
    gemischt.oy = lerp(c.oy || 0, ziel.oy, t);
    return gemischt;
  }

  // Call after the old geological drawing has been flushed and its alpha reset,
  // then ausgeben() once more. These are real 3D world lines on y = 0, not a 2D image.
  function abschlussBoden(p) {
    const t = abschluss3DMix(p);
    if (t <= 0) return;
    const a = t * 0.22;
    // Four separated footprint marks; no bounding box, cage or repeating grid.
    linie('raster', a, -16, -0.05, -5, -9, -0.05, -5);
    linie('raster', a, -16, -0.05, -5, -16, -0.05, -1);
    linie('raster', a, 6, -0.05, 5, -1, -0.05, 5);
    linie('raster', a, 6, -0.05, 5, 6, -0.05, 1);
    // Restrained surface collar around the same drilling axis as the sequence.
    ring('wand', t * 0.48, 0.03, 1.55, 36);
    ring('wand', t * 0.24, -0.55, 1.55, 36);
    for (let i = 0; i < 4; i++) {
      const phi = i * TAU / 4;
      const x = Math.cos(phi) * 1.55, z = Math.sin(phi) * 1.55;
      linie('wand', t * 0.28, x, 0.03, z, x, -0.55, z);
    }
  }

  // ---------- Striche sammeln und gebündelt zeichnen ----------
  const WEICHE_LAYER = new Set(['schicht', 'gestein', 'wasser', 'block']);
  const puffer = {};
  for (const s in STIL) {
    const n = WEICHE_LAYER.has(s) ? 128 : STUFEN;
    puffer[s] = { n, l: stufenListe(n), k: stufenListe(n), p: stufenListe(n) };
  }
  function stufenListe(n) { return Array.from({ length: n }, () => []); }
  const stufe = (a, stil) => Math.round(clamp(a, 0, 1) * (puffer[stil].n - 1));
  const deckungMinimum = stil => WEICHE_LAYER.has(stil) ? .004 : .02;
  const nebel = z => smooth(range(z, NAH, 4)) * (1 - smooth(range(z, K.nebelA, K.nebelB)));

  function tk(x, y, z, o) {
    const dx = x - K.px, dy = y - K.py, dz = z - K.pz;
    o.x = dx * K.rx + dz * K.rz;
    o.y = dx * K.ux + dy * K.uy + dz * K.uz;
    o.z = dx * K.fx + dy * K.fy + dz * K.fz;
  }

  function seg(stil, alpha, a, b) {
    let ax = a.x, ay = a.y, az = a.z, bx = b.x, by = b.y, bz = b.z;
    if (az < NAH) {
      if (bz < NAH) return;
      const t = (NAH - az) / (bz - az);
      ax += (bx - ax) * t; ay += (by - ay) * t; az = NAH;
    } else if (bz < NAH) {
      const t = (NAH - bz) / (az - bz);
      bx += (ax - bx) * t; by += (ay - by) * t; bz = NAH;
    }
    const al = alpha * nebel((az + bz) * 0.5);
    if (al < deckungMinimum(stil)) return;
    const x1 = K.cx + ax * K.f / az, y1 = K.cy - ay * K.f / az;
    const x2 = K.cx + bx * K.f / bz, y2 = K.cy - by * K.f / bz;
    if ((x1 < -40 && x2 < -40) || (x1 > W + 40 && x2 > W + 40) || (y1 < -40 && y2 < -40) || (y1 > H + 40 && y2 > H + 40)) return;
    puffer[stil].l[stufe(al, stil)].push(x1, y1, x2, y2);
  }

  const A = { x: 0, y: 0, z: 0 }, B = { x: 0, y: 0, z: 0 };
  function linie(stil, a, x1, y1, z1, x2, y2, z2) {
    tk(x1, y1, z1, A);
    tk(x2, y2, z2, B);
    seg(stil, a, A, B);
  }

  const P = [], TMP = [];
  function zug(stil, a, pts, zu) {
    const n = pts.length / 3;
    for (let i = 0; i < n; i++) {
      if (!TMP[i]) TMP[i] = { x: 0, y: 0, z: 0 };
      tk(pts[3 * i], pts[3 * i + 1], pts[3 * i + 2], TMP[i]);
    }
    for (let i = 1; i < n; i++) seg(stil, a, TMP[i - 1], TMP[i]);
    if (zu && n > 2) seg(stil, a, TMP[n - 1], TMP[0]);
  }

  function ring(stil, a, y, r, n, phase = 0, x0 = 0, z0 = 0) {
    P.length = 0;
    for (let i = 0; i < n; i++) {
      const t = phase + i / n * TAU;
      P.push(x0 + Math.cos(t) * r, y, z0 + Math.sin(t) * r);
    }
    zug(stil, a, P, true);
  }

  function mantel(stil, a, y1, y2, r, n, phase = 0, r2 = r) {
    for (let i = 0; i < n; i++) {
      const t = phase + i / n * TAU, c = Math.cos(t), s = Math.sin(t);
      linie(stil, a, c * r, y1, s * r, c * r2, y2, s * r2);
    }
  }

  function kreis(stil, a, x, y, z, r) {
    tk(x, y, z, A);
    if (A.z < NAH) return;
    const rr = r * K.f / A.z, al = a * nebel(A.z);
    if (rr < 0.7 || al < deckungMinimum(stil)) return;
    const sx = K.cx + A.x * K.f / A.z, sy = K.cy - A.y * K.f / A.z;
    if (sx < -rr || sx > W + rr || sy < -rr || sy > H + rr) return;
    puffer[stil].k[stufe(al, stil)].push(sx, sy, rr);
  }

  function punkt(stil, a, x, y, z, s) {
    tk(x, y, z, A);
    if (A.z < NAH) return;
    const al = a * nebel(A.z);
    if (al < deckungMinimum(stil)) return;
    const sx = K.cx + A.x * K.f / A.z, sy = K.cy - A.y * K.f / A.z;
    if (sx < 0 || sx > W || sy < 0 || sy > H) return;
    puffer[stil].p[stufe(al, stil)].push(sx, sy, s);
  }

  function projiziere(x, y, z) {
    tk(x, y, z, A);
    if (A.z < NAH) return null;
    return { x: K.cx + A.x * K.f / A.z, y: K.cy - A.y * K.f / A.z, z: A.z };
  }

  function ausgeben() {
    for (const name in puffer) {
      const s = STIL[name], b = puffer[name];
      ctx.lineWidth = s.w;
      for (let i = 1; i < b.n; i++) {
        const L = b.l[i], C = b.k[i], Q = b.p[i];
        const farbe = `rgba(${s.rgb},${(i / (b.n - 1)).toFixed(3)})`;
        if (L.length || C.length) {
          ctx.strokeStyle = farbe;
          ctx.beginPath();
          for (let j = 0; j < L.length; j += 4) { ctx.moveTo(L[j], L[j + 1]); ctx.lineTo(L[j + 2], L[j + 3]); }
          for (let j = 0; j < C.length; j += 3) { ctx.moveTo(C[j] + C[j + 2], C[j + 1]); ctx.arc(C[j], C[j + 1], C[j + 2], 0, TAU); }
          ctx.stroke();
          L.length = 0; C.length = 0;
        }
        if (Q.length) {
          ctx.fillStyle = farbe;
          ctx.beginPath();
          for (let j = 0; j < Q.length; j += 3) ctx.rect(Q[j] - Q[j + 2] / 2, Q[j + 1] - Q[j + 2] / 2, Q[j + 2], Q[j + 2]);
          ctx.fill();
          Q.length = 0;
        }
      }
      b.l[0].length = 0; b.k[0].length = 0; b.p[0].length = 0;
    }
  }

  // ---------- Zeitachse ----------
  function zustand(p) {
    const bohrtiefe = kurve(p, BOHRKURVE);
    const rueckzug = sanft(range(p, 0.645, 0.715));
    const verpressung = range(p, 0.805, 0.885);
    const z = {
      bohrtiefe,
      meissel: bohrtiefe * (1 - rueckzug),
      gestaenge: 1 - range(p, 0.712, 0.726),
      bohren: p < 0.645,
      sonde: ENDTIEFE * sanft(range(p, 0.725, 0.8)),
      verpressung,
      verrohrungRaus: sanft(range(p, 0.885, 0.915)),
      waerme: range(p, 0.895, 0.95),
    };
    if (p < 0.05) { z.anzeige = 0; z.phase = 'Bohrbereit'; }
    else if (p < 0.585) { z.anzeige = bohrtiefe; z.phase = 'Bohren'; }
    else if (p < 0.645) { z.anzeige = ENDTIEFE; z.phase = 'Endtiefe erreicht'; }
    else if (p < 0.72) { z.anzeige = z.meissel; z.phase = 'Gestänge ausbauen'; }
    else if (p < 0.805) { z.anzeige = z.sonde; z.phase = 'Sonde einbauen'; }
    else if (p < 0.89) { z.anzeige = ENDTIEFE * (1 - verpressung); z.phase = 'Hinterfüllen'; }
    else { z.anzeige = ENDTIEFE; z.phase = 'Sonde in Betrieb'; }
    return z;
  }

  // ---------- Szene ----------
  // Schichtgrenzen als gewellte Linienscharen; an der Bohrung unterbrochen
  // Schichten als schwach getönte Bänder im Schnitt durch die Bohrachse (Ebene z = 0).
  // Nah an der Bohrung färbt das Band den Hintergrund, in der Gesamtansicht entsteht ein Querschnitt.
  const BAND_X = Array.from({ length: 41 }, (_, k) => -BX + k * 4);
  function band(oberkante, unterkante, rgb, alpha) {
    const pts = [];
    for (const x of BAND_X) { const o = { x: 0, y: 0, z: 0 }; tk(x, oberkante(x), 0, o); pts.push(o); }
    for (let k = BAND_X.length - 1; k >= 0; k--) { const o = { x: 0, y: 0, z: 0 }; tk(BAND_X[k], unterkante(BAND_X[k]), 0, o); pts.push(o); }
    // An der Nahebene abschneiden (Sutherland-Hodgman)
    const rein = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], aDrin = a.z >= NAH, bDrin = b.z >= NAH;
      if (aDrin) rein.push(a);
      if (aDrin !== bDrin) {
        const t = (NAH - a.z) / (b.z - a.z);
        rein.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: NAH });
      }
    }
    if (rein.length < 3) return;
    ctx.fillStyle = `rgba(${rgb},${alpha.toFixed(3)})`;
    ctx.beginPath();
    rein.forEach((q, i) => {
      const sx = K.cx + q.x * K.f / q.z, sy = K.cy - q.y * K.f / q.z;
      if (i) ctx.lineTo(sx, sy); else ctx.moveTo(sx, sy);
    });
    ctx.fill();
  }
  // claude/v006-stationen: Aus der Ferne zeichnen sich die Bänder als Kasten ab – dort blenden sie aus.
  function schichtbaender(ov) {
    const fern = 1 - smooth(ov);
    if (fern < 0.02) return;
    for (let i = 0; i < SCHICHTEN.length; i++) {
      const s = SCHICHTEN[i];
      band(i === 0 ? () => 0 : x => grenze(i - 1, x, 0), x => grenze(i, x, 0), s.farbe, s.deckung * fern);
    }
    // Wassergesättigter Kies unter dem Grundwasserspiegel
    band(() => -GW_SPIEGEL, x => grenze(1, x, 0), '96,172,214', 0.018 * fern);
  }

  function schichten(ov) {
    const LUECKE = 1.65;
    const fenster = K.dist * Math.tan(FOV / 2) * 1.8 + 12;
    for (let i = 0; i < SCHICHTEN.length - 1; i++) {
      const basis = i === 0 ? 0.24 : 0.42;
      // Wenige räumlich gestaffelte Konturen statt eines Gitters pro Ebene.
      for (const z of [-56, -24, 0, 36]) {
        const a = basis * (z === 0 ? 1 : z === 36 ? 0.38 : 0.28);
        const teile = Math.abs(z) < LUECKE ? [[-BX, -LUECKE], [LUECKE, BX]] : [[-BX, BX]];
        for (const [x0, x1] of teile) {
          const n = Math.max(2, Math.round((x1 - x0) / 2));
          for (let k = 0; k < n; k++) {
            const xa = lerp(x0, x1, k / n), xb = lerp(x0, x1, (k + 1) / n);
            const xm = (xa + xb) / 2, ym = grenze(i, xm, z);
            const rand = 1 - 0.82 * smooth(range(Math.abs(xm), 32, BX));
            const sicht = 1 - smooth(range(Math.abs(ym - K.lookY), fenster * 0.65, fenster * 1.5));
            linie('schicht', a * rand * sicht, xa, grenze(i, xa, z), z, xb, grenze(i, xb, z), z);
          }
        }
      }
    }
  }

  // Ruhige Zwischenlagen: breite, zusammenhängende Bögen mit weichen Rändern.
  function schichtung(ov) {
    const a = 1 - ov;
    if (a < 0.03) return;
    const fenster = K.dist * Math.tan(FOV / 2) * 1.6 + 8;
    for (let d = 4; d < BUNTEN; d += d < 24 ? 4 : 8) {
      if (Math.abs(-d - K.lookY) > fenster) continue;
      let nahAnGrenze = false;
      for (let i = 0; i < SCHICHTEN.length - 1; i++) if (Math.abs(d + grenze(i, 0, 0)) < 2.2) nahAnGrenze = true;
      if (nahAnGrenze) continue;
      const sichtbar = 1 - smooth(range(Math.abs(-d - K.lookY), fenster * 0.5, fenster));
      for (const z of [0, -30]) {
        const teile = z === 0 ? [[-BX, -1.65], [1.65, BX]] : [[-BX, BX]];
        for (const [x0, x1] of teile) {
          const n = Math.max(2, Math.round((x1 - x0) / 2));
          const hoehe = x => -d - 0.38 * Math.sin(x * 0.026 + d * 0.018) - 0.2 * Math.sin(z * 0.035 + d * 0.012);
          for (let k = 0; k < n; k++) {
            const xa = lerp(x0, x1, k / n), xb = lerp(x0, x1, (k + 1) / n);
            const rand = 1 - smooth(range(Math.abs((xa + xb) / 2), 28, BX));
            linie('schicht', a * sichtbar * rand * (z === 0 ? 0.18 : 0.085), xa, hoehe(xa), z, xb, hoehe(xb), z);
          }
        }
      }
    }
  }

  // staerke > 1 hebt die Wasserlinien hervor (Einstellung «wasserlinie»)
  function grundwasser(staerke = 1) {
    const y = -GW_SPIEGEL, off = REDUZIERT ? 0 : (zeit * 0.24) % 8;
    for (const z of [-28, 0, 28]) {
      const a = (z === 0 ? 0.38 : 0.16) * staerke;
      for (let x = -BX - 8 + off; x < BX; x += 8) {
        const x1 = Math.max(-BX, x), x2 = Math.min(BX, x + 4.8);
        if (x2 <= x1 || (z === 0 && x2 > -1.5 && x1 < 1.5)) continue;
        const rand = 1 - 0.8 * smooth(range(Math.abs((x1 + x2) / 2), 30, BX));
        linie('wasser', a * rand, x1, y, z, x2, y, z);
      }
      for (let x = -BX + 2 + off * 0.5; x < BX; x += 12) {
        if (z === 0 && Math.abs(x) < 2.5) continue;
        linie('wasser', a * 0.26, x, y - 1.2, z, Math.min(BX, x + 1.8), y - 1.2, z);
      }
    }
  }

  function gestein() {
    const a = 1 - smooth(range(K.dist, 40, 160));
    if (a < 0.02) return;
    const fenster = K.dist * Math.tan(FOV / 2) + 6, y0 = K.lookY;
    const deckung = y => a * (1 - smooth(range(Math.abs(y - y0), fenster * 0.55, fenster)));
    const G = GESTEIN;
    for (let i = 0; i < G.punkte.length; i += 6) {
      if (Math.abs(G.punkte[i + 1] - y0) < fenster) punkt('gestein', 0.34 * deckung(G.punkte[i + 1]), G.punkte[i], G.punkte[i + 1], G.punkte[i + 2], 1.2);
    }
    for (let i = 0; i < G.kiesel.length; i += 4) {
      if (Math.abs(G.kiesel[i + 1] - y0) < fenster) kreis('gestein', 0.24 * deckung(G.kiesel[i + 1]), G.kiesel[i], G.kiesel[i + 1], G.kiesel[i + 2], G.kiesel[i + 3]);
    }
    // Moräne: eckige Steine als unregelmässige Fünfecke
    for (let i = 0; i < G.steine.length; i += 5) {
      const [x, y, z, r, w] = [G.steine[i], G.steine[i + 1], G.steine[i + 2], G.steine[i + 3], G.steine[i + 4]];
      if (Math.abs(y - y0) > fenster) continue;
      P.length = 0;
      for (let j = 0; j < 5; j++) {
        const t = w + j / 5 * TAU, rr = r * (0.75 + 0.35 * Math.sin(w * 3 + j * 2.1));
        P.push(x + Math.cos(t) * rr, y + Math.sin(t) * rr * 0.8, z);
      }
      zug('gestein', 0.27 * deckung(y), P, true);
    }
    for (let i = 0; i < G.fugen.length; i += 5) {
      const y = G.fugen[i + 1];
      if (Math.abs(y - y0) < fenster) linie('gestein', 0.15 * deckung(y), G.fugen[i], y, G.fugen[i + 2], G.fugen[i] + G.fugen[i + 3], y + G.fugen[i + 4], G.fugen[i + 2]);
    }
    // Sandstein der Oberen Meeresmolasse: kleine Sets schräger Schichtung zwischen zwei Fugen
    for (let i = 0; i < G.schraeg.length; i += 5) {
      const [x, y, z, w, s] = [G.schraeg[i], G.schraeg[i + 1], G.schraeg[i + 2], G.schraeg[i + 3], G.schraeg[i + 4]];
      if (Math.abs(y - y0) > fenster) continue;
      linie('gestein', 0.18 * deckung(y), x, y, z, x + w, y, z);
      linie('gestein', 0.18 * deckung(y), x, y - 1.2, z, x + w, y - 1.2, z);
      for (let k = 0; k < 4; k++) {
        const xs = x + (k + 0.5) * w / 4;
        linie('gestein', 0.12 * deckung(y), xs - s * 0.5, y, z, xs + s * 0.5, y - 1.2, z);
      }
    }
    // Oberboden: feine Wurzeln von der Geländeoberkante nach unten
    if (y0 > -30) {
      for (let i = 0; i < G.wurzeln.length; i += 4) {
        const [x, z, l, w] = [G.wurzeln[i], G.wurzeln[i + 1], G.wurzeln[i + 2], G.wurzeln[i + 3]];
        P.length = 0;
        for (let k = 0; k <= 3; k++) P.push(x + Math.sin(w + k * 1.9) * 0.12 * k, -0.05 - l * k / 3, z);
        zug('gestein', 0.2 * deckung(-l / 2), P, false);
      }
    }
  }

  function bohrloch(z) {
    const verr = Math.min(z.bohrtiefe, VERROHRUNG);
    const a = 0.75 * (1 - z.verrohrungRaus);
    if (verr > 0.05 && a > 0.02) {
      const dy = z.verrohrungRaus * 26, R = 1.38;
      const yTop = 1.2 + dy, yBot = -verr + dy;
      mantelS('rohr', a * 0.9, yTop, yBot, R, 14);
      for (let y = yTop; y > yBot; y -= 3) ring('rohr', a * 0.55, y, R, 20);
      ring('rohr', a, yBot, R, 24);
      ring('rohr', a, yBot + 0.3, R + 0.06, 24);
    }
    // Offene Bohrlochwand unter der Verrohrung (bis die Hinterfüllung sie füllt)
    if (z.bohrtiefe > VERROHRUNG) {
      const RW = 1.25, unten = -z.bohrtiefe;
      const oben = z.verpressung > 0 ? Math.min(-VERROHRUNG, -ENDTIEFE * (1 - z.verpressung)) : -VERROHRUNG;
      mantel('wand', 0.3, -VERROHRUNG, unten, RW, 6, 0.3);
      for (let y = oben - 2; y > unten; y -= 4) ring('wand', 0.18, y, RW, 16);
    }
  }

  function verpressung(z) {
    if (z.verpressung <= 0) return;
    const R = 1.25, unten = -ENDTIEFE, oben = -ENDTIEFE * (1 - z.verpressung);
    // Flächige Füllung als Silhouette des Zylinders
    const p1 = projiziere(-K.rx * R, oben, -K.rz * R), p2 = projiziere(K.rx * R, oben, K.rz * R);
    const p3 = projiziere(K.rx * R, unten, K.rz * R), p4 = projiziere(-K.rx * R, unten, -K.rz * R);
    if (p1 && p2 && p3 && p4) {
      ctx.fillStyle = 'rgba(175,196,182,0.1)';
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y);
      ctx.fill();
    }
    mantel('verpress', 0.35, oben, unten, R, 8, 0.2);
    for (let y = oben - 1.2; y > unten; y -= 1.2) ring('verpress', 0.2, y, R, 16);
    if (z.verpressung < 1) {
      ring('verpress', 0.95, oben, R, 24);
      ring('verpress', 0.5, oben + 0.25, R * 0.8, 20);
    }
  }

  const ROHRE = [[0.42, 0], [-0.42, 0], [0, 0.42], [0, -0.42]];
  function sonde(z, ov) {
    if (z.sonde <= 0.01) return;
    const yf = -z.sonde, yFuss = yf + 1.7, yTop = 0.6;
    // Aus der Ferne addieren sich die vier Rohre zu Weiss – dann zurücknehmen, im Betrieb wird es warm
    const a = 0.9 * (1 - 0.45 * ov) * (1 - 0.6 * z.waerme);
    for (const [x, zz] of ROHRE) linie('sonde', a, x, yTop, zz, x, yFuss, zz);
    for (let y = yFuss + 1; y < yTop; y += 2.5) {
      linie('sonde', 0.4, 0.42, y, 0, -0.42, y, 0);
      linie('sonde', 0.4, 0, y, 0.42, 0, y, -0.42);
    }
    // Sondenfuss mit Gewicht
    mantel('sonde', 0.9, yf + 0.4, yFuss, 0.52, 10);
    mantel('sonde', 0.9, yf + 0.4, yf, 0.52, 10, 0, 0.05);
    ring('sonde', 0.9, yFuss, 0.52, 18);
    ring('sonde', 0.7, yFuss - 0.45, 0.52, 18);
    ring('sonde', 0.9, yf + 0.4, 0.52, 18);
  }

  let spin = 0, aktiv = 0, meisselBild = null;

  // Mantellinien mit Silhouetten-Betonung: am sichtbaren Rand hell, zur Mitte hin zart – wirkt plastisch
  function mantelS(stil, a, y1, y2, r, n, phase = 0, r2 = r) {
    const blick = Math.atan2(K.pz, K.px);
    for (let i = 0; i < n; i++) {
      const t = phase + i / n * TAU, c = Math.cos(t), s = Math.sin(t);
      linie(stil, a * (0.3 + 0.7 * Math.abs(Math.sin(t - blick))), c * r, y1, s * r, c * r2, y2, s * r2);
    }
  }

/*
 * v004 – alternative schematic DTH button bit for the existing Canvas 3D renderer.
 * This is a visual concept, not a confirmed attachment of the customer's Rotomax.
 * The drill axis, meissel depth, rotation and the previous animation stay unchanged.
 *
 * Primary reference, Epiroc DTH product catalogue:
 * https://www.epiroc.com/content/dam/epiroc/rock-drilling-tools/documents/Epiroc%20DTH%20product%20catalog.pdf
 * Printed p.16: TD40 flat front, 130 mm, product 90516007,
 * 8 x 15.8 mm gauge buttons, 8 x 14.5 mm front buttons, 2 flushing holes.
 * Printed p.22: COP44 Gold hammer, OD 100 mm, length without bit 1037.5 mm.
 * Body/hammer diameter ratio is retained approximately (100/130 = .77).
 * Axial assembly length and all radial sizes are exaggerated/compressed to suit
 * the existing geological illustration; this is deliberately not a CAD model.
 * Printed p.8 describes flat-front spherical-button bits as one established
 * design for hard abrasive formations; the actual design depends on the geology.
 *
 * Integration into kombi.js (no extra script tag):
 * 1. Insert the functions below after mantelS().
 * 2. In gestaenge(), replace ONLY the block from
 *    '// Treibhülse (unten am Hammer) und Kronenschaft mit Keilnuten'
 *    until immediately BEFORE '// Schlagimpulse des Imlochhammers im Fels'
 *    with: bohrkopfAlternative(a, yb, spin, yHammer);
 * 3. The previous KRONE constant and stift() are then unused and can be removed.
 *    Keep the existing hammer, rods, particles, depth and camera animations.
 */

// Small opaque tint inside the wireframe makes the flat steel front readable.
// Uses the existing projection and canvas, without a new 3D library or new axes.
function dthFlaeche(punkte, a, hell = false) {
  const bild = punkte.map(p => projiziere(p[0], p[1], p[2]));
  if (bild.some(p => !p)) return;
  ctx.save();
  ctx.fillStyle = `rgba(${hell ? STIL.krone.rgb : STIL.gestaenge.rgb},${Math.min(.24, a * (hell ? .16 : .08))})`;
  ctx.beginPath();
  bild.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Rounded carbide insert with its own normal. Gauge buttons tilt outwards,
// rather than all appearing as concentric horizontal rings under the bit.
function dthKnopf(a, x, y, z, r, nx = 0, ny = -1, nz = 0) {
  const nl = Math.hypot(nx, ny, nz);
  nx /= nl; ny /= nl; nz /= nl;
  let ux = nz, uy = 0, uz = -nx;
  if (Math.hypot(ux, uz) < .01) { ux = 1; uy = 0; uz = 0; }
  const ul = Math.hypot(ux, uy, uz);
  ux /= ul; uy /= ul; uz /= ul;
  const vx = ny * uz - nz * uy, vy = nz * ux - nx * uz, vz = nx * uy - ny * ux;
  const ringe = [[0, 1], [.48, .83], [.78, .44]];
  for (const [h, rr] of ringe) {
    P.length = 0;
    for (let j = 0; j < 10; j++) {
      const t = j / 10 * TAU, c = Math.cos(t) * r * rr, s = Math.sin(t) * r * rr;
      P.push(x + nx * r * h + ux * c + vx * s,
        y + ny * r * h + uy * c + vy * s,
        z + nz * r * h + uz * c + vz * s);
    }
    zug('krone', a * (h ? .85 : 1), P, true);
  }
}

// A short full-width cutting body, flat front, two air holes and deep side flutes.
// Radius of the existing bore wall is 1.25, so the 1.17 body remains inside the hole.
function bohrkopfAlternative(a, yb, phase, yHammer) {
  const R = 1.17, yF = yb + .08, yRand = yb + .21, ySchulter = yb + .70;
  const blick = Math.atan2(K.pz, K.px);
  // The chuck ends above the enlarged head, with a short visible splined neck.
  mantelS('gestaenge', a, yb + 1.14, yHammer, .90, 10, phase);
  ring('gestaenge', a, yb + 1.14, .90, 24, phase);
  ring('gestaenge', a * .75, yb + 1.25, .90, 24, phase);
  mantelS('krone', a * .8, ySchulter, yb + 1.14, .78, 8, phase);
  ring('krone', a * .8, ySchulter, .78, 24, phase);
  // Eight spline shoulders are long enough to read without decorative threading.
  for (let i = 0; i < 8; i++) {
    const t = phase + i / 8 * TAU, c = Math.cos(t), s = Math.sin(t);
    linie('krone', a * .7, c * .80, ySchulter, s * .80, c * .80, yb + 1.10, s * .80);
  }
  mantelS('krone', a, ySchulter, yb + .56, .80, 12, phase, R);
  ring('krone', a, yb + .56, R, 32, phase);

  // Two recessed flutes interrupt the OUTSIDE contour. Old geometry merely
  // drew extra lines on a continuous rounded cone, giving a generic crown shape.
  const ausschnitt = .20;
  for (let sector = 0; sector < 2; sector++) {
    const start = phase + sector * Math.PI + ausschnitt;
    const ende = phase + (sector + 1) * Math.PI - ausschnitt;
    const segmente = 14;
    for (const yy of [yRand, yb + .56]) {
      P.length = 0;
      for (let j = 0; j <= segmente; j++) {
        const t = start + (ende - start) * j / segmente;
        P.push(Math.cos(t) * R, yy, Math.sin(t) * R);
      }
      zug('krone', a, P, false);
    }
    for (let j = 0; j <= segmente; j += 2) {
      const t = start + (ende - start) * j / segmente, c = Math.cos(t), s = Math.sin(t);
      const aa = a * (.25 + .75 * Math.abs(Math.sin(t - blick)));
      linie('krone', aa, c * R, yRand, s * R, c * R, yb + .56, s * R);
      linie('krone', aa, c * R, yRand, s * R, c * 1.06, yF, s * 1.06);
    }
    for (const t of [start, ende]) {
      const c = Math.cos(t), s = Math.sin(t);
      linie('krone', a, c * R, yRand, s * R, c * .87, yRand, s * .87);
      linie('krone', a * .9, c * .87, yRand, s * .87, c * .87, yb + .56, s * .87);
      linie('krone', a * .85, c * R, yb + .56, s * R, c * .87, yb + .56, s * .87);
    }
  }

  // Flat front plate. No tip, central needle or tapering diamond/core crown.
  const scheibe = [];
  for (let j = 0; j < 32; j++) {
    const t = phase + j / 32 * TAU;
    scheibe.push([Math.cos(t) * 1.06, yF, Math.sin(t) * 1.06]);
  }
  dthFlaeche(scheibe, a, true);
  ring('krone', a, yF, 1.06, 32, phase);
  // Two clearly open circular flushing holes between the front button groups.
  for (let i = 0; i < 2; i++) {
    const t = phase + Math.PI / 2 + i * Math.PI;
    const x = Math.cos(t) * .39, zz = Math.sin(t) * .39;
    ring('krone', a, yF - .012, .17, 12, 0, x, zz);
    ring('krone', a * .35, yF + .08, .14, 12, 0, x, zz);
  }
  // 8 spherical gauge buttons, tilted 35deg outward as in the reference family.
  for (let i = 0; i < 8; i++) {
    const t = phase + Math.PI / 8 + i / 8 * TAU, c = Math.cos(t), s = Math.sin(t);
    dthKnopf(a, c * .98, yF + .025, s * .98, .14, c * .574, -.819, s * .574);
  }
  // Eight front buttons: six around the centre plus two across the middle.
  for (let i = 0; i < 6; i++) {
    const t = phase + i / 6 * TAU;
    dthKnopf(a * .95, Math.cos(t) * .61, yF - .015, Math.sin(t) * .61, .125);
  }
  for (const s of [-1, 1]) {
    dthKnopf(a * .95, Math.cos(phase) * .22 * s, yF - .015, Math.sin(phase) * .22 * s, .12);
  }
}

  function gestaenge(z) {
    meisselBild = null;
    const a = z.gestaenge;
    if (a < 0.02) return;
    const yb = -z.meissel, yTop = RIG ? RIG_SPINDEL_UNTEN : 7;
    // Aufbau von unten: Krone, Schaft mit Keilnuten, Treibhülse, Hammer, Sechskant-Kupplung, Gestänge
    const ySchaft = yb + 0.62, yHuelse = yb + 1.05, yHammer = yb + 1.6, yKupplung = yb + 5.6, yKonus = yb + 6.1, unten = yb + 6.4;
    const RP = 0.6, RH = 0.92;

    // Gestänge – über Gelände nur bis zur Spindel des Bohrgeräts
    const mitte = Math.max(unten, 0);
    if (mitte > unten) mantelS('gestaenge', 0.85 * a, unten, mitte, RP, 10, spin);
    if (yTop > mitte) mantelS('gestaenge', 0.5 * a, mitte, yTop, RP, 10, spin);
    // Verbinder alle 3 m: Muffe mit Absatz, darunter das Zapfenende
    for (let y = unten + 3; y + 0.55 < yTop; y += 3) {
      const aa = (y > 0 ? 0.5 : 0.95) * a;
      ring('gestaenge', aa, y, 0.74, 14, spin);
      ring('gestaenge', aa, y + 0.5, 0.74, 14, spin);
      ring('gestaenge', aa * 0.7, y + 0.6, 0.66, 12, spin);
      ring('gestaenge', aa * 0.6, y - 0.08, 0.66, 12, spin);
      mantelS('gestaenge', aa, y, y + 0.5, 0.74, 8, spin);
      mantelS('gestaenge', aa * 0.8, y + 0.5, y + 0.6, 0.74, 8, spin, 0.66);
    }

    // Sechskant-Kupplung und Übergangskonus zum Gestänge
    for (const y of [yKupplung, yKonus]) {
      P.length = 0;
      for (let i = 0; i < 6; i++) { const t = spin + i / 6 * TAU; P.push(Math.cos(t) * 0.82, y, Math.sin(t) * 0.82); }
      zug('gestaenge', a, P, true);
    }
    mantelS('gestaenge', a, yKupplung, yKonus, 0.82, 6, spin);
    mantelS('gestaenge', a * 0.85, yKonus, unten, 0.82, 10, spin, RP);

    // Imlochhammer: Aussenrohr mit Gewinde- und Verschleissringen
    mantelS('gestaenge', a, yHammer, yKupplung, RH, 12, spin);
    for (const y of [yHammer, yHammer + 0.15, yHammer + 0.8, yHammer + 0.9, yKupplung - 0.15, yKupplung]) ring('gestaenge', a * 0.9, y, RH, 22, spin);
    bohrkopfAlternative(a, yb, spin, yHammer);

    // Schlagimpulse des Imlochhammers im Fels: feine Ringe laufen vom Bohrkopf ins Gestein
    if (z.bohren && z.meissel > VERROHRUNG && aktiv > 0.03) {
      for (let k = 0; k < 3; k++) {
        const ph = ((REDUZIERT ? 0.35 : zeit * 1.6) + k / 3) % 1;
        ring('krone', (1 - ph) * 0.5 * aktiv, yb + 0.05, 1.3 + ph * 4.5, 40);
      }
    }
    // Bohrklein steigt im Ringraum auf
    if (z.bohren && z.meissel > 0.3) {
      for (const c of KLEIN) {
        const y = yb + 0.8 + c.h;
        if (y > 0) continue;
        const t = c.t + c.h * 0.35, r = 0.98 + c.r * 0.22;
        punkt('klein', (0.2 + 0.6 * aktiv) * (1 - c.h / 24), Math.cos(t) * r, y, Math.sin(t) * r, 1.6);
      }
    }
    meisselBild = projiziere(0, yb, 0);
  }

  function waerme(z) {
    const w = z.waerme;
    if (w <= 0) return;
    linie('gluehen', 0.42 * w, 0, 0, 0, 0, -ENDTIEFE + 1, 0);
    // Kreislauf in den beiden U-Schleifen: kalt hinunter, warm herauf
    const D = ENDTIEFE - 1.5, n = 34, v = 16, t = REDUZIERT ? 0 : zeit;
    for (let s = 0; s < 2; s++) {
      const dx = s ? 0 : 0.42, dz = s ? 0.42 : 0;
      for (let j = 0; j < n; j++) {
        const u = ((j / n) * 2 * D + t * v + s * D * 0.37) % (2 * D);
        if (u < D) linie('kalt', 0.85 * w, dx, -u, dz, dx, -u - 3, dz);
        else { const y = -(2 * D - u); linie('waerme', (0.45 + 0.5 * (-y / D)) * w, -dx, y, -dz, -dx, y + 3, -dz); }
      }
    }
    // Wärmestrom aus dem Gestein zur Sonde – je tiefer, desto stärker
    for (let d = 30; d <= ENDTIEFE; d += 20) {
      const st = 0.2 + 0.75 * (d / ENDTIEFE);
      for (const [ux, uz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        for (let k = 0; k < 2; k++) {
          const r = 44 - ((t * 7 + k * 21 + d * 0.7) % 40);
          const f = smooth(range(r, 3, 10)) * (1 - smooth(range(r, 32, 44)));
          linie('waerme', st * f * w, ux * r, -d, uz * r, ux * (r - 6), -d, uz * (r - 6));
        }
      }
    }
  }

  function gluehenMeissel() {
    if (!meisselBild || aktiv < 0.02) return;
    const r = 4.5 * K.f / meisselBild.z;
    const g = ctx.createRadialGradient(meisselBild.x, meisselBild.y, 0, meisselBild.x, meisselBild.y, r);
    g.addColorStop(0, `rgba(246,168,74,${(0.06 + 0.3 * aktiv).toFixed(3)})`);
    g.addColorStop(1, 'rgba(246,168,74,0)');
    ctx.fillStyle = g;
    ctx.fillRect(meisselBild.x - r, meisselBild.y - r, 2 * r, 2 * r);
  }

  // namen: Anteil der Schichtnamen (bei den Stationen 06 und 08 stünden sie sonst im Text rechts)
  function beschriftung(ov, namen = 1) {
    if (ov < 0.05) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '500 9px Arial, Helvetica, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    // Schichtnamen an der rechten Blockkante (auf kleinen Screens nennt sie die Messanzeige)
    ctx.textAlign = 'left';
    for (let i = 1; i < SCHICHTEN.length && W >= 600; i++) {
      const oben = -grenze(i - 1, BX, -BZ), unten = i === SCHICHTEN.length - 1 ? BUNTEN : -grenze(i, BX, -BZ);
      const q = projiziere(BX, -(oben + unten) / 2, -BZ);
      if (!q) continue;
      const text = SCHICHTEN[i].name.toUpperCase();
      ctx.strokeStyle = ctx.fillStyle = `rgba(170,205,176,${(0.6 * ov * namen).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(q.x + 4, q.y); ctx.lineTo(q.x + 14, q.y); ctx.stroke();
      // Passt der Name nicht mehr rechts daneben, steht er rechtsbündig über der Marke
      if (q.x + 20 + ctx.measureText(text).width > W - 8) {
        ctx.textAlign = 'right';
        ctx.fillText(text, W - 8, q.y - 9);
        ctx.textAlign = 'left';
      } else {
        ctx.fillText(text, q.x + 20, q.y);
      }
    }
    // Tiefenmarken an der linken Kante
    ctx.textAlign = 'right';
    for (let d = 0; d <= ENDTIEFE; d += 50) {
      const q = projiziere(-BX, -d, BZ);
      if (!q || q.x - 18 - ctx.measureText(`${d} M`).width < 4) continue;
      ctx.strokeStyle = ctx.fillStyle = `rgba(170,205,176,${(0.5 * ov).toFixed(3)})`;
      ctx.beginPath(); ctx.moveTo(q.x - 4, q.y); ctx.lineTo(q.x - 12, q.y); ctx.stroke();
      ctx.fillText(`${d} M`, q.x - 18, q.y);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  // Haltung: ein Lot neben der Bohrung, von einer Aufhängung über dem Gelände bis auf die Tiefe des Bohrkopfs
  const LOT_X = 14;
  function lotlinie(a, z) {
    if (a < 0.02 || z.meissel < 1) return;
    const oben = 16, unten = -z.meissel;
    linie('raster', 0.8 * a, LOT_X - 3, oben, 0, LOT_X + 3, oben, 0);
    for (let y = oben; y > unten + 4; y -= 8) linie('raster', 0.6 * a, LOT_X, y, 0, LOT_X, Math.max(unten + 4, y - 5), 0);
    // Senkblei
    zug('raster', 0.95 * a, [LOT_X, unten + 4, 0, LOT_X + 1.6, unten + 1.6, 0, LOT_X, unten - 1.5, 0, LOT_X - 1.6, unten + 1.6, 0], true);
  }

  // Planung: Massstab neben der Bohrung, alle 10 m ein Strich, alle 50 m ein längerer
  const MASS_X = 4.2;
  function massstab(a) {
    if (a < 0.02) return;
    linie('raster', 0.5 * a, MASS_X, 0, 0, MASS_X, -ENDTIEFE, 0);
    for (let d = 0; d <= ENDTIEFE; d += 10) {
      const lang = d % 50 === 0;
      linie('raster', (lang ? 0.8 : 0.45) * a, MASS_X, -d, 0, MASS_X + (lang ? 1.8 : 0.9), -d, 0);
    }
  }
  function massstabText(a) {
    if (a < 0.05) return;
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '500 9px Arial, Helvetica, sans-serif';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = `rgba(170,205,176,${(0.8 * a).toFixed(3)})`;
    // Schmal steht unten das Blatt der Station; dort keine Zahlen
    const unten = SCHMAL.matches ? H * .62 : H - 12;
    for (let d = 0; d <= ENDTIEFE; d += 10) {
      const q = projiziere(MASS_X + 2.6, -d, 0);
      if (!q || q.y < 12 || q.y > unten) continue;
      ctx.fillText(`${d} m`, q.x, q.y);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  // Projektion des Geräts einmal je Bild (zeichnen() ruft sie vor der Landschaft auf, die das Gerät freistellt)
  function geraetProjizieren() {
    if (!RIG) return;
    const { welt, sx, sy, sz } = RIG, n = sz.length;
    let zMin = Infinity, zMax = -Infinity;
    for (let i = 0; i < n; i++) {
      const dx = welt[3 * i] - K.px, dy = welt[3 * i + 1] - K.py, dz = welt[3 * i + 2] - K.pz;
      const cz = dx * K.fx + dy * K.fy + dz * K.fz;
      sz[i] = cz;
      if (cz < NAH) continue;
      sx[i] = K.cx + (dx * K.rx + dz * K.rz) * K.f / cz;
      sy[i] = K.cy - (dx * K.ux + dy * K.uy + dz * K.uz) * K.f / cz;
      if (cz < zMin) zMin = cz;
      if (cz > zMax) zMax = cz;
    }
    RIG.zMin = zMin; RIG.zMax = zMax;
  }

  function bohrgeraet(sicht) {
    if (EINSTIEG && EINSTIEG.active) sicht *= EINSTIEG.rig;
    if (!RIG || sicht < 0.02) return;
    const { kanten, sx, sy, sz, buendel } = RIG, zMin = RIG.zMin, zMax = RIG.zMax;
    if (!(zMax >= NAH)) return;
    const a = sicht * nebel((zMin + zMax) / 2), tiefe = 3.999 / Math.max(zMax - zMin, 1e-6);
    if (a < 0.02) return;
    for (let k = 0; k < kanten.length; k += 3) {
      const i = kanten[k], j = kanten[k + 1];
      if (sz[i] < NAH || sz[j] < NAH) continue;
      const x1 = sx[i], y1 = sy[i], x2 = sx[j], y2 = sy[j];
      if ((x1 < 0 && x2 < 0) || (x1 > W && x2 > W) || (y1 < 0 && y2 < 0) || (y1 > H && y2 > H)) continue;
      const stufe = Math.floor((zMax - (sz[i] + sz[j]) / 2) * tiefe);
      buendel[kanten[k + 2] * 4 + stufe].push(x1, y1, x2, y2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    for (let ton = 0; ton < 3; ton++) {
      ctx.strokeStyle = RIG_TON[ton];
      ctx.lineWidth = RIG_BREITE[ton];
      for (let s = 0; s < 4; s++) {
        const L = buendel[ton * 4 + s];
        if (!L.length) continue;
        ctx.globalAlpha = RIG_DECKUNG[s] * a;
        ctx.beginPath();
        for (let q = 0; q < L.length; q += 4) { ctx.moveTo(L[q], L[q + 1]); ctx.lineTo(L[q + 2], L[q + 3]); }
        ctx.stroke();
        L.length = 0;
      }
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }

  // ---------- Landschaft im Hero: Relief aus parallelen Linien (wie der Globus der infradot-Website) ----------
  // Ein Höhenfeld rund um das Gerät, als Linien quer zum Blick gezeichnet. Linien erscheinen nur, wo das
  // Gelände ansteigt (rund um das Gerät bleibt es flach und leer), zu den Gipfeln hin heller. Weiter hinten
  // liegende Linien verschwinden hinter näheren Hügeln. Alles in Weltkoordinaten (Meter, wie das Gerät), also mit
  // derselben Perspektive und Drehung. Gezeichnet wird auf eine eigene Fläche; rund um die Striche des Geräts und
  // über dem Hero-Text wird sie wieder freigestellt.
  const RELIEF_TIEF = [89, 140, 107], RELIEF_GIPFEL = [201, 233, 160], RELIEF_PUNKTE = 151;   // 600 m in Schritten von 4 m
  // Das Höhenfeld liegt fest in der Welt, beschrieben in der Startansicht: u nach rechts, d vom Betrachter weg nach hinten (Meter)
  const RELIEF_START = 0.49;   // Blickrichtung der Startansicht wie in kameraZustand()
  const reliefHoehe = (() => {
    // [u, d, Breite u, Breite d, Höhe]: die Berge hinter dem Gerät in der Startansicht …
    const berge = [40, 215, 50, 45, 44, -75, 235, 65, 50, 36, 150, 245, 60, 55, 38, -180, 205, 60, 50, 32,
      0, 125, 110, 30, 11, -115, 115, 50, 30, 15, 100, 130, 45, 30, 17];
    // … und rundherum weitere, damit nach jeder Drehung Gelände hinter dem Gerät liegt
    for (let i = 0; i < 8; i++) {
      const w = (62 + i * 33.5) * Math.PI / 180, r = 230 + 25 * Math.sin(i * 2.1);
      berge.push(r * Math.sin(w), r * Math.cos(w), 58, 50, 36 + 8 * Math.sin(i * 1.7 + 0.6));
      if (i < 7) berge.push(130 * Math.sin(w + 0.3), 130 * Math.cos(w + 0.3), 50, 32, 12 + 4 * Math.sin(i * 2.6));
    }
    const hoehe = (u, d) => {
      const w2 = u * u + d * d * 1.69;   // rund um das Gerät flach: (u, 1.3·d) zwischen 45 und 170 m
      if (w2 <= 45 * 45) return 0;
      const weit = w2 >= 170 * 170 ? 1 : smooth((Math.sqrt(w2) - 45) / 125);
      let y = 0;
      for (let j = 0; j < berge.length; j += 5) {
        const a = (u - berge[j]) / berge[j + 2], b = (d - berge[j + 1]) / berge[j + 3], q = a * a + b * b;
        if (q < 12) y += berge[j + 4] * Math.exp(-q);   // weiter weg trägt ein Berg nichts mehr bei
      }
      const grat = 1 - Math.abs(Math.sin(u * 0.045 + Math.sin(d * 0.05) * 1.6));   // Grat-Rauschen
      return y * (0.8 + 0.35 * grat) * weit;
    };
    // Einmal auf ein 5-m-Raster (±435 m) gerechnet, danach nur noch nachgeschlagen: das Abtasten beim Drehen bleibt billig
    const S = 5, N = 175, M = 87;
    let raster = null;
    return (u, d) => {
      if (!raster) {
        raster = new Float32Array(N * N);
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) raster[j * N + i] = hoehe((i - M) * S, (j - M) * S);
      }
      const x = u / S + M, y = d / S + M, i = Math.floor(x), j = Math.floor(y);
      if (i < 0 || j < 0 || i >= N - 1 || j >= N - 1) return 0;
      const fx = x - i, fy = y - j, o = j * N + i;
      return (raster[o] * (1 - fx) + raster[o + 1] * fx) * (1 - fy) + (raster[o + N] * (1 - fx) + raster[o + N + 1] * fx) * fy;
    };
  })();
  // Die Linien laufen immer quer zum aktuellen Blick (wie bei infradot): 48 Reihen von 35 m vor bis 294 m hinter dem
  // Gerät. Beim Drehen werden sie neu abgetastet, das Gelände selbst bleibt stehen.
  // claude/v006-stationen: Auch der flache Boden rund um das Gerät trägt zarte Linien – die Landschaft reicht so bis
  // an den Bohrpunkt, das Gerät steht darauf, und die Bohrung beginnt im selben Gelände.
  const RELIEF = Array.from({ length: 48 }, (_, i) => ({
    d: -35 + i * 7, pts: new Float64Array(RELIEF_PUNKTE * 3), deckung: new Float32Array(RELIEF_PUNKTE), schnee: new Float32Array(RELIEF_PUNKTE),
  }));
  let reliefRichtung = NaN;
  function reliefAbtasten(th) {
    const cs = Math.cos(th), sn = Math.sin(th), cw = Math.cos(th - RELIEF_START), sw = Math.sin(th - RELIEF_START);
    for (const r of RELIEF) {
      const d = r.d, P = r.pts;
      for (let k = 0; k < RELIEF_PUNKTE; k++) {
        const u = -300 + k * 4, y = reliefHoehe(u * cw - d * sw, u * sw + d * cw);
        P[3 * k] = u * cs - d * sn; P[3 * k + 1] = y; P[3 * k + 2] = -u * sn - d * cs;
        r.schnee[k] = smooth(range(y, 16, 40));
        // Linie & Realität v002: Gelände kräftiger in Linien (Boden 0.15 → 0.26, Hänge 0.28 → 0.44).
        const boden = 0.26 * (1 - smooth(range(Math.hypot(u, d * 1.3), 20, 250)));
        r.deckung[k] = Math.min(1, Math.max(boden, smooth(range(y, 2.5, 9)) * (0.44 + 0.5 * r.schnee[k])));
      }
    }
  }
  const RELIEF_STUFEN = 7, RELIEF_TOENE = 3;
  const reliefBuendel = Array.from({ length: RELIEF_STUFEN * RELIEF_TOENE }, () => []);
  // Bildschirmlage der Linie (RX/RY) und ihres Fusses auf Geländehöhe 0 (FY), NaN hinter der Kamera
  const RX = new Float64Array(RELIEF_PUNKTE), RY = new Float64Array(RELIEF_PUNKTE), FX = new Float64Array(RELIEF_PUNKTE), FY = new Float64Array(RELIEF_PUNKTE);
  const landBild = document.createElement('canvas'), landCtx = landBild.getContext('2d');
  // claude/v006-stationen: Die Landschaft bleibt sichtbar, solange die Kamera über dem Gelände steht – im Hero, beim
  // Eintauchen, bei Station 01, in den erhöhten Gesamtansichten und am Schluss. Taucht die Kamera unter die
  // Oberfläche, blendet sie aus. Gezeichnet wird sie unter der Szene, Bohrung und Gestänge liegen darüber.
  // grund: Farbe des Bühnenhintergrunds in diesem Bild (zum Verdecken beim direkten Zeichnen)
  // Steht die Kamera still (Hero, Schluss, beim Lesen), wird ein Zwischenbild mit sauber freigestelltem Gerät
  // einmal gezeichnet und wiederverwendet. Den Hero-Text stellt nicht die Landschaft frei, sondern der dunkle
  // Verlauf .hero-grund darüber – so laufen die Linien weich aus, im Stand wie beim Scrollen. Bewegt sie sich, wird direkt auf die Bühne gezeichnet, ohne das
  // Freistellen um das Gerät: Ein Zwischenbild müsste sonst in jedem Bild neu übertragen und die breiten Ränder um
  // tausende Gerätestriche neu gerastert werden – beides kostet ein Vielfaches des eigentlichen Zeichnens.
  let landSchluessel = '', landBildSchluessel = '', ruhig = 0;
  function landschaft(p, grund) {
    const a = smooth(range(K.py, 3, 16));
    if (a < 0.01 || !RIG) return;
    const schluessel = [K.px, K.py, K.pz, K.fx, K.fy, K.fz, K.f, K.cx, K.cy, canvas.width, canvas.height].map(v => v.toFixed(2)).join('|');
    if (schluessel === landSchluessel) ruhig++; else { landSchluessel = schluessel; ruhig = 0; }
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a;
    if (ruhig >= 2) {
      if (landBildSchluessel !== schluessel) { landBildSchluessel = schluessel; landZeichnen(); }
      ctx.drawImage(landBild, 0, 0, W, H);
    } else {
      reliefZeichnen(ctx, grund, false);
    }
    ctx.restore();
  }

  function landZeichnen() {
    if (landBild.width !== canvas.width || landBild.height !== canvas.height) {
      landBild.width = canvas.width; landBild.height = canvas.height;
    }
    const L = landCtx;
    L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = 'source-over';
    L.clearRect(0, 0, landBild.width, landBild.height);
    L.setTransform(DPR, 0, 0, DPR, 0, 0);
    reliefZeichnen(L, null, true);
  }

  // Zeichnet die Reihen von hinten nach vorne und stellt (freistellen) das Gerät frei. grund = null: auf das
  // Zwischenbild, Verdecktes wird ausradiert; sonst direkt auf die Bühne, Verdecktes wird mit grund übermalt.
  function reliefZeichnen(L, grund, freistellen) {
    L.lineJoin = L.lineCap = 'round';
    L.lineWidth = 1;
    const th = Math.atan2(K.px, K.pz);   // aktuelle Blickrichtung (Kamera kreist um das Gerät)
    if (th !== reliefRichtung) { reliefRichtung = th; reliefAbtasten(th); }
    const auf =(x, y, z, X, Y, k) => {   // wie projiziere(), aber ohne neues Objekt
      const dx = x - K.px, dy = y - K.py, dz = z - K.pz, cz = dx * K.fx + dy * K.fy + dz * K.fz;
      if (cz < NAH) { X[k] = Y[k] = NaN; return; }
      X[k] = K.cx + (dx * K.rx + dz * K.rz) * K.f / cz;
      Y[k] = K.cy - (dx * K.ux + dy * K.uy + dz * K.uz) * K.f / cz;
    };
    // von hinten nach vorne; aus der Ferne (Gesamtansichten) liegen die Reihen dichter als ein Pixel: jede zweite genügt
    const schritt = K.dist > 300 ? 2 : 1;
    for (let i = RELIEF.length - 1; i >= 0; i -= schritt) {
      const r = RELIEF[i], n = RELIEF_PUNKTE, P = r.pts;
      let erst = -1, letzt = -1;
      for (let k = 0; k < n; k++) {
        auf(P[3 * k], P[3 * k + 1], P[3 * k + 2], RX, RY, k);
        auf(P[3 * k], 0, P[3 * k + 2], FX, FY, k);
        if (RY[k] === RY[k] && FY[k] === FY[k]) { if (erst < 0) erst = k; letzt = k; }
      }
      if (erst < 0) continue;
      // Verdecken: der Hang dieser Linie (zwischen Linie und Fuss) löscht weiter hinten gezeichnete Linien
      if (grund) L.fillStyle = grund; else L.globalCompositeOperation = 'destination-out';
      L.beginPath();
      for (let k = erst; k <= letzt; k++) if (RY[k] === RY[k]) L.lineTo(RX[k], RY[k]);
      for (let k = letzt; k >= erst; k--) if (FY[k] === FY[k]) L.lineTo(FX[k], FY[k] + 1);
      L.fill();
      // Linie: nach Deckung und Farbton gebündelt
      L.globalCompositeOperation = 'source-over';
      for (let k = erst + 1; k <= letzt; k++) {
        const de = Math.min(r.deckung[k - 1], r.deckung[k]);
        if (de < 0.03 || RY[k] !== RY[k] || RY[k - 1] !== RY[k - 1]) continue;
        const stufe = Math.min(RELIEF_STUFEN - 1, Math.round(de / 0.78 * (RELIEF_STUFEN - 1)));
        if (stufe === 0) continue;   // zu zart zum Zeichnen; ungesammelt bleibt das Bündel leer
        const ton = Math.round(Math.max(r.schnee[k - 1], r.schnee[k]) * (RELIEF_TOENE - 1));
        reliefBuendel[ton * RELIEF_STUFEN + stufe].push(RX[k - 1], RY[k - 1], RX[k], RY[k]);
      }
      for (let ton = 0; ton < RELIEF_TOENE; ton++) {
        for (let st = 1; st < RELIEF_STUFEN; st++) {
          const B = reliefBuendel[ton * RELIEF_STUFEN + st];
          if (!B.length) continue;
          const farbe = mischeFarbe(RELIEF_TIEF, RELIEF_GIPFEL, ton / (RELIEF_TOENE - 1));
          L.strokeStyle = `rgba(${farbe.join(',')},${(st / (RELIEF_STUFEN - 1) * 0.78).toFixed(3)})`;
          L.beginPath();
          for (let j = 0; j < B.length; j += 4) { L.moveTo(B[j], B[j + 1]); L.lineTo(B[j + 2], B[j + 3]); }
          L.stroke();
          B.length = 0;
        }
      }
    }
    // Freistellen: ein schmaler Rand um jeden Strich des Geräts (eckige Enden sind deutlich billiger als runde).
    // Nur wenn das Gerät gross im Bild steht: klein (Gesamtansichten) überlagern sich sonst tausende breite Striche
    // auf wenigen Pixeln, das Rastern wird sehr teuer, und zu sehen wäre der Rand ohnehin nicht.
    const fuss = projiziere(0, 0, 0), kopf = projiziere(0, RIG.hoehe, 0);
    if (!freistellen || !fuss || !kopf || fuss.y - kopf.y < 150) { L.globalCompositeOperation = 'source-over'; return; }
    if (grund) L.strokeStyle = grund; else L.globalCompositeOperation = 'destination-out';
    L.lineWidth = 9;
    L.lineCap = 'square';
    L.beginPath();
    const { sx, sy, sz, kanten } = RIG;
    for (let k = 0; k < kanten.length && RIG.zMax >= NAH; k += 3) {
      const i = kanten[k], j = kanten[k + 1];
      if (sz[i] < NAH || sz[j] < NAH) continue;
      L.moveTo(sx[i], sy[i]); L.lineTo(sx[j], sy[j]);
    }
    L.stroke();
    L.globalCompositeOperation = 'source-over';
  }

  function zeichnen(z, p) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    const end = abschluss3DMix(p);
    const endBg = FARBEN ? [24, 16, 11] : [7, 27, 21];
    const grund = end > 0 ? `rgb(${mischeFarbe(endBg, [7, 27, 21], end).join(",")})` : hintergrund;
    // Linie & Realität v002: Die Bühnenfarbe kommt aus CSS (--buehne), darunter liegt die echte 3D-Ebene
    // (#echt, echt/echt.js). Darum hier nicht füllen und die Landschaft nicht mit der Bühnenfarbe übermalen.
    ctx.clearRect(0, 0, W, H);
    geraetProjizieren();
    if (ansicht === '3d') landschaft(p, null);
    // Einstieg: die nahe, leicht drehende Bohrkrone, bevor die Kamera zur Startansicht zurückfährt
    if (EINSTIEG && EINSTIEG.active && EINSTIEG.cameraMix < .72) {
      ctx.globalCompositeOperation = 'lighter';
      bohrkopfAlternative(1 - smooth(range(EINSTIEG.cameraMix, .35, .72)), 0, .2 + EINSTIEG.spin, 6);
      ausgeben();
      ctx.globalCompositeOperation = 'source-over';
    }
    // Schluss: die Bohrkrone sitzt wieder unten an der Spindel im Bohrloch, wie beim Einstieg, und dreht langsam
    if (end > 0.02 && ansicht === '3d') {
      ctx.globalCompositeOperation = 'lighter';
      bohrkopfAlternative(smooth(end), 0, .2 + zeit * .35, 6);
      ausgeben();
      ctx.globalCompositeOperation = 'source-over';
    }
    // In der Geräteansicht bleibt der Untergrund unsichtbar (ruhiger Hero);
    // er erscheint, sobald die Kamera der Spindel nach unten folgt.
    ctx.globalAlpha = smooth(range(p, 0.008, 0.06)) * (1 - end);
    ctx.globalCompositeOperation = 'lighter';
    const ov = smooth(range(K.dist, 60, 420));   // 0 = nah am Bohrkopf, 1 = Gesamtansicht
    schichtbaender(ov);   // die Eckmarken des Erdblocks (erdblock) entfallen: sie wirkten wie ein Kasten
    schichten(ov);
    schichtung(ov);
    grundwasser(1 + 0.9 * (gewicht.wasserlinie || 0));
    gestein();
    bohrloch(z);
    verpressung(z);
    sonde(z, ov);
    gestaenge(z);
    waerme(z);
    if (!REDUZIERT) massstab(gewicht.plan || 0);
    if (!REDUZIERT) lotlinie(gewicht.lot || 0, z);
    ausgeben();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    abschlussBoden(p);
    ausgeben();
    gluehenMeissel();
    // Bei reduzierter Bewegung bleibt die Kamera in der Gesamtansicht: Beschriftung tritt hinter die Stationen zurück
    beschriftung(ov * smooth(range(p, 0.005, 0.06)) * (1 - end) * (REDUZIERT ? 1 - stationsAnteil(p) : 1), 1 - (gewicht.lot || 0) - (gewicht.verpressen || 0));
    if (!REDUZIERT) massstabText(smooth(range(gewicht.plan || 0, .7, 1)) * (1 - end));
    // Nah an der Bohrung tritt das Gerät etwas zurück, damit die Texte lesbar bleiben
    // Bildkonturen / Original ersetzen das Gerät in der Geräteansicht
    // Linie & Realität v002: die Linien des Geräts etwas zurück, damit das echte Gerät darunter mitliest.
    if (ansicht === '3d') bohrgeraet(0.85 * lerp(lerp(1, 0.6, smooth(range(p, 0.04, 0.1))), 1, end));
  }

  // ---------- HUD und Texte ----------
  const $ = id => document.getElementById(id);
  const hudEl = { tiefe: $('tiefe'), temp: $('temp'), schicht: $('schicht'), phase: $('phase') };
  const LEITER = 22;
  const leitern = ['leiter-tiefe', 'leiter-temp'].map(id => {
    const el = $(id);
    return Array.from({ length: LEITER }, () => el.appendChild(document.createElement('i')));
  });
  // Zeilen mit data-von (Hero, Geräteansicht, 500 m, Gestänge): Sichtbarkeit folgt dem Scrollen, nicht einer Zeitblende.
  // Die Stationen (.thema) führt stationen.js.
  const caps = [...document.querySelectorAll('[data-von]')]
    .filter(el => !el.classList.contains('thema'))
    .map(el => ({ el, von: +el.dataset.von, bis: +el.dataset.bis, aus: +el.dataset.aus || .012, an: false, mix: '' }));
  const hinweis = document.querySelector('.scroll-cue');
  let hudAlt = '', leiterAlt = '';

  // v003: the new closing page is independent of the original drilling renderer.
  let abschlussAn = false, abschlussMixAlt = '', abschlussBereit = false;
  function aktualisiereAbschluss(p) {
    const mix = smooth(range(p, 0.89, 0.93));
    if (mix === 0 && !abschlussAn) return;
    const panel = document.getElementById('ending-panel');
    if (!panel) return;
    const css = mix.toFixed(4);
    if (css !== abschlussMixAlt) { stage.style.setProperty('--ending', css); abschlussMixAlt = css; }
    if ((mix > 0) !== abschlussAn) {
      abschlussAn = mix > 0;
      stage.classList.toggle('ending-active', abschlussAn);
    }
    const bereit = mix > .7;
    if (bereit !== abschlussBereit) {
      abschlussBereit = bereit;
      stage.classList.toggle('ending-ready', bereit);
      panel.dataset.active = String(bereit);
      panel.inert = !bereit;
      panel.setAttribute('aria-hidden', String(!bereit));
      panel.dispatchEvent(new CustomEvent('thermobohr:ending', {detail:{active:bereit}}));
    }
  }

  function hud(z, p) {
    aktualisiereAbschluss(p);
    if (window.ThermobohrStationen) window.ThermobohrStationen.aktualisieren(p, z);
    const d = z.anzeige, t = temperatur(d);
    const schicht = d < 0.3 ? 'Geländeoberkante' : SCHICHTEN[schichtBei(d)].name;
    const sig = `${Math.round(d)}|${t.toFixed(1)}|${z.phase}|${schicht}`;
    if (sig !== hudAlt) {
      hudAlt = sig;
      hudEl.tiefe.textContent = Math.round(d);
      hudEl.temp.textContent = t.toFixed(1);
      hudEl.schicht.textContent = schicht;
      hudEl.phase.textContent = z.phase;
      const nT = Math.round(d / ENDTIEFE * LEITER), nW = Math.round((t - 10.5) / (temperatur(ENDTIEFE) - 10.5) * LEITER);
      leitern[0].forEach((el, i) => el.classList.toggle('an', i < nT));
      leitern[1].forEach((el, i) => el.classList.toggle('an', i < nW));
    }
    const springt = window.ThermobohrStationen && window.ThermobohrStationen.springt();
    for (const c of caps) {
      const ein = c.von <= 0 ? 1 : smooth(range(p, c.von, c.von + .012));
      const mix = springt && c.von > 0 ? 0 : ein * (1 - smooth(range(p, c.bis - c.aus, c.bis)));
      const an = mix > .01;
      if (an !== c.an) { c.an = an; c.el.classList.toggle('an', an); }
      const css = mix.toFixed(3);
      if (css !== c.mix) { c.mix = css; c.el.style.setProperty('--cap-mix', css); }
    }
    // Strichleiter neben Tiefe und Temperatur nur, solange gebohrt wird
    const leiter = (smooth(range(p, .05, .07)) * (1 - smooth(range(p, .635, .655)))).toFixed(3);
    if (leiter !== leiterAlt) { leiterAlt = leiter; stage.style.setProperty('--leiter', leiter); }
    hinweis.classList.toggle('weg', p > 0.02);
    if (p > GERAET_BIS && ansicht !== '3d') ansichtWaehlen('3d');
  }

  // ---------- Geräteansicht: Ziehen, Zoom, Drehung, Bildvorlage (Bedienung wie bei Codex) ----------
  const GERAET_BIS = 0.03;
  const stage = document.querySelector('.stage');
  let ansicht = '3d', ziehen = null, zx = 0, zy = 0;
  const imIntro = () => scrollFortschritt() < GERAET_BIS;

  function autoStopp() {
    NUTZER.auto = false;
    const b = $('rotate');
    if (!b) return;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', 'Automatische Drehung starten');
  }
  function zoom(d) { NUTZER.zoom = clamp(NUTZER.zoom + d, 0.72, 1.65); }
  function zuruecksetzen() { autoStopp(); NUTZER.yaw = 0; NUTZER.pitch = 0; NUTZER.zoom = 1; }

  const ANSICHT_TEXT = {
    '3d': ['RÄUMLICHE LINIENSTUDIE', 'Ziehen, um die Maschine zu drehen', 'Aus der bereitgestellten Bildvorlage räumlich nachempfunden. Die Bohrspindel steht genau über der Bohrung.', 'FORMSTUDIE · NICHT MASSSTÄBLICH'],
    'contour': ['KONTUREN DER BILDVORLAGE', 'Direkt aus dem Originalbild vektorisiert', 'Originalgetreue 2D-Konturen in den Grüntönen des Logos.', 'VEKTORGRAFIK · SVG'],
    'photo': ['DAS ORIGINALFOTO', 'Die tatsächliche Maschine als Ausgangspunkt', 'Bereitgestellte Geräteaufnahme', 'ORIGINAL · GERÄTEFOTO'],
  };
  function ansichtWaehlen(modus) {
    autoStopp();
    ansicht = modus;
    stage.dataset.mode = modus;
    $('contour-image').hidden = modus !== 'contour';
    $('original-image').hidden = modus !== 'photo';
    document.querySelectorAll('.mode').forEach(b => {
      const an = b.dataset.view === modus;
      b.classList.toggle('active', an);
      b.setAttribute('aria-pressed', String(an));
    });
    document.querySelectorAll('.tools button').forEach(b => { b.disabled = modus !== '3d'; });
    const t = ANSICHT_TEXT[modus];
    $('view-kind').textContent = t[0];
    $('viewer-note').lastChild.textContent = ' ' + t[1];
    $('viewer-caption').textContent = t[2];
    $('scale-note').textContent = t[3];
    $('view-status').textContent = t[0];
  }

  document.querySelectorAll('.mode').forEach(b => b.addEventListener('click', () => ansichtWaehlen(b.dataset.view)));
  // Die Werkzeugleiste ist optional: Die Startseite zeigt das Gerät ohne Leiste, Ziehen und Tastatur bleiben.
  const knopf = (id, aktion) => { const b = $(id); if (b) b.addEventListener('click', aktion); };
  knopf('zoom-in', () => zoom(0.1));
  knopf('zoom-out', () => zoom(-0.1));
  knopf('reset', zuruecksetzen);
  knopf('rotate', () => {
    if (NUTZER.auto) { autoStopp(); return; }
    NUTZER.auto = true;
    $('rotate').setAttribute('aria-pressed', 'true');
    $('rotate').setAttribute('aria-label', 'Automatische Drehung anhalten');
  });
  if (REDUZIERT && $('rotate')) $('rotate').disabled = true;

  // Waagrechtes Ziehen dreht das Gerät; senkrecht wird auf Touchgeräten weiter gescrollt (touch-action: pan-y).
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || ziehen !== null || !imIntro() || ansicht !== '3d') return;
    ziehen = e.pointerId; zx = e.clientX; zy = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('zieht');
    autoStopp();
  });
  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== ziehen) return;
    NUTZER.yaw -= (e.clientX - zx) * 0.007;
    if (e.pointerType === 'mouse') NUTZER.pitch = clamp(NUTZER.pitch + (e.clientY - zy) * 0.003, -0.3, 0.5);
    zx = e.clientX; zy = e.clientY;
  });
  const zugEnde = e => { if (e.pointerId === ziehen) { ziehen = null; canvas.classList.remove('zieht'); } };
  canvas.addEventListener('pointerup', zugEnde);
  canvas.addEventListener('pointercancel', zugEnde);
  canvas.addEventListener('lostpointercapture', zugEnde);
  canvas.addEventListener('keydown', e => {
    if (!imIntro()) return;
    let ok = true;
    if (e.key === 'ArrowLeft') NUTZER.yaw += 0.12;
    else if (e.key === 'ArrowRight') NUTZER.yaw -= 0.12;
    else if (e.key === 'ArrowUp') NUTZER.pitch = Math.max(-0.3, NUTZER.pitch - 0.05);
    else if (e.key === 'ArrowDown') NUTZER.pitch = Math.min(0.5, NUTZER.pitch + 0.05);
    else if (e.key === '+' || e.key === '=') zoom(0.1);
    else if (e.key === '-') zoom(-0.1);
    else if (e.key === '0' || e.key === 'Home') zuruecksetzen();
    else ok = false;
    if (ok) { e.preventDefault(); autoStopp(); }
  });

  // Bildvorlage-Dialog ist optional (claude/website zeigt das Gerät nur als 3D-Linien)
  const dialog = $('source-dialog');
  if (dialog) {
    $('source-open').addEventListener('click', () => dialog.showModal());
    $('source-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
  }

  // ---------- Ablauf ----------
  function scrollFortschritt() {
    const r = sektion.getBoundingClientRect();
    const weg = r.height - canvas.clientHeight;
    return weg > 0 ? clamp(-r.top / weg, 0, 1) : 0;
  }

  let p = scrollFortschritt(), zeit = 0, letzte = performance.now(), letzteTiefe = 0, laeuft = false;

  function frame(jetzt) {
    if (EINSTIEG) EINSTIEG.tick(jetzt);
    const dt = Math.min(0.05, (jetzt - letzte) / 1000);
    letzte = jetzt;
    if (!REDUZIERT) zeit += dt;
    const ziel = scrollFortschritt();
    p = REDUZIERT ? ziel : p + (ziel - p) * (1 - Math.exp(-dt * 7));
    if (Math.abs(ziel - p) < 1e-5) p = ziel;

    const z = zustand(p);
    const tempo = Math.abs(z.meissel - letzteTiefe) / Math.max(dt, 1e-3);
    letzteTiefe = z.meissel;
    aktiv += (clamp(tempo / 12, 0, 1) * (z.bohren ? 1 : 0) - aktiv) * (1 - Math.exp(-dt * 4));
    spin = REDUZIERT ? z.meissel * 0.9 : spin + dt * (0.4 + aktiv * 7) + (tempo * dt) * 0.15;
    if (!REDUZIERT) {
      for (const c of KLEIN) { c.h += dt * (3 + aktiv * 24) * c.v; if (c.h > 24) c.h -= 24; }
    }

    if (NUTZER.auto && !ziehen) NUTZER.yaw += dt * 0.12;
    if (FARBEN) farbenNachTiefe(z.bohrtiefe / ENDTIEFE * (1 - abschluss3DMix(p)));   // am Schluss wieder das Grün des Anfangs
    const kam = kameraZustand(p, z);
    if (EINSTIEG && EINSTIEG.active) EINSTIEG.setCamera(kam);
    kam.oy -= hebung;
    kameraSetzen(kam);
    freistellen(z, p, dt);
    zeichnen(z, p);
    hud(z, p);
    // Linie & Realität v002: echte 3D-Ebene mit derselben Kamera im selben Bild.
    if (window.ThermobohrEcht) window.ThermobohrEcht.zeichne(K, z, p, zeit, spin, abschluss3DMix(p));
    if (laeuft) requestAnimationFrame(frame);
  }

  function starten() {
    if (laeuft) return;
    laeuft = true;
    letzte = performance.now();
    requestAnimationFrame(frame);
  }

  groesse();
  window.addEventListener('resize', () => { groesse(); if (!laeuft) requestAnimationFrame(frame); });

  // Prüfhilfe: index.html?p=0.6 springt direkt zu diesem Fortschritt der Animation
  const sprung = parseFloat(new URLSearchParams(location.search).get('p'));
  if (sprung >= 0 && sprung <= 1) {
    history.scrollRestoration = 'manual';
    const springen = () => scrollTo({ top: sektion.offsetTop + sprung * (sektion.offsetHeight - canvas.clientHeight), behavior: 'instant' });
    springen();
    window.addEventListener('load', springen);
    p = sprung;
  }
  new IntersectionObserver(([e]) => { if (e.isIntersecting) starten(); else laeuft = false; }).observe(sektion);
  starten();

  // Schnittstelle für Erweiterungen. vorschau(p) zeichnet einen bestimmten Fortschritt sofort – praktisch zum Testen.
  window.ThermobohrBohrung = {
    kamera: K,
    projiziere,
    ENDTIEFE,
    geraet: Boolean(RIG),
    fortschritt: () => p,
    vorschau(wert) {
      p = clamp(wert, 0, 1);
      const z = zustand(p);
      if (FARBEN) farbenNachTiefe(z.bohrtiefe / ENDTIEFE * (1 - abschluss3DMix(p)));   // am Schluss wieder das Grün des Anfangs
      const kam = kameraZustand(p, z);
      kam.oy -= hebung;
      kameraSetzen(kam);
      zeichnen(z, p);
      hud(z, p);
      if (window.ThermobohrEcht) window.ThermobohrEcht.zeichne(K, z, p, zeit, spin, abschluss3DMix(p));
    },
  };
})();
