import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const port = process.env.PORT || 3000;
const rootDir = path.resolve();
const redeemedFile = path.join(rootDir, 'redeemed_codes.json');

const COUPONS = {
    'LIFT3': { discount: 3, label: 'LIFT3', requiresCat: 'Liftings' },

    'SAVE5-A8K2P': { discount: 5 },
    'SAVE5-B3M9L': { discount: 5 },
    'SAVE5-C7X4J': { discount: 5 },
    'SAVE5-D1N6H': { discount: 5 },
    'SAVE5-E9V2Q': { discount: 5 },
    'SAVE5-F5G8R': { discount: 5 },
    'SAVE5-G2T3W': { discount: 5 },
    'SAVE5-H4K7Y': { discount: 5 },
    'SAVE5-J6B9U': { discount: 5 },
    'SAVE5-K8L1N': { discount: 5 },
    'SAVE5-L3P5M': { discount: 5 },
    'SAVE5-M7Q9V': { discount: 5 },
    'SAVE5-N2R4X': { discount: 5 },
    'SAVE5-P5W8T': { discount: 5 },
    'SAVE5-Q9C1D': { discount: 5 },
    'SAVE5-R4F6G': { discount: 5 },
    'SAVE5-S1H3J': { discount: 5 },
    'SAVE5-T7K9L': { discount: 5 },
    'SAVE5-U3M5P': { discount: 5 },
    'SAVE5-V8N2Q': { discount: 5 },
    'SAVE5-W6X4R': { discount: 5 },
    'SAVE5-X9Y1T': { discount: 5 },
    'SAVE5-Y2Z5W': { discount: 5 },
    'SAVE5-Z4B8K': { discount: 5 },
    'SAVE5-A7D3M': { discount: 5 },

    'SAVE15-M9K2P': { discount: 15 },
    'SAVE15-N3L8J': { discount: 15 },
    'SAVE15-P7X4G': { discount: 15 },
    'SAVE15-Q1V6H': { discount: 15 },
    'SAVE15-R5W9D': { discount: 15 },
    'SAVE15-S2T4B': { discount: 15 },
    'SAVE15-T8G1M': { discount: 15 },
    'SAVE15-U4Y7K': { discount: 15 },
    'SAVE15-V6N3P': { discount: 15 },
    'SAVE15-W9B5L': { discount: 15 },
    'SAVE15-X2D8R': { discount: 15 },
    'SAVE15-Y5F1Q': { discount: 15 },
    'SAVE15-Z8H4T': { discount: 15 },
    'SAVE15-A3M6W': { discount: 15 },
    'SAVE15-B7K9N': { discount: 15 },
    'SAVE15-C1P5Y': { discount: 15 },
    'SAVE15-D4V2X': { discount: 15 },
    'SAVE15-E9G7B': { discount: 15 },
    'SAVE15-F2L4D': { discount: 15 },
    'SAVE15-G6R1K': { discount: 15 },
    'SAVE15-H9T5M': { discount: 15 },
    'SAVE15-J3X8P': { discount: 15 },
    'SAVE15-K7N2W': { discount: 15 },
    'SAVE15-L1B6Q': { discount: 15 },
    'SAVE15-M5D9Y': { discount: 15 },

    'SAVE30-X8K2P': { discount: 30 },
    'SAVE30-Y4M7L': { discount: 30 },
    'SAVE30-Z9X3J': { discount: 30 },
    'SAVE30-A2V6H': { discount: 30 },
    'SAVE30-B5W9Q': { discount: 30 },
    'SAVE30-C1T4R': { discount: 30 },
    'SAVE30-D7G8W': { discount: 30 },
    'SAVE30-E3Y5Y': { discount: 30 },
    'SAVE30-F6B1U': { discount: 30 },
    'SAVE30-G9L4N': { discount: 30 },
    'SAVE30-H2P7M': { discount: 30 },
    'SAVE30-J5Q3V': { discount: 30 },
    'SAVE30-K8R6X': { discount: 30 },
    'SAVE30-L1W9T': { discount: 30 },
    'SAVE30-M4C2D': { discount: 30 },
    'SAVE30-N7F5G': { discount: 30 },
    'SAVE30-P2H8J': { discount: 30 },
    'SAVE30-Q5K1L': { discount: 30 },
    'SAVE30-R9M4P': { discount: 30 },
    'SAVE30-S3N7Q': { discount: 30 },
    'SAVE30-T6X2R': { discount: 30 },
    'SAVE30-U9Y5T': { discount: 30 },
    'SAVE30-V2Z8W': { discount: 30 },
    'SAVE30-W5B1K': { discount: 30 },
    'SAVE30-X8D4M': { discount: 30 },

    'SAVE50-K9A2P': { discount: 50 },
    'SAVE50-L3B7M': { discount: 50 },
    'SAVE50-M7C4J': { discount: 50 },
    'SAVE50-N1D6H': { discount: 50 },
    'SAVE50-P5E9Q': { discount: 50 },
    'SAVE50-Q9F3R': { discount: 50 },
    'SAVE50-R2G8W': { discount: 50 },
    'SAVE50-S6H1Y': { discount: 50 },
    'SAVE50-T4J5U': { discount: 50 },
    'SAVE50-U8K3N': { discount: 50 },
    'SAVE50-V1L7M': { discount: 50 },
    'SAVE50-W5M2V': { discount: 50 },
    'SAVE50-X9N6X': { discount: 50 },
    'SAVE50-Y3P1T': { discount: 50 },
    'SAVE50-Z7Q5D': { discount: 50 },
    'SAVE50-A2R9G': { discount: 50 },
    'SAVE50-B6S4J': { discount: 50 },
    'SAVE50-C1T8L': { discount: 50 },
    'SAVE50-D5U3P': { discount: 50 },
    'SAVE50-E9V7Q': { discount: 50 },
    'SAVE50-F2W1R': { discount: 50 },
    'SAVE50-G6X5T': { discount: 50 },
    'SAVE50-H1Y9W': { discount: 50 },
    'SAVE50-J5Z4K': { discount: 50 },
    'SAVE50-K8A6M': { discount: 50 }
};

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

