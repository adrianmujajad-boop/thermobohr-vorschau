/*
 * Thermobohr AG – Einstieg beim Öffnen der Startseite (claude/v006-stationen).
 * Übernommen aus Codex/Intro-Studien-v002, Variante «02+ · Kamera und Logo», ohne die Studienwerkzeuge.
 *
 * 3,6 s: Die Kamera beginnt nah an der leicht drehenden Bohrkrone und fährt in einem seitlichen Bogen zur
 * Startansicht zurück. Das Logo erscheint über der Krone und wandert in die Kopfzeile, danach kommen Titel und Knopf.
 *
 * Einmal pro Besuch (sessionStorage): Wer von einer Unterseite zurückkommt, sieht sofort die fertige Ansicht.
 * Scrollen, Tippen, Klicken oder eine Taste beenden den Einstieg sofort. Bei reduzierter Bewegung nur eine kurze
 * Einblendung. kombi.js fragt window.ThermobohrEinstieg ab (tick, setCamera, rig, cameraMix, spin).
 * Dieses Skript läuft ohne defer im Kopf, damit html.einstieg schon vor dem ersten Bild gesetzt ist.
 */
(() => {
  'use strict';
  const SCHLUESSEL = 'thermobohr-einstieg-gesehen';
  const params = new URLSearchParams(location.search);
  const reduziert = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let gesehen = true;
  try { gesehen = sessionStorage.getItem(SCHLUESSEL) === '1'; } catch (e) { /* ohne Speicher lieber kein Einstieg als einer bei jedem Seitenwechsel */ }
  // Kein Einstieg: schon gesehen, Prüfhilfe ?p=, Sprungmarke (#stationen …) oder Rückkehr an eine Scrollstelle
  if (gesehen || params.has('p') || location.hash || (history.state && typeof history.state.y === 'number')) return;
  try { sessionStorage.setItem(SCHLUESSEL, '1'); } catch (e) { return; }

  const html = document.documentElement;
  html.classList.add('einstieg');

  const clamp = x => Math.max(0, Math.min(1, x));
  const span = (x, a, b) => clamp((x - a) / (b - a));
  const smooth = x => x * x * (3 - 2 * x);
  const ease = (x, a, b) => smooth(span(x, a, b));
  const mix = (a, b, t) => a + (b - a) * t;
  const DAUER = reduziert ? 450 : 3600;

  const s = {
    active: true, progress: 0, rig: 0, cameraMix: 0, spin: 0,
    gestartet: false, elapsed: 0, last: null, logoZiel: null, marke: null,

    messen() {
      const img = document.querySelector('.header .brand img');
      if (img) this.logoZiel = img.getBoundingClientRect();
    },

    tick(now) {
      if (!this.gestartet || !this.active) return;
      if (this.last === null) this.last = now;
      this.elapsed += Math.min(100, now - this.last);
      this.last = now;
      this.progress = clamp(this.elapsed / DAUER);
      this.anwenden();
      if (this.progress >= 1) this.beenden();
    },

    anwenden() {
      const t = this.progress;
      let text = 1, nav = 1, marke = 1, fuss = 1, titel = 1, knopf = 1;
      this.rig = 1; this.cameraMix = 1; this.spin = 0;
      if (reduziert) {
        text = nav = marke = fuss = titel = knopf = smooth(t);
      } else {
        this.cameraMix = ease(t, 0, .94);
        this.spin = t * Math.PI * 2.1;
        this.rig = ease(t, .21, .56);
        text = ease(t, .54, .97); nav = ease(t, .67, .94); marke = ease(t, .77, .91); fuss = ease(t, .86, 1);
        titel = ease(t, .52, .84); knopf = ease(t, .73, .98);
      }
      const st = html.style;
      st.setProperty('--einstieg-text', text.toFixed(4));
      st.setProperty('--einstieg-nav', nav.toFixed(4));
      st.setProperty('--einstieg-marke', marke.toFixed(4));
      st.setProperty('--einstieg-fuss', fuss.toFixed(4));
      st.setProperty('--einstieg-titel', titel.toFixed(4));
      st.setProperty('--einstieg-knopf', knopf.toFixed(4));

      // Logo: erscheint über der Krone und wandert im Bogen an seinen Platz in der Kopfzeile
      const m = this.marke;
      if (!m) return;
      const zeigen = !reduziert && this.active && this.logoZiel;
      m.hidden = !zeigen;
      if (!zeigen) return;
      const ziel = this.logoZiel;
      const breite = Math.min(innerWidth * .70, 420);
      const q = ease(t, .17, .82), bogen = Math.sin(q * Math.PI);
      const w = mix(breite, ziel.width, q);
      const x = mix((innerWidth - breite) / 2, ziel.left, q) - bogen * Math.min(35, innerWidth * .025);
      const y = mix(innerHeight * .18, ziel.top, q) - bogen * 14;
      m.style.width = `${w}px`;
      m.style.transform = `translate(${x}px, ${y}px)`;
      m.style.opacity = (ease(t, 0, .065) * (1 - ease(t, .79, .93))).toFixed(4);
      m.style.setProperty('--glanz', (Math.sin(span(t, .05, .38) * Math.PI) * .6).toFixed(4));
      m.style.setProperty('--glanz-lage', `${span(t, .05, .38) * 160 - 30}%`);
      m.querySelector('span').style.opacity = (ease(t, .04, .15) * (1 - ease(t, .18, .33))).toFixed(4);
    },

    // Kamera: aus der Nähe der Krone im seitlichen Bogen zur Startansicht, die kombi.js berechnet hat
    setCamera(c) {
      if (reduziert || !this.active) return;
      const t = this.cameraMix, bogen = Math.sin(t * Math.PI), fahrt = 1 - Math.pow(1 - t, 1.22);
      const ziel = { dist: c.dist, lookY: c.lookY, yaw: c.yaw, pitch: c.pitch, ox: c.ox || 0, oy: c.oy || 0 };
      c.dist = Math.exp(mix(Math.log(9.8), Math.log(ziel.dist), fahrt));
      c.lookY = mix(1.55, ziel.lookY, t);
      c.yaw = ziel.yaw + (1 - t) * 1.12 + bogen * .13;
      c.pitch = mix(.12, ziel.pitch, t) + bogen * .045;
      c.ox = mix(0, ziel.ox, t) + bogen * innerWidth * .018;
      c.oy = mix(-innerHeight * .07, ziel.oy, t);
    },

    beenden() {
      if (!this.active) return;
      this.active = false;
      this.progress = 1; this.rig = 1; this.cameraMix = 1; this.spin = 0;
      html.classList.remove('einstieg');
      if (this.marke) this.marke.hidden = true;
    },
  };
  window.ThermobohrEinstieg = s;

  document.addEventListener('DOMContentLoaded', () => {
    const m = document.createElement('div');
    m.className = 'einstieg-marke';
    m.hidden = true;
    m.setAttribute('aria-hidden', 'true');
    m.innerHTML = '<img src="assets/Logo-hell.png" alt=""><span>ENERGIE AUS DER TIEFE</span>';
    document.body.append(m);
    s.marke = m;
    s.messen();
    addEventListener('resize', () => s.messen());
    // Sofort weiterscrollen: jede eigene Eingabe beendet den Einstieg
    for (const typ of ['wheel', 'touchstart', 'pointerdown', 'keydown']) addEventListener(typ, () => s.beenden(), { passive: true });
    addEventListener('scroll', () => { if (scrollY > 40) s.beenden(); }, { passive: true });   // auch Scrollleiste
    addEventListener('pagehide', () => s.beenden());
  });
  // Erst wenn alles geladen ist (Logo, Gerätemodell), läuft die Zeit; bis dahin steht das erste Bild
  addEventListener('load', () => { s.messen(); s.gestartet = true; });
})();
