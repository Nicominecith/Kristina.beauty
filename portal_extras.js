/* Mitarbeiterportal-Erweiterungen: Auswertungen, Kundenkartei, Warteliste, Gutscheine (PDF-Druck) */
const KBP = { cust: [], wait: [], coupons: [], q: '' };
const eur = (n) => (Number(n) || 0).toFixed(2).replace('.', ',') + ' €';
const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function kbBars(rows, fmt = eur) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return rows.length ? rows.map(([l, v]) => `<div style="display:flex;align-items:center;gap:.6rem;margin:.28rem 0;font-size:11px">
    <div style="width:130px;flex:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(l)}">${esc(l)}</div>
    <div style="flex:1;background:#f4efe6;border-radius:6px;height:14px"><div style="width:${Math.max(2, v / max * 100)}%;height:100%;background:var(--gold);border-radius:6px"></div></div>
    <div style="width:70px;text-align:right;font-weight:700">${fmt(v)}</div></div>`).join('') : '<div class="empty-msg">Noch keine Daten.</div>';
}
function kbColumns(rows) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return `<div style="display:flex;align-items:flex-end;gap:6px;height:150px;padding-top:10px">${rows.map(([l, v]) =>
    `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%" title="${esc(l)}: ${eur(v)}">
      <div style="font-size:8px;color:#888">${v ? Math.round(v) : ''}</div><div style="width:100%;height:${v / max * 100}%;min-height:${v ? 3 : 0}px;background:var(--gold);border-radius:5px 5px 0 0"></div>
      <div style="font-size:9px;margin-top:3px">${esc(l)}</div></div>`).join('')}</div>`;
}
const custKey = (b) => (b.email || '').trim().toLowerCase() || (b.phone || '').replace(/\D/g, '').slice(-14) || (b.name || '').toLowerCase();

function kbStats() {
  const conf = allBookings().filter(b => b.status === 'confirmed');
  const now = new Date(), months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l: MON[d.getMonth()], v: 0 }); }
  const byTreat = {}, cnt = {}, cust = {};
  conf.forEach(b => {
    const m = months.find(x => x.k === String(b.date).slice(0, 7)); if (m) m.v += Number(b.total) || 0;
    const sv = Array.isArray(b.services) && b.services.length ? b.services : [];
    const sub = sv.reduce((t, x) => t + x.price * x.quantity, 0) || 1;
    sv.forEach(x => { byTreat[x.name] = (byTreat[x.name] || 0) + (Number(b.total) || 0) * (x.price * x.quantity) / sub; cnt[x.name] = (cnt[x.name] || 0) + x.quantity; });
    const k = custKey(b); const c = cust[k] = cust[k] || { name: b.name, n: 0, sum: 0, last: '' };
    c.n++; c.sum += Number(b.total) || 0; if (b.date > c.last) c.last = b.date;
  });
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
  return { months, byTreat: top(byTreat, 8), cnt: top(cnt, 8), regulars: Object.values(cust).filter(c => c.n >= 2).sort((a, b) => b.n - a.n || b.sum - a.sum).slice(0, 15), total: conf.reduce((t, b) => t + (Number(b.total) || 0), 0), n: conf.length, cust };
}

