/* Community + Mitarbeiterportal: fehlende Übersetzungen (EN/RU) – dynamische Texte, Platzhalter, Hashtags, Songs.
   Nutzt die Engine aus i18n.js; Nutzer-Beiträge (Beschreibung, #Hashtags) bleiben bewusst im Original. */
(function () { if (!window.KBi18n) return;
KBi18n.add("en", {
"Beautys": "Beauties", "Posts": "Posts", "gesperrt": "blocked", "Suchen …": "Search …", "(ohne Beschreibung)": "(no description)",
"Video": "Video", "Kein Song": "No song", "Original-Ton (Video)": "Original sound (video)",
"Song": "Song", "Gefällt mir": "Like", "Hashtags": "Hashtags",
"Hier siehst du die neuesten Beiträge der Kundinnen. Beiträge mit Nazi-/Hass-Begriffen werden automatisch blockiert – alles andere Unpassende kannst du hier löschen. Unter jeder Beschreibung steht der verwendete Song.": "Here you can see the latest posts from clients. Posts containing Nazi/hate terms are blocked automatically – anything else inappropriate you can delete here. The song used in each post is shown below the description.",
"Schau dir das Profil von": "Check out the profile of"
});
KBi18n.add("ru", {
"Beautys": "Бьюти", "Posts": "Посты", "gesperrt": "заблокирован", "Suchen …": "Поиск …", "(ohne Beschreibung)": "(без описания)",
"Video": "Видео", "Kein Song": "Без песни", "Original-Ton (Video)": "Оригинальный звук (видео)",
"Song": "Песня", "Hashtags": "Хэштеги",
"Hier siehst du die neuesten Beiträge der Kundinnen. Beiträge mit Nazi-/Hass-Begriffen werden automatisch blockiert – alles andere Unpassende kannst du hier löschen. Unter jeder Beschreibung steht der verwendete Song.": "Здесь вы видите новые посты клиенток. Посты с нацистскими/ненавистническими терминами блокируются автоматически – всё остальное неподходящее можно удалить здесь. Песня каждого поста показана под описанием."
});
KBi18n.addPatterns("en", [
 [/^Schreib etwas dazu … mit #Hashtags \(max\. (\d+)\)$/, "Write something … with #hashtags (max. $1)"],
 [/^(\d+)\/(\d+) gewählt$/, "$1/$2 selected"],
 [/^Du kannst höchstens (\d+) Behandlungen wählen\.$/, "You can choose at most $1 treatments."],
 [/^(.+) – (.+) · (\d+) Sek\. im Beitrag$/, "$1 – $2 · $3 sec. in the post"],
 [/^Video wird optimiert … (\d+) %$/, "Optimising video … $1 %"],
 [/^Video wird hochgeladen … (\d+) %$/, "Uploading video … $1 %"],
 [/^Video bereit · (.+?) · ohne Ton \(dein Browser konnte den Ton nicht übernehmen\)$/, "Video ready · $1 · no sound (your browser could not keep the audio)"],
 [/^Video bereit · (.+)$/, "Video ready · $1"],
 [/^Dein Video ist (.+) Minuten lang – erlaubt sind höchstens 1:30 Minuten\.$/, "Your video is $1 minutes long – the maximum is 1:30 minutes."],
 [/^Das Video \((.+)\) wird für die Community optimiert\. Das dauert etwa so lange wie das Video selbst – bitte die App geöffnet lassen\.$/, "The video ($1) is being optimised for the community. This takes about as long as the video itself – please keep the app open."],
 [/^Das Video ist auch nach der Optimierung zu groß \((.+)\)\. Bitte wähle ein kürzeres\.$/, "The video is still too large after optimising ($1). Please choose a shorter one."],
 [/^Schau dir das Profil von (.+) bei Kristina Beauty an:$/, "Check out $1's profile at Kristina Beauty:"],
 [/^Beiträge \((\d+)\)$/, "Posts ($1)"]
]);
KBi18n.addPatterns("ru", [
 [/^Schreib etwas dazu … mit #Hashtags \(max\. (\d+)\)$/, "Напиши что-нибудь … с #хэштегами (макс. $1)"],
 [/^(\d+)\/(\d+) gewählt$/, "Выбрано: $1/$2"],
 [/^Du kannst höchstens (\d+) Behandlungen wählen\.$/, "Можно выбрать не более $1 процедур."],
 [/^(.+) – (.+) · (\d+) Sek\. im Beitrag$/, "$1 – $2 · $3 сек. в посте"],
 [/^Video wird optimiert … (\d+) %$/, "Оптимизация видео … $1 %"],
 [/^Video wird hochgeladen … (\d+) %$/, "Загрузка видео … $1 %"],
 [/^Video bereit · (.+?) · ohne Ton \(dein Browser konnte den Ton nicht übernehmen\)$/, "Видео готово · $1 · без звука (браузер не смог сохранить звук)"],
 [/^Video bereit · (.+)$/, "Видео готово · $1"],
 [/^Dein Video ist (.+) Minuten lang – erlaubt sind höchstens 1:30 Minuten\.$/, "Ваше видео длится $1 мин. – максимум 1:30 мин."],
 [/^Das Video \((.+)\) wird für die Community optimiert\. Das dauert etwa so lange wie das Video selbst – bitte die App geöffnet lassen\.$/, "Видео ($1) оптимизируется для сообщества. Это займёт примерно столько же, сколько само видео – не закрывайте приложение."],
 [/^Das Video ist auch nach der Optimierung zu groß \((.+)\)\. Bitte wähle ein kürzeres\.$/, "Видео слишком большое даже после оптимизации ($1). Выберите покороче."],
 [/^Schau dir das Profil von (.+) bei Kristina Beauty an:$/, "Посмотри профиль $1 в Kristina Beauty:"]
]);
/* Browser-Dialoge und Teilen-Texte laufen durch dieselbe Übersetzung */
['alert', 'confirm', 'prompt'].forEach(function (n) { var o = window[n]; if (!o || o.__kbT) return;
  var f = function (m) { try { m = KBi18n.t(String(m)); } catch (_) {} return o.apply(window, [m].concat([].slice.call(arguments, 1))); }; f.__kbT = 1; window[n] = f; });
})();
