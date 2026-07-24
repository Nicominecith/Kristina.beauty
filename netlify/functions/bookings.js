import { getStore } from '@netlify/blobs';

function jsonResponse(body, status = 200) {
    return {
        statusCode: status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify(body)
    };
}

const BLOB_KEY = 'bookings-data';

function getBookingsStore() {
    // Netlify Blobs: echter, persistenter Speicher, geteilt von ALLEN
    // Funktions-Aufrufen und Geräten (im Gegensatz zu /tmp, das pro
    // Funktions-Instanz isoliert ist und nach kurzer Zeit wieder verschwindet).
    return getStore('bookings');
}

async function readData() {
    try {
        const store = getBookingsStore();
        const data = await store.get(BLOB_KEY, { type: 'json' });
        return data || {};
    } catch (e) {
        console.error('Fehler beim Lesen der Buchungen:', e);
        return {};
    }
}

async function writeData(data) {
    const store = getBookingsStore();
    await store.setJSON(BLOB_KEY, data);
}

export const handler = async (event) => {
    try {
        if (event.httpMethod === 'OPTIONS') {
            return jsonResponse({}, 200);
        }

        if (event.httpMethod === 'GET') {
            const data = await readData();
            return jsonResponse(data);
        }

        if (event.httpMethod === 'POST') {
            let body = {};
            try { body = JSON.parse(event.body || '{}') || {}; } catch { body = {}; }

            if (body.action === 'reset') {
                await writeData({});
                return jsonResponse({ success: true, message: 'Einnahmen zurückgesetzt' });
            }

            if (body.action === 'delete') {
                const idToDelete = body.id;
                const data = await readData();
                let changed = false;
                for (const key in data) {
                    const initialLen = (data[key] || []).length;
                    data[key] = (data[key] || []).filter(b => b.id !== idToDelete);
                    if (data[key].length !== initialLen) changed = true;
                    if (data[key].length === 0) delete data[key];
                }
                if (changed) await writeData(data);
                return jsonResponse({ success: true });
            }

            const newBooking = body;
            const data = await readData();
            const key = newBooking.key || newBooking.date;

            if (!key) {
                return jsonResponse({ success: false, message: 'Kein Datum/Key angegeben' }, 400);
            }

            if (!data[key]) data[key] = [];

            const existingIdx = data[key].findIndex(b => b.id === newBooking.id);
            if (existingIdx !== -1) {
                data[key][existingIdx] = newBooking;
            } else {
                data[key].push(newBooking);
            }

            await writeData(data);
            return jsonResponse({ success: true });
        }

        return jsonResponse({ message: 'Method not allowed' }, 405);
    } catch (err) {
        console.error('Bookings Handler Error:', err);
        return jsonResponse({ success: false, message: err.message, stack: err.stack }, 500);
    }
};
