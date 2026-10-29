// Хранение настроек и статистики в браузере (localStorage).
// Всё обёрнуто в try/catch: в некоторых режимах браузер запрещает хранилище,
// и тогда приложение должно продолжать работать, просто без сохранения.

const SETTINGS_KEY = "de_settings_v1";
const STATS_KEY = "de_stats_v1";

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // сохранить не удалось, ничего страшного
  }
}

function loadSettings() {
  return readStorage(SETTINGS_KEY, null);
}

function saveSettings(settings) {
  writeStorage(SETTINGS_KEY, settings);
}

function loadStats() {
  return readStorage(STATS_KEY, {});
}

// Заменить всю статистику (импорт из файла)
function replaceStats(stats) {
  writeStorage(STATS_KEY, stats);
}

// Удалить всю статистику
function clearStats() {
  try {
    localStorage.removeItem(STATS_KEY);
  } catch (e) {
    // ничего не делаем
  }
}

// Записать результат одного ответа.
// Структура: stats[id слова][тип вопроса] = { right, wrong, last }
function recordAnswer(wordId, type, isRight) {
  const stats = loadStats();
  if (!stats[wordId]) stats[wordId] = {};
  if (!stats[wordId][type]) stats[wordId][type] = { right: 0, wrong: 0 };
  stats[wordId][type][isRight ? "right" : "wrong"] += 1;
  stats[wordId][type].last = Date.now();
  writeStorage(STATS_KEY, stats);
}
