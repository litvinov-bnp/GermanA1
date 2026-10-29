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
  const typeOk = result.type === "mixed" || isTypeEnabled(result.type);
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
    const enabled = isTypeEnabled(key);
    const text = enabled ? t.label : t.label + " (нужен немецкий голос в браузере)";
    const { label, input } = makeOption("radio", "type", key, text, settings.type === key, !enabled);
    input.addEventListener("change", onSetupChange);
    typeBox.append(label);
  }
  const mixed = makeOption("radio", "type", "mixed", "Смешанный (все типы вперемешку)",
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
  const isAudio = type.startsWith("audio");

  $("progress").textContent = session.settings.count > 0
    ? `Слово ${session.position} из ${session.queue.length}`
    : `Слово ${session.position}`;
  $("topic").textContent = word.topic;
  $("prompt").textContent = isAudio ? "🎧 Послушайте слово" : (toDe ? word.ru : word.de);

  let hint = "";
  if (toDe && word.pos === "сущ.") {
    const hasArticle = /^(der|die|das) /.test(word.de_accept[0]);
    hint = hasArticle
      ? "Существительное: с артиклем и с большой буквы"
      : "Существительное: с большой буквы";
  } else if (isAudio && !toDe) {
    hint = "Напишите перевод по-русски";
  }
  $("hint").textContent = hint;

  $("result").textContent = "";
  $("result").className = "";
  $("extra").textContent = "";
  $("example").textContent = "";

  const input = $("answer");
  input.value = "";
  input.readOnly = false;
  input.className = "";
  $("btn-skip").hidden = false;
  input.placeholder = toDe ? "Ответ по-немецки" : "Перевод по-русски";
  input.focus();

  $("chars").hidden = !toDe;
  $("action").textContent = "Проверить";

  updateAudioRow();
  if (isAudio) speakWord(word); // в аудио-вопросах слово звучит сразу
}

// Кнопки озвучки: показываем, когда есть голос и немецкое слово либо видно, либо уже раскрыто
function updateAudioRow() {
  const type = question.type;
  const germanVisible = type === "text-to-ru" || type.startsWith("audio");
  $("audio-row").hidden = !(hasGermanVoice() && (germanVisible || answered));
  $("btn-play-example").hidden = !answered;
}

function playWord(rate) {
  speakWord(question.word, rate);
  if (!answered) $("answer").focus();
}

function checkAnswer() {
  const { word, type } = question;
  const toDe = QUESTION_TYPES[type].answerLang === "de";
  const text = $("answer").value;
  if (text.trim() === "") return;

  const ok = toDe ? isCorrectDe(text, word) : isCorrectRu(text, word);
  showFeedback(ok, false);
}

// Кнопка «Не знаю»: засчитывается как ошибка, сразу показываем правильный ответ
function skipAnswer() {
  if (answered) return;
  showFeedback(false, true);
}

