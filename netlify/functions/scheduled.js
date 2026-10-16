// Läuft stündlich (Netlify Scheduled Function):
//  • Erinnerungsmail ca. 24 h vor dem Termin
//  • täglich ~7 Uhr: Zusammenfassung an die Inhaberin
//  • Geburtstagsgutschein am Geburtstag
import { store, sendMail, bookingMail, berlinNow, berlinStamp, escHtml, deDate, durOf, siteUrl, btn, ownerEmail, trFor, langOf } from '../lib/shared.js';
import { createCoupon, BDAY_REWARD } from '../lib/loyalty.js';

export const config = { schedule: '0 * * * *' };

export default async () => {
    const bs = store('bookings');
    const now = berlinNow();
    const nowStamp = berlinStamp(now.date, `${String(now.hour).padStart(2, '0')}:${String(now.minute).padStart(2, '0')}`);
    const { blobs } = await bs.list({ prefix: 'b/' });
    const all = (await Promise.all(blobs.map(b => bs.get(b.key, { type: 'json' }).catch(() => null)))).filter(Boolean);

    // 1) Erinnerungen (Termin liegt in 0–24 h, noch nicht erinnert)
    let reminded = 0;
    for (const b of all) {
        if (b.status !== 'confirmed' || b.reminded || !b.email) continue;
        const diffH = (berlinStamp(b.date, b.time) - nowStamp) / 60;
        if (diffH > 0 && diffH <= 24) {
            if (await sendMail(b.email, ...bookingMail('reminder', b))) { await bs.setJSON('b/' + b.id, { ...b, reminded: true }); reminded++; }
        }
    }

    // 2) Tägliche Zusammenfassung (einmalig, ab 7 Uhr)
    let summary = false;
    if (now.hour >= 7 && ownerEmail()) {
        const flag = 'daily/' + now.date;
        if (!(await bs.get(flag, { type: 'text' }).catch(() => null))) {
            const today = all.filter(b => b.date === now.date && b.status === 'confirmed').sort((a, b) => a.time.localeCompare(b.time));
            const pending = all.filter(b => b.status === 'pending').length;
            const rows = today.map(b => `<li><b>${escHtml(b.time)}</b> – ${escHtml(b.name)} · ${escHtml(b.service)} (${durOf(b)} Min.) · ${Number(b.total || 0)} €${b.phone ? ' · ' + escHtml(b.phone) : ''}</li>`).join('');
            const sum = today.reduce((t, b) => t + (Number(b.total) || 0), 0);
            const ok = await sendMail(ownerEmail(), `Tagesübersicht ${deDate(now.date)}`,
                `<p>Guten Morgen! Heute: <b>${today.length}</b> Termin(e), erwartet <b>${sum} €</b> (bar).</p>${rows ? `<ul>${rows}</ul>` : '<p>Heute keine bestätigten Termine.</p>'}
                 <p>Offene Anfragen: <b>${pending}</b></p>${btn(siteUrl() + '/employee_portal.html', 'Zum Portal')}`);
            if (ok) { await bs.set(flag, '1'); summary = true; }
        }
    }

    // 3) Geburtstage (einmal pro Jahr je Kundin)
    let bdays = 0;
    if (now.hour >= 8) {
        const cs = store('customers');
        const { blobs: cb } = await cs.list({ prefix: 'c/' });
        for (const bl of cb) {
            const c = await cs.get(bl.key, { type: 'json' }).catch(() => null);
            if (!c || !c.birthday || !c.email) continue;
            if (c.birthday.slice(-5) !== now.md || c.bdayYear === now.date.slice(0, 4)) continue;
            const code = await createCoupon('BDAY', BDAY_REWARD, { ownerId: c.id, label: 'Geburtstagsrabatt' });
            { const lg = langOf(c.lang), t = trFor(lg); await sendMail(c.email, t('Alles Gute zum Geburtstag! 🎂'), `<p>${t('Liebe')} ${escHtml(c.name)}, ${t('alles Gute zum Geburtstag! Als kleines Geschenk:')} <b>${code}</b> (−${BDAY_REWARD} €) ${t('für deinen nächsten Termin.')}</p>${btn(siteUrl(), t('Termin buchen'))}`, { lang: lg }); }
            c.bdayYear = now.date.slice(0, 4);
            (c.rewards = c.rewards || []).push({ code, discount: BDAY_REWARD, type: 'birthday', date: new Date().toISOString() });
            await cs.setJSON(bl.key, c); bdays++;
        }
    }
    console.log(JSON.stringify({ reminded, summary, bdays }));
};
