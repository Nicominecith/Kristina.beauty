import { promises as fs } from 'fs';
import path from 'path';
import { COUPONS } from './coupon-data.js';

const isNetlify = process.env.NETLIFY === 'true' || process.env.NETLIFY_DEV === 'true';
const redeemedFile = isNetlify
    ? path.resolve('/tmp', 'redeemed_codes.json')
    : path.resolve(process.cwd(), 'redeemed_codes.json');

function jsonResponse(body, status = 200) {
    return {
        statusCode: status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    };
}

async function ensureRedeemedFile() {
    try {
        await fs.access(redeemedFile);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await fs.writeFile(redeemedFile, '[]', 'utf8');
        } else {
            throw err;
        }
    }
}

async function loadRedeemedCodes() {
    await ensureRedeemedFile();
    const content = await fs.readFile(redeemedFile, 'utf8');
    try {
        return JSON.parse(content);
    } catch (err) {
        return [];
    }
}

async function saveRedeemedCodes(codes) {
    const normalized = Array.from(new Set(codes.map(c => c.toUpperCase())));
    await fs.writeFile(redeemedFile, JSON.stringify(normalized, null, 2), 'utf8');
}

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return jsonResponse({ success: false, message: 'Nur POST erlaubt' }, 405);
    }

    let body;
    try {
        body = JSON.parse(event.body || '{}');
    } catch (err) {
        return jsonResponse({ success: false, message: 'Ungültiger Request-Body' }, 400);
    }

    const codes = Array.isArray(body.codes)
        ? body.codes.map(String).map(c => c.trim().toUpperCase()).filter(Boolean)
        : [];

    if (codes.length === 0) {
        return jsonResponse({ success: false, message: 'Keine Gutscheine übergeben' }, 400);
    }

    const invalidCodes = codes.filter(code => !COUPONS[code]);
    if (invalidCodes.length > 0) {
        return jsonResponse({ success: false, message: 'Ungültige Gutscheincodes', invalidCodes }, 400);
    }

    const redeemed = await loadRedeemedCodes();
    const alreadyRedeemed = codes.filter(code => redeemed.includes(code));
    if (alreadyRedeemed.length > 0) {
        return jsonResponse({ success: false, message: 'Bereits eingelöste Gutscheine', alreadyRedeemed }, 409);
    }

    await saveRedeemedCodes([...redeemed, ...codes]);
    return jsonResponse({ success: true, codes });
};
