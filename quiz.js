// Логика теста: типы вопросов, проверка ответов, очередь слов.
// Здесь нет работы со страницей, только данные и правила.

// Типы вопросов. Для аудирования enabled станет true на этапе озвучки.
const QUESTION_TYPES = {
  "text-to-ru":  { label: "Текст: немецкое слово → русский перевод",           enabled: true,  answerLang: "ru" },
  "text-to-de":  { label: "Текст: русское слово → немецкое слово",             enabled: true,  answerLang: "de" },
  "audio-to-ru": { label: "Аудирование: слышу немецкое слово → пишу перевод",  enabled: false, answerLang: "ru" },
  "audio-to-de": { label: "Диктант: слышу слово → пишу по-немецки",            enabled: false, answerLang: "de" }
};

// Варианты количества слов (0 = без ограничения)
const COUNT_OPTIONS = [25, 50, 75, 0];

function enabledTypes() {
  return Object.keys(QUESTION_TYPES).filter(t => QUESTION_TYPES[t].enabled);
}

// Перемешивание списка (алгоритм Фишера-Йетса), исходный список не меняется
function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Проверка ответов ----------

// Русский: без разницы регистр, е/ё, знаки препинания и лишние пробелы
function normalizeRu(text) {
  return text
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCorrectRu(answer, word) {
  const a = normalizeRu(answer);
  return word.ru_accept.some(variant => normalizeRu(variant) === a);
}

// Немецкий: у существительных важны артикль и заглавная буква,
// у остальных слов регистр не важен
function isCorrectDe(answer, word) {
  const a = answer.replace(/\s+/g, " ").trim();
  const isNoun = word.pos === "сущ.";
  return word.de_accept.some(variant =>
    isNoun ? variant === a : variant.toLowerCase() === a.toLowerCase()
  );
}

// ---------- Сессия теста ----------

function buildQueue(words, settings) {
  const chosen = words.filter(w => settings.topics.includes(w.topic));
  const queue = shuffle(chosen);
  return settings.count > 0 ? queue.slice(0, settings.count) : queue;
}

function createSession(words, settings) {
  return {
    words: words,
    settings: settings,
    queue: buildQueue(words, settings),
    position: 0,      // сколько вопросов уже показано
    right: 0,
    wrong: 0,
    mistakes: []      // слова, в которых были ошибки
  };
}

function pickType(settings) {
  if (settings.type === "mixed") {
    const types = enabledTypes();
    return types[Math.floor(Math.random() * types.length)];
  }
  return settings.type;
}

// Следующий вопрос или null, если слова закончились
function nextQuestion(session) {
  if (session.position >= session.queue.length) {
    if (session.settings.count === 0) {
      // без ограничения: начинаем новый круг, слова снова перемешаны
      session.queue = session.queue.concat(buildQueue(session.words, session.settings));
    } else {
      return null;
    }
  }
  const word = session.queue[session.position];
  session.position += 1;
  return { word: word, type: pickType(session.settings) };
}

function isLastQuestion(session) {
  return session.settings.count > 0 && session.position >= session.queue.length;
}
