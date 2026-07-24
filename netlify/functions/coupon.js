import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const COUPONS = {
    'LIFT3': { discount: 3, label: 'LIFT3', requiresCat: 'Liftings' },
    'SAVE5-A8K2P': { discount: 5 }, 'SAVE5-B3M9L': { discount: 5 }, 'SAVE5-C7X4J': { discount: 5 },
    'SAVE5-D1N6H': { discount: 5 }, 'SAVE5-E9V2Q': { discount: 5 }, 'SAVE5-F5G8R': { discount: 5 },
    'SAVE5-G2T3W': { discount: 5 }, 'SAVE5-H4K7Y': { discount: 5 }, 'SAVE5-J6B9U': { discount: 5 },
    'SAVE5-K8L1N': { discount: 5 }, 'SAVE5-L3P5M': { discount: 5 }, 'SAVE5-M7Q9V': { discount: 5 },
    'SAVE5-N2R4X': { discount: 5 }, 'SAVE5-P5W8T': { discount: 5 }, 'SAVE5-Q9C1D': { discount: 5 },
    'SAVE5-R4F6G': { discount: 5 }, 'SAVE5-S1H3J': { discount: 5 }, 'SAVE5-T7K9L': { discount: 5 },
    'SAVE5-U3M5P': { discount: 5 }, 'SAVE5-V8N2Q': { discount: 5 }, 'SAVE5-W6X4R': { discount: 5 },
    'SAVE5-X9Y1T': { discount: 5 }, 'SAVE5-Y2Z5W': { discount: 5 }, 'SAVE5-Z4B8K': { discount: 5 },
    'SAVE5-A7D3M': { discount: 5 },
    'SAVE15-M9K2P': { discount: 15 }, 'SAVE15-N3L8J': { discount: 15 }, 'SAVE15-P7X4G': { discount: 15 },
    'SAVE15-Q1V6H': { discount: 15 }, 'SAVE15-R5W9D': { discount: 15 }, 'SAVE15-S2T4B': { discount: 15 },
    'SAVE15-T8G1M': { discount: 15 }, 'SAVE15-U4Y7K': { discount: 15 }, 'SAVE15-V6N3P': { discount: 15 },
    'SAVE15-W9B5L': { discount: 15 }, 'SAVE15-X2D8R': { discount: 15 }, 'SAVE15-Y5F1Q': { discount: 15 },
    'SAVE15-Z8H4T': { discount: 15 }, 'SAVE15-A3M6W': { discount: 15 }, 'SAVE15-B7K9N': { discount: 15 },
    'SAVE15-C1P5Y': { discount: 15 }, 'SAVE15-D4V2X': { discount: 15 }, 'SAVE15-E9G7B': { discount: 15 },
    'SAVE15-F2L4D': { discount: 15 }, 'SAVE15-G6R1K': { discount: 15 }, 'SAVE15-H9T5M': { discount: 15 },
    'SAVE15-J3X8P': { discount: 15 }, 'SAVE15-K7N2W': { discount: 15 }, 'SAVE15-L1B6Q': { discount: 15 },
    'SAVE15-M5D9Y': { discount: 15 },
    'SAVE30-X8K2P': { discount: 30 }, 'SAVE30-Y4M7L': { discount: 30 }, 'SAVE30-Z9X3J': { discount: 30 },
    'SAVE30-A2V6H': { discount: 30 }, 'SAVE30-B5W9Q': { discount: 30 }, 'SAVE30-C1T4R': { discount: 30 },
    'SAVE30-D7G8W': { discount: 30 }, 'SAVE30-E3Y5Y': { discount: 30 }, 'SAVE30-F6B1U': { discount: 30 },
    'SAVE30-G9L4N': { discount: 30 }, 'SAVE30-H2P7M': { discount: 30 }, 'SAVE30-J5Q3V': { discount: 30 },
    'SAVE30-K8R6X': { discount: 30 }, 'SAVE30-L1W9T': { discount: 30 }, 'SAVE30-M4C2D': { discount: 30 },
    'SAVE30-N7F5G': { discount: 30 }, 'SAVE30-P2H8J': { discount: 30 }, 'SAVE30-Q5K1L': { discount: 30 },
    'SAVE30-R9M4P': { discount: 30 }, 'SAVE30-S3N7Q': { discount: 30 }, 'SAVE30-T6X2R': { discount: 30 },
    'SAVE30-U9Y5T': { discount: 30 }, 'SAVE30-V2Z8W': { discount: 30 }, 'SAVE30-W5B1K': { discount: 30 },
    'SAVE30-X8D4M': { discount: 30 },
    'SAVE50-K9A2P': { discount: 50 }, 'SAVE50-L3B7M': { discount: 50 }, 'SAVE50-M7C4J': { discount: 50 },
    'SAVE50-N1D6H': { discount: 50 }, 'SAVE50-P5E9Q': { discount: 50 }, 'SAVE50-Q9F3R': { discount: 50 },
    'SAVE50-R2G8W': { discount: 50 }, 'SAVE50-S6H1Y': { discount: 50 }, 'SAVE50-T4J5U': { discount: 50 },
    'SAVE50-U8K3N': { discount: 50 }, 'SAVE50-V1L7M': { discount: 50 }, 'SAVE50-W5M2V': { discount: 50 },
    'SAVE50-X9N6X': { discount: 50 }, 'SAVE50-Y3P1T': { discount: 50 }, 'SAVE50-Z7Q5D': { discount: 50 },
    'SAVE50-A2R9G': { discount: 50 }, 'SAVE50-B6S4J': { discount: 50 }, 'SAVE50-C1T8L': { discount: 50 },
    'SAVE50-D5U3P': { discount: 50 }, 'SAVE50-E9V7Q': { discount: 50 }, 'SAVE50-F2W1R': { discount: 50 },
    'SAVE50-G6X5T': { discount: 50 }, 'SAVE50-H1Y9W': { discount: 50 }, 'SAVE50-J5Z4K': { discount: 50 },
    'SAVE50-K8A6M': { discount: 50 }
};

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

