/* Native adaptations of Motion Primitives' once/in-view behaviour and an
   accessible tab interface. Content stays available when scripts are disabled. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if ('IntersectionObserver' in window && !reduced.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.07, rootMargin: '0px 0px 25px 0px' });
    document.querySelectorAll('[data-reveal]').forEach(el => {
      // Keep content already above the viewport fully visible after anchor jumps.
      if (el.getBoundingClientRect().bottom < 0) return;
      el.classList.add('reveal-ready');
      observer.observe(el);
    });
    document.addEventListener('focusin', event => event.target.closest('[data-reveal]')?.classList.add('revealed'));
  }
  const tabs = [...document.querySelectorAll('[data-season]')];
  function activateTab(tab, focus = false) {
    tabs.forEach(item => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !selected;
    });
    if (focus) tab.focus();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateTab(tab));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft') target = tabs[(index + tabs.length - 1) % tabs.length];
      if (event.key === 'Home') target = tabs[0];
      if (event.key === 'End') target = tabs[tabs.length - 1];
      if (target) { event.preventDefault(); activateTab(target, true); }
    });
  });
  if (tabs.length) activateTab(tabs[0]);
  const header = document.querySelector('.website .header');
  const editorial = document.querySelector('.editorial');
  if (header && editorial) {
    const logo = header.querySelector('.brand img');
    let wasContent = false;
    let scheduled = false;
    function updateHeader() {
      const inContent = editorial.getBoundingClientRect().top < 60;
      if (inContent !== wasContent) {
        wasContent = inContent;
        header.classList.toggle('content-header', inContent);
        logo.src = inContent ? 'assets/Logo-dunkel.png' : 'assets/Logo-hell.png';
      }
      scheduled = false;
    }
    addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(updateHeader); } }, { passive: true });
    addEventListener('resize', updateHeader);
    updateHeader();
  }
  // Show every tab's content in a printable or script-free copy as well.
  addEventListener('beforeprint', () => tabs.forEach(tab => document.getElementById(tab.getAttribute('aria-controls')).hidden = false));
  addEventListener('afterprint', () => { const active = tabs.find(tab => tab.getAttribute('aria-selected') === 'true'); if (active) activateTab(active); });
})();
