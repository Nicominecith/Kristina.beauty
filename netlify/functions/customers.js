import { init, json, parseBody, isAdmin, store } from '../lib/shared.js';
import { customerId } from '../lib/loyalty.js';

const t = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, ' ').trim().slice(0, n);

// Digitale Kundenkartei – nur für Mitarbeiter
export const handler = async (event) => {
    init(event);
    if (event.httpMethod === 'OPTIONS') return json({}, 200);
    if (!isAdmin(event)) return json({ success: false, message: 'Nicht erlaubt' }, 401);
    try {
        const s = store('customers');
        if (event.httpMethod === 'GET') {
            const { blobs } = await s.list({ prefix: 'c/' });
            const list = (await Promise.all(blobs.map(b => s.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean);
            return json({ success: true, list });
        }
        const body = parseBody(event);
        if (body.action === 'delete') { await s.delete('c/' + t(body.id, 120)); return json({ success: true }); }
        if (!t(body.name, 120)) return json({ success: false, message: 'Name fehlt' }, 400);
        const id = t(body.id, 120) || customerId(body);
        const prev = (await s.get('c/' + id, { type: 'json' }).catch(() => null)) || { id, createdAt: new Date().toISOString(), stamps: 0, visits: 0, rewards: [] };
        const consent = body.pmuConsent;
        const c = {
            ...prev, id, name: t(body.name, 120), email: t(body.email, 160), phone: t(body.phone, 40),
            birthday: /^\d{4}-\d{2}-\d{2}$|^\d{2}-\d{2}$/.test(body.birthday || '') ? body.birthday : '',
            allergies: t(body.allergies, 1000), notes: t(body.notes, 3000),
            stamps: Math.max(0, Math.min(7, parseInt(body.stamps ?? prev.stamps) || 0)),
            pmuConsent: consent && consent.given ? { given: true, date: t(consent.date, 10) || new Date().toISOString().slice(0, 10) } : null
        };
        await s.setJSON('c/' + id, c);
        return json({ success: true, customer: c });
    } catch (e) {
        console.error(e);
        return json({ success: false, message: 'Serverfehler' }, 500);
    }
};
