/* Kristina Beauty – Zusatzfunktionen (Barzahlung-only):
   Dark Mode · Sprache · Cookie-Consent · Dauer-/Überlappungslogik · Warteliste · Termin per Link verwalten ·
   Vorher/Nachher + Zertifikate · Instagram-Footer · PWA */
const KB = {
    api: '/.netlify/functions/bookings',
    instagramUrl: 'https://www.instagram.com/kristina.beauty.kb/',
    instagramWidgetId: '',   // optional: Elfsight-Instagram-Feed-ID eintragen → echter Feed im Footer
    googleWidgetId: '6f8e3c54-46b2-4d2c-8824-388f6c6d967b'
};

/* ───── Behandlungsdauer (clientseitig, spiegelt netlify/lib/shared.js) ───── */
const KB_DUR_CAT = { 'Lashes Neuauflage': 150, 'Refill': 60, 'Liftings': 60, 'Permanent Make Up': 150, 'Facials': 60, 'Facials Pakete': 60, 'Remover': 60 };
const KB_DUR_NAME = [[/1:1 Classic/i, 120], [/Mega Volume|Foxy/i, 180], [/Wimpern entfernen/i, 30], [/Refill bis 2/i, 60], [/Refill bis 3/i, 75], [/Refill bis 4/i, 90], [/Browlifting/i, 45], [/Korean/i, 90], [/Kombilifting/i, 90], [/^(Farbe|Shape|Shape & Farbe)$/i, 30], [/Kombibrows/i, 180], [/Microneedling 45/i, 45], [/Deluxe 70/i, 70], [/Lachs-DNA/i, 60], [/BB Glow Augenringe/i, 30], [/Kombipaket/i, 120]];
function serviceMinutes(cat, name) { for (const [re, m] of KB_DUR_NAME) if (re.test(name || '')) return m; return KB_DUR_CAT[cat] || 60; }
function cartDuration() {
    try {
        let sum = 0;
        bookingServices.forEach((s, i) => { const q = quantities[i] || 0; if (q > 0) sum += serviceMinutes(s.cat, s.name) * (/\d+er Paket/i.test(s.name) ? 1 : q); });
        return sum || 60;
    } catch (_) { return 60; }
}
const kbMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
function slotOverlap(aT, aD, bT, bD) { return kbMin(aT) < kbMin(bT) + bD && kbMin(bT) < kbMin(aT) + aD; }

