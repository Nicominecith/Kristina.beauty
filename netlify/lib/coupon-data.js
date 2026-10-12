// Feste Aktionscodes. Alle anderen Gutscheine (EMP-, STAMP-, REF-, FRIEND-, BDAY-)
// werden dynamisch erzeugt und liegen in Netlify Blobs (Store "coupons").
// LIFT3: 3 € auf Liftings, pro Kundenname nur einmal einlösbar.
export const COUPONS = {
    LIFT3: { discount: 3, label: 'LIFT3', requiresCat: 'Liftings' }
};
