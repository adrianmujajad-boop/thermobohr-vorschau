/*
 * Thermobohr AG – Website-Version: kleines, langsam drehendes 3D-Linienbild des Rotomax
 * (Codex/rig-model.js) für Themen und Karten, statt eines Fotos.
 * Jede <canvas class="rig-linien"> wird gezeichnet, solange sie sichtbar ist:
 * in einem Thema, wenn es eingeblendet ist (.an), sonst wenn sie im Bild ist.
 */
(() => {
  'use strict';
  const m = window.ThermobohrModel;
  const flaechen = [...document.querySelectorAll('canvas.rig-linien')];
  if (!m || !Array.isArray(m.segments) || !flaechen.length) return;

  const REDUZIERT = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Linienbild wie in kombi.js: drei Töne, vorne heller
  const TON = ['#598c6b', '#9dcb77', '#c9e9a0'];
  const DECKUNG = [0.45, 0.65, 0.95];
  const BREITE = [0.5, 0.7, 1];

  // Modell um die Mitte seiner Bounding Box zentrieren
  const { min, max } = m.bounds;
  const mitte = [0, 1, 2].map(i => (min[i] + max[i]) / 2);
  const groesse = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const n = m.segments.length;
  const punkte = new Float32Array(n * 6), toene = new Uint8Array(n);
  m.segments.forEach((s, k) => {
    for (let i = 0; i < 3; i++) {
      punkte[k * 6 + i] = s.a[i] - mitte[i];
      punkte[k * 6 + 3 + i] = s.b[i] - mitte[i];
    }
    toene[k] = Math.min(2, Math.max(0, s.tone | 0));
  });

  const sichtbar = new Set();
  const beobachter = new IntersectionObserver(eintraege => {
    for (const e of eintraege) e.isIntersecting ? sichtbar.add(e.target) : sichtbar.delete(e.target);
  });
  flaechen.forEach(c => beobachter.observe(c));
  const aktiv = c => {
    const thema = c.closest('.thema');
    return thema ? thema.classList.contains('an') : sichtbar.has(c);
  };

  function zeichnen(c, yaw) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) return;
    const neueGroesse = c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr);
    if (!neueGroesse && c.letzterYaw === yaw) return;   // unverändert (z. B. bei reduzierter Bewegung)
    c.letzterYaw = yaw;
    if (neueGroesse) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const pitch = 0.12, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const abstand = groesse * 2.6, f = Math.min(w, h) * 0.9 * abstand / groesse;
    const pfade = [new Path2D(), new Path2D(), new Path2D()];
    const proj = (x, y, z, o) => {
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const s = f / (abstand + z2);
      o[0] = w / 2 + x1 * s;
      o[1] = h / 2 - y2 * s;
    };
    const a = [0, 0], b = [0, 0];
    for (let k = 0; k < n; k++) {
      const o = k * 6;
      proj(punkte[o], punkte[o + 1], punkte[o + 2], a);
      proj(punkte[o + 3], punkte[o + 4], punkte[o + 5], b);
      const pf = pfade[toene[k]];
      pf.moveTo(a[0], a[1]);
      pf.lineTo(b[0], b[1]);
    }
    ctx.lineCap = 'round';
    for (let t = 0; t < 3; t++) {
      ctx.globalAlpha = DECKUNG[t];
      ctx.strokeStyle = TON[t];
      ctx.lineWidth = BREITE[t];
      ctx.stroke(pfade[t]);
    }
    ctx.globalAlpha = 1;
  }

  // Ansicht wie im Codex-Viewer (Motor links, Mast rechts), langsam pendelnd
  const start = performance.now();
  function frame(jetzt) {
    const yaw = (m.recommendedView ? m.recommendedView.yaw : -0.48) + (REDUZIERT ? 0 : Math.sin((jetzt - start) / 4000) * 0.6);
    for (const c of flaechen) if (aktiv(c)) zeichnen(c, yaw);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
