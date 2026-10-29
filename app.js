let words = [];
let current = null;   // слово, которое показано сейчас
let answered = false; // уже проверили ответ на это слово?

async function loadWords() {
  const response = await fetch("words.json");
  words = await response.json();
}

// Приводим текст к единому виду, чтобы сравнивать без придирок
function normalize(text) {
  return text
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/[.,!?;:]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCorrect(answer, word) {
  const a = normalize(answer);
  return word.ru_accept.some(variant => normalize(variant) === a);
}

function showRandomWord() {
  current = words[Math.floor(Math.random() * words.length)];
  answered = false;

  document.getElementById("topic").textContent = current.topic;
  document.getElementById("word").textContent = current.de;
  document.getElementById("result").textContent = "";
  document.getElementById("result").className = "";
  document.getElementById("example").textContent = "";

  const input = document.getElementById("answer");
  input.value = "";
  input.disabled = false;
  input.focus();

  document.getElementById("action").textContent = "Проверить";
}

function checkAnswer() {
  const input = document.getElementById("answer");
  if (normalize(input.value) === "") return; // пустой ввод не проверяем

  const result = document.getElementById("result");
  if (isCorrect(input.value, current)) {
    result.textContent = "Верно! " + current.ru;
    result.className = "ok";
  } else {
    result.textContent = "Неверно. Правильно: " + current.ru;
    result.className = "bad";
  }

  document.getElementById("example").textContent =
    current.example_de + " — " + current.example_ru;

  answered = true;
  input.disabled = true;
  const button = document.getElementById("action");
  button.textContent = "Дальше";
  button.focus();
}

async function start() {
  await loadWords();
  showRandomWord();

  document.getElementById("quiz").addEventListener("submit", event => {
    event.preventDefault(); // не перезагружать страницу при отправке формы
    if (answered) {
      showRandomWord();
    } else {
      checkAnswer();
    }
  });
}

start();