/* ───── Hilfen ───── */
const $ = (s, r = document) => r.querySelector(s);
const kbEsc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tr = (k) => (window.KBi18n ? KBi18n.t(k) : k);
const store = { get: (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };

/* ───── Dark Mode ───── */
(function () {
    const saved = store.get('kb_theme');
    const dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
})();
function kbToggleTheme() {
    const d = document.documentElement.classList.toggle('dark');
    store.set('kb_theme', d ? 'dark' : 'light');
    document.querySelectorAll('.kb-theme').forEach(b => b.textContent = d ? '☀' : '🌙');
}

/* ───── Cookie-Consent (nur für Embeds: Google-Bewertungen, Instagram, TikTok) ───── */
const kbConsent = () => store.get('kb_consent') === 'all';
let kbThirdLoaded = false;
function kbLoadThirdParty() {
    if (kbThirdLoaded || !kbConsent()) return;
    kbThirdLoaded = true;
    const add = (src, attrs = {}) => { const s = document.createElement('script'); s.src = src; s.async = true; Object.entries(attrs).forEach(([k, v]) => s.setAttribute(k, v)); document.body.appendChild(s); };
    add('https://static.elfsight.com/platform/platform.js', { 'data-use-service-core': '' });
    add('https://platform.instagram.com/en_US/embeds.js');
    add('https://www.tiktok.com/embed.js');
    const g = $('#kb-google-slot'); if (g) g.innerHTML = `<div class="elfsight-app-${KB.googleWidgetId}" data-elfsight-app-lazy></div>`;
    kbRenderInstagram();
}
function kbShowCookie() {
    if ($('#kb-cookie')) return;
    const d = document.createElement('div'); d.id = 'kb-cookie';
    d.innerHTML = `<b>Cookies &amp; externe Inhalte</b>Für Google-Bewertungen, Instagram und TikTok werden externe Dienste geladen. Dabei können Daten an diese Anbieter übertragen werden.
      <div class="row"><button class="kb-btn gold" data-a="all">Alle akzeptieren</button><button class="kb-btn" data-a="min">Nur notwendige</button></div>`;
    d.onclick = (e) => { const a = e.target.dataset.a; if (!a) return; store.set('kb_consent', a === 'all' ? 'all' : 'necessary'); d.remove(); kbLoadThirdParty(); kbRenderInstagram(); kbRenderGoogleSlot(); };
    document.body.appendChild(d);
}
function kbRenderGoogleSlot() {
    const slot = $('#kb-google-slot'); if (!slot || kbConsent()) return;
    slot.innerHTML = `<div class="text-center py-10"><button class="kb-btn" onclick="kbShowCookie()">Bewertungen laden</button></div>`;
}
// Social-Modal (Instagram/TikTok) nur mit Einwilligung
(function () {
    document.addEventListener('DOMContentLoaded', () => {
        const orig = window.openSocialModal;
        if (typeof orig === 'function') window.openSocialModal = function (p) { if (!kbConsent()) { kbShowCookie(); return; } kbLoadThirdParty(); return orig.call(this, p); };
    });
})();

/* ───── Instagram im Footer ───── */
function kbRenderInstagram() {
    const box = $('#kb-ig'); if (!box) return;
    if (kbConsent() && KB.instagramWidgetId) { box.innerHTML = `<div class="elfsight-app-${KB.instagramWidgetId}" data-elfsight-app-lazy></div>`; return; }
    box.innerHTML = `<p class="text-white/40 text-[10px] tracking-[0.4em] uppercase mb-4">Instagram</p>
      <a href="${KB.instagramUrl}" target="_blank" rel="noopener" class="kb-btn gold" style="display:inline-block;text-decoration:none">Auf Instagram folgen</a>
      ${KB.instagramWidgetId && !kbConsent() ? '<div style="margin-top:.8rem"><button class="kb-btn" onclick="kbShowCookie()">Instagram-Inhalte laden</button></div>' : ''}`;
}

/* ───── Warteliste ───── */
function kbOpenModal(html) {
    let m = $('#kb-modal'); if (!m) { m = document.createElement('div'); m.id = 'kb-modal'; m.onclick = e => { if (e.target === m) m.classList.remove('open'); }; document.body.appendChild(m); }
    m.innerHTML = `<div class="kb-box" style="width:100%">${html}</div>`; m.classList.add('open'); return m;
}
function kbWaitlist(dateIso) {
    const date = dateIso || ($('#inp-date') || {}).value;
    if (!date) { try { showToast('Wunschdatum fehlt', 'Bitte zuerst ein Datum wählen.'); } catch (_) {} return; }
    const v = (id) => (($('#' + id) || {}).value || '');
    const m = kbOpenModal(`<h3 class="font-serif text-xl mb-1">Warteliste</h3>
      <p class="text-xs text-gray-500 mb-3">${date.split('-').reverse().join('.')} – Wir benachrichtigen dich per E-Mail, sobald ein Termin frei wird.</p>
      <input class="kb-field" id="wl-name" placeholder="Dein Vorname" value="${kbEsc((v('inp-vorname') + ' ' + v('inp-nachname')).trim())}">
      <input class="kb-field" id="wl-mail" type="email" placeholder="deine@mail.de" value="${kbEsc(v('inp-email'))}">
      <input class="kb-field" id="wl-tel" placeholder="+49 …" value="${kbEsc(v('inp-phone') || v('inp-telefon'))}">
      <div class="row" style="display:flex;gap:.5rem"><button class="kb-btn gold" id="wl-go">Eintragen</button><button class="kb-btn" id="wl-x">Abbrechen</button></div><p id="wl-msg" class="text-xs mt-3"></p>`);
    $('#wl-x', m).onclick = () => m.classList.remove('open');
    $('#wl-go', m).onclick = async () => {
        const body = { action: 'waitlist', date, name: $('#wl-name', m).value, email: $('#wl-mail', m).value, phone: $('#wl-tel', m).value, service: (typeof bookingServices !== 'undefined' ? bookingServices.filter((s, i) => quantities[i] > 0).map(s => s.name).join(', ') : '') };
        try {
            const r = await fetch(KB.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            const d = await r.json();
            $('#wl-msg', m).textContent = d.success ? tr('Du stehst auf der Warteliste.') : (d.message || 'Fehler');
            if (d.success) setTimeout(() => m.classList.remove('open'), 1600);
        } catch (_) { $('#wl-msg', m).textContent = 'Netzwerkfehler'; }
    };
}
function kbInjectWaitlistLink() {
    const sel = $('#inp-time'); if (!sel || $('#kb-wl-link')) return;
    const b = document.createElement('button'); b.type = 'button'; b.id = 'kb-wl-link'; b.className = 'kb-wl-link'; b.textContent = 'Alles belegt? Auf die Warteliste für diesen Tag';
    b.onclick = () => kbWaitlist(); sel.insertAdjacentElement('afterend', b);
}
function kbWlHighlight() { const sel = $('#inp-time'), b = $('#kb-wl-link'); if (!sel || !b) return; const free = [...sel.options].filter(o => o.value && !o.disabled).length; b.classList.toggle('hot', !!$('#inp-date').value && free === 0); }

/* ───── Termin per Link verwalten (?manage=TOKEN) ───── */
async function kbManageInit() {
    const token = new URLSearchParams(location.search).get('manage');
    if (!token) return;
    const root = $('#manage-root'); if (!root) return;
    try { navigateTo('manage'); } catch (_) {}
    root.innerHTML = '<p class="text-center text-sm text-gray-400">…</p>';
    const r = await fetch(`${KB.api}?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.success) { root.innerHTML = `<p class="text-center">${tr('Link ungültig oder Termin nicht gefunden.')}</p>`; return; }
    const b = d.booking, active = b.status === 'confirmed' || b.status === 'pending', late = d.hoursLeft < d.changeHours;
    const when = `${b.date.split('-').reverse().join('.')} · ${kbEsc(b.time)} Uhr`;
    root.innerHTML = `<div class="kb-box"><p class="text-[10px] tracking-[0.3em] uppercase text-brand-gold mb-2">${tr('Dein Termin')}</p>
        <p class="font-serif text-2xl mb-1">${when}</p><p class="text-sm text-gray-500 mb-1">${kbEsc(b.service)}</p>
        <p class="text-sm mb-4">${Number(b.total).toFixed(2).replace('.', ',')} € · ${tr('Barzahlung vor Ort – keine Online-Zahlung')}</p>
        ${!active ? '<p class="text-sm">' + tr('Dein Termin wurde abgesagt.') + '</p>' : late ? `<p class="text-sm">Online-Änderungen sind nur bis ${d.changeHours} Stunden vor dem Termin möglich. Bitte ruf kurz an.</p>` : `
        <label class="text-[10px] tracking-[0.2em] uppercase">${tr('Neuer Termin')}</label>
        <input type="date" id="mg-date" class="kb-field" min="${new Date().toISOString().slice(0, 10)}">
        <select id="mg-time" class="kb-field"><option value="">${tr('Bitte wählen …')}</option></select>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="kb-btn gold" id="mg-move">${tr('Termin verschieben')}</button><button class="kb-btn" id="mg-cancel">${tr('Termin absagen')}</button></div>
        <p id="mg-msg" class="text-sm mt-3"></p>`}</div>`;
    if (!active || late) return;
    let pub = {};
    try { pub = await (await fetch(KB.api, { cache: 'no-store' })).json(); } catch (_) {}
    $('#mg-date').onchange = () => {
        const sel = $('#mg-time'), iso = $('#mg-date').value; sel.innerHTML = `<option value="">${tr('Bitte wählen …')}</option>`; if (!iso) return;
        const [y, m, dd] = iso.split('-').map(Number), dow = new Date(y, m - 1, dd).getDay(), h = CAL_HOURS[dow];
        if (!h || getGermanHolidays(y)[`${y}-${m - 1}-${dd}`]) { sel.innerHTML = '<option value="">Geschlossen</option>'; return; }
        const busy = (pub[`${y}-${m - 1}-${dd}`] || []).filter(x => x.status === 'confirmed' && x.id !== b.id);
        for (let t = kbMin(h.start); t < kbMin(h.end); t += 30) {
            const ts = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
            if (new Date(y, m - 1, dd, Math.floor(t / 60), t % 60) <= new Date() || busy.some(x => slotOverlap(ts, b.dur, x.time, x.dur || 60))) continue;
            sel.insertAdjacentHTML('beforeend', `<option value="${ts}">${ts} Uhr</option>`);
        }
    };
    const post = async (body) => (await fetch(KB.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, ...body }) })).json();
    $('#mg-cancel').onclick = async () => { if (!confirm(tr('Termin wirklich absagen?'))) return; const x = await post({ action: 'cancel' }); $('#mg-msg').textContent = x.success ? tr('Dein Termin wurde abgesagt.') : x.message; if (x.success) $('#mg-move').disabled = $('#mg-cancel').disabled = true; };
    $('#mg-move').onclick = async () => { const date = $('#mg-date').value, time = $('#mg-time').value; if (!date || !time) return; const x = await post({ action: 'reschedule', date, time }); $('#mg-msg').textContent = x.success ? tr('Neuer Termin gespeichert – ich bestätige ihn dir kurz.') : x.message; };
}
// Nach erfolgreicher Buchung: persönlichen Verwaltungslink anzeigen
function kbShowManageLink(token) {
    const box = $('#booking-success'); if (!box || !token) return;
    const url = `${location.origin}/?manage=${token}`;
    let p = $('#kb-manage-hint'); if (!p) { p = document.createElement('p'); p.id = 'kb-manage-hint'; p.className = 'text-xs text-gray-500 mt-5'; box.appendChild(p); }
    p.innerHTML = `${tr('Termin verwalten')}: <a class="text-brand-gold underline break-all" href="${url}">${url}</a>`;
}

/* ───── Vorher/Nachher + Zertifikate (gallery.json) ───── */
async function kbGallery() {
    let g; try { g = await (await fetch('gallery.json', { cache: 'no-cache' })).json(); } catch (_) { return; }
    const ba = (g.before_after || []).filter(x => x.before && x.after), certs = (g.certificates || []).filter(x => x.img);
    const home = $('#page-home'); if (!home || (!ba.length && !certs.length)) return;
    const sec = document.createElement('section'); sec.id = 'kb-results';
    sec.innerHTML = `<div class="text-center"><span class="text-brand-gold text-[10px] font-bold tracking-[0.5em] uppercase block mb-3">Ergebnisse</span>
      <h2 class="font-serif text-3xl tracking-widest uppercase">Vorher / Nachher</h2></div>
      <div class="grid">${ba.map((x, i) => `<figure><div class="kb-ba" data-i="${i}"><img src="${kbEsc(x.before)}" alt="Vorher" loading="lazy"><img class="after" src="${kbEsc(x.after)}" alt="Nachher" loading="lazy"><span class="tag" style="left:8px">Vorher</span><span class="tag" style="right:8px">Nachher</span><div class="bar"></div><input type="range" min="0" max="100" value="50" aria-label="Vorher/Nachher"></div><figcaption class="text-center text-xs mt-2 text-gray-500">${kbEsc(x.label || '')}</figcaption></figure>`).join('')}</div>
      ${certs.length ? `<div class="text-center mt-12"><h2 class="font-serif text-2xl tracking-widest uppercase">Zertifikate</h2></div><div class="grid">${certs.map(c => `<figure><img src="${kbEsc(c.img)}" alt="${kbEsc(c.label || 'Zertifikat')}" loading="lazy" style="border-radius:1rem;width:100%"><figcaption class="text-center text-xs mt-2 text-gray-500">${kbEsc(c.label || '')}</figcaption></figure>`).join('')}</div>` : ''}`;
    home.appendChild(sec);
    sec.querySelectorAll('.kb-ba').forEach(el => { el.querySelector('input').oninput = e => { const v = e.target.value; el.querySelector('.after').style.clipPath = `inset(0 0 0 ${v}%)`; el.querySelector('.bar').style.left = v + '%'; }; });
}

/* ───── Steuerung (Sprache + Dark Mode) in die Navigation ───── */
function kbControls() {
    const make = () => {
        const d = document.createElement('div'); d.className = 'kb-ctl';
        d.innerHTML = `<select class="kb-lang" aria-label="Sprache"><option value="de">DE</option><option value="en">EN</option><option value="ru">RU</option></select><button class="kb-theme" aria-label="Dark Mode">${document.documentElement.classList.contains('dark') ? '☀' : '🌙'}</button><button class="kb-install" style="display:none">App installieren</button>`;
        d.querySelector('.kb-lang').value = window.KBi18n ? KBi18n.lang : 'de';
        d.querySelector('.kb-lang').onchange = e => KBi18n.set(e.target.value);
        d.querySelector('.kb-theme').onclick = kbToggleTheme;
        return d;
    };
    const desk = $('#navbar .md\\:flex'); if (desk) desk.appendChild(make());
    const mob = $('#mobile-menu > div'); if (mob) { const w = make(); w.style.padding = '1rem 0'; mob.appendChild(w); }
}
let kbInstallEvt;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); kbInstallEvt = e; document.querySelectorAll('.kb-install').forEach(b => { b.style.display = ''; b.onclick = () => { kbInstallEvt.prompt(); }; }); });

/* ───── Start ───── */
document.addEventListener('DOMContentLoaded', () => {
    kbControls();
    // Google-Widget: Platzhalter, bis Einwilligung vorliegt
    const old = $('[class^="elfsight-app-"]'); if (old) { const slot = document.createElement('div'); slot.id = 'kb-google-slot'; old.replaceWith(slot); }
    kbRenderGoogleSlot();
    const f = $('footer .max-w-7xl'); if (f) { const ig = document.createElement('div'); ig.id = 'kb-ig'; f.insertBefore(ig, f.firstChild); kbRenderInstagram(); }
    if (!store.get('kb_consent')) setTimeout(kbShowCookie, 1200); else kbLoadThirdParty();
    kbInjectWaitlistLink();
    const di = $('#inp-date'); if (di) di.addEventListener('change', () => setTimeout(kbWlHighlight, 50));
    kbGallery();
    kbManageInit();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
});

/* ── Burgermenü: öffnen/schließen, Scroll-Sperre, Esc, Tippen daneben ── */
(function () {
  const $ = (id) => document.getElementById(id);
  let bd;
  function setOpen(open) {
    const menu = $('mobile-menu'), btn = $('mobile-menu-btn');
    if (!menu || !btn) return;
    if (!bd) { bd = document.createElement('div'); bd.id = 'kb-menu-backdrop'; bd.onclick = () => setOpen(false); document.body.appendChild(bd); }
    if (!menu.querySelector('.kb-cta')) {
      const a = document.createElement('a'); a.href = '#'; a.className = 'kb-cta text-center uppercase text-[11px] font-bold tracking-[0.2em]';
      a.textContent = 'Termin buchen'; a.onclick = (e) => { e.preventDefault(); navigateTo('booking'); };
      menu.firstElementChild.appendChild(a);
    }
    menu.classList.toggle('kb-open', open); bd.classList.toggle('kb-open', open); btn.classList.toggle('kb-open', open);
    btn.setAttribute('aria-expanded', open); btn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
    const i = btn.querySelector('i'); if (i) i.className = open ? 'fas fa-xmark text-lg' : 'fas fa-bars-staggered text-lg';
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }
  window.kbToggleMenu = () => setOpen(!$('mobile-menu').classList.contains('kb-open'));
  window.kbCloseMenu = () => setOpen(false);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  window.addEventListener('resize', () => { if (innerWidth >= 768) setOpen(false); });
  const b = $('mobile-menu-btn'); if (b) { b.setAttribute('aria-controls', 'mobile-menu'); b.setAttribute('aria-expanded', 'false'); }
})();
