/* Übersetzungen (EN/RU) für den Studio-Kalender, Datumsangaben und Meldungen, die bisher deutsch blieben.
   Wird nach i18n_extra.js geladen. */
(function(){ if (!window.KBi18n) return;
KBi18n.add("en",{
"Studio Kalender":"Studio calendar","Termine & Verfügbarkeit":"Appointments & availability",
"Wähle einen freien Tag und eine Zeit aus – deine Buchungsanfrage landet direkt bei Kristina.":"Choose a free day and time – your booking request goes straight to Kristina.",
"Datum wird geladen…":"Loading date…","Heute":"Today","Nächster freier Termin":"Next available appointment","Monat":"Month","Woche":"Week",
"Ausgewählt":"Selected","Bestätigt":"Confirmed","Gewählter Tag":"Selected day","Verfügbare Zeiten":"Available times","Termin anfragen":"Request appointment",
"Wird gesendet …":"Sending …","An diesem Tag ist geschlossen":"The studio is closed on this day","Diese Telefonnummer scheint ungültig zu sein":"This phone number seems to be invalid",
"Konflikt mit einem anderen Termin":"Conflicts with another appointment","Ton ein- oder ausschalten":"Turn sound on or off","7. Community":"7. Community",
"Keine Zeiten verfügbar":"No times available","Keine freien Zeiten":"No free times","Server Fehler":"Server error"
});
KBi18n.add("ru",{
"Studio Kalender":"Календарь студии","Termine & Verfügbarkeit":"Записи и свободное время",
"Wähle einen freien Tag und eine Zeit aus – deine Buchungsanfrage landet direkt bei Kristina.":"Выберите свободный день и время – ваша заявка сразу попадёт к Кристине.",
"Datum wird geladen…":"Загрузка даты…","Heute":"Сегодня","Nächster freier Termin":"Ближайшее свободное время","Monat":"Месяц","Woche":"Неделя",
"Ausgewählt":"Выбрано","Bestätigt":"Подтверждено","Gewählter Tag":"Выбранный день","Verfügbare Zeiten":"Доступное время","Termin anfragen":"Запросить запись",
"Wird gesendet …":"Отправка …","An diesem Tag ist geschlossen":"В этот день студия закрыта","Diese Telefonnummer scheint ungültig zu sein":"Этот номер телефона выглядит недействительным",
"Konflikt mit einem anderen Termin":"Пересекается с другой записью","Ton ein- oder ausschalten":"Включить или выключить звук","7. Community":"7. Сообщество",
"Keine Zeiten verfügbar":"Нет доступного времени","Keine freien Zeiten":"Нет свободного времени","Server Fehler":"Ошибка сервера"
});

/* Datumsangaben, die der Kalender aus deutschen Monats-/Wochentagsnamen zusammensetzt */
const MO = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const WD = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];
const EN_MO = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EN_WD = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const RU_MO_NOM = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const RU_MO_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const RU_WD = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const names = MO.concat(WD).join('|');
const RE = new RegExp('^(?=.{0,60}$)(?=.*\\d).*\\b(?:' + names + ')\\b.*$', 's');
const WORD = new RegExp('\\b(' + names + ')\\b', 'g');
const DAYMO = new RegExp('(\\d{1,2})\\.\\s*(' + MO.join('|') + ')', 'g');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

KBi18n.addPatterns("en",[[RE, s => s
  .replace(DAYMO, (m, d, mo) => EN_MO[MO.indexOf(mo)] + ' ' + d)
  .replace(WORD, w => MO.includes(w) ? EN_MO[MO.indexOf(w)] : EN_WD[WD.indexOf(w)])
  .replace(/ Uhr\b/, '')]]);

KBi18n.addPatterns("ru",[[RE, s => {
  s = s.replace(DAYMO, (m, d, mo) => d + ' ' + RU_MO_GEN[MO.indexOf(mo)]);                 // „5. Oktober“ → „5 октября“
  s = s.replace(WORD, w => MO.includes(w) ? RU_MO_NOM[MO.indexOf(w)] : cap(RU_WD[WD.indexOf(w)]));
  return s.replace(/ Uhr\b/, '');
}]]);
})();
