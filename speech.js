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

// Произнести текст по-немецки. rate: 1 обычная скорость, меньше 1 медленнее.
function speak(text, rate = 0.9) {
  if (!germanVoice) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // остановить то, что звучит сейчас
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = germanVoice;
  utterance.lang = germanVoice.lang;
  utterance.rate = rate;
  synth.speak(utterance);
}

// Слово произносится так, как оно записано в основной форме (с артиклем у существительных)
function speakWord(word, rate = 0.9) {
  speak(word.de_accept[0], rate);
}
