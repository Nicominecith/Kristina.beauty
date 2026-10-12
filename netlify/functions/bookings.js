import { init, withStore, json, parseBody, isAdmin, passwordOk, HOURS, calendarKey,
    bookingDuration, durOf, overlaps, newToken, sendMail, bookingMail, notifyWaitlist, escHtml, deDate, siteUrl, berlinNow, berlinStamp } from '../lib/shared.js';
import { creditVisit } from '../lib/loyalty.js';

const ID_RE = /^[A-Za-z0-9_-]{3,80}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const TOKEN_RE = /^[a-f0-9]{24}$/;
const CHANGE_HOURS = 24; // Absage/Umbuchung per Link bis X Stunden vorher

const text = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

async function loadAll(s) {
    const { blobs } = await s.list({ prefix: 'b/' });
    const items = await Promise.all(blobs.map(b => s.get(b.key, { type: 'json' }).catch(() => null)));
    return items.filter(Boolean);
}

function groupByKey(list) {
    const out = {};
    for (const b of list) {
        const k = b.key || calendarKey(b.date);
        (out[k] = out[k] || []).push(b);
    }
    return out;
}

function validSlot(date, time) {
    if (!DATE_RE.test(date) || !TIME_RE.test(time)) return 'Ungültiges Datum oder Uhrzeit';
    const dow = new Date(date + 'T00:00:00Z').getUTCDay();
    const h = HOURS[dow];
    if (!h) return 'An diesem Tag ist geschlossen';
    if (time < h[0] || time >= h[1]) return 'Diese Uhrzeit liegt außerhalb der Öffnungszeiten';
    return null;
}

// Überlappung mit bestätigten Terminen (andere IDs) am selben Tag
const conflictWith = (all, id, date, time, dur) =>
    all.some(b => b.id !== id && b.status === 'confirmed' && b.date === date && overlaps(time, dur, b.time, durOf(b)));

function cleanBooking(input, id, status) {
    const date = text(input.date, 10);
    const time = text(input.time, 8).replace(/\s*Uhr$/i, '');
    const services = Array.isArray(input.services)
        ? input.services.slice(0, 30).map(x => ({
            name: text(x && x.name, 120), price: Number(x && x.price) || 0,
            quantity: Math.max(1, Math.min(20, parseInt(x && x.quantity) || 1)), cat: text(x && x.cat, 60)
        }))
        : [];
    const codes = Array.isArray(input.appliedDiscountCodes)
        ? input.appliedDiscountCodes.slice(0, 10).map(c => ({ code: text(c && c.code, 40).toUpperCase(), discount: Number(c && c.discount) || 0 }))
        : [];
    return {
        id, key: calendarKey(date), date, time,
        name: text(input.name, 120), email: text(input.email, 160), phone: text(input.phone, 40),
        service: text(input.service, 600), services, notes: text(input.notes, 1000),
        appliedDiscountCodes: codes, dur: services.length ? bookingDuration(services) : (Number(input.dur) || 60),
        total: Math.max(0, Math.min(10000, Number(input.total) || 0)),
        payment: 'cash', status, createdAt: text(input.createdAt, 40) || new Date().toISOString()
    };
}

export const handler = async (event) => {
    init(event);
    if (event.httpMethod === 'OPTIONS') return json({}, 200);
    return withStore('bookings', (s) => run(event, s));
};

const publicView = (b) => ({ id: b.id, key: b.key, date: b.date, time: b.time, status: b.status, dur: durOf(b) });
const hoursUntil = (b) => { const n = berlinNow(); return (berlinStamp(b.date, b.time) - berlinStamp(n.date, `${String(n.hour).padStart(2, '0')}:${String(n.minute).padStart(2, '0')}`)) / 60; };

