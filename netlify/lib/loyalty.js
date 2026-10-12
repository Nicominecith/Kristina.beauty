import { store, newCode, sendMail, escHtml, btn, siteUrl } from './shared.js';

export const STAMP_GOAL = 8;      // 8 Stempel = Treuebonus
export const STAMP_REWARD = 10;   // € Treuebonus
export const REF_REWARD = 5;      // € für beide beim "Freunde werben"
export const BDAY_REWARD = 10;    // € Geburtstagsrabatt

export function customerId({ email, phone, name }) {
    const e = String(email || '').trim().toLowerCase();
    if (e) return 'e_' + e.replace(/[^a-z0-9@._-]/g, '_').slice(0, 100);
    const p = String(phone || '').replace(/\D/g, '');
    if (p) return 'p_' + p.slice(-14);
    return 'n_' + String(name || 'unbekannt').toLowerCase().replace(/[^a-z0-9äöüß]+/g, '_').slice(0, 60);
}

export async function createCoupon(prefix, discount, extra = {}) {
    const co = store('coupons');
    const code = newCode(prefix);
    await co.setJSON('generated/' + code, { discount, label: 'Gutschein', createdAt: new Date().toISOString(), ...extra });
    return code;
}

// Wird aufgerufen, wenn die Mitarbeiterin einen Termin als "erschienen" markiert.
export async function creditVisit(b) {
    const cs = store('customers');
    const id = customerId(b);
    const key = 'c/' + id;
    const c = (await cs.get(key, { type: 'json' }).catch(() => null)) ||
        { id, name: b.name, email: b.email || '', phone: b.phone || '', createdAt: new Date().toISOString(), stamps: 0, visits: 0, rewards: [], notes: '', allergies: '', birthday: '', pmuConsent: null };
    c.name = c.name || b.name; c.email = c.email || b.email || ''; c.phone = c.phone || b.phone || '';
    c.visits = (c.visits || 0) + 1;
    c.stamps = (c.stamps || 0) + 1;
    let reward = null;
    if (c.stamps >= STAMP_GOAL) {
        c.stamps -= STAMP_GOAL;
        const code = await createCoupon('STAMP', STAMP_REWARD, { label: 'Treuebonus', ownerId: id });
        reward = { code, discount: STAMP_REWARD };
        (c.rewards = c.rewards || []).push({ ...reward, type: 'stamp', date: new Date().toISOString() });
    }
    if (!c.refCode) c.refCode = await createCoupon('REF', REF_REWARD, { label: 'Freunde-Code', ownerId: id, referral: true });
    await cs.setJSON(key, c);

    if (c.email) {
        await sendMail(c.email, 'Dein Treuekarten-Stand',
            `<p>Hallo ${escHtml(c.name)}, danke für deinen Besuch!</p>
             <p><b>Stempelkarte: ${c.stamps} / ${STAMP_GOAL}</b></p>
             ${reward ? `<p>🎉 Karte voll! Dein Treuebonus <b>${reward.code}</b> (−${reward.discount} €) gilt für deinen nächsten Termin.</p>` : ''}
             <p>Freunde werben: Dein Code <b>${c.refCode}</b> gibt deiner Freundin ${REF_REWARD} € Rabatt – und du bekommst auch ${REF_REWARD} €, sobald sie ihn einlöst.</p>${btn(siteUrl(), 'Termin buchen')}`);
    }
    return c;
}
