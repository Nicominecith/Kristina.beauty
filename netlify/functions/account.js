// Kunden-Konten: Registrieren, Anmelden, Profil, eigene Termine, Nachrichten an Kristina.
// Mitarbeiter-Aktionen (admin_*, staff_update) laufen über denselben Endpunkt (nur mit Portal-Token).
import { createHash, randomInt } from 'node:crypto';
import { init, withStore, json, parseBody, store, isAdmin, passwordOk, hashPw, pwMatches, signToken, readToken,
    rateLimit, clientIp, newToken, sendMail, sendCodeMail, btn, escHtml, siteUrl, staffToken, staffConfig, berlinNow,
    isForbidden, FORBIDDEN_MSG, purgeSocial } from '../lib/shared.js';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const AVATAR_MAX = 140000;
const SESSION_DAYS = 30;
const BIO_MAX = 300;
const CODE_TTL = 5 * 60 * 1000, RESEND_MS = 30 * 1000;
const codeHash = (code, id) => createHash('sha256').update(code + ':' + id).digest('hex');

// Social-Links: Handle (@name) oder Link. Es werden nur https-Links der jeweiligen Plattform gespeichert.
const LINK_KINDS = {
    instagram: { host: /(^|\.)instagram\.com$/, handle: /^[A-Za-z0-9._]{1,30}$/, make: (h) => 'https://www.instagram.com/' + h },
    tiktok: { host: /(^|\.)tiktok\.com$/, handle: /^[A-Za-z0-9._]{1,24}$/, make: (h) => 'https://www.tiktok.com/@' + h },
    facebook: { host: /(^|\.)(facebook|fb)\.com$/, handle: /^[A-Za-z0-9.]{3,50}$/, make: (h) => 'https://www.facebook.com/' + h },
    youtube: { host: /(^|\.)(youtube\.com|youtu\.be)$/, handle: /^[A-Za-z0-9._-]{3,40}$/, make: (h) => 'https://www.youtube.com/@' + h },
    website: { host: /\./ }
};
const LINK_NAMES = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube', website: 'Website' };
function cleanLink(kind, raw) {
    const v = String(raw ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 200);
    if (!v) return '';
    const k = LINK_KINDS[kind], h = v.replace(/^@/, '');
    if (kind !== 'website' && !/\.(com|be)(\/|$)/i.test(v) && k.handle.test(h)) return k.make(h);
    try {
        const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : 'https://' + v);
        if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
        if (!k.host.test(u.hostname.toLowerCase())) return null;
        u.protocol = 'https:';
        return u.toString().slice(0, 200);
    } catch { return null; }
}
function cleanLinks(obj) {
    const out = {};
    for (const kind of Object.keys(LINK_KINDS)) {
        const r = cleanLink(kind, obj && obj[kind]);
        if (r === null) return { error: `${LINK_NAMES[kind]}: Bitte einen gültigen Link oder @Namen eingeben.` };
        if (r) out[kind] = r;
    }
    return { links: out };
}

const text = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max);
const idOf = (email) => 'e_' + String(email).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_').slice(0, 130);
const bad = (msg, code = 400) => json({ success: false, message: msg }, code);

const me = (a) => ({ email: a.email, name: a.name, phone: a.phone || '', birthday: a.birthday || '', avatar: a.avatar || '', avatarLocked: !!a.avatarLocked, bio: a.bio || '', links: a.links || {}, bioLocked: !!a.bioLocked, createdAt: a.createdAt });
const adminView = (a) => ({ id: a.id, email: a.email, name: a.name, phone: a.phone || '', birthday: a.birthday || '', avatar: a.avatar || '', avatarLocked: !!a.avatarLocked, bio: a.bio || '', links: a.links || {}, bioLocked: !!a.bioLocked, banned: !!a.banned, createdAt: a.createdAt, lastLogin: a.lastLogin || '', resetAt: a.resetAt || '' });

export const handler = async (event) => {
    init(event);
    if (event.httpMethod === 'OPTIONS') return json({}, 200);
    if (event.httpMethod !== 'POST') return json({ message: 'Method not allowed' }, 405);
    return withStore('accounts', (s) => run(event, s));
};

async function customer(event, s) {
    const h = event.headers || {};
    const p = await readToken(String(h.authorization || h.Authorization || '').replace(/^Bearer\s+/i, ''));
    if (!p || p.r !== 'customer') return null;
    const a = await s.get('u/' + p.id, { type: 'json' }).catch(() => null);
    return a && !a.banned && a.v === p.v ? a : null;
}
const session = async (a) => signToken({ r: 'customer', id: a.id, v: a.v }, SESSION_DAYS * 86400);
const save = (s, a) => s.setJSON('u/' + a.id, a);

