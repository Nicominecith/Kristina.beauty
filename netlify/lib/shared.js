import { connectLambda, getStore } from '@netlify/blobs';
import { timingSafeEqual } from 'node:crypto';

// WICHTIG: Bei Netlify Functions im "handler"-Format muss Blobs mit dem
// Event verbunden werden. Ohne diesen Aufruf schlägt jedes Speichern/Lesen
// fehl ("The environment has not been configured to use Netlify Blobs").
export function init(event) {
    try { connectLambda(event); } catch (e) { /* lokal / schon konfiguriert */ }
}

export function store(name) {
    return getStore({ name, consistency: 'strong' });
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