export const handler = async (event) => {
    // Nutzt os.tmpdir(), da dies der einzige beschreibbare Pfad auf Netlify ist
    const REDEEMED_FILE = path.join(os.tmpdir(), 'redeemed_list.json');
    const GENERATED_FILE = path.join(os.tmpdir(), 'generated_coupons.json');

    // OPTIONS für CORS Preflight
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse({}, 200);
    }

    try {
        // 1. Eingelöste Codes laden
        let redeemedData = [];
        try {
            const content = await fs.readFile(REDEEMED_FILE, 'utf8');
            const parsed = JSON.parse(content);
            redeemedData = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            redeemedData = [];
        }
        
        // 2. Generierte Mitarbeiter-Codes laden
        let generatedCoupons = {};
        try {
            const genContent = await fs.readFile(GENERATED_FILE, 'utf8');
            const parsedGen = JSON.parse(genContent);
            generatedCoupons = (parsedGen && typeof parsedGen === 'object') ? parsedGen : {};
        } catch (e) {
            generatedCoupons = {};
        }

        if (event.httpMethod === 'GET') {
            const code = event.queryStringParameters?.code?.toUpperCase();
            if (!code) return jsonResponse({ valid: false, message: 'Code fehlt' }, 400);

            const config = COUPONS[code] || generatedCoupons[code];
            if (!config) return jsonResponse({ valid: false, message: 'Ungültiger Code' }, 404);

            // LIFT3 ist ein Spezialfall: Er ist auf GET-Ebene immer "gültig", 
            // da die Namensprüfung erst beim Einlösen (POST) stattfindet.
            if (code === 'LIFT3') {
                return jsonResponse({ valid: true, code, discount: 3, label: 'LIFT3', requiresCat: 'Liftings' });
            }

            // Alle anderen Codes sind global einmalig
            if (redeemedData.includes(code)) {
                return jsonResponse({ valid: false, redeemed: true, message: 'Code bereits verwendet' }, 409);
            }

            return jsonResponse({
                valid: true,
                code,
                discount: config.discount,
                label: config.label || code,
                requiresCat: config.requiresCat || null
            });
        }

        if (event.httpMethod === 'POST') {
            let body;
            try {
                // Netlify kann den Body manchmal base64-codiert senden
                const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body;
                body = JSON.parse(rawBody || '{}');
            } catch (err) {
                return jsonResponse({ success: false, message: 'Ungültiges JSON im Request' }, 400);
            }
            
            const { action, codes, customerName } = body;

            if (action === 'generate') {
                const discount = parseInt(body.discount) || 10;
                const newCode = 'EMP-' + Math.random().toString(36).substring(2, 9).toUpperCase();
                generatedCoupons[newCode] = { discount, label: 'Gutschein' };
                await fs.writeFile(GENERATED_FILE, JSON.stringify(generatedCoupons), 'utf8');
                return jsonResponse({ success: true, code: newCode, discount });
            }

            if (action === 'redeem' && Array.isArray(codes)) {
                let updatedRedeemed = [...redeemedData];

                if (codes.includes('LIFT3')) {
                    if (!customerName) {
                        return jsonResponse({ success: false, message: 'Kundenname für LIFT3 erforderlich' }, 400);
                    }
                    const liftKey = `LIFT3_${customerName.trim().toUpperCase()}`;
                    if (redeemedData.includes(liftKey)) {
                        return jsonResponse({ success: false, message: `LIFT3 wurde von ${customerName} bereits einmal genutzt.` }, 409);
                    }
                    updatedRedeemed.push(liftKey);
                }

                const otherCodes = codes.filter(c => c !== 'LIFT3');
                for (const c of otherCodes) {
                    const normalized = c.toUpperCase();
                    if (redeemedData.includes(normalized)) {
                        return jsonResponse({ success: false, message: `Gutschein ${c} wurde bereits verwendet.` }, 409);
                    }
                    updatedRedeemed.push(normalized);
                }

                await fs.writeFile(REDEEMED_FILE, JSON.stringify([...new Set(updatedRedeemed)]), 'utf8');
                return jsonResponse({ success: true });
            }
        }

        return jsonResponse({ message: 'Method not allowed' }, 405);
    } catch (err) {
        console.error('Coupon Error:', err);
        return jsonResponse({ success: false, message: err.message }, 500);
    }
};