async function run(event, s) {
    const body = parseBody(event);
    const act = String(body.action || '');
    const ip = clientIp(event);

    // ───────────── Öffentlich ─────────────
    // ── Registrierung & Anmeldung mit E-Mail-Code (6 Ziffern, 5 Min gültig, neuer Code frühestens nach 30 Sek.) ──
    if (act === 'register' || act === 'login' || act === 'code_resend') {
        const kind = act === 'code_resend' ? (body.kind === 'register' ? 'register' : 'login') : act;
        const email = text(body.email, 160).toLowerCase(), id = idOf(email), key = 'c/' + kind + '_' + id;
        const prev = await s.get(key, { type: 'json' }).catch(() => null);
        let pend;
        if (act === 'code_resend') {
            if (!prev) return bad('Die Anfrage ist abgelaufen. Bitte starte neu.', 410);
            const wait = Math.ceil((prev.resendAt - Date.now()) / 1000);
            if (wait > 0) return json({ success: false, message: `Bitte warte noch ${wait} Sekunden.`, wait }, 429);
            pend = prev;
        } else if (act === 'register') {
            if (!(await rateLimit('reg_' + ip, 8, 3600))) return bad('Zu viele Registrierungen. Bitte später erneut versuchen.', 429);
            const name = text(body.name, 80), pw = String(body.password || '');
            if (!EMAIL_RE.test(email)) return bad('Bitte eine gültige E-Mail-Adresse eingeben.');
            if (name.length < 2) return bad('Bitte deinen Namen eingeben.');
            if (isForbidden(name)) return bad(FORBIDDEN_MSG);
            if (pw.length < 8 || pw.length > 100) return bad('Das Passwort braucht mindestens 8 Zeichen.');
            if (await s.get('u/' + id, { type: 'json' }).catch(() => null)) return bad('Mit dieser E-Mail gibt es schon ein Konto. Bitte melde dich an.', 409);
            if (prev && prev.resendAt > Date.now()) {
                const wait = Math.ceil((prev.resendAt - Date.now()) / 1000);
                return pwMatches(pw, prev) && prev.name === name ? json({ success: true, wait, email }) : json({ success: false, message: `Bitte warte noch ${wait} Sekunden, bevor du die Angaben änderst.`, wait }, 429);
            }
            pend = { name, phone: text(body.phone, 40), ...hashPw(pw) };
        } else {
            if (!(await rateLimit('login_' + email + '_' + ip, 8, 600))) return bad('Zu viele Versuche. Bitte warte ein paar Minuten.', 429);
            const a = await s.get('u/' + id, { type: 'json' }).catch(() => null);
            if (!a || !pwMatches(body.password, a)) return bad('E-Mail oder Passwort stimmt nicht.', 401);
            if (a.banned) return bad('Dieses Konto ist gesperrt. Bitte melde dich direkt im Studio.', 403);
            if (prev && prev.resendAt > Date.now()) return json({ success: true, wait: Math.ceil((prev.resendAt - Date.now()) / 1000), email });
            pend = { name: a.name };
        }
        if (!(await rateLimit('code_' + id, 6, 600))) return bad('Zu viele Codes angefordert. Bitte warte ein paar Minuten.', 429);
        const code = String(randomInt(0, 1000000)).padStart(6, '0');
        const rec = { ...pend, kind, codeHash: codeHash(code, id), exp: Date.now() + CODE_TTL, resendAt: Date.now() + RESEND_MS, tries: 0 };
        if (!(await sendCodeMail(email, pend.name, code, kind))) return bad('Die E-Mail konnte nicht gesendet werden. Bitte versuche es später nochmal.', 502);
        await s.setJSON(key, rec);
        return json({ success: true, email, wait: RESEND_MS / 1000, ttl: CODE_TTL / 1000 });
    }

    if (act === 'verify') {
        const kind = body.kind === 'register' ? 'register' : 'login';
        const email = text(body.email, 160).toLowerCase(), id = idOf(email), key = 'c/' + kind + '_' + id;
        const rec = await s.get(key, { type: 'json' }).catch(() => null);
        if (!rec || rec.exp < Date.now()) { if (rec) await s.delete(key).catch(() => {}); return bad('Der Code ist abgelaufen. Bitte fordere einen neuen an.', 410); }
        if (rec.tries >= 5) { await s.delete(key).catch(() => {}); return bad('Zu viele falsche Eingaben. Bitte starte neu.', 429); }
        const code = String(body.code || '').replace(/\D/g, '');
        if (code.length !== 6 || codeHash(code, id) !== rec.codeHash) {
            rec.tries++; await s.setJSON(key, rec);
            return bad(`Der Code stimmt nicht (${5 - rec.tries} Versuche übrig).`, 401);
        }
        await s.delete(key).catch(() => {});
        let a;
        if (kind === 'register') {
            if (await s.get('u/' + id, { type: 'json' }).catch(() => null)) return bad('Mit dieser E-Mail gibt es schon ein Konto. Bitte melde dich an.', 409);
            a = { id, email, name: rec.name, phone: rec.phone || '', birthday: '', avatar: '', bio: '', links: {}, v: 1, createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(), salt: rec.salt, hash: rec.hash };
        } else {
            a = await s.get('u/' + id, { type: 'json' }).catch(() => null);
            if (!a || a.banned) return bad('Anmeldung nicht möglich.', 403);
            a.lastLogin = new Date().toISOString();
        }
        await save(s, a);
        return json({ success: true, token: await session(a), profile: me(a) });
    }

    if (act === 'forgot') {
        if (!(await rateLimit('forgot_' + ip, 5, 3600))) return bad('Zu viele Anfragen. Bitte später erneut versuchen.', 429);
        const email = text(body.email, 160).toLowerCase();
        const a = EMAIL_RE.test(email) ? await s.get('u/' + idOf(email), { type: 'json' }).catch(() => null) : null;
        if (a && !a.banned) {
            const t = newToken();
            await s.setJSON('r/' + t, { id: a.id, exp: Date.now() + 3600000 });
            await sendMail(a.email, 'Passwort zurücksetzen', `<p>Hallo ${escHtml(a.name)}, über diesen Link vergibst du ein neues Passwort (1 Stunde gültig):</p>${btn(siteUrl() + '/?reset=' + t, 'Neues Passwort festlegen')}<p style="font-size:12px;color:#888">Du hast das nicht angefragt? Dann ignoriere diese Mail einfach.</p>`);
        }
        return json({ success: true, message: 'Falls es ein Konto mit dieser E-Mail gibt, ist eine Mail unterwegs. Kommt keine an, schreib Kristina bitte direkt.' });
    }

    if (act === 'reset') {
        const t = String(body.token || '');
        if (!/^[a-f0-9]{24}$/.test(t)) return bad('Der Link ist ungültig.', 404);
        const r = await s.get('r/' + t, { type: 'json' }).catch(() => null);
        if (!r || r.exp < Date.now()) return bad('Der Link ist abgelaufen. Bitte fordere einen neuen an.', 410);
        const pw = String(body.password || '');
        if (pw.length < 8 || pw.length > 100) return bad('Das Passwort braucht mindestens 8 Zeichen.');
        const a = await s.get('u/' + r.id, { type: 'json' }).catch(() => null);
        if (!a) return bad('Konto nicht gefunden.', 404);
        Object.assign(a, hashPw(pw)); a.v = (a.v || 1) + 1;
        await save(s, a); await s.delete('r/' + t).catch(() => {});
        return json({ success: true, token: await session(a), profile: me(a) });
    }

    // ───────────── Mitarbeiter ─────────────
    if (act.startsWith('admin_') || act === 'staff_update' || act === 'staff_info') return staffAction(event, s, body, act);

    // ───────────── Angemeldeter Kunde ─────────────
    const a = await customer(event, s);
    if (!a) return bad('Bitte melde dich an.', 401);

    if (act === 'me') {
        const th = await s.get('m/' + a.id, { type: 'json' }).catch(() => null);
        return json({ success: true, profile: me(a), unread: th ? th.cUnread || 0 : 0 });
    }

    if (act === 'update') {
        const name = text(body.name, 80);
        if (name.length < 2) return bad('Bitte einen Namen eingeben.');
        if (isForbidden(name)) return bad(FORBIDDEN_MSG);
        a.name = name; a.phone = text(body.phone, 40);
        a.birthday = /^\d{4}-\d{2}-\d{2}$/.test(body.birthday || '') ? body.birthday : '';
        if (typeof body.avatar === 'string' && body.avatar !== (a.avatar || '')) {
            if (body.avatar === '') a.avatar = '';
            else if (a.avatarLocked) return bad('Das Profilbild wurde vom Studio gesperrt. Bitte schreib Kristina eine Nachricht.', 403);
            else if (body.avatar.length > AVATAR_MAX || !AVATAR_RE.test(body.avatar)) return bad('Bild ungültig oder zu groß. Bitte ein anderes Foto wählen.');
            else a.avatar = body.avatar;
        }
        // Bio + Social-Links (nur ändern, wenn mitgeschickt)
        const newBio = typeof body.bio === 'string' ? text(body.bio, BIO_MAX).replace(/\n{3,}/g, '\n\n') : (a.bio || '');
        let newLinks = a.links || {};
        if (body.links && typeof body.links === 'object') {
            const r = cleanLinks(body.links);
            if (r.error) return bad(r.error);
            newLinks = r.links;
        }
        const changed = newBio !== (a.bio || '') || JSON.stringify(newLinks) !== JSON.stringify(a.links || {});
        if (changed) {
            if (a.bioLocked) return bad('Deine Bio wurde vom Studio gesperrt. Bitte schreib Kristina eine Nachricht.', 403);
            if (isForbidden(newBio, Object.values(newLinks))) return bad(FORBIDDEN_MSG);
            a.bio = newBio; a.links = newLinks;
        }
        await save(s, a);
        return json({ success: true, profile: me(a) });
    }

    if (act === 'change_password') {
        if (!pwMatches(body.current, a)) return bad('Das aktuelle Passwort stimmt nicht.', 401);
        const pw = String(body.password || '');
        if (pw.length < 8 || pw.length > 100) return bad('Das neue Passwort braucht mindestens 8 Zeichen.');
        Object.assign(a, hashPw(pw)); a.v = (a.v || 1) + 1;
        await save(s, a);
        return json({ success: true, token: await session(a) });
    }

    if (act === 'bookings') {
        const bs = store('bookings');
        const { blobs } = await bs.list({ prefix: 'b/' });
        const all = (await Promise.all(blobs.map(b => bs.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean);
        const mine = all.filter(b => b.accountId === a.id)
            .map(b => ({ id: b.id, date: b.date, time: b.time, service: b.service, total: b.total, status: b.status, token: b.token, attended: !!b.attended }))
            .sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time));
        return json({ success: true, bookings: mine, now: berlinNow().date });
    }

    if (act === 'messages') {
        const th = (await s.get('m/' + a.id, { type: 'json' }).catch(() => null)) || { items: [] };
        if (th.cUnread) { th.cUnread = 0; await s.setJSON('m/' + a.id, th); }
        return json({ success: true, items: th.items || [] });
    }

    if (act === 'send_message') {
        const msg = text(body.text, 1500);
        if (msg.length < 2) return bad('Bitte eine Nachricht eingeben.');
        if (!(await rateLimit('msg_' + a.id, 8, 600))) return bad('Bitte nicht so schnell – versuch es in ein paar Minuten nochmal.', 429);
        const th = (await s.get('m/' + a.id, { type: 'json' }).catch(() => null)) || { id: a.id, items: [], cUnread: 0, sUnread: 0 };
        th.name = a.name; th.email = a.email; th.updatedAt = new Date().toISOString(); th.sUnread = (th.sUnread || 0) + 1;
        th.items = [...(th.items || []), { from: 'c', text: msg, at: th.updatedAt }].slice(-200);
        await s.setJSON('m/' + a.id, th);
        await sendMail(process.env.OWNER_EMAIL, 'Neue Nachricht von ' + a.name, `<p><b>${escHtml(a.name)}</b> (${escHtml(a.email)}) schreibt:</p><p>${escHtml(msg).replace(/\n/g, '<br>')}</p>${btn(siteUrl() + '/employee_portal.html', 'Im Portal antworten')}`);
        return json({ success: true, items: th.items });
    }

    if (act === 'delete_account') {
        if (!pwMatches(body.password, a)) return bad('Das Passwort stimmt nicht.', 401);
        const bs = store('bookings');
        const { blobs } = await bs.list({ prefix: 'b/' });
        for (const bl of blobs) { const b = await bs.get(bl.key, { type: 'json' }).catch(() => null); if (b && b.accountId === a.id) { delete b.accountId; await bs.setJSON(bl.key, b); } }
        await purgeSocial(a);
        await s.delete('u/' + a.id); await s.delete('m/' + a.id).catch(() => {});
        return json({ success: true });
    }

    return bad('Unbekannte Aktion', 400);
}

