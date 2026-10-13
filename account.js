/* Kunden-Konto: Registrieren / Anmelden, Termin-Status, Profil + Profilbild, Nachrichten an Kristina */
(function () {
    const API = '/.netlify/functions/account', TK = 'kb_acc_token';
    const $ = (id) => document.getElementById(id);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const tok = () => { try { return localStorage.getItem(TK) || ''; } catch (_) { return ''; } };
    const setTok = (t) => { try { t ? localStorage.setItem(TK, t) : localStorage.removeItem(TK); } catch (_) {} };
    let profile = null, tab = 'login', view = 'main';

    async function call(action, data = {}) {
        try {
            const r = await fetch(API, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(tok() ? { Authorization: 'Bearer ' + tok() } : {}) }, body: JSON.stringify({ action, ...data }) });
            const j = await r.json().catch(() => ({}));
            if (r.status === 401 && tok() && action !== 'login') { setTok(''); profile = null; render(); }
            return { ok: r.ok && j.success !== false, ...j };
        } catch (_) { return { ok: false, message: 'Keine Verbindung. Bitte versuche es gleich nochmal.' }; }
    }
    const note = (id, msg, ok) => { const e = $(id); if (!e) return; e.className = 'kba-msg ' + (msg ? (ok ? 'ok' : 'err') : ''); e.textContent = msg || ''; };
    const busy = (b, on) => { if (b) b.disabled = on; };
    const fmtDate = (iso) => { const [y, m, d] = String(iso).split('-'); return `${d}.${m}.${y}`; };
    const fmtTime = (iso) => { const d = new Date(iso); return d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
    const initial = (n) => esc((n || '?').trim().charAt(0).toUpperCase());
    const LINK_META = { instagram: ['fab fa-instagram', 'Instagram'], tiktok: ['fab fa-tiktok', 'TikTok'], facebook: ['fab fa-facebook', 'Facebook'], youtube: ['fab fa-youtube', 'YouTube'], website: ['fas fa-globe', 'Website'] };
    const linksHtml = (links) => Object.keys(LINK_META).filter(k => links && /^https:\/\//.test(links[k] || '')).map(k =>
        `<a class="kba-chip" href="${esc(links[k])}" target="_blank" rel="noopener noreferrer nofollow"><i class="${LINK_META[k][0]}"></i> ${LINK_META[k][1]}</a>`).join('');
    const tabsHtml = (on) => `<div class="kba-tabs kba-maintabs"><button class="${on === 'main' ? 'on' : ''}" data-v="main">Mein Profil</button><button class="${on === 'community' ? 'on' : ''}" data-v="community">Community</button></div>`;
    const bindTabs = (root) => root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; render(); window.scrollTo({ top: 0 }); });
    const avatar = (p) => `<div class="kba-av">${initial(p.name)}${p.avatar ? `<img src="${esc(p.avatar)}" alt="Profilbild">` : ''}</div>`;

    // ───────────── Nav-Link aktualisieren ─────────────
    function navLabel() {
        document.querySelectorAll('[data-acc-link]').forEach(a => {
            a.innerHTML = (profile && profile.avatar ? `<img src="${esc(profile.avatar)}" alt="">` : '<i class="far fa-user" style="margin-right:6px"></i>') + (profile ? esc(profile.name.split(' ')[0]) : 'Konto');
        });
    }

    // ───────────── Rendern ─────────────
    function render() {
        const root = $('account-root'); if (!root) return;
        navLabel();
        if (!profile) return renderAuth(root);
        if (view !== 'main' && window.KBSocial) return KBSocial.render(root);
        renderHome(root);
    }

    function renderAuth(root) {
        const reg = tab === 'register', forgot = tab === 'forgot', reset = tab === 'reset';
        root.innerHTML = `<h1>Mein Konto</h1><p class="kba-sub">Termine verfolgen, Daten ändern und Kristina direkt schreiben.</p>
        <div class="kba-card" style="max-width:460px;margin:0 auto">
        ${forgot || reset ? '' : `<div class="kba-tabs"><button class="${reg ? '' : 'on'}" data-t="login">Anmelden</button><button class="${reg ? 'on' : ''}" data-t="register">Registrieren</button></div>`}
        <form id="kba-form" novalidate>
            ${reg ? `<label for="kba-name">Name</label><input id="kba-name" autocomplete="name" placeholder="Vor- und Nachname">` : ''}
            ${reset ? '' : `<label for="kba-email">E-Mail</label><input id="kba-email" type="email" autocomplete="email" placeholder="deine@mail.de">`}
            ${forgot ? '' : `<label for="kba-pw">${reset ? 'Neues Passwort' : 'Passwort'}</label><input id="kba-pw" type="password" autocomplete="${reg || reset ? 'new-password' : 'current-password'}" placeholder="${reg || reset ? 'mindestens 8 Zeichen' : 'Passwort'}">`}
            <button class="kba-btn" id="kba-go" style="width:100%">${reg ? 'Konto erstellen' : forgot ? 'Link anfordern' : reset ? 'Passwort speichern' : 'Anmelden'}</button>
            <div class="kba-msg" id="kba-note"></div>
        </form>
        ${tab === 'login' ? `<button class="kba-link" data-t="forgot">Passwort vergessen?</button>` : ''}
        ${forgot ? `<button class="kba-link" data-t="login">← Zurück zur Anmeldung</button>` : ''}
        </div><p class="kba-sub" style="margin-top:1rem">Ein Konto ist freiwillig – du kannst weiterhin ohne Anmeldung buchen.</p>`;
        root.querySelectorAll('[data-t]').forEach(b => b.onclick = (e) => { e.preventDefault(); tab = b.dataset.t; render(); });
        $('kba-form').onsubmit = async (e) => {
            e.preventDefault(); const btn = $('kba-go'); busy(btn, true); note('kba-note', '');
            const email = $('kba-email')?.value.trim(), pw = $('kba-pw')?.value || '';
            let r;
            if (reg) r = await call('register', { name: $('kba-name').value.trim(), email, password: pw });
            else if (forgot) r = await call('forgot', { email });
            else if (reset) r = await call('reset', { token: window.__kbResetToken, password: pw });
            else r = await call('login', { email, password: pw });
            busy(btn, false);
            if (!r.ok) return note('kba-note', r.message || 'Das hat leider nicht geklappt.');
            if (forgot) return note('kba-note', r.message, true);
            setTok(r.token); profile = r.profile; window.__kbResetToken = null; tab = 'login'; view = 'main'; render(); prefillBooking();
        };
    }

    function renderHome(root) {
        root.innerHTML = `<h1>Hallo ${esc(profile.name.split(' ')[0])}!</h1><p class="kba-sub">Schön, dass du da bist.</p>
        ${tabsHtml('main')}
        <div class="kba-card"><div class="kba-head">${avatar(profile)}<div style="flex:1;min-width:200px"><h2>${esc(profile.name)}</h2><small>${esc(profile.email)}</small>
            ${profile.bio ? `<div class="kba-bio">${esc(profile.bio)}</div>` : ''}${linksHtml(profile.links) ? `<div class="kba-chips">${linksHtml(profile.links)}</div>` : ''}
            ${profile.bioLocked ? '<div class="kba-msg err" style="display:block">Deine Bio wurde vom Studio gesperrt.</div>' : ''}
            <div class="kba-av-btns"><button class="kba-btn ghost" id="kba-pick"><i class="fas fa-camera"></i> Profilbild</button>${profile.avatar ? '<button class="kba-btn ghost" id="kba-rmav">Entfernen</button>' : ''}<button class="kba-btn ghost" id="kba-out">Abmelden</button></div>
            <input type="file" id="kba-file" accept="image/*" hidden>${profile.avatarLocked ? '<div class="kba-msg err" style="display:block">Das Profilbild wurde vom Studio gesperrt.</div>' : ''}<div class="kba-msg" id="kba-avnote"></div></div></div></div>
        <div class="kba-card"><h2><i class="far fa-calendar-check"></i> Meine Termine</h2><div id="kba-bk"><div class="kba-empty">Lade …</div></div>
            <button class="kba-btn" onclick="navigateTo('booking')">Neuen Termin anfragen</button></div>
        <div class="kba-card"><h2><i class="far fa-comments"></i> Nachricht an Kristina <span id="kba-unread"></span></h2>
            <div class="kba-chat" id="kba-chat"><div class="kba-empty">Lade …</div></div>
            <textarea id="kba-text" maxlength="1500" placeholder="Deine Nachricht …"></textarea><button class="kba-btn" id="kba-send">Senden</button><div class="kba-msg" id="kba-mnote"></div></div>
        <div class="kba-card"><h2><i class="far fa-id-card"></i> Meine Daten</h2>
            <div class="kba-grid"><div><label for="kba-pn">Name</label><input id="kba-pn" value="${esc(profile.name)}" autocomplete="name"></div>
            <div><label for="kba-pp">Telefon</label><input id="kba-pp" type="tel" value="${esc(profile.phone)}" autocomplete="tel"></div>
            <div><label for="kba-pb">Geburtstag (optional)</label><input id="kba-pb" type="date" value="${esc(profile.birthday)}"></div>
            <div><label>E-Mail</label><input value="${esc(profile.email)}" disabled></div></div>
            <label for="kba-pbio">Bio <span id="kba-biocnt" style="text-transform:none;letter-spacing:0;font-weight:400">(${(profile.bio || '').length}/300)</span></label>
            <textarea id="kba-pbio" maxlength="300" placeholder="Erzähl etwas über dich … (z. B. Lashes-Fan aus Wedel ✨)" ${profile.bioLocked ? 'disabled' : ''}>${esc(profile.bio || '')}</textarea>
            <div class="kba-grid">${Object.keys(LINK_META).map(k => `<div><label for="kba-l-${k}"><i class="${LINK_META[k][0]}"></i> ${LINK_META[k][1]}</label><input id="kba-l-${k}" data-link="${k}" value="${esc((profile.links || {})[k] || '')}" placeholder="${k === 'website' ? 'deine-seite.de' : '@dein_name oder Link'}" autocapitalize="off" autocomplete="off" ${profile.bioLocked ? 'disabled' : ''}></div>`).join('')}</div>
            <button class="kba-btn" id="kba-save">Speichern</button><div class="kba-msg" id="kba-snote"></div></div>
        <div class="kba-card"><h2><i class="fas fa-lock"></i> Passwort ändern</h2>
            <div class="kba-grid"><div><label for="kba-cp">Aktuelles Passwort</label><input id="kba-cp" type="password" autocomplete="current-password"></div>
            <div><label for="kba-np">Neues Passwort</label><input id="kba-np" type="password" autocomplete="new-password" placeholder="mindestens 8 Zeichen"></div></div>
            <button class="kba-btn ghost" id="kba-pwb">Passwort ändern</button><div class="kba-msg" id="kba-pnote"></div>
            <div style="margin-top:1.4rem;border-top:1px solid #eee6d8;padding-top:.6rem"><button class="kba-link" id="kba-del" style="color:#a2342a">Konto löschen</button></div></div>`;
        bindTabs(root);
        $('kba-pbio').oninput = (e) => { $('kba-biocnt').textContent = `(${e.target.value.length}/300)`; };
        $('kba-out').onclick = () => { setTok(''); profile = null; view = 'main'; render(); };
        $('kba-pick').onclick = () => $('kba-file').click();
        $('kba-file').onchange = (e) => { const f = e.target.files[0]; if (f) pickAvatar(f); e.target.value = ''; };
        if ($('kba-rmav')) $('kba-rmav').onclick = async () => { const r = await call('update', { name: profile.name, phone: profile.phone, birthday: profile.birthday, avatar: '' }); if (r.ok) { profile = r.profile; render(); } };
        $('kba-save').onclick = async (e) => {
            busy(e.target, true);
            const links = {}; root.querySelectorAll('[data-link]').forEach(i => { links[i.dataset.link] = i.value; });
            const r = await call('update', { name: $('kba-pn').value, phone: $('kba-pp').value, birthday: $('kba-pb').value, avatar: profile.avatar, bio: $('kba-pbio').value, links });
            busy(e.target, false); if (r.ok) { profile = r.profile; navLabel(); prefillBooking(); render(); }
            note('kba-snote', r.ok ? 'Gespeichert ✓' : r.message, r.ok);   // (nach Render erneut gesetzt)
        };
        $('kba-pwb').onclick = async (e) => {
            busy(e.target, true); const r = await call('change_password', { current: $('kba-cp').value, password: $('kba-np').value }); busy(e.target, false);
            if (r.ok) { setTok(r.token); $('kba-cp').value = $('kba-np').value = ''; }
            note('kba-pnote', r.ok ? 'Passwort geändert ✓' : r.message, r.ok);
        };
        $('kba-send').onclick = async (e) => {
            const t = $('kba-text').value.trim(); if (!t) return;
            busy(e.target, true); const r = await call('send_message', { text: t }); busy(e.target, false);
            if (r.ok) { $('kba-text').value = ''; drawChat(r.items); note('kba-mnote', 'Gesendet ✓ – Kristina antwortet dir hier.', true); } else note('kba-mnote', r.message);
        };
        $('kba-del').onclick = async () => {
            const pw = prompt('Konto endgültig löschen? Bitte gib zur Bestätigung dein Passwort ein:'); if (!pw) return;
            const r = await call('delete_account', { password: pw });
            if (r.ok) { setTok(''); profile = null; render(); } else alert(r.message || 'Nicht möglich');
        };
        loadBookings(); loadChat();
    }

    function pickAvatar(file) {   // verkleinert auf 256×256 (Mitte zugeschnitten) → kleine JPEG
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = async () => {
            const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 256;
            c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
            URL.revokeObjectURL(url);
            const r = await call('update', { name: profile.name, phone: profile.phone, birthday: profile.birthday, avatar: c.toDataURL('image/jpeg', 0.82) });
            if (r.ok) { profile = r.profile; render(); } else note('kba-avnote', r.message);
        };
        img.onerror = () => note('kba-avnote', 'Das Bild konnte nicht gelesen werden.');
        img.src = url;
    }

    const LABEL = { pending: 'Angefragt', confirmed: 'Angenommen ✓', declined: 'Abgelehnt', cancelled: 'Abgesagt' };
    async function loadBookings() {
        const r = await call('bookings'), box = $('kba-bk'); if (!box) return;
        if (!r.ok) return box.innerHTML = `<div class="kba-empty">${esc(r.message || 'Termine konnten nicht geladen werden.')}</div>`;
        if (!r.bookings.length) return box.innerHTML = '<div class="kba-empty">Noch keine Termine – sobald du angemeldet buchst, erscheinen sie hier mit Status.</div>';
        box.innerHTML = r.bookings.map(b => {
            const past = b.date < r.now, st = b.attended ? 'done' : b.status;
            const canManage = (b.status === 'pending' || b.status === 'confirmed') && !past;
            return `<div class="kba-bk"><div><b>${esc(b.service)}</b><div class="d">${fmtDate(b.date)} · ${esc(b.time)} Uhr · ${Number(b.total || 0).toFixed(2).replace('.', ',')} € (bar vor Ort)</div>
            ${b.status === 'declined' ? '<div class="d" style="color:#a2342a">Leider nicht möglich – schreib Kristina gern für einen anderen Termin.</div>' : ''}</div>
            <div style="text-align:right"><span class="kba-st ${st}">${b.attended ? 'Erledigt' : LABEL[b.status] || esc(b.status)}</span>
            ${canManage ? `<div><a class="kba-link" href="/?manage=${esc(b.token)}">Absagen / verschieben</a></div>` : ''}</div></div>`;
        }).join('');
    }
    function drawChat(items) {
        const c = $('kba-chat'); if (!c) return;
        c.innerHTML = items.length ? items.map(m => `<div class="kba-m ${m.from}">${esc(m.text)}<small>${m.from === 'c' ? 'Du' : 'Kristina'} · ${fmtTime(m.at)}</small></div>`).join('') : '<div class="kba-empty">Noch keine Nachrichten. Schreib Kristina z. B. bei Fragen zu einer Behandlung.</div>';
        c.scrollTop = c.scrollHeight;
    }
    async function loadChat() { const r = await call('messages'); if (r.ok) drawChat(r.items); }

    // ───────────── Buchungsformular vorbelegen ─────────────
    function prefillBooking() {
        if (!profile) return;
        const parts = profile.name.trim().split(/\s+/), set = (id, v) => { const e = $(id); if (e && !e.value && v) e.value = v; };
        set('inp-vorname', parts[0]); set('inp-nachname', parts.slice(1).join(' ')); set('inp-email', profile.email); set('inp-phone', profile.phone);
    }

    // Termin-Anfragen mit Konto verknüpfen: Authorization-Header für Anfragen an /bookings
    const _fetch = window.fetch.bind(window);
    window.fetch = function (url, opts) {
        try {
            if (tok() && String(url).includes('/.netlify/functions/bookings') && opts && opts.method === 'POST') {
                opts = { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + tok() } };
            }
        } catch (_) {}
        return _fetch(url, opts);
    };

    async function init() {
        const q = new URLSearchParams(location.search);
        if (q.get('reset')) { window.__kbResetToken = q.get('reset'); tab = 'reset'; setTok(''); history.replaceState(null, '', location.pathname + '#account'); if (typeof navigateTo === 'function') setTimeout(() => navigateTo('account'), 900); }
        if (tok()) { const r = await call('me'); if (r.ok) { profile = r.profile; prefillBooking(); } }
        render();
    }
    window.KBAccount = { render, refresh: () => profile && loadBookings(), tabsHtml, bindTabs, linksHtml, getProfile: () => profile,
        go: (v) => { view = v; render(); }, expire: () => { setTok(''); profile = null; view = 'main'; render(); } };
    document.addEventListener('DOMContentLoaded', init);
})();
