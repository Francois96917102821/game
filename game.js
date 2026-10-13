"use strict";

const MAX_ROOMS = 6;
const XP_PER_LEVEL = 20;
const SAVE_KEY = "well-of-whispers-best-floor";
const RUN_SAVE_KEY = "well-of-whispers-active-run";
const SAVE_VERSION = 1;
const POTION_LIMIT = 4;
const MAX_FOCUS = 3;
const HEAVY_ATTACK_COST = 2;
const MAX_GEAR = 6;
const SUBCLASS_LEVELS = [3, 6, 9];
const MERCHANT_PRICES = { potion: 12, weapon: 18, armor: 24, healing: 8 };
const CHARACTER_CLASSES = [
  {
    id: "warrior", name: "Воин", icon: "⚔", role: "Защитник",
    description: "Крепкий боец, который выдерживает натиск врагов.",
    maxHp: 38, attack: 5, defense: 1, heavyMultiplier: 2.2, passive: "Получает на 1 урон меньше от каждой атаки.",
    subclasses: [
      { id: "guardian", name: "Страж", description: "Ещё 1 единица защиты.", effect: "defense" },
      { id: "slayer", name: "Губитель", description: "+2 к силе атаки.", effect: "attack" },
      { id: "champion", name: "Чемпион", description: "Сокрушительный удар сильнее на 50%.", effect: "heavy" },
    ],
  },
  {
    id: "ranger", name: "Следопыт", icon: "➶", role: "Охотник",
    description: "Меткий путешественник, находящий трофеи и слабости врагов.",
    maxHp: 30, attack: 6, defense: 0, heavyMultiplier: 2.2, passive: "Чаще находит экипировку после победы.",
    subclasses: [
      { id: "sniper", name: "Снайпер", description: "+2 к силе атаки.", effect: "attack" },
      { id: "tracker", name: "Зверолов", description: "Ещё 15% шанс найти экипировку.", effect: "loot" },
      { id: "survivor", name: "Выживший", description: "+1 единица защиты и +4 к здоровью.", effect: "defense-health" },
    ],
  },
  {
    id: "mage", name: "Маг", icon: "✦", role: "Заклинатель",
    description: "Хрупкий чародей, превращающий запас силы в разрушительную магию.",
    maxHp: 26, attack: 7, defense: 0, heavyMultiplier: 2.6, passive: "Сокрушительный удар наносит больше урона.",
    subclasses: [
      { id: "evoker", name: "Чародей", description: "Сокрушительный удар сильнее на 50%.", effect: "heavy" },
      { id: "frostmage", name: "Ледяной маг", description: "Враги наносят на 2 урона меньше.", effect: "defense-2" },
      { id: "mender", name: "Целитель", description: "Зелья восстанавливают ещё 6 здоровья.", effect: "potion" },
    ],
  },
  {
    id: "rogue", name: "Плут", icon: "◈", role: "Ловкач",
    description: "Быстрый дуэлянт, умеющий уворачиваться и наносить точные удары.",
    maxHp: 28, attack: 6, defense: 0, heavyMultiplier: 2.2, passive: "Имеет 15% шанс полностью уклониться от атаки.",
    subclasses: [
      { id: "assassin", name: "Ассасин", description: "Сокрушительный удар сильнее на 50%.", effect: "heavy" },
      { id: "shadow", name: "Теневой танцор", description: "Ещё 10% шанс уклониться от атаки.", effect: "dodge" },
      { id: "cutpurse", name: "Головорез", description: "+2 к силе атаки и +10% к поиску добычи.", effect: "attack-loot" },
    ],
  },
  {
    id: "paladin", name: "Паладин", icon: "☼", role: "Хранитель",
    description: "Защитник, который лечится после побед и стоит на пути тьмы.",
    maxHp: 36, attack: 5, defense: 1, heavyMultiplier: 2.2, passive: "Восстанавливает 3 здоровья после каждой победы.",
    subclasses: [
      { id: "oathkeeper", name: "Клятвохранитель", description: "Ещё 1 единица защиты.", effect: "defense" },
      { id: "inquisitor", name: "Инквизитор", description: "+2 к силе атаки.", effect: "attack" },
      { id: "luminary", name: "Светоносец", description: "После победы восстанавливает ещё 4 здоровья.", effect: "heal" },
    ],
  },
  {
    id: "berserker", name: "Берсерк", icon: "✹", role: "Неистовый боец",
    description: "Рискует здоровьем ради тяжёлых ударов и натиска без остановки.",
    maxHp: 34, attack: 7, defense: 0, heavyMultiplier: 2.2, passive: "Ниже половины здоровья атаки наносят ещё 2 урона.",
    subclasses: [
      { id: "reaver", name: "Разоритель", description: "Сокрушительный удар сильнее на 50%.", effect: "heavy" },
      { id: "ironhide", name: "Железная шкура", description: "+2 единицы защиты.", effect: "defense-2" },
      { id: "blooddrinker", name: "Кровопийца", description: "Восстанавливает 4 здоровья после победы.", effect: "heal" },
    ],
  },
];
const CLASS_BY_ID = new Map(CHARACTER_CLASSES.map((characterClass) => [characterClass.id, characterClass]));
const SUBCLASS_BY_ID = new Map(CHARACTER_CLASSES.flatMap((characterClass) =>
  characterClass.subclasses.map((subclass) => [subclass.id, { ...subclass, classId: characterClass.id }])
));
const FLOOR_THEMES = [
  {
    id: "well",
    name: "Колодец шёпота",
    entrance: "Эхо старого колодца зовёт с каждым шагом. Каменные плиты прячут следы прежних путников.",
    spring: "В трещине старой кладки бьёт чистый подземный ключ.",
    trap: "Изношенная каменная плита провалилась под ногой.",
    shrine: "В нише мерцает древняя руна. Она впитывает тусклый свет.",
    guardian: "Хранитель колодца",
    guardianIcon: "☠",
    bossHp: 29,
    bossDamage: 7,
    bossXp: 24,
    bossGold: 19,
  },
  {
    id: "drowned",
    name: "Затопленный город",
    entrance: "Дальше лестница скрывается под чёрной водой. С верхних арок свисают забытые якорные цепи.",
    spring: "В каменной чаше собралась свежая вода — не из чёрного затопленного коридора.",
    trap: "Под водой щёлкнула цепная ловушка — волна сбила тебя с ног.",
    shrine: "Затопленная статуя открывает глаза. На дне вспыхивает морская руна.",
    guardian: "Певица бездны",
    guardianIcon: "♆",
    bossHp: 35,
    bossDamage: 8,
    bossXp: 28,
    bossGold: 23,
  },
  {
    id: "roots",
    name: "Корневой собор",
    entrance: "Потолок исчез под переплетёнными корнями. Сквозь трещины пробивается золотистое свечение.",
    spring: "В старом древесном корне хранится сладкая целебная смола.",
    trap: "Живой корень обвил ногу и рванул из темноты.",
    shrine: "Разросшиеся корни сложились в подобие трона. Внутри теплится семя света.",
    guardian: "Сердце подземного дерева",
    guardianIcon: "✹",
    bossHp: 42,
    bossDamage: 9,
    bossXp: 32,
    bossGold: 27,
  },
  {
    id: "forge",
    name: "Кузница пепла",
    entrance: "В глубине открылась покинутая кузница. Угли давно остыли, но воздух всё ещё пахнет железом.",
    spring: "Между закопчённых наковален пробился прохладный горный ручей.",
    trap: "Ржавые лопасти кузнечного механизма сорвались с креплений.",
    shrine: "На чёрной наковальне лежит рунный осколок, сохранивший жар.",
    guardian: "Пепельный король",
    guardianIcon: "♨",
    bossHp: 48,
    bossDamage: 10,
    bossXp: 38,
    bossGold: 32,
  },
];

