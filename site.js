(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  const menu = document.getElementById('menu-toggle');
  const closeMenu = () => {
    header.dataset.menu = 'closed';
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Navigation öffnen');
  };
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    header.dataset.menu = open ? 'open' : 'closed';
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Navigation schliessen' : 'Navigation öffnen');
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu?.getAttribute('aria-expanded') === 'true') { closeMenu();menu.focus(); } });
  const wideScreen = window.matchMedia('(min-width: 1001px)');
  wideScreen.addEventListener('change', event => { if (event.matches && menu) closeMenu(); });

  // The contact tool prepares text locally; no request is sent or persisted.
  const form = document.getElementById('inquiry-form');
  if (!form) return;
  const output = document.getElementById('inquiry-output');
  const result = document.getElementById('inquiry-result');
  const status = document.getElementById('inquiry-status');
  const topic = new URLSearchParams(window.location.search).get('thema');
  const topicField = form.elements.namedItem('thema');
  if (topic && [...topicField.options].some(option => option.value === topic)) topicField.value = topic;
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const value = key => String(data.get(key) || '').trim();
    output.value = [
      'Projektanfrage – Thermobohr AG', '',
      `Thema: ${value('thema')}`,
      `Bauort / Grundstück: ${value('bauort')}`,
      `Vorhaben: ${value('projektart')}`,
      `Planungsstand: ${value('planungsstand')}`,
      `Gewünschter Zeitraum: ${value('zeitraum') || 'Noch offen'}`, '',
      'Beschreibung und Fragen:', value('nachricht'), '',
      `Kontaktperson: ${value('name')}`,
      `E-Mail: ${value('email')}`,
      ...(value('telefon') ? [`Telefon: ${value('telefon')}`] : []),
    ].join('\n');
    result.hidden = false;
    status.textContent = 'Ihre Projektübersicht ist erstellt. Es wurde keine Nachricht versendet.';
    output.focus();
  });
  document.getElementById('copy-inquiry').addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(output.value);
      status.textContent = 'Projektübersicht in die Zwischenablage kopiert. Es wurde keine Nachricht versendet.';
    } catch {
      output.focus();output.select();
      status.textContent = 'Der Text ist markiert. Bitte mit Kopieren in Ihre Zwischenablage übernehmen.';
    }
  });
  document.getElementById('download-inquiry').addEventListener('click', () => {
    const blob = new Blob([output.value], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');link.href = url;link.download = 'Thermobohr-Projektanfrage.txt';link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Projektübersicht als Textdatei vorbereitet. Es wurde keine Nachricht versendet.';
  });
  form.addEventListener('reset', () => { result.hidden = true;status.textContent = '';output.value = ''; });
})();