function showFeedback(ok, skipped) {
  const { word, type } = question;
  const toDe = QUESTION_TYPES[type].answerLang === "de";
  recordAnswer(word.id, type, ok);

  if (ok) {
    session.right += 1;
  } else {
    session.wrong += 1;
    if (!session.mistakes.includes(word)) session.mistakes.push(word);
  }

  const correct = toDe ? word.de : word.ru;
  if (ok) {
    $("result").textContent = "Верно!";
  } else if (skipped) {
    $("result").textContent = "Правильно: " + correct;
  } else {
    $("result").textContent = "Неверно. Правильно: " + correct;
  }
  $("result").className = ok ? "ok" : "bad";

  // тот же цвет и шрифт на самом поле ответа
  const input = $("answer");
  input.className = skipped ? "" : (ok ? "ok" : "bad");
  input.readOnly = true;
  // при верном ответе по-русски дописываем в поле полный перевод (все варианты)
  if (ok && !toDe) input.value = word.ru;

  const extra = [];
  if (type.startsWith("audio")) extra.push(`${word.de} — ${word.ru}`);
  if (word.pos === "сущ.") {
    if (word.plural) extra.push("Мн. число: die " + word.plural);
    else if (word.plural_only) extra.push("Только во мн. числе");
    else extra.push("Мн. число: нет");
  }
  $("extra").textContent = extra.join(" · ");
  $("example").textContent = word.example_de + " — " + word.example_ru;

  answered = true;
  updateAudioRow();
  $("chars").hidden = true;
  $("btn-skip").hidden = true;
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
  if (input.readOnly) return;
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

function percent(right, total) {
  return total === 0 ? 0 : Math.round(right / total * 100);
}

// Сортировка: сначала больший процент верных, при равенстве больше ответов
function sortByPercent(rows) {
  return [...rows].sort((a, b) =>
    b.right / b.total - a.right / a.total || b.total - a.total
  );
}

function addItem(list, text) {
  const li = document.createElement("li");
  li.textContent = text;
  list.append(li);
}

function renderStats() {
  const s = summarizeStats(loadStats(), words);
  $("data-message").textContent = "";

  const summary = $("stats-summary");
  summary.replaceChildren();

  if (s.total === 0) {
    $("stats-empty").textContent = "Пока нет данных. Пройдите хотя бы один тест.";
    $("stats-empty").hidden = false;
    $("stats-details").hidden = true;
    return;
  }
  $("stats-empty").hidden = true;
  $("stats-details").hidden = false;

  addItem(summary, `Всего ответов: ${s.total}`);
  addItem(summary, `Верных: ${s.right} (${percent(s.right, s.total)}%)`);
  addItem(summary, `Слов затронуто: ${s.touched} из ${words.length}`);

  // по типам тестов: от большего процента верных к меньшему
  const types = $("stats-types");
  types.replaceChildren();
  const typeRows = Object.keys(s.byType).map(type => {
    const t = s.byType[type];
    return {
      label: QUESTION_TYPES[type] ? QUESTION_TYPES[type].label : type,
      right: t.right,
      total: t.right + t.wrong
    };
  });
  for (const r of sortByPercent(typeRows)) {
    addItem(types, `${r.label}: ${percent(r.right, r.total)}% верных (${r.total} ответов)`);
  }

  // по темам: от большего процента верных к меньшему
  const topics = $("stats-topics");
  topics.replaceChildren();
  const topicRows = [];
  for (const t of getTopics()) {
    const d = s.byTopic.get(t.name);
    if (d) topicRows.push({ label: t.name, right: d.right, total: d.right + d.wrong });
  }
  for (const r of sortByPercent(topicRows)) {
    addItem(topics, `${r.label}: ${percent(r.right, r.total)}% верных (${r.total} ответов)`);
  }

  // трудные слова
  const hard = $("stats-hard");
  hard.replaceChildren();
  const LIMIT = 30;
  if (s.hard.length === 0) {
    $("hard-note").textContent =
      "Пока таких нет. Трудным считается слово, на которое было не меньше " +
      `${HARD_MIN_ATTEMPTS} ответов и не меньше ${Math.round(HARD_MIN_ERROR_RATE * 100)}% из них неверные.`;
  } else {
    $("hard-note").textContent =
      `Всего: ${s.hard.length}` + (s.hard.length > LIMIT ? `, показаны первые ${LIMIT}.` : ".") +
      " Самые трудные сверху.";
    for (const h of s.hard.slice(0, LIMIT)) {
      const total = h.right + h.wrong;
      addItem(hard, `${h.word.de} — ${h.word.ru} (ошибок ${h.wrong} из ${total})`);
    }
  }
}

// ---------- Экспорт, импорт, сброс ----------

function exportStats() {
  const data = JSON.stringify(loadStats(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "german-stats-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  $("data-message").textContent = "Файл со статистикой сохранён.";
}

async function importStats(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!isValidStats(data)) throw new Error("bad format");
    if (!confirm("Текущая статистика будет заменена данными из файла. Продолжить?")) return;
    replaceStats(data);
    renderStats();
    $("data-message").textContent = "Статистика загружена из файла.";
  } catch (e) {
    $("data-message").textContent = "Не удалось прочитать файл: это не файл статистики.";
  }
}

function resetStats() {
  if (!confirm("Удалить всю статистику? Это нельзя отменить. Перед сбросом можно сделать экспорт.")) return;
  clearStats();
  renderStats();
  $("data-message").textContent = "Статистика сброшена.";
}

// ---------- Запуск ----------

function buildSpecialChars() {
  const box = $("chars");
  for (const ch of SPECIAL_CHARS) {
    const b = document.createElement("button");
    b.type = "button"; // не отправляет форму
    b.textContent = ch;
    b.addEventListener("click", () => insertChar(ch));
    box.append(b);
  }
}

function updateSpeechStatus() {
  if (!speechSupported()) {
    $("speech-status").textContent = "Озвучка: этот браузер не поддерживает синтез речи.";
  } else if (hasGermanVoice()) {
    $("speech-status").textContent = "Озвучка: " + germanVoiceName();
  } else {
    $("speech-status").textContent = "Озвучка: немецкий голос не найден, аудио-режимы недоступны.";
  }
}

async function start() {
  buildSpecialChars();

  $("btn-play").addEventListener("click", () => playWord(0.9));
  $("btn-play-slow").addEventListener("click", () => playWord(0.55));
  $("btn-play-example").addEventListener("click", () => speak(question.word.example_de, 0.9));

  // кнопки (работают сразу, но неактивные до загрузки словаря)
  $("btn-study").addEventListener("click", () => { renderSetup(); showScreen("setup"); });
  $("btn-stats").addEventListener("click", () => { renderStats(); showScreen("stats"); });
  $("btn-setup-back").addEventListener("click", () => showScreen("menu"));
  $("btn-start").addEventListener("click", startQuiz);
  $("btn-finish").addEventListener("click", finishQuiz);
  $("btn-skip").addEventListener("click", skipAnswer);
  $("quiz").addEventListener("submit", onQuizSubmit);
  $("all-topics").addEventListener("change", onAllTopicsChange);
  $("btn-again").addEventListener("click", () => {
    session = createSession(words, settings);
    showScreen("quiz");
    showQuestion();
  });
  $("btn-result-menu").addEventListener("click", () => showScreen("menu"));
  $("btn-stats-back").addEventListener("click", () => showScreen("menu"));
  $("btn-export").addEventListener("click", exportStats);
  $("btn-reset").addEventListener("click", resetStats);
  $("btn-import").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", event => {
    const file = event.target.files[0];
    event.target.value = ""; // чтобы можно было выбрать тот же файл ещё раз
    if (file) importStats(file);
  });

  try {
    await Promise.all([loadWords(), initSpeech(updateSpeechStatus)]);
    updateSpeechStatus();
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
