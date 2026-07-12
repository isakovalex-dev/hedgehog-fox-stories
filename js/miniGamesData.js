(function (window) {
  "use strict";
  window.HFMiniGamesData = {
    games: [
      { id: "eagle", title: "Спасение орла", description: "Проведи синюю лодку между камнями и собери перья.", age: "6–9", duration: "1 минута", icon: "🪶" },
      { id: "clouds", title: "Облака-путешественники", description: "Рассматривай облака, считай и находи пары.", age: "6–9", duration: "3–5 заданий", icon: "☁️" },
      { id: "story", title: "Собери сказку", description: "Расставь события по порядку и придумай финал.", age: "6–9", duration: "2 минуты", icon: "📖" }
    ],
    cloudTasks: [
      { prompt: "Найди облако, похожее на кита", options: ["Корабль", "Кит", "Чайник"], answer: 1, reveal: "🐋" },
      { prompt: "Сколько птиц летит над морем?  🐦  🐦  🐦", options: ["2", "3", "4"], answer: 1, reveal: "🎈" },
      { prompt: "Найди два одинаковых облака", options: ["☁️ ☁️", "☁️ 🌥️", "🌤️ 🌥️"], answer: 0, reveal: "🐉" },
      { prompt: "Какое облако самое маленькое?", options: ["Большое", "Маленькое", "Среднее"], answer: 1, reveal: "🫖" }
    ],
    storyCards: ["Герои находят карту.", "Идут к маяку.", "Встречают чайку.", "Находят сундук.", "Возвращаются домой."],
    endings: [
      { label: "золотой ключ", icon: "🗝️", reward: "фонарик" },
      { label: "письмо", icon: "✉️", reward: "страница карты" },
      { label: "волшебное перо", icon: "🪶", reward: "перо" }
    ]
  };
})(window);
