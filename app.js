// Экраны и взаимодействие со страницей.
// Логика теста лежит в quiz.js, хранение данных в storage.js.

let words = [];        // весь словарь
let settings = null;   // настройки теста
let session = null;    // текущий тест
let question = null;   // текущий вопрос: { word, type }
let answered = false;  // на текущий вопрос уже ответили?

const SPECIAL_CHARS = "äöüßÄÖÜ";

function $(id) {
  return document.getElementById(id);
}

// ---------- Экраны ----------

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(el => {
    el.hidden = el.id !== "screen-" + name;
  });
  window.scrollTo(0, 0);
}

// ---------- Загрузка ----------

async function loadWords() {
  const response = await fetch("words.json");
  words = await response.json();
}

function getTopics() {
  const map = new Map();
  for (const w of words) {
    map.set(w.topic, (map.get(w.topic) || 0) + 1);
  }
  return [...map].map(([name, count]) => ({ name, count }));
}

function makeSettings() {
  const allTopics = getTopics().map(t => t.name);
  const defaults = { topics: allTopics, count: 25, type: "text-to-ru" };
  const saved = loadSettings();
  if (!saved) return defaults;

  const result = { ...defaults, ...saved };
  result.topics = result.topics.filter(t => allTopics.includes(t));
  if (result.topics.length === 0) result.topics = allTopics;
  if (!COUNT_OPTIONS.includes(result.count)) result.count = defaults.count;
  const typeOk = result.type === "mixed" ||
    (QUESTION_TYPES[result.type] && QUESTION_TYPES[result.type].enabled);
  if (!typeOk) result.type = defaults.type;
  return result;
}

// ---------- Настройка теста ----------

function makeOption(kind, name, value, text, checked, disabled) {
  const label = document.createElement("label");
  label.className = "option" + (disabled ? " disabled" : "");
  const input = document.createElement("input");
  input.type = kind;
  input.name = name;
  input.value = value;
  input.checked = checked;
  input.disabled = disabled;
  label.append(input, " " + text);
  return { label, input };
}

function renderSetup() {
  // темы
  const topicsBox = $("topics");
  topicsBox.replaceChildren();
  for (const t of getTopics()) {
    const { label, input } = makeOption(
      "checkbox", "topic", t.name, `${t.name} (${t.count})`,
      settings.topics.includes(t.name), false
    );
    input.addEventListener("change", onSetupChange);
    topicsBox.append(label);
  }

  // количество слов
  const countBox = $("count-options");
  countBox.replaceChildren();
  for (const n of COUNT_OPTIONS) {
    const text = n === 0 ? "Без ограничения" : String(n);
    const { label, input } = makeOption("radio", "count", n, text, settings.count === n, false);
    input.addEventListener("change", onSetupChange);
    countBox.append(label);
  }

  // тип теста
  const typeBox = $("type-options");
  typeBox.replaceChildren();
  for (const key of Object.keys(QUESTION_TYPES)) {
    const t = QUESTION_TYPES[key];
    const text = t.enabled ? t.label : t.label + " (скоро)";
    const { label, input } = makeOption("radio", "type", key, text, settings.type === key, !t.enabled);
    input.addEventListener("change", onSetupChange);
    typeBox.append(label);
  }
  const mixed = makeOption("radio", "type", "mixed", "Смешанный (все доступные типы вперемешку)",
    settings.type === "mixed", false);
  mixed.input.addEventListener("change", onSetupChange);
  typeBox.append(mixed.label);

  syncAllCheckbox();
  updateSetupInfo();
}

function syncAllCheckbox() {
  const boxes = [...document.querySelectorAll("#topics input")];
  const checked = boxes.filter(b => b.checked).length;
  const all = $("all-topics");
  all.checked = checked === boxes.length;
  all.indeterminate = checked > 0 && checked < boxes.length;
}

// Прочитать выбранные значения из формы
function readSetupForm() {
  const topics = [...document.querySelectorAll("#topics input:checked")].map(i => i.value);
  const count = Number(document.querySelector("#count-options input:checked").value);
  const type = document.querySelector("#type-options input:checked").value;
  return { topics, count, type };
}

function updateSetupInfo() {
  const form = readSetupForm();
  const available = words.filter(w => form.topics.includes(w.topic)).length;
  const inTest = form.count > 0 ? Math.min(form.count, available) : available;
  if (available === 0) {
    $("setup-info").textContent = "Выберите хотя бы одну тему.";
  } else if (form.count === 0) {
    $("setup-info").textContent = `Слов в выбранных темах: ${available}. Тест идёт, пока вы не нажмёте «Закончить».`;
  } else {
    $("setup-info").textContent = `Слов в выбранных темах: ${available}. В тесте будет: ${inTest}.`;
  }
  $("btn-start").disabled = available === 0;
}

function onSetupChange() {
  syncAllCheckbox();
  updateSetupInfo();
}

function onAllTopicsChange() {
  const checked = $("all-topics").checked;
  document.querySelectorAll("#topics input").forEach(b => { b.checked = checked; });
  $("all-topics").indeterminate = false;
  updateSetupInfo();
}

// ---------- Тест ----------

function startQuiz() {
  settings = readSetupForm();
  saveSettings(settings);
  session = createSession(words, settings);
  showScreen("quiz");
  showQuestion();
}

