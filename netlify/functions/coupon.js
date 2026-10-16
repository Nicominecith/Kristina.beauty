import { init, withStore, json, parseBody, isAdmin, sendMail, escHtml, store, newCode, trFor, langOf } from '../lib/shared.js';
import { createCoupon, REF_REWARD } from '../lib/loyalty.js';
import { COUPONS } from '../lib/coupon-data.js';

const CODE_RE = /^[A-Z0-9-]{3,40}$/;

async function findCoupon(s, code) {
    if (COUPONS[code]) return COUPONS[code];
    if (/^(EMP|STAMP|REF|FRIEND|BDAY)-/.test(code)) return await s.get('generated/' + code, { type: 'json' }).catch(() => null);
    return null;
}

const isRedeemed = async (s, code) => !!(await s.get('redeemed/' + code, { type: 'text' }).catch(() => null));

export const handler = async (event) => {
    init(event);
    if (event.httpMethod === 'OPTIONS') return json({}, 200);
    return withStore('coupons', (s) => run(event, s));
};

async function run(event, s) {
    {

        if (event.httpMethod === 'GET') {
            if (event.queryStringParameters?.list) {
                if (!(await isAdmin(event))) return json({ success: false, message: 'Nicht erlaubt' }, 401);
                const { blobs } = await s.list({ prefix: 'generated/' });
                const items = await Promise.all(blobs.map(async b => { const c = await s.get(b.key, { type: 'json' }).catch(() => null); const code = b.key.slice(10); return c && { code, discount: c.discount, createdAt: c.createdAt, redeemed: await isRedeemed(s, code) }; }));
                return json({ success: true, list: items.filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 100) });
            }
            const code = String(event.queryStringParameters?.code || '').trim().toUpperCase();
            if (!code) return json({ valid: false, message: 'Code fehlt' }, 400);
            if (!CODE_RE.test(code)) return json({ valid: false, message: 'Ungültiger Code' }, 404);

            const config = await findCoupon(s, code);
            if (!config) return json({ valid: false, message: 'Ungültiger Code' }, 404);

            // LIFT3 wird erst beim Einlösen pro Kundenname geprüft
            if (code !== 'LIFT3' && await isRedeemed(s, code)) {
                return json({ valid: false, redeemed: true, message: 'Code bereits verwendet' }, 409);
            }
            return json({ valid: true, code, discount: config.discount, label: config.label || code, requiresCat: config.requiresCat || null });
        }

        if (event.httpMethod !== 'POST') return json({ message: 'Method not allowed' }, 405);
        const body = parseBody(event);

        if (body.action === 'generate') {
            if (!(await isAdmin(event))) return json({ success: false, message: 'Nicht erlaubt' }, 401);
            const discount = Math.max(1, Math.min(500, parseInt(body.discount, 10) || 10));
            let code;
            // Kollisionen ausschließen, bevor ein neuer Gutschein gespeichert wird.
            for (let attempt = 0; attempt < 5; attempt++) {
                code = newCode('EMP');
                if (!(await s.get('generated/' + code, { type: 'json' }).catch(() => null))) break;
                code = null;
            }
            if (!code) return json({ success: false, message: 'Code konnte nicht erstellt werden. Bitte erneut versuchen.' }, 500);
            await s.setJSON('generated/' + code, { discount, label: 'Gutschein', createdAt: new Date().toISOString() });
            return json({ success: true, code, discount });
        }

        if (body.action === 'delete' || body.action === 'deleteCoupon') {
            if (!(await isAdmin(event))) return json({ success: false, message: 'Nicht erlaubt' }, 401);
            const code = String(body.code || '').trim().toUpperCase();
            if (!CODE_RE.test(code) || !/^(EMP|STAMP|REF|FRIEND|BDAY)-/.test(code)) {
                return json({ success: false, message: 'Ungültiger oder nicht löschbarer Code' }, 400);
            }
            const existing = await s.get('generated/' + code, { type: 'json' }).catch(() => null);
            if (!existing) return json({ success: false, message: 'Gutschein wurde nicht gefunden' }, 404);
            await s.delete('generated/' + code);
            await s.delete('redeemed/' + code).catch(() => {});
            return json({ success: true, code });
        }

        if (body.action === 'redeem' && Array.isArray(body.codes)) {
            const codes = [...new Set(body.codes.map(c => String(c).trim().toUpperCase()).filter(Boolean))];
            const toWrite = [];

            for (const code of codes) {
                if (!CODE_RE.test(code) || !(await findCoupon(s, code))) {
                    return json({ success: false, message: `Gutschein ${code} ist ungültig.` }, 400);
                }
                if (code === 'LIFT3') {
                    const name = String(body.customerName || '').trim().toUpperCase();
                    if (!name) return json({ success: false, message: 'Kundenname für LIFT3 erforderlich' }, 400);
                    const liftKey = 'redeemed/LIFT3_' + name.replace(/[^A-Z0-9ÄÖÜß]+/g, '_').slice(0, 80);
                    if (await s.get(liftKey, { type: 'text' }).catch(() => null)) {
                        return json({ success: false, message: `LIFT3 wurde von ${body.customerName} bereits einmal genutzt.` }, 409);
                    }
                    toWrite.push(liftKey);
                } else {
                    if (await isRedeemed(s, code)) return json({ success: false, message: `Gutschein ${code} wurde bereits verwendet.` }, 409);
                    toWrite.push('redeemed/' + code);
                }
            }
            await Promise.all(toWrite.map(k => s.set(k, new Date().toISOString())));
            // Freunde werben: Wer einen REF-Code einlöst, schenkt der Werberin ebenfalls einen Gutschein
            for (const code of codes.filter(c => c.startsWith('REF-'))) {
                try {
                    const cfg = await findCoupon(s, code);
                    if (!cfg || !cfg.ownerId) continue;
                    const cust = await store('customers').get('c/' + cfg.ownerId, { type: 'json' }).catch(() => null);
                    if (!cust) continue;
                    const reward = await createCoupon('FRIEND', REF_REWARD, { ownerId: cfg.ownerId });
                    (cust.rewards = cust.rewards || []).push({ code: reward, discount: REF_REWARD, type: 'referral', date: new Date().toISOString() });
                    await store('customers').setJSON('c/' + cfg.ownerId, cust);
                    { const lg = langOf(cust.lang), t = trFor(lg); await sendMail(cust.email, t('Danke fürs Weiterempfehlen!'), `<p>${t('Hallo')} ${escHtml(cust.name)}, ${t('deine Freundin hat deinen Code eingelöst. Dein Gutschein:')} <b>${reward}</b> (−${REF_REWARD} €).</p>`, { lang: lg }); }
                } catch (e) { console.error('Referral Fehler', e); }
            }
            return json({ success: true });
        }

        if (body.action === 'release' && Array.isArray(body.codes)) {
            // Buchung ist nach dem Einlösen gescheitert → Codes wieder freigeben (nur kurz nach dem Einlösen)
            const name = String(body.customerName || '').trim().toUpperCase();
            for (const raw of body.codes.slice(0, 10)) {
                const code = String(raw).trim().toUpperCase();
                if (!CODE_RE.test(code)) continue;
                const key = code === 'LIFT3' ? 'redeemed/LIFT3_' + name.replace(/[^A-Z0-9ÄÖÜß]+/g, '_').slice(0, 80) : 'redeemed/' + code;
                const at = await s.get(key, { type: 'text' }).catch(() => null);
                if (at && Date.now() - new Date(at).getTime() < 180000) await s.delete(key).catch(() => {});
            }
            return json({ success: true });
        }

        return json({ success: false, message: 'Unbekannte Aktion' }, 400);
    }
}
