// Логика теста: типы вопросов, проверка ответов, очередь слов.
// Здесь нет работы со страницей, только данные и правила.

// Типы вопросов. needsSpeech: для этого типа нужен немецкий голос в браузере.
const QUESTION_TYPES = {
  "text-to-ru":  { label: "Текст: DE слово → РУС перевод",       needsSpeech: false, answerLang: "ru" },
  "text-to-de":  { label: "Текст: РУС слово → DE слово",         needsSpeech: false, answerLang: "de" },
  "audio-to-ru": { label: "Аудирование: DE слово → РУС перевод", needsSpeech: true,  answerLang: "ru" },
  "audio-to-de": { label: "Диктант: DE слово → DE слово",        needsSpeech: true,  answerLang: "de" }
};

// Варианты количества слов (0 = без ограничения)
const COUNT_OPTIONS = [25, 50, 75, 0];

// Тип доступен, если ему не нужна озвучка или в браузере есть немецкий голос
function isTypeEnabled(type) {
  const info = QUESTION_TYPES[type];
  return Boolean(info) && (!info.needsSpeech || hasGermanVoice());
}

function enabledTypes() {
  return Object.keys(QUESTION_TYPES).filter(isTypeEnabled);
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