function showQuestion() {
  question = nextQuestion(session);
  if (!question) {
    finishQuiz();
    return;
  }
  answered = false;

  const { word, type } = question;
  const toDe = QUESTION_TYPES[type].answerLang === "de";

  $("progress").textContent = session.settings.count > 0
    ? `Слово ${session.position} из ${session.queue.length}`
    : `Слово ${session.position}`;
  $("topic").textContent = word.topic;
  $("prompt").textContent = toDe ? word.ru : word.de;

  let hint = "";
  if (toDe && word.pos === "сущ.") {
    const hasArticle = /^(der|die|das) /.test(word.de_accept[0]);
    hint = hasArticle
      ? "Существительное: с артиклем и с большой буквы"
      : "Существительное: с большой буквы";
  }
  $("hint").textContent = hint;

  $("result").textContent = "";
  $("result").className = "";
  $("extra").textContent = "";
  $("example").textContent = "";

  const input = $("answer");
  input.value = "";
  input.disabled = false;
  input.placeholder = toDe ? "Ответ по-немецки" : "Перевод по-русски";
  input.focus();

  $("chars").hidden = !toDe;
  $("action").textContent = "Проверить";
}

function checkAnswer() {
  const { word, type } = question;
  const toDe = QUESTION_TYPES[type].answerLang === "de";
  const text = $("answer").value;
  if (text.trim() === "") return;

  const ok = toDe ? isCorrectDe(text, word) : isCorrectRu(text, word);
  recordAnswer(word.id, type, ok);

  if (ok) {
    session.right += 1;
  } else {
    session.wrong += 1;
    if (!session.mistakes.includes(word)) session.mistakes.push(word);
  }

  const correct = toDe ? word.de : word.ru;
  $("result").textContent = ok ? "Верно! " + correct : "Неверно. Правильно: " + correct;
  $("result").className = ok ? "ok" : "bad";

  if (word.pos === "сущ.") {
    $("extra").textContent = word.plural
      ? "Мн. число: " + word.plural
      : (word.plural_only ? "Только во мн. числе" : "");
  }
  $("example").textContent = word.example_de + " — " + word.example_ru;

  answered = true;
  $("answer").disabled = true;
  $("chars").hidden = true;
  $("action").textContent = isLastQuestion(session) ? "Результаты" : "Дальше";
  $("action").focus();
}

function onQuizSubmit(event) {
  event.preventDefault(); // не перезагружать страницу
  if (!answered) {
    checkAnswer();
  } else if (isLastQuestion(session)) {
    finishQuiz();
  } else {
    showQuestion();
  }
}

// Вставить немецкую букву в позицию курсора
function insertChar(ch) {
  const input = $("answer");
  if (input.disabled) return;
  input.setRangeText(ch, input.selectionStart, input.selectionEnd, "end");
  input.focus();
}

// ---------- Итоги ----------

function finishQuiz() {
  const total = session.right + session.wrong;
  if (total === 0) {
    $("result-summary").textContent = "Вы не ответили ни на один вопрос.";
  } else {
    const percent = Math.round(session.right / total * 100);
    $("result-summary").textContent =
      `Верно: ${session.right} из ${total} (${percent}%).`;
  }

  const list = $("mistakes");
  list.replaceChildren();
  for (const w of session.mistakes) {
    const li = document.createElement("li");
    li.textContent = `${w.de} — ${w.ru}`;
    list.append(li);
  }
  $("mistakes-box").hidden = session.mistakes.length === 0;
  showScreen("result");
}

// ---------- Статистика ----------

function renderStats() {
  const stats = loadStats();
  let right = 0, wrong = 0, touched = 0;
  for (const id in stats) {
    touched += 1;
    for (const type in stats[id]) {
      right += stats[id][type].right;
      wrong += stats[id][type].wrong;
    }
  }
  const total = right + wrong;
  if (total === 0) {
    $("stats-summary").textContent = "Пока нет данных. Пройдите хотя бы один тест.";
  } else {
    const percent = Math.round(right / total * 100);
    $("stats-summary").textContent =
      `Всего ответов: ${total}. Верных: ${right} (${percent}%). ` +
      `Слов затронуто: ${touched} из ${words.length}.`;
  }
}

// ---------- Запуск ----------

function buildSpecialChars() {
  const box = $("chars");
  for (const ch of SPECIAL_CHARS) {
    const b = document.createElement("button");
    b.type = "button"; // не отправляет форму
    b.className = "secondary";
    b.textContent = ch;
    b.addEventListener("click", () => insertChar(ch));
    box.append(b);
  }
}

async function start() {
  buildSpecialChars();

  // кнопки (работают сразу, но неактивные до загрузки словаря)
  $("btn-study").addEventListener("click", () => { renderSetup(); showScreen("setup"); });
  $("btn-stats").addEventListener("click", () => { renderStats(); showScreen("stats"); });
  $("btn-setup-back").addEventListener("click", () => showScreen("menu"));
  $("btn-start").addEventListener("click", startQuiz);
  $("btn-finish").addEventListener("click", finishQuiz);
  $("quiz").addEventListener("submit", onQuizSubmit);
  $("all-topics").addEventListener("change", onAllTopicsChange);
  $("btn-again").addEventListener("click", () => {
    session = createSession(words, settings);
    showScreen("quiz");
    showQuestion();
  });
  $("btn-result-menu").addEventListener("click", () => showScreen("menu"));
  $("btn-stats-back").addEventListener("click", () => showScreen("menu"));

  try {
    await loadWords();
  } catch (e) {
    $("load-status").textContent =
      "Не удалось загрузить words.json. Откройте сайт через Live Server или по адресу GitHub Pages.";
    return;
  }

  settings = makeSettings();
  $("load-status").textContent = "";
  $("btn-study").disabled = false;
  $("btn-stats").disabled = false;
}

start();