const ENEMY_TYPES = [
  { theme: "well", name: "Плесневый ползун", icon: "☣", skin: "moss", hp: 13, damage: 4, xp: 8, gold: 4 },
  { theme: "well", name: "Слепой страж", icon: "♟", skin: "stone", hp: 17, damage: 5, xp: 11, gold: 6 },
  { theme: "well", name: "Теневой осколок", icon: "✧", skin: "shade", hp: 12, damage: 6, xp: 10, gold: 5 },
  { theme: "drowned", name: "Утопший дозорный", icon: "⚓", skin: "drowned", hp: 17, damage: 6, xp: 11, gold: 7 },
  { theme: "drowned", name: "Глубинный угорь", icon: "♆", skin: "eel", hp: 14, damage: 8, xp: 12, gold: 8 },
  { theme: "drowned", name: "Призрак корабля", icon: "≋", skin: "wraith", hp: 15, damage: 6, xp: 12, gold: 8 },
  { theme: "roots", name: "Сплетённый страж", icon: "♣", skin: "root", hp: 21, damage: 7, xp: 15, gold: 9 },
  { theme: "roots", name: "Грибной чтец", icon: "❋", skin: "spore", hp: 15, damage: 9, xp: 15, gold: 10 },
  { theme: "roots", name: "Корневая гончая", icon: "❈", skin: "hound", hp: 18, damage: 8, xp: 14, gold: 9 },
  { theme: "forge", name: "Железный скорпион", icon: "⛓", skin: "iron", hp: 24, damage: 8, xp: 18, gold: 11 },
  { theme: "forge", name: "Жар-паук", icon: "♨", skin: "ember", hp: 19, damage: 11, xp: 18, gold: 12 },
  { theme: "forge", name: "Огненный голем", icon: "♟", skin: "golem", hp: 27, damage: 9, xp: 20, gold: 13 },
];
const ENEMY_SKINS = new Set([...ENEMY_TYPES.map((enemy) => enemy.skin), "guardian"]);

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
  enemy: $("scene-enemy"),
  merchant: $("scene-merchant"),
  startCard: $("start-card"),
  startKicker: $("start-kicker"),
  startTitle: $("start-title"),
  startDescription: $("start-description"),
  startButton: $("start-button"),
  classDialog: $("class-dialog"),
  classOptions: $("class-options"),
  classDetails: $("class-details"),
  chooseClassButton: $("choose-class-button"),
  subclassDialog: $("subclass-dialog"),
  subclassOptions: $("subclass-options"),
  subclassLevel: $("subclass-level"),
  subclassChoices: $("subclass-choices"),
  equippedClass: $("equipped-class"),
  classPassive: $("class-passive"),
  equippedSubclass: $("equipped-subclass"),
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
  focusValue: $("focus-value"),
  focusBar: $("focus-bar"),
  heavyButton: $("heavy-button"),
  equippedWeapon: $("equipped-weapon"),
  equippedArmor: $("equipped-armor"),
  inventoryCount: $("inventory-count"),
  inventory: $("inventory-list"),
  merchantActions: $("merchant-actions"),
  buyPotion: $("buy-potion-button"),
  buyWeapon: $("buy-weapon-button"),
  buyArmor: $("buy-armor-button"),
  buyHealing: $("buy-healing-button"),
  leaveMerchant: $("leave-merchant-button"),
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
let selectedClassId = "warrior";
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
    classId: null,
    subclassId: null,
    subclassRank: 0,
    pendingSubclassLevels: [],
    enemy: null,
    guarding: false,
    focus: 0,
    equipment: { weapon: null, armor: null },
    inventory: [],
    gearSequence: 0,
    merchantAvailable: false,
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
    (saved.classId !== undefined && saved.classId !== null && !CLASS_BY_ID.has(saved.classId)) ||
    (saved.subclassId !== undefined && saved.subclassId !== null &&
      (!SUBCLASS_BY_ID.has(saved.subclassId) || SUBCLASS_BY_ID.get(saved.subclassId).classId !== saved.classId)) ||
    (saved.subclassRank !== undefined && (
      !isIntegerBetween(saved.subclassRank, 0, 3) || (saved.subclassRank > 0 && !saved.subclassId)
    )) ||
    (saved.pendingSubclassLevels !== undefined && (
      !Array.isArray(saved.pendingSubclassLevels) || saved.pendingSubclassLevels.length > 1 ||
      !saved.pendingSubclassLevels.every((level) => level === 3 && level <= saved.level) ||
      new Set(saved.pendingSubclassLevels).size !== saved.pendingSubclassLevels.length ||
      (saved.pendingSubclassLevels.length > 0 && !saved.classId)
    )) ||
    typeof saved.guarding !== "boolean" ||
    (saved.focus !== undefined && !isIntegerBetween(saved.focus, 0, MAX_FOCUS)) ||
    (saved.inventory !== undefined && (
      !Array.isArray(saved.inventory) || saved.inventory.length > MAX_GEAR ||
      !saved.inventory.every(isValidGear)
    )) ||
    (saved.equipment !== undefined && (
      !saved.equipment || typeof saved.equipment !== "object" ||
      !["weapon", "armor"].every((type) =>
        saved.equipment[type] === null || isValidGear(saved.equipment[type], type)
      )
    )) ||
    (saved.gearSequence !== undefined && !isIntegerBetween(saved.gearSequence, 0, 1000000000)) ||
    typeof saved.waitingToDescend !== "boolean" ||
    (saved.merchantAvailable !== undefined && typeof saved.merchantAvailable !== "boolean") ||
    !Array.isArray(saved.journal) || saved.journal.length > 7 ||
    !saved.event || typeof saved.event !== "object" ||
    typeof saved.caption !== "string" || saved.caption.length > 100 ||
    (saved.room === MAX_ROOMS && !saved.enemy && !saved.waitingToDescend)
  ) return false;

  if (saved.classId) {
    if (
      (saved.pendingSubclassLevels?.length && saved.subclassId) ||
      (saved.subclassRank && !saved.subclassId) ||
      (saved.subclassId && saved.subclassRank !== SUBCLASS_LEVELS.filter((level) => saved.level >= level).length)
    ) return false;
  }

  const storedGear = [
    ...(saved.inventory || []),
    ...["weapon", "armor"].map((type) => saved.equipment?.[type]).filter(Boolean),
  ];
  if (
    new Set(storedGear.map((item) => item.id)).size !== storedGear.length ||
    (storedGear.length > 0 && saved.gearSequence === undefined) ||
    storedGear.some((item) => Number(item.id.slice(5)) > saved.gearSequence)
  ) return false;

  if (saved.enemy !== null) {
    if (
      !saved.enemy || typeof saved.enemy !== "object" ||
      typeof saved.enemy.name !== "string" || saved.enemy.name.length > 100 ||
      (saved.enemy.icon !== undefined && (typeof saved.enemy.icon !== "string" || saved.enemy.icon.length > 8)) ||
      (saved.enemy.skin !== undefined && !ENEMY_SKINS.has(saved.enemy.skin)) ||
      !isIntegerBetween(saved.enemy.hp, 1, 1000000) ||
      !isIntegerBetween(saved.enemy.maxHp, saved.enemy.hp, 1000000) ||
      !isIntegerBetween(saved.enemy.damage, 1, 1000000) ||
      !isIntegerBetween(saved.enemy.xp, 0, 1000000) ||
      !isIntegerBetween(saved.enemy.gold, 0, 1000000) ||
      typeof saved.enemy.boss !== "boolean" ||
      saved.enemy.boss !== (saved.room === MAX_ROOMS) ||
      saved.room === 0 || saved.waitingToDescend || saved.merchantAvailable === true
    ) return false;
  } else if (saved.waitingToDescend && saved.room !== MAX_ROOMS) {
    return false;
  } else if (
    saved.merchantAvailable === true &&
    (saved.room === 0 || saved.room === MAX_ROOMS || saved.waitingToDescend)
  ) {
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

function isValidGear(item, expectedType) {
  return Boolean(
    item && typeof item === "object" &&
    typeof item.id === "string" && /^gear-\d+$/.test(item.id) &&
    (item.type === "weapon" || item.type === "armor") &&
    (!expectedType || item.type === expectedType) &&
    typeof item.name === "string" && item.name.length > 0 && item.name.length <= 60 &&
    isIntegerBetween(item.bonus, 1, 10)
  );
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

function getFloorTheme(floor = state.floor) {
  return FLOOR_THEMES[(floor - 1) % FLOOR_THEMES.length];
}

function getRoomEnemies() {
  return ENEMY_TYPES.filter((enemy) => enemy.theme === getFloorTheme().id);
}

function startGameWithClass(classId) {
  const characterClass = CLASS_BY_ID.get(classId);
  if (!characterClass) return;
  selectedClassId = classId;
  if (ui.classDialog.open) ui.classDialog.close();
  state = createState();
  savedRun = null;
  state.started = true;
  state.classId = characterClass.id;
  state.maxHp = characterClass.maxHp;
  state.hp = characterClass.maxHp;
  state.attack = randomInt(5, 8) + characterClass.attack - 5;
  $("player-name").textContent = characterClass.name;
  $("player-subtitle").textContent = characterClass.role;
  $("portrait-figure").textContent = characterClass.icon;
  addJournal("Спуск начался", "Ты переступил порог колодца. Обратного пути пока нет.", "↓");
  addJournal(`Класс: ${characterClass.name}`, characterClass.passive, characterClass.icon);
  setEvent("ПЕРВЫЙ ЗАЛ", getFloorTheme().entrance, "↓", `ЭТАЖ ${state.floor}`);
  setCaption("Путь начинается");
  ui.startCard.hidden = true;
  ui.journalStatus.textContent = "Ты внутри колодца";
  playTone(220, 0.09);
  render();
}

function getCharacterClass() {
  return CLASS_BY_ID.get(state.classId) || CHARACTER_CLASSES[0];
}

function getSubclassEffects() {
  const subclass = state.subclassId ? SUBCLASS_BY_ID.get(state.subclassId) : null;
  return subclass ? [subclass] : [];
}

function getClassStat(effect) {
  return getSubclassEffects().some((subclass) => subclass.effect === effect) ? state.subclassRank : 0;
}

function renderClassSelection() {
  ui.classOptions.replaceChildren();
  for (const characterClass of CHARACTER_CLASSES) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "class-option";
    option.dataset.classId = characterClass.id;
    option.setAttribute("aria-pressed", String(characterClass.id === selectedClassId));
    const icon = document.createElement("span");
    icon.className = "class-option-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = characterClass.icon;
    const name = document.createElement("strong");
    name.textContent = characterClass.name;
    const role = document.createElement("small");
    role.textContent = characterClass.role;
    option.append(icon, name, role);
    ui.classOptions.append(option);
  }
  const characterClass = CLASS_BY_ID.get(selectedClassId);
  ui.classDetails.replaceChildren();
  const details = document.createElement("p");
  details.textContent = characterClass.description;
  const stats = document.createElement("p");
  stats.textContent = `Здоровье: ${characterClass.maxHp} · Урон: ${characterClass.attack}–${characterClass.attack + 3}`;
  const passive = document.createElement("p");
  passive.textContent = `Особенность: ${characterClass.passive}`;
  ui.classDetails.append(details, stats, passive);
}

function openClassDialog() {
  renderClassSelection();
  ui.classDialog.showModal();
}

function renderSubclassChoices() {
  const level = state.pendingSubclassLevels[0];
  if (!level) return;
  ui.subclassLevel.textContent = `Уровень ${level}`;
  ui.subclassChoices.replaceChildren();
  for (const subclass of getCharacterClass().subclasses) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "subclass-option";
    option.dataset.subclassId = subclass.id;
    const name = document.createElement("strong");
    name.textContent = subclass.name;
    const description = document.createElement("span");
    description.textContent = subclass.description;
    option.append(name, description);
    ui.subclassChoices.append(option);
  }
  ui.subclassLevel.setAttribute("aria-label", `Выбери подкласс на ${level}-м уровне`);
  if (!ui.subclassDialog.open) ui.subclassDialog.showModal();
}

