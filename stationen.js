/*
 * Thermobohr AG – Stationen während der Bohrung (claude/v006-stationen).
 *
 * Jede Station (.thema) hat einen eigenen Auftritt, gewählt mit data-stil. Alles folgt dem
 * Scrollfortschritt der Bohrung, auch rückwärts: kombi.js ruft in jedem Bild
 * ThermobohrStationen.aktualisieren(p) auf. Hier werden nur CSS-Variablen gesetzt,
 * die Gestaltung steht in stationen.css.
 *
 *   --e    Auftritt 0..1 (linear über EIN des Scrollwegs)
 *   --x    Abgang 0..1 (geglättet)
 *   --mix  Sichtbarkeit der ganzen Station
 *   --…    Phasen des Stils (PHASEN), jeweils geglättet 0..1
 *
 * Dazu die Leiste mit den acht Stationen (Antippen springt hin, «Weiter» zur nächsten)
 * und die Knöpfe [data-zur-station] in der Stationsliste unter der Animation.
 */
(() => {
  'use strict';
  const sektion = document.getElementById('bohrung');
  if (!sektion) return;
  const stage = sektion.querySelector('.stage');
  const REDUZIERT = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const range = (v, a, b) => clamp((v - a) / (b - a), 0, 1);
  const smooth = t => t * t * (3 - 2 * t);

  // Anteil des Scrollwegs für Auftritt und Abgang einer Station
  const EIN = 0.024, AUS = 0.01;

  // Phasen je Stil als [Beginn, Ende] innerhalb des Auftritts
  const PHASEN = {
    vermessen: { ziel: [0, .4], scan: [.22, 1] },
    wasser: { pegel: [0, .85], welle: [.78, 1] },
    takt: { inhalt: [.66, 1] },
    temperatur: { inhalt: [0, .35], waerme: [.25, 1] },
    bauplan: { mass: [0, .5], raster: [0, .4], inhalt: [.3, .85], zahl: [.3, 1] },
    lot: { lot: [0, .55], inhalt: [.42, 1] },
    absenken: { sinken: [0, .8], schlaufe: [.15, 1] },
    verpressen: { fuellung: [0, .65], inhalt: [.35, .95], setzen: [.7, 1] },
  };
  // Hammer-Takt: vier Schläge setzen die Überschrift zusammen
  const SCHLAEGE = [.04, .18, .32, .46];

  const stationen = [...sektion.querySelectorAll('.thema[data-von]')].map((el, i) => ({
    el, i,
    von: +el.dataset.von,
    bis: +el.dataset.bis,
    stil: el.dataset.stil || '',
    name: (el.querySelector('.thema-nr')?.textContent || '').split('·').slice(1).join('·').trim(),
    zahlen: [...el.querySelectorAll('[data-zahl]')],
    temperatur: el.querySelector('[data-temperatur]'),
    werte: {},
    an: false,
    bereit: false,
  }));
  if (!stationen.length) return;
  for (const c of stationen) {
    c.el.inert = true;
    c.el.setAttribute('aria-hidden', 'true');
    c.el.querySelector('h2')?.setAttribute('tabindex', '-1');
  }

  function setze(c, name, wert) {
    if (c.werte[name] === wert) return;
    c.werte[name] = wert;
    c.el.style.setProperty(name, wert);
  }

  function takt(c, e) {
    let n = 0;
    for (const s of SCHLAEGE) if (e >= s) n++;
    setze(c, '--schlag', (n / SCHLAEGE.length).toFixed(2));
    // Nach jedem Schlag ein kurzer Rückstoss, der rasch abklingt
    let zittern = 0;
    if (n && !REDUZIERT) zittern = Math.pow(1 - range(e, SCHLAEGE[n - 1], SCHLAEGE[n - 1] + .1), 3) * 5 * (n % 2 ? 1 : -1);
    setze(c, '--zittern', `${zittern.toFixed(2)}px`);
  }

  const grad = n => n < 0 ? `−${Math.abs(n)}` : String(n);
  function temperatur(c, w) {
    const tief = Math.round(lerp(-5, 10, w)), hoch = Math.round(lerp(30, 10, w));
    const text = hoch - tief < 1 ? 'Das ganze Jahr rund 10 °C' : `Übers Jahr ${grad(tief)} bis ${hoch} °C`;
    if (c.temperatur.textContent !== text) c.temperatur.textContent = text;
  }

  function zaehlen(c, el, e) {
    const phase = (PHASEN[c.stil] || {})[el.dataset.phase] || [0, 1];
    const t = REDUZIERT ? 1 : smooth(range(e, phase[0], phase[1]));
    const wert = lerp(+(el.dataset.start || 0), +el.dataset.zahl, t).toFixed(+(el.dataset.stellen || 0));
    if (el.textContent !== wert) el.textContent = wert;
  }

  // ---------- Sprünge: Leiste, «Weiter», Stationsliste ----------
  // Während einer Sprungfahrt bleiben die überflogenen Stationen aus; nur das Ziel erscheint.
  let sprung = null, fokusNach = -1, fokusSchluss = false;
  const weg = () => sektion.offsetHeight - stage.clientHeight;
  const zielVon = c => Math.min(c.bis - AUS - .004, c.von + EIN + .006);
  function scrollZu(pZiel) {
    const top = window.scrollY + sektion.getBoundingClientRect().top + weg() * pZiel;
    window.scrollTo({ top, behavior: REDUZIERT ? 'instant' : 'smooth' });
  }
  // fokus: Tastaturfokus nach der Fahrt in die Zielstation (bzw. in den Schluss) setzen
  function springe(i, fokus = false) {
    if (i >= stationen.length) {
      sprung = { index: -1, ziel: 0.95, seit: performance.now() };
      fokusSchluss = fokus;
      scrollZu(0.95);
      return;
    }
    const c = stationen[clamp(i, 0, stationen.length - 1)];
    sprung = { index: c.i, ziel: zielVon(c), seit: performance.now() };
    fokusNach = fokus ? c.i : -1;
    scrollZu(sprung.ziel);
  }
  const panel = document.getElementById('ending-panel');
  panel?.addEventListener('thermobohr:ending', e => {
    if (!e.detail?.active || !fokusSchluss) return;
    fokusSchluss = false;
    panel.querySelector('a[href], button')?.focus({ preventScroll: true });
  });
  // Eigenes Scrollen beendet die Sprungfahrt sofort
  const abbrechen = () => { sprung = null; fokusNach = -1; fokusSchluss = false; };
  for (const typ of ['wheel', 'touchstart', 'keydown']) window.addEventListener(typ, abbrechen, { passive: true });

  const reise = sektion.querySelector('.journey');
  const knoepfe = reise ? [...reise.querySelectorAll('.journey-stops button')] : [];
  const reiseNummer = reise?.querySelector('.journey-current');
  const weiter = reise?.querySelector('.journey-next');
  const weiterText = weiter?.querySelector('.journey-next-text');
  let reiseSichtbar = null, reiseIndex = -2, naechste = 0, fortschrittAlt = [];
  knoepfe.forEach((knopf, i) => knopf.addEventListener('click', () => springe(i)));
  weiter?.addEventListener('click', () => springe(naechste, naechste >= stationen.length));
  document.querySelectorAll('[data-zur-station]').forEach(knopf => knopf.addEventListener('click', () => springe(+knopf.dataset.zurStation, true)));

  // Sprungmarken in der Bühne, die hinter die Animation führen (#stationen, #leistungen): sofort hin statt
  // die ganze Bohrung im Schnelldurchlauf abzuspielen; der Fokus geht auf die Überschrift des Ziels
  sektion.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    const ziel = a && a.hash.length > 1 && document.getElementById(a.hash.slice(1));
    if (!ziel || sektion.contains(ziel)) return;
    e.preventDefault();
    sprung = null;
    // wie ein normaler Ankerlink ein Verlaufseintrag; die Zurück-Taste führt an die alte Stelle zurück
    history.replaceState({ ...(history.state || {}), y: window.scrollY }, '');
    history.pushState(null, '', a.hash);
    ziel.scrollIntoView({ behavior: 'instant' });
    const titel = ziel.querySelector('h2') || ziel;
    if (!titel.hasAttribute('tabindex')) titel.setAttribute('tabindex', '-1');
    titel.focus({ preventScroll: true });
  });

  // Halte für die Tasten: alle Stationen und die Zeilen «500 m» und «Gestänge zurück», nach Fortschritt geordnet
  const halte = [
    ...stationen.map(c => ({ station: c.i, von: c.von, bis: c.bis, ziel: zielVon(c) })),
    ...[...sektion.querySelectorAll('.cap[data-kamera]')].map(el => ({ station: -1, von: +el.dataset.von, bis: +el.dataset.bis, ziel: +el.dataset.von + .018 })),
  ].sort((a, b) => a.von - b.von);
  function halten(h) {
    if (h.station >= 0) { springe(h.station); return; }
    sprung = { index: -1, ziel: h.ziel, seit: performance.now() };
    scrollZu(h.ziel);
  }

  window.addEventListener('popstate', e => {
    if (e.state && typeof e.state.y === 'number') window.scrollTo({ top: e.state.y, behavior: 'instant' });
  });

  // Leertaste, Bild-ab und Bild-auf gehen in der Bohrung von Halt zu Halt (sonst überspringt ein Druck oft eine ganze Station)
  window.addEventListener('keydown', e => {
    if (!reiseSichtbar || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest && e.target.closest('a, button, input, select, textarea, summary, [contenteditable], dialog')) return;
    const vor = e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey);
    const zurueck = e.key === 'PageUp' || (e.key === ' ' && e.shiftKey);
    if (!vor && !zurueck) return;
    e.preventDefault();
    const p = window.ThermobohrBohrung ? window.ThermobohrBohrung.fortschritt() : 0;
    if (vor) {
      const h = halte.find(x => x.von > p + .001);
      if (h) halten(h); else springe(stationen.length);
      return;
    }
    // zurück: in einem Halt zum vorigen, in der Pause danach zum eben verlassenen
    let i = -1;
    halte.forEach((x, k) => { if (x.von <= p + .001) i = k; });
    if (i >= 0 && p <= halte[i].bis) i -= 1;
    if (i >= 0) halten(halte[i]); else scrollZu(0);
  });

  function reiseAktualisieren(p) {
    if (!reise) return;
    const erste = stationen[0], letzte = stationen[stationen.length - 1];
    const sicht = smooth(range(p, erste.von - .02, erste.von)) * (1 - smooth(range(p, letzte.bis, letzte.bis + .01)));
    reise.style.setProperty('--journey-opacity', sicht.toFixed(3));
    const sichtbar = sicht > .5;
    if (reiseSichtbar !== sichtbar) {
      reiseSichtbar = sichtbar;
      reise.classList.toggle('is-visible', sichtbar);
      reise.inert = !sichtbar;
      reise.setAttribute('aria-hidden', String(!sichtbar));
      stage.classList.toggle('reise-an', sichtbar);
    }
    // Aktuelle Station: die zuletzt erreichte; nächste: die erste, die noch kommt
    let index = -1;
    naechste = stationen.length;
    stationen.forEach((c, i) => {
      if (p >= c.von - .001) index = i;
      else if (naechste === stationen.length) naechste = i;
      const f = range(p, c.von, c.bis).toFixed(3);
      if (fortschrittAlt[i] !== f) { fortschrittAlt[i] = f; knoepfe[i]?.style.setProperty('--stop-progress', f); }
    });
    if (index !== reiseIndex || weiter?.dataset.naechste !== String(naechste)) {
      reiseIndex = index;
      const zeige = Math.max(index, 0);
      if (reiseNummer) reiseNummer.textContent = `${String(zeige + 1).padStart(2, '0')} / ${String(stationen.length).padStart(2, '0')}`;
      if (weiter) {
        weiter.dataset.naechste = String(naechste);
        const name = naechste < stationen.length ? stationen[naechste].name : 'Wärme gewinnen';
        if (weiterText) weiterText.textContent = `Weiter · ${name}`;
        weiter.setAttribute('aria-label', naechste < stationen.length ? `Weiter zu Station ${String(naechste + 1).padStart(2, '0')}: ${name}` : 'Weiter zum Schluss: Wärme gewinnen');
      }
      knoepfe.forEach((knopf, i) => i === index ? knopf.setAttribute('aria-current', 'step') : knopf.removeAttribute('aria-current'));
    }
  }

  // ---------- Bild für Bild ----------
  function aktualisieren(p) {
    if (sprung && performance.now() - sprung.seit > 6000) abbrechen();
    if (sprung && Math.abs(p - sprung.ziel) < .003) sprung = null;
    for (const c of stationen) {
      const e = range(p, c.von, c.von + EIN);
      const xRoh = range(p, c.bis - AUS, c.bis);
      const sichtbar = e > 0 && xRoh < 1 && (!sprung || sprung.index === c.i);
      if (c.an !== sichtbar) { c.an = sichtbar; c.el.classList.toggle('an', sichtbar); }
      if (!sichtbar && c.werte['--mix'] === '0.000') continue;
      const x = smooth(xRoh);
      const mix = !sichtbar ? 0 : REDUZIERT ? smooth(e) * (1 - x) : 1 - x;
      setze(c, '--mix', mix.toFixed(3));
      // Bei reduzierter Bewegung steht jede Station sofort fertig da und blendet nur weich ein und aus
      const eStil = REDUZIERT ? 1 : e;
      setze(c, '--e', eStil.toFixed(3));
      setze(c, '--x', (REDUZIERT ? 0 : x).toFixed(3));
      const phasen = PHASEN[c.stil];
      if (phasen) for (const name in phasen) {
        const [a, b] = phasen[name];
        setze(c, `--${name}`, smooth(range(eStil, a, b)).toFixed(3));
      }
      if (c.stil === 'takt') takt(c, eStil);
      if (c.temperatur) temperatur(c, smooth(range(eStil, ...PHASEN.temperatur.waerme)));
      for (const el of c.zahlen) zaehlen(c, el, eStil);
      const bereit = sichtbar && mix > .5 && e > .45;
      if (c.bereit !== bereit) {
        c.bereit = bereit;
        c.el.inert = !bereit;
        c.el.setAttribute('aria-hidden', String(!bereit));
        if (bereit && fokusNach === c.i && (!sprung || sprung.index === c.i)) { fokusNach = -1; c.el.querySelector('h2')?.focus({ preventScroll: true }); }
      }
    }
    reiseAktualisieren(p);
  }

  // Oberkante des Stationsblatts in Bühnenkoordinaten – für kombi.js, damit die Bohrung darüber frei bleibt.
  // Gemessen wird das unverschobene Element .thema, einmal je Station und nach jeder Grössenänderung.
  let oben = null, obenVon = -1;
  window.addEventListener('resize', () => { for (const c of stationen) c.oben = undefined; obenVon = -1; });
  function blattOben() {
    const c = stationen.find(s => s.an);
    if (!c) return oben;   // in der Pause zwischen zwei Stationen gilt das letzte Blatt
    if (c.oben === undefined) c.oben = c.el.getBoundingClientRect().top - stage.getBoundingClientRect().top;
    if (obenVon !== c.i) { obenVon = c.i; oben = c.oben; }
    return oben;
  }
  const imBereich = p => p >= stationen[0].von - .02 && p <= stationen[stationen.length - 1].bis + .004;

  // springt(): läuft gerade eine Sprungfahrt? kombi.js lässt dann auch die Zeilen 500 m / Gestänge aus
  window.ThermobohrStationen = { aktualisieren, springe, springt: () => sprung !== null, blattOben, imBereich, anzahl: stationen.length };
})();
