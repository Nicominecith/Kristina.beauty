/* Mitarbeiterportal: eigener Zugang (Account-Name/Passwort), Kundenkonten (Profil zurücksetzen), Nachrichten */
const KBA = { accounts: [], threads: [], open: null, drafts: {}, username: '' };
const ACC_API = '/.netlify/functions/account';
const accCall = (action, data = {}) => api(ACC_API, 'POST', { action, ...data });
const dt = (iso) => { try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };

function kbaAvatar(a, size = 56) {
  return `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;flex:none;background:linear-gradient(135deg,#E5D3B3,#C5A880);color:#fff;display:flex;align-items:center;justify-content:center;font:600 ${size * .42}px 'Playfair Display',serif">${esc((a.name || '?').charAt(0).toUpperCase())}${a.avatar ? `<img src="${esc(a.avatar)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">` : ''}</div>`;
}

function kbaRender() {
  const root = document.getElementById('kb-accounts'); if (!root) return;
  const busyTyping = root.contains(document.activeElement) && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName);
  if (busyTyping) return;   // nichts überschreiben, während getippt wird
  const unread = KBA.threads.reduce((t, x) => t + (x.sUnread || 0), 0);
  const q = (KBA.q || '').toLowerCase();
  const accs = KBA.accounts.filter(a => !q || (a.name + ' ' + a.email).toLowerCase().includes(q));

  const threads = KBA.threads.length ? KBA.threads.map(t => {
    const open = KBA.open === t.id, last = (t.items || []).slice(-1)[0];
    return `<div style="border:1px solid #eee6d8;border-radius:14px;padding:.8rem 1rem;margin-bottom:.6rem">
      <div style="display:flex;justify-content:space-between;gap:.6rem;cursor:pointer" onclick="kbaToggle('${esc(t.id)}')">
        <div><b>${esc(t.name || t.email)}</b> ${t.sUnread ? `<span style="background:#b4433a;color:#fff;border-radius:9px;padding:1px 7px;font-size:10px;font-weight:700">${t.sUnread} neu</span>` : ''}
        <div style="font-size:12px;color:#888;margin-top:2px">${esc(t.email || '')} · ${dt(t.updatedAt)}</div>
        ${!open && last ? `<div style="font-size:12px;margin-top:4px;color:#555">${last.from === 's' ? 'Du: ' : ''}${esc(last.text.slice(0, 90))}${last.text.length > 90 ? '…' : ''}</div>` : ''}</div>
        <i class="fas fa-chevron-${open ? 'up' : 'down'}" style="color:#C5A880;margin-top:4px"></i></div>
      ${open ? `<div style="margin-top:.7rem;max-height:260px;overflow:auto;display:flex;flex-direction:column;gap:.4rem">${(t.items || []).map(m => `<div style="align-self:${m.from === 's' ? 'flex-end' : 'flex-start'};max-width:85%;padding:.5rem .75rem;border-radius:14px;font-size:13px;white-space:pre-wrap;word-break:break-word;background:${m.from === 's' ? '#C5A880' : '#f4efe6'};color:${m.from === 's' ? '#fff' : '#222'}">${esc(m.text)}<div style="font-size:9px;opacity:.65;margin-top:3px">${m.from === 's' ? 'Du' : esc(t.name || 'Kunde')} · ${dt(m.at)}</div></div>`).join('')}</div>
        <textarea id="kba-r-${esc(t.id)}" rows="2" placeholder="Antwort schreiben …" style="width:100%;box-sizing:border-box;margin-top:.6rem;border:1px solid #e3dccd;border-radius:10px;padding:.6rem;font:inherit">${esc(KBA.drafts[t.id] || '')}</textarea>
        <button class="btn btn-gold btn-sm" style="margin-top:.4rem" onclick="kbaReply('${esc(t.id)}')"><i class="fas fa-paper-plane"></i> Antworten</button>` : ''}</div>`;
  }).join('') : '<div class="empty-msg">Noch keine Nachrichten von Kunden.</div>';

  const list = accs.length ? accs.map(a => `<div style="display:flex;gap:.9rem;align-items:flex-start;border:1px solid #eee6d8;border-radius:14px;padding:.8rem 1rem;margin-bottom:.6rem;flex-wrap:wrap">
      <div style="cursor:${a.avatar ? 'zoom-in' : 'default'}" ${a.avatar ? `onclick="kbaZoom('${esc(a.id)}')"` : ''}>${kbaAvatar(a, 64)}</div>
      <div style="flex:1;min-width:190px"><b>${esc(a.name)}</b> ${a.banned ? '<span style="background:#b4433a;color:#fff;border-radius:9px;padding:1px 7px;font-size:10px">gesperrt</span>' : ''}${a.avatarLocked ? '<span style="background:#8a6a00;color:#fff;border-radius:9px;padding:1px 7px;font-size:10px;margin-left:4px">Bild gesperrt</span>' : ''}
        <div style="font-size:12px;color:#777;word-break:break-all">${esc(a.email)}${a.phone ? ' · ' + esc(a.phone) : ''}</div>
        <div style="font-size:11px;color:#aaa;margin-top:2px">Registriert ${dt(a.createdAt)}${a.lastLogin ? ' · zuletzt ' + dt(a.lastLogin) : ''}${a.resetAt ? ' · Profil zurückgesetzt ' + dt(a.resetAt) : ''}</div>
        <div style="display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.55rem">
          <button class="btn btn-danger-soft btn-sm" onclick="kbaResetProfile('${esc(a.id)}')"><i class="fas fa-user-slash"></i> Profil zurücksetzen</button>
          ${a.avatarLocked ? `<button class="btn btn-ghost btn-sm" onclick="kbaAct('admin_avatar_lock','${esc(a.id)}',{locked:false})">Bild freigeben</button>` : (a.avatar ? `<button class="btn btn-ghost btn-sm" onclick="kbaAct('admin_avatar_lock','${esc(a.id)}',{locked:true})">Nur Bild entfernen + sperren</button>` : '')}
          <button class="btn btn-ghost btn-sm" onclick="kbaTemp('${esc(a.id)}')"><i class="fas fa-key"></i> Passwort zurücksetzen</button>
          <button class="btn btn-ghost btn-sm" onclick="kbaAct('admin_ban','${esc(a.id)}',{banned:${!a.banned}})">${a.banned ? 'Entsperren' : 'Konto sperren'}</button>
          <button class="btn btn-ghost btn-sm" onclick="kbaDel('${esc(a.id)}')"><i class="fas fa-trash"></i></button>
        </div></div></div>`).join('') : '<div class="empty-msg">Keine Kundenkonten gefunden.</div>';

  root.innerHTML = `
  <div class="card" style="margin-top:2rem"><div class="card-body">
    <div class="sec-title" style="margin-bottom:1rem"><span class="sec-ico"><i class="fas fa-user-shield"></i></span><div><span class="sec-kicker">Mein Zugang</span><h2 class="nav-title">Account-Name &amp; Passwort</h2></div></div>
    <p class="text-muted" style="margin-bottom:.8rem">Ändere hier deinen Mitarbeiter-Account-Name und dein Passwort. Zur Sicherheit brauchst du das aktuelle Passwort.</p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:.6rem">
      <input id="kbs-user" placeholder="Account-Name" value="${esc(KBA.username)}" autocomplete="username" style="padding:.7rem;border:1px solid #e3dccd;border-radius:10px;font:inherit">
      <input id="kbs-new" type="password" placeholder="Neues Passwort (leer = behalten)" autocomplete="new-password" style="padding:.7rem;border:1px solid #e3dccd;border-radius:10px;font:inherit">
      <input id="kbs-cur" type="password" placeholder="Aktuelles Passwort *" autocomplete="current-password" style="padding:.7rem;border:1px solid #e3dccd;border-radius:10px;font:inherit"></div>
    <button class="btn btn-gold btn-sm" style="margin-top:.8rem" onclick="kbaStaffSave()"><i class="fas fa-floppy-disk"></i> Speichern</button>
  </div></div>

  <div class="card" style="margin-top:2rem" id="kba-msgs"><div class="card-body">
    <div class="sec-title" style="margin-bottom:1rem"><span class="sec-ico"><i class="fas fa-comments"></i></span><div><span class="sec-kicker">Kunden</span><h2 class="nav-title">Nachrichten ${unread ? `<span style="background:#b4433a;color:#fff;border-radius:11px;padding:1px 9px;font-size:12px">${unread}</span>` : ''}</h2></div></div>${threads}
  </div></div>

  <div class="card" style="margin-top:2rem"><div class="card-body">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">
      <div class="sec-title"><span class="sec-ico"><i class="fas fa-users"></i></span><div><span class="sec-kicker">Konten (${KBA.accounts.length})</span><h2 class="nav-title">Kundenkonten</h2></div></div>
      <input id="kba-q" placeholder="Suchen …" value="${esc(KBA.q || '')}" oninput="KBA.q=this.value;kbaRender()" style="padding:.6rem .8rem;border:1px solid #e3dccd;border-radius:10px;font:inherit;max-width:220px"></div>
    <p class="text-muted" style="margin-bottom:1rem">Bei unpassenden Profilbildern (z. B. extremistische Symbole): <b>Profil zurücksetzen</b> entfernt Bild, Namen und Angaben und sperrt neue Bild-Uploads. Bei Wiederholung: Konto sperren.</p>${list}
  </div></div>`;
  const tb = document.querySelector('#kb-tabbar button:last-child span'); if (tb) tb.textContent = unread ? `Konten (${unread})` : 'Konten';
}

