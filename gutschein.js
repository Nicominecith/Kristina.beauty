// c:\Users\nicom\Documents\GitHub\Kristina.beauty\gutschein.js

const CouponManager = {
    /**
     * Validiert einen Rabattcode über die Netlify Function.
     * @param {string} code Der zu validierende Rabattcode.
     * @returns {Promise<{success: boolean, message?: string, code?: string, discount?: number, label?: string, requiresCat?: string}>}
     */
    async validateCoupon(code) {
        if (!code) {
            // Client-seitige Prüfung für leeren Code, bevor eine Anfrage gesendet wird
            return { success: false, message: 'Code fehlt' };
        }
        try {
            // LOKALER TEST-MODUS (für Live Server)
            if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
                console.log("Mock-Modus: Validiere Code lokal...");
                if (code === 'LIFT3') {
                    return { success: true, code: 'LIFT3', discount: 3, label: 'LIFT3', requiresCat: 'Liftings' };
                }
                if (code.startsWith('SAVE')) {
                    return { success: true, code: code, discount: 5, label: 'Gutschein' };
                }
            }

            const response = await fetch(`/.netlify/functions/coupon?code=${encodeURIComponent(code)}`);
            const data = await response.json();

            if (!response.ok) {
                // Netlify Function hat einen Fehlerstatus zurückgegeben (z.B. 400, 404, 409)
                return { success: false, message: data.message || 'Fehler bei der Code-Prüfung' };
            }

            // Erfolgreiche Validierung
            return {
                success: data.valid,
                message: data.message, // Kann undefined sein, wenn valid true ist
                code: data.code,
                discount: data.discount,
                label: data.label,
                requiresCat: data.requiresCat
            };
        } catch (error) {
            console.error('Fehler bei der Validierung des Rabattcodes:', error);
            return { success: false, message: 'Fehler bei der Code-Prüfung (Netzwerkfehler)' };
        }
    },

    /**
     * Löst Rabattcodes ein und speichert die Einlösung serverseitig.
     * @param {string[]} codes Die einzulösenden Rabattcodes.
     * @param {string} customerName Der Name des Kunden für die Einlösung (wichtig für einmalige Codes wie LIFT3).
     * @returns {Promise<{success: boolean, message?: string, details?: Array<{code: string, message: string}>}>}
     */
    async redeemCoupons(codes, customerName) {
        if (!codes || codes.length === 0) {
            return { success: true, message: 'Keine Codes zum Einlösen' }; // Nichts zu tun
        }

        try {
            // LOKALER TEST-MODUS
            if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
                return { success: true, message: 'Mock-Einlösung erfolgreich' };
            }

            const response = await fetch(`/.netlify/functions/coupon`, {
                method: 'POST', // POST-Methode für das Einlösen verwenden 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'redeem', codes: codes, customerName: customerName })
            });
            const data = await response.json();
            return { success: data.success, message: data.message, details: data.details };
        } catch (error) {
            console.error('Fehler beim Einlösen der Rabattcodes:', error);
            return { success: false, message: 'Fehler beim Einlösen der Codes (Netzwerkfehler)' };
        }
    }
};