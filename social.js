/* Community im Kunden-Konto: Feed, Suchen (Posts + Leute), Profile, Posten (Bild + Caption, max. 5 Hashtags), Liken, Beautys (= Follower) */
(function () {
    const API = '/.netlify/functions/social', TK = 'kb_acc_token', MAX_TAGS = 5, CAP_MAX = 600;
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const tok = () => { try { return localStorage.getItem(TK) || ''; } catch (_) { return ''; } };
    const A = () => window.KBAccount;

    // sec: feed | search | profile · scope: following | all · stype: posts | people
    const st = { sec: 'feed', scope: 'following', stype: 'posts', q: '', pid: null, feed: null, next: '', results: null, people: null, prof: null, loading: false, err: '' };
    let root = null;

    async function call(action, data = {}) {
        try {
            const r = await fetch(API, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok() }, body: JSON.stringify({ action, ...data }) });
            const j = await r.json().catch(() => ({}));
            if (r.status === 401) { A().expire(); return { ok: false, message: 'Bitte melde dich neu an.' }; }
            return { ok: r.ok && j.success !== false, ...j };
        } catch (_) { return { ok: false, message: 'Keine Verbindung. Bitte versuche es gleich nochmal.' }; }
    }

    // ───────────── Bausteine ─────────────
    const av = (p, size = 40) => `<span class="kbs-av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px">${esc((p.name || '?').trim().charAt(0).toUpperCase())}${p.avatar ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
    const when = (iso) => { const m = Math.max(0, (Date.now() - new Date(iso)) / 60000); return m < 1 ? 'gerade eben' : m < 60 ? `vor ${Math.floor(m)} Min.` : m < 1440 ? `vor ${Math.floor(m / 60)} Std.` : new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }); };
    const capHtml = (t) => esc(t).replace(/#([\p{L}\p{N}_]{1,30})/gu, '<a href="#" class="kbs-tag" data-tag="$1">#$1</a>');
    const note = (msg, ok) => { const e = root && root.querySelector('#kbs-note'); if (e) { e.textContent = msg || ''; e.className = 'kba-msg ' + (msg ? (ok ? 'ok' : 'err') : ''); } };

    function postCard(p) {
        return `<article class="kbs-post" data-id="${esc(p.id)}">
            <header><a href="#" class="kbs-who" data-pid="${esc(p.author.pid)}">${av(p.author)}<b>${esc(p.author.name)}</b></a><small>${when(p.createdAt)}</small>
            ${p.mine ? `<button class="kbs-ico" data-del="${esc(p.id)}" title="Post löschen" aria-label="Post löschen"><i class="far fa-trash-can"></i></button>` : ''}</header>
            <img class="kbs-img" src="${esc(p.image)}" alt="Beitrag von ${esc(p.author.name)}" loading="lazy">
            <div class="kbs-bar"><button class="kbs-like ${p.liked ? 'on' : ''}" data-like="${esc(p.id)}" aria-pressed="${p.liked}" aria-label="Gefällt mir"><i class="${p.liked ? 'fas' : 'far'} fa-heart"></i> <span>${p.likes}</span></button></div>
            ${p.caption ? `<p class="kbs-cap"><b>${esc(p.author.name)}</b> ${capHtml(p.caption)}</p>` : ''}</article>`;
    }
    function personRow(p) {
        return `<div class="kbs-person"><a href="#" class="kbs-who" data-pid="${esc(p.pid)}">${av(p, 48)}<span><b>${esc(p.name)}</b>${p.bio ? `<small>${esc(p.bio)}</small>` : ''}</span></a>
            <button class="kba-btn ${p.iFollow ? 'ghost' : ''} kbs-follow" data-follow="${esc(p.pid)}" data-on="${p.iFollow ? 0 : 1}">${p.iFollow ? 'Folge ich' : 'Beauty folgen'}</button></div>`;
    }

    // ───────────── Rendern ─────────────
    function render(r) {
        root = r;
        const sec = (id, icon, label) => `<button class="${st.sec === id ? 'on' : ''}" data-sec="${id}"><i class="${icon}"></i> ${label}</button>`;
        root.innerHTML = `<h1>Community</h1><p class="kba-sub">Zeig deine Looks, entdecke andere Beautys und teile deine Favoriten.</p>${A().tabsHtml('community')}
        <div class="kbs-nav">${sec('feed', 'fas fa-house', 'Feed')}${sec('search', 'fas fa-magnifying-glass', 'Suchen')}${sec('profile', 'far fa-user', 'Profil')}
            <button class="kbs-new" id="kbs-new"><i class="fas fa-plus"></i> Posten</button><button class="kbs-rf" id="kbs-rf" title="Aktualisieren" aria-label="Aktualisieren"><i class="fas fa-rotate"></i></button></div>
        <div class="kba-msg" id="kbs-note"></div><div id="kbs-body"></div>`;
        A().bindTabs(root);
        root.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { st.sec = b.dataset.sec; if (st.sec === 'profile') st.pid = 'me'; render(root); });
        root.querySelector('#kbs-new').onclick = openComposer;
        root.querySelector('#kbs-rf').onclick = () => { st.feed = null; st.results = null; st.people = null; if (st.sec === 'profile') st.prof = null; body(); };
        root.querySelector('#kbs-body').onclick = onClick;
        body();
    }

    function body() {
        const box = root.querySelector('#kbs-body'); if (!box) return;
        if (st.sec === 'feed') {
            box.innerHTML = `<div class="kbs-seg"><button class="${st.scope === 'following' ? 'on' : ''}" data-scope="following">Meine Beautys</button><button class="${st.scope === 'all' ? 'on' : ''}" data-scope="all">Entdecken</button></div><div id="kbs-newbar"></div><div id="kbs-list"></div><div id="kbs-more"></div>`;
            if (st.feed === null || st.feed.scope !== st.scope) loadFeed(true); else drawList(st.feed.posts, st.feed.next, 'feed');
        } else if (st.sec === 'search') {
            box.innerHTML = `<form class="kbs-search" id="kbs-sf"><input id="kbs-q" type="search" value="${esc(st.q)}" placeholder="${st.stype === 'posts' ? 'Posts oder #Hashtag suchen …' : 'Leute suchen …'}" autocomplete="off"><button class="kba-btn" type="submit"><i class="fas fa-magnifying-glass"></i></button></form>
              <div class="kbs-seg"><button class="${st.stype === 'posts' ? 'on' : ''}" data-stype="posts">Posts</button><button class="${st.stype === 'people' ? 'on' : ''}" data-stype="people">Leute</button></div><div id="kbs-list"></div><div id="kbs-more"></div>`;
            root.querySelector('#kbs-sf').onsubmit = (e) => { e.preventDefault(); st.q = root.querySelector('#kbs-q').value.trim(); runSearch(); };
            if (st.stype === 'people' && st.people === null) runSearch(); else if (st.stype === 'posts' && st.results) drawList(st.results.posts, st.results.next, 'search');
            else if (st.stype === 'people') drawPeople(); else root.querySelector('#kbs-list').innerHTML = '<div class="kba-empty">Suche nach Wörtern in Beschreibungen oder nach einem #Hashtag.</div>';
        } else drawProfile();
    }

    function drawList(posts, next, kind) {
        const l = root.querySelector('#kbs-list'), m = root.querySelector('#kbs-more'); if (!l) return;
        l.innerHTML = posts.length ? posts.map(postCard).join('') : (kind === 'feed' && st.scope === 'following'
            ? '<div class="kba-empty">Hier erscheinen die Posts deiner Beautys und deine eigenen.<br>Folge Leuten über „Suchen“ → „Leute“ oder schau bei „Entdecken“ vorbei.</div>'
            : '<div class="kba-empty">Nichts gefunden.</div>');
        m.innerHTML = next ? `<button class="kba-btn ghost" data-more="${kind}" style="display:block;margin:1rem auto 0">Mehr laden</button>` : '';
    }
    function drawPeople() {
        const l = root.querySelector('#kbs-list'); if (!l) return;
        l.innerHTML = st.people && st.people.length ? st.people.map(personRow).join('') : '<div class="kba-empty">Keine Personen gefunden.</div>';
    }
    function drawProfile() {
        const box = root.querySelector('#kbs-body');
        if (!st.prof || st.prof.pid !== st.pid) { box.innerHTML = '<div class="kba-empty">Lade …</div>'; return loadProfile(); }
        const p = st.prof.profile, posts = st.prof.posts;
        box.innerHTML = `${st.pid !== 'me' && st.prof.from ? `<button class="kba-link" data-back="1">← Zurück</button>` : ''}
        <div class="kba-card"><div class="kba-head">${av(p, 92)}<div style="flex:1;min-width:200px"><h2>${esc(p.name)}</h2>
            <div class="kbs-stats"><span><b>${p.postCount}</b> Posts</span><span><b>${p.beautys}</b> Beautys</span><span>folgt <b>${p.following}</b></span></div>
            ${p.bio ? `<div class="kba-bio">${esc(p.bio)}</div>` : ''}${A().linksHtml(p.links) ? `<div class="kba-chips">${A().linksHtml(p.links)}</div>` : ''}
            <div class="kbs-actions">${p.isMe ? `<button class="kba-btn" id="kbs-edit">Profil bearbeiten</button>`
                     : `<button class="kba-btn ${p.iFollow ? 'ghost' : ''} kbs-follow" data-follow="${esc(p.pid)}" data-on="${p.iFollow ? 0 : 1}">${p.iFollow ? 'Folge ich' : 'Beauty folgen'}</button>`}
              <button class="kba-btn ghost kbs-share" data-share="${esc(p.pid)}" data-name="${esc(p.name)}"><i class="fas fa-share-nodes"></i> Teilen</button></div></div></div></div>
        <div class="kbs-grid">${posts.map(x => `<button class="kbs-th" data-open="${esc(x.id)}" aria-label="Post öffnen"><img src="${esc(x.image)}" alt="" loading="lazy"><span><i class="fas fa-heart"></i> ${x.likes}</span></button>`).join('')}</div>
        ${posts.length ? '' : `<div class="kba-empty">${p.isMe ? 'Du hast noch nichts gepostet – tippe oben auf „Posten“.' : 'Noch keine Posts.'}</div>`}
        <div id="kbs-more">${st.prof.next ? '<button class="kba-btn ghost" data-more="profile" style="display:block;margin:1rem auto 0">Mehr laden</button>' : ''}</div>`;
        const ed = box.querySelector('#kbs-edit'); if (ed) ed.onclick = () => A().edit();
    }

    // ───────────── Laden ─────────────
    async function loadFeed(reset) {
        const before = reset ? '' : st.feed.next, r = await call('feed', { scope: st.scope, before });
        if (!r.ok) return note(r.message);
        note('');
        st.feed = { scope: st.scope, posts: reset ? r.posts : st.feed.posts.concat(r.posts), next: r.next };
        if (st.sec === 'feed') drawList(st.feed.posts, st.feed.next, 'feed');
    }
    async function runSearch(more) {
        const l = root.querySelector('#kbs-list'); if (!l) return;
        if (st.stype === 'people') {
            const r = await call('search', { type: 'people', q: st.q }); if (!r.ok) return note(r.message);
            note(''); st.people = r.people; return drawPeople();
        }
        if (st.q.replace(/^#/, '').length < 2) { st.results = null; return body(); }
        if (!more) l.innerHTML = '<div class="kba-empty">Suche …</div>';
        const r = await call('search', { type: 'posts', q: st.q }); if (!r.ok) return note(r.message);
        note(''); st.results = { posts: r.posts, next: r.next }; drawList(r.posts, '', 'search');
    }
    async function loadProfile(more) {
        const pid = st.pid, r = await call('profile', { pid, before: more ? st.prof.next : '' });
        if (!r.ok) { st.sec = 'feed'; render(root); return note(r.message); }
        note('');
        st.prof = more ? { ...st.prof, posts: st.prof.posts.concat(r.posts), next: r.next } : { pid, profile: r.profile, posts: r.posts, next: r.next, from: st.prof && st.prof.pendingFrom };
        if (st.sec === 'profile') drawProfile();
    }

    // ───────────── Klicks ─────────────
    async function onClick(e) {
        const t = (sel) => e.target.closest(sel);
        let b;
        if ((b = t('[data-scope]'))) { st.scope = b.dataset.scope; st.feed = null; return body(); }
        if ((b = t('[data-stype]'))) { st.stype = b.dataset.stype; return body(); }
        if ((b = t('.kbs-tag'))) { e.preventDefault(); st.sec = 'search'; st.stype = 'posts'; st.q = '#' + b.dataset.tag; closeModal(); render(root); return runSearch(); }
        if ((b = t('.kbs-who'))) { e.preventDefault(); const from = st.sec; st.prof = { pendingFrom: from === 'profile' ? null : from }; st.sec = 'profile'; st.pid = b.dataset.pid; closeModal(); render(root); return; }
        if ((b = t('[data-back]'))) { st.sec = (st.prof && st.prof.from) || 'feed'; st.prof = null; return render(root); }
        if ((b = t('[data-share]'))) return share(b.dataset.share, b.dataset.name);
        if ((b = t('[data-apply]'))) { st.feed.posts = st.pending; st.feed.next = st.pendingNext; st.pending = null; return drawList(st.feed.posts, st.feed.next, 'feed'), (root.querySelector('#kbs-newbar').innerHTML = ''); }
        if ((b = t('[data-follow]'))) return follow(b);
        if ((b = t('[data-like]'))) return like(b);
        if ((b = t('[data-del]'))) return del(b.dataset.del);
        if ((b = t('[data-open]'))) { const p = st.prof.posts.find(x => x.id === b.dataset.open); if (p) openModal(postCard(p)); return; }
        if ((b = t('[data-more]'))) {
            b.disabled = true;
            if (b.dataset.more === 'feed') return loadFeed(false);
            if (b.dataset.more === 'profile') return loadProfile(true);
        }
    }

    async function follow(btn) {
        btn.disabled = true;
        const r = await call('follow', { pid: btn.dataset.follow, on: btn.dataset.on === '1' });
        btn.disabled = false;
        if (!r.ok) return note(r.message);
        note('');
        if (st.prof && st.prof.profile && st.prof.profile.pid === btn.dataset.follow) { st.prof.profile.iFollow = r.iFollow; st.prof.profile.beautys = r.beautys; }
        (st.people || []).forEach(p => { if (p.pid === btn.dataset.follow) p.iFollow = r.iFollow; });
        st.feed = null;   // Feed „Meine Beautys“ neu laden
        if (st.sec === 'profile') drawProfile(); else if (st.sec === 'search') drawPeople();
    }
    function patchPost(id, fn) {
        [st.feed && st.feed.posts, st.results && st.results.posts, st.prof && st.prof.posts].forEach(a => (a || []).forEach(p => { if (p.id === id) fn(p); }));
    }
    async function like(btn) {
        const id = btn.dataset.like, on = !btn.classList.contains('on');
        const paint = (liked, n) => document.querySelectorAll(`[data-like="${id}"]`).forEach(x => { x.classList.toggle('on', liked); x.setAttribute('aria-pressed', liked); x.querySelector('i').className = (liked ? 'fas' : 'far') + ' fa-heart'; x.querySelector('span').textContent = n; });
        const cur = +btn.querySelector('span').textContent; paint(on, cur + (on ? 1 : -1));
        const r = await call('like', { id, on });
        if (!r.ok) { paint(!on, cur); return note(r.message); }
        paint(r.liked, r.likes); patchPost(id, p => { p.liked = r.liked; p.likes = r.likes; });
    }
    async function del(id) {
        if (!confirm('Diesen Post endgültig löschen?')) return;
        const r = await call('post_delete', { id }); if (!r.ok) return note(r.message);
        closeModal();
        [st.feed, st.results].forEach(o => { if (o) o.posts = o.posts.filter(p => p.id !== id); });
        if (st.prof) { st.prof.posts = st.prof.posts.filter(p => p.id !== id); if (st.prof.profile.isMe) st.prof.profile.postCount = Math.max(0, st.prof.profile.postCount - 1); }
        body();
    }

    // ───────────── Profil teilen (Link /?profile=<id>) ─────────────
    async function share(pid, name) {
        const url = `${location.origin}/?profile=${pid}`;
        try { if (navigator.share) { await navigator.share({ title: `${name} bei Kristina Beauty`, text: `Schau dir das Profil von ${name} bei Kristina Beauty an:`, url }); return; } }
        catch (e) { if (e && e.name === 'AbortError') return; }
        try { await navigator.clipboard.writeText(url); note('Profil-Link kopiert ✓ – du kannst ihn jetzt einfügen und senden.', true); }
        catch (_) { prompt('Profil-Link zum Kopieren:', url); }
    }

    // ───────────── Live-Sync: Feed, Likes, Profile alle 20 s (und beim Zurückkommen zur App) ─────────────
    const sig = (posts) => posts.map(p => p.id + ':' + p.likes + ':' + (p.liked ? 1 : 0)).join('|');
    const ids = (posts) => posts.map(p => p.id).join('|');
    function merge(old, r) {
        if (!r.next) return { posts: r.posts, next: '' };
        const last = r.posts[r.posts.length - 1].id, tail = old.posts.filter(p => p.id < last);
        return { posts: r.posts.concat(tail), next: tail.length ? old.next : r.next };
    }
    function patchLikes(posts) {
        posts.forEach(p => document.querySelectorAll(`[data-like="${p.id}"]`).forEach(x => { x.classList.toggle('on', p.liked); x.setAttribute('aria-pressed', p.liked); x.querySelector('i').className = (p.liked ? 'fas' : 'far') + ' fa-heart'; x.querySelector('span').textContent = p.likes; }));
    }
    let ticking = false;
    async function tick() {
        if (ticking || document.hidden || !root || !document.body.contains(root) || document.getElementById('kbs-modal') || document.getElementById('kba-editor')) return;
        const page = root.closest('.page-section'); if (page && !page.classList.contains('active')) return;   // Seite nicht sichtbar
        if (!A() || A().getView() !== 'community') return;
        ticking = true;
        try {
            if (st.sec === 'feed' && st.feed) {
                const r = await call('feed', { scope: st.scope }); if (!r.ok || st.sec !== 'feed' || !st.feed) return;
                const base = st.pending ? { posts: st.pending, next: st.pendingNext } : st.feed, m = merge(base, r);
                if (ids(m.posts) === ids(st.feed.posts)) { if (sig(m.posts) !== sig(st.feed.posts)) { st.feed.posts = m.posts; patchLikes(m.posts); } st.pending = null; const nb = root.querySelector('#kbs-newbar'); if (nb) nb.innerHTML = ''; return; }
                const topChanged = m.posts[0] && (!st.feed.posts[0] || m.posts[0].id !== st.feed.posts[0].id);
                if (topChanged && window.scrollY > 250) {   // nicht mitten im Lesen springen → Hinweis anzeigen
                    st.pending = m.posts; st.pendingNext = m.next;
                    const n = m.posts.filter(p => !st.feed.posts.some(o => o.id === p.id)).length;
                    const nb = root.querySelector('#kbs-newbar'); if (nb) nb.innerHTML = `<button class="kbs-banner" data-apply="1"><i class="fas fa-arrow-up"></i> ${n || 'Neue'} ${n === 1 ? 'neuer Beitrag' : 'neue Beiträge'}</button>`;
                } else { st.feed.posts = m.posts; st.feed.next = m.next; st.pending = null; drawList(m.posts, m.next, 'feed'); }
            } else if (st.sec === 'profile' && st.prof && st.prof.profile) {
                const r = await call('profile', { pid: st.pid }); if (!r.ok || st.sec !== 'profile' || !st.prof || !st.prof.profile) return;
                const m = merge(st.prof, r), a = st.prof.profile, b = r.profile;
                const same = ids(m.posts) === ids(st.prof.posts) && a.beautys === b.beautys && a.following === b.following && a.postCount === b.postCount && a.iFollow === b.iFollow && a.bio === b.bio && a.name === b.name && a.avatar === b.avatar && JSON.stringify(a.links) === JSON.stringify(b.links);
                st.prof.profile = b; st.prof.posts = m.posts; st.prof.next = m.next;
                if (!same) drawProfile(); else patchLikes(m.posts);
            }
        } finally { ticking = false; }
    }
    setInterval(tick, 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    window.addEventListener('focus', tick);

    // ───────────── Overlay (Post ansehen / Posten) ─────────────
    function openModal(html) {
        closeModal();
        const o = document.createElement('div'); o.className = 'kbs-modal'; o.id = 'kbs-modal';
        o.innerHTML = `<div class="kbs-sheet"><button class="kbs-x" aria-label="Schließen">&times;</button>${html}</div>`;
        o.onclick = (e) => { if (e.target === o || e.target.closest('.kbs-x')) closeModal(); else onClick(e); };
        document.body.appendChild(o); document.body.style.overflow = 'hidden';
        return o;
    }
    function closeModal() { const o = document.getElementById('kbs-modal'); if (o) o.remove(); document.body.style.overflow = ''; }

    function shrink(file) {   // Bild verkleinern (max. 1080 px) → JPEG, passend zur Server-Grenze
        return new Promise((resolve, reject) => {
            const img = new Image(), url = URL.createObjectURL(file);
            img.onload = () => {
                URL.revokeObjectURL(url);
                for (const [max, q] of [[1080, .82], [1080, .68], [900, .6], [720, .55]]) {
                    const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
                    c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
                    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
                    const d = c.toDataURL('image/jpeg', q); if (d.length < 640000) return resolve(d);
                }
                reject(new Error('Bild ist zu groß.'));
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Das Bild konnte nicht gelesen werden.')); };
            img.src = url;
        });
    }

    function openComposer() {
        let data = '';
        const o = openModal(`<h2 style="margin:0 0 .8rem;font-family:'Playfair Display',serif;font-weight:500">Neuer Post</h2>
            <label class="kbs-drop" for="kbs-file" id="kbs-drop"><i class="far fa-image"></i><span>Foto auswählen</span></label><input type="file" id="kbs-file" accept="image/*" hidden>
            <label for="kbs-cap" style="display:block;margin:.9rem 0 .3rem;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#777">Beschreibung</label>
            <textarea id="kbs-cap" maxlength="${CAP_MAX}" placeholder="Schreib etwas dazu … mit #Hashtags (max. ${MAX_TAGS})"></textarea>
            <div class="kbs-count"><span id="kbs-tc">0/${MAX_TAGS} Hashtags</span><span id="kbs-cc">0/${CAP_MAX}</span></div>
            <div class="kba-msg" id="kbs-cn"></div><button class="kba-btn" id="kbs-go" style="width:100%" disabled>Posten</button>`);
        const cap = o.querySelector('#kbs-cap'), go = o.querySelector('#kbs-go'), cn = o.querySelector('#kbs-cn');
        const tags = () => (cap.value.match(/#[\p{L}\p{N}_]{1,30}/gu) || []).length;
        const upd = () => { const n = tags(), tc = o.querySelector('#kbs-tc'); tc.textContent = `${n}/${MAX_TAGS} Hashtags`; tc.style.color = n > MAX_TAGS ? '#b4433a' : ''; o.querySelector('#kbs-cc').textContent = `${cap.value.length}/${CAP_MAX}`; go.disabled = !data || n > MAX_TAGS; };
        cap.oninput = upd;
        o.querySelector('#kbs-file').onchange = async (e) => {
            const f = e.target.files[0]; if (!f) return;
            try { data = await shrink(f); o.querySelector('#kbs-drop').innerHTML = `<img src="${data}" alt="Vorschau">`; cn.className = 'kba-msg'; } catch (err) { data = ''; cn.className = 'kba-msg err'; cn.textContent = err.message; }
            upd();
        };
        go.onclick = async () => {
            go.disabled = true; go.textContent = 'Wird gepostet …';
            const r = await call('post_create', { image: data, caption: cap.value.trim() });
            if (!r.ok) { go.textContent = 'Posten'; upd(); cn.className = 'kba-msg err'; cn.textContent = r.message || 'Das hat leider nicht geklappt.'; return; }
            closeModal(); st.feed = null; st.prof = null;
            if (st.sec === 'search') st.sec = 'feed';
            if (st.sec === 'feed') st.scope = 'following';
            render(root);
        };
    }

    window.KBSocial = {
        render,
        show: (pid) => { st.sec = 'profile'; st.pid = pid; st.prof = null; },     // geteilter Profil-Link
        invalidate: () => { st.feed = null; st.results = null; st.people = null; st.prof = null; st.pending = null; }   // nach Profiländerung neu laden
    };
})();
