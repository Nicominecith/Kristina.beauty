// Community: Posts (Bild + Caption, max. 5 Hashtags), Likes, Beautys (= Follower), Suche nach Posts und Leuten.
// Nur für angemeldete Kundenkonten. Mitarbeiter-Aktionen (admin_*) laufen mit dem Portal-Token.
// Stores: "social" (p/ Posts, i/ Bilder, f/ Folge-Beziehungen) · "accounts" (Konten, x/ öffentliche IDs)
import { createHash, randomBytes } from 'node:crypto';
import { init, withStore, json, parseBody, store, isAdmin, readToken, rateLimit,
    isForbidden, FORBIDDEN_MSG, ensurePid, accountByPid, signAsset, assetOk, sendMail, escHtml, siteUrl, btn } from '../lib/shared.js';

const BASE = '/.netlify/functions/social';
const TREATMENT_MAX = 40, CAPTION_MAX = 600, COMMENT_MAX = 300, MAX_TAGS = 5, IMAGE_MAX = 700000, PAGE = 12;
const VIDEO_MAX = 30 * 1024 * 1024, VID_CH = 2 * 1024 * 1024, VIDEO_SEC = 90;   // Video: max. 30 MB, 1:30 min; in 2-MB-Teilen gespeichert (Funktions-Limit 6 MB)
const VID_RE = /^[a-f0-9]{24}$/;
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const ID_RE = /^\d{13}_[a-f0-9]{16}_[a-f0-9]{6}$/;
const bad = (msg, code = 400) => json({ success: false, message: msg }, code);
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max);

// ── Musik zum Post (iTunes-Suche: kostenlos, ohne Schlüssel, 30-Sekunden-Vorschau) ──
const okMusicHost = (u) => { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)(itunes\.apple\.com|mzstatic\.com)$/.test(x.hostname); } catch (_) { return false; } };
const toTrack = (r) => (r && r.trackId && r.previewUrl && okMusicHost(r.previewUrl))
    ? { id: String(r.trackId), title: clean(r.trackName, 80), artist: clean(r.artistName, 60), preview: r.previewUrl,
        art: okMusicHost(r.artworkUrl100 || '') ? String(r.artworkUrl100).replace('100x100', '200x200') : '' } : null;
async function itunes(path) {
    const r = await fetch('https://itunes.apple.com/' + path, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) throw new Error('itunes ' + r.status);
    return (await r.json()).results || [];
}
const pidOfId = (id) => id.split('_')[1];

export const handler = async (event) => {
    init(event);
    if (event.httpMethod === 'OPTIONS') return json({}, 200);
    if (event.httpMethod === 'GET') return (event.queryStringParameters || {}).vid ? serveVideo(event.queryStringParameters, event) : serveAsset(event.queryStringParameters || {});
    if (event.httpMethod !== 'POST') return json({ message: 'Method not allowed' }, 405);
    return withStore('social', (s) => run(event, s));
};

