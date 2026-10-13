// Community: Posts (Bild + Caption, max. 5 Hashtags), Likes, Beautys (= Follower), Suche nach Posts und Leuten.
// Nur für angemeldete Kundenkonten. Mitarbeiter-Aktionen (admin_*) laufen mit dem Portal-Token.
// Stores: "social" (p/ Posts, i/ Bilder, f/ Folge-Beziehungen) · "accounts" (Konten, x/ öffentliche IDs)
import { createHash, randomBytes } from 'node:crypto';
import { init, withStore, json, parseBody, store, isAdmin, readToken, rateLimit,
    isForbidden, FORBIDDEN_MSG, ensurePid, accountByPid, signAsset, assetOk } from '../lib/shared.js';

const BASE = '/.netlify/functions/social';
const CAPTION_MAX = 600, MAX_TAGS = 5, IMAGE_MAX = 700000, PAGE = 12;
const IMG_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/;
const ID_RE = /^\d{13}_[a-f0-9]{16}_[a-f0-9]{6}$/;
const bad = (msg, code = 400) => json({ success: false, message: msg }, code);
const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max);
const pidOfId = (id) => id.split('_')[1];

export const handler = async (event) => {
    init(event);
    if (event.httpMethod === 'OPTIONS') return json({}, 200);
    if (event.httpMethod === 'GET') return serveAsset(event.queryStringParameters || {});
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
    return { byId, person, imageUrl };
}

async function viewPost(ctx, p, id, myPid) {
    const a = await ctx.byId(p.aid);
    if (!a || a.banned) return null;
    return { id, caption: p.caption, tags: p.tags, createdAt: p.createdAt, likes: (p.likes || []).length, liked: (p.likes || []).includes(myPid),
        mine: p.pid === myPid, image: await ctx.imageUrl(id), author: await ctx.person(a) };
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

    if (act === 'post_create') {
        const m = IMG_RE.exec(String(body.image || ''));
        if (!m || body.image.length > IMAGE_MAX) return bad('Bitte ein gültiges Bild wählen (JPG, PNG oder WebP, nicht zu groß).');
        const magic = Buffer.from(m[2].slice(0, 24), 'base64').toString('latin1');
        if (!(magic.startsWith('\xff\xd8\xff') || magic.startsWith('\x89PNG') || (magic.startsWith('RIFF') && magic.slice(8, 12) === 'WEBP'))) return bad('Die Bilddatei ist ungültig.');
        const caption = clean(body.caption, CAPTION_MAX).replace(/\n{3,}/g, '\n\n');
        const tags = extractTags(caption);
        if (tags.length > MAX_TAGS) return bad(`Maximal ${MAX_TAGS} Hashtags pro Post (du hast ${tags.length}).`);
        if (isForbidden(caption)) return bad(FORBIDDEN_MSG);
        if (!(await rateLimit('post_' + me.id, 10, 3600))) return bad('Du hast gerade viele Beiträge gepostet. Bitte versuche es in einer Stunde erneut.', 429);
        const id = `${String(Date.now()).padStart(13, '0')}_${myPid}_${randomBytes(3).toString('hex')}`;
        await s.set('i/' + id, m[2]);
        await s.setJSON('p/' + id, { aid: me.id, pid: myPid, caption, tags: [...new Set(tags)], mime: 'image/' + m[1], likes: [], createdAt: new Date().toISOString() });
        const p = await s.get('p/' + id, { type: 'json' });
        return json({ success: true, post: await viewPost(ctx, p, id, myPid) });
    }

    if (act === 'post_delete') {
        const id = String(body.id || '');
        if (!ID_RE.test(id)) return bad('Ungültiger Post.');
        const p = await s.get('p/' + id, { type: 'json' }).catch(() => null);
        if (!p) return json({ success: true });
        if (p.aid !== me.id) return bad('Nicht erlaubt.', 403);
        await s.delete('p/' + id); await s.delete('i/' + id).catch(() => {});
        return json({ success: true });
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
                author: a ? a.name : '(Konto gelöscht)', banned: !!(a && a.banned), image: await ctx.imageUrl(ids[i]) });
        }
        return json({ success: true, posts });
    }
    if (act === 'admin_post_delete') {
        const id = String(body.id || '');
        if (!ID_RE.test(id)) return bad('Ungültiger Post.');
        await s.delete('p/' + id).catch(() => {}); await s.delete('i/' + id).catch(() => {});
        return json({ success: true });
    }
    return bad('Unbekannte Aktion');
}
