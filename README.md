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
1. Repo mit Netlify verbinden (Deploy per `git push`).
2. In Netlify unter *Site configuration → Environment variables* setzen:
   - `PORTAL_PASSWORD` – Passwort fürs Mitarbeiterportal (ohne Eintrag gilt das alte Standard-Passwort).
   - `NUMVERIFY_API_KEY` – optional, für die Telefonnummern-Prüfung.
3. Nach dem Setzen der Variablen einmal neu deployen.

Die Termine liegen in Netlify Blobs – das braucht keinen eigenen Server.

---
Website von Nicominecith
