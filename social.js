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
    const isIn = () => !!(A() && A().getProfile && A().getProfile());
    // Gast tippt auf Liken/Kommentieren/Posten/Folgen → freundliche Aufforderung zur Anmeldung
    function needLogin() {
        openModal(`<div class="kbs-gate"><div class="kbs-gate-ic"><i class="far fa-heart"></i></div><h3>Mach mit in der Community</h3><p>Ansehen kannst du alles auch ohne Konto. Zum Posten, Liken und Kommentieren melde dich bitte kurz an.</p><button class="kba-btn" data-gate="login">Anmelden</button><button class="kba-btn ghost" data-gate="register">Registrieren</button></div>`);
    }

    async function call(action, data = {}) {
        try {
            const r = await fetch(API, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(tok() ? { Authorization: 'Bearer ' + tok() } : {}) }, body: JSON.stringify({ action, ...data }) });
            const j = await r.json().catch(() => ({}));
            if (r.status === 401) { if (tok()) { A().expire(); return { ok: false, message: 'Bitte melde dich neu an.' }; } return { ok: false, login: true, message: 'Bitte melde dich an.' }; }
            return { ok: r.ok && j.success !== false, ...j };
        } catch (_) { return { ok: false, message: 'Keine Verbindung. Bitte versuche es gleich nochmal.' }; }
    }

    // ───────────── Bausteine ─────────────
    const av = (p, size = 40, ring = false) => { const a = `<span class="kbs-av" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .42)}px">${esc((p.name || '?').trim().charAt(0).toUpperCase())}${p.avatar ? `<img src="${esc(p.avatar)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`; return ring ? `<span class="kbs-ring" style="--s:${size + 8}px">${a}</span>` : a; };
    const when = (iso) => { const m = Math.max(0, (Date.now() - new Date(iso)) / 60000); return m < 1 ? 'gerade eben' : m < 60 ? `vor ${Math.floor(m)} Min.` : m < 1440 ? `vor ${Math.floor(m / 60)} Std.` : new Date(iso).toLocaleDateString((({ en: 'en-GB', ru: 'ru-RU' })[window.KBi18n && KBi18n.lang] || 'de-DE'), { day: '2-digit', month: '2-digit', year: '2-digit' }); };
    const capHtml = (t) => esc(t).replace(/#([\p{L}\p{N}_]{1,30})/gu, '<a href="#" class="kbs-tag" data-tag="$1">#$1</a>');
    const note = (msg, ok) => { const e = root && root.querySelector('#kbs-note'); if (e) { e.textContent = msg || ''; e.className = 'kba-msg ' + (msg ? (ok ? 'ok' : 'err') : ''); } };

    // ───────────── Preisliste (Quelle: fullPriceListData in index.html) ─────────────
    const priceCats = () => { try { return (typeof fullPriceListData !== 'undefined' && Array.isArray(fullPriceListData)) ? fullPriceListData : []; } catch (_) { return []; } };
    const nkey = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
    function priceOf(name) {
        const k = nkey(name); if (!k) return null;
        for (const c of priceCats()) for (const it of c.items || []) if (nkey(it.name) === k) return it;
        return null;
    }

    function postCard(p) {
        const id = esc(p.id), cc = p.cc || 0, m = p.music, v = p.video;
        const mAttr = m ? ` data-msrc="${esc(m.preview)}" data-mstart="${+m.start || 0}" data-mtitle="${esc(m.title)}"` : '';
        const trs = (Array.isArray(p.treatments) && p.treatments.length) ? p.treatments : (p.treatment ? [p.treatment] : []);
        return `<article class="kbs-post" data-id="${id}">
            <header><a href="#" class="kbs-who" data-pid="${esc(p.author.pid)}">${av(p.author, 34, true)}<span class="kbs-wn"><b>${esc(p.author.name)}</b></span></a>
            ${!p.mine ? `<span class="kbs-hacts"><button class="kbs-ico kbs-rep" data-report="${id}" title="Beitrag melden" aria-label="Beitrag melden"><i class="far fa-flag"></i></button></span>` : ''}
            ${p.mine ? `<span class="kbs-hacts"><button class="kbs-ico kbs-ico-cm ${p.commentsOn ? '' : 'off'}" data-cmtoggle="${id}" data-on="${p.commentsOn ? 0 : 1}" title="${p.commentsOn ? 'Kommentare ausschalten' : 'Kommentare einschalten'}" aria-label="${p.commentsOn ? 'Kommentare ausschalten' : 'Kommentare einschalten'}"><i class="${p.commentsOn ? 'far fa-comment' : 'fas fa-comment-slash'}"></i></button><button class="kbs-ico" data-del="${id}" title="Post löschen" aria-label="Post löschen"><i class="far fa-trash-can"></i></button></span>` : ''}</header>
            <div class="kbs-media${(m || v) ? ' kbs-hasmu' : ''}" data-dbl="${id}"${mAttr}${v ? ' data-vid="1"' : ''}>${v ? `<video class="kbs-img kbs-vid" src="${esc(v.url)}" poster="${esc(p.image)}" muted loop playsinline webkit-playsinline preload="metadata" disablepictureinpicture disableremoteplayback controlslist="nodownload noremoteplayback" aria-label="Video von ${esc(p.author.name)}"></video>` : `<img class="kbs-img" src="${esc(p.image)}" alt="Beitrag von ${esc(p.author.name)}" loading="lazy" draggable="false">`}${v ? `<span class="kbs-ctr" aria-hidden="true"><i class="fas fa-volume-xmark"></i></span><span class="kbs-vdur"><i class="fas fa-video"></i> ${mmss(v.dur)}</span><button type="button" class="kbs-music kbs-vmute" data-music="${id}" aria-pressed="false" aria-label="Ton ein- oder ausschalten"><i class="fas fa-volume-xmark kbs-mp"></i></button>` : ''}${m ? `<span class="kbs-ctr" aria-hidden="true"><i class="fas fa-volume-xmark"></i></span><button type="button" class="kbs-music" data-music="${id}" aria-pressed="false" aria-label="Ton ein- oder ausschalten: ${esc(m.title)}"><i class="fas fa-music"></i><span class="kbs-mt"><b>${esc(m.title)}</b> · ${esc(m.artist)}</span><i class="fas fa-volume-xmark kbs-mp"></i></button>` : ''}<i class="fas fa-heart kbs-pop"></i></div>
            <div class="kbs-bar"><button class="kbs-like ${p.liked ? 'on' : ''}" data-like="${id}" aria-pressed="${p.liked}" aria-label="Gefällt mir"><i class="${p.liked ? 'fas' : 'far'} fa-heart"></i> <span>${p.likes}</span></button>${p.commentsOn ? `<button class="kbs-like kbs-cmbtn" data-cm="${id}" aria-label="Kommentare"><i class="far fa-comment"></i> <span>${cc}</span></button>` : (p.mine ? '<span class="kbs-cmoff"><i class="fas fa-comment-slash"></i> Kommentare aus</span>' : '')}</div>
            ${trs.length ? `<div class="kbs-treats">${trs.map(t => { const q = priceOf(t); return `<div class="kbs-treat"><i class="fas fa-wand-magic-sparkles"></i> ${esc(t)}${q ? ` <span class="kbs-trp">${esc(q.price)}</span>` : ''}</div>`; }).join('')}</div>` : ''}
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
        const inNow = isIn();
        if (st.wasIn !== undefined && st.wasIn !== inNow) { st.stories = st.feed = st.results = st.people = st.prof = st.pending = null; st.scope = inNow ? 'following' : 'all'; st.sec = 'feed'; }
        st.wasIn = inNow; if (!inNow) st.scope = 'all';
        root.classList.add('kbs-mode');
        const me = (A() && A().getProfile && A().getProfile()) || {};
        const tab = (id, icon, label) => `<button class="${st.sec === id ? 'on' : ''}" data-sec="${id}" aria-label="${label}" title="${label}"><i class="${icon}"></i></button>`;
        root.innerHTML = `<div class="kbs-top"><span class="kbs-logo">Community</span><span class="kbs-topbtns"><button class="kbs-rf" id="kbs-rf" title="Aktualisieren" aria-label="Aktualisieren"><i class="fas fa-rotate"></i></button><button class="kbs-newtop" id="kbs-new2" title="Posten" aria-label="Posten"><i class="far fa-square-plus"></i></button></span></div>
        <div class="kba-msg" id="kbs-note"></div><div id="kbs-body"></div>
        <nav class="kbs-tabbar" aria-label="Community">${tab('feed', st.sec === 'feed' ? 'fas fa-house' : 'fas fa-house', 'Feed')}${tab('search', 'fas fa-magnifying-glass', 'Suchen')}<button class="kbs-plus" id="kbs-new" aria-label="Posten" title="Posten"><i class="far fa-square-plus"></i></button><button class="kbs-me ${st.sec === 'profile' && st.pid === 'me' ? 'on' : ''}" data-sec="profile" aria-label="Profil" title="Profil">${av(me, 28)}</button></nav>`;
        if (!inNow) root.querySelector('#kbs-note').insertAdjacentHTML('beforebegin', `<div class="kbs-guest"><i class="far fa-user"></i><span>Du schaust als Gast zu. Zum Posten, Liken und Kommentieren bitte anmelden.</span><button class="kba-btn" data-gate="login">Anmelden</button></div>`);
        root.querySelectorAll('[data-sec]').forEach(b => b.onclick = () => { if (b.dataset.sec === 'profile' && !isIn()) return needLogin(); st.sec = b.dataset.sec; if (st.sec === 'profile') { st.pid = 'me'; st.prof = null; } render(root); window.scrollTo({ top: 0 }); });
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
        const me = A().getProfile() || {}, inn = isIn();
        const list = st.stories.slice().sort((a, b) => (b.iFollow ? 1 : 0) - (a.iFollow ? 1 : 0)).slice(0, 24);
        const box2 = root.querySelector('#kbs-stories'); if (!box2) return;
        box2.innerHTML = `<button class="kbs-story kbs-story-me" id="kbs-story-new" aria-label="Posten">${inn ? av(me, 58) : '<span class="kbs-av" style="width:58px;height:58px;font-size:22px"><i class="far fa-user"></i></span>'}<i class="fas fa-plus"></i><small>${inn ? 'Du' : 'Mitmachen'}</small></button>`
            + list.map(p => `<a href="#" class="kbs-story kbs-who" data-pid="${esc(p.pid)}">${av(p, 58, true)}<small>${esc((p.name || '').split(' ')[0])}</small></a>`).join('');
        const nb = box2.querySelector('#kbs-story-new'); if (nb) nb.onclick = openComposer;
    }

    function body() {
        const box = root.querySelector('#kbs-body'); if (!box) return;
        if (st.sec === 'feed') {
            box.innerHTML = `<div class="kbs-stories" id="kbs-stories"></div><div class="kbs-seg"><button class="${st.scope === 'following' ? 'on' : ''}" data-scope="following">Meine Beautys</button><button class="${st.scope === 'all' ? 'on' : ''}" data-scope="all">Entdecken</button></div><div id="kbs-newbar"></div><div id="kbs-list"></div><div id="kbs-more"></div>`;
            if (!isIn()) { const sg = box.querySelector('.kbs-seg'); if (sg) sg.remove(); }
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
        <div class="kbs-grid">${posts.map(x => `<button class="kbs-th" data-open="${esc(x.id)}" aria-label="Post öffnen"><img src="${esc(x.image)}" alt="" loading="lazy">${x.video ? '<i class="fas fa-video kbs-vi"></i>' : ''}<span><i class="fas fa-heart"></i> ${x.likes}</span></button>`).join('')}</div>
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
        if ((b = t('[data-music]'))) return toggleMute(b.closest('.kbs-media'));
        if ((b = t('.kbs-media'))) {   // Doppeltipp aufs Bild = Herz
            const now = Date.now();
            if (now - (b._t || 0) < 320) {
                b._t = 0; clearTimeout(b._mt); const lk = b.closest('.kbs-post').querySelector('[data-like]'), pop = b.querySelector('.kbs-pop');
                if (pop) { pop.classList.remove('go'); void pop.offsetWidth; pop.classList.add('go'); }
                if (lk && !lk.classList.contains('on')) like(lk);
            } else {
                b._t = now;
                if (b.classList.contains('kbs-hasmu')) { clearTimeout(b._mt); b._mt = setTimeout(() => toggleMute(b), 300); }   // Einzeltipp = Ton an/aus (wie Instagram)
            }
            return;
        }
        if ((b = t('[data-gate]'))) { closeModal(); return A().login(b.dataset.gate); }
        if ((b = t('[data-mpick]'))) {
            const box = b.closest('.kbs-cmbox'), inp = box.querySelector('.kbs-cmin'), id = box.dataset.box, pos = inp.selectionStart || inp.value.length;
            const pre = inp.value.slice(0, pos).replace(/@([^\s@]{0,30})$/, '@' + b.dataset.name + ' ');
            inp.value = pre + inp.value.slice(pos); (mstate[id] = mstate[id] || new Map()).set(b.dataset.mpick, b.dataset.name);
            box.querySelector('.kbs-mdrop').hidden = true; inp.focus(); inp.setSelectionRange(pre.length, pre.length); return;
        }
        if ((b = t('[data-cmlike]'))) return likeComment(b);
        if ((b = t('[data-cmreply]'))) return startReply(b);
        if ((b = t('[data-replycancel]'))) return cancelReply(b.dataset.replycancel);
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
        if (!isIn()) return needLogin();
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
        if (!isIn()) return needLogin();
        const id = btn.dataset.like, on = !btn.classList.contains('on');
        const paint = (liked, n) => document.querySelectorAll(`[data-like="${id}"]`).forEach(x => { x.classList.toggle('on', liked); x.setAttribute('aria-pressed', liked); x.querySelector('i').className = (liked ? 'fas' : 'far') + ' fa-heart'; x.querySelector('span').textContent = n; });
        const cur = +btn.querySelector('span').textContent; paint(on, cur + (on ? 1 : -1));
        const r = await call('like', { id, on });
        if (!r.ok) { paint(!on, cur); return note(r.message); }
        paint(r.liked, r.likes); patchPost(id, p => { p.liked = r.liked; p.likes = r.likes; });
    }
    async function report(id) {
        if (!isIn()) return needLogin();
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
    const rstate = {}, mstate = {};   // Antwort-Ziel und gewählte @Erwähnungen je Post
    const heart = (on) => `<i class="${on ? 'fas' : 'far'} fa-heart"></i>`;
    function cmText(c) {
        let h = esc(c.text);
        (c.mentions || []).forEach(m => { const nm = '@' + esc(m.name); h = h.split(nm).join(`<a href="#" class="kbs-who kbs-mention" data-pid="${esc(m.pid)}">${nm}</a>`); });
        return h;
    }
    const cmRow = (c, id, isReply) => `<div class="kbs-cm${isReply ? ' kbs-reply' : ''}" data-cid="${esc(c.cid)}">${av(c.author, isReply ? 26 : 32)}<div class="kbs-cmb"><a href="#" class="kbs-who" data-pid="${esc(c.author.pid)}"><b>${esc(c.author.name)}</b></a> <span class="kbs-cmt">${cmText(c)}</span>
        <div class="kbs-cmmeta"><small>${when(c.at)}</small>${isIn() ? `<button class="kbs-cmlnk" data-cmreply="${esc(id)}" data-cid="${esc(c.cid)}" data-name="${esc(c.author.name)}" data-apid="${esc(c.author.pid)}">Antworten</button>` : ''}${c.canDelete ? `<button class="kbs-cmlnk" data-cmdel="${esc(id)}" data-cid="${esc(c.cid)}" title="Kommentar löschen" aria-label="Kommentar löschen">Löschen</button>` : ''}</div></div>
        <button class="kbs-cmlike ${c.liked ? 'on' : ''}" data-cmlike="${esc(id)}" data-cid="${esc(c.cid)}" aria-label="Gefällt mir" aria-pressed="${!!c.liked}">${heart(c.liked)}<span>${c.likes || ''}</span></button></div>`;
    function cmThreads(list, id) {
        const rep = {}; list.filter(c => c.parent).forEach(c => (rep[c.parent] = rep[c.parent] || []).push(c));
        return list.filter(c => !c.parent).map(c => `<div class="kbs-thread">${cmRow(c, id)}${rep[c.cid] ? `<div class="kbs-replies">${rep[c.cid].map(r => cmRow(r, id, true)).join('')}</div>` : ''}</div>`).join('');
    }
    const boxes = (id) => document.querySelectorAll(`[data-box="${id}"]`);
    function drawComments(id, r) {
        const rs = rstate[id];
        boxes(id).forEach(box => {
            const keep = box.querySelector('.kbs-cmin') ? box.querySelector('.kbs-cmin').value : '';
            box.innerHTML = `<div class="kbs-cmlist">${r.comments.length ? cmThreads(r.comments, id) : '<div class="kba-empty" style="padding:.4rem 0">Noch keine Kommentare.</div>'}</div>`
                + (isIn() ? `<div class="kbs-replyto" ${rs ? '' : 'hidden'}><span>Antwort an <b>${esc(rs ? rs.name : '')}</b></span><button type="button" data-replycancel="${esc(id)}" aria-label="Abbrechen">&times;</button></div>
                <div class="kbs-cmform"><div class="kbs-cminwrap"><input class="kbs-cmin" maxlength="300" placeholder="Kommentar schreiben … (@ zum Erwähnen)" autocomplete="off" value="${esc(keep)}"><div class="kbs-mdrop" hidden></div></div><button class="kba-btn kbs-cmsend" data-cmsend="${esc(id)}" aria-label="Senden"><i class="fas fa-paper-plane"></i></button></div><div class="kba-msg kbs-cmnote"></div>`
                : `<div class="kbs-cmgate"><i class="far fa-comment-dots"></i><span>Melde dich an, um zu kommentieren.</span><button class="kba-btn" data-gate="login">Anmelden</button></div>`);
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
    function startReply(btn) {
        const id = btn.dataset.cmreply, name = btn.dataset.name;
        rstate[id] = { cid: btn.dataset.cid, name }; mstate[id] = new Map([[btn.dataset.apid, name]]);
        boxes(id).forEach(box => { const inp = box.querySelector('.kbs-cmin'), rt = box.querySelector('.kbs-replyto'); if (!inp || !rt) return; rt.hidden = false; rt.querySelector('b').textContent = name; inp.value = '@' + name + ' '; inp.focus(); });
    }
    function cancelReply(id) { delete rstate[id]; delete mstate[id]; boxes(id).forEach(box => { const rt = box.querySelector('.kbs-replyto'); if (rt) rt.hidden = true; }); }
    async function sendComment(btn) {
        if (!isIn()) return needLogin();
        const id = btn.dataset.cmsend, box = btn.closest('.kbs-cmbox'), inp = box.querySelector('.kbs-cmin'), nt = box.querySelector('.kbs-cmnote');
        const t = inp.value.trim(); if (!t) return;
        const rs = rstate[id], ms = mstate[id] || new Map();
        const mentions = [...ms.keys()].filter(pid => t.toLowerCase().includes('@' + String(ms.get(pid)).toLowerCase()));
        btn.disabled = true;
        const r = await call('comment_add', { id, text: t, parent: rs ? rs.cid : undefined, mentions });
        btn.disabled = false;
        if (!r.ok) { nt.className = 'kba-msg err'; nt.textContent = r.message || 'Das hat leider nicht geklappt.'; return; }
        inp.value = ''; delete rstate[id]; delete mstate[id]; drawComments(id, r);
    }
    async function likeComment(btn) {
        if (!isIn()) return needLogin();
        const id = btn.dataset.cmlike, cid = btn.dataset.cid, on = !btn.classList.contains('on'), cur = +btn.querySelector('span').textContent || 0;
        const paint = (l, n) => document.querySelectorAll(`.kbs-cmlike[data-cid="${cid}"]`).forEach(x => { x.classList.toggle('on', l); x.setAttribute('aria-pressed', l); x.querySelector('i').className = (l ? 'fas' : 'far') + ' fa-heart'; x.querySelector('span').textContent = n || ''; });
        paint(on, Math.max(0, cur + (on ? 1 : -1)));
        const r = await call('comment_like', { id, cid, on });
        if (!r.ok) { paint(!on, cur); return note(r.message); }
        const c = (r.comments || []).find(x => x.cid === cid); if (c) paint(c.liked, c.likes);
    }
    async function delComment(btn) {
        if (!confirm(tx('Diesen Kommentar löschen?'))) return;
        const id = btn.dataset.cmdel, r = await call('comment_delete', { id, cid: btn.dataset.cid });
        if (!r.ok) return note(r.message);
        const f = await call('comments', { id }); if (f.ok) drawComments(id, f);
    }
    // @Erwähnung: beim Tippen von „@…“ Vorschläge zeigen; Enter sendet
    let mT = null;
    document.addEventListener('input', (e) => {
        const inp = e.target.closest && e.target.closest('.kbs-cmin'); if (!inp || !isIn()) return;
        const box = inp.closest('.kbs-cmbox'), dd = box.querySelector('.kbs-mdrop'), pre = inp.value.slice(0, inp.selectionStart || 0), m = pre.match(/(?:^|\s)@([^\s@]{0,30})$/);
        clearTimeout(mT);
        if (!m) { dd.hidden = true; return; }
        mT = setTimeout(async () => {
            const r = await call('mention_search', { q: m[1] });
            if (!r.ok || !r.people.length) { dd.hidden = true; return; }
            dd.innerHTML = r.people.map(p => `<button type="button" class="kbs-mi" data-mpick="${esc(p.pid)}" data-name="${esc(p.name)}">${av(p, 26)}<b>${esc(p.name)}</b></button>`).join(''); dd.hidden = false;
        }, 180);
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('kbs-cmin')) { e.preventDefault(); const b = e.target.closest('.kbs-cmbox').querySelector('.kbs-cmsend'); if (b) b.click(); } });
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
    // ───────────── Musik: Autoplay beim Scrollen, Ton an/aus, Musikstelle ─────────────
    // Ein einziges <audio>-Element für alles: iOS/Safari erlaubt Autoplay nur auf einem Element, das einmal per Tipp „freigeschaltet“ wurde.
    const CLIP = 15, FULL = 30, VID_SEC = 90, VID_MAX = 30 * 1024 * 1024;                    // Ausschnitt-Länge / Länge der iTunes-Vorschau (Sek.)
    const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
    let unlockAt = 0, AU = null, unlocked = false, cur = null, curKey = '', loopT = null, ptok = 0, previewing = false, prevBtn = null, muted = false, flashT = null;
    const vis = new Map();
    try { muted = localStorage.getItem('kb_mute') === '1'; } catch (_) {}
    const mmss = (n) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
    function getAU() {
        if (!AU) {
            AU = new Audio(); AU.preload = 'auto'; AU.setAttribute('playsinline', ''); AU.setAttribute('webkit-playsinline', '');
            ['play', 'pause', 'volumechange'].forEach(ev => AU.addEventListener(ev, () => paint()));
        }
        return AU;
    }
    // Erste Berührung/Klick schaltet Ton frei (Browser-Regel auf iPhone & Android)
    function unlock() {
        if (unlocked) return;
        const a = getAU(); unlocked = true; unlockAt = Date.now();
        const v0 = curVid(); if (v0 && !muted && v0.muted) v0.muted = false;   // Video lief nur wegen der Browser-Regel stumm → jetzt mit Ton
        try { if (!a.src) { a.src = SILENT; a.muted = true; const pr = a.play(); if (pr && pr.catch) pr.catch(() => { unlocked = false; }); } } catch (_) { unlocked = false; }
        setTimeout(() => sync(true), 0);
    }
    ['click', 'touchend', 'keydown'].forEach(ev => document.addEventListener(ev, () => { if (!unlocked) unlock(); }, { capture: true, passive: true }));

    function stopLoop() { clearInterval(loopT); loopT = null; }
    function playClip(src, start, onFail) {
        const a = getAU(), my = ++ptok; stopLoop();
        const go = () => {
            if (my !== ptok) return;
            try { a.currentTime = start; } catch (_) {}
            a.muted = previewing ? false : muted;
            const pr = a.play(); if (pr && pr.catch) pr.catch(() => { if (my === ptok) { unlocked = false; if (onFail) onFail(); paint(); } });
            loopT = setInterval(() => {   // nur den gewählten Ausschnitt in Schleife abspielen
                if (a.ended || a.currentTime >= start + CLIP - 0.08) { try { a.currentTime = start; } catch (_) {} if (a.paused) a.play().catch(() => {}); }
            }, 120);
        };
        if (a.dataset.cur !== src) { a.dataset.cur = src; a.src = src; a.load(); a.addEventListener('loadedmetadata', go, { once: true }); }
        else if (a.readyState >= 1) go(); else a.addEventListener('loadedmetadata', go, { once: true });
    }
    function stopMusic() {
        ptok++; stopLoop(); previewing = false; prevBtn = null;
        if (AU) AU.pause();
        pauseVid(cur);
        cur = null; curKey = '';
        document.querySelectorAll('.kbs-muplay.on').forEach(x => { x.classList.remove('on'); const i = x.querySelector('.kbs-mp'); if (i) i.className = 'fas fa-play kbs-mp'; });
        paint();
    }

    // Anzeige: Symbol in der Bildmitte + Pille unten links
    function paint(flash) {
        const vv = curVid(), audible = !!(cur && (vv ? (!vv.paused && !vv.muted) : (AU && !AU.paused && !AU.muted)));
        document.querySelectorAll('.kbs-media.kbs-hasmu').forEach(el => {
            const mine = el === cur, quiet = mine ? (!audible) : muted;
            el.classList.toggle('m-quiet', quiet);
            el.classList.toggle('m-on', mine && audible);
            const ic = audible && mine ? 'fa-volume-high' : 'fa-volume-xmark';
            el.querySelectorAll('.kbs-ctr i,.kbs-mp').forEach(i => { i.className = `fas ${ic}${i.classList.contains('kbs-mp') ? ' kbs-mp' : ''}`; });
            const pill = el.querySelector('.kbs-music'); if (pill) { pill.classList.toggle('on', mine && audible); pill.setAttribute('aria-pressed', String(mine && audible)); }
            if (flash === true && mine) { el.classList.add('m-flash'); clearTimeout(flashT); flashT = setTimeout(() => el.classList.remove('m-flash'), 900); }
        });
    }
    function curVid() { return cur && cur.dataset && cur.dataset.vid ? cur.querySelector('video') : null; }
    function pauseVid(el) { const v = el && el.dataset && el.dataset.vid ? el.querySelector('video') : null; if (v) { try { v.pause(); } catch (_) {} } }
    function applyMute() {
        try { localStorage.setItem('kb_mute', muted ? '1' : '0'); } catch (_) {}
        if (AU && !previewing) AU.muted = muted;
        const v = curVid(); if (v) v.muted = muted;
    }
    function toggleMute(el) {
        unlock();
        if (previewing) return;
        if (Date.now() - unlockAt < 700) { paint(true); return; }   // der allererste Tipp schaltet nur den Ton frei
        if (el && (el.dataset.msrc || el.dataset.vid) && el !== cur) { muted = false; applyMute(); playFor(el, true); paint(true); return; }   // anderes Bild angetippt → dort mit Ton starten
        const v = curVid();
        if (v) {   // Video: war es nur wegen der Browser-Regel stumm, spielt es jetzt (per Tipp) mit Ton
            if (v.muted && !muted) muted = false; else muted = !muted;
            applyMute(); if (v.paused) { const pr = v.play(); if (pr && pr.catch) pr.catch(() => { v.muted = true; paint(); }); }
            paint(true); return;
        }
        const a = getAU();
        if (cur && (a.paused || !unlocked)) { muted = false; applyMute(); playFor(cur, true); paint(true); return; }   // Autoplay war blockiert → jetzt mit Ton
        muted = !muted; applyMute(); paint(true);
    }

    function playFor(el, force) {
        if (!el) { pauseVid(cur); if (AU) AU.pause(); stopLoop(); ptok++; cur = null; curKey = ''; return paint(); }
        const key = (el.closest('.kbs-post') || el).dataset.id || el.dataset.msrc || '';
        const v0 = el.dataset.vid ? el.querySelector('video') : null;
        const same = key === curKey && !force && !(v0 && v0.paused);
        if (cur && cur !== el) pauseVid(cur);
        cur = el; curKey = key;
        if (same) return paint();
        if (v0) {   // Video: läuft stumm automatisch (erlaubt auf iPhone & Android), mit Ton sobald freigeschaltet
            if (AU) AU.pause(); stopLoop(); ptok++;
            v0.muted = muted || !unlocked;
            const pr = v0.play();
            if (pr && pr.catch) pr.catch(() => { v0.muted = true; const p2 = v0.play(); if (p2 && p2.catch) p2.catch(() => {}); paint(); });
            return paint();
        }
        if (!unlocked) { paint(); return; }   // wartet auf die erste Berührung
        playClip(el.dataset.msrc, +el.dataset.mstart || 0, () => paint());
    }
    // Welches Bild liegt gerade im Blick? → das spielt automatisch (Scrollen weg = Pause)
    function sync(force) {
        if (previewing || document.hidden) return;
        const m = document.getElementById('kbs-modal'); let best = null, br = 0;
        vis.forEach((ratio, el) => {
            if (!el.isConnected) { vis.delete(el); return; }
            if (m && !m.contains(el)) return;
            if (ratio >= 0.6 && ratio > br) { br = ratio; best = el; }
        });
        if (!best && cur && !cur.isConnected && !force) { /* wird unten neu bestimmt */ }
        if (force && best && best === cur) return playFor(best, true);
        playFor(best);
    }
    let io = null, moT = null;
    function observeMedia() {
        if (!('IntersectionObserver' in window)) return;
        if (!io) io = new IntersectionObserver((entries) => {
            entries.forEach(en => { const h = Math.min(en.boundingClientRect.height || 1, window.innerHeight || 1); vis.set(en.target, en.isIntersecting ? Math.min(1, en.intersectionRect.height / h) : 0); });
            sync();
        }, { threshold: [0, .2, .4, .6, .8, 1] });
        document.querySelectorAll('.kbs-media.kbs-hasmu').forEach(el => { if (!el._io) { el._io = 1; io.observe(el); } });
        paint();
    }
    new MutationObserver(() => { clearTimeout(moT); moT = setTimeout(() => { observeMedia(); sync(); }, 120); }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('pagehide', stopMusic);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (AU) AU.pause(); pauseVid(cur); stopLoop(); } else sync(true); });
    ['play', 'pause', 'volumechange'].forEach(ev => document.addEventListener(ev, (e) => { if (e.target && e.target.tagName === 'VIDEO') paint(); }, true));   // App im Hintergrund = Ruhe (iPhone & Android)

    // Vorhören im Composer (immer mit Ton, ab der gewählten Stelle)
    function previewTrack(src, start, btn) {
        const same = prevBtn === btn && previewing; stopMusic(); if (same) return;
        unlock(); previewing = true; prevBtn = btn;
        playClip(src, start, () => stopMusic());
        if (btn) { btn.classList.add('on'); const i = btn.querySelector('.kbs-mp'); if (i) i.className = 'fas fa-pause kbs-mp'; }
    }

    function openModal(html) {
        closeModal();
        const o = document.createElement('div'); o.className = 'kbs-modal'; o.id = 'kbs-modal';
        o.innerHTML = `<div class="kbs-sheet"><button class="kbs-x" aria-label="Schließen">&times;</button>${html}</div>`;
        o.onclick = (e) => { if (e.target === o || e.target.closest('.kbs-x')) closeModal(); else onClick(e); };
        document.body.appendChild(o); document.body.style.overflow = 'hidden';
        return o;
    }
    function closeModal() { stopMusic(); setTimeout(() => sync(true), 60); const o = document.getElementById('kbs-modal'); if (o) o.remove(); document.body.style.overflow = ''; }

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

    // ───────────── Video: lesen, ggf. verkleinern (im Browser), hochladen ─────────────
    const canCompress = () => typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
    const pickRecMime = () => ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(t => { try { return MediaRecorder.isTypeSupported(t); } catch (_) { return false; } }) || '';
    const blobB64 = (b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = () => rej(new Error('Das Video konnte nicht gelesen werden.')); fr.readAsDataURL(b); });
    function readVideo(file) {   // Länge + Titelbild
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file), v = document.createElement('video');
            const fail = () => { URL.revokeObjectURL(url); reject(new Error('Dieses Video kann dein Gerät nicht lesen. Bitte nimm ein MP4- oder MOV-Video.')); };
            v.preload = 'auto'; v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.onerror = fail;
            v.onloadedmetadata = () => { const d = v.duration; if (!isFinite(d) || d <= 0) return fail(); try { v.currentTime = Math.min(0.5, d / 2); } catch (_) { fail(); } };
            v.onseeked = () => {
                try {
                    const k = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas');
                    c.width = Math.max(1, Math.round(v.videoWidth * k)); c.height = Math.max(1, Math.round(v.videoHeight * k));
                    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
                    c.toBlob((b) => { URL.revokeObjectURL(url); b ? resolve({ dur: v.duration, poster: b }) : reject(new Error('Vom Video konnte kein Titelbild erstellt werden.')); }, 'image/jpeg', .82);
                } catch (_) { fail(); }
            };
            v.src = url;
        });
    }
    // Spielt das Video in Echtzeit ab und nimmt es verkleinert (max. 1280 px, ~2 MBit/s) wieder auf → bleibt unter 30 MB
    function compressVideo(file, dur, onProg, aborted) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file), v = document.createElement('video'), chunks = [];
            let rec, ac, raf, done = false, noAudio = false;
            const cleanup = () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis2); try { v.pause(); } catch (_) {} URL.revokeObjectURL(url); try { ac && ac.close(); } catch (_) {} };
            const fail = (m) => { if (done) return; done = true; cleanup(); try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (_) {} reject(new Error(m)); };
            const vis2 = () => { try { if (document.hidden) { v.pause(); rec && rec.state === 'recording' && rec.pause(); } else { v.play(); rec && rec.state === 'paused' && rec.resume(); } } catch (_) {} };
            document.addEventListener('visibilitychange', vis2);
            v.preload = 'auto'; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.src = url;
            v.onerror = () => fail('Das Video konnte nicht verarbeitet werden.');
            v.onloadedmetadata = async () => {
                const k = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
                const w = Math.max(2, Math.round(v.videoWidth * k / 2) * 2), h = Math.max(2, Math.round(v.videoHeight * k / 2) * 2);
                const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'), stream = c.captureStream(30);
                try { const AC = window.AudioContext || window.webkitAudioContext; ac = new AC(); const src = ac.createMediaElementSource(v), dst = ac.createMediaStreamDestination(); src.connect(dst); dst.stream.getAudioTracks().forEach(t => stream.addTrack(t)); if (ac.state === 'suspended') await ac.resume(); } catch (_) { noAudio = true; }
                const mime = pickRecMime();
                try { rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), videoBitsPerSecond: 2000000, audioBitsPerSecond: 96000 }); } catch (_) { return fail('Dein Browser kann das Video nicht verkleinern.'); }
                rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
                rec.onstop = () => { if (done) return; done = true; cleanup(); resolve({ blob: new Blob(chunks, { type: (rec.mimeType || mime || 'video/webm').split(';')[0] }), noAudio }); };
                v.onended = () => { try { rec.stop(); } catch (_) {} };
                const draw = () => { if (done) return; if (aborted()) return fail('abort'); x.drawImage(v, 0, 0, w, h); onProg(Math.min(1, v.currentTime / (dur || 1))); raf = requestAnimationFrame(draw); };
                rec.start(1000);
                try { await v.play(); } catch (_) { return fail('Das Video konnte nicht gestartet werden. Bitte tippe nochmal auf „Video optimieren“.'); }
                draw();
            };
        });
    }

    function openComposer() {
        if (!isIn()) return needLogin();
        let data = '';
        const o = openModal(`<h2 style="margin:0 0 .8rem;font-family:'Playfair Display',serif;font-weight:500">Neuer Post</h2>
            <label class="kbs-drop" for="kbs-file" id="kbs-drop"><i class="far fa-image"></i><span>Foto oder Video auswählen</span></label><input type="file" id="kbs-file" accept="image/*,video/*" hidden>
            <div class="kbs-vbox" id="kbs-vbox" hidden><div class="kbs-vinfo" id="kbs-vinfo"></div><div class="kbs-vbar" id="kbs-vbar" hidden><span id="kbs-vfill"></span></div><button type="button" class="kba-btn" id="kbs-vopt" hidden style="width:100%;margin-top:.5rem">Video optimieren</button></div>
            <small class="kbs-vhint">Video: höchstens 1:30 Minuten</small>
            <label for="kbs-tr" style="display:block;margin:.9rem 0 .3rem;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#777">Behandlung <span style="text-transform:none;letter-spacing:0;font-weight:400">(optional · bis zu 3 · aus der Preisliste)</span></label>
            <div class="kbs-trchips" id="kbs-trcats"></div><div class="kbs-trlist" id="kbs-trlist" hidden></div>
            <div class="kbs-trpicked" id="kbs-trpicked"></div>
            <div class="kbs-trsel"><input id="kbs-tr" maxlength="40" placeholder="Oder eigene Behandlung eintippen" autocomplete="off" enterkeyhint="done"><button type="button" class="kbs-tradd" id="kbs-tradd" aria-label="Behandlung hinzufügen">+</button></div>
            <small class="kbs-vhint" id="kbs-trcount"></small>
            <label for="kbs-cap" style="display:block;margin:.9rem 0 .3rem;font-size:.68rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#777">Beschreibung</label>
            <textarea id="kbs-cap" maxlength="${CAP_MAX}" placeholder="Schreib etwas dazu … mit #Hashtags (max. ${MAX_TAGS})"></textarea>
            <div class="kbs-count"><span id="kbs-tc">0/${MAX_TAGS} Hashtags</span><span id="kbs-cc">0/${CAP_MAX}</span></div>
            <div id="kbs-mu"><button type="button" class="kbs-mubtn" id="kbs-mubtn"><i class="fas fa-music"></i> Musik hinzufügen <small>(optional)</small></button>
            <div class="kbs-mupanel" id="kbs-mupanel" hidden><input id="kbs-muq" type="search" placeholder="Song oder Künstler suchen …" autocomplete="off" autocapitalize="off" enterkeyhint="search" maxlength="60"><div id="kbs-mures" class="kbs-mures"></div></div>
            <div class="kbs-mutrim" id="kbs-mutrim" hidden><div class="kbs-mutrim-h"><button type="button" class="kbs-muplay" id="kbs-trplay" aria-label="Ausschnitt vorhören"><i class="fas fa-play kbs-mp"></i></button><div><b>Musikstelle wählen</b><small id="kbs-trlbl"></small></div></div>
            <div class="kbs-trbar"><span id="kbs-trwin"></span></div><input type="range" id="kbs-trrange" min="0" max="${FULL - CLIP}" step="1" value="0" aria-label="Startpunkt im Song"><div class="kbs-trtime"><span>0:00</span><span>0:${FULL}</span></div></div></div>
            <label class="kbs-switch"><input type="checkbox" id="kbs-cmon" checked><span class="kbs-sw"></span><span>Kommentare erlauben</span></label>
            <div class="kba-msg" id="kbs-cn"></div><button class="kba-btn" id="kbs-go" style="width:100%" disabled>Posten</button>`);
        const cap = o.querySelector('#kbs-cap'), go = o.querySelector('#kbs-go'), cn = o.querySelector('#kbs-cn');
        let vblob = null, vdur = 0, vbusy = false, vsrc = null, vidDone = '';
        const tags = () => (cap.value.match(/#[\p{L}\p{N}_]{1,30}/gu) || []).length;
        const upd = () => { const n = tags(), tc = o.querySelector('#kbs-tc'); tc.textContent = `${n}/${MAX_TAGS} Hashtags`; tc.style.color = n > MAX_TAGS ? '#b4433a' : ''; o.querySelector('#kbs-cc').textContent = `${cap.value.length}/${CAP_MAX}`; go.disabled = !data || n > MAX_TAGS || vbusy; };
        cap.oninput = upd;
        // Musik auswählen (wie bei Instagram: suchen, anhören, antippen)
        let music = null, found = [], muT = null;
        const trim = o.querySelector('#kbs-mutrim'), trR = o.querySelector('#kbs-trrange'), trL = o.querySelector('#kbs-trlbl'), trW = o.querySelector('#kbs-trwin'), trP = o.querySelector('#kbs-trplay');
        const drawTrim = () => { const st0 = music.start || 0; trR.value = st0; trL.textContent = `${mmss(st0)} – ${mmss(st0 + CLIP)} · ${CLIP} Sek. im Beitrag`; trW.style.left = (st0 / FULL * 100) + '%'; trW.style.width = (CLIP / FULL * 100) + '%'; };
        trR.oninput = () => { if (!music) return; music.start = +trR.value; drawTrim(); if (previewing) { previewing = true; playClip(music.preview, music.start, () => stopMusic()); } };
        trP.onclick = () => { if (music) previewTrack(music.preview, music.start || 0, trP); };
        const mubtn = o.querySelector('#kbs-mubtn'), mup = o.querySelector('#kbs-mupanel'), muq = o.querySelector('#kbs-muq'), mures = o.querySelector('#kbs-mures');
        const showPick = () => {
            mubtn.innerHTML = music ? `<i class="fas fa-music"></i> <b>${esc(music.title)}</b> · ${esc(music.artist)} <span class="kbs-muclear" id="kbs-muclear" role="button" aria-label="Song entfernen">&times;</span>` : '<i class="fas fa-music"></i> Musik hinzufügen <small>(optional)</small>';
            mubtn.classList.toggle('on', !!music);
            const cl = o.querySelector('#kbs-muclear'); if (cl) cl.onclick = (e) => { e.stopPropagation(); music = null; stopMusic(); showPick(); };
            trim.hidden = !music; if (music) drawTrim();
        };
        mubtn.onclick = () => { mup.hidden = !mup.hidden; if (!mup.hidden) muq.focus(); else stopMusic(); };
        const drawTracks = () => {
            mures.innerHTML = found.length ? found.map((x, i) => `<div class="kbs-mutrack" data-i="${i}">${x.art ? `<img src="${esc(x.art)}" alt="">` : '<span class="kbs-mu0"><i class="fas fa-music"></i></span>'}<span class="kbs-mui"><b>${esc(x.title)}</b><small>${esc(x.artist)}</small></span><button type="button" class="kbs-muplay" data-src="${esc(x.preview)}" aria-label="Vorhören"><i class="fas fa-play kbs-mp"></i></button></div>`).join('') : '<div class="kba-empty" style="padding:.6rem 0">Nichts gefunden.</div>';
            mures.querySelectorAll('.kbs-mutrack').forEach(row => row.onclick = (e) => {
                const pb = e.target.closest('.kbs-muplay');
                if (pb) { e.stopPropagation(); return previewTrack(pb.dataset.src, 0, pb); }
                music = { ...found[+row.dataset.i], start: 0 }; stopMusic(); mup.hidden = true; showPick(); previewTrack(music.preview, 0, trP);
            });
        };
        muq.oninput = () => {
            clearTimeout(muT); const q = muq.value.trim();
            if (q.length < 2) { mures.innerHTML = ''; return; }
            muT = setTimeout(async () => {
                mures.innerHTML = '<div class="kba-empty" style="padding:.6rem 0">Suche …</div>';
                const r = await call('music_search', { q });
                if (muq.value.trim() !== q) return;
                if (!r.ok) { mures.innerHTML = `<div class="kba-msg err">${esc(r.message || 'Die Suche hat nicht geklappt.')}</div>`; return; }
                found = r.tracks || []; drawTracks();
            }, 450);
        };
        const tr = o.querySelector('#kbs-tr'), trcats = o.querySelector('#kbs-trcats'), trlist = o.querySelector('#kbs-trlist'), picked = o.querySelector('#kbs-trpicked'), trAdd = o.querySelector('#kbs-tradd'), trCount = o.querySelector('#kbs-trcount');
        const TR_MAX = 3, sel = [], cats = priceCats().filter(c => c && c.items && c.items.length); let openCat = -1;
        const has = (n) => sel.some(x => nkey(x) === nkey(n));
        const drawCats = () => {
            trcats.innerHTML = cats.map((c, i) => `<button type="button" class="kbs-trchip${i === openCat ? ' on' : ''}" data-ci="${i}">${esc(c.category)}</button>`).join('');
            if (openCat < 0) { trlist.hidden = true; return; }
            trlist.hidden = false;
            trlist.innerHTML = cats[openCat].items.map((it, i) => `<button type="button" class="kbs-trrow${has(it.name) ? ' on' : ''}" data-ii="${i}"><span>${has(it.name) ? '<i class="fas fa-check"></i> ' : ''}${esc(it.name)}</span><b>${esc(it.price)}</b></button>`).join('');
        };
        const drawPicked = () => {
            picked.innerHTML = sel.map((n, i) => { const it = priceOf(n); return `<span class="kbs-trtag"><i class="fas fa-wand-magic-sparkles"></i> ${esc(n)}${it ? ` <b>${esc(it.price)}</b>` : ''}<button type="button" data-rm="${i}" aria-label="${esc(n)} entfernen">&times;</button></span>`; }).join('');
            trCount.textContent = `${sel.length}/${TR_MAX} gewählt`; trAdd.disabled = sel.length >= TR_MAX;
        };
        const toggleTr = (name) => {
            name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40); if (!name) return;
            const k = sel.findIndex(x => nkey(x) === nkey(name));
            if (k >= 0) sel.splice(k, 1);
            else if (sel.length >= TR_MAX) { cn.className = 'kba-msg err'; cn.textContent = `Du kannst höchstens ${TR_MAX} Behandlungen wählen.`; return; }
            else sel.push(name);
            cn.className = 'kba-msg'; cn.textContent = ''; drawPicked(); drawCats();
        };
        trcats.onclick = (e) => { const b = e.target.closest('[data-ci]'); if (!b) return; openCat = openCat === +b.dataset.ci ? -1 : +b.dataset.ci; drawCats(); };
        trlist.onclick = (e) => { const b = e.target.closest('[data-ii]'); if (b) toggleTr(cats[openCat].items[+b.dataset.ii].name); };
        picked.onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { sel.splice(+b.dataset.rm, 1); drawPicked(); drawCats(); } };
        const addTyped = () => { const v = tr.value; tr.value = ''; if (v.trim() && !has(v.trim())) toggleTr(v); };
        trAdd.onclick = addTyped;
        tr.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addTyped(); } };
        drawCats(); drawPicked();
        const vbox = o.querySelector('#kbs-vbox'), vinfo = o.querySelector('#kbs-vinfo'), vbar = o.querySelector('#kbs-vbar'), vfill = o.querySelector('#kbs-vfill'), vopt = o.querySelector('#kbs-vopt'), drop = o.querySelector('#kbs-drop'), muBox = o.querySelector('#kbs-mu');
        const mb = (n) => (n / 1048576).toFixed(1).replace('.', ',') + ' MB';
        o.querySelector('#kbs-file').onchange = async (e) => {
            const f = e.target.files[0]; if (!f) return;
            const isVid = /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
            cn.className = 'kba-msg'; cn.textContent = '';
            vblob = null; vdur = 0; vsrc = null; vidDone = ''; vbusy = false; vbox.hidden = true; vopt.hidden = true; vbar.hidden = true; muBox.hidden = false;
            try {
                if (!isVid) { data = await shrink(f); drop.innerHTML = `<img src="${data}" alt="Vorschau">`; }
                else {
                    drop.innerHTML = '<span>Video wird gelesen …</span>';
                    const info = await readVideo(f);
                    if (info.dur > VID_SEC + 0.5) throw new Error(`Dein Video ist ${mmss(info.dur)} Minuten lang – erlaubt sind höchstens 1:30 Minuten.`);
                    data = await shrink(new File([info.poster], 'titelbild.jpg', { type: 'image/jpeg' }));
                    drop.innerHTML = `<img src="${data}" alt="Vorschau"><span class="kbs-vbadge"><i class="fas fa-video"></i> ${mmss(info.dur)}</span>`;
                    music = null; stopMusic(); showPick(); mup.hidden = true; muBox.hidden = true;   // Video bringt seinen eigenen Ton mit
                    vdur = info.dur; vsrc = f; vbox.hidden = false;
                    const needs = f.size > VID_MAX || /quicktime/.test(f.type) || /\.mov$/i.test(f.name) || !/mp4|webm/.test(f.type);
                    if (!needs || (!canCompress() && f.size <= VID_MAX)) { vblob = f; vinfo.textContent = `Video bereit · ${mb(f.size)}`; }
                    else if (!canCompress()) throw new Error('Das Video ist größer als 30 MB und dein Browser kann es nicht verkleinern. Bitte wähle ein kürzeres oder kleineres Video.');
                    else { vbusy = true; vopt.hidden = false; vinfo.textContent = `Das Video (${mb(f.size)}) wird für die Community optimiert. Das dauert etwa so lange wie das Video selbst – bitte die App geöffnet lassen.`; }
                }
            } catch (err) { data = ''; vblob = null; vbusy = false; vbox.hidden = true; drop.innerHTML = '<i class="far fa-image"></i><span>Foto oder Video auswählen</span>'; cn.className = 'kba-msg err'; cn.textContent = err.message; }
            upd();
        };
        vopt.onclick = async () => {
            vopt.hidden = true; vbar.hidden = false; vfill.style.width = '0%'; cn.textContent = '';
            try {
                const r = await compressVideo(vsrc, vdur, (pr) => { vfill.style.width = Math.round(pr * 100) + '%'; vinfo.textContent = `Video wird optimiert … ${Math.round(pr * 100)} %`; }, () => !document.body.contains(o));
                if (r.blob.size > VID_MAX) throw new Error(`Das Video ist auch nach der Optimierung zu groß (${mb(r.blob.size)}). Bitte wähle ein kürzeres.`);
                vblob = r.blob; vbusy = false; vbar.hidden = true; vinfo.textContent = `Video bereit · ${mb(r.blob.size)}${r.noAudio ? ' · ohne Ton (dein Browser konnte den Ton nicht übernehmen)' : ''}`;
            } catch (err) { if (err.message === 'abort') return; vbar.hidden = true; vopt.hidden = false; vinfo.textContent = 'Optimieren hat nicht geklappt.'; cn.className = 'kba-msg err'; cn.textContent = err.message; }
            upd();
        };
        go.onclick = async () => {
            if (tr.value.trim() && sel.length < TR_MAX) addTyped();   // noch nicht mit „+“ bestätigter Text zählt mit
            go.disabled = true; vbusy = true;
            const fail = (msg) => { go.textContent = 'Posten'; vbusy = false; upd(); cn.className = 'kba-msg err'; cn.textContent = msg; };
            if (vblob && !vidDone) {   // Video in 2-MB-Teilen hochladen (Funktions-Limit), jedes Teil bis zu 3× versuchen
                go.textContent = 'Video wird hochgeladen … 0 %';
                const r0 = await call('video_init', { size: vblob.size, mime: vblob.type, dur: vdur });
                if (!r0.ok) return fail(r0.message || 'Das Video konnte nicht hochgeladen werden.');
                for (let i = 0; i < r0.n; i++) {
                    let b64; try { b64 = await blobB64(vblob.slice(i * r0.chunk, (i + 1) * r0.chunk)); } catch (err) { return fail(err.message); }
                    let ok = false, msg = '';
                    for (let t = 0; t < 3 && !ok; t++) { const r1 = await call('video_chunk', { vid: r0.vid, i, data: b64 }); ok = r1.ok; if (!ok) { msg = r1.message || msg; await new Promise(r => setTimeout(r, 800 * (t + 1))); } }
                    if (!ok) return fail(msg || 'Der Upload wurde unterbrochen. Bitte versuche es nochmal.');
                    go.textContent = `Video wird hochgeladen … ${Math.round((i + 1) / r0.n * 100)} %`;
                }
                vidDone = r0.vid;
            }
            go.textContent = 'Wird gepostet …';
            const r = await call('post_create', { video: vidDone ? { vid: vidDone } : undefined, image: data, caption: cap.value.trim(), treatments: sel, music: music ? { id: music.id, start: music.start || 0 } : undefined, comments: o.querySelector('#kbs-cmon').checked });
            if (!r.ok) { vbusy = false; go.textContent = 'Posten'; upd(); cn.className = 'kba-msg err'; cn.textContent = r.message || 'Das hat leider nicht geklappt.'; return; }
            closeModal(); st.feed = null; st.prof = null;
            if (st.sec === 'search') st.sec = 'feed';
            if (st.sec === 'feed') st.scope = 'following';
            render(root);
        };
    }

    observeMedia();

    window.KBSocial = {
        render,
        show: (pid) => { st.sec = 'profile'; st.pid = pid; st.prof = null; },     // geteilter Profil-Link
        invalidate: () => { st.stories = null; st.feed = null; st.results = null; st.people = null; st.prof = null; st.pending = null; }   // nach Profiländerung neu laden
    };
})();
