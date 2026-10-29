(() => {
  'use strict';
  const header = document.querySelector('.site-header');
  const menu = document.getElementById('menu-toggle');
  const submenuButtons = [...document.querySelectorAll('[data-nav-toggle]')];
  const setSubmenu = (button, open) => {
    button.setAttribute('aria-expanded', String(open));
    const name = button.closest('.nav-group-row').querySelector('a').textContent.trim();
    button.setAttribute('aria-label', name + '-Untermenü ' + (open ? 'schliessen' : 'öffnen'));
    document.getElementById(button.getAttribute('aria-controls')).hidden = !open;
  };
  const closeSubmenus = () => submenuButtons.forEach(button => setSubmenu(button, false));
  submenuButtons.forEach(button => {
    button.addEventListener('click', () => {
      const open = button.getAttribute('aria-expanded') !== 'true';
      closeSubmenus();
      setSubmenu(button, open);
    });
    button.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault(); closeSubmenus(); setSubmenu(button, true);
        document.getElementById(button.getAttribute('aria-controls')).querySelector('a')?.focus();
      }
    });
  });
  document.addEventListener('click', event => { if (!event.target.closest('.nav-group')) closeSubmenus(); });
  document.addEventListener('focusin', event => {
    submenuButtons.forEach(button => { if (!button.closest('.nav-group').contains(event.target)) setSubmenu(button, false); });
  });
  const closeMenu = () => {
    if (!header || !menu) return;
    header.dataset.menu = 'closed';
    document.documentElement.classList.remove('sub-menu-open');
    closeSubmenus();
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Navigation öffnen');
  };
  menu?.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    header.dataset.menu = open ? 'open' : 'closed';
    document.documentElement.classList.toggle('sub-menu-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Navigation schliessen' : 'Navigation öffnen');
    if (!open) closeSubmenus();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const submenu = submenuButtons.find(button => button.getAttribute('aria-expanded') === 'true');
    if (submenu) { setSubmenu(submenu, false); submenu.focus(); }
    else if (menu?.getAttribute('aria-expanded') === 'true') { closeMenu();menu.focus(); }
  });
  header?.querySelectorAll('.site-nav a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || menu?.getAttribute('aria-expanded') !== 'true') return;
    const targets = [menu, ...header.querySelectorAll('.site-nav a, .site-nav button')].filter(el => el.getClientRects().length);
    const first = targets[0], last = targets[targets.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
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
  if (topic && topicField) {
    if (topicField.options) {
      if ([...topicField.options].some(option => option.value === topic)) topicField.value = topic;
    } else topicField.value = topic.slice(0, 100);
  }
  const project = new URLSearchParams(window.location.search).get('projektart');
  const projectField = form.elements.namedItem('projektart');
  if (project && projectField?.options && [...projectField.options].some(option => option.value === project)) projectField.value = project;
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const value = key => String(data.get(key) || '').trim();
    output.value = [
      'Kontaktanfrage – Thermobohr AG', '',
      `Thema: ${value('thema')}`,
      ...(value('bauort') ? [`Bauort / Grundstück: ${value('bauort')}`] : []),
      ...(value('projektart') ? [`Vorhaben: ${value('projektart')}`] : []),
      ...(value('planungsstand') ? [`Planungsstand: ${value('planungsstand')}`] : []),
      ...(value('zeitraum') ? [`Gewünschter Zeitraum: ${value('zeitraum')}`] : []), '',
      'Beschreibung und Fragen:', value('nachricht'), '',
      `Kontaktperson: ${[value('vorname'), value('name')].filter(Boolean).join(' ')}`,
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
  // Only enable preparation after local handling is ready. With scripts disabled,
  // method=dialog also prevents a native request outside a dialog.
  form.querySelector('button[type="submit"]').disabled = false;
})();
