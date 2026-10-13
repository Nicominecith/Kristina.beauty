/* Mitarbeiterportal: Community-Beiträge ansehen und unpassende Posts löschen */
const KBS = { posts: [], sig: '' };
const SOC_API = '/.netlify/functions/social';
const socCall = (action, data = {}) => api(SOC_API, 'POST', { action, ...data });
const sdt = (iso) => { try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };

function kbsRender() {
  const root = document.getElementById('kb-social'); if (!root) return;
  const q = (KBS.q || '').toLowerCase();
  const posts = KBS.posts.filter(p => !q || (p.caption + ' ' + p.author + ' ' + p.tags.join(' ')).toLowerCase().includes(q));
  const list = posts.length ? posts.map(p => `<div style="display:flex;gap:.9rem;align-items:flex-start;border:1px solid #eee6d8;border-radius:14px;padding:.7rem .9rem;margin-bottom:.6rem">
      <img src="${esc(p.image)}" alt="" loading="lazy" style="width:84px;height:84px;object-fit:cover;border-radius:10px;flex:none;cursor:zoom-in" onclick="kbsZoom('${esc(p.id)}')">
      <div style="flex:1;min-width:0"><b>${esc(p.author)}</b> ${p.banned ? '<span style="background:#b4433a;color:#fff;border-radius:9px;padding:1px 7px;font-size:10px">gesperrt</span>' : ''}
        <div style="font-size:11px;color:#aaa">${sdt(p.createdAt)} · ♥ ${p.likes}</div>
        <div style="font-size:13px;margin-top:3px;white-space:pre-wrap;word-break:break-word">${esc(p.caption || '(ohne Beschreibung)')}</div>
        <button class="btn btn-danger-soft btn-sm" style="margin-top:.5rem" onclick="kbsDelete('${esc(p.id)}')"><i class="fas fa-trash"></i> Post löschen</button></div></div>`).join('')
    : '<div class="empty-msg">Noch keine Community-Beiträge.</div>';
  root.innerHTML = `<div class="card" style="margin-top:2rem"><div class="card-body">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;margin-bottom:1rem">
      <div class="sec-title"><span class="sec-ico"><i class="fas fa-images"></i></span><div><span class="sec-kicker">Beiträge (${KBS.posts.length})</span><h2 class="nav-title">Community</h2></div></div>
      <input placeholder="Suchen …" value="${esc(KBS.q || '')}" oninput="KBS.q=this.value;kbsRender()" style="padding:.6rem .8rem;border:1px solid #e3dccd;border-radius:10px;font:inherit;max-width:220px"></div>
    <p class="text-muted" style="margin-bottom:1rem">Hier siehst du die neuesten Beiträge der Kundinnen. Beiträge mit Nazi-/Hass-Begriffen werden automatisch blockiert – alles andere Unpassende kannst du hier löschen.</p>${list}
  </div></div>`;
}
async function kbsLoad() {
  try {
    const { ok, data } = await socCall('admin_posts');
    if (!ok) return;
    const sig = JSON.stringify(data.posts.map(p => [p.id, p.likes, p.caption]));
    if (sig === KBS.sig && document.getElementById('kb-social').firstChild) return;
    const el = document.activeElement; if (el && document.getElementById('kb-social').contains(el) && el.tagName === 'INPUT') return;
    KBS.sig = sig; KBS.posts = data.posts || [];
  } catch (_) { return; }
  kbsRender();
}
async function kbsDelete(id) {
  if (!confirm('Diesen Post endgültig löschen?')) return;
  const { ok, data } = await socCall('admin_post_delete', { id });
  toast(ok ? 'Post gelöscht' : (data.message || 'Fehler')); KBS.sig = ''; kbsLoad();
}
function kbsZoom(id) {
  const p = KBS.posts.find(x => x.id === id); if (!p) return;
  const o = document.createElement('div'); o.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out';
  o.onclick = () => o.remove(); o.innerHTML = `<img src="${esc(p.image)}" alt="" style="max-width:92vw;max-height:86vh;border-radius:16px">`; document.body.appendChild(o);
}
(function () {
  const en = enterPortal;
  enterPortal = async function () { await en(); await kbsLoad(); setInterval(() => { if (!document.hidden) kbsLoad(); }, 60000); };
})();
if (getKey()) { kbsLoad(); setInterval(() => { if (!document.hidden) kbsLoad(); }, 60000); }