function chooseSubclass(subclassId) {
  const subclass = SUBCLASS_BY_ID.get(subclassId);
  if (
    !subclass || subclass.classId !== state.classId ||
    state.subclassId || state.pendingSubclassLevels[0] !== 3
  ) return;
  const level = state.pendingSubclassLevels.shift();
  state.subclassId = subclassId;
  state.subclassRank = SUBCLASS_LEVELS.filter((unlockLevel) => state.level >= unlockLevel).length;
  if (subclass.effect === "defense-health") {
    state.maxHp += 4;
    state.hp += 4;
  }
  setEvent("НОВАЯ СПЕЦИАЛИЗАЦИЯ", `Открыт подкласс «${subclass.name}»: ${subclass.description}`, "✦", `УРОВЕНЬ ${level}`);
  addJournal("Новый подкласс", `${subclass.name}: ${subclass.description}`, "✦");
  if (!state.pendingSubclassLevels.length) ui.subclassDialog.close();
  render();
}

function resumeGame() {
  if (!savedRun) return;
  state = savedRun;
  const migratedClass = !state.classId;
  if (state.focus === undefined) state.focus = 0;
  if (state.equipment === undefined) state.equipment = { weapon: null, armor: null };
  if (state.inventory === undefined) state.inventory = [];
  if (state.gearSequence === undefined) state.gearSequence = 0;
  if (migratedClass) state.classId = "warrior";
  if (state.subclassId === undefined) state.subclassId = null;
  if (state.subclassRank === undefined) state.subclassRank = state.subclassId
    ? SUBCLASS_LEVELS.filter((level) => state.level >= level).length
    : 0;
  if (state.pendingSubclassLevels === undefined) state.pendingSubclassLevels = [];
  if (migratedClass) {
    state.pendingSubclassLevels = state.level >= SUBCLASS_LEVELS[0] ? [SUBCLASS_LEVELS[0]] : [];
  }
  selectedClassId = state.classId;
  savedRun = null;
  render();
  playTone(220, 0.09);
}