async function kbaLoad() {
  try {
    const { ok, data } = await accCall('admin_list');
    if (ok) {
      const sig = JSON.stringify([data.accounts, data.threads]);
      if (sig === KBA.sig && document.getElementById('kba-msgs')) return;
      KBA.sig = sig; KBA.accounts = data.accounts || []; KBA.threads = data.threads || [];
    }
  } catch (_) { return; }
  kbaRender();
}
async function kbaLoadStaff() { try { const { ok, data } = await accCall('staff_info'); if (ok) { KBA.username = data.username || ''; } } catch (_) {} }

async function kbaToggle(id) {
  KBA.open = KBA.open === id ? null : id; kbaRender();
  if (KBA.open) { const t = KBA.threads.find(x => x.id === id); if (t && t.sUnread) { t.sUnread = 0; await accCall('admin_read', { id }); kbaRender(); } }
}
async function kbaReply(id) {
  const el = document.getElementById('kba-r-' + id), text = el.value.trim(); if (!text) return;
  const { ok, data } = await accCall('admin_reply', { id, text });
  if (!ok) return toast(data.message || 'Senden fehlgeschlagen');
  KBA.drafts[id] = ''; toast('Antwort gesendet'); kbaLoad();
}
async function kbaAct(action, id, extra = {}) {
  const { ok, data } = await accCall(action, { id, ...extra });
  toast(ok ? 'Erledigt' : (data.message || 'Fehler')); kbaLoad();
}
function kbaResetProfile(id) {
  const a = KBA.accounts.find(x => x.id === id);
  if (confirm(`Profil von „${a ? a.name : 'Kunde'}“ zurücksetzen?\n\nProfilbild, Name, Telefon und Geburtstag werden gelöscht, neue Profilbilder werden gesperrt.`)) kbaAct('admin_reset_profile', id);
}
async function kbaTemp(id) {
  if (!confirm('Neues Passwort für dieses Konto vergeben? Das alte Passwort ist danach ungültig.')) return;
  const { ok, data } = await accCall('admin_temp_password', { id });
  if (ok) prompt('Vorübergehendes Passwort – bitte dem Kunden mitteilen (er kann es unter „Konto“ ändern):', data.password);
  else toast(data.message || 'Fehler');
}
function kbaDel(id) { if (confirm('Konto und Nachrichten endgültig löschen?')) kbaAct('admin_delete', id); }
function kbaZoom(id) {
  const a = KBA.accounts.find(x => x.id === id); if (!a || !a.avatar) return;
  const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  o.onclick = () => o.remove(); o.innerHTML = `<img src="${esc(a.avatar)}" alt="" style="max-width:88vw;max-height:80vh;border-radius:16px">`; document.body.appendChild(o);
}
async function kbaStaffSave() {
  const username = document.getElementById('kbs-user').value.trim(), password = document.getElementById('kbs-new').value, current = document.getElementById('kbs-cur').value;
  if (!current) return toast('Bitte das aktuelle Passwort eingeben.');
  const { ok, data } = await accCall('staff_update', { current, username, password });
  if (!ok) return toast(data.message || 'Speichern fehlgeschlagen');
  if (data.token) sessionStorage.setItem(SESSION_KEY, data.token);
  KBA.username = data.username || ''; toast('Zugang gespeichert ✓');
  ['kbs-new', 'kbs-cur'].forEach(i => { const e = document.getElementById(i); if (e) e.value = ''; });
}
document.addEventListener('input', (e) => { const m = /^kba-r-(.+)$/.exec(e.target.id || ''); if (m) KBA.drafts[m[1]] = e.target.value; });

(function () {
  const en = enterPortal;
  enterPortal = async function () { await en(); await kbaLoadStaff(); await kbaLoad(); setInterval(() => { if (!document.hidden) kbaLoad(); }, 30000); };
})();
if (getKey()) { kbaLoadStaff().then(kbaLoad); setInterval(() => { if (!document.hidden) kbaLoad(); }, 30000); }
