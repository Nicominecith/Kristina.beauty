# 💄 Kristina Beauty
**Professionelle Beauty-Services & Intelligentes Buchungssystem.**

<p align="left">
  <a href="https://kristinabeauty.netlify.app/">
    <img src="https://img.shields.io/badge/Live_Website-Besuchen-C5A880?style=for-the-badge&logo=netlify&logoColor=white" />
  </a>
  <a href="https://www.instagram.com/kristina.beauty.kb/">
    <img src="https://img.shields.io/badge/Instagram-Folgen-E4405F?style=for-the-badge&logo=instagram&logoColor=white" />
  </a>
</p>

---

## 🎨 Über das Projekt
Diese Web-App ist die digitale Visitenkarte für **Kristina Beauty**. Sie dient dazu, Kunden über verschiedene Beauty-Behandlungen zu informieren und eine einfache Kontaktmöglichkeit zu bieten.
Über das integrierte Buchungssystem können Kunden Behandlungen wählen, Verfügbarkeiten im Kalender prüfen und direkt Terminanfragen senden.

### ✨ Highlights der Services:
- 👁️ **Lashes & Brows:** Wimpernlifting und Augenbrauen-Styling.
- 🧖‍♀️ **Facials:** Microneedling, Aquafacial und BB Glow.
-  **Skincare:** Individuelle Beratung für Hautpflege.
- 💄 **PMU:** Powderbrows, Aquarellips und Lippenpigmentierung.

### 🚀 Besondere Funktionen:
- 📅 **Live-Kalender:** Anzeige von belegten Terminen und automatische Feiertagssperren (Schleswig-Holstein).
- 🛒 **Warenkorb-System:** Auswahl mehrerer Behandlungen mit Live-Preisberechnung.
- 🎫 **Gutschein-Logik:** Validierung und Einlösung von Rabattcodes.
- 🗓️ **Terminkalender im Portal:** Monats-/Wochenansicht, Anfragen farbig markiert, Bestätigen/Ablehnen/Bearbeiten/Löschen, WhatsApp-Nachricht, Ton bei neuer Anfrage, .ics-Export.
- 🔒 **Admin-Dashboard:** Internes Mitarbeiterportal zur Terminverwaltung und Finanzübersicht.
- 📱 **Responsive Design:** Perfekte Bedienbarkeit auf Desktop und Smartphone.

---

## 🛠️ Tech Stack
Die Webseite wurde mit Fokus auf Performance und Ästhetik entwickelt:

<p align="left">
  <img src="https://skillicons.dev/icons?i=html,css,js,tailwind,netlify,figma" />
</p>

- **Frontend:** HTML5, CSS3 (Tailwind CSS) und modernes Vanilla JavaScript.
- **Backend:** Netlify Functions (Serverless) + Netlify Blobs als dauerhafter Speicher für Termine und Gutscheine.
- **Kommunikation:** Integration von EmailJS für automatisierte Buchungsanfragen.
- **Deployment:** Hosting und CI/CD via Netlify.

---
## 🚀 Vorschau
<p align="center">
  <img src="screenshot.png" width="100%" alt="Kristina Beauty Web Vorschau" style="border-radius: 10px; border: 1px solid #C5A880;">
</p>

---

## ⚙️ Einrichtung auf Netlify
Build: `npm run build` (kompiliert Tailwind → `styles.css`, läuft automatisch über `netlify.toml`).

**Umgebungsvariablen** (Site configuration → Environment variables), danach neu deployen:
| Variable | Zweck |
|---|---|
| `PORTAL_PASSWORD` | Portal-Passwort (ohne Eintrag: `beauty2026` – bitte ändern!) |
| `RESEND_API_KEY` | Mailversand (Bestätigung, 24h-Erinnerung, Absage, Tageszusammenfassung, Gutscheine) – ohne Key werden keine Server-Mails verschickt |
| `MAIL_FROM` | verifizierte Absenderadresse, z. B. `Kristina Beauty <termine@deine-domain.de>` |
| `OWNER_EMAIL` | Kristinas Adresse für Tageszusammenfassung + neue Anfragen |
| `SITE_URL` | optional, z. B. `https://kristinabeauty.netlify.app` (für Links in Mails) |
| `NUMVERIFY_API_KEY` | optional, Telefonnummern-Prüfung |

## 💶 Zahlung
Ausschließlich **Barzahlung vor Ort**. Es gibt keine Online-Zahlung.

## 🧩 Neue Funktionen
- **Termin per Link verwalten:** `/?manage=TOKEN` (Absage/Umbuchung bis 24 h vorher). Umgebuchte Termine müssen neu bestätigt werden.
- **Feste Behandlungsdauern** (`netlify/lib/shared.js` + `extras.js`) verhindern Überlappungen; **Warteliste** meldet freie Termine per Mail.
- **Treue:** 8 Stempel = 10 € Bonus · „Freunde werben“ (5 € für beide) · Geburtstagsgutschein (10 €) · Gutscheine als PDF drucken (Portal → Gutscheine).
  Stempel werden im Portal über „✓ Erschienen / bezahlt“ vergeben.
- **Portal:** Kundenkartei (Notizen, Allergien, PMU-Einverständnis, Geburtstag), Umsatz-Diagramme, Top-Leistungen, Stammkundinnen, Warteliste.
- **Vorher/Nachher + Zertifikate:** Bilder als WebP in `gallery/` ablegen und in `gallery.json` eintragen.
- **Instagram-Feed im Footer:** Elfsight-Instagram-ID in `extras.js` (`KB.instagramWidgetId`) eintragen.
- **Cookie-Banner:** Google-Bewertungen, Instagram und TikTok laden erst nach Zustimmung.
- **Kunden-Konto** (Menü „Konto“): Registrieren/Anmelden mit E-Mail + Passwort, Buchungsstatus (angefragt/angenommen/abgelehnt), Daten ändern, Profilbild, Nachrichten an Kristina (Antworten im Portal), Passwort vergessen per Mail (braucht `RESEND_API_KEY`). Angemeldet gebuchte Termine werden automatisch dem Konto zugeordnet; Buchen ohne Konto bleibt möglich.
- **Portal → Konten:** Account-Name + Passwort der Mitarbeiter ändern, Kundenkonten ansehen, Profil zurücksetzen (entfernt Bild/Namen und sperrt Bild-Upload), Konto sperren/löschen, Passwort zurücksetzen, Kundennachrichten beantworten. Optional: `SESSION_SECRET` (sonst automatisch erzeugt).
- **PWA, Dark Mode, DE/EN/RU** (Rechtstexte und lange Behandlungstexte bleiben deutsch).

---
Website von Nicominecith