function explore() {
  if (!state.started || state.enemy || state.gameOver || state.merchantAvailable || state.waitingToDescend) return;
  state.room += 1;
  state.guarding = false;
  updateBestFloor();
  if (state.room === MAX_ROOMS) {
    spawnEnemy(true);
    return;
  }

  const roll = Math.random();
  if (roll < 0.4) {
    spawnEnemy(false);
  } else if (roll < 0.6) {
    const reward = randomInt(5, 12) + state.floor;
    state.gold += reward;
    const foundPotion = Math.random() < 0.28 && state.potions < POTION_LIMIT;
    if (foundPotion) state.potions += 1;
    const loot = `Под осыпавшимися камнями нашлось ${reward} монет${foundPotion ? " и зелье" : ""}.`;
    setEvent("ТАЙНИК НАЙДЕН", loot, "✦");
    addJournal("Спрятанная добыча", loot, "✦");
    setCaption("Здесь кто-то был");
    playTone(490, 0.12);
  } else if (roll < 0.74) {
    const healing = Math.min(randomInt(6, 11), state.maxHp - state.hp);
    state.hp += healing;
    setEvent("ПЕРЕДЫШКА", healing > 0 ? `${getFloorTheme().spring} Ты восстановил ${healing} здоровья.` : `${getFloorTheme().spring} Ты уже полон сил.`, "◌");
    addJournal("Глоток передышки", healing > 0 ? `Источник восстановил ${healing} здоровья.` : "Ты нашёл источник, но не нуждался в лечении.", "◌");
    setCaption("Тихая передышка");
    playTone(360, 0.15);
  } else if (roll < 0.87) {
    const damage = Math.min(randomInt(3, 6), state.hp - 1);
    state.hp -= damage;
    const escape = damage ? `${getFloorTheme().trap} Потеряно ${damage} здоровья.` : `Ты чудом увернулся. ${getFloorTheme().trap}`;
    setEvent("ЛОВУШКА", escape, "⌁");
    addJournal("Опасный проход", escape, "⌁");
    setCaption(damage ? "Пыль оседает" : "Ты увернулся от ловушки");
    playTone(145, 0.12);
  } else if (roll < 0.95) {
    const blessing = Math.random() < 0.5;
    if (blessing) {
      state.attack += 1;
      setEvent("РУНА СИЛЫ", `${getFloorTheme().shrine} Урон навсегда увеличен на 1.`, "✧");
      addJournal("Пробуждение руны", "Старая руна навсегда увеличила силу удара на 1.", "✧");
    } else {
      state.maxHp += 4;
      const healing = Math.min(8, state.maxHp - state.hp);
      state.hp += healing;
      setEvent("РУНА ЖИЗНИ", `${getFloorTheme().shrine} Максимальное здоровье увеличено на 4${healing ? `, восстановлено ещё ${healing}` : ""}.`, "✧");
      addJournal("Благословение руны", `Максимальное здоровье выросло на 4, восстановлено ${healing}.`, "✧");
    }
    setCaption("Свет древней руны");
    playTone(530, 0.17);
  } else {
    state.merchantAvailable = true;
    setEvent("СКЕЛЕТ ТОРГОВЦА", "Немного монет за припасы или оружие? Выбирай товар или спокойно иди дальше.", "♙", "ТРАНСАКЦИЯ");
    addJournal("Странная лавка", "У костяного торговца есть зелья, лечение и оружие. Поторопиться можно, но торговаться не обязательно.", "♙");
    setCaption("Кто-то ждёт за прилавком");
    playTone(310, 0.14);
  }
  render();
}

