/* Community im Kunden-Konto: Feed, Suchen (Posts + Leute), Profile, Posten (Bild + Caption, max. 5 Hashtags), Liken, Beautys (= Follower) */
(function () {
    const API = '/.netlify/functions/social', TK = 'kb_acc_token', MAX_TAGS = 5, CAP_MAX = 600;
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const tok = () => { try { return localStorage.getItem(TK) || ''; } catch (_) { return ''; } };
    const A = () => window.KBAccount;
    const tx = (k) => (window.KBi18n && KBi18n.t) ? KBi18n.t(k) : k;

    // sec: feed | search | profile · scope: following | all · stype: posts | people
    const st = { sec: 'feed', scope: 'following', stype: 'posts', q: '', pid: null, feed: null, next: '', results: null, people: null, prof: null, stories: null, loading: false, err: '' };
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
    const av = (p, size = 40, ring = false) => { const a = `<span class="kbs-av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px">${esc((p.name || '?').trim().charAt(0).toUpperCase())}${p.avatar ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`; return ring ? `<span class="kbs-ring" style="--s:${size + 8}px">${a}</span>` : a; };
    const when = (iso) => { const m = Math.max(0, (Date.now() - new Date(iso)) / 60000); return m < 1 ? 'gerade eben' : m < 60 ? `vor ${Math.floor(m)} Min.` : m < 1440 ? `vor ${Math.floor(m / 60)} Std.` : new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' }); };
    const capHtml = (t) => esc(t).replace(/#([\p{L}\p{N}_]{1,30})/gu, '<a href="#" class="kbs-tag" data-tag="$1">#$1</a>');
    const note = (msg, ok) => { const e = root && root.querySelector('#kbs-note'); if (e) { e.textContent = msg || ''; e.className = 'kba-msg ' + (msg ? (ok ? 'ok' : 'err') : ''); } };

    function postCard(p) {
        const id = esc(p.id), cc = p.cc || 0;
        return `<article class="kbs-post" data-id="${id}">
            <header><a href="#" class="kbs-who" data-pid="${esc(p.author.pid)}">${av(p.author, 34, true)}<span class="kbs-wn"><b>${esc(p.author.name)}</b></span></a>
            ${!p.mine ? `<span class="kbs-hacts"><button class="kbs-ico kbs-rep" data-report="${id}" title="Beitrag melden" aria-label="Beitrag melden"><i class="far fa-flag"></i></button></span>` : ''}
            ${p.mine ? `<span class="kbs-hacts"><button class="kbs-ico kbs-ico-cm ${p.commentsOn ? '' : 'off'}" data-cmtoggle="${id}" data-on="${p.commentsOn ? 0 : 1}" title="${p.commentsOn ? 'Kommentare ausschalten' : 'Kommentare einschalten'}" aria-label="${p.commentsOn ? 'Kommentare ausschalten' : 'Kommentare einschalten'}"><i class="${p.commentsOn ? 'far fa-comment' : 'fas fa-comment-slash'}"></i></button><button class="kbs-ico" data-del="${id}" title="Post löschen" aria-label="Post löschen"><i class="far fa-trash-can"></i></button></span>` : ''}</header>
            <div class="kbs-media" data-dbl="${id}"><img class="kbs-img" src="${esc(p.image)}" alt="Beitrag von ${esc(p.author.name)}" loading="lazy" draggable="false"><i class="fas fa-heart kbs-pop"></i></div>
            <div class="kbs-bar"><button class="kbs-like ${p.liked ? 'on' : ''}" data-like="${id}" aria-pressed="${p.liked}" aria-label="Gefällt mir"><i class="${p.liked ? 'fas' : 'far'} fa-heart"></i> <span>${p.likes}</span></button>${p.commentsOn ? `<button class="kbs-like kbs-cmbtn" data-cm="${id}" aria-label="Kommentare"><i class="far fa-comment"></i> <span>${cc}</span></button>` : (p.mine ? '<span class="kbs-cmoff"><i class="fas fa-comment-slash"></i> Kommentare aus</span>' : '')}</div>
            ${p.caption ? `<p class="kbs-cap"><b>${esc(p.author.name)}</b> ${capHtml(p.caption)}</p>` : ''}
            ${p.commentsOn && cc > 0 ? `<button class="kbs-viewall" data-cm="${id}">Alle ${cc} Kommentare ansehen</button>` : ''}
            <div class="kbs-cmbox" data-box="${id}" hidden></div><small class="kbs-time">${when(p.createdAt)}</small></article>`;
    }
    function personRow(p) {
        return `<div class="kbs-person"><a href="#" class="kbs-who" data-pid="${esc(p.pid)}">${av(p, 48)}<span><b>${esc(p.name)}</b>${p.bio ? `<small>${esc(p.bio)}</small>` : ''}</span></a>
            <button class="kba-btn ${p.iFollow ? 'ghost' : ''} kbs-follow" data-follow="${esc(p.pid)}" data-on="${p.iFollow ? 0 : 1}">${p.iFollow ? 'Folge ich' : 'Beauty folgen'}</button></div>`;
    }

    // ───────────── Rendern ─────────────
    function render(r) {
        root = r;
        root.classList.add('kbs-mode');
        const me = (A() && A().getProfile && A().getProfile()) || {};
        const tab = (id, icon, label) => `<button class="${st.sec === id ? 'on' : ''}" data-sec="${id}" aria-label="${label}" title="${label}"><i class="${icon}"></i></button>`;
        root.innerHTML = `<div class="kbs-top"><span class="kbs-logo">Community</span><span class="kbs-topbtns"><button class="kbs-rf" id="kbs-rf" title="Aktualisieren" aria-label="Aktualisieren"><i class="fas fa-rotate"></i></button><button class="kbs-newtop" id="kbs-new2" title="Posten" aria-label="Posten"><i class="far fa-square-plus"></i></button></span></div>
        <div class="kba-msg" id="kbs-note"></div><div id="kbs-body"></div>
        <nav class="kbs-tabbar" aria-label="Community">${tab('feed', st.sec === 'feed' ? 'fas fa-house' : 'fas fa-house', 'Feed')}${tab('search', 'fas fa-magnifying-glass', 'Suchen')}<button class="kbs-plus" id="kbs-new" aria-label="Posten" title="Posten"><i class="far fa-square-plus"></i></button><button class="kbs-me ${st.sec === 'profile' && st.pid === 'me' ? 'on' : ''}" data-sec="profile" aria-label="Profil" title="Profil">${av(me, 28)}</button></nav>`;
        root.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { st.sec = b.dataset.sec; if (st.sec === 'profile') { st.pid = 'me'; st.prof = null; } render(root); window.scrollTo({ top: 0 }); });
        root.querySelector('#kbs-new').onclick = openComposer;
        root.querySelector('#kbs-new2').onclick = openComposer;
        root.querySelector('#kbs-rf').onclick = () => { st.feed = null; st.results = null; st.people = null; st.stories = null; if (st.sec === 'profile') st.prof = null; body(); };
        root.querySelector('#kbs-body').onclick = onClick;
        body();
    }

    // Instagram-„Stories“-Leiste: Beautys als Ring-Avatare (Tippen öffnet das Profil)
    async function drawStories() {
        const box = root && root.querySelector('#kbs-stories'); if (!box) return;
        if (!st.stories) { const r = await call('search', { type: 'people', q: '' }); st.stories = r.ok ? r.people : []; }
        const me = A().getProfile() || {};
        const list = st.stories.slice().sort((a, b) => (b.iFollow ? 1 : 0) - (a.iFollow ? 1 : 0)).slice(0, 24);
        const box2 = root.querySelector('#kbs-stories'); if (!box2) return;
        box2.innerHTML = `<button class="kbs-story kbs-story-me" id="kbs-story-new" aria-label="Posten">${av(me, 58)}<i class="fas fa-plus"></i><small>Du</small></button>`
            + list.map(p => `<a href="#" class="kbs-story kbs-who" data-pid="${esc(p.pid)}">${av(p, 58, true)}<small>${esc((p.name || '').split(' ')[0])}</small></a>`).join('');
        const nb = box2.querySelector('#kbs-story-new'); if (nb) nb.onclick = openComposer;
    }

    function body() {
        const box = root.querySelector('#kbs-body'); if (!box) return;
        if (st.sec === 'feed') {
            box.innerHTML = `<div class="kbs-stories" id="kbs-stories"></div><div class="kbs-seg"><button class="${st.scope === 'following' ? 'on' : ''}" data-scope="following">Meine Beautys</button><button class="${st.scope === 'all' ? 'on' : ''}" data-scope="all">Entdecken</button></div><div id="kbs-newbar"></div><div id="kbs-list"></div><div id="kbs-more"></div>`;
            drawStories();
            if (st.feed === null || st.feed.scope !== st.scope) loadFeed(true); else drawList(st.feed.posts, st.feed.next, 'feed');
        } else if (st.sec === 'search') {
            box.innerHTML = `<form class="kbs-search" id="kbs-sf"><input id="kbs-q" type="search" value="${esc(st.q)}" placeholder="${st.stype === 'posts' ? 'Posts oder #Hashtag suchen …' : 'Leute suchen …'}" autocomplete="off"><button class="kba-btn" type="submit" aria-label="Suchen"><i class="fas fa-magnifying-glass"></i></button></form>
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
        <section class="kbs-ph"><div class="kbs-ph-top">${av(p, 86, true)}
            <div class="kbs-stats3"><span><b>${p.postCount}</b>Beiträge</span><span><b>${p.beautys}</b>Beautys</span><span><b>${p.following}</b>Folge ich</span></div></div>
            <div class="kbs-ph-name">${esc(p.name)}</div>
            ${p.bio ? `<div class="kba-bio">${esc(p.bio)}</div>` : ''}${A().linksHtml(p.links) ? `<div class="kba-chips">${A().linksHtml(p.links)}</div>` : ''}
            <div class="kbs-actions">${p.isMe ? `<button class="kba-btn ghost" id="kbs-edit">Profil bearbeiten</button>`
                     : `<button class="kba-btn ${p.iFollow ? 'ghost' : ''} kbs-follow" data-follow="${esc(p.pid)}" data-on="${p.iFollow ? 0 : 1}">${p.iFollow ? 'Folge ich' : 'Beauty folgen'}</button>`}
              <button class="kba-btn ghost kbs-share" data-share="${esc(p.pid)}" data-name="${esc(p.name)}"><i class="fas fa-share-nodes"></i> Teilen</button></div></section>
        <div class="kbs-gridtab"><i class="fas fa-table-cells"></i></div>
        <div class="kbs-grid">${posts.map(x => `<button class="kbs-th" data-open="${esc(x.id)}" aria-label="Post öffnen"><img src="${esc(x.image)}" alt="" loading="lazy"><span><i class="fas fa-heart"></i> ${x.likes}</span></button>`).join('')}</div>
        ${posts.length ? '' : `<div class="kba-empty">${p.isMe ? 'Du hast noch nichts gepostet – tippe unten auf das Plus.' : 'Noch keine Posts.'}</div>`}
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
        if ((b = t('.kbs-media'))) {   // Doppeltipp aufs Bild = Herz
            const now = Date.now();
            if (now - (b._t || 0) < 320) {
                b._t = 0; const lk = b.closest('.kbs-post').querySelector('[data-like]'), pop = b.querySelector('.kbs-pop');
                if (pop) { pop.classList.remove('go'); void pop.offsetWidth; pop.classList.add('go'); }
                if (lk && !lk.classList.contains('on')) like(lk);
            } else b._t = now;
            return;
        }
        if ((b = t('[data-scope]'))) { st.scope = b.dataset.scope; st.feed = null; return body(); }
        if ((b = t('[data-stype]'))) { st.stype = b.dataset.stype; return body(); }
        if ((b = t('.kbs-tag'))) { e.preventDefault(); st.sec = 'search'; st.stype = 'posts'; st.q = '#' + b.dataset.tag; closeModal(); render(root); return runSearch(); }
        if ((b = t('.kbs-who'))) { e.preventDefault(); const from = st.sec; st.prof = { pendingFrom: from === 'profile' ? null : from }; st.sec = 'profile'; st.pid = b.dataset.pid; closeModal(); render(root); return; }
        if ((b = t('[data-back]'))) { st.sec = (st.prof && st.prof.from) || 'feed'; st.prof = null; return render(root); }
        if ((b = t('[data-share]'))) return share(b.dataset.share, b.dataset.name);
        if ((b = t('[data-apply]'))) { st.feed.posts = st.pending; st.feed.next = st.pendingNext; st.pending = null; return drawList(st.feed.posts, st.feed.next, 'feed'), (root.querySelector('#kbs-newbar').innerHTML = ''); }
        if ((b = t('[data-follow]'))) return follow(b);
        if ((b = t('[data-like]'))) return like(b);
        if ((b = t('[data-cmsend]'))) return sendComment(b);
        if ((b = t('[data-cmdel]'))) return delComment(b);
        if ((b = t('[data-cmtoggle]'))) return toggleSwitch(b);
        if ((b = t('[data-cm]'))) return toggleComments(b);
        if ((b = t('[data-report]'))) return report(b.dataset.report);
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
    async function report(id) {
        if (!confirm(tx('Diesen Beitrag wegen unpassender Inhalte melden?'))) return;
        const r = await call('report', { id }); if (!r.ok) return note(r.message);
        note(r.already ? 'Du hast diesen Beitrag schon gemeldet.' : 'Danke – wir schauen uns den Beitrag an.', true);
    }
    async function del(id) {
        if (!confirm(tx('Diesen Post endgültig löschen?'))) return;
        const r = await call('post_delete', { id }); if (!r.ok) return note(r.message);
        closeModal();
        [st.feed, st.results].forEach(o => { if (o) o.posts = o.posts.filter(p => p.id !== id); });
        if (st.prof) { st.prof.posts = st.prof.posts.filter(p => p.id !== id); if (st.prof.profile.isMe) st.prof.profile.postCount = Math.max(0, st.prof.profile.postCount - 1); }
        body();
    }

    // ───────────── Kommentare ─────────────
    const cmRow = (c, id) => `<div class="kbs-cm" data-cid="${esc(c.cid)}">${av(c.author, 30)}<div class="kbs-cmb"><a href="#" class="kbs-who" data-pid="${esc(c.author.pid)}"><b>${esc(c.author.name)}</b></a> <span class="kbs-cmt">${esc(c.text)}</span><small>${when(c.at)}</small></div>${c.canDelete ? `<button class="kbs-ico" data-cmdel="${esc(id)}" data-cid="${esc(c.cid)}" title="Kommentar löschen" aria-label="Kommentar löschen"><i class="far fa-trash-can"></i></button>` : ''}</div>`;
    const boxes = (id) => document.querySelectorAll(`[data-box="${id}"]`);
    function drawComments(id, r) {
        boxes(id).forEach(box => {
            const keep = box.querySelector('.kbs-cmin') ? box.querySelector('.kbs-cmin').value : '';
            box.innerHTML = `<div class="kbs-cmlist">${r.comments.length ? r.comments.map(c => cmRow(c, id)).join('') : '<div class="kba-empty" style="padding:.4rem 0">Noch keine Kommentare.</div>'}</div>
                <div class="kbs-cmform"><input class="kbs-cmin" maxlength="300" placeholder="Kommentar schreiben …" autocomplete="off" value="${esc(keep)}"><button class="kba-btn kbs-cmsend" data-cmsend="${esc(id)}" aria-label="Senden"><i class="fas fa-paper-plane"></i></button></div><div class="kba-msg kbs-cmnote"></div>`;
        });
        document.querySelectorAll(`[data-cm="${id}"] span`).forEach(x => x.textContent = r.comments.length);
        document.querySelectorAll(`.kbs-viewall[data-cm="${id}"]`).forEach(x => x.textContent = `Alle ${r.comments.length} Kommentare ansehen`);
        patchPost(id, p => { p.cc = r.comments.length; });
    }
    async function toggleComments(btn) {
        const id = btn.dataset.cm, box = btn.closest('.kbs-post').querySelector('.kbs-cmbox');
        if (!box.hidden) { box.hidden = true; return; }
        box.hidden = false; box.innerHTML = '<div class="kba-empty">Lade …</div>';
        const r = await call('comments', { id });
        if (!r.ok) { box.hidden = true; return note(r.message); }
        drawComments(id, r);
    }
    async function sendComment(btn) {
        const id = btn.dataset.cmsend, box = btn.closest('.kbs-cmbox'), inp = box.querySelector('.kbs-cmin'), nt = box.querySelector('.kbs-cmnote');
        const t = inp.value.trim(); if (!t) return;
        btn.disabled = true;
        const r = await call('comment_add', { id, text: t });
        btn.disabled = false;
        if (!r.ok) { nt.className = 'kba-msg err'; nt.textContent = r.message || 'Das hat leider nicht geklappt.'; return; }
        inp.value = ''; drawComments(id, r);
    }
    async function delComment(btn) {
        if (!confirm(tx('Diesen Kommentar löschen?'))) return;
        const id = btn.dataset.cmdel, r = await call('comment_delete', { id, cid: btn.dataset.cid });
        if (!r.ok) return note(r.message);
        const f = await call('comments', { id }); if (f.ok) drawComments(id, f);
    }
    async function toggleSwitch(btn) {
        const id = btn.dataset.cmtoggle, on = btn.dataset.on === '1';
        const r = await call('comments_toggle', { id, on });
        if (!r.ok) return note(r.message);
        patchPost(id, p => { p.commentsOn = r.commentsOn; });
        document.querySelectorAll(`.kbs-post[data-id="${id}"]`).forEach(a => { const p = [st.feed && st.feed.posts, st.results && st.results.posts, st.prof && st.prof.posts].flat().find(x => x && x.id === id); if (p) a.outerHTML = postCard(p); });
        note(r.commentsOn ? 'Kommentare sind jetzt eingeschaltet.' : 'Kommentare sind jetzt ausgeschaltet.', true);
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('kbs-cmin')) { e.preventDefault(); const b = e.target.closest('.kbs-cmbox').querySelector('.kbs-cmsend'); if (b) sendComment(b); }
    });

    // ───────────── Profil teilen (Link /?profile=<id>) ─────────────
    async function share(pid, name) {
        const url = `${location.origin}/?profile=${pid}`;
        try { if (navigator.share) { await navigator.share({ title: `${name} bei Kristina Beauty`, text: `Schau dir das Profil von ${name} bei Kristina Beauty an:`, url }); return; } }
        catch (e) { if (e && e.name === 'AbortError') return; }
        try { await navigator.clipboard.writeText(url); note('Profil-Link kopiert ✓ – du kannst ihn jetzt einfügen und senden.', true); }
        catch (_) { prompt(tx('Profil-Link zum Kopieren:'), url); }
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
            <label class="kbs-switch"><input type="checkbox" id="kbs-cmon" checked><span class="kbs-sw"></span><span>Kommentare erlauben</span></label>
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
            const r = await call('post_create', { image: data, caption: cap.value.trim(), comments: o.querySelector('#kbs-cmon').checked });
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
        invalidate: () => { st.stories = null; st.feed = null; st.results = null; st.people = null; st.prof = null; st.pending = null; }   // nach Profiländerung neu laden
    };
})();