// ───────────────────────── Mitarbeiter-Aktionen ─────────────────────────
async function staffAction(event, s, body, act) {
    if (!(await isAdmin(event))) return bad('Nicht erlaubt', 401);

    if (act === 'staff_info') { const c = await staffConfig(); return json({ success: true, username: (c && c.username) || '' }); }

    if (act === 'staff_update') {
        if (!(await passwordOk(body.current))) return bad('Das aktuelle Passwort stimmt nicht.', 403);
        const cfg = (await staffConfig()) || {};
        const username = body.username === undefined ? (cfg.username || '') : text(body.username, 40);
        if (body.username !== undefined && username && !/^[\p{L}\p{N} ._-]{3,40}$/u.test(username)) return bad('Account-Name: 3–40 Zeichen (Buchstaben, Zahlen, Leerzeichen, . _ -).');
        const pw = String(body.password || '');
        if (pw && (pw.length < 8 || pw.length > 100)) return bad('Das neue Passwort braucht mindestens 8 Zeichen.');
        const cred = pw ? hashPw(pw) : (cfg.hash ? { salt: cfg.salt, hash: cfg.hash } : hashPw(String(body.current)));
        await store('staff').setJSON('config', { username, ...cred, updatedAt: new Date().toISOString() });
        return json({ success: true, token: await staffToken(), username });
    }

    if (act === 'admin_list') {
        const { blobs } = await s.list({ prefix: 'u/' });
        const accounts = (await Promise.all(blobs.map(b => s.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean).map(adminView)
            .sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt)));
        const tb = await s.list({ prefix: 'm/' });
        const threads = (await Promise.all(tb.blobs.map(b => s.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean)
            .sort((x, y) => String(y.updatedAt).localeCompare(String(x.updatedAt)));
        return json({ success: true, accounts, threads });
    }

    const id = String(body.id || '');
    if (!/^e_[a-z0-9@._-]{1,140}$/.test(id)) return bad('Ungültige ID');
    const a = await s.get('u/' + id, { type: 'json' }).catch(() => null);

    if (act === 'admin_reply') {
        const msg = text(body.text, 1500);
        if (msg.length < 1) return bad('Bitte Text eingeben.');
        const th = (await s.get('m/' + id, { type: 'json' }).catch(() => null)) || { id, items: [], name: a?.name || '', email: a?.email || '', cUnread: 0, sUnread: 0 };
        th.updatedAt = new Date().toISOString(); th.sUnread = 0; th.cUnread = (th.cUnread || 0) + 1;
        th.items = [...(th.items || []), { from: 's', text: msg, at: th.updatedAt }].slice(-200);
        await s.setJSON('m/' + id, th);
        if (a) await sendMail(a.email, 'Neue Nachricht von Kristina Beauty', `<p>Hallo ${escHtml(a.name)}, du hast eine Antwort bekommen:</p><p>${escHtml(msg).replace(/\n/g, '<br>')}</p>${btn(siteUrl() + '/#account', 'Zu meinem Konto')}`);
        return json({ success: true });
    }
    if (act === 'admin_read') {
        const th = await s.get('m/' + id, { type: 'json' }).catch(() => null);
        if (th && th.sUnread) { th.sUnread = 0; await s.setJSON('m/' + id, th); }
        return json({ success: true });
    }
    if (act === 'admin_delete') {
        await purgeSocial(a);
        await s.delete('u/' + id).catch(() => {}); await s.delete('m/' + id).catch(() => {});
        return json({ success: true });
    }
    if (!a) return bad('Konto nicht gefunden', 404);

    if (act === 'admin_reset_profile') {   // entfernt Bild + persönliche Angaben, sperrt neuen Bild-Upload
        a.avatar = ''; a.avatarLocked = true; a.bio = ''; a.links = {}; a.bioLocked = true; a.name = 'Kunde'; a.phone = ''; a.birthday = ''; a.resetAt = new Date().toISOString();
    } else if (act === 'admin_avatar_lock') {
        a.avatarLocked = !!body.locked; if (a.avatarLocked) a.avatar = '';
    } else if (act === 'admin_bio_clear') {    // Bio + Links löschen (z. B. rechtsextreme Inhalte) und weitere Änderungen sperren
        a.bio = ''; a.links = {}; a.bioLocked = true;
    } else if (act === 'admin_bio_unlock') {
        a.bioLocked = false;
    } else if (act === 'admin_ban') {
        a.banned = !!body.banned; a.v = (a.v || 1) + 1;
    } else if (act === 'admin_temp_password') {
        const temp = newToken().slice(0, 10);
        Object.assign(a, hashPw(temp)); a.v = (a.v || 1) + 1;
        await save(s, a);
        return json({ success: true, password: temp });
    } else return bad('Unbekannte Aktion');
    await save(s, a);
    return json({ success: true, account: adminView(a) });
}