function spawnEnemy(isBoss) {
  const theme = getFloorTheme();
  const roomEnemies = getRoomEnemies();
  const cycle = Math.floor((state.floor - 1) / FLOOR_THEMES.length);
  const base = isBoss ? {
    name: theme.guardian,
    icon: theme.guardianIcon,
    skin: "guardian",
    hp: theme.bossHp + cycle * 15,
    damage: theme.bossDamage + cycle * 2,
    xp: theme.bossXp + cycle * 8,
    gold: theme.bossGold + state.floor,
    boss: true,
  } : roomEnemies[randomInt(0, roomEnemies.length - 1)];
  const scale = 1 + (state.floor - 1) * 0.12;
  state.enemy = {
    name: base.name,
    icon: base.icon,
    skin: base.skin,
    hp: Math.round(base.hp * scale),
    maxHp: Math.round(base.hp * scale),
    damage: Math.ceil(base.damage * scale),
    xp: base.xp,
    gold: base.gold,
    boss: Boolean(base.boss),
  };
  setEvent(isBoss ? `СТРАЖ · ${theme.name.toUpperCase()}` : "ОБИТАТЕЛЬ ГЛУБИНЫ", `${state.enemy.name} преграждает путь. Здоровье: ${state.enemy.hp}.`, isBoss ? theme.guardianIcon : base.icon);
  addJournal(isBoss ? "Страж пробуждён" : "Встреча в темноте", `${state.enemy.name} вступает в бой.`, isBoss ? "☠" : "⚔");
  setCaption(isBoss ? "Страж колодца" : "Враг приближается");
  playTone(isBoss ? 110 : 165, 0.18);
  render();
}

function attackEnemy(multiplier = 1, focusCost = 0) {
  if (!state.enemy || state.gameOver || state.focus < focusCost) return;
  if (focusCost > 0) state.focus -= focusCost;
  else state.focus = Math.min(MAX_FOCUS, state.focus + 1);
  const damage = Math.max(1, Math.floor((getAttackPower() + randomInt(0, 3)) * multiplier));
  state.enemy.hp = Math.max(0, state.enemy.hp - damage);
  const focusMessage = focusCost > 0
    ? ` Сокрушительный удар расходует ${focusCost} запаса силы.`
    : state.focus > 0
      ? ` Запас силы: ${state.focus} из ${MAX_FOCUS}.`
      : "";
  setEvent(
    focusCost > 0 ? "СОКРУШИТЕЛЬНЫЙ УДАР" : "УДАР НАНЕСЁН",
    `Ты наносишь ${damage} урона.${focusMessage} У ${state.enemy.name} осталось ${state.enemy.hp} здоровья.`,
    "⚔",
  );
  ui.scene.classList.add("hit");
  window.setTimeout(() => ui.scene.classList.remove("hit"), 180);
  playTone(multiplier > 1 ? 300 : 250, 0.07);
  if (state.enemy.hp <= 0) {
    defeatEnemy();
    return;
  }
  enemyTurn(false);
}

function enemyTurn(guarding = false) {
  if (guarding) state.focus = Math.min(MAX_FOCUS, state.focus + 1);
  const rawDamage = randomInt(Math.max(1, state.enemy.damage - 2), state.enemy.damage);
  const armorDefense = getArmorDefense();
  const reducedDamage = Math.max(1, rawDamage - armorDefense);
  const dodgeChance = getDodgeChance();
  const dodged = !guarding && Math.random() < dodgeChance;
  const damage = dodged ? 0 : Math.max(1, guarding || state.guarding ? Math.ceil(reducedDamage * 0.4) : reducedDamage);
  state.guarding = false;
  state.hp = Math.max(0, state.hp - damage);
  if (state.hp === 0) {
    state.gameOver = true;
    state.enemy = null;
    setEvent("ПОСЛЕДНИЙ ВДОХ", `Ты пал на ${state.floor}-м этаже. Лучший спуск: ${bestFloor || state.floor}.`, "☾");
    addJournal("Спуск прерван", "Темнота сомкнулась вокруг. Но легенда колодца останется.", "☾");
    setCaption("Тишина");
  } else {
    const focusMessage = guarding ? ` Запас силы: ${state.focus} из ${MAX_FOCUS}.` : "";
    const armorMessage = armorDefense ? ` Броня поглотила ${Math.min(armorDefense, rawDamage - 1)} урона.` : "";
    setEvent(
      dodged ? "УКЛОНЕНИЕ" : "ВРАГ АТАКУЕТ",
      dodged
        ? `Ты увернулся от атаки ${state.enemy.name}.`
        : `${state.enemy.name} наносит ${damage} урона${guarding ? ", но твоя защита смягчает удар" : ""}.${armorMessage}${focusMessage}`,
      dodged ? "◈" : "⬡",
    );
    setCaption(dodged ? "Удар прошёл мимо" : "Бой продолжается");
  }
  playTone(guarding ? 185 : dodged ? 270 : 125, 0.1);
  render();
}