async function run(event, s) {
    const admin = isAdmin(event);
    const qs = event.queryStringParameters || {};

    // ── Lesen ──────────────────────────────────────────────────
    if (event.httpMethod === 'GET') {
        // Kunde: eigener Termin per geheimem Link-Token
        if (qs.token) {
            if (!TOKEN_RE.test(qs.token)) return json({ success: false, message: 'Ungültiger Link' }, 404);
            const b = (await loadAll(s)).find(x => x.token === qs.token);
            if (!b) return json({ success: false, message: 'Termin nicht gefunden' }, 404);
            return json({ success: true, booking: { id: b.id, name: b.name, date: b.date, time: b.time, service: b.service, total: b.total, status: b.status, dur: durOf(b) }, hoursLeft: Math.round(hoursUntil(b) * 10) / 10, changeHours: CHANGE_HOURS });
        }
        if (qs.waitlist) {
            if (!admin) return json({ success: false, message: 'Nicht erlaubt' }, 401);
            const { blobs } = await s.list({ prefix: 'w/' });
            const list = (await Promise.all(blobs.map(b => s.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean);
            return json({ success: true, list });
        }
        const all = await loadAll(s);
        if (admin) return json(groupByKey(all));
        // Öffentlich (Kalender): Zeiten + Dauer, KEINE Kundendaten, KEIN Token
        return json(groupByKey(all.filter(b => b.status === 'confirmed' || b.status === 'pending').map(publicView)));
    }

    if (event.httpMethod !== 'POST') return json({ message: 'Method not allowed' }, 405);
    const body = parseBody(event);

    if (body.action === 'login') {
        return passwordOk(body.password) ? json({ success: true }) : json({ success: false, message: 'Falsches Passwort' }, 401);
    }

    // ── Warteliste (öffentlich) ────────────────────────────────
    if (body.action === 'waitlist') {
        const date = text(body.date, 10), email = text(body.email, 160);
        if (!DATE_RE.test(date) || !text(body.name, 120) || !/^\S+@\S+\.\S+$/.test(email)) return json({ success: false, message: 'Name, Datum und gültige E-Mail nötig' }, 400);
        const id = `w_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await s.setJSON('w/' + id, { id, date, name: text(body.name, 120), email, phone: text(body.phone, 40), service: text(body.service, 300), createdAt: new Date().toISOString() });
        return json({ success: true });
    }

    // ── Kunde: Absagen / Verschieben per Token ─────────────────
    if (body.action === 'cancel' || body.action === 'reschedule') {
        if (!TOKEN_RE.test(String(body.token || ''))) return json({ success: false, message: 'Ungültiger Link' }, 404);
        const all = await loadAll(s);
        const b = all.find(x => x.token === body.token);
        if (!b) return json({ success: false, message: 'Termin nicht gefunden' }, 404);
        if (b.status !== 'confirmed' && b.status !== 'pending') return json({ success: false, message: 'Dieser Termin ist nicht mehr aktiv.' }, 409);
        if (hoursUntil(b) < CHANGE_HOURS) return json({ success: false, tooLate: true, message: `Online-Änderungen sind nur bis ${CHANGE_HOURS} Stunden vor dem Termin möglich. Bitte ruf kurz an.` }, 403);
        const oldDate = b.date;
        if (body.action === 'cancel') {
            const upd = { ...b, status: 'cancelled', cancelledAt: new Date().toISOString() };
            await s.setJSON('b/' + b.id, upd);
            await sendMail(b.email, ...bookingMail('cancelled', upd));
            await sendMail(process.env.OWNER_EMAIL, 'Termin abgesagt', `<p>${escHtml(b.name)} hat den Termin am ${deDate(b.date)} um ${escHtml(b.time)} abgesagt.</p>`);
            await notifyWaitlist(s, oldDate);
            return json({ success: true });
        }
        const date = text(body.date, 10), time = text(body.time, 8).replace(/\s*Uhr$/i, '');
        const slotError = validSlot(date, time);
        if (slotError) return json({ success: false, message: slotError }, 400);
        if (berlinStamp(date, time) <= berlinStamp(berlinNow().date, `${String(berlinNow().hour).padStart(2, '0')}:00`)) return json({ success: false, message: 'Dieser Zeitpunkt liegt in der Vergangenheit' }, 400);
        if (conflictWith(all, b.id, date, time, durOf(b))) return json({ success: false, conflict: true, message: 'Diese Uhrzeit ist leider bereits belegt.' }, 409);
        // Neuer Termin muss von Kristina erneut bestätigt werden
        const upd = { ...b, date, time, key: calendarKey(date), status: 'pending', reminded: false, rescheduledAt: new Date().toISOString() };
        await s.setJSON('b/' + b.id, upd);
        await sendMail(b.email, ...bookingMail('received', upd));
        await sendMail(process.env.OWNER_EMAIL, 'Termin verschoben (bitte bestätigen)', `<p>${escHtml(b.name)} hat den Termin von ${deDate(oldDate)} ${escHtml(b.time)} auf <b>${deDate(date)} ${escHtml(time)}</b> verschoben.</p>`);
        await notifyWaitlist(s, oldDate);
        return json({ success: true });
    }

    // ── Nur Mitarbeiter ────────────────────────────────────────
    if (body.action === 'reset' || body.action === 'delete' || body.action === 'waitlist_delete') {
        if (!admin) return json({ success: false, message: 'Nicht erlaubt' }, 401);
        if (body.action === 'reset') {
            const { blobs } = await s.list({ prefix: 'b/' });
            await Promise.all(blobs.map(b => s.delete(b.key)));
            return json({ success: true });
        }
        if (!ID_RE.test(String(body.id || ''))) return json({ success: false, message: 'Ungültige ID' }, 400);
        if (body.action === 'waitlist_delete') { await s.delete('w/' + body.id); return json({ success: true }); }
        const old = await s.get('b/' + body.id, { type: 'json' }).catch(() => null);
        await s.delete('b/' + body.id);
        if (old && (old.status === 'confirmed' || old.status === 'pending')) await notifyWaitlist(s, old.date);
        return json({ success: true });
    }

    const all = await loadAll(s);

    if (admin) {
        const id = ID_RE.test(String(body.id || '')) ? body.id : `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const prev = all.find(b => b.id === id);
        const status = ['pending', 'confirmed', 'declined', 'cancelled'].includes(body.status) ? body.status : 'pending';
        const booking = cleanBooking(body, id, status);
        if (!booking.name || !DATE_RE.test(booking.date) || !TIME_RE.test(booking.time)) {
            return json({ success: false, message: 'Name, Datum (JJJJ-MM-TT) und Uhrzeit (HH:MM) sind nötig' }, 400);
        }
        // Server-seitige Felder erhalten (Token, Erinnerungs-Flag, Erschienen …)
        booking.token = prev?.token || newToken();
        booking.reminded = prev ? (prev.reminded && prev.date === booking.date && prev.time === booking.time) : false;
        booking.attended = !!prev?.attended;
        if (!booking.services.length && prev) { booking.services = prev.services || []; booking.dur = prev.dur || booking.dur; }
        if (status === 'confirmed' && conflictWith(all, id, booking.date, booking.time, durOf(booking))) {
            return json({ success: false, message: 'Zu dieser Zeit überschneidet sich der Termin mit einem bestätigten Termin' }, 409);
        }
        if (body.attended === true && !booking.attended) {
            booking.attended = true;
            await creditVisit(booking).catch(e => console.error('Stempel Fehler', e));
        }
        await s.setJSON('b/' + id, booking);
        if (status === 'confirmed' && prev?.status !== 'confirmed') await sendMail(booking.email, ...bookingMail('confirmed', booking));
        if (prev && ['confirmed', 'pending'].includes(prev.status) && ['declined', 'cancelled'].includes(status)) {
            await sendMail(booking.email, ...bookingMail('cancelled', booking));
            await notifyWaitlist(s, prev.date);
        }
        return json({ success: true, booking });
    }

    // ── Kunde: neue Anfrage (immer pending, nur Barzahlung) ───
    const slotError = validSlot(text(body.date, 10), text(body.time, 8).replace(/\s*Uhr$/i, ''));
    if (slotError) return json({ success: false, message: slotError }, 400);
    if (!text(body.name, 120)) return json({ success: false, message: 'Name fehlt' }, 400);

    let id = String(body.id || '');
    if (!ID_RE.test(id) || all.some(b => b.id === id)) id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const booking = cleanBooking(body, id, 'pending');
    booking.token = newToken();
    booking.reminded = false;
    if (conflictWith(all, id, booking.date, booking.time, durOf(booking))) {
        return json({ success: false, conflict: true, message: 'Diese Uhrzeit ist leider bereits belegt oder überschneidet sich mit einem anderen Termin.' }, 409);
    }
    await s.setJSON('b/' + id, booking);
    await sendMail(booking.email, ...bookingMail('received', booking));
    await sendMail(process.env.OWNER_EMAIL, 'Neue Terminanfrage', `<p><b>${escHtml(booking.name)}</b> · ${escHtml(booking.service)}<br>${deDate(booking.date)} ${escHtml(booking.time)} Uhr · ${booking.total} €</p><p><a href="${siteUrl()}/employee_portal.html">Zum Portal</a></p>`);
    return json({ success: true, id, token: booking.token });
}
