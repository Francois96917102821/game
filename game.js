"use strict";

const MAX_ROOMS = 6;
const XP_PER_LEVEL = 20;
const SAVE_KEY = "well-of-whispers-best-floor";
const RUN_SAVE_KEY = "well-of-whispers-active-run";
const SAVE_VERSION = 1;
const ENEMY_TYPES = [
  { name: "Плесневый ползун", icon: "☠", hp: 13, damage: 4, xp: 8, gold: 4 },
  { name: "Слепой страж", icon: "☠", hp: 17, damage: 5, xp: 11, gold: 6 },
  { name: "Теневой осколок", icon: "☠", hp: 12, damage: 6, xp: 10, gold: 5 },
];

const $ = (id) => document.getElementById(id);
const ui = {
  level: $("level-badge"),
  health: $("health-value"),
  healthBar: $("health-bar"),
  xp: $("xp-value"),
  xpBar: $("xp-bar"),
  attack: $("attack-value"),
  gold: $("gold-value"),
  potions: $("potion-value"),
  best: $("best-floor"),
  floor: $("floor-value"),
  floorTitle: $("floor-title"),
  scene: $("well-scene"),
  caption: $("scene-caption"),
  character: $("scene-character"),
  startCard: $("start-card"),
  startTitle: $("start-title"),
  startDescription: $("start-description"),
  startButton: $("start-button"),
  resumeButton: $("resume-button"),
  savedSummary: $("saved-summary"),
  roomCount: $("room-count"),
  roomTrack: $("room-track"),
  eventIcon: $("event-icon"),
  eventKicker: $("event-kicker"),
  eventText: $("event-text"),
  eventTag: $("event-tag"),
  explore: $("explore-button"),
  potion: $("potion-button"),
  combatActions: $("combat-actions"),
  combatPotionCount: $("combat-potion-count"),
  descend: $("descend-button"),
  restart: $("restart-button"),
  journal: $("journal-list"),
  objectiveTitle: $("objective-title"),
  objectiveText: $("objective-text"),
  objectiveProgress: $("objective-progress"),
  journalStatus: $("journal-status"),
};

let state = createState();
let bestFloor = readBestFloor();
let savedRun = readSavedRun();
let audioContext = null;
let soundEnabled = false;

function createState() {
  return {
    started: false,
    gameOver: false,
    floor: 1,
    room: 0,
    hp: 30,
    maxHp: 30,
    attack: 5,
    potions: 2,
    gold: 0,
    xp: 0,
    level: 1,
    enemy: null,
    guarding: false,
    waitingToDescend: false,
    caption: "Внизу кто-то ждёт",
    event: {
      kicker: "ПЕРЕД СПУСКОМ",
      text: "Старый колодец давно молчит. Но сегодня из темноты донёсся зов.",
      icon: "☼",
      tag: "ЭТАЖ 1",
    },
    journal: [],
  };
}