function defeatEnemy() {
  const enemy = state.enemy;
  state.enemy = null;
  state.gold += enemy.gold;
  gainXp(enemy.xp);
  let gearMessage = "";
  const lootChance = Math.min(0.8, 0.3 + (state.classId === "ranger" ? 0.2 : 0) + getClassStat("loot") * 0.15 + getClassStat("attack-loot") * 0.1);
  if (enemy.boss || Math.random() < lootChance) {
    if (state.inventory.length < MAX_GEAR) {
      const gear = createGear(randomInt(0, 1) === 0 ? "weapon" : "armor");
      state.inventory.push(gear);
      gearMessage = ` Найдено: ${gear.name} (+${gear.bonus} ${gear.type === "weapon" ? "к силе" : "к защите"}), предмет в рюкзаке.`;
      addJournal("Найдена экипировка", `${gear.name}: +${gear.bonus} ${gear.type === "weapon" ? "к урону" : "к защите"}.`, gear.type === "weapon" ? "⚔" : "⬡");
    } else {
      gearMessage = " Рюкзак полон: трофей остался в зале.";
    }
  }
  const victoryHealing = (state.classId === "paladin" ? 3 : 0) +
    getClassStat("heal") * 4;
  const healed = Math.min(victoryHealing, state.maxHp - state.hp);
  state.hp += healed;
  if (enemy.boss) {
    state.waitingToDescend = true;
    const bonus = Math.min(8, state.maxHp - state.hp);
    state.hp += bonus;
    setEvent("СТРАЖ ПОВЕРЖЕН", `Ты получил ${enemy.xp} опыта и ${enemy.gold} монет.${healed ? ` Класс восстановил ${healed} здоровья.` : ""}${bonus ? ` Передышка вернула ${bonus} здоровья.` : ""}${gearMessage} Путь вниз открыт.`, "✧", "ПУТЬ ОТКРЫТ");
    addJournal("Путь открыт", `Страж повержен. Ты готов спуститься на ${state.floor + 1}-й этаж.`, "↓");
    setCaption("Лестница открыта");
    playTone(560, 0.2);
  } else {
    const foundPotion = Math.random() < 0.2 && state.potions < 4;
    if (foundPotion) state.potions += 1;
    setEvent("ПОБЕДА", `Враг повержен: +${enemy.xp} опыта, +${enemy.gold} монет${foundPotion ? ", +1 зелье" : ""}${healed ? `, восстановлено ${healed} здоровья` : ""}.${gearMessage}`, "✧");
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
    if (state.level === SUBCLASS_LEVELS[0]) {
      state.pendingSubclassLevels.push(state.level);
    } else if (SUBCLASS_LEVELS.includes(state.level) && state.subclassId) {
      state.subclassRank += 1;
      const subclass = SUBCLASS_BY_ID.get(state.subclassId);
      addJournal("Подкласс усилен", `${subclass.name} достиг ${state.subclassRank}-го ранга.`, "✦");
    }
  }
}

function getAttackPower() {
  const characterClass = getCharacterClass();
  const lowHealthBonus = state.classId === "berserker" && state.hp <= state.maxHp / 2 ? 2 : 0;
  return state.attack + (state.equipment.weapon?.bonus || 0) +
    getClassStat("attack") * 2 + getClassStat("attack-loot") * 2 + lowHealthBonus;
}

function getArmorDefense() {
  return (state.equipment.armor?.bonus || 0) + getCharacterClass().defense +
    getClassStat("defense") + getClassStat("defense-2") * 2 +
    getClassStat("defense-health");
}

function getDodgeChance() {
  return Math.min(0.8, (state.classId === "rogue" ? 0.15 : 0) + getClassStat("dodge") * 0.1);
}

function getHeavyAttackMultiplier() {
  return getCharacterClass().heavyMultiplier + getClassStat("heavy") * 0.5;
}

function createGear(type) {
  const theme = getFloorTheme();
  const names = {
    well: { weapon: "Клинок каменного эха", armor: "Плащ колодезного стража" },
    drowned: { weapon: "Якорный тесак", armor: "Панцирь глубин" },
    roots: { weapon: "Серп живых корней", armor: "Кора древнего собора" },
    forge: { weapon: "Молот пепельной кузни", armor: "Кованый доспех" },
  };
  const bonus = Math.min(type === "weapon" ? 6 : 4, 1 + Math.floor((state.floor - 1) / 3));
  state.gearSequence += 1;
  return {
    id: `gear-${state.gearSequence}`,
    type,
    name: names[theme.id][type],
    bonus,
  };
}

function equipGear(gearId) {
  if (!state.started || state.gameOver || state.enemy) return;
  const index = state.inventory.findIndex((item) => item.id === gearId);
  if (index < 0) return;
  const gear = state.inventory[index];
  const previous = state.equipment[gear.type];
  state.inventory.splice(index, 1);
  state.equipment[gear.type] = gear;
  if (previous) state.inventory.push(previous);
  setEvent(
    gear.type === "weapon" ? "ОРУЖИЕ СМЕНЕНО" : "БРОНЯ НАДЕТА",
    `${gear.name} экипирован: +${gear.bonus} ${gear.type === "weapon" ? "к силе удара" : "к защите"}.`,
    gear.type === "weapon" ? "⚔" : "⬡",
    "ЭКИПИРОВКА",
  );
  addJournal("Экипировка изменена", `${gear.name} даёт +${gear.bonus} ${gear.type === "weapon" ? "к силе" : "к защите"}.`, gear.type === "weapon" ? "⚔" : "⬡");
  render();
}

