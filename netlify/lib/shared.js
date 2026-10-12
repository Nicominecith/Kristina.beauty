import { connectLambda, getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';

// WICHTIG: Bei Netlify Functions im "handler"-Format muss Blobs mit dem
// Event verbunden werden. Ohne diesen Aufruf schlägt jedes Speichern/Lesen
// fehl ("The environment has not been configured to use Netlify Blobs").
export function init(event) {
    try { connectLambda(event); } catch (e) { /* lokal / schon konfiguriert */ }
}

export function store(name, mode = 'strong') {
    return mode === 'strong' ? getStore({ name, consistency: 'strong' }) : getStore({ name });
}

// Führt die Funktion zuerst mit "strong" aus. Klappt das in dieser Netlify-Umgebung
// nicht, wird automatisch mit dem Standard-Modus wiederholt.
export async function withStore(name, run) {
    try {
        return await run(store(name, 'strong'));
    } catch (e1) {
        console.error('Blobs strong fehlgeschlagen, versuche Standard:', e1 && e1.message);
        try {
            return await run(store(name, 'eventual'));
        } catch (e2) {
            console.error('Blobs Fehler:', e2);
            return json({ success: false, message: 'Serverfehler beim Speichern/Lesen', detail: String((e2 && e2.message) || e2).slice(0, 300) }, 500);
        }
    }
}

export function json(body, status = 200) {
    return {
        statusCode: status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, X-Portal-Key',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify(body)
    };
}

export function parseBody(event) {
    try {
        const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString() : (event.body || '{}');
        const parsed = JSON.parse(raw || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

// Mitarbeiter-Passwort: In Netlify unter Site configuration → Environment variables
// als PORTAL_PASSWORD setzen. Ohne Variable gilt das alte Passwort als Übergang.
function portalPassword() {
    return process.env.PORTAL_PASSWORD || 'beauty2026';
}

export function passwordOk(candidate) {
    const a = Buffer.from(String(candidate || ''));
    const b = Buffer.from(portalPassword());
    return a.length === b.length && timingSafeEqual(a, b);
}

export function isAdmin(event) {
    const headers = event.headers || {};
    return passwordOk(headers['x-portal-key'] || headers['X-Portal-Key']);
}

// Öffnungszeiten (0 = Sonntag) – wie im Kalender im Frontend
export const HOURS = {
    0: ['09:30', '18:00'], 1: null, 2: ['17:30', '20:00'], 3: ['16:00', '18:00'],
    4: null, 5: ['09:30', '16:00'], 6: ['09:30', '18:00']
};

export function calendarKey(dateIso) {
    const [y, m, d] = String(dateIso).split('-').map(Number);
    return `${y}-${m - 1}-${d}`;
}

// ───────────────────────── Behandlungsdauern (Minuten) ─────────────────────────
// Feste Dauern pro Leistung → verhindert überlappende Termine.
const DUR_CAT = { 'Lashes Neuauflage': 150, 'Refill': 60, 'Liftings': 60, 'Permanent Make Up': 150, 'Facials': 60, 'Facials Pakete': 60, 'Remover': 60 };
const DUR_NAME = [
    [/1:1 Classic/i, 120], [/Mega Volume|Foxy/i, 180], [/Wimpern entfernen/i, 30],
    [/Refill bis 2/i, 60], [/Refill bis 3/i, 75], [/Refill bis 4/i, 90],
    [/Browlifting/i, 45], [/Korean/i, 90], [/Kombilifting/i, 90], [/^(Farbe|Shape|Shape & Farbe)$/i, 30],
    [/Kombibrows/i, 180], [/Microneedling 45/i, 45], [/Deluxe 70/i, 70], [/Lachs-DNA/i, 60], [/BB Glow Augenringe/i, 30],
    [/Kombipaket/i, 120]
];
export function serviceMinutes(cat, name) {
    for (const [re, m] of DUR_NAME) if (re.test(String(name || ''))) return m;
    return DUR_CAT[cat] || 60;
}
export function bookingDuration(services) {
    if (!Array.isArray(services) || !services.length) return 60;
    // Pakete (3er/6er) = nur 1 Sitzung pro Termin
    const sum = services.reduce((t, s) => t + serviceMinutes(s.cat, s.name) * (/\d+er Paket/i.test(s.name) ? 1 : Math.max(1, s.quantity || 1)), 0);
    return Math.max(15, Math.min(480, sum));
}
export const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
export const overlaps = (aTime, aDur, bTime, bDur) => toMin(aTime) < toMin(bTime) + bDur && toMin(bTime) < toMin(aTime) + aDur;
export const durOf = (b) => Number(b.dur) || bookingDuration(b.services);

// ───────────────────────── Zeit (Europe/Berlin) ─────────────────────────
export function berlinNow() {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date()).map(x => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute, md: `${p.month}-${p.day}` };
}
// "Pseudo-UTC"-Minuten für Differenzen in Berlin-Ortszeit
export const berlinStamp = (date, time) => { const [y, m, d] = date.split('-').map(Number); const [h, mi] = time.split(':').map(Number); return Date.UTC(y, m - 1, d, h, mi) / 60000; };

// ───────────────────────── Tokens, Codes, Mail ─────────────────────────
import { randomBytes } from 'node:crypto';
export const newToken = () => randomBytes(12).toString('hex');
export const newCode = (prefix) => prefix + '-' + randomBytes(5).toString('base64').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 7).padEnd(7, 'X');
export const siteUrl = () => (process.env.SITE_URL || process.env.URL || 'https://kristinabeauty.netlify.app').replace(/\/$/, '');
export const manageLink = (token) => `${siteUrl()}/?manage=${token}`;
export const escHtml = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const deDate = (iso) => { const [y, m, d] = String(iso).split('-'); return `${d}.${m}.${y}`; };

// Mailversand über Resend (RESEND_API_KEY). Ohne Key: stiller Skip, nichts bricht.
// Env: RESEND_API_KEY, MAIL_FROM (verifizierte Absenderadresse), OWNER_EMAIL (Kristina)
export async function sendMail(to, subject, bodyHtml) {
    const key = process.env.RESEND_API_KEY;
    if (!key || !to) return false;
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#222;line-height:1.55">
      <h2 style="font-family:Georgia,serif;letter-spacing:.15em;color:#C5A880;margin:0 0 16px">KRISTINA BEAUTY</h2>${bodyHtml}
      <p style="color:#888;font-size:12px;margin-top:28px">Zahlung erfolgt bar vor Ort. · Kristina Beauty, Wedel</p></div>`;
    try {
        const r = await fetch('https://api.resend.com/emails', {
            method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: process.env.MAIL_FROM || 'Kristina Beauty <onboarding@resend.dev>', to: [to], subject, html })
        });
        if (!r.ok) console.error('Mail Fehler', r.status, await r.text().catch(() => ''));
        return r.ok;
    } catch (e) { console.error('Mail Fehler', e); return false; }
}
export const btn = (href, label) => `<p><a href="${href}" style="display:inline-block;background:#C5A880;color:#fff;text-decoration:none;padding:12px 22px;border-radius:30px;font-size:13px;letter-spacing:.1em">${label}</a></p>`;

export function bookingMail(kind, b) {
    const info = `<p><b>${escHtml(b.service)}</b><br>${deDate(b.date)} um ${escHtml(b.time)} Uhr<br>Preis: ${Number(b.total || 0).toFixed(2).replace('.', ',')} € – bar vor Ort</p>`;
    const manage = b.token ? `<p style="font-size:13px">Termin absagen oder verschieben:</p>${btn(manageLink(b.token), 'Termin verwalten')}` : '';
    const t = {
        received: ['Deine Terminanfrage ist eingegangen', `<p>Hallo ${escHtml(b.name)}, danke für deine Anfrage! Ich bestätige sie so schnell wie möglich.</p>${info}${manage}`],
        confirmed: ['Dein Termin ist bestätigt ✓', `<p>Hallo ${escHtml(b.name)}, dein Termin ist bestätigt.</p>${info}<p>Bitte bring den Betrag passend in bar mit.</p>${manage}`],
        reminder: ['Erinnerung: Dein Termin morgen', `<p>Hallo ${escHtml(b.name)}, ich erinnere dich an deinen Termin in ca. 24 Stunden.</p>${info}${manage}`],
        cancelled: ['Dein Termin wurde abgesagt', `<p>Hallo ${escHtml(b.name)}, dein Termin wurde abgesagt.</p>${info}${btn(siteUrl(), 'Neuen Termin buchen')}`]
    }[kind];
    return t;
}

// Warteliste: informiert alle, die für diesen Tag eingetragen sind, sobald etwas frei wird
export async function notifyWaitlist(s, date) {
    const { blobs } = await s.list({ prefix: 'w/' });
    for (const bl of blobs) {
        const w = await s.get(bl.key, { type: 'json' }).catch(() => null);
        if (!w || w.date !== date || w.notified) continue;
        const ok = await sendMail(w.email, 'Ein Termin ist frei geworden!',
            `<p>Hallo ${escHtml(w.name)}, am ${deDate(date)} ist ein Termin frei geworden. Wer zuerst bucht, bekommt ihn:</p>${btn(siteUrl() + '/#booking', 'Jetzt buchen')}`);
        if (ok) await s.setJSON(bl.key, { ...w, notified: new Date().toISOString() });
    }
}
