import { init, withStore, json, parseBody, isAdmin, passwordOk, HOURS, calendarKey } from '../lib/shared.js';

const ID_RE = /^[A-Za-z0-9_-]{3,80}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

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
        appliedDiscountCodes: codes,
        total: Math.max(0, Math.min(10000, Number(input.total) || 0)),
        status, createdAt: text(input.createdAt, 40) || new Date().toISOString()
    };
}

export const handler = async (event) => {
    init(event);
    if (event.httpMethod === 'OPTIONS') return json({}, 200);
    return withStore('bookings', (s) => run(event, s));
};

async function run(event, s) {
    {
        const admin = isAdmin(event);

        // ── Lesen ──────────────────────────────────────────────────
        if (event.httpMethod === 'GET') {
            const all = await loadAll(s);
            if (admin) return json(groupByKey(all));
            // Öffentlich (Kalender): bestätigte und angefragte Zeiten, KEINE Kundendaten
            const pub = all.filter(b => b.status === 'confirmed' || b.status === 'pending')
                .map(b => ({ id: b.id, key: b.key, date: b.date, time: b.time, status: b.status }));
            return json(groupByKey(pub));
        }

        if (event.httpMethod !== 'POST') return json({ message: 'Method not allowed' }, 405);
        const body = parseBody(event);

        if (body.action === 'login') {
            return passwordOk(body.password) ? json({ success: true }) : json({ success: false, message: 'Falsches Passwort' }, 401);
        }

        // ── Nur Mitarbeiter ────────────────────────────────────────
        if (body.action === 'reset' || body.action === 'delete') {
            if (!admin) return json({ success: false, message: 'Nicht erlaubt' }, 401);
            if (body.action === 'reset') {
                const { blobs } = await s.list({ prefix: 'b/' });
                await Promise.all(blobs.map(b => s.delete(b.key)));
                return json({ success: true });
            }
            if (!ID_RE.test(String(body.id || ''))) return json({ success: false, message: 'Ungültige ID' }, 400);
            await s.delete('b/' + body.id);
            return json({ success: true });
        }

        // ── Speichern ──────────────────────────────────────────────
        const all = await loadAll(s);

        if (admin) {
            // Mitarbeiter: neu anlegen oder bestehende Buchung ändern (auch Datum/Uhrzeit/Status)
            const id = ID_RE.test(String(body.id || '')) ? body.id : `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const status = ['pending', 'confirmed', 'declined'].includes(body.status) ? body.status : 'pending';
            const booking = cleanBooking(body, id, status);
            if (!booking.name || !DATE_RE.test(booking.date) || !TIME_RE.test(booking.time)) {
                return json({ success: false, message: 'Name, Datum (JJJJ-MM-TT) und Uhrzeit (HH:MM) sind nötig' }, 400);
            }
            if (status === 'confirmed' && all.some(b => b.id !== id && b.status === 'confirmed' && b.date === booking.date && b.time === booking.time)) {
                return json({ success: false, message: 'Zu dieser Zeit gibt es schon einen bestätigten Termin' }, 409);
            }
            await s.setJSON('b/' + id, booking);
            return json({ success: true, booking });
        }

        // Kunde: darf nur eine NEUE Anfrage (pending) senden
        const slotError = validSlot(text(body.date, 10), text(body.time, 8).replace(/\s*Uhr$/i, ''));
        if (slotError) return json({ success: false, message: slotError }, 400);
        if (!text(body.name, 120)) return json({ success: false, message: 'Name fehlt' }, 400);

        let id = String(body.id || '');
        if (!ID_RE.test(id) || all.some(b => b.id === id)) id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const booking = cleanBooking(body, id, 'pending');
        if (all.some(b => b.status === 'confirmed' && b.date === booking.date && b.time === booking.time)) {
            return json({ success: false, conflict: true, message: 'Diese Uhrzeit ist leider bereits belegt.' }, 409);
        }
        await s.setJSON('b/' + id, booking);
        return json({ success: true, id });
    }
}