function drinkPotion(inCombat = false) {
  if (!state.started || state.potions <= 0 || state.hp >= state.maxHp || state.gameOver) return;
  state.potions -= 1;
  const healing = Math.min(14 + getClassStat("potion") * 6, state.maxHp - state.hp);
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

function merchantPurchase(item) {
  if (!state.merchantAvailable || state.gameOver) return;
  if (item === "potion") {
    if (state.potions >= POTION_LIMIT || state.gold < MERCHANT_PRICES.potion) return;
    state.gold -= MERCHANT_PRICES.potion;
    state.potions += 1;
    setEvent("СДЕЛКА СОСТОЯЛАСЬ", `Одно зелье здоровья — ${MERCHANT_PRICES.potion} монет. Осталось зелий: ${state.potions}.`, "⚗", "КУПЛЕНО");
    addJournal("Покупка в лавке", `Ты приобрёл зелье за ${MERCHANT_PRICES.potion} монет.`, "⚗");
  } else if (item === "weapon") {
    if (state.gold < MERCHANT_PRICES.weapon) return;
    state.gold -= MERCHANT_PRICES.weapon;
    state.attack += 1;
    setEvent("КЛИНОК ЗАТОЧЕН", `Оружие заточено. Твоя сила навсегда увеличена до ${state.attack}.`, "⚔", "КУПЛЕНО");
    addJournal("Заточка оружия", "Торговец наточил оружие: сила выросла на 1.", "⚔");
  } else if (item === "armor") {
    if (state.gold < MERCHANT_PRICES.armor || state.inventory.length >= MAX_GEAR) return;
    state.gold -= MERCHANT_PRICES.armor;
    const armor = createGear("armor");
    state.inventory.push(armor);
    setEvent("ДОСПЕХ НАЙДЕН", `${armor.name}: +${armor.bonus} к защите. Предмет добавлен в рюкзак.`, "⬡", "КУПЛЕНО");
    addJournal("Покупка брони", `${armor.name} добавлен в рюкзак за ${MERCHANT_PRICES.armor} монет.`, "⬡");
  } else if (item === "healing") {
    if (state.gold < MERCHANT_PRICES.healing || state.hp >= state.maxHp) return;
    state.gold -= MERCHANT_PRICES.healing;
    const healing = Math.min(12, state.maxHp - state.hp);
    state.hp += healing;
    setEvent("ПОВЯЗКА НАЛОЖЕНА", `Старая повязка восстановила ${healing} здоровья.`, "✚", "КУПЛЕНО");
    addJournal("Лечение у торговца", `За ${MERCHANT_PRICES.healing} монет ты восстановил ${healing} здоровья.`, "✚");
  }
  playTone(420, 0.12);
  render();
}

function leaveMerchant() {
  if (!state.merchantAvailable) return;
  state.merchantAvailable = false;
  setEvent("В ПУТЬ", "Торговец убрал прилавок и исчез в трещине между камней.", "↓");
  setCaption("Лавка осталась позади");
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

function renderEquipment() {
  const weapon = state.equipment.weapon;
  const armor = state.equipment.armor;
  ui.equippedWeapon.textContent = weapon ? `${weapon.name} · +${weapon.bonus}` : "Нет";
  ui.equippedArmor.textContent = armor ? `${armor.name} · +${armor.bonus}` : "Нет";
  ui.inventoryCount.textContent = `${state.inventory.length} / ${MAX_GEAR}`;
  ui.inventory.replaceChildren();
  if (!state.inventory.length) {
    const empty = document.createElement("p");
    empty.className = "inventory-empty";
    empty.textContent = "Рюкзак пуст. Экипировка иногда выпадает с врагов.";
    ui.inventory.append(empty);
    return;
  }
  for (const gear of state.inventory) {
    const item = document.createElement("div");
    item.className = "inventory-item";
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = gear.name;
    const stat = document.createElement("span");
    stat.textContent = `+${gear.bonus} к ${gear.type === "weapon" ? "урону" : "защите"}`;
    details.append(name, stat);
    const equip = document.createElement("button");
    equip.className = "equip-button";
    equip.type = "button";
    equip.dataset.gearId = gear.id;
    equip.textContent = "Надеть";
    equip.disabled = Boolean(state.enemy) || state.gameOver;
    item.append(details, equip);
    ui.inventory.append(item);
  }
}

function renderClassProgression() {
  if (!state.classId) {
    ui.equippedClass.textContent = "Класс не выбран";
    ui.classPassive.textContent = "Выбери класс перед первым спуском.";
    ui.equippedSubclass.replaceChildren();
    return;
  }
  const characterClass = getCharacterClass();
  ui.equippedClass.textContent = `${characterClass.icon} ${characterClass.name} · ${characterClass.role}`;
  ui.classPassive.textContent = characterClass.passive;
  ui.equippedSubclass.replaceChildren();
  for (let index = 0; index < characterClass.subclasses.length; index += 1) {
    const subclass = characterClass.subclasses[index];
    const row = document.createElement("div");
    row.className = "subclass-progress-row";
    const name = document.createElement("strong");
    name.textContent = subclass.name;
    const status = document.createElement("span");
    if (state.subclassId === subclass.id) {
      row.classList.add("unlocked");
      status.textContent = `РАНГ ${state.subclassRank}`;
    } else if (!state.subclassId && state.pendingSubclassLevels.includes(SUBCLASS_LEVELS[0])) {
      row.classList.add("available");
      status.textContent = "ВЫБЕРИ ПОДКЛАСС";
    } else if (state.subclassId) {
      status.textContent = "ДРУГАЯ СПЕЦИАЛИЗАЦИЯ";
    } else {
      status.textContent = `ВЫБОР · УР. ${SUBCLASS_LEVELS[0]}`;
    }
    row.append(name, status);
    ui.equippedSubclass.append(row);
  }
}

function render() {
  const theme = getFloorTheme();
  const characterClass = state.classId ? getCharacterClass() : null;
  ui.level.textContent = `УР. ${state.level}`;
  $("player-name").textContent = characterClass ? characterClass.name : "Искатель";
  $("player-subtitle").textContent = characterClass ? characterClass.role : "Последний из наземных";
  $("portrait-figure").textContent = characterClass ? characterClass.icon : "♙";
  ui.health.textContent = `${state.hp} / ${state.maxHp}`;
  ui.healthBar.style.width = `${(state.hp / state.maxHp) * 100}%`;
  const xpTarget = XP_PER_LEVEL * state.level;
  ui.xp.textContent = `${state.xp} / ${xpTarget}`;
  ui.xpBar.style.width = `${Math.min(100, (state.xp / xpTarget) * 100)}%`;
  const attackPower = state.classId ? getAttackPower() : state.attack;
  ui.attack.textContent = `${attackPower}–${attackPower + 3}`;
  ui.gold.textContent = String(state.gold);
  ui.potions.textContent = String(state.potions);
  ui.focusValue.textContent = `${state.focus} / ${MAX_FOCUS}`;
  ui.focusBar.style.width = `${(state.focus / MAX_FOCUS) * 100}%`;
  ui.focusBar.setAttribute("aria-valuenow", String(state.focus));
  ui.heavyButton.disabled = state.focus < HEAVY_ATTACK_COST;
  ui.heavyButton.setAttribute("aria-label", state.focus < HEAVY_ATTACK_COST
    ? `Сокрушительный удар: нужно ${HEAVY_ATTACK_COST} запаса силы, сейчас ${state.focus}`
    : `Сокрушительный удар: потратить ${HEAVY_ATTACK_COST} запаса силы`);
  ui.best.textContent = bestFloor ? `ЭТАЖ ${bestFloor}` : "—";
  ui.floor.textContent = state.started ? `ЭТАЖ ${state.floor}` : "—";
  ui.floorTitle.textContent = state.started ? `Зал ${state.room || 1} · ${state.enemy ? state.enemy.name : theme.name}` : "Зов из глубины";
  ui.caption.textContent = state.caption;
  ui.eventKicker.textContent = state.event.kicker;
  ui.eventText.textContent = state.event.text;
  ui.eventIcon.textContent = state.event.icon;
  ui.eventTag.textContent = state.event.tag;
  ui.scene.classList.toggle("in-combat", Boolean(state.enemy));
  ui.scene.classList.toggle("has-merchant", state.merchantAvailable);
  for (const floorTheme of FLOOR_THEMES) {
    ui.scene.classList.toggle(`floor-${floorTheme.id}`, state.started && theme.id === floorTheme.id);
  }
  ui.enemy.className = `scene-enemy${state.enemy ? ` enemy-${state.enemy.skin || "guardian"}` : ""}`;
  ui.enemy.textContent = state.enemy ? state.enemy.icon || "☠" : "";
  ui.merchant.textContent = state.merchantAvailable ? "♟" : "";
  ui.character.textContent = characterClass ? characterClass.icon : "♙";
  ui.explore.disabled = !state.started || Boolean(state.enemy) || state.gameOver || state.merchantAvailable || state.waitingToDescend;
  ui.potion.disabled = !state.started || state.potions === 0 || state.hp >= state.maxHp || state.gameOver;
  $("combat-potion-button").disabled = state.potions === 0 || state.hp >= state.maxHp || state.gameOver;
  ui.combatPotionCount.textContent = String(state.potions);
  ui.explore.textContent = state.room === 0 ? "Войти в первый зал" : "Исследовать зал";
  ui.explore.replaceChildren(Object.assign(document.createElement("span"), { textContent: "⌕" }), document.createTextNode(` ${state.room === 0 ? "Войти в первый зал" : "Исследовать зал"}`));
  ui.explore.hidden = !state.started || Boolean(state.enemy) || state.gameOver || state.merchantAvailable || state.waitingToDescend;
  ui.potion.hidden = !state.started || Boolean(state.enemy) || state.gameOver || state.merchantAvailable || state.waitingToDescend;
  ui.combatActions.hidden = !state.enemy || state.gameOver;
  ui.merchantActions.hidden = !state.merchantAvailable || state.gameOver;
  ui.buyPotion.disabled = state.potions >= POTION_LIMIT || state.gold < MERCHANT_PRICES.potion;
  ui.buyPotion.textContent = `⚗ Зелье · ${MERCHANT_PRICES.potion} ✦`;
  ui.buyWeapon.disabled = state.gold < MERCHANT_PRICES.weapon;
  ui.buyWeapon.textContent = `⚔ Заточка · ${MERCHANT_PRICES.weapon} ✦`;
  ui.buyArmor.disabled = state.inventory.length >= MAX_GEAR || state.gold < MERCHANT_PRICES.armor;
  ui.buyArmor.textContent = `⬡ Броня · ${MERCHANT_PRICES.armor} ✦`;
  ui.buyHealing.disabled = state.hp >= state.maxHp || state.gold < MERCHANT_PRICES.healing;
  ui.buyHealing.textContent = `✚ Лечение · ${MERCHANT_PRICES.healing} ✦`;
  ui.descend.hidden = !state.waitingToDescend || state.gameOver;
  ui.restart.hidden = !state.gameOver;
  ui.startCard.hidden = state.started;
  ui.startCard.classList.toggle("has-save", Boolean(savedRun));
  ui.startKicker.textContent = savedRun ? "ПУТЕШЕСТВИЕ СОХРАНЕНО" : "ЛЕГЕНДА НАЧИНАЕТСЯ";
  ui.resumeButton.hidden = !savedRun;
  ui.startButton.textContent = savedRun ? "Выбрать класс для нового спуска" : "Выбрать класс ↓";
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
  renderEquipment();
  renderClassProgression();
  saveActiveRun();
  if (state.started && state.pendingSubclassLevels.length) renderSubclassChoices();
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

ui.startButton.addEventListener("click", openClassDialog);
ui.resumeButton.addEventListener("click", resumeGame);
ui.classOptions.addEventListener("click", (event) => {
  const option = event.target.closest("button[data-class-id]");
  if (!option || !CLASS_BY_ID.has(option.dataset.classId)) return;
  selectedClassId = option.dataset.classId;
  renderClassSelection();
});
ui.chooseClassButton.addEventListener("click", () => startGameWithClass(selectedClassId));
ui.subclassDialog.addEventListener("cancel", (event) => event.preventDefault());
ui.subclassChoices.addEventListener("click", (event) => {
  const option = event.target.closest("button[data-subclass-id]");
  if (option) chooseSubclass(option.dataset.subclassId);
});
ui.explore.addEventListener("click", explore);
ui.potion.addEventListener("click", () => drinkPotion(false));
$("attack-button").addEventListener("click", () => attackEnemy());
$("heavy-button").addEventListener("click", () => attackEnemy(getHeavyAttackMultiplier(), HEAVY_ATTACK_COST));
$("combat-potion-button").addEventListener("click", () => drinkPotion(true));
$("guard-button").addEventListener("click", () => {
  if (state.enemy && !state.gameOver) enemyTurn(true);
});
ui.descend.addEventListener("click", descend);
ui.restart.addEventListener("click", openClassDialog);
ui.buyPotion.addEventListener("click", () => merchantPurchase("potion"));
ui.buyWeapon.addEventListener("click", () => merchantPurchase("weapon"));
ui.buyArmor.addEventListener("click", () => merchantPurchase("armor"));
ui.buyHealing.addEventListener("click", () => merchantPurchase("healing"));
ui.leaveMerchant.addEventListener("click", leaveMerchant);
ui.inventory.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-gear-id]");
  if (button) equipGear(button.dataset.gearId);
});
$("sound-toggle").addEventListener("click", (event) => {
  soundEnabled = !soundEnabled;
  event.currentTarget.setAttribute("aria-pressed", String(soundEnabled));
  event.currentTarget.setAttribute("aria-label", soundEnabled ? "Звук включён" : "Звук выключен");
  event.currentTarget.title = soundEnabled ? "Звук включён" : "Звук выключен";
  if (soundEnabled) playTone(330, 0.12);
});

render();
