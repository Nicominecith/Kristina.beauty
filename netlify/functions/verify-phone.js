function jsonResponse(body, status = 200) {
    return {
        statusCode: status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'POST, OPTIONS'
        },
        body: JSON.stringify(body)
    };
}

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return jsonResponse({}, 200);
    }
    if (event.httpMethod !== 'POST') {
        return jsonResponse({ message: 'Method not allowed' }, 405);
    }

    let body = {};
    try { body = JSON.parse(event.body || '{}') || {}; } catch { body = {}; }

    const rawPhone = (body.phone || '').trim();
    if (!rawPhone) {
        return jsonResponse({ valid: false, message: 'Keine Telefonnummer angegeben' }, 400);
    }

    const apiKey = process.env.NUMVERIFY_API_KEY;
    if (!apiKey) {
        console.error('NUMVERIFY_API_KEY ist nicht als Umgebungsvariable gesetzt');
        // Fail-open: ohne Key lieber durchlassen, statt Buchungen zu blockieren
        return jsonResponse({ valid: true, skipped: true });
    }

    try {
        const cleaned = rawPhone.replace(/[\s()\-.]/g, '');
        const hasCountryCode = cleaned.startsWith('+') || cleaned.startsWith('00');
        const numberParam = cleaned.replace(/^\+/, '').replace(/^00/, '');
        const countryParam = hasCountryCode ? '' : '&country_code=DE';

        const url = `http://apilayer.net/api/validate?access_key=${apiKey}&number=${encodeURIComponent(numberParam)}${countryParam}&format=1`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
            console.error('NumVerify API Fehler:', data.error);
            return jsonResponse({ valid: true, skipped: true });
        }

        return jsonResponse({
            valid: !!data.valid,
            number: data.international_format || rawPhone,
            country: data.country_name || null,
            carrier: data.carrier || null,
            lineType: data.line_type || null
        });
    } catch (err) {
        console.error('NumVerify Request fehlgeschlagen:', err);
        // Fail-open bei Netzwerk-/API-Problemen
        return jsonResponse({ valid: true, skipped: true });
    }
};
