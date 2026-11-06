// Озвучка слов встроенным в браузер синтезатором речи (Web Speech API).
// Это бесплатно и не требует интернета, если в системе есть немецкий голос.

let germanVoice = null;

function speechSupported() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function hasGermanVoice() {
  return germanVoice !== null;
}

function germanVoiceName() {
  return germanVoice ? `${germanVoice.name} (${germanVoice.lang})` : "";
}

// Выбрать лучший из доступных немецких голосов
function pickGermanVoice() {
  const voices = window.speechSynthesis.getVoices().filter(v =>
    v.lang.toLowerCase().replace("_", "-").startsWith("de")
  );
  if (voices.length === 0) return null;

  const score = v =>
    (v.lang.toLowerCase().replace("_", "-") === "de-de" ? 4 : 0) +
    (/natural|online/i.test(v.name) ? 2 : 0) +
    (/google/i.test(v.name) ? 1 : 0);

  return voices.sort((a, b) => score(b) - score(a))[0];
}

// Список голосов браузер загружает не мгновенно, поэтому ждём его (не дольше 2 секунд).
// onChange вызывается каждый раз, когда список голосов обновился.
function initSpeech(onChange) {
  return new Promise(resolve => {
    if (!speechSupported()) {
      resolve();
      return;
    }
    const update = () => {
      germanVoice = pickGermanVoice();
      if (onChange) onChange();
    };
    window.speechSynthesis.addEventListener("voiceschanged", () => {
      update();
      resolve();
    });
    update();
    if (germanVoice) resolve();
    setTimeout(resolve, 2000);
  });
}

// ---------- Управление озвучкой ----------

let speechTimer = null; // таймер отложенной озвучки или паузы между словами
let speechToken = 0;    // «номер версии» озвучки: при его смене старая очередь прекращается

// Остановить всё, что звучит, и отменить всё, что запланировано
function cancelSpeech() {
  speechToken += 1;
  clearTimeout(speechTimer);
  if (speechSupported()) window.speechSynthesis.cancel();
}

// Произнести текст один раз. onEnd вызывается, когда речь закончилась
// (или при ошибке, или через 8 секунд: некоторые голоса не сообщают об окончании).
function speakRaw(text, rate, onEnd) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = germanVoice;
  utterance.lang = germanVoice.lang;
  utterance.rate = rate;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (onEnd) onEnd();
  };
  utterance.onend = finish;
  utterance.onerror = finish;
  setTimeout(finish, 8000);
  window.speechSynthesis.speak(utterance);
}

// Произнести текст по-немецки. rate: 1 обычная скорость, меньше 1 медленнее.
function speak(text, rate = 0.9) {
  if (!germanVoice) return;
  cancelSpeech(); // остановить то, что звучит сейчас
  speakRaw(text, rate);
}

// То же, но с небольшой задержкой (чтобы звук не накладывался на нажатие кнопки)
function speakLater(text, delay = 400, rate = 0.9) {
  if (!germanVoice) return;
  cancelSpeech();
  speechTimer = setTimeout(() => speakRaw(text, rate), delay);
}

// Озвучить список по очереди с паузой gap (мс) после каждого.
// onStart(i) вызывается перед i-м элементом, onDone() после последнего.
function speakQueue(texts, { startDelay = 500, gap = 1200, onStart, onDone } = {}) {
  if (!germanVoice) return;
  cancelSpeech();
  const token = speechToken;
  let i = 0;
  const next = () => {
    if (token !== speechToken) return; // озвучку остановили
    if (i >= texts.length) {
      if (onDone) onDone();
      return;
    }
    const index = i++;
    if (onStart) onStart(index);
    speakRaw(texts[index], 0.9, () => {
      if (token !== speechToken) return;
      speechTimer = setTimeout(next, gap);
    });
  };
  speechTimer = setTimeout(next, startDelay);
}

// Слово произносится так, как оно записано в основной форме (с артиклем у существительных)
function speakWord(word, rate = 0.9) {
  speak(word.de_accept[0], rate);
}