// ───────────────────────── Bilder ausliefern (signierte URLs) ─────────────────────────
async function serveAsset(q) {
    const notFound = { statusCode: 404, headers: { 'Cache-Control': 'no-store' }, body: '' };
    try {
        let mime, b64;
        if (q.img) {
            if (!ID_RE.test(q.img) || !(await assetOk('i:' + q.img, q.s))) return notFound;
            const s = store('social');
            const p = await s.get('p/' + q.img, { type: 'json' }).catch(() => null);
            b64 = p && (await s.get('i/' + q.img).catch(() => null));
            mime = p && p.mime;
        } else if (q.avatar) {
            if (!/^[a-f0-9]{16}$/.test(q.avatar) || !(await assetOk('a:' + q.avatar, q.s))) return notFound;
            const a = await accountByPid(store('accounts'), q.avatar);
            const m = a && !a.banned && IMG_RE.exec(a.avatar || '');
            if (m) { mime = 'image/' + m[1]; b64 = m[2]; }
        }
        if (!mime || !b64) return notFound;
        return { statusCode: 200, isBase64Encoded: true, body: b64, headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=43200', 'X-Content-Type-Options': 'nosniff' } };
    } catch (e) { console.error('asset', e); return notFound; }
}

// ───────────────────────── Videos ausliefern (Range-Anfragen, nötig für iPhone/Safari) ─────────────────────────
async function serveVideo(q, event) {
    const nf = { statusCode: 404, headers: { 'Cache-Control': 'no-store' }, body: '' };
    try {
        if (!VID_RE.test(q.vid) || !(await assetOk('v:' + q.vid, q.s))) return nf;
        const s = store('social');
        const m = await s.get('vm/' + q.vid, { type: 'json' }).catch(() => null);
        if (!m || !m.used) return nf;
        const h = event.headers || {}, rg = /^bytes=(\d*)-(\d*)$/.exec(String(h.range || h.Range || ''));
        let start = 0, end = m.size - 1;
        if (rg) {
            if (rg[1] !== '') { start = +rg[1]; if (rg[2] !== '') end = Math.min(+rg[2], end); }
            else if (rg[2] !== '') start = Math.max(0, m.size - +rg[2]);
        }
        if (start >= m.size || start > end) return { statusCode: 416, headers: { 'Content-Range': `bytes */${m.size}` }, body: '' };
        const idx = Math.floor(start / VID_CH);
        end = Math.min(end, Math.min((idx + 1) * VID_CH, m.size) - 1);   // pro Antwort höchstens ein Teil (≤ 2 MB)
        const buf = await s.get(`v/${q.vid}/${idx}`, { type: 'arrayBuffer' });
        if (!buf) return nf;
        const part = Buffer.from(buf).subarray(start - idx * VID_CH, end - idx * VID_CH + 1);
        return { statusCode: 206, isBase64Encoded: true, body: part.toString('base64'), headers: { 'Content-Type': m.mime, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${m.size}`, 'Cache-Control': 'private, max-age=43200', 'X-Content-Type-Options': 'nosniff' } };
    } catch (e) { console.error('video', e); return nf; }
}
// Dauer aus dem MP4-Header lesen (best effort; bei WebM/fragmentiertem MP4 gilt die Größen- und Client-Prüfung)
function mp4Secs(buf) {
    const i = buf.indexOf('mvhd'); if (i < 0 || i + 36 > buf.length) return 0;
    let ts, d;
    if (buf[i + 4] === 1) { ts = buf.readUInt32BE(i + 24); d = Number(buf.readBigUInt64BE(i + 28)); } else { ts = buf.readUInt32BE(i + 16); d = buf.readUInt32BE(i + 20); }
    return ts ? d / ts : 0;
}
async function deleteVideo(s, p) {
    if (!p || !p.video || !VID_RE.test(p.video.vid || '')) return;
    for (let i = 0; i < (p.video.n || 0); i++) await s.delete(`v/${p.video.vid}/${i}`).catch(() => {});
    await s.delete('vm/' + p.video.vid).catch(() => {});
}

// ───────────────────────── Hilfsfunktionen ─────────────────────────
async function customer(event, accs) {
    const h = event.headers || {};
    const p = await readToken(String(h.authorization || h.Authorization || '').replace(/^Bearer\s+/i, ''));
    if (!p || p.r !== 'customer') return null;
    const a = await accs.get('u/' + p.id, { type: 'json' }).catch(() => null);
    return a && !a.banned && a.v === p.v ? a : null;
}
const getF = async (s, pid) => ({ following: [], followers: [], ...((await s.get('f/' + pid, { type: 'json' }).catch(() => null)) || {}) });
const allIds = async (s) => (await s.list({ prefix: 'p/' })).blobs.map((b) => b.key.slice(2)).sort().reverse();
const extractTags = (caption) => [...String(caption).matchAll(/#([\p{L}\p{N}_]{1,30})/gu)].map((m) => m[1].toLowerCase());
const avatarV = (a) => createHash('md5').update(a.avatar).digest('hex').slice(0, 8);

// Pro Anfrage zwischengespeicherte Konto-Zugriffe + Ausgabe-Formate (keine E-Mail-Adressen nach außen!)
function makeCtx(s, accs) {
    const cache = new Map();
    const byId = (aid) => { if (!cache.has(aid)) cache.set(aid, accs.get('u/' + aid, { type: 'json' }).catch(() => null)); return cache.get(aid); };
    const person = async (a) => {
        const pid = await ensurePid(accs, a);
        return { pid, name: a.name, bio: a.bio || '', links: a.links || {},
            avatar: a.avatar ? `${BASE}?avatar=${pid}&v=${avatarV(a)}&s=${await signAsset('a:' + pid)}` : '' };
    };
    const imageUrl = async (id) => `${BASE}?img=${id}&s=${await signAsset('i:' + id)}`;
    const videoUrl = async (vid) => `${BASE}?vid=${vid}&s=${await signAsset('v:' + vid)}`;
    return { byId, person, imageUrl, videoUrl };
}

async function viewPost(ctx, p, id, myPid) {
    const a = await ctx.byId(p.aid);
    if (!a || a.banned) return null;
    return { id, caption: p.caption, treatment: p.treatment || '', music: p.music || null, tags: p.tags, createdAt: p.createdAt, likes: (p.likes || []).length, liked: (p.likes || []).includes(myPid),
        mine: p.pid === myPid, commentsOn: p.commentsOn !== false, cc: p.cc || 0, image: await ctx.imageUrl(id), video: p.video ? { url: await ctx.videoUrl(p.video.vid), dur: p.video.dur, mime: p.video.mime } : null, author: await ctx.person(a) };
}

// Liest Posts der Reihe nach (neueste zuerst), bis das Limit erreicht ist
async function collect(s, ctx, ids, limit, myPid, pred) {
    const out = []; let i = 0;
    while (i < ids.length && out.length < limit) {
        const chunk = ids.slice(i, i + limit); i += chunk.length;
        const recs = await Promise.all(chunk.map((id) => s.get('p/' + id, { type: 'json' }).catch(() => null)));
        for (let k = 0; k < chunk.length && out.length < limit; k++) {
            const p = recs[k];
            if (!p || (pred && !pred(p))) continue;
            const v = await viewPost(ctx, p, chunk[k], myPid);
            if (v) out.push(v);
            if (out.length >= limit) { i = ids.indexOf(chunk[k]) + 1; break; }
        }
    }
    return { posts: out, next: out.length >= limit && i < ids.length ? out[out.length - 1].id : '' };
}

// ───────────────────────── Anfragen ─────────────────────────
async function run(event, s) {
    const body = parseBody(event), act = String(body.action || '');
    if (act.startsWith('admin_')) return adminAction(event, s, body, act);

    const accs = store('accounts');
    const me = await customer(event, accs);
    if (!me) return bad('Bitte melde dich an.', 401);
    const myPid = await ensurePid(accs, me), ctx = makeCtx(s, accs);

    if (act === 'feed') {
        let ids = await allIds(s);
        if (body.scope !== 'all') { const f = await getF(s, myPid), set = new Set([myPid, ...f.following]); ids = ids.filter((id) => set.has(pidOfId(id))); }
        const before = String(body.before || '');
        if (before) ids = ids.filter((id) => id < before);
        return json({ success: true, ...(await collect(s, ctx, ids, PAGE, myPid)) });
    }

    if (act === 'music_search') {
        const q = clean(body.q, 60);
        if (q.length < 2) return json({ success: true, tracks: [] });
        if (!(await rateLimit('music_' + me.id, 60, 600))) return bad('Zu viele Suchanfragen. Bitte warte kurz.', 429);
        try {
            const res = await itunes(`search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=12&country=DE`);
            return json({ success: true, tracks: res.map(toTrack).filter(Boolean) });
        } catch (_) { return bad('Die Musiksuche ist gerade nicht erreichbar. Bitte versuche es gleich nochmal.', 502); }
    }

    if (act === 'search') {
        const q = clean(body.q, 60).toLowerCase();
        if (body.type === 'people') return searchPeople(s, accs, ctx, me, myPid, q);
        if (q.replace(/^#/, '').length < 2) return json({ success: true, posts: [], next: '' });
        const tag = q.replace(/^#/, '').replace(/\s+/g, '');
        const hashOnly = q.startsWith('#');
        const pred = (p) => (p.tags || []).includes(tag) || (!hashOnly && ((p.caption || '').toLowerCase().includes(q) || (p.tags || []).some((t) => t.includes(tag))));
        const ids = (await allIds(s)).slice(0, 150);      // durchsucht die neuesten 150 Posts
        return json({ success: true, ...(await collect(s, ctx, ids, 30, myPid, pred)) });
    }

    if (act === 'profile') {
        const target = body.pid === 'me' || body.pid === myPid ? me : await accountByPid(accs, body.pid);
        if (!target || target.banned) return bad('Profil nicht gefunden.', 404);
        const pid = await ensurePid(accs, target), f = await getF(s, pid);
        const ids = (await allIds(s)).filter((id) => pidOfId(id) === pid);
        const before = String(body.before || '');
        const { posts, next } = await collect(s, ctx, before ? ids.filter((id) => id < before) : ids, 24, myPid);
        return json({ success: true, posts, next, profile: { ...(await ctx.person(target)), isMe: pid === myPid, beautys: f.followers.length,
            following: f.following.length, postCount: ids.length, iFollow: f.followers.includes(myPid) } });
    }

    if (act === 'follow') {
        const target = await accountByPid(accs, body.pid);
        if (!target || target.banned) return bad('Profil nicht gefunden.', 404);
        if (target.pid === myPid) return bad('Du kannst dir nicht selbst folgen.');
        if (!(await rateLimit('fol_' + me.id, 60, 600))) return bad('Bitte langsamer – versuch es gleich nochmal.', 429);
        const mine = await getF(s, myPid), theirs = await getF(s, target.pid), on = body.on !== false;
        mine.following = mine.following.filter((x) => x !== target.pid); theirs.followers = theirs.followers.filter((x) => x !== myPid);
        if (on) {
            if (mine.following.length >= 1000) return bad('Du folgst schon sehr vielen Beautys.');
            mine.following.push(target.pid); theirs.followers.push(myPid);
        }
        await s.setJSON('f/' + myPid, mine); await s.setJSON('f/' + target.pid, theirs);
        return json({ success: true, iFollow: on, beautys: theirs.followers.length });
    }

    if (act === 'like') {
        const id = String(body.id || '');
        if (!ID_RE.test(id)) return bad('Ungültiger Post.');
        if (!(await rateLimit('like_' + me.id, 150, 600))) return bad('Bitte langsamer – versuch es gleich nochmal.', 429);
        const p = await s.get('p/' + id, { type: 'json' }).catch(() => null);
        if (!p) return bad('Post nicht gefunden.', 404);
        const set = new Set(p.likes || []);
        if (body.on === false) set.delete(myPid); else set.add(myPid);
        p.likes = [...set].slice(-5000);
        await s.setJSON('p/' + id, p);
        return json({ success: true, liked: set.has(myPid), likes: p.likes.length });
    }

    if (act === 'report') {   // Beitrag melden → Kristina bekommt eine Mail (Löschen im Portal unter „Community“)
        const id = String(body.id || '');
        if (!ID_RE.test(id)) return bad('Ungültiger Post.');
        if (!(await rateLimit('rep_' + me.id, 10, 3600))) return bad('Bitte langsamer – versuch es gleich nochmal.', 429);
        const p = await s.get('p/' + id, { type: 'json' }).catch(() => null);
        if (!p) return bad('Post nicht gefunden.', 404);
        const rep = new Set(p.reports || []);
        if (rep.has(myPid)) return json({ success: true, already: true });
        rep.add(myPid); p.reports = [...rep].slice(-50);
        await s.setJSON('p/' + id, p);
        await sendMail(process.env.OWNER_EMAIL, `Community: Beitrag gemeldet (${p.reports.length}×)`,
            `<p>Ein Beitrag wurde gemeldet (insgesamt ${p.reports.length}×).</p><p><i>${escHtml(String(p.caption || '(ohne Text)').slice(0, 200))}</i></p><p>Du kannst ihn im Portal unter „Community“ ansehen und mit einem Klick löschen.</p>${btn(siteUrl() + '/employee_portal.html', 'Zum Portal')}`);
        return json({ success: true });
    }

    if (act === 'video_init') {
        const size = Math.floor(Number(body.size)), dur = Number(body.dur);
        if (!(size > 0 && size <= VIDEO_MAX)) return bad(`Das Video ist zu groß (max. ${VIDEO_MAX / 1048576} MB).`);
        if (!(dur > 0 && dur <= VIDEO_SEC + 1)) return bad('Das Video darf höchstens 1:30 Minuten lang sein.');
        if (!(await rateLimit('vid_' + me.id, 5, 3600))) return bad('Du hast gerade mehrere Videos hochgeladen. Bitte versuche es in einer Stunde erneut.', 429);
        const vid = randomBytes(12).toString('hex'), n = Math.ceil(size / VID_CH);
        await s.setJSON('vm/' + vid, { aid: me.id, size, n, dur: Math.round(dur), mime: /webm/.test(String(body.mime || '')) ? 'video/webm' : 'video/mp4', used: false, createdAt: new Date().toISOString() });
        return json({ success: true, vid, chunk: VID_CH, n });
    }
    if (act === 'video_chunk') {
        const vid = String(body.vid || ''); if (!VID_RE.test(vid)) return bad('Ungültiger Upload.');
        const m = await s.get('vm/' + vid, { type: 'json' }).catch(() => null);
        if (!m || m.aid !== me.id || m.used) return bad('Ungültiger Upload.');
        const i = Math.floor(Number(body.i)); if (!(i >= 0 && i < m.n)) return bad('Ungültiger Teil.');
        if (!(await rateLimit('vch_' + me.id, 400, 3600))) return bad('Zu viele Uploads. Bitte warte kurz.', 429);
        const b64 = String(body.data || ''); if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length > 3000000) return bad('Ungültiger Teil.');
        const buf = Buffer.from(b64, 'base64');
        if (buf.length !== (i < m.n - 1 ? VID_CH : m.size - VID_CH * (m.n - 1))) return bad('Der Upload ist unvollständig. Bitte versuche es nochmal.');
        if (i === 0) {
            const mp4 = buf.length > 12 && buf.toString('latin1', 4, 8) === 'ftyp', webm = buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
            if (!mp4 && !webm) return bad('Dieses Videoformat wird nicht unterstützt (MP4, MOV oder WebM).');
            m.mime = webm ? 'video/webm' : 'video/mp4'; await s.setJSON('vm/' + vid, m);
        }
        await s.set(`v/${vid}/${i}`, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
        return json({ success: true });
    }

    if (act === 'post_create') {
        const m = IMG_RE.exec(String(body.image || ''));
        if (!m || body.image.length > IMAGE_MAX) return bad('Bitte ein gültiges Bild wählen (JPG, PNG oder WebP, nicht zu groß).');
        const magic = Buffer.from(m[2].slice(0, 24), 'base64').toString('latin1');
        if (!(magic.startsWith('\xff\xd8\xff') || magic.startsWith('\x89PNG') || (magic.startsWith('RIFF') && magic.slice(8, 12) === 'WEBP'))) return bad('Die Bilddatei ist ungültig.');
        const caption = clean(body.caption, CAPTION_MAX).replace(/\n{3,}/g, '\n\n');
        const tags = extractTags(caption);
        if (tags.length > MAX_TAGS) return bad(`Maximal ${MAX_TAGS} Hashtags pro Post (du hast ${tags.length}).`);
        let music = null;   // optional: Song (wird serverseitig über die ID geprüft, nicht aus dem Browser übernommen)
        const mid = body.music && String(body.music.id || '');
        if (mid) {
            if (!/^\d{3,12}$/.test(mid)) return bad('Der Song ist ungültig.');
            try { music = toTrack((await itunes(`lookup?id=${mid}&country=DE`))[0]); } catch (_) { music = null; }
            if (!music) return bad('Der Song konnte nicht geladen werden. Wähle einen anderen oder poste ohne Musik.');
            music.start = Math.max(0, Math.min(15, Math.round(Number(body.music.start) || 0)));   // gewählte Musikstelle (Start in Sek., Ausschnitt = 15 Sek. der 30-Sek.-Vorschau)
        }
        let video = null, vmeta = null;   // optional: zuvor hochgeladenes Video (Bild = Titelbild)
        const vid = body.video && String(body.video.vid || '');
        if (vid) {
            if (!VID_RE.test(vid)) return bad('Ungültiges Video.');
            vmeta = await s.get('vm/' + vid, { type: 'json' }).catch(() => null);
            if (!vmeta || vmeta.aid !== me.id || vmeta.used) return bad('Das Video ist nicht mehr gültig. Bitte lade es neu hoch.');
            const have = (await s.list({ prefix: `v/${vid}/` })).blobs.length;
            if (have !== vmeta.n) return bad('Das Video wurde nicht vollständig hochgeladen. Bitte versuche es nochmal.');
            if (vmeta.mime === 'video/mp4') {
                const first = await s.get(`v/${vid}/0`, { type: 'arrayBuffer' }), last = vmeta.n > 1 ? await s.get(`v/${vid}/${vmeta.n - 1}`, { type: 'arrayBuffer' }) : null;
                const secs = Math.max(first ? mp4Secs(Buffer.from(first)) : 0, last ? mp4Secs(Buffer.from(last)) : 0);
                if (secs > VIDEO_SEC + 1.5) { await deleteVideo(s, { video: { vid, n: vmeta.n } }); return bad('Das Video darf höchstens 1:30 Minuten lang sein.'); }
                if (secs > 0) vmeta.dur = Math.round(secs);
            }
            video = { vid, n: vmeta.n, size: vmeta.size, mime: vmeta.mime, dur: Math.min(VIDEO_SEC, vmeta.dur) };
            music = null;   // Video bringt seinen eigenen Ton mit
        }
        const treatment = clean(body.treatment, TREATMENT_MAX).replace(/\s+/g, ' ');   // optional: welche Behandlung (z. B. Wimpernlifting, PMU)
        if (isForbidden(caption, treatment)) return bad(FORBIDDEN_MSG);
        if (!(await rateLimit('post_' + me.id, 10, 3600))) return bad('Du hast gerade viele Beiträge gepostet. Bitte versuche es in einer Stunde erneut.', 429);
        const id = `${String(Date.now()).padStart(13, '0')}_${myPid}_${randomBytes(3).toString('hex')}`;
        if (video) await s.setJSON('vm/' + video.vid, { ...vmeta, used: true });
        await s.set('i/' + id, m[2]);
        await s.setJSON('p/' + id, { aid: me.id, pid: myPid, caption, ...(treatment ? { treatment } : {}), ...(music ? { music } : {}), ...(video ? { video } : {}), tags: [...new Set(tags)], mime: 'image/' + m[1], likes: [], commentsOn: body.comments !== false, cc: 0, createdAt: new Date().toISOString() });
        const p = await s.get('p/' + id, { type: 'json' });
        return json({ success: true, post: await viewPost(ctx, p, id, myPid) });
    }

    if (act === 'post_delete') {
        const id = String(body.id || '');
        if (!ID_RE.test(id)) return bad('Ungültiger Post.');
        const p = await s.get('p/' + id, { type: 'json' }).catch(() => null);
        if (!p) return json({ success: true });
        if (p.aid !== me.id) return bad('Nicht erlaubt.', 403);
        await s.delete('p/' + id); await s.delete('i/' + id).catch(() => {}); await s.delete('c/' + id).catch(() => {}); await deleteVideo(s, p);
        return json({ success: true });
    }

    // ───────────── Kommentare ─────────────
    if (act === 'comments' || act === 'comment_add' || act === 'comment_delete' || act === 'comments_toggle') {
        const id = String(body.id || '');
        if (!ID_RE.test(id)) return bad('Ungültiger Post.');
        const p = await s.get('p/' + id, { type: 'json' }).catch(() => null);
        if (!p) return bad('Post nicht gefunden.', 404);
        const owner = p.aid === me.id, on = p.commentsOn !== false;

        if (act === 'comments_toggle') {   // nur der Post-Besitzer
            if (!owner) return bad('Nicht erlaubt.', 403);
            p.commentsOn = body.on !== false;
            await s.setJSON('p/' + id, p);
            return json({ success: true, commentsOn: p.commentsOn });
        }
        const list = (await s.get('c/' + id, { type: 'json' }).catch(() => null)) || [];

        if (act === 'comment_add') {
            if (!on) return bad('Kommentare sind bei diesem Post ausgeschaltet.', 403);
            const t = clean(body.text, COMMENT_MAX).replace(/\n{3,}/g, '\n\n');
            if (t.length < 1) return bad('Bitte einen Kommentar eingeben.');
            if (isForbidden(t)) return bad(FORBIDDEN_MSG);
            if (list.length >= 300) return bad('Bei diesem Post sind keine weiteren Kommentare möglich.');
            if (!(await rateLimit('cm_' + me.id, 20, 600))) return bad('Bitte langsamer – versuch es gleich nochmal.', 429);
            list.push({ cid: randomBytes(5).toString('hex'), pid: myPid, aid: me.id, text: t, at: new Date().toISOString() });
            await s.setJSON('c/' + id, list);
            const fresh = (await s.get('p/' + id, { type: 'json' }).catch(() => null)) || p;
            fresh.cc = list.length; await s.setJSON('p/' + id, fresh);
        } else if (act === 'comment_delete') {   // eigener Kommentar ODER Post-Besitzer
            const k = list.findIndex((c) => c.cid === String(body.cid || ''));
            if (k < 0) return json({ success: true, cc: list.length });
            if (list[k].aid !== me.id && !owner) return bad('Nicht erlaubt.', 403);
            list.splice(k, 1);
            await s.setJSON('c/' + id, list);
            const fresh = (await s.get('p/' + id, { type: 'json' }).catch(() => null)) || p;
            fresh.cc = list.length; await s.setJSON('p/' + id, fresh);
            return json({ success: true, cc: list.length });
        }
        if (!on && !owner) return json({ success: true, commentsOn: false, comments: [], cc: 0 });
        const out = [];
        for (const c of list) {
            const a = await ctx.byId(c.aid);
            if (!a || a.banned) continue;
            out.push({ cid: c.cid, text: c.text, at: c.at, mine: c.aid === me.id, canDelete: owner || c.aid === me.id, author: await ctx.person(a) });
        }
        return json({ success: true, commentsOn: on, comments: out, cc: out.length });
    }

    return bad('Unbekannte Aktion');
}

async function searchPeople(s, accs, ctx, me, myPid, q) {
    const { blobs } = await accs.list({ prefix: 'u/' });
    const all = (await Promise.all(blobs.slice(0, 500).map((b) => accs.get(b.key, { type: 'json' }).catch(() => null))))
        .filter((a) => a && !a.banned && a.id !== me.id && a.name && a.name !== 'Kunde');
    const hit = q.length >= 2
        ? all.filter((a) => (a.name + ' ' + (a.bio || '')).toLowerCase().includes(q.replace(/^@/, '')))
        : all.sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));   // ohne Suchbegriff: neueste Mitglieder
    const mine = await getF(s, myPid), people = [];
    for (const a of hit.slice(0, 20)) {
        const p = await ctx.person(a);
        people.push({ ...p, bio: p.bio.slice(0, 120), iFollow: mine.following.includes(p.pid) });
    }
    return json({ success: true, people });
}

// ───────────────────────── Mitarbeiter: Posts moderieren ─────────────────────────
async function adminAction(event, s, body, act) {
    if (!(await isAdmin(event))) return bad('Nicht erlaubt', 401);
    const accs = store('accounts'), ctx = makeCtx(s, accs);
    if (act === 'admin_posts') {
        const ids = (await allIds(s)).slice(0, 80);
        const recs = await Promise.all(ids.map((id) => s.get('p/' + id, { type: 'json' }).catch(() => null)));
        const posts = [];
        for (let i = 0; i < ids.length; i++) {
            const p = recs[i]; if (!p) continue;
            const a = await ctx.byId(p.aid);
            posts.push({ id: ids[i], caption: p.caption, tags: p.tags || [], likes: (p.likes || []).length, createdAt: p.createdAt,
                author: a ? a.name : '(Konto gelöscht)', banned: !!(a && a.banned), image: await ctx.imageUrl(ids[i]), video: p.video ? await ctx.videoUrl(p.video.vid) : '' });
        }
        return json({ success: true, posts });
    }
    if (act === 'admin_post_delete') {
        const id = String(body.id || '');
        if (!ID_RE.test(id)) return bad('Ungültiger Post.');
        const pv = await s.get('p/' + id, { type: 'json' }).catch(() => null);
        await s.delete('p/' + id).catch(() => {}); await s.delete('i/' + id).catch(() => {}); await s.delete('c/' + id).catch(() => {}); await deleteVideo(s, pv);
        return json({ success: true });
    }
    return bad('Unbekannte Aktion');
}
