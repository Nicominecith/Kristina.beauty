// Kunden-Konten: Registrieren, Anmelden, Profil, eigene Termine, Nachrichten an Kristina.
// Mitarbeiter-Aktionen (admin_*, staff_update) laufen über denselben Endpunkt (nur mit Portal-Token).
import { init, withStore, json, parseBody, store, isAdmin, passwordOk, hashPw, pwMatches, signToken, readToken,
    rateLimit, clientIp, newToken, sendMail, btn, escHtml, siteUrl, staffToken, staffConfig, berlinNow } from '../lib/shared.js';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const AVATAR_MAX = 140000;
const SESSION_DAYS = 30;

const text = (v, max) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, max);
const idOf = (email) => 'e_' + String(email).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_').slice(0, 130);
const bad = (msg, code = 400) => json({ success: false, message: msg }, code);

const me = (a) => ({ email: a.email, name: a.name, phone: a.phone || '', birthday: a.birthday || '', avatar: a.avatar || '', avatarLocked: !!a.avatarLocked, createdAt: a.createdAt });
const adminView = (a) => ({ id: a.id, email: a.email, name: a.name, phone: a.phone || '', birthday: a.birthday || '', avatar: a.avatar || '', avatarLocked: !!a.avatarLocked, banned: !!a.banned, createdAt: a.createdAt, lastLogin: a.lastLogin || '', resetAt: a.resetAt || '' });

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
    if (act === 'register') {
        if (!(await rateLimit('reg_' + ip, 8, 3600))) return bad('Zu viele Registrierungen. Bitte später erneut versuchen.', 429);
        const email = text(body.email, 160).toLowerCase(), name = text(body.name, 80), pw = String(body.password || '');
        if (!EMAIL_RE.test(email)) return bad('Bitte eine gültige E-Mail-Adresse eingeben.');
        if (name.length < 2) return bad('Bitte deinen Namen eingeben.');
        if (pw.length < 8 || pw.length > 100) return bad('Das Passwort braucht mindestens 8 Zeichen.');
        const id = idOf(email);
        if (await s.get('u/' + id, { type: 'json' }).catch(() => null)) return bad('Mit dieser E-Mail gibt es schon ein Konto. Bitte melde dich an.', 409);
        const a = { id, email, name, phone: text(body.phone, 40), birthday: '', avatar: '', v: 1, createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(), ...hashPw(pw) };
        await save(s, a);
        return json({ success: true, token: await session(a), profile: me(a) });
    }

    if (act === 'login') {
        const email = text(body.email, 160).toLowerCase();
        if (!(await rateLimit('login_' + email + '_' + ip, 8, 600))) return bad('Zu viele Versuche. Bitte warte ein paar Minuten.', 429);
        const a = await s.get('u/' + idOf(email), { type: 'json' }).catch(() => null);
        if (!a || !pwMatches(body.password, a)) return bad('E-Mail oder Passwort stimmt nicht.', 401);
        if (a.banned) return bad('Dieses Konto ist gesperrt. Bitte melde dich direkt im Studio.', 403);
        a.lastLogin = new Date().toISOString();
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
        a.name = name; a.phone = text(body.phone, 40);
        a.birthday = /^\d{4}-\d{2}-\d{2}$/.test(body.birthday || '') ? body.birthday : '';
        if (typeof body.avatar === 'string' && body.avatar !== (a.avatar || '')) {
            if (body.avatar === '') a.avatar = '';
            else if (a.avatarLocked) return bad('Das Profilbild wurde vom Studio gesperrt. Bitte schreib Kristina eine Nachricht.', 403);
            else if (body.avatar.length > AVATAR_MAX || !AVATAR_RE.test(body.avatar)) return bad('Bild ungültig oder zu groß. Bitte ein anderes Foto wählen.');
            else a.avatar = body.avatar;
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
        await s.delete('u/' + id).catch(() => {}); await s.delete('m/' + id).catch(() => {});
        return json({ success: true });
    }
    if (!a) return bad('Konto nicht gefunden', 404);

    if (act === 'admin_reset_profile') {   // entfernt Bild + persönliche Angaben, sperrt neuen Bild-Upload
        a.avatar = ''; a.avatarLocked = true; a.name = 'Kunde'; a.phone = ''; a.birthday = ''; a.resetAt = new Date().toISOString();
    } else if (act === 'admin_avatar_lock') {
        a.avatarLocked = !!body.locked; if (a.avatarLocked) a.avatar = '';
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
