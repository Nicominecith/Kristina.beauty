/* Untere Leiste im Mitarbeiterportal: folgt dem Scrollen (Scroll-Spy), scrollt bei Klick weich zum Bereich
   und hält den aktiven Button in der (seitlich scrollbaren) Leiste sichtbar. */
(function () {
  const bar = document.getElementById('kb-tabbar');
  if (!bar) return;
  const btns = () => Array.from(bar.querySelectorAll('button[data-t]'));
  const target = b => document.getElementById(b.getAttribute('data-t'));
  const visible = el => !!el && el.getClientRects().length > 0 && el.getBoundingClientRect().height > 8;
  let lock = false, lockTimer = null, ticking = false, current = null;

  function offset() {                      // Linie, ab der ein Bereich als „aktuell“ gilt
    const nav = document.getElementById('navbar');
    const h = nav ? nav.getBoundingClientRect().height : 0;
    return Math.max(90, h + 24) + window.innerHeight * 0.12;
  }

  function setActive(b) {
    if (!b || b === current) return;
    current = b;
    btns().forEach(x => { const on = x === b; x.classList.toggle('on', on); if (on) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current'); });
    // aktiven Button in der Leiste zentrieren (nur horizontal – die Seite selbst bleibt stehen)
    const left = b.offsetLeft - (bar.clientWidth - b.offsetWidth) / 2;
    if (bar.scrollWidth > bar.clientWidth + 2) bar.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }

  function spy() {
    ticking = false;
    if (lock || bar.style.display === 'none') return;
    const list = btns().filter(b => visible(target(b)));
    if (!list.length) return;
    const line = offset();
    let active = list[0];
    for (const b of list) { if (target(b).getBoundingClientRect().top <= line) active = b; }
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 6;
    if (atBottom) active = list[list.length - 1];
    setActive(active);
  }
  const queue = () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } };

  function go(b) {
    const el = target(b);
    if (!el) return;
    lock = true; clearTimeout(lockTimer);
    setActive(b);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    lockTimer = setTimeout(() => { lock = false; queue(); }, 900);      // Sicherheitsnetz, falls kein Scroll-Event kommt
  }

  window.addEventListener('scroll', () => {
    if (lock) { clearTimeout(lockTimer); lockTimer = setTimeout(() => { lock = false; queue(); }, 140); return; }
    queue();
  }, { passive: true });
  window.addEventListener('resize', queue);
  bar.addEventListener('click', e => { const b = e.target.closest('button[data-t]'); if (b) go(b); });

  // Inhalt lädt nach (Karten werden per JS gefüllt) → Position neu bestimmen
  new MutationObserver(queue).observe(document.getElementById('portal-content') || document.body, { childList: true, subtree: true });
  new MutationObserver(queue).observe(bar, { attributes: true, attributeFilter: ['style'] });

  window.kbGo = (id, b) => { const x = b || btns().find(y => y.getAttribute('data-t') === id); if (x) go(x); };   // Kompatibilität
  queue();
})();
