/* Kunden-Konto: Registrieren / Anmelden, Termin-Status, Profil + Profilbild, Nachrichten an Kristina */
(function () {
    const API = '/.netlify/functions/account', TK = 'kb_acc_token';
    const $ = (id) => document.getElementById(id);
    const tx = (k) => (window.KBi18n && KBi18n.t) ? KBi18n.t(k) : k;   // übersetzte Meldungen (confirm/prompt/alert)
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const tok = () => { try { return localStorage.getItem(TK) || ''; } catch (_) { return ''; } };
    const setTok = (t) => { try { t ? localStorage.setItem(TK, t) : localStorage.removeItem(TK); } catch (_) {} };
    let unread = 0, profile = null, tab = 'login', view = 'main', pendingProfile = null, codeStep = null, cdTimer = null;   // codeStep: { kind, email, until }

    async function call(action, data = {}) {
        try {
            const r = await fetch(API, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(tok() ? { Authorization: 'Bearer ' + tok() } : {}) }, body: JSON.stringify({ action, ...data }) });
            const j = await r.json().catch(() => ({}));
            if (r.status === 401 && tok() && !['login','verify','register','code_resend'].includes(action)) { setTok(''); profile = null; render(); }
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
            a.innerHTML = (profile && profile.avatar ? `<img src="${esc(profile.avatar)}" alt="">` : '<i class="far fa-user" style="margin-right:6px"></i>') + (profile ? esc(profile.name.split(' ')[0]) : 'Konto') + (unread ? '<span class="kba-dot" style="margin-left:6px" title="Neue Nachricht" aria-label="Neue Nachricht">' + unread + '</span>' : '');
        });
    }

    // ───────────── Rendern ─────────────
    function render() {
        const root = $('account-root'); if (!root) return;
        navLabel();
        root.classList.toggle('kbs-mode', !!profile && view !== 'main');   // Community = Instagram-Layout (ohne Seitenrand)
        if (!profile) return renderAuth(root);
        if (pendingProfile && window.KBSocial) { KBSocial.show(pendingProfile); pendingProfile = null; view = 'community'; }
        if (view !== 'main' && window.KBSocial) return KBSocial.render(root);
        renderHome(root);
    }

    // ───────────── Code-Eingabe (Registrierung / Anmeldung) ─────────────
    function renderCode(root) {
        const c = codeStep, reg = c.kind === 'register';
        root.innerHTML = `<h1>${reg ? 'E-Mail bestätigen' : 'Anmeldung bestätigen'}</h1><p class="kba-sub">Wir haben dir einen 6-stelligen Code an <b>${esc(c.email)}</b> geschickt. Er ist 5 Minuten gültig.</p>
        <div class="kba-card kba-authcard"><form id="kba-cform" novalidate>
            <label for="kba-code">Bestätigungscode</label>
            <input id="kba-code" class="kba-code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" placeholder="••••••" autofocus>
            <button class="kba-btn" id="kba-cgo" style="width:100%">${reg ? 'Konto erstellen' : 'Anmelden'}</button>
            <div class="kba-msg" id="kba-note"></div>
        </form>
        <button class="kba-btn ghost" id="kba-resend" style="width:100%" disabled></button>
        <button class="kba-link" id="kba-cback">← Zurück</button></div>`;
        const rs = $('kba-resend'), inp = $('kba-code');
        clearInterval(cdTimer);
        const tick = () => {
            const left = Math.max(0, Math.ceil((c.until - Date.now()) / 1000));
            rs.disabled = left > 0; rs.textContent = left > 0 ? `Neuen Code anfordern (${left} s)` : 'Neuen Code anfordern';
            if (left <= 0) clearInterval(cdTimer);
        };
        tick(); cdTimer = setInterval(() => { if (!document.body.contains(rs)) return clearInterval(cdTimer); tick(); }, 1000);
        inp.oninput = () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); };
        $('kba-cback').onclick = () => { clearInterval(cdTimer); codeStep = null; render(); };
        rs.onclick = async () => {
            rs.disabled = true; note('kba-note', '');
            const r = await call('code_resend', { kind: c.kind, email: c.email });
            if (r.wait) c.until = Date.now() + r.wait * 1000;
            if (!r.ok) { tick(); return note('kba-note', r.message || 'Das hat leider nicht geklappt.'); }
            c.until = Date.now() + (r.wait || 30) * 1000; tick(); note('kba-note', 'Neuer Code gesendet ✓', true);
        };
        $('kba-cform').onsubmit = async (e) => {
            e.preventDefault(); const b = $('kba-cgo'); busy(b, true); note('kba-note', '');
            const r = await call('verify', { kind: c.kind, email: c.email, code: inp.value });
            busy(b, false);
            if (!r.ok) return note('kba-note', r.message || 'Das hat leider nicht geklappt.');
            clearInterval(cdTimer); codeStep = null; setTok(r.token); profile = r.profile; tab = 'login'; render(); prefillBooking();
        };
        inp.focus();
    }

    function renderAuth(root) {
        if (codeStep) return renderCode(root);
        const reg = tab === 'register', forgot = tab === 'forgot', reset = tab === 'reset';
        root.innerHTML = `<h1>Mein Konto</h1><p class="kba-sub">${pendingProfile ? 'Melde dich an (oder registriere dich), um das geteilte Profil zu sehen.' : view === 'community' ? 'Melde dich an (oder registriere dich), um die Community zu nutzen.' : 'Termine verfolgen, Daten ändern und Kristina direkt schreiben.'}</p>
        <div class="kba-card kba-authcard">
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
            if (reg || tab === 'login' && !r.token) { codeStep = { kind: reg ? 'register' : 'login', email, until: Date.now() + (r.wait || 30) * 1000 }; return render(); }
            setTok(r.token); profile = r.profile; window.__kbResetToken = null; tab = 'login'; render(); prefillBooking();
        };
    }

    function renderHome(root) {
        root.innerHTML = `<h1>Hallo ${esc(profile.name.split(' ')[0])}!</h1><p class="kba-sub">Schön, dass du da bist.</p>
        <div class="kba-card"><div class="kba-head">${avatar(profile)}<div style="flex:1;min-width:200px"><h2>${esc(profile.name)}</h2><small>${esc(profile.email)}</small>
            ${profile.bio ? `<div class="kba-bio">${esc(profile.bio)}</div>` : ''}${linksHtml(profile.links) ? `<div class="kba-chips">${linksHtml(profile.links)}</div>` : ''}
            ${profile.bioLocked ? '<div class="kba-msg err" style="display:block">Deine Bio wurde vom Studio gesperrt.</div>' : ''}
            <div class="kba-av-btns"><button class="kba-btn" id="kba-edit"><i class="fas fa-pen"></i> Profil bearbeiten</button><button class="kba-btn ghost" id="kba-pick"><i class="fas fa-camera"></i> Profilbild</button>${profile.avatar ? '<button class="kba-btn ghost" id="kba-rmav">Entfernen</button>' : ''}<button class="kba-btn ghost" id="kba-out">Abmelden</button></div>
            <input type="file" id="kba-file" accept="image/*" hidden>${profile.avatarLocked ? '<div class="kba-msg err" style="display:block">Das Profilbild wurde vom Studio gesperrt.</div>' : ''}<div class="kba-msg" id="kba-avnote"></div></div></div></div>
        <div class="kba-card"><h2><i class="far fa-calendar-check"></i> Meine Termine</h2><div id="kba-bk"><div class="kba-empty">Lade …</div></div>
            <button class="kba-btn" onclick="navigateTo('booking')">Neuen Termin anfragen</button></div>
        <div class="kba-card"><h2><i class="far fa-comments"></i> Nachricht an Kristina <span id="kba-unread"></span></h2>
            <div class="kba-chat" id="kba-chat"><div class="kba-empty">Lade …</div></div>
            <textarea id="kba-text" maxlength="1500" placeholder="Deine Nachricht …"></textarea><div class="kba-chatbtns"><button class="kba-btn" id="kba-send">Senden</button><button class="kba-btn ghost" id="kba-endchat" hidden><i class="fas fa-xmark"></i> Chat beenden</button></div><div class="kba-msg" id="kba-mnote"></div></div>
        <div class="kba-card"><h2><i class="far fa-id-card"></i> Meine Daten <small style="font:400 .7rem Montserrat,sans-serif;color:#999">(nur für das Studio sichtbar)</small></h2>
            <div class="kba-grid"><div><label for="kba-pn">Name</label><input id="kba-pn" value="${esc(profile.name)}" autocomplete="name"></div>
            <div><label for="kba-pp">Telefon</label><input id="kba-pp" type="tel" value="${esc(profile.phone)}" autocomplete="tel"></div>
            <div><label for="kba-pb">Geburtstag (optional)</label><input id="kba-pb" type="date" value="${esc(profile.birthday)}"></div>
            <div><label>E-Mail</label><input value="${esc(profile.email)}" disabled></div></div>
            <button class="kba-btn" id="kba-save">Speichern</button><div class="kba-msg" id="kba-snote"></div></div>
        <div class="kba-card"><h2><i class="fas fa-lock"></i> Passwort ändern</h2>
            <div class="kba-grid"><div><label for="kba-cp">Aktuelles Passwort</label><input id="kba-cp" type="password" autocomplete="current-password"></div>
            <div><label for="kba-np">Neues Passwort</label><input id="kba-np" type="password" autocomplete="new-password" placeholder="mindestens 8 Zeichen"></div></div>
            <button class="kba-btn ghost" id="kba-pwb">Passwort ändern</button><div class="kba-msg" id="kba-pnote"></div>
            <div style="margin-top:1.4rem;border-top:1px solid #eee6d8;padding-top:.6rem"><button class="kba-link" id="kba-del" style="color:#a2342a">Konto löschen</button></div></div>`;
        bindTabs(root);
        $('kba-out').onclick = () => { setTok(''); profile = null; view = 'main'; render(); };
        $('kba-edit').onclick = openEditor;
        $('kba-pick').onclick = () => $('kba-file').click();
        $('kba-file').onchange = (e) => { const f = e.target.files[0]; if (f) pickAvatar(f); e.target.value = ''; };
        if ($('kba-rmav')) $('kba-rmav').onclick = async () => { const r = await call('update', { name: profile.name, phone: profile.phone, birthday: profile.birthday, avatar: '' }); if (r.ok) { profile = r.profile; render(); } };
        $('kba-save').onclick = async (e) => {
            busy(e.target, true);
            const r = await call('update', { name: $('kba-pn').value, phone: $('kba-pp').value, birthday: $('kba-pb').value, avatar: profile.avatar });
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
        $('kba-endchat').onclick = async (e) => {
            if (!confirm(tx('Chat wirklich beenden? Der Verlauf wird für dich gelöscht.'))) return;
            busy(e.target, true); const r = await call('end_chat'); busy(e.target, false);
            if (r.ok) { drawChat([]); note('kba-mnote', 'Chat beendet ✓ – du kannst jederzeit einen neuen starten.', true); } else note('kba-mnote', r.message);
        };
        $('kba-del').onclick = async () => {
            const pw = prompt(tx('Konto endgültig löschen? Bitte gib zur Bestätigung dein Passwort ein:')); if (!pw) return;
            const r = await call('delete_account', { password: pw });
            if (r.ok) { setTok(''); profile = null; render(); } else alert(r.message || tx('Nicht möglich'));
        };
        loadBookings(); loadChat();
    }

    function pickAvatar(file, done) {   // verkleinert auf 256×256 (Mitte zugeschnitten) → kleine JPEG
        const img = new Image(), url = URL.createObjectURL(file);
        img.onload = async () => {
            const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = 256;
            c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
            URL.revokeObjectURL(url);
            const r = await call('update', { name: profile.name, phone: profile.phone, birthday: profile.birthday, avatar: c.toDataURL('image/jpeg', 0.82) });
            if (r.ok) { profile = r.profile; if (window.KBSocial) KBSocial.invalidate(); if (!done) render(); }
            if (done) done(r); else if (!r.ok) note('kba-avnote', r.message);
        };
        img.onerror = () => { const r = { ok: false, message: 'Das Bild konnte nicht gelesen werden.' }; if (done) done(r); else note('kba-avnote', r.message); };
        img.src = url;
    }

    const LABEL = { pending: 'Angefragt', confirmed: 'Angenommen ✓', declined: 'Abgelehnt', cancelled: 'Abgesagt' };
    async function loadBookings() {
        const r = await call('bookings'), box = $('kba-bk'); if (!box) return;
        if (!r.ok) return box.innerHTML = `<div class="kba-empty">${esc(r.message || 'Termine konnten nicht geladen werden.')}</div>`;
        if (!r.bookings.length) return box.innerHTML = '<div class="kba-empty">Noch keine Termine – sobald du angemeldet buchst, erscheinen sie hier mit Status.</div>';
        box.onclick = (e) => {
            const i = e.target.closest('[data-ics]'), a = e.target.closest('[data-again]');
            if (i) { const b = r.bookings.find(x => x.id === i.dataset.ics); if (b) icsDownload(b); }
            else if (a && typeof navigateTo === 'function') navigateTo('booking');
        };
        box.innerHTML = r.bookings.map(b => {
            const past = b.date < r.now, st = b.attended ? 'done' : b.status;
            const canManage = (b.status === 'pending' || b.status === 'confirmed') && !past;
            return `<div class="kba-bk"><div><b>${esc(b.service)}</b><div class="d">${fmtDate(b.date)} · ${esc(b.time)} Uhr · ${Number(b.total || 0).toFixed(2).replace('.', ',')} € (bar vor Ort)</div>
            ${b.status === 'declined' ? '<div class="d" style="color:#a2342a">Leider nicht möglich – schreib Kristina gern für einen anderen Termin.</div>' : ''}</div>
            <div style="text-align:right"><span class="kba-st ${st}">${b.attended ? 'Erledigt' : LABEL[b.status] || esc(b.status)}</span>
            ${canManage ? `<div><a class="kba-link" href="/?manage=${esc(b.token)}">Absagen / verschieben</a></div>` : ''}
            ${b.status === 'confirmed' && !past ? `<div><button class="kba-link" data-ics="${esc(b.id)}"><i class="far fa-calendar-plus"></i> In Kalender speichern</button></div>` : ''}
            ${(past || b.status === 'declined' || b.status === 'cancelled') ? `<div><button class="kba-link" data-again="1"><i class="fas fa-rotate-right"></i> Nochmal buchen</button></div>` : ''}</div></div>`;
        }).join('');
    }
    function icsDownload(b) {   // Termin als .ics (Handy-/Outlook-/Google-Kalender), Erinnerung 24 h vorher
        const p2 = (n) => String(n).padStart(2, '0'), [y, m, d] = b.date.split('-'), [h, mi] = b.time.split(':').map(Number);
        const end = new Date(Date.UTC(+y, +m - 1, +d, h, mi + (b.dur || 60)));
        const stamp = (dt) => `${dt.getUTCFullYear()}${p2(dt.getUTCMonth() + 1)}${p2(dt.getUTCDate())}T${p2(dt.getUTCHours())}${p2(dt.getUTCMinutes())}00`;
        const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kristina Beauty//DE', 'BEGIN:VEVENT', `UID:${b.id}@kristinabeauty`, `DTSTAMP:${stamp(new Date())}Z`,
            `DTSTART;TZID=Europe/Berlin:${y}${m}${d}T${p2(h)}${p2(mi)}00`, `DTEND;TZID=Europe/Berlin:${stamp(end)}`, 'SUMMARY:Termin bei Kristina Beauty',
            `DESCRIPTION:${String(b.service || '').replace(/[\n,;]/g, ' ')} – Barzahlung vor Ort`, 'LOCATION:Werkstraße 10\\, 22880 Wedel', 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', 'DESCRIPTION:Termin morgen bei Kristina Beauty', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' })); a.download = 'termin-kristina-beauty.ics';
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
    function drawChat(items) {
        const c = $('kba-chat'); if (!c) return;
        c.innerHTML = items.length ? items.map(m => `<div class="kba-m ${m.from}">${esc(m.text)}<small>${m.from === 'c' ? 'Du' : 'Kristina'} · ${fmtTime(m.at)}</small></div>`).join('') : '<div class="kba-empty">Noch keine Nachrichten. Schreib Kristina z. B. bei Fragen zu einer Behandlung.</div>';
        c.scrollTop = c.scrollHeight;
        const eb = $('kba-endchat'); if (eb) eb.hidden = !items.length;
    }
    async function loadChat() { const r = await call('messages'); if (r.ok) { drawChat(r.items); if (unread) { unread = 0; navLabel(); } } }

    // ───────────── Profil bearbeiten (Bild, Name, Bio, Social-Links) ─────────────
    function closeEditor() { const o = $('kba-editor'); if (o) o.remove(); document.body.style.overflow = ''; }
    function openEditor() {
        closeEditor();
        const locked = profile.bioLocked, o = document.createElement('div'); o.className = 'kbs-modal'; o.id = 'kba-editor';
        o.innerHTML = `<div class="kbs-sheet"><button class="kbs-x" aria-label="Schließen">&times;</button>
            <h2 style="margin:0 0 1rem;font-family:'Playfair Display',serif;font-weight:500">Profil bearbeiten</h2>
            <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap"><div id="kbe-av">${avatar(profile)}</div>
                <div><button class="kba-btn ghost" id="kbe-pick" style="margin:0"${profile.avatarLocked ? ' disabled' : ''}><i class="fas fa-camera"></i> Bild ändern</button>
                ${profile.avatar ? '<button class="kba-btn ghost" id="kbe-rm" style="margin:0 0 0 .4rem">Entfernen</button>' : ''}<input type="file" id="kbe-file" accept="image/*" hidden></div></div>
            ${profile.avatarLocked ? '<div class="kba-msg err" style="display:block">Das Profilbild wurde vom Studio gesperrt.</div>' : ''}
            ${locked ? '<div class="kba-msg err" style="display:block">Deine Bio wurde vom Studio gesperrt. Schreib Kristina eine Nachricht, wenn du sie ändern möchtest.</div>' : ''}
            <label for="kbe-name">Name</label><input id="kbe-name" value="${esc(profile.name)}" maxlength="80" autocomplete="name">
            <label for="kbe-bio">Bio <span id="kbe-cnt" style="text-transform:none;letter-spacing:0;font-weight:400">(${(profile.bio || '').length}/300)</span></label>
            <textarea id="kbe-bio" maxlength="300" placeholder="Erzähl etwas über dich … (z. B. Lashes-Fan aus Wedel ✨)"${locked ? ' disabled' : ''}>${esc(profile.bio || '')}</textarea>
            <label>Social Media</label>
            ${Object.keys(LINK_META).map(k => `<div class="kbe-link"><i class="${LINK_META[k][0]}"></i><input data-link="${k}" aria-label="${LINK_META[k][1]}" value="${esc((profile.links || {})[k] || '')}" placeholder="${k === 'website' ? 'deine-seite.de' : LINK_META[k][1] + ': @name oder Link'}" autocapitalize="off" autocomplete="off"${locked ? ' disabled' : ''}></div>`).join('')}
            <div class="kba-msg" id="kbe-note"></div>
            <button class="kba-btn" id="kbe-save" style="width:100%">Speichern</button></div>`;
        document.body.appendChild(o); document.body.style.overflow = 'hidden';
        o.onclick = (e) => { if (e.target === o || e.target.closest('.kbs-x')) closeEditor(); };
        const en = (m, ok) => note('kbe-note', m, ok);
        const refreshAv = () => { $('kbe-av').innerHTML = avatar(profile); };
        $('kbe-bio').oninput = (e) => { $('kbe-cnt').textContent = `(${e.target.value.length}/300)`; };
        $('kbe-pick').onclick = () => $('kbe-file').click();
        $('kbe-file').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) pickAvatar(f, (r) => { if (r.ok) { refreshAv(); navLabel(); en('Bild gespeichert ✓', true); } else en(r.message); }); };
        if ($('kbe-rm')) $('kbe-rm').onclick = async () => { const r = await call('update', { name: profile.name, phone: profile.phone, birthday: profile.birthday, avatar: '' }); if (r.ok) { profile = r.profile; refreshAv(); navLabel(); if (window.KBSocial) KBSocial.invalidate(); $('kbe-rm').remove(); } else en(r.message); };
        $('kbe-save').onclick = async (e) => {
            busy(e.target, true); en('');
            const links = {}; o.querySelectorAll('[data-link]').forEach(i => { links[i.dataset.link] = i.value; });
            const r = await call('update', { name: $('kbe-name').value, phone: profile.phone, birthday: profile.birthday, avatar: profile.avatar, bio: $('kbe-bio').value, links });
            busy(e.target, false);
            if (!r.ok) return en(r.message || 'Das hat leider nicht geklappt.');
            profile = r.profile; if (window.KBSocial) KBSocial.invalidate();
            closeEditor(); navLabel(); prefillBooking(); render();
        };
    }

    // ───────────── Synchronisieren (andere Geräte/Tabs, Sperren durch das Studio) ─────────────
    let syncing = false;
    async function syncMe() {
        if (syncing || !tok() || !profile || document.hidden) return;
        syncing = true;
        try {
            const r = await call('me'); if (!r.ok || !profile) return;
            if ((r.unread || 0) !== unread) { unread = r.unread || 0; navLabel(); }
            if (JSON.stringify(r.profile) !== JSON.stringify(profile)) {
                profile = r.profile; navLabel(); prefillBooking();
                const root = $('account-root'), typing = root && root.contains(document.activeElement) && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
                if (!typing && !$('kba-editor') && !$('kbs-modal')) render();
            }
        } finally { syncing = false; }
    }
    setInterval(syncMe, 45000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncMe(); });
    window.addEventListener('focus', syncMe);
    window.addEventListener('storage', (e) => {      // Anmeldung/Abmeldung in einem anderen Tab
        if (e.key !== TK) return;
        if (!e.newValue) { profile = null; view = 'main'; render(); }
        else if (!profile) init();
    });

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
        const sp = q.get('profile');   // geteilter Profil-Link: /?profile=<id>
        if (sp && /^[a-f0-9]{16}$/.test(sp)) { pendingProfile = sp; view = 'community'; history.replaceState(null, '', location.pathname + '#account'); if (typeof navigateTo === 'function') setTimeout(() => navigateTo('account'), 900); }
        if (tok()) { const r = await call('me'); if (r.ok) { profile = r.profile; unread = r.unread || 0; prefillBooking(); } }
        render();
    }
    window.KBAccount = { render, refresh: () => profile && loadBookings(), tabsHtml, bindTabs, linksHtml, getProfile: () => profile,
        go: (v) => { view = v; render(); }, edit: () => profile && openEditor(), getView: () => view, expire: () => { setTok(''); profile = null; view = 'main'; codeStep = null; render(); } };
    document.addEventListener('DOMContentLoaded', init);
    // Menü-Link „Konto“ (Navigation oben / Burger-Menü): immer „Mein Profil“, nicht die Community
    window.openAccount = function () {
        view = 'main';
        if (typeof currentPage !== 'undefined' && currentPage === 'account') { render(); window.scrollTo({ top: 0 }); }
        else if (typeof navigateTo === 'function') navigateTo('account');
    };
    // Menü-Link „Community“ (Navigation oben / Burger-Menü)
    window.openCommunity = function () {
        view = 'community';
        if (typeof currentPage !== 'undefined' && currentPage === 'account') { render(); window.scrollTo({ top: 0 }); }
        else if (typeof navigateTo === 'function') navigateTo('account');
    };
})();