function isIntegerBetween(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function isValidRun(run) {
  if (!run || run.version !== SAVE_VERSION || !run.state || typeof run.state !== "object") return false;
  const saved = run.state;
  if (
    saved.started !== true || saved.gameOver !== false ||
    !isIntegerBetween(saved.floor, 1, 1000000) ||
    !isIntegerBetween(saved.room, 0, MAX_ROOMS) ||
    !isIntegerBetween(saved.maxHp, 1, 1000000) ||
    !isIntegerBetween(saved.hp, 1, saved.maxHp) ||
    !isIntegerBetween(saved.attack, 1, 1000000) ||
    !isIntegerBetween(saved.potions, 0, 4) ||
    !isIntegerBetween(saved.gold, 0, 1000000000) ||
    !isIntegerBetween(saved.level, 1, 10000) ||
    !isIntegerBetween(saved.xp, 0, XP_PER_LEVEL * saved.level - 1) ||
    typeof saved.guarding !== "boolean" ||
    typeof saved.waitingToDescend !== "boolean" ||
    !Array.isArray(saved.journal) || saved.journal.length > 7 ||
    !saved.event || typeof saved.event !== "object" ||
    typeof saved.caption !== "string" || saved.caption.length > 100 ||
    (saved.room === MAX_ROOMS && !saved.enemy && !saved.waitingToDescend)
  ) return false;

  if (saved.enemy !== null) {
    if (
      !saved.enemy || typeof saved.enemy !== "object" ||
      typeof saved.enemy.name !== "string" || saved.enemy.name.length > 100 ||
      !isIntegerBetween(saved.enemy.hp, 1, 1000000) ||
      !isIntegerBetween(saved.enemy.maxHp, saved.enemy.hp, 1000000) ||
      !isIntegerBetween(saved.enemy.damage, 1, 1000000) ||
      !isIntegerBetween(saved.enemy.xp, 0, 1000000) ||
      !isIntegerBetween(saved.enemy.gold, 0, 1000000) ||
      typeof saved.enemy.boss !== "boolean" ||
      saved.enemy.boss !== (saved.room === MAX_ROOMS) ||
      saved.room === 0 || saved.waitingToDescend
    ) return false;
  } else if (saved.waitingToDescend && saved.room !== MAX_ROOMS) {
    return false;
  }

  return saved.journal.every((entry) =>
    entry && typeof entry.title === "string" && entry.title.length <= 100 &&
    typeof entry.text === "string" && entry.text.length <= 300 &&
    typeof entry.symbol === "string" && entry.symbol.length <= 8 &&
    isIntegerBetween(entry.floor, 1, 1000000)
  ) &&
    typeof saved.event.kicker === "string" && saved.event.kicker.length <= 100 &&
    typeof saved.event.text === "string" && saved.event.text.length <= 300 &&
    typeof saved.event.icon === "string" && saved.event.icon.length <= 8 &&
    typeof saved.event.tag === "string" && saved.event.tag.length <= 100;
}

function readBestFloor() {
  try {
    const value = Number(window.localStorage.getItem(SAVE_KEY));
    return Number.isInteger(value) && value > 0 ? value : 0;
  } catch (error) {
    console.warn("Не удалось прочитать рекорд спуска.", error);
    return 0;
  }
}

function readSavedRun() {
  let raw;
  try {
    raw = window.localStorage.getItem(RUN_SAVE_KEY);
  } catch (error) {
    console.warn("Не удалось прочитать сохранённый спуск.", error);
    return null;
  }
  if (!raw) return null;

  let run;
  try {
    run = JSON.parse(raw);
  } catch (error) {
    console.warn("Сохранённый спуск не удаётся прочитать; начните новый.", error);
    try {
      window.localStorage.removeItem(RUN_SAVE_KEY);
    } catch (removeError) {
      console.warn("Не удалось удалить повреждённый спуск.", removeError);
    }
    return null;
  }
  if (isValidRun(run)) return run.state;

  console.warn("Сохранённый спуск несовместим с текущей версией; начните новый.");
  try {
    window.localStorage.removeItem(RUN_SAVE_KEY);
  } catch (error) {
    console.warn("Не удалось удалить несовместимый спуск.", error);
  }
  return null;
}

function saveActiveRun() {
  if (!state.started) return;
  try {
    if (state.gameOver) {
      window.localStorage.removeItem(RUN_SAVE_KEY);
      return;
    }
    window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
  } catch (error) {
    console.warn("Не удалось автоматически сохранить спуск.", error);
  }
}

function saveBestFloor() {
  if (state.floor <= bestFloor) return;
  bestFloor = state.floor;
  try {
    window.localStorage.setItem(SAVE_KEY, String(bestFloor));
  } catch (error) {
    console.warn("Не удалось сохранить рекорд спуска.", error);
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addJournal(title, text, symbol = "✧") {
  state.journal.unshift({ title, text, symbol, floor: state.floor });
  state.journal = state.journal.slice(0, 7);
}

function setEvent(kicker, text, icon, tag) {
  state.event = { kicker, text, icon, tag: tag || `ЭТАЖ ${state.floor}` };
  ui.eventKicker.textContent = state.event.kicker;
  ui.eventText.textContent = state.event.text;
  ui.eventIcon.textContent = state.event.icon;
  ui.eventTag.textContent = state.event.tag;
}

function setCaption(text) {
  state.caption = text;
  ui.caption.textContent = text;
}

function startGame() {
  state = createState();
  savedRun = null;
  state.started = true;
  state.attack = randomInt(5, 8);
  addJournal("Спуск начался", "Ты переступил порог колодца. Обратного пути пока нет.", "↓");
  setEvent("ПЕРВЫЙ ЗАЛ", "Каменная лестница уходит вниз. В темноте мерцает слабый свет.", "↓", "ЭТАЖ 1");
  setCaption("Путь начинается");
  ui.startCard.hidden = true;
  ui.journalStatus.textContent = "Ты внутри колодца";
  playTone(220, 0.09);
  render();
}

function resumeGame() {
  if (!savedRun) return;
  state = savedRun;
  savedRun = null;
  render();
  playTone(220, 0.09);
}

function explore() {
  if (!state.started || state.enemy || state.gameOver || state.waitingToDescend) return;
  state.room += 1;
  state.guarding = false;
  updateBestFloor();
  if (state.room === MAX_ROOMS) {
    spawnEnemy(true);
    return;
  }

  const roll = Math.random();
  if (roll < 0.47) {
    spawnEnemy(false);
  } else if (roll < 0.73) {
    const reward = randomInt(5, 12) + state.floor;
    state.gold += reward;
    const foundPotion = Math.random() < 0.28 && state.potions < 4;
    if (foundPotion) state.potions += 1;
    const loot = `Под осыпавшимися камнями нашлось ${reward} монет${foundPotion ? " и зелье" : ""}.`;
    setEvent("ТАЙНИК НАЙДЕН", loot, "✦");
    addJournal("Спрятанная добыча", loot, "✦");
    setCaption("Здесь кто-то был");
    playTone(490, 0.12);
  } else if (roll < 0.88) {
    const healing = Math.min(randomInt(6, 11), state.maxHp - state.hp);
    state.hp += healing;
    setEvent("ТИХИЙ ИСТОЧНИК", healing > 0 ? `Чистая вода вернула ${healing} здоровья.` : "Вода холодна, но ты уже полон сил.", "◌");
    addJournal("Глоток передышки", healing > 0 ? `Источник восстановил ${healing} здоровья.` : "Ты нашёл источник, но не нуждался в лечении.", "◌");
    setCaption("Вода светится");
    playTone(360, 0.15);
  } else {
    const damage = Math.min(randomInt(3, 6), state.hp - 1);
    state.hp -= damage;
    setEvent("КАМЕННАЯ ЛОВУШКА", `Осыпавшийся свод задел тебя. Потеряно ${damage} здоровья.`, "⌁");
    addJournal("Опасный проход", `Ловушка отняла ${damage} здоровья.`, "⌁");
    setCaption("Пыль оседает");
    playTone(145, 0.12);
  }
  render();
}

function spawnEnemy(isBoss) {
  const base = isBoss
    ? { name: "Хранитель колодца", icon: "☠", hp: 24 + state.floor * 5, damage: 6 + state.floor, xp: 20, gold: 14 + state.floor * 2, boss: true }
    : ENEMY_TYPES[randomInt(0, ENEMY_TYPES.length - 1)];
  const scale = isBoss ? 1 : 1 + (state.floor - 1) * 0.16;
  state.enemy = {
    name: base.name,
    hp: Math.round(base.hp * scale),
    maxHp: Math.round(base.hp * scale),
    damage: Math.ceil(base.damage * scale),
    xp: base.xp,
    gold: base.gold,
    boss: Boolean(base.boss),
  };
  setEvent(isBoss ? "СТРАЖ ЭТАЖА" : "ОБИТАТЕЛЬ ГЛУБИНЫ", `${state.enemy.name} преграждает путь. Здоровье: ${state.enemy.hp}.`, isBoss ? "☠" : "⚔");
  addJournal(isBoss ? "Страж пробуждён" : "Встреча в темноте", `${state.enemy.name} вступает в бой.`, isBoss ? "☠" : "⚔");
  setCaption(isBoss ? "Страж колодца" : "Враг приближается");
  playTone(isBoss ? 110 : 165, 0.18);
  render();
}

function attackEnemy(multiplier = 1, guarding = false) {
  if (!state.enemy || state.gameOver) return;
  const damage = Math.max(1, Math.floor((state.attack + randomInt(0, 3)) * multiplier));
  state.enemy.hp = Math.max(0, state.enemy.hp - damage);
  setEvent("УДАР НАНЕСЁН", `Ты наносишь ${damage} урона. У ${state.enemy.name} осталось ${state.enemy.hp} здоровья.`, "⚔");
  ui.scene.classList.add("hit");
  window.setTimeout(() => ui.scene.classList.remove("hit"), 180);
  playTone(multiplier > 1 ? 300 : 250, 0.07);
  if (state.enemy.hp <= 0) {
    defeatEnemy();
    return;
  }
  enemyTurn(guarding);
}

function enemyTurn(guarding = false) {
  const rawDamage = randomInt(Math.max(1, state.enemy.damage - 2), state.enemy.damage);
  const damage = Math.max(1, guarding || state.guarding ? Math.ceil(rawDamage * 0.4) : rawDamage);
  state.guarding = false;
  state.hp = Math.max(0, state.hp - damage);
  if (state.hp === 0) {
    state.gameOver = true;
    state.enemy = null;
    setEvent("ПОСЛЕДНИЙ ВДОХ", `Ты пал на ${state.floor}-м этаже. Лучший спуск: ${bestFloor || state.floor}.`, "☾");
    addJournal("Спуск прерван", "Темнота сомкнулась вокруг. Но легенда колодца останется.", "☾");
    setCaption("Тишина");
  } else {
    setEvent("ВРАГ АТАКУЕТ", `${state.enemy.name} наносит ${damage} урона${guarding ? ", но твоя защита смягчает удар" : ""}.`, "⬡");
    setCaption("Бой продолжается");
  }
  playTone(guarding ? 185 : 125, 0.1);
  render();
}

function defeatEnemy() {
  const enemy = state.enemy;
  state.enemy = null;
  state.gold += enemy.gold;
  gainXp(enemy.xp);
  if (enemy.boss) {
    state.waitingToDescend = true;
    const bonus = Math.min(8, state.maxHp - state.hp);
    state.hp += bonus;
    setEvent("СТРАЖ ПОВЕРЖЕН", `Ты получил ${enemy.xp} опыта и ${enemy.gold} монет.${bonus ? ` Передышка вернула ${bonus} здоровья.` : ""} Путь вниз открыт.`, "✧", "ПУТЬ ОТКРЫТ");
    addJournal("Путь открыт", `Страж повержен. Ты готов спуститься на ${state.floor + 1}-й этаж.`, "↓");
    setCaption("Лестница открыта");
    playTone(560, 0.2);
  } else {
    const foundPotion = Math.random() < 0.2 && state.potions < 4;
    if (foundPotion) state.potions += 1;
    setEvent("ПОБЕДА", `Враг повержен: +${enemy.xp} опыта, +${enemy.gold} монет${foundPotion ? ", +1 зелье" : ""}.`, "✧");
    addJournal("Враг повержен", `+${enemy.xp} опыта и +${enemy.gold} монет.`, "⚔");
    setCaption("В зале тихо");
    playTone(420, 0.14);
  }
  render();
}

function gainXp(amount) {
  state.xp += amount;
  while (state.xp >= XP_PER_LEVEL * state.level) {
    state.xp -= XP_PER_LEVEL * state.level;
    state.level += 1;
    state.maxHp += 6;
    state.hp = Math.min(state.maxHp, state.hp + 12);
    state.attack += 1;
    addJournal("Новый уровень", `Уровень ${state.level}: здоровье и сила выросли.`, "✦");
  }
}

function drinkPotion(inCombat = false) {
  if (!state.started || state.potions <= 0 || state.hp >= state.maxHp || state.gameOver) return;
  state.potions -= 1;
  const healing = Math.min(14, state.maxHp - state.hp);
  state.hp += healing;
  setEvent("ЗЕЛЬЕ ВЫПИТО", `Ты восстановил ${healing} здоровья.`, "⚗");
  addJournal("Зелье здоровья", `Восстановлено ${healing} здоровья.`, "⚗");
  playTone(390, 0.13);
  if (inCombat && state.enemy) enemyTurn(false);
  else render();
}

function descend() {
  if (!state.waitingToDescend || state.gameOver) return;
  state.floor += 1;
  state.room = 0;
  state.waitingToDescend = false;
  state.hp = Math.min(state.maxHp, state.hp + 8);
  state.potions = Math.min(4, state.potions + 1);
  updateBestFloor();
  setEvent("НОВЫЙ ЭТАЖ", "Ты спустился глубже. Новый источник света дрожит впереди.", "↓", `ЭТАЖ ${state.floor}`);
  addJournal("Глубже во мрак", `Начался ${state.floor}-й этаж. Ты нашёл зелье и немного восстановил силы.`, "↓");
  setCaption("Глубина зовёт");
  playTone(220, 0.13);
  render();
}

function updateBestFloor() {
  saveBestFloor();
}

function renderTrack() {
  ui.roomTrack.replaceChildren();
  for (let room = 1; room <= MAX_ROOMS; room += 1) {
    const node = document.createElement("div");
    node.className = "room-node";
    if (room < state.room || state.waitingToDescend) node.classList.add("passed");
    if (room === state.room && !state.waitingToDescend) node.classList.add("current");
    if (room === MAX_ROOMS) node.classList.add("boss");
    const dot = document.createElement("span");
    dot.className = "room-dot";
    dot.textContent = room === MAX_ROOMS ? "☠" : String(room);
    node.append(dot);
    ui.roomTrack.append(node);
  }
  ui.roomCount.textContent = state.started ? `${state.room} / ${MAX_ROOMS} залов` : "Начни своё путешествие";
  const progress = state.waitingToDescend ? 100 : (state.room / MAX_ROOMS) * 100;
  ui.objectiveProgress.style.width = `${progress}%`;
}

function renderJournal() {
  ui.journal.replaceChildren();
  if (state.journal.length === 0) {
    const empty = document.createElement("p");
    empty.className = "journal-empty";
    empty.textContent = "Здесь появятся заметки о твоём путешествии.";
    ui.journal.append(empty);
    return;
  }
  for (const entry of state.journal) {
    const article = document.createElement("article");
    article.className = "journal-entry";
    const symbol = document.createElement("span");
    symbol.className = "journal-symbol";
    symbol.textContent = entry.symbol;
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.title;
    const description = document.createElement("p");
    description.textContent = entry.text;
    copy.append(title, description);
    article.append(symbol, copy);
    ui.journal.append(article);
  }
}

function render() {
  ui.level.textContent = `УР. ${state.level}`;
  ui.health.textContent = `${state.hp} / ${state.maxHp}`;
  ui.healthBar.style.width = `${(state.hp / state.maxHp) * 100}%`;
  const xpTarget = XP_PER_LEVEL * state.level;
  ui.xp.textContent = `${state.xp} / ${xpTarget}`;
  ui.xpBar.style.width = `${Math.min(100, (state.xp / xpTarget) * 100)}%`;
  ui.attack.textContent = `${state.attack}–${state.attack + 3}`;
  ui.gold.textContent = String(state.gold);
  ui.potions.textContent = String(state.potions);
  ui.best.textContent = bestFloor ? `ЭТАЖ ${bestFloor}` : "—";
  ui.floor.textContent = state.started ? `ЭТАЖ ${state.floor}` : "—";
  ui.floorTitle.textContent = state.started ? `Зал ${state.room || 1} · ${state.enemy ? state.enemy.name : "Колодец шёпота"}` : "Зов из глубины";
  ui.caption.textContent = state.caption;
  ui.eventKicker.textContent = state.event.kicker;
  ui.eventText.textContent = state.event.text;
  ui.eventIcon.textContent = state.event.icon;
  ui.eventTag.textContent = state.event.tag;
  ui.scene.classList.toggle("in-combat", Boolean(state.enemy));
  ui.character.textContent = "♙";
  ui.explore.disabled = !state.started || Boolean(state.enemy) || state.gameOver || state.waitingToDescend;
  ui.potion.disabled = !state.started || state.potions === 0 || state.hp >= state.maxHp || state.gameOver;
  $("combat-potion-button").disabled = state.potions === 0 || state.hp >= state.maxHp || state.gameOver;
  ui.combatPotionCount.textContent = String(state.potions);
  ui.explore.textContent = state.room === 0 ? "Войти в первый зал" : "Исследовать зал";
  ui.explore.replaceChildren(Object.assign(document.createElement("span"), { textContent: "⌕" }), document.createTextNode(` ${state.room === 0 ? "Войти в первый зал" : "Исследовать зал"}`));
  ui.explore.hidden = !state.started || Boolean(state.enemy) || state.gameOver || state.waitingToDescend;
  ui.potion.hidden = !state.started || Boolean(state.enemy) || state.gameOver || state.waitingToDescend;
  ui.combatActions.hidden = !state.enemy || state.gameOver;
  ui.descend.hidden = !state.waitingToDescend || state.gameOver;
  ui.restart.hidden = !state.gameOver;
  ui.startCard.hidden = state.started;
  ui.startCard.classList.toggle("has-save", Boolean(savedRun));
  ui.resumeButton.hidden = !savedRun;
  ui.startButton.textContent = savedRun ? "Начать новый спуск" : "Начать спуск ↓";
  ui.startButton.classList.toggle("new-run-button", Boolean(savedRun));
  ui.startTitle.textContent = savedRun ? "С возвращением!" : "Не каждый колодец ведёт к воде.";
  ui.startDescription.textContent = savedRun
    ? "Твой путь сохранён: продолжай исследовать и сражаться."
    : "Спускайся по забытым залам, собирай добычу и выясни, кто зовёт со дна.";
  ui.savedSummary.hidden = !savedRun;
  if (savedRun) {
    const progress = savedRun.waitingToDescend
      ? "лестница в глубину открыта"
      : savedRun.enemy
        ? `бой с ${savedRun.enemy.name}`
        : `${savedRun.room} / ${MAX_ROOMS} залов`;
    ui.savedSummary.textContent = `Этаж ${savedRun.floor} · уровень ${savedRun.level} · ${progress}`;
  }
  ui.objectiveTitle.textContent = state.waitingToDescend ? "Путь в глубину открыт" : state.gameOver ? "Спуск завершён" : "Найти источник зова";
  ui.objectiveText.textContent = state.gameOver
    ? `Ты дошёл до ${state.floor}-го этажа. Начни новый спуск и попробуй пройти дальше.`
    : state.waitingToDescend
      ? "Страж повержен. Отдохни и спускайся к следующему этажу."
      : "Исследуй 5 залов и одолей стража этажа, чтобы открыть путь дальше.";
  ui.journalStatus.textContent = state.gameOver ? "Путешествие завершено" : state.waitingToDescend ? "Лестница в глубину открыта" : state.started ? "Ты внутри колодца" : "Твой путь ждёт начала";
  renderTrack();
  renderJournal();
  saveActiveRun();
}

function playTone(frequency, duration) {
  if (!soundEnabled) return;
  try {
    audioContext ||= new window.AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    oscillator.type = "sine";
    gain.gain.setValueAtTime(0.045, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn("Звуковой эффект недоступен.", error);
  }
}

ui.startButton.addEventListener("click", startGame);
ui.resumeButton.addEventListener("click", resumeGame);
ui.explore.addEventListener("click", explore);
ui.potion.addEventListener("click", () => drinkPotion(false));
$("attack-button").addEventListener("click", () => attackEnemy());
$("heavy-button").addEventListener("click", () => attackEnemy(1.8));
$("combat-potion-button").addEventListener("click", () => drinkPotion(true));
$("guard-button").addEventListener("click", () => enemyTurn(true));
ui.descend.addEventListener("click", descend);
ui.restart.addEventListener("click", startGame);
$("sound-toggle").addEventListener("click", (event) => {
  soundEnabled = !soundEnabled;
  event.currentTarget.setAttribute("aria-pressed", String(soundEnabled));
  event.currentTarget.setAttribute("aria-label", soundEnabled ? "Звук включён" : "Звук выключен");
  event.currentTarget.title = soundEnabled ? "Звук включён" : "Звук выключен";
  if (soundEnabled) playTone(330, 0.12);
});

render();
