// Подсчёт статистики из сырых данных (то, что записывает recordAnswer).
// Здесь нет работы со страницей, только вычисления.

const HARD_MIN_ATTEMPTS = 2;   // сколько ответов нужно, чтобы слово могло попасть в трудные
const HARD_MIN_ERROR_RATE = 0.4; // доля ошибок, начиная с которой слово считается трудным

function summarizeStats(stats, words) {
  const byId = new Map(words.map(w => [w.id, w]));
  const byTopic = new Map();   // тема -> { right, wrong }
  const byType = {};           // тип вопроса -> { right, wrong }
  const hard = [];
  let right = 0, wrong = 0, touched = 0;

  for (const id in stats) {
    const word = byId.get(id);
    if (!word) continue;   // слова нет в словаре (например, удалено), пропускаем
    let wRight = 0, wWrong = 0;
    for (const type in stats[id]) {
      const s = stats[id][type];
      wRight += s.right;
      wWrong += s.wrong;
      byType[type] = byType[type] || { right: 0, wrong: 0 };
      byType[type].right += s.right;
      byType[type].wrong += s.wrong;
    }
    if (wRight + wWrong === 0) continue;
    touched += 1;
    right += wRight;
    wrong += wWrong;

    const t = byTopic.get(word.topic) || { right: 0, wrong: 0 };
    t.right += wRight;
    t.wrong += wWrong;
    byTopic.set(word.topic, t);

    const attempts = wRight + wWrong;
    const errorRate = wWrong / attempts;
    if (attempts >= HARD_MIN_ATTEMPTS && errorRate >= HARD_MIN_ERROR_RATE) {
      hard.push({ word, right: wRight, wrong: wWrong, errorRate });
    }
  }

  // самые трудные сверху: сначала по доле ошибок, потом по числу ошибок
  hard.sort((a, b) => b.errorRate - a.errorRate || b.wrong - a.wrong);

  return { total: right + wrong, right, wrong, touched, byTopic, byType, hard };
}

// Проверка файла, который пользователь загружает при импорте
function isValidStats(data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return false;
  for (const id in data) {
    const perType = data[id];
    if (perType === null || typeof perType !== "object") return false;
    for (const type in perType) {
      const s = perType[type];
      if (!s || !Number.isFinite(s.right) || !Number.isFinite(s.wrong)) return false;
      if (s.right < 0 || s.wrong < 0) return false;
    }
  }
  return true;
}