function kbRenderExtras() {
  const root = document.getElementById('kb-extra-cards'); if (!root) return;
  const st = kbStats();
  const q = KBP.q.toLowerCase();
  // Kundenliste = Kartei + (noch nicht angelegte) Kundinnen aus Buchungen
  const stored = KBP.cust.map(c => ({ ...c, _k: custKey(c) }));
  const have = new Set(stored.map(c => c._k));
  const derived = Object.entries(st.cust).filter(([k]) => !have.has(k)).map(([k, c]) => ({ id: '', name: c.name, _new: true, visits: c.n, stamps: 0 }));
  const list = [...stored, ...derived].filter(c => !q || (c.name + ' ' + (c.email || '') + ' ' + (c.phone || '')).toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
  window._kbList = list;

  root.innerHTML = `
  <div class="card" style="margin-top:2rem"><div class="card-body">
    <h2 class="nav-title" style="margin-bottom:1rem">Auswertungen</h2>
    <div class="stats-grid"><div class="stat-card"><h3>Umsatz (bestätigt)</h3><p>${eur(st.total)}</p></div><div class="stat-card"><h3>Termine</h3><p>${st.n}</p></div><div class="stat-card"><h3>Ø pro Termin</h3><p>${eur(st.n ? st.total / st.n : 0)}</p></div></div>
    <p class="form-label" style="margin:1.2rem 0 .2rem">Umsatz pro Monat (12 Monate)</p>${kbColumns(st.months.map(m => [m.l, m.v]))}
    <p class="form-label" style="margin:1.2rem 0 .2rem">Umsatz nach Behandlung</p>${kbBars(st.byTreat)}
    <p class="form-label" style="margin:1.2rem 0 .2rem">Beliebteste Leistungen (Anzahl)</p>${kbBars(st.cnt, v => v + '×')}
    <p class="form-label" style="margin:1.2rem 0 .4rem">Stammkundinnen (ab 2 Terminen)</p>
    ${st.regulars.length ? st.regulars.map(c => `<div class="booking-sub" style="margin:.2rem 0"><b>${esc(c.name)}</b> · ${c.n} Termine · ${eur(c.sum)} · zuletzt ${esc(c.last.split('-').reverse().join('.'))}</div>`).join('') : '<div class="empty-msg">Noch keine Stammkundinnen.</div>'}
  </div></div>

  <div class="card" style="margin-top:2rem"><div class="card-body">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem"><h2 class="nav-title">Kundenkartei</h2>
      <div style="display:flex;gap:.5rem"><input id="kb-q" placeholder="Suchen …" value="${esc(KBP.q)}" style="padding:.5rem .8rem;border:1px solid var(--border);border-radius:99px"><button class="btn btn-gold btn-sm" onclick="kbCustEdit(-1)">+ Neu</button></div></div>
    ${list.length ? list.map((c, i) => `<div class="booking-item"><div style="flex:1;min-width:0"><div class="booking-name">${esc(c.name)} ${c._new ? '<span class="booking-badge">aus Buchung</span>' : ''}${c.pmuConsent ? ' <span class="booking-badge">PMU ✓</span>' : ''}</div>
      <div class="booking-sub">Stempel ${c.stamps || 0}/8 · ${c.visits || 0} Besuche${c.refCode ? ' · Freunde-Code ' + esc(c.refCode) : ''}${c.birthday ? ' · 🎂 ' + esc(c.birthday.split('-').reverse().join('.')) : ''}</div>
      ${c.allergies ? `<div class="booking-notes">⚠ Allergien: ${esc(c.allergies)}</div>` : ''}${c.notes ? `<div class="booking-notes">${esc(c.notes)}</div>` : ''}
      <button class="btn btn-ghost btn-sm" style="margin-top:.4rem" onclick="kbCustEdit(${i})"><i class="fas fa-edit"></i> Bearbeiten</button></div></div>`).join('') : '<div class="empty-msg">Keine Einträge.</div>'}
  </div></div>

  <div class="card" style="margin-top:2rem"><div class="card-body">
    <h2 class="nav-title" style="margin-bottom:1rem">Warteliste</h2>
    ${KBP.wait.length ? KBP.wait.sort((a, b) => a.date.localeCompare(b.date)).map(w => `<div class="booking-item"><div style="flex:1"><div class="booking-name">${esc(w.name)} · ${esc(w.date.split('-').reverse().join('.'))}</div><div class="booking-sub">${esc(w.email)} ${w.phone ? '· ' + esc(w.phone) : ''}</div>${w.service ? `<span class="booking-badge">${esc(w.service)}</span>` : ''}<div style="font-size:9px;color:${w.notified ? '#27ae60' : 'var(--gold)'};font-weight:700;margin-top:3px">${w.notified ? 'BENACHRICHTIGT' : 'WARTET'}</div></div>
      <button class="btn btn-ghost btn-sm" onclick="kbWaitDel('${esc(w.id)}')"><i class="fas fa-trash"></i></button></div>`).join('') : '<div class="empty-msg">Niemand auf der Warteliste.</div>'}
  </div></div>

  <div class="card" style="margin-top:2rem"><div class="card-body">
    <h2 class="nav-title" style="margin-bottom:1rem">Gutscheine</h2>
    ${KBP.coupons.length ? KBP.coupons.slice(0, 30).map(c => `<div class="booking-sub" style="display:flex;gap:.6rem;align-items:center;margin:.3rem 0"><b style="min-width:130px">${esc(c.code)}</b><span>${c.discount} €</span><span style="color:${c.redeemed ? '#e74c3c' : '#27ae60'}">${c.redeemed ? 'eingelöst' : 'offen'}</span>
      <button class="btn btn-ghost btn-sm" onclick="kbPrintCoupon('${esc(c.code)}',${Number(c.discount)})"><i class="fas fa-print"></i> PDF</button></div>`).join('') : '<div class="empty-msg">Noch keine Gutscheine.</div>'}
  </div></div>`;
  const qi = document.getElementById('kb-q'); if (qi) qi.oninput = (e) => { KBP.q = e.target.value; const p = e.target.selectionStart; kbRenderExtras(); const n = document.getElementById('kb-q'); n.focus(); n.setSelectionRange(p, p); };
}

async function kbLoadExtras() {
  try {
    const [c, w, g] = await Promise.all([api('/.netlify/functions/customers'), api(API + '?waitlist=1'), api('/.netlify/functions/coupon?list=1')]);
    if (c.ok) KBP.cust = c.data.list || []; if (w.ok) KBP.wait = w.data.list || []; if (g.ok) KBP.coupons = g.data.list || [];
  } catch (_) {}
  kbRenderExtras();
}

/* Kundenkartei bearbeiten */
function kbCustEdit(i) {
  const c = i >= 0 ? window._kbList[i] : { name: '' };
  let m = document.getElementById('kb-cust-modal'); if (!m) { m = document.createElement('div'); m.id = 'kb-cust-modal'; m.className = 'modal-overlay'; m.onclick = e => { if (e.target === m) m.classList.remove('open'); }; document.body.appendChild(m); }
  const f = (id, label, v, type = 'text') => `<label class="form-label">${label}</label><input id="kc-${id}" type="${type}" value="${esc(v || '')}" style="width:100%;margin-bottom:.6rem">`;
  m.innerHTML = `<div class="modal-box"><h3>${c.name ? esc(c.name) : 'Neue Kundin'}</h3>
    ${f('name', 'Name', c.name)}${f('email', 'E-Mail', c.email, 'email')}${f('phone', 'Telefon', c.phone, 'tel')}${f('birthday', 'Geburtstag', c.birthday && c.birthday.length === 10 ? c.birthday : '', 'date')}
    ${f('allergies', 'Allergien / Unverträglichkeiten', c.allergies)}
    <label class="form-label">Notizen</label><textarea id="kc-notes" rows="3" style="width:100%;margin-bottom:.6rem">${esc(c.notes || '')}</textarea>
    ${f('stamps', 'Stempel (0–7)', c.stamps || 0, 'number')}
    <label style="display:flex;gap:.5rem;align-items:center;font-size:12px;margin:.4rem 0"><input type="checkbox" id="kc-pmu" ${c.pmuConsent ? 'checked' : ''}> PMU-Einverständnis liegt vor ${c.pmuConsent ? '(' + esc(c.pmuConsent.date) + ')' : ''}</label>
    <div class="modal-actions"><button class="btn btn-ghost btn-sm" onclick="document.getElementById('kb-cust-modal').classList.remove('open')">Abbrechen</button>
    ${c.id ? `<button class="btn btn-ghost btn-sm" style="color:#e74c3c" onclick="kbCustDel('${esc(c.id)}')">Löschen</button>` : ''}<button class="btn btn-gold btn-sm" onclick="kbCustSave('${esc(c.id || '')}')">Speichern</button></div></div>`;
  m.classList.add('open');
}
async function kbCustSave(id) {
  const v = (k) => document.getElementById('kc-' + k).value;
  const body = { id, name: v('name'), email: v('email'), phone: v('phone'), birthday: v('birthday'), allergies: v('allergies'), notes: document.getElementById('kc-notes').value, stamps: v('stamps'),
    pmuConsent: document.getElementById('kc-pmu').checked ? { given: true, date: (KBP.cust.find(x => x.id === id)?.pmuConsent?.date) || new Date().toISOString().slice(0, 10) } : null };
  const { ok, data } = await api('/.netlify/functions/customers', 'POST', body);
  if (!ok) return toast(data.message || 'Fehler');
  document.getElementById('kb-cust-modal').classList.remove('open'); toast('Gespeichert'); kbLoadExtras();
}
async function kbCustDel(id) { if (!confirm('Kundenkarte löschen?')) return; await api('/.netlify/functions/customers', 'POST', { action: 'delete', id }); document.getElementById('kb-cust-modal').classList.remove('open'); kbLoadExtras(); }
async function kbWaitDel(id) { await api(API, 'POST', { action: 'waitlist_delete', id }); kbLoadExtras(); }

/* Gutschein als druckbares PDF (Browser-Druckdialog → „Als PDF speichern“) */
function kbPrintCoupon(code, amount) {
  const w = window.open('', '_blank'); if (!w) return toast('Pop-up blockiert');
  w.document.write(`<!doctype html><meta charset="utf-8"><title>Gutschein ${esc(code)}</title><style>
    @page{size:A5 landscape;margin:0}body{margin:0;font-family:Georgia,serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#fff}
    .c{width:88%;height:80%;border:3px double #C5A880;border-radius:18px;text-align:center;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:20px;box-sizing:border-box}
    h1{letter-spacing:.35em;color:#C5A880;margin:0;font-size:26px}.v{font-size:64px;margin:0}.code{font:700 26px monospace;letter-spacing:.2em;border:1px dashed #C5A880;padding:10px 18px;display:inline-block;margin:0 auto}
    small{color:#777;font:11px Arial}</style><div class="c"><h1>KRISTINA BEAUTY</h1><small>GUTSCHEIN</small><p class="v">${Number(amount)} €</p><div class="code">${esc(code)}</div>
    <small>Einlösbar bei der Online-Buchung oder vor Ort · einmalig verwendbar · Barzahlung im Studio · Werkstraße 10, 22880 Wedel</small></div>
    <script>setTimeout(()=>print(),400)<\/script>`);
  w.document.close();
}

// Einhängen in bestehende Portal-Funktionen
(function () {
  const rd = refreshPortalData;
  refreshPortalData = async function () { await rd(); kbRenderExtras(); };
  const en = enterPortal;
  enterPortal = async function () { await en(); kbLoadExtras(); setInterval(() => { if (!document.hidden) kbLoadExtras(); }, 60000); };
  const gen = generateEmployeeCode;
  generateEmployeeCode = async function () {
    await gen();
    const strong = document.querySelector('#last-gen-code strong'); if (!strong) return;
    const amt = Number(document.getElementById('custom-discount-val').value) || 10;
    const b = document.createElement('button'); b.className = 'btn btn-ghost btn-sm'; b.style.marginLeft = '10px'; b.innerHTML = '<i class="fas fa-print"></i> PDF';
    b.onclick = () => kbPrintCoupon(strong.textContent, amt);
    document.getElementById('last-gen-code').appendChild(b); kbLoadExtras();
  };
})();
if (getKey()) { kbLoadExtras(); setInterval(() => { if (!document.hidden) kbLoadExtras(); }, 60000); }
