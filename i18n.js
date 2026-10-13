// Mehrsprachigkeit DE / EN / RU – ersetzt bekannte deutsche UI-Texte (Navigation, Buchung, Kalender, Cookie, …).
// Rechtstexte (Impressum/Datenschutz/Widerruf) und die ausführlichen Behandlungsbeschreibungen bleiben deutsch.
(function () {
    const T = {
        en: {
            'Studio': 'Studio', 'Community': 'Community', 'Konto': 'Account', 'Preisliste': 'Price list', 'Behandlungen': 'Treatments', 'Buchung': 'Booking', 'Kalender': 'Calendar', 'Bewertungen': 'Reviews', 'Kontakt': 'Contact', 'Impressum': 'Imprint', 'Datenschutz': 'Privacy', 'Widerruf': 'Withdrawal',
            'Services & Preise': 'Services & prices', 'Termin buchen': 'Book appointment', 'Jetzt Termin buchen': 'Book now', 'Herzlich Willkommen': 'Welcome', 'Schönheit ohne Ende.': 'Endless beauty.',
            'Mein Versprechen': 'My promise', 'Individuelle Typberatung': 'Personal style consultation', 'Zertifizierte Behandlungen': 'Certified treatments', 'Privat-Atmosphäre': 'Private atmosphere', 'Alle Preise inkl. gesetzlicher MwSt.': 'All prices incl. VAT', 'Behandlungen entdecken': 'Discover treatments',
            'Häufige Fragen': 'FAQ', 'Behandlungsdauer': 'Duration', 'Wähle deine Behandlungen und sende deine Anfrage.': 'Choose your treatments and send your request.', 'Deine Auszeit wartet': 'Your time-out awaits',
            'Vielen Dank!': 'Thank you!', 'Deine Buchungsanfrage ist eingegangen.': 'Your booking request has been received.', 'Behandlung wählen': 'Choose treatment', 'Mehrere möglich – Menge per + / − anpassen': 'Multiple possible – adjust quantity with + / −',
            'Wunschtermin': 'Preferred appointment', 'Wunschdatum *': 'Preferred date *', 'Wunschzeit *': 'Preferred time *', 'Bitte wählen …': 'Please select …', 'Kontaktdaten': 'Contact details', 'Für die Terminbestätigung (* Pflichtfelder)': 'For the confirmation (* required)',
            'Vorname *': 'First name *', 'Nachname *': 'Last name *', 'Telefon *': 'Phone *', 'E-Mail *': 'E-mail *', 'Anmerkungen': 'Notes', 'Rabattcode': 'Discount code', '(optional)': '(optional)', 'Einlösen': 'Redeem',
            'Zahlungsart': 'Payment method', 'Zahlung erfolgt vor Ort': 'Payment on site', 'Barzahlung': 'Cash payment', 'Bitte passend mitbringen – Zahlung direkt im Studio vor der Behandlung.': 'Please bring the exact amount – payment in cash at the studio before the treatment.',
            'Anfrage absenden': 'Send request', 'Deine Auswahl': 'Your selection', 'Gesamt': 'Total', 'Rabatt': 'Discount', 'inkl. MwSt. · Barzahlung vor Ort': 'incl. VAT · cash on site',
            'Was Kunden sagen': 'What clients say', 'Echt. Ehrlich. Begeistert.': 'Real. Honest. Delighted.', 'Mehr Bewertungen laden': 'Load more reviews', 'Bewerte uns auf': 'Rate us on', 'Adresse': 'Address', 'Folge Kristina Beauty': 'Follow Kristina Beauty',
            'Dein Vorname': 'Your first name', 'Dein Nachname': 'Your last name', 'deine@mail.de': 'your@mail.com', 'Code eingeben …': 'Enter code …',
            'Termin verwalten': 'Manage appointment', 'Termin absagen': 'Cancel appointment', 'Termin verschieben': 'Reschedule', 'Neuer Termin': 'New date', 'Speichern': 'Save', 'Zurück': 'Back',
            'Dein Termin': 'Your appointment', 'Dein Termin wurde abgesagt.': 'Your appointment has been cancelled.', 'Neuer Termin gespeichert – ich bestätige ihn dir kurz.': 'New date saved – I will confirm it shortly.', 'Termin wirklich absagen?': 'Really cancel the appointment?',
            'Link ungültig oder Termin nicht gefunden.': 'Link invalid or appointment not found.', 'Warteliste': 'Waiting list', 'Alles belegt? Auf die Warteliste für diesen Tag': 'Fully booked? Join the waiting list for this day',
            'Wir benachrichtigen dich per E-Mail, sobald ein Termin frei wird.': 'We will e-mail you as soon as a slot becomes free.', 'Eintragen': 'Sign up', 'Abbrechen': 'Cancel', 'Du stehst auf der Warteliste.': 'You are on the waiting list.',
            'Cookies & externe Inhalte': 'Cookies & external content', 'Für Google-Bewertungen, Instagram und TikTok werden externe Dienste geladen. Dabei können Daten an diese Anbieter übertragen werden.': 'Google reviews, Instagram and TikTok load external services which may transfer data to those providers.',
            'Alle akzeptieren': 'Accept all', 'Nur notwendige': 'Necessary only', 'Ergebnisse': 'Results', 'Vorher / Nachher': 'Before / After', 'Zertifikate': 'Certificates', 'Instagram': 'Instagram', 'Instagram-Inhalte laden': 'Load Instagram content', 'Auf Instagram folgen': 'Follow on Instagram',
            'Bewertungen laden': 'Load reviews', 'Dunkel': 'Dark', 'Hell': 'Light', 'App installieren': 'Install app', 'Barzahlung vor Ort – keine Online-Zahlung': 'Cash on site – no online payment'
        },
        ru: {
            'Studio': 'Студия', 'Community': 'Сообщество', 'Konto': 'Аккаунт', 'Preisliste': 'Прайс', 'Behandlungen': 'Процедуры', 'Buchung': 'Запись', 'Kalender': 'Календарь', 'Bewertungen': 'Отзывы', 'Kontakt': 'Контакты', 'Impressum': 'Импрессум', 'Datenschutz': 'Конфиденциальность', 'Widerruf': 'Отказ',
            'Services & Preise': 'Услуги и цены', 'Termin buchen': 'Записаться', 'Jetzt Termin buchen': 'Записаться сейчас', 'Herzlich Willkommen': 'Добро пожаловать', 'Schönheit ohne Ende.': 'Красота без границ.',
            'Mein Versprechen': 'Мое обещание', 'Individuelle Typberatung': 'Индивидуальная консультация', 'Zertifizierte Behandlungen': 'Сертифицированные процедуры', 'Privat-Atmosphäre': 'Приватная атмосфера', 'Alle Preise inkl. gesetzlicher MwSt.': 'Все цены включают НДС', 'Behandlungen entdecken': 'Узнать о процедурах',
            'Häufige Fragen': 'Частые вопросы', 'Behandlungsdauer': 'Длительность', 'Wähle deine Behandlungen und sende deine Anfrage.': 'Выберите процедуры и отправьте заявку.', 'Deine Auszeit wartet': 'Ваше время для себя',
            'Vielen Dank!': 'Спасибо!', 'Deine Buchungsanfrage ist eingegangen.': 'Ваша заявка получена.', 'Behandlung wählen': 'Выберите процедуру', 'Mehrere möglich – Menge per + / − anpassen': 'Можно несколько – количество кнопками + / −',
            'Wunschtermin': 'Желаемое время', 'Wunschdatum *': 'Желаемая дата *', 'Wunschzeit *': 'Желаемое время *', 'Bitte wählen …': 'Выберите …', 'Kontaktdaten': 'Контакты', 'Für die Terminbestätigung (* Pflichtfelder)': 'Для подтверждения (* обязательно)',
            'Vorname *': 'Имя *', 'Nachname *': 'Фамилия *', 'Telefon *': 'Телефон *', 'E-Mail *': 'E-mail *', 'Anmerkungen': 'Комментарии', 'Rabattcode': 'Промокод', '(optional)': '(необязательно)', 'Einlösen': 'Применить',
            'Zahlungsart': 'Способ оплаты', 'Zahlung erfolgt vor Ort': 'Оплата на месте', 'Barzahlung': 'Наличными', 'Bitte passend mitbringen – Zahlung direkt im Studio vor der Behandlung.': 'Пожалуйста, возьмите точную сумму – оплата наличными в студии перед процедурой.',
            'Anfrage absenden': 'Отправить заявку', 'Deine Auswahl': 'Ваш выбор', 'Gesamt': 'Итого', 'Rabatt': 'Скидка', 'inkl. MwSt. · Barzahlung vor Ort': 'вкл. НДС · наличными на месте',
            'Was Kunden sagen': 'Что говорят клиенты', 'Echt. Ehrlich. Begeistert.': 'Настоящие. Честные. Восторженные.', 'Mehr Bewertungen laden': 'Показать больше отзывов', 'Bewerte uns auf': 'Оцените нас в', 'Adresse': 'Адрес', 'Folge Kristina Beauty': 'Подписывайтесь на Kristina Beauty',
            'Dein Vorname': 'Ваше имя', 'Dein Nachname': 'Ваша фамилия', 'deine@mail.de': 'ваша@почта.com', 'Code eingeben …': 'Введите код …',
            'Termin verwalten': 'Управление записью', 'Termin absagen': 'Отменить запись', 'Termin verschieben': 'Перенести запись', 'Neuer Termin': 'Новая дата', 'Speichern': 'Сохранить', 'Zurück': 'Назад',
            'Dein Termin': 'Ваша запись', 'Dein Termin wurde abgesagt.': 'Ваша запись отменена.', 'Neuer Termin gespeichert – ich bestätige ihn dir kurz.': 'Новое время сохранено – скоро подтвержу.', 'Termin wirklich absagen?': 'Точно отменить запись?',
            'Link ungültig oder Termin nicht gefunden.': 'Ссылка недействительна или запись не найдена.', 'Warteliste': 'Лист ожидания', 'Alles belegt? Auf die Warteliste für diesen Tag': 'Всё занято? В лист ожидания на этот день',
            'Wir benachrichtigen dich per E-Mail, sobald ein Termin frei wird.': 'Мы сообщим по e-mail, как только освободится время.', 'Eintragen': 'Записаться', 'Abbrechen': 'Отмена', 'Du stehst auf der Warteliste.': 'Вы в листе ожидания.',
            'Cookies & externe Inhalte': 'Cookies и внешний контент', 'Für Google-Bewertungen, Instagram und TikTok werden externe Dienste geladen. Dabei können Daten an diese Anbieter übertragen werden.': 'Для отзывов Google, Instagram и TikTok загружаются внешние сервисы; данные могут передаваться этим поставщикам.',
            'Alle akzeptieren': 'Принять все', 'Nur notwendige': 'Только необходимые', 'Ergebnisse': 'Результаты', 'Vorher / Nachher': 'До / После', 'Zertifikate': 'Сертификаты', 'Instagram-Inhalte laden': 'Загрузить Instagram', 'Auf Instagram folgen': 'Подписаться в Instagram',
            'Bewertungen laden': 'Загрузить отзывы', 'Dunkel': 'Тёмная', 'Hell': 'Светлая', 'App installieren': 'Установить приложение', 'Barzahlung vor Ort – keine Online-Zahlung': 'Наличными на месте – без онлайн-оплаты'
        }
    };
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    const orig = new WeakMap();
    const origAttr = new WeakMap();
    let lang = 'de';
    try { lang = localStorage.getItem('kb_lang') || ((navigator.language || 'de').slice(0, 2)); } catch (_) {}
    if (lang !== 'en' && lang !== 'ru') lang = 'de';

    function apply(root) {
        const dict = T[lang] || {};
        const w = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT, {
            acceptNode: n => /^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
        });
        let n;
        while ((n = w.nextNode())) {
            const key0 = orig.has(n) ? orig.get(n) : n.nodeValue;
            const k = norm(key0);
            if (!k) continue;
            if (!orig.has(n) && lang === 'de') continue;
            const tr = lang === 'de' ? null : dict[k];
            if (tr || orig.has(n)) {
                if (!orig.has(n)) orig.set(n, n.nodeValue);
                n.nodeValue = tr ? key0.replace(k, tr) : key0;
            }
        }
        (root || document).querySelectorAll('[placeholder]').forEach(el => {
            if (!origAttr.has(el)) origAttr.set(el, el.getAttribute('placeholder'));
            const o = origAttr.get(el);
            el.setAttribute('placeholder', (lang !== 'de' && dict[norm(o)]) || o);
        });
        document.documentElement.lang = lang;
    }
    let timer;
    new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(() => apply(), 120); })
        .observe(document.documentElement, { childList: true, subtree: true });

    window.KBi18n = {
        get lang() { return lang; },
        set(l) { lang = T[l] ? l : 'de'; try { localStorage.setItem('kb_lang', lang); } catch (_) {} apply(); document.querySelectorAll('.kb-lang').forEach(s => s.value = lang); },
        t(k) { return (T[lang] && T[lang][k]) || k; }
    };
    document.addEventListener('DOMContentLoaded', () => apply());
})();