app.use(express.json());
app.use(express.static(rootDir));

app.get('/api/coupon/:code', async (req, res) => {
    const code = String(req.params.code || '').trim().toUpperCase();
    if (!code) {
        return res.status(400).json({ valid: false, message: 'Code fehlt' });
    }

    const definition = COUPONS[code];
    if (!definition) {
        return res.status(404).json({ valid: false, message: 'Ungültiger Code' });
    }

    const redeemed = await loadRedeemedCodes();
    if (redeemed.includes(code)) {
        return res.status(409).json({
            valid: false,
            redeemed: true,
            discount: definition.discount,
            message: 'Gutschein wurde bereits verwendet'
        });
    }

    return res.json({
        valid: true,
        code,
        discount: definition.discount,
        label: definition.label || code,
        requiresCat: definition.requiresCat || null
    });
});

app.post('/api/redeem', async (req, res) => {
    const codes = Array.isArray(req.body.codes) ? req.body.codes.map(String).map(c => c.trim().toUpperCase()).filter(Boolean) : [];
    if (codes.length === 0) {
        return res.status(400).json({ success: false, message: 'Keine Gutscheine übergeben' });
    }

    const invalidCodes = codes.filter(code => !COUPONS[code]);
    if (invalidCodes.length > 0) {
        return res.status(400).json({ success: false, message: 'Ungültige Gutscheincodes', invalidCodes });
    }

    const redeemed = await loadRedeemedCodes();
    const alreadyRedeemed = codes.filter(code => redeemed.includes(code));
    if (alreadyRedeemed.length > 0) {
        return res.status(409).json({ success: false, message: 'Bereits eingelöste Gutscheine', alreadyRedeemed });
    }

    await saveRedeemedCodes([...redeemed, ...codes]);
    return res.json({ success: true, codes });
});

app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});
