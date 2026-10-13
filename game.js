"use strict";

const MAX_ROOMS = 6;
const XP_PER_LEVEL = 20;
const SAVE_KEY = "well-of-whispers-best-floor";
const RUN_SAVE_KEY = "well-of-whispers-active-run";
const META_SAVE_KEY = "well-of-whispers-camp-progress";
const SAVE_VERSION = 1;
const CLOUD_SNAPSHOT_VERSION = 1;
const POTION_LIMIT = 4;
const MAX_FOCUS = 3;
const HEAVY_ATTACK_COST = 2;
const MAX_GEAR = 6;
const SOUND_PREFERENCE_KEY = "well-of-whispers-sound-enabled";
const META_UPGRADES = {
  vitality: { name: "Крепкое сердце", description: "+3 здоровья в новом забеге", costs: [2, 4, 6] },
  power: { name: "Точная рука", description: "+1 к силе удара в новом забеге", costs: [2, 4, 6] },
  supplies: { name: "Запас зелий", description: "+1 зелье в начале нового забега", costs: [2, 4, 6] },
};
const SECRET_LORE = [
  { id: "well", title: "Голос у колодца", text: "Колодец не зовёт путников. Он повторяет последнее обещание того, кто исчез внизу." },
  { id: "drowned", title: "Затонувший колокол", text: "Город ушёл под воду, когда его жители позвонили в колокол, чтобы разбудить море." },
  { id: "roots", title: "Память корней", text: "Подземное дерево помнит имена тех, кто укрылся под его корнями, и тех, кто их предал." },
  { id: "forge", title: "Последняя ковка", text: "Пепельный король выковал ключ от выхода, но спрятал его в собственном имени." },
];
const CLASS_UNLOCK_LEVELS = { advanced: 3, mastery: 9 };
const LEGACY_SUBCLASS_LEVELS = [3, 6, 9];
const MERCHANT_PRICES = { potion: 12, weapon: 18, armor: 24, healing: 8 };
const BASE_CLASSES = [
  {
    id: "knight", name: "Рыцарь", icon: "⚔", role: "Защитник",
    description: "Крепкий боец в доспехах, который держит передний рубеж.",
    maxHp: 38, attack: 5, defense: 2, potionCapacity: 1, passive: "Начинает с крепкой бронёй и дополнительным местом для зелья.",
    ability: { name: "Железный заслон", icon: "⬡", type: "guard", description: "Смягчает следующий удар врага и даёт запас силы." },
    children: ["paladin", "executioner"],
  },
  {
    id: "mystic", name: "Мистик", icon: "✦", role: "Заклинатель",
    description: "Знаток тайных сил, управляющий энергией и сокрушительными ударами.",
    maxHp: 29, attack: 6, defense: 0, heavyMultiplier: 2.5, potionHealing: 3, passive: "Усиливает особые атаки и восстанавливающие зелья.",
    ability: { name: "Эфирный разряд", icon: "✦", type: "blast", description: "Поражает врага магическим импульсом." },
    children: ["keeper", "warlock"],
  },
  {
    id: "shadow", name: "Тень", icon: "◈", role: "Ловкач",
    description: "Ловкий боец, который бьёт точно и ускользает от ответных атак.",
    maxHp: 30, attack: 7, defense: 0, dodge: 0.15, passive: "Повышенная атака и шанс уклониться от удара.",
    ability: { name: "Шаг сквозь тень", icon: "◈", type: "shadow", description: "Наносит точный удар и гарантирует уклонение от ответа." },
    children: ["assassin", "bloodsucker"],
  },
];
const ADVANCED_CLASSES = [
  {
    id: "paladin", parent: "knight", name: "Паладин", icon: "☼", role: "Хранитель",
    description: "Священный защитник, который восстанавливает силы после побед.",
    effects: { defense: 1, healingOnVictory: 3 }, children: ["crusader", "lightbearer"],
  },
  {
    id: "executioner", parent: "knight", name: "Палач", icon: "⚔", role: "Тяжёлый боец",
    description: "Беспощадный воин, чьи усиленные удары добивают ослабленных врагов.",
    effects: { heavyMultiplier: 0.35, executeChance: 0.12 }, children: ["ravager", "berserker"],
  },
  {
    id: "keeper", parent: "mystic", name: "Хранитель тайн", icon: "✧", role: "Архивариус магии",
    description: "Мистик, который усиливает заклинания и извлекает больше пользы из найденного.",
    effects: { heavyMultiplier: 0.25, lootChance: 0.1 }, children: ["apostle", "archmage"],
  },
  {
    id: "warlock", parent: "mystic", name: "Чернокнижник", icon: "☾", role: "Мастер проклятий",
    description: "Маг, чьи тёмные чары ослабляют противника с каждым ходом.",
    effects: { damageOverTime: 0.03, attack: 1 }, children: ["soulreaper", "darklord"],
  },
  {
    id: "assassin", parent: "shadow", name: "Ассасин", icon: "◈", role: "Теневой клинок",
    description: "Скрытный боец, который уклоняется и выбирает уязвимые места.",
    effects: { dodge: 0.1, attack: 1 }, children: ["royalassassin", "darkblade"],
  },
  {
    id: "bloodsucker", parent: "shadow", name: "Кровопийца", icon: "🩸", role: "Живучий дуэлянт",
    description: "Возвращает часть здоровья, нанося обычные удары.",
    effects: { lifesteal: 0.1 }, children: ["forsaken", "leper"],
  },
];
const MASTERY_CLASSES = [
  { id: "crusader", parent: "paladin", name: "Крестоносец", icon: "✹", description: "Сильнее защищает от опасных противников.", effects: { defense: 2 } },
  { id: "lightbearer", parent: "paladin", name: "Светоносец", icon: "☼", description: "Заметно усиливает лечение после побед.", effects: { healingOnVictory: 4, potionHealing: 3 } },
  { id: "ravager", parent: "executioner", name: "Потрошитель", icon: "⚒", description: "Наносит больше урона здоровым противникам.", effects: { bonusDamage: 0.1 } },
  { id: "berserker", parent: "executioner", name: "Берсеркер", icon: "✹", description: "Наносит всё больше урона по мере потери здоровья.", effects: { missingHealthDamage: 0.2 } },
  { id: "royalassassin", parent: "assassin", name: "Королевский убийца", icon: "♜", description: "Иногда наносит обычной атакой двойной урон.", effects: { criticalChance: 0.2 } },
  { id: "darkblade", parent: "assassin", name: "Клинок сумрака", icon: "◈", description: "Может оставить слабого врага на грани поражения.", effects: { executeChance: 0.1 } },
  { id: "forsaken", parent: "bloodsucker", name: "Отрёкшийся", icon: "☠", description: "Один раз за бой переживает смертельный удар.", effects: { extraLife: 1 } },
  { id: "leper", parent: "bloodsucker", name: "Чумной странник", icon: "☣", description: "Ядовитые удары постепенно ослабляют врагов.", effects: { damageOverTime: 0.05 } },
  { id: "apostle", parent: "keeper", name: "Апостол", icon: "✧", description: "Усиливает восстановление и поиск редкой экипировки.", effects: { healingOnVictory: 3, lootChance: 0.1 } },
  { id: "archmage", parent: "keeper", name: "Верховный маг", icon: "✦", description: "Значительно усиливает сокрушительный удар.", effects: { heavyMultiplier: 0.55 } },
  { id: "soulreaper", parent: "warlock", name: "Жнец душ", icon: "☠", description: "Восстанавливает здоровье после каждого боя.", effects: { healingOnVictory: 5 } },
  { id: "darklord", parent: "warlock", name: "Повелитель мрака", icon: "☾", description: "Его проклятия наносят больше урона со временем.", effects: { damageOverTime: 0.07 } },
];
const CLASS_BY_ID = new Map([
  ...BASE_CLASSES.map((characterClass) => [characterClass.id, { ...characterClass, tier: 1 }]),
  ...ADVANCED_CLASSES.map((characterClass) => [characterClass.id, { ...characterClass, tier: 2 }]),
  ...MASTERY_CLASSES.map((characterClass) => [characterClass.id, { ...characterClass, tier: 3 }]),
]);
const LEGACY_CLASS_MIGRATIONS = new Map([
  ["warrior", { base: "knight", advanced: "paladin", mastery: "crusader" }],
  ["ranger", { base: "shadow", advanced: "assassin", mastery: "royalassassin" }],
  ["rogue", { base: "shadow", advanced: "assassin", mastery: "darkblade" }],
  ["mage", { base: "mystic", advanced: "keeper", mastery: "archmage" }],
  ["paladin", { base: "knight", advanced: "paladin", mastery: "lightbearer" }],
  ["berserker", { base: "knight", advanced: "executioner", mastery: "berserker" }],
]);
const LEGACY_SUBCLASS_IDS = new Set([
  "guardian", "slayer", "champion", "sniper", "tracker", "survivor",
  "evoker", "frostmage", "mender", "assassin", "shadow", "cutpurse",
  "oathkeeper", "inquisitor", "luminary", "reaver", "ironhide", "blooddrinker",
]);
const RUN_QUESTS = [
  { id: "explore", title: "Исследователь", text: "Открой залы подземелья", target: 5, reward: 12, icon: "⌕" },
  { id: "defeat", title: "Охотник за тенями", text: "Победи обитателей глубин", target: 3, reward: 16, icon: "⚔" },
  { id: "gear", title: "Собиратель реликвий", text: "Найди экипировку", target: 2, reward: 20, icon: "✧" },
  { id: "secret", title: "Слушатель шёпота", text: "Открой тайные знаки", target: 1, reward: 18, icon: "ᛟ" },
];
const DUNGEON_EVENT_ACTIONS = new Map([
  ["goblin-chase", "Погнаться за вором"],
  ["goblin-bribe", "Выкупить кошель · 3 монеты"],
  ["find-careful", "Открыть осторожно"],
  ["find-break", "Разбить печать"],
  ["rubble-clear", "Разобрать завал"],
  ["rubble-squeeze", "Протиснуться сбоку"],
  ["dive-deep", "Нырнуть глубже"],
  ["dive-shallow", "Собрать у берега"],
  ["ore-careful", "Добыть жилу"],
  ["ore-force", "Ударить сильнее"],
  ["fish-net", "Закинуть сеть"],
  ["fish-shiny", "Искать блеск на дне"],
  ["door-listen", "Прислушаться к механизму"],
  ["door-force", "Открыть силой"],
  ["hunt-track", "Выслеживать зверя"],
  ["hunt-bait", "Поставить приманку"],
  ["echo-duel", "Вызвать на поединок"],
  ["echo-share", "Обменяться припасами · 5 монет"],
  ["smuggler-buy", "Купить тайник · 10 монет"],
  ["smuggler-catch", "Перехватить контрабанду"],
  ["maze-mark", "Отмечать повороты"],
  ["maze-dash", "Срезать через темноту"],
  ["roaming-buy", "Купить реликвию · 12 монет"],
  ["roaming-pass", "Отказаться от сделки"],
  ["hermit-rest", "Принять угощение"],
  ["hermit-trade", "Выслушать наставление · 5 монет"],
  ["altar-summon", "Принять испытание"],
  ["altar-offer", "Оставить подношение · 6 монет"],
  ["book-study", "Изучить страницы"],
  ["book-seal", "Запечатать книгу"],
  ["ruins-search", "Осмотреть зал"],
  ["ruins-salvage", "Собрать уцелевшее"],
  ["grove-drink", "Испить росу"],
  ["grove-harvest", "Собрать семена"],
  ["rune-strength", "Коснуться руны силы"],
  ["rune-vitality", "Коснуться руны жизни"],
  ["wonder-touch", "Коснуться сияния"],
  ["wonder-gather", "Собрать дары пещеры"],
  ["wreck-dive", "Нырнуть в трюм"],
  ["wreck-scavenge", "Обыскать палубу"],
]);
const DUNGEON_EVENTS = [
  {
    minFloor: 1, weight: 10, title: "ГОБЛИН-ВОР", icon: "♟",
    text: "Мелкий вор юркнул в щель, унося чей-то кошель. Можно настичь его или выкупить добычу.",
    actions: ["goblin-chase", "goblin-bribe"],
  },
  {
    minFloor: 1, weight: 10, title: "ЦЕННАЯ НАХОДКА", icon: "✧",
    text: "Под плитой мерцает запечатанный ларец. Тихое открытие безопаснее, но печать обещает больше добычи.",
    actions: ["find-careful", "find-break"],
  },
  {
    minFloor: 2, weight: 10, title: "РАЗБОР ЗАВАЛОВ", icon: "⚒",
    text: "Камни перекрыли старый проход. Можно расчистить путь или поискать лаз между обломками.",
    actions: ["rubble-clear", "rubble-squeeze"],
  },
  {
    minFloor: 2, weight: 10, title: "ОСКОЛКИ ПОД ВОДОЙ", icon: "♆",
    text: "В затопленной нише видны сияющие осколки. Глубокое погружение опасно, зато у кромки тоже что-то блестит.",
    actions: ["dive-deep", "dive-shallow"],
  },
  {
    minFloor: 3, weight: 10, title: "РУДНАЯ ЖИЛА", icon: "⚒",
    text: "В стене проступила богатая жила. Точный удар даст надёжную заготовку, сильный может расколоть больше руды.",
    actions: ["ore-careful", "ore-force"],
  },
  {
    minFloor: 4, weight: 10, title: "ПОДЗЕМНАЯ РЫБАЛКА", icon: "≋",
    text: "В тёмном ручье мелькнула рыба. Сеть пригодится для еды, а у дна, похоже, лежит что-то блестящее.",
    actions: ["fish-net", "fish-shiny"],
  },
  {
    minFloor: 2, weight: 3, title: "ДВЕРЬ С ИСПЫТАНИЕМ", icon: "⚿",
    text: "На двери проступают два знака: один отвечает на спокойный ритм, другой — на решительный удар.",
    actions: ["door-listen", "door-force"],
  },
  {
    minFloor: 2, weight: 4, title: "СЛЕД ЗВЕРЯ", icon: "♧",
    text: "Свежие следы ведут к логову под корнями. Можно выследить зверя или выманить его добычу приманкой.",
    actions: ["hunt-track", "hunt-bait"],
  },
  {
    minFloor: 3, weight: 2, title: "ОТГОЛОСОК ИСКАТЕЛЯ", icon: "◈",
    text: "Перед тобой возникла тень прежнего путника — лишь безвредное эхо подземелья, не другой игрок. Оно предлагает испытать силу или обменяться припасами.",
    actions: ["echo-duel", "echo-share"],
  },
  {
    minFloor: 4, weight: 3, title: "БЕЗУМНЫЙ КОНТРАБАНДИСТ", icon: "♜",
    text: "Сумасшедший торговец шепчет о тайнике. Можно купить его карту или попытаться задержать беглеца.",
    actions: ["smuggler-buy", "smuggler-catch"],
  },
  {
    minFloor: 3, weight: 3, title: "ЛАБИРИНТ", icon: "⌘",
    text: "Коридоры меняются местами за спиной. Отмечай путь не спеша или рискни срезать через тёмный ход.",
    actions: ["maze-mark", "maze-dash"],
  },
  {
    minFloor: 3, weight: 2, title: "БЛУЖДАЮЩИЙ МАГАЗИН", icon: "♙",
    text: "Крошечная лавка прокатилась по рельсам прямо к тебе. Хозяин предлагает реликвию или честно отпускает без покупки.",
    actions: ["roaming-buy", "roaming-pass"],
  },
  {
    minFloor: 3, weight: 3, title: "СТАРЫЙ ОТШЕЛЬНИК", icon: "☼",
    text: "В корнях устроился отшельник. Он делится тёплым отваром и готов обучить стойкому приёму за несколько монет.",
    actions: ["hermit-rest", "hermit-trade"],
  },
  {
    minFloor: 4, weight: 2, title: "АЛТАРЬ ПРИЗЫВА", icon: "ᛟ",
    text: "Пустой алтарь гудит в такт сердцу. Можно принять вызов его стража или оставить скромное подношение.",
    actions: ["altar-summon", "altar-offer"],
  },
  {
    minFloor: 2, weight: 3, title: "ИСТЛЕВШАЯ КНИГА", icon: "▤",
    text: "На рассыпающихся страницах осталась одна целая глава. Прочти её или закрой книгу, прежде чем чернила проснутся.",
    actions: ["book-study", "book-seal"],
  },
  {
    minFloor: 4, weight: 2, title: "ЗАБРОШЕННЫЕ РУИНЫ", icon: "⌂",
    text: "В зале пустых статуй под пылью видны следы старого снаряжения. Осмотр может стоить сил, но уцелевшее тоже пригодится.",
    actions: ["ruins-search", "ruins-salvage"],
  },
  {
    minFloor: 4, weight: 3, title: "ПОДЗЕМНАЯ РОЩА", icon: "♧",
    text: "Бледные листья собирают чистую росу, а у корней созрели твёрдые семена. Можно восстановиться или унести запас на будущее.",
    actions: ["grove-drink", "grove-harvest"],
  },
  {
    minFloor: 3, weight: 3, title: "РУННЫЙ КАМЕНЬ", icon: "ᛟ",
    text: "На гладком камне проступили две руны: одна укрепляет удар, другая — жизненную стойкость.",
    actions: ["rune-strength", "rune-vitality"],
  },
  {
    minFloor: 5, weight: 2, title: "ПЕЩЕРА ЧУДЕС", icon: "✦",
    text: "Кристаллы здесь тихо поют. Сияние обещает редкую реликвию, а у входа можно собрать безопасные самоцветы.",
    actions: ["wonder-touch", "wonder-gather"],
  },
  {
    minFloor: 5, weight: 1, title: "ЗАТОНУВШИЙ КОРАБЛЬ", icon: "⚓",
    text: "В затопленном трюме зацепилась цепь с грузом. Палуба хранит меньше сокровищ, зато осматривать её безопаснее.",
    actions: ["wreck-dive", "wreck-scavenge"],
  },
];
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
const ELITE_TYPES = [
  { theme: "well", name: "Каменный палач", icon: "♜", skin: "elite-stone", hp: 26, damage: 8, xp: 19, gold: 14 },
  { theme: "drowned", name: "Адмирал бездны", icon: "♆", skin: "elite-tide", hp: 29, damage: 10, xp: 22, gold: 17 },
  { theme: "roots", name: "Старейшина спор", icon: "❋", skin: "elite-root", hp: 32, damage: 10, xp: 25, gold: 19 },
  { theme: "forge", name: "Кузнечный исполин", icon: "♨", skin: "elite-forge", hp: 37, damage: 12, xp: 29, gold: 22 },
];
const ENEMY_SKINS = new Set([
  ...ENEMY_TYPES.map((enemy) => enemy.skin),
  ...ELITE_TYPES.map((enemy) => enemy.skin),
  "guardian",
]);
const ENEMY_ART = {
  moss: "enemy-moss",
  stone: "enemy-stone",
  shade: "enemy-shade",
  drowned: "enemy-drowned",
  eel: "enemy-eel",
  wraith: "enemy-wraith",
  root: "enemy-root",
  spore: "enemy-spore",
  hound: "enemy-hound",
  iron: "enemy-iron",
  ember: "enemy-ember",
  golem: "enemy-golem",
  "elite-stone": "enemy-elite-stone",
  "elite-tide": "enemy-elite-tide",
  "elite-root": "enemy-elite-root",
  "elite-forge": "enemy-elite-forge",
};
const GEAR_ART = {
  "Клинок каменного эха": "weapon-well",
  "Плащ колодезного стража": "armor-well",
  "Якорный тесак": "weapon-drowned",
  "Панцирь глубин": "armor-drowned",
  "Серп живых корней": "weapon-roots",
  "Кора древнего собора": "armor-roots",
  "Молот пепельной кузни": "weapon-forge",
  "Кованый доспех": "armor-forge",
};

const $ = (id) => document.getElementById(id);
const GAME_ART_URL = "game-art.svg";
function createArtIcon(symbol, label, className, decorative = false) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 100 100");
  icon.setAttribute("focusable", "false");
  icon.classList.add("art-icon", className);
  if (decorative) {
    icon.setAttribute("aria-hidden", "true");
  } else {
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", label);
  }
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `${GAME_ART_URL}#${symbol}`);
  icon.append(use);
  return icon;
}

function getBaseClassId(classId) {
  let characterClass = CLASS_BY_ID.get(classId);
  while (characterClass?.tier > 1) characterClass = CLASS_BY_ID.get(characterClass.parent);
  return characterClass?.id || "knight";
}

function getGearArtId(gear) {
  return GEAR_ART[gear.name] || (gear.type === "weapon" ? "weapon-stats" : "armor-well");
}

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
  subclassDialogTitle: $("subclass-dialog-title"),
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
  eventActions: $("event-actions"),
  explore: $("explore-button"),
  potion: $("potion-button"),
  combatActions: $("combat-actions"),
  combatPotionCount: $("combat-potion-count"),
  focusValue: $("focus-value"),
  focusBar: $("focus-bar"),
  heavyButton: $("heavy-button"),
  abilityButton: $("class-ability-button"),
  abilityIcon: $("class-ability-icon"),
  abilityLabel: $("class-ability-label"),
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
  quests: $("quest-list"),
  journalStatus: $("journal-status"),
  metaEssence: $("meta-essence"),
  metaUpgrades: $("meta-upgrades"),
  metaSecrets: $("meta-secrets"),
};

let state = createState();
let bestFloor = readBestFloor();
let savedRun = readSavedRun();
let metaProgress = readMetaProgress();
let selectedClassId = "knight";
let audioContext = null;
let soundEnabled = readSoundPreference();

function readSoundPreference() {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) === "true";
  } catch (error) {
    console.warn("Не удалось прочитать настройку звука.", error);
    return false;
  }
}

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
    advancedClassId: null,
    masteryClassId: null,
    pendingClassLevels: [],
    quests: [],
    runBossesDefeated: 0,
    runRewardClaimed: false,
    secretFragments: [],
    extraLifeUsed: false,
    enemy: null,
    guarding: false,
    abilityCooldown: 0,
    abilityGuarding: false,
    abilityDodge: false,
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
      actions: [],
    },
    journal: [],
  };
}

function isIntegerBetween(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function createMetaProgress() {
  return {
    essence: 0,
    upgrades: { vitality: 0, power: 0, supplies: 0 },
    bossesDefeated: 0,
    secretsFound: [],
  };
}

function isValidMetaProgress(progress) {
  return Boolean(
    progress && typeof progress === "object" &&
    isIntegerBetween(progress.essence, 0, 1000000000) &&
    progress.upgrades && typeof progress.upgrades === "object" &&
    Object.keys(META_UPGRADES).every((id) => isIntegerBetween(progress.upgrades[id], 0, META_UPGRADES[id].costs.length)) &&
    Object.keys(progress.upgrades).every((id) => Object.prototype.hasOwnProperty.call(META_UPGRADES, id)) &&
    isIntegerBetween(progress.bossesDefeated, 0, 1000000000) &&
    Array.isArray(progress.secretsFound) &&
    progress.secretsFound.length <= SECRET_LORE.length &&
    progress.secretsFound.every((id) => SECRET_LORE.some((secret) => secret.id === id)) &&
    new Set(progress.secretsFound).size === progress.secretsFound.length
  );
}

function readMetaProgress() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(META_SAVE_KEY) || "null");
    if (stored === null) return createMetaProgress();
    if (isValidMetaProgress(stored)) return stored;
    console.warn("Сохранение лагеря несовместимо; использованы безопасные значения по умолчанию.");
  } catch (error) {
    console.warn("Не удалось прочитать развитие лагеря.", error);
  }
  return createMetaProgress();
}

function mergeMetaProgress(left, right) {
  const first = isValidMetaProgress(left) ? left : createMetaProgress();
  const second = isValidMetaProgress(right) ? right : createMetaProgress();
  return {
    essence: Math.max(first.essence, second.essence),
    upgrades: Object.fromEntries(Object.keys(META_UPGRADES).map((id) => [
      id,
      Math.max(first.upgrades[id], second.upgrades[id]),
    ])),
    bossesDefeated: Math.max(first.bossesDefeated, second.bossesDefeated),
    secretsFound: [...new Set([...first.secretsFound, ...second.secretsFound])],
  };
}

function persistMetaProgress() {
  try {
    window.localStorage.setItem(META_SAVE_KEY, JSON.stringify(metaProgress));
  } catch (error) {
    console.warn("Не удалось сохранить развитие лагеря.", error);
  }
  if (window.WellCloudSave) window.WellCloudSave.scheduleSave(getCloudSaveSnapshot());
}

function isValidRun(run) {
  if (!run || run.version !== SAVE_VERSION || !run.state || typeof run.state !== "object") return false;
  const saved = run.state;
  const legacyClass = LEGACY_CLASS_MIGRATIONS.has(saved.classId) && saved.advancedClassId === undefined;
  if (
    saved.started !== true || saved.gameOver !== false ||
    !isIntegerBetween(saved.floor, 1, 1000000) ||
    !isIntegerBetween(saved.room, 0, MAX_ROOMS) ||
    !isIntegerBetween(saved.maxHp, 1, 1000000) ||
    !isIntegerBetween(saved.hp, 1, saved.maxHp) ||
    !isIntegerBetween(saved.attack, 1, 1000000) ||
    !isIntegerBetween(saved.potions, 0, 5) ||
    !isIntegerBetween(saved.gold, 0, 1000000000) ||
    !isIntegerBetween(saved.level, 1, 10000) ||
    !isIntegerBetween(saved.xp, 0, XP_PER_LEVEL * saved.level - 1) ||
    (saved.classId !== undefined && saved.classId !== null &&
      !(BASE_CLASSES.some((item) => item.id === saved.classId) || legacyClass)) ||
    (!legacyClass && saved.advancedClassId !== undefined && saved.advancedClassId !== null &&
      (!CLASS_BY_ID.has(saved.advancedClassId) || CLASS_BY_ID.get(saved.advancedClassId).tier !== 2 ||
        CLASS_BY_ID.get(saved.advancedClassId).parent !== saved.classId || saved.level < CLASS_UNLOCK_LEVELS.advanced)) ||
    (!legacyClass && saved.masteryClassId !== undefined && saved.masteryClassId !== null &&
      (!CLASS_BY_ID.has(saved.masteryClassId) || CLASS_BY_ID.get(saved.masteryClassId).tier !== 3 ||
        CLASS_BY_ID.get(saved.masteryClassId).parent !== saved.advancedClassId || saved.level < CLASS_UNLOCK_LEVELS.mastery)) ||
    (legacyClass && saved.subclassId !== undefined && saved.subclassId !== null &&
      !LEGACY_SUBCLASS_IDS.has(saved.subclassId)) ||
    (legacyClass && saved.subclassRank !== undefined && (
      !isIntegerBetween(saved.subclassRank, 0, 3) || (saved.subclassRank > 0 && !saved.subclassId)
    )) ||
    (!legacyClass && saved.pendingClassLevels !== undefined && (
      !Array.isArray(saved.pendingClassLevels) || saved.pendingClassLevels.length > 2 ||
      !saved.pendingClassLevels.every((level) =>
        [CLASS_UNLOCK_LEVELS.advanced, CLASS_UNLOCK_LEVELS.mastery].includes(level) && level <= saved.level
      ) || new Set(saved.pendingClassLevels).size !== saved.pendingClassLevels.length ||
      (saved.pendingClassLevels.length === 2 &&
        (saved.pendingClassLevels[0] !== CLASS_UNLOCK_LEVELS.advanced ||
          saved.pendingClassLevels[1] !== CLASS_UNLOCK_LEVELS.mastery)) ||
      (saved.pendingClassLevels.length > 0 && !saved.classId) ||
      (saved.pendingClassLevels.includes(CLASS_UNLOCK_LEVELS.advanced) && saved.advancedClassId) ||
      (saved.pendingClassLevels.includes(CLASS_UNLOCK_LEVELS.mastery) &&
        ((!saved.advancedClassId && !saved.pendingClassLevels.includes(CLASS_UNLOCK_LEVELS.advanced)) || saved.masteryClassId))
    )) ||
    (legacyClass && saved.pendingSubclassLevels !== undefined && (
      !Array.isArray(saved.pendingSubclassLevels) || saved.pendingSubclassLevels.length > 1 ||
      !saved.pendingSubclassLevels.every((level) => level === 3 && level <= saved.level) ||
      new Set(saved.pendingSubclassLevels).size !== saved.pendingSubclassLevels.length
    )) ||
    (saved.extraLifeUsed !== undefined && typeof saved.extraLifeUsed !== "boolean") ||
    (saved.abilityCooldown !== undefined && !isIntegerBetween(saved.abilityCooldown, 0, 3)) ||
    (saved.abilityGuarding !== undefined && typeof saved.abilityGuarding !== "boolean") ||
    (saved.abilityDodge !== undefined && typeof saved.abilityDodge !== "boolean") ||
    (saved.quests !== undefined && (
      !Array.isArray(saved.quests) || saved.quests.length > RUN_QUESTS.length ||
      new Set(saved.quests.map((quest) => quest?.id)).size !== saved.quests.length ||
      !saved.quests.every((progress) => {
        const quest = RUN_QUESTS.find((item) => item.id === progress?.id);
        return quest &&
          isIntegerBetween(progress.progress, 0, quest.target) &&
          typeof progress.completed === "boolean" &&
          progress.completed === (progress.progress >= quest.target);
      })
    )) ||
    (saved.runBossesDefeated !== undefined && !isIntegerBetween(saved.runBossesDefeated, 0, saved.floor)) ||
    (saved.runRewardClaimed !== undefined && typeof saved.runRewardClaimed !== "boolean") ||
    (saved.secretFragments !== undefined && (
      !Array.isArray(saved.secretFragments) || saved.secretFragments.length > SECRET_LORE.length ||
      !saved.secretFragments.every((id) => SECRET_LORE.some((secret) => secret.id === id)) ||
      new Set(saved.secretFragments).size !== saved.secretFragments.length
    )) ||
    typeof saved.guarding !== "boolean" ||
    (saved.focus !== undefined && !isIntegerBetween(saved.focus, 0, MAX_FOCUS)) ||
    (saved.inventory !== undefined && (
      !Array.isArray(saved.inventory) || saved.inventory.length > MAX_GEAR ||
      !saved.inventory.every((item) => isValidGear(item))
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

  if (legacyClass && saved.classId) {
    if (
      (saved.pendingSubclassLevels?.length && saved.subclassId) ||
      (saved.subclassRank && !saved.subclassId) ||
      (saved.subclassId && saved.subclassRank !== LEGACY_SUBCLASS_LEVELS.filter((level) => saved.level >= level).length)
    ) return false;
  }
  if (!legacyClass && saved.classId) {
    if (
      (saved.level >= CLASS_UNLOCK_LEVELS.advanced && !saved.advancedClassId &&
        !saved.pendingClassLevels?.includes(CLASS_UNLOCK_LEVELS.advanced)) ||
      (saved.level >= CLASS_UNLOCK_LEVELS.mastery && saved.advancedClassId && !saved.masteryClassId &&
        !saved.pendingClassLevels?.includes(CLASS_UNLOCK_LEVELS.mastery))
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
      (saved.enemy.elite !== undefined && typeof saved.enemy.elite !== "boolean") ||
      (saved.enemy.elite === true && (saved.enemy.boss || saved.room !== 3)) ||
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
    typeof saved.event.tag === "string" && saved.event.tag.length <= 100 &&
    (saved.event.actions === undefined || (
      Array.isArray(saved.event.actions) && saved.event.actions.length <= 2 &&
      saved.event.actions.every((action) => DUNGEON_EVENT_ACTIONS.has(action)) &&
      new Set(saved.event.actions).size === saved.event.actions.length
    ));
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
  if (state.started) {
    try {
      if (state.gameOver) {
        window.localStorage.removeItem(RUN_SAVE_KEY);
      } else {
        window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
      }
    } catch (error) {
      console.warn("Не удалось автоматически сохранить спуск.", error);
    }
  }
  if (window.WellCloudSave) window.WellCloudSave.scheduleSave(getCloudSaveSnapshot());
}

function getCloudSaveSnapshot() {
  let run = null;
  if (state.started && !state.gameOver) {
    run = { version: SAVE_VERSION, state: JSON.parse(JSON.stringify(state)) };
  } else if (!state.started) {
    try {
      const localRun = JSON.parse(window.localStorage.getItem(RUN_SAVE_KEY) || "null");
      if (isValidRun(localRun)) run = localRun;
    } catch (error) {
      console.warn("Не удалось подготовить локальное сохранение для облака.", error);
    }
  }
  return { version: CLOUD_SNAPSHOT_VERSION, bestFloor, run, meta: JSON.parse(JSON.stringify(metaProgress)) };
}

function restoreCloudSave(snapshot) {
  bestFloor = Math.max(bestFloor, snapshot.bestFloor);
  metaProgress = mergeMetaProgress(metaProgress, snapshot.meta);
  try {
    window.localStorage.setItem(SAVE_KEY, String(bestFloor));
    window.localStorage.setItem(META_SAVE_KEY, JSON.stringify(metaProgress));
    if (snapshot.run) {
      window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(snapshot.run));
      savedRun = snapshot.run.state;
    } else {
      window.localStorage.removeItem(RUN_SAVE_KEY);
      savedRun = null;
    }
  } catch (error) {
    console.warn("Не удалось записать восстановленное облачное сохранение на устройство.", error);
  }
  state = createState();
  render();
}

function readLocalCloudSave() {
  let run = null;
  const raw = window.localStorage.getItem(RUN_SAVE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (!isValidRun(parsed)) throw new Error("Локальное сохранение не прошло проверку и оставлено без изменений.");
    run = parsed;
  }
  return { bestFloor, run, meta: JSON.parse(JSON.stringify(metaProgress)) };
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

function createRunQuests() {
  return RUN_QUESTS.map((quest) => ({ id: quest.id, progress: 0, completed: false }));
}

function getUpgradeLevel(id) {
  return metaProgress.upgrades[id] || 0;
}

function getUpgradeCost(id) {
  return META_UPGRADES[id].costs[getUpgradeLevel(id)];
}

function buyMetaUpgrade(id) {
  const upgrade = META_UPGRADES[id];
  if (!upgrade || (state.started && !state.gameOver)) return;
  const level = getUpgradeLevel(id);
  const cost = upgrade.costs[level];
  if (cost === undefined || metaProgress.essence < cost) return;
  metaProgress.essence -= cost;
  metaProgress.upgrades[id] = level + 1;
  persistMetaProgress();
  setEvent("ЛАГЕРЬ ИСКАТЕЛЕЙ", `${upgrade.name} улучшено: ${upgrade.description}. Эффект начнёт действовать в следующем забеге.`, "✦", "ПОДГОТОВКА");
  playSound("purchase");
  render();
}

function renderMetaProgress() {
  ui.metaEssence.textContent = `${metaProgress.essence} ✦`;
  ui.metaUpgrades.replaceChildren();
  const campAvailable = !state.started || state.gameOver;
  for (const [id, upgrade] of Object.entries(META_UPGRADES)) {
    const level = getUpgradeLevel(id);
    const row = document.createElement("div");
    row.className = "meta-upgrade";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${upgrade.name} · ${level}/${upgrade.costs.length}`;
    const description = document.createElement("span");
    description.textContent = upgrade.description;
    details.append(title, description);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "meta-buy-button";
    button.dataset.upgrade = id;
    button.textContent = level >= upgrade.costs.length ? "МАКС." : `Улучшить · ${getUpgradeCost(id)} ✦`;
    button.disabled = !campAvailable || level >= upgrade.costs.length || metaProgress.essence < getUpgradeCost(id);
    button.title = campAvailable ? upgrade.description : "Улучшения доступны только между забегами.";
    row.append(details, button);
    ui.metaUpgrades.append(row);
  }
  const found = SECRET_LORE.filter((secret) => metaProgress.secretsFound.includes(secret.id));
  ui.metaSecrets.textContent = found.length
    ? `${found.length}/${SECRET_LORE.length} записей · ${found.map((secret) => secret.title).join(" · ")} · Стражей побеждено: ${metaProgress.bossesDefeated}`
    : `0/${SECRET_LORE.length} записей · исследуй тайные залы · Стражей побеждено: ${metaProgress.bossesDefeated}`;
}

function advanceQuest(questId) {
  const definition = RUN_QUESTS.find((quest) => quest.id === questId);
  const progress = state.quests.find((quest) => quest.id === questId);
  if (!definition || !progress || progress.completed) return;
  progress.progress = Math.min(definition.target, progress.progress + 1);
  if (progress.progress < definition.target) return;
  progress.completed = true;
  state.gold += definition.reward;
  const rewardMessage = `Задание «${definition.title}» выполнено. Награда: ${definition.reward} монет.`;
  setEvent("ЗАДАНИЕ ВЫПОЛНЕНО", rewardMessage, definition.icon, `+${definition.reward} МОНЕТ`);
  addJournal("Награда за задание", rewardMessage, definition.icon);
}

function setEvent(kicker, text, icon, tag, actions = []) {
  state.event = { kicker, text, icon, tag: tag || `ЭТАЖ ${state.floor}`, actions };
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
  if (!characterClass || characterClass.tier !== 1) return;
  selectedClassId = classId;
  if (ui.classDialog.open) ui.classDialog.close();
  state = createState();
  savedRun = null;
  state.started = true;
  state.classId = characterClass.id;
  state.quests = createRunQuests();
  state.runBossesDefeated = 0;
  state.runRewardClaimed = false;
  state.secretFragments = [];
  state.maxHp = characterClass.maxHp + getUpgradeLevel("vitality") * 3;
  state.hp = state.maxHp;
  state.attack = randomInt(5, 8) + characterClass.attack - 5 + getUpgradeLevel("power");
  $("player-name").textContent = characterClass.name;
  $("player-subtitle").textContent = characterClass.role;
  $("portrait-figure").replaceChildren(createArtIcon(`hero-${characterClass.id}`, characterClass.name, "portrait-art"));
  state.potions = Math.min(getPotionLimit(), 2 + getUpgradeLevel("supplies"));
  addJournal("Спуск начался", "Ты переступил порог колодца. Обратного пути пока нет.", "↓");
  addJournal(`Класс: ${characterClass.name}`, characterClass.passive, characterClass.icon);
  setEvent("ПЕРВЫЙ ЗАЛ", getFloorTheme().entrance, "↓", `ЭТАЖ ${state.floor}`);
  setCaption("Путь начинается");
  ui.startCard.hidden = true;
  ui.journalStatus.textContent = "Ты внутри колодца";
  playSound("start");
  render();
}

function getCharacterClass() {
  return CLASS_BY_ID.get(state.classId) || BASE_CLASSES[0];
}

function getSelectedClassNodes() {
  return [state.classId, state.advancedClassId, state.masteryClassId]
    .map((id) => id ? CLASS_BY_ID.get(id) : null)
    .filter(Boolean);
}

function getClassStat(effect) {
  return getSelectedClassNodes().reduce((total, characterClass) => {
    const baseEffect = characterClass.tier === 1 &&
      ["dodge", "potionHealing", "potionCapacity"].includes(effect)
      ? characterClass[effect] || 0
      : 0;
    return total + (characterClass.effects?.[effect] || 0) + baseEffect;
  }, 0);
}

function getPotionLimit() {
  return Math.max(POTION_LIMIT + getClassStat("potionCapacity"), 2 + getUpgradeLevel("supplies"));
}

function renderClassSelection() {
  ui.classOptions.replaceChildren();
  for (const characterClass of BASE_CLASSES) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "class-option";
    option.dataset.classId = characterClass.id;
    option.setAttribute("aria-pressed", String(characterClass.id === selectedClassId));
    const icon = createArtIcon(`hero-${characterClass.id}`, characterClass.name, "class-option-icon", true);
    const name = document.createElement("strong");
    name.textContent = characterClass.name;
    const role = document.createElement("small");
    role.textContent = characterClass.role;
    option.append(icon, name, role);
    ui.classOptions.append(option);
  }
  const characterClass = CLASS_BY_ID.get(selectedClassId) || BASE_CLASSES[0];
  ui.classDetails.replaceChildren();
  const details = document.createElement("p");
  details.textContent = characterClass.description;
  const stats = document.createElement("p");
  stats.textContent = `Здоровье: ${characterClass.maxHp} · Урон: ${characterClass.attack}–${characterClass.attack + 3} · Защита: ${characterClass.defense}`;
  const passive = document.createElement("p");
  passive.textContent = `Особенность: ${characterClass.passive}`;
  ui.classDetails.append(details, stats, passive);
}

function openClassDialog() {
  renderClassSelection();
  ui.classDialog.showModal();
}

function renderSubclassChoices() {
  const level = state.pendingClassLevels[0];
  if (!level) return;
  const parentId = level === CLASS_UNLOCK_LEVELS.advanced ? state.classId : state.advancedClassId;
  const parent = CLASS_BY_ID.get(parentId);
  if (!parent) return;
  const options = (parent.children || []).map((id) => CLASS_BY_ID.get(id));
  ui.subclassLevel.textContent = `Уровень ${level} · ${level === CLASS_UNLOCK_LEVELS.advanced ? "новый класс" : "мастерство"}`;
  ui.subclassDialogTitle.textContent = level === CLASS_UNLOCK_LEVELS.advanced ? "Новый класс" : "Выбор мастерства";
  ui.subclassChoices.replaceChildren();
  for (const subclass of options) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "subclass-option";
    option.dataset.classNodeId = subclass.id;
    const name = document.createElement("strong");
    name.textContent = subclass.name;
    const description = document.createElement("span");
    description.textContent = subclass.description;
    option.append(name, description);
    ui.subclassChoices.append(option);
  }
  ui.subclassLevel.setAttribute("aria-label", `Выбери класс на ${level}-м уровне`);
  if (!ui.subclassDialog.open) ui.subclassDialog.showModal();
}

function chooseSubclass(classId) {
  const subclass = CLASS_BY_ID.get(classId);
  const level = state.pendingClassLevels[0];
  const parentId = level === CLASS_UNLOCK_LEVELS.advanced ? state.classId : state.advancedClassId;
  if (
    !subclass || !level || subclass.parent !== parentId ||
    subclass.tier !== (level === CLASS_UNLOCK_LEVELS.advanced ? 2 : 3)
  ) return;
  state.pendingClassLevels.shift();
  if (subclass.tier === 2) state.advancedClassId = classId;
  else state.masteryClassId = classId;
  if (
    subclass.tier === 2 && state.level >= CLASS_UNLOCK_LEVELS.mastery &&
    !state.masteryClassId && !state.pendingClassLevels.includes(CLASS_UNLOCK_LEVELS.mastery)
  ) state.pendingClassLevels.push(CLASS_UNLOCK_LEVELS.mastery);
  if (subclass.tier === 3 && getClassStat("extraLife")) state.extraLifeUsed = false;
  setEvent("НОВЫЙ КЛАСС", `Открыт класс «${subclass.name}»: ${subclass.description}`, "✦", `УРОВЕНЬ ${level}`);
  addJournal("Новый класс", `${subclass.name}: ${subclass.description}`, "✦");
  if (!state.pendingClassLevels.length) ui.subclassDialog.close();
  render();
}

function resumeGame() {
  if (!savedRun) return;
  state = savedRun;
  const legacyClass = LEGACY_CLASS_MIGRATIONS.get(state.classId);
  const migratedClass = !state.classId;
  if (state.focus === undefined) state.focus = 0;
  if (state.abilityCooldown === undefined) state.abilityCooldown = 0;
  if (state.abilityGuarding === undefined) state.abilityGuarding = false;
  if (state.abilityDodge === undefined) state.abilityDodge = false;
  if (state.equipment === undefined) state.equipment = { weapon: null, armor: null };
  if (state.inventory === undefined) state.inventory = [];
  if (state.gearSequence === undefined) state.gearSequence = 0;
  if (state.runBossesDefeated === undefined) state.runBossesDefeated = 0;
  if (state.runRewardClaimed === undefined) state.runRewardClaimed = false;
  if (state.secretFragments === undefined) state.secretFragments = [];
  if (migratedClass) state.classId = "knight";
  if (legacyClass) {
    const hadLegacySubclass = Boolean(state.subclassId);
    state.classId = legacyClass.base;
    state.advancedClassId = state.level >= CLASS_UNLOCK_LEVELS.advanced && hadLegacySubclass ? legacyClass.advanced : null;
    state.masteryClassId = state.level >= CLASS_UNLOCK_LEVELS.mastery && hadLegacySubclass ? legacyClass.mastery : null;
    state.pendingClassLevels = [];
    if (state.level >= CLASS_UNLOCK_LEVELS.advanced && !state.advancedClassId) state.pendingClassLevels.push(CLASS_UNLOCK_LEVELS.advanced);
    if (state.level >= CLASS_UNLOCK_LEVELS.mastery && !state.masteryClassId && state.advancedClassId) {
      state.pendingClassLevels.push(CLASS_UNLOCK_LEVELS.mastery);
    }
    delete state.subclassId;
    delete state.subclassRank;
    delete state.pendingSubclassLevels;
  }
  if (state.advancedClassId === undefined) state.advancedClassId = null;
  if (state.masteryClassId === undefined) state.masteryClassId = null;
  if (state.pendingClassLevels === undefined) state.pendingClassLevels = [];
  const savedQuests = new Map((state.quests || []).map((quest) => [quest.id, quest]));
  state.quests = RUN_QUESTS.map((quest) =>
    savedQuests.get(quest.id) || { id: quest.id, progress: 0, completed: false }
  );
  if (state.extraLifeUsed === undefined) state.extraLifeUsed = false;
  if (migratedClass && state.level >= CLASS_UNLOCK_LEVELS.advanced) state.pendingClassLevels = [CLASS_UNLOCK_LEVELS.advanced];
  selectedClassId = state.classId;
  savedRun = null;
  render();
  playSound("start");
}

function explore() {
  if (!state.started || state.enemy || state.gameOver || state.merchantAvailable || state.waitingToDescend) return;
  state.room += 1;
  state.guarding = false;
  updateBestFloor();
  if (state.room < MAX_ROOMS) advanceQuest("explore");
  if (state.room === MAX_ROOMS) {
    spawnEnemy(true);
    return;
  }
  if (state.room === 3 && Math.random() < 0.25) {
    spawnEnemy(false, true);
    return;
  }

  const eventChance = Math.min(0.28, 0.1 + (state.floor - 1) * 0.04);
  if (Math.random() < eventChance) {
    const availableEvents = DUNGEON_EVENTS.filter((event) => event.minFloor <= state.floor);
    const totalWeight = availableEvents.reduce((total, event) => total + event.weight, 0);
    let eventRoll = Math.random() * totalWeight;
    let dungeonEvent = availableEvents[availableEvents.length - 1];
    for (const event of availableEvents) {
      eventRoll -= event.weight;
      if (eventRoll < 0) {
        dungeonEvent = event;
        break;
      }
    }
    setEvent(dungeonEvent.title, dungeonEvent.text, dungeonEvent.icon, "ВЫБЕРИ ДЕЙСТВИЕ", dungeonEvent.actions);
    setCaption("Решение за тобой");
    addJournal(dungeonEvent.title, dungeonEvent.text, dungeonEvent.icon);
    render();
    return;
  }

  const roll = Math.random();
  if (roll < 0.37) {
    spawnEnemy(false);
  } else if (roll < 0.55) {
    const reward = randomInt(5, 12) + state.floor;
    state.gold += reward;
    const foundPotion = Math.random() < 0.28 && state.potions < getPotionLimit();
    if (foundPotion) state.potions += 1;
    const loot = `Под осыпавшимися камнями нашлось ${reward} монет${foundPotion ? " и зелье" : ""}.`;
    setEvent("ТАЙНИК НАЙДЕН", loot, "✦");
    addJournal("Спрятанная добыча", loot, "✦");
    setCaption("Здесь кто-то был");
    playSound("loot");
  } else if (roll < 0.67) {
    const healing = Math.min(randomInt(6, 11), state.maxHp - state.hp);
    state.hp += healing;
    setEvent("ПЕРЕДЫШКА", healing > 0 ? `${getFloorTheme().spring} Ты восстановил ${healing} здоровья.` : `${getFloorTheme().spring} Ты уже полон сил.`, "◌");
    addJournal("Глоток передышки", healing > 0 ? `Источник восстановил ${healing} здоровья.` : "Ты нашёл источник, но не нуждался в лечении.", "◌");
    setCaption("Тихая передышка");
    playSound("heal");
  } else if (roll < 0.78) {
    const damage = Math.min(randomInt(3, 6), state.hp - 1);
    state.hp -= damage;
    const escape = damage ? `${getFloorTheme().trap} Потеряно ${damage} здоровья.` : `Ты чудом увернулся. ${getFloorTheme().trap}`;
    setEvent("ЛОВУШКА", escape, "⌁");
    addJournal("Опасный проход", escape, "⌁");
    setCaption(damage ? "Пыль оседает" : "Ты увернулся от ловушки");
    playSound("trap");
  } else if (roll < 0.86) {
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
    playSound("rune");
  } else if (roll < 0.94) {
    revealSecret();
  } else {
    state.merchantAvailable = true;
    setEvent("СКЕЛЕТ ТОРГОВЦА", "Немного монет за припасы или оружие? Выбирай товар или спокойно иди дальше.", "♙", "ТРАНСАКЦИЯ");
    addJournal("Странная лавка", "У костяного торговца есть зелья, лечение и оружие. Поторопиться можно, но торговаться не обязательно.", "♙");
    setCaption("Кто-то ждёт за прилавком");
    playSound("merchant");
  }
  render();
}

function addEventEssence(amount) {
  metaProgress.essence = Math.min(1000000000, metaProgress.essence + amount);
  persistMetaProgress();
}

function damageFromEvent(minimum, maximum) {
  const damage = Math.min(randomInt(minimum, maximum), state.hp - 1);
  state.hp -= damage;
  return damage;
}

function claimEventGear(type) {
  if (state.inventory.length >= MAX_GEAR) {
    const fallbackGold = 8 + state.floor;
    state.gold += fallbackGold;
    return ` Рюкзак полон — заготовку обменяли на ${fallbackGold} монет.`;
  }
  const gear = createGear(type);
  state.inventory.push(gear);
  advanceQuest("gear");
  addJournal("Найдена экипировка", `${gear.name}: +${gear.bonus} ${type === "weapon" ? "к силе" : "к защите"}.`, type === "weapon" ? "⚔" : "⬡");
  return ` Найдено: ${gear.name} (+${gear.bonus} ${type === "weapon" ? "к силе" : "к защите"}), предмет в рюкзаке.`;
}

function finishDungeonEvent(kicker, text, icon, journalTitle, sound = "loot") {
  setEvent(kicker, text, icon);
  addJournal(journalTitle, text, icon);
  setCaption("Зал снова затих");
  playSound(sound);
  render();
}

function getDungeonEventActionCost(action) {
  return {
    "goblin-bribe": 3,
    "echo-share": 5,
    "smuggler-buy": 10,
    "roaming-buy": 12,
    "hermit-trade": 5,
    "altar-offer": 6,
  }[action] || 0;
}

function resolveDungeonEvent(action) {
  if (
    !state.started || state.gameOver || state.enemy || state.merchantAvailable ||
    !state.event.actions?.includes(action) ||
    state.gold < getDungeonEventActionCost(action)
  ) return;
  state.event.actions = [];

  if (action === "goblin-chase") {
    const scale = 1 + (state.floor - 1) * 0.12;
    spawnEnemy(false, false, {
      name: "Гоблин-вор", icon: "♟", skin: "stone",
      hp: Math.round((13 + state.floor) * scale),
      damage: Math.ceil((4 + Math.floor(state.floor / 3)) * scale),
      xp: 10 + state.floor, gold: 9 + state.floor,
    });
    return;
  }
  if (action === "goblin-bribe") {
    state.gold -= 3;
    state.gold += 8 + state.floor;
    finishDungeonEvent("ВОЗВРАЩЁННЫЙ КОШЕЛЬ", `Ты отдал 3 монеты и забрал кошель с ${8 + state.floor} монетами.`, "♟", "Сделка с гоблином");
  } else if (action === "find-careful") {
    const gold = 5 + state.floor;
    state.gold += gold;
    const potion = state.potions < getPotionLimit() && Math.random() < 0.35;
    if (potion) state.potions += 1;
    finishDungeonEvent("ЛАРЕЦ ОТКРЫТ", `Внутри ${gold} монет${potion ? " и зелье" : ""}; печать удалось не повредить.`, "✧", "Ценная находка");
  } else if (action === "find-break") {
    const damage = damageFromEvent(4, 7);
    const gold = 12 + state.floor;
    state.gold += gold;
    const gear = claimEventGear(randomInt(0, 1) ? "weapon" : "armor");
    finishDungeonEvent("ПЕЧАТЬ РАЗБИТА", `Осколки задели тебя на ${damage} здоровья. В ларце ${gold} монет.${gear}`, "✧", "Разбитая печать");
  } else if (action === "rubble-clear") {
    const damage = damageFromEvent(3, 6);
    const gold = 4 + state.floor;
    state.gold += gold;
    const gear = claimEventGear("armor");
    finishDungeonEvent("ПРОХОД РАСЧИЩЕН", `Завал поддался, но камни отняли ${damage} здоровья. За ними было ${gold} монет.${gear}`, "⚒", "Разобранный завал");
  } else if (action === "rubble-squeeze") {
    const gold = 3 + state.floor;
    state.gold += gold;
    finishDungeonEvent("ЛАЗ НАЙДЕН", `Ты протиснулся между камнями и подобрал ${gold} монет, не рискуя здоровьем.`, "⌕", "Лаз между камнями");
  } else if (action === "dive-deep") {
    const damage = damageFromEvent(4, 8);
    const gold = 4 + state.floor;
    state.gold += gold;
    addEventEssence(1);
    finishDungeonEvent("ОСКОЛОК ИЗ ГЛУБИНЫ", `Ты нырнул за сияющим осколком, потерял ${damage} здоровья и нашёл ${gold} монет. Лагерь получил 1 осколок.`, "♆", "Погружение за осколком");
  } else if (action === "dive-shallow") {
    const gold = 4 + state.floor;
    state.gold += gold;
    finishDungeonEvent("НАХОДКА У БЕРЕГА", `У самой кромки воды ты собрал ${gold} монет и сохранил силы.`, "♆", "Находка у берега");
  } else if (action === "ore-careful") {
    const gold = 4 + state.floor;
    state.gold += gold;
    state.attack += 1;
    finishDungeonEvent("РУДНАЯ ЗАГОТОВКА", `Ты аккуратно добыл ${gold} монет ценного металла. Сила удара выросла на 1.`, "⚒", "Добыта руда");
  } else if (action === "ore-force") {
    const damage = damageFromEvent(4, 8);
    const gold = 14 + state.floor;
    state.gold += gold;
    finishDungeonEvent("БОГАТАЯ ЖИЛА", `Сильный удар расколол жилу: ты получил ${gold} монет, но потерял ${damage} здоровья.`, "⚒", "Богатая рудная жила");
  } else if (action === "fish-net") {
    if (state.hp < state.maxHp) {
      const healing = Math.min(randomInt(8, 13), state.maxHp - state.hp);
      state.hp += healing;
      finishDungeonEvent("УЛОВ", `В сети оказалась светлая рыба. Она восстановила ${healing} здоровья.`, "≋", "Подземный улов", "heal");
    } else if (state.potions < getPotionLimit()) {
      state.potions += 1;
      finishDungeonEvent("УЛОВ", "В сети оказалась целебная рыба; ты приготовил из неё зелье.", "≋", "Подземный улов", "heal");
    } else {
      const gold = 6 + state.floor;
      state.gold += gold;
      finishDungeonEvent("УЛОВ", `Рыбу обменяли на ${gold} монет — запас зелий уже полон.`, "≋", "Подземный улов");
    }
  } else if (action === "fish-shiny") {
    const gold = 8 + state.floor;
    state.gold += gold;
    addEventEssence(1);
    finishDungeonEvent("БЛЕСК НА ДНЕ", `Среди камней нашлись жемчужина и ${gold} монет. Её сияние укрепило лагерь на 1 осколок.`, "✧", "Жемчужина из ручья");
  } else if (action === "door-listen") {
    const gold = 5 + state.floor;
    state.gold += gold;
    const healing = Math.min(3, state.maxHp - state.hp);
    state.hp += healing;
    finishDungeonEvent("ТИХИЙ ЩЕЛЧОК", `Ты уловил ритм замка и избежал ловушки. За дверью ${gold} монет${healing ? ` и восстановлено ${healing} здоровья` : ""}.`, "⚿", "Открытая дверь");
  } else if (action === "door-force") {
    const damage = damageFromEvent(4, 7);
    const gear = claimEventGear("armor");
    finishDungeonEvent("ДВЕРЬ ПОДДАЛАСЬ", `Механизм сломан: потеряно ${damage} здоровья.${gear}`, "⚿", "Испытание двери");
  } else if (action === "hunt-track") {
    const scale = 1 + (state.floor - 1) * 0.1;
    spawnEnemy(false, false, {
      name: "Подземный зверь", icon: "♧", skin: "hound",
      hp: Math.round((10 + state.floor * 2) * scale),
      damage: Math.ceil((3 + Math.floor(state.floor / 3)) * scale),
      xp: 12 + state.floor, gold: 12 + state.floor,
    });
    return;
  } else if (action === "hunt-bait") {
    const gold = 6 + state.floor;
    state.gold += gold;
    const healing = Math.min(randomInt(4, 7), state.maxHp - state.hp);
    state.hp += healing;
    finishDungeonEvent("ДОБЫЧА У ЛОГОВА", `Зверь не вышел, но приманка отвлекла его: найдено ${gold} монет${healing ? ` и восстановлено ${healing} здоровья` : ""}.`, "♧", "След охотника");
  } else if (action === "echo-duel") {
    const scale = 1 + (state.floor - 1) * 0.12;
    spawnEnemy(false, false, {
      name: "Тень прежнего искателя", icon: "◈", skin: "shade",
      hp: Math.round((12 + state.floor * 2) * scale),
      damage: Math.ceil((4 + Math.floor(state.floor / 3)) * scale),
      xp: 14 + state.floor, gold: 15 + state.floor,
    });
    return;
  } else if (action === "echo-share") {
    state.gold -= 5;
    const healing = Math.min(7, state.maxHp - state.hp);
    state.hp += healing;
    addEventEssence(1);
    finishDungeonEvent("ПАМЯТЬ О ПУТНИКЕ", `Эхо приняло припасы и оставило знак для лагеря. ${healing ? `Восстановлено ${healing} здоровья; ` : ""}получен 1 осколок.`, "◈", "Обмен с эхом", "rune");
  } else if (action === "smuggler-buy") {
    state.gold -= 10;
    const gear = claimEventGear(randomInt(0, 1) ? "weapon" : "armor");
    finishDungeonEvent("ТАЙНЫЙ ТОВАР", `Контрабандист продал реликвию за 10 монет.${gear}`, "♜", "Сделка с контрабандистом", "merchant");
  } else if (action === "smuggler-catch") {
    const damage = damageFromEvent(2, 5);
    const gold = 12 + state.floor;
    state.gold += gold;
    finishDungeonEvent("ПОТЕРЯННЫЙ ТАЙНИК", `Контрабандист скрылся, оставив ${gold} монет. В суматохе ты потерял ${damage} здоровья.`, "♜", "Тайник контрабандиста");
  } else if (action === "maze-mark") {
    const gold = 4 + state.floor;
    state.gold += gold;
    finishDungeonEvent("ВЫХОД НАЙДЕН", `Отмечая повороты, ты нашёл короткий путь и ${gold} монет без единой царапины.`, "⌘", "Выход из лабиринта");
  } else if (action === "maze-dash") {
    const damage = damageFromEvent(4, 8);
    const gear = claimEventGear("weapon");
    finishDungeonEvent("СМЕЛЫЙ МАРШРУТ", `Ты проскочил опасный коридор, потерял ${damage} здоровья и нашёл реликвию.${gear}`, "⌘", "Опасный поворот");
  } else if (action === "roaming-buy") {
    state.gold -= 12;
    const gear = claimEventGear(randomInt(0, 1) ? "weapon" : "armor");
    finishDungeonEvent("ЛАВКА УЕХАЛА", `За 12 монет хозяин лавки продал тебе реликвию и покатил дальше.${gear}`, "♙", "Покупка в блуждающей лавке", "merchant");
  } else if (action === "roaming-pass") {
    const gold = 3 + state.floor;
    state.gold += gold;
    finishDungeonEvent("ЛЁГКОЕ РАССТАВАНИЕ", `Ты отказался от товара, а хозяин оставил ${gold} монет за добрую беседу.`, "♙", "Блуждающая лавка");
  } else if (action === "hermit-rest") {
    const healing = Math.min(randomInt(8, 12), state.maxHp - state.hp);
    state.hp += healing;
    finishDungeonEvent("ЧАШКА ОТШЕЛЬНИКА", healing ? `Настой вернул ${healing} здоровья. Старик провожает тебя к выходу.` : "Ты полон сил; отшельник всё равно угощает тёплым настоем.", "☼", "Угощение отшельника", "heal");
  } else if (action === "hermit-trade") {
    state.gold -= 5;
    state.attack += 1;
    finishDungeonEvent("УРОК СТАРИКА", "За 5 монет отшельник показал, как находить слабое место. Сила удара навсегда выросла на 1.", "☼", "Наставление отшельника", "rune");
  } else if (action === "altar-summon") {
    const scale = 1 + (state.floor - 1) * 0.14;
    spawnEnemy(false, false, {
      name: "Страж алтаря", icon: "ᛟ", skin: "golem",
      hp: Math.round((16 + state.floor * 2) * scale),
      damage: Math.ceil((5 + Math.floor(state.floor / 3)) * scale),
      xp: 18 + state.floor, gold: 18 + state.floor,
    });
    return;
  } else if (action === "altar-offer") {
    state.gold -= 6;
    addEventEssence(1);
    const healing = Math.min(5, state.maxHp - state.hp);
    state.hp += healing;
    finishDungeonEvent("АЛТАРЬ УТИХ", `Подношение принято. Лагерь получил 1 осколок${healing ? `, восстановлено ${healing} здоровья` : ""}.`, "ᛟ", "Подношение алтарю", "rune");
  } else if (action === "book-study") {
    state.attack += 1;
    finishDungeonEvent("ЗАПОМНЕННАЯ ГЛАВА", "Ты успел разобрать один боевой приём до того, как чернила поблёкли. Сила удара навсегда выросла на 1.", "▤", "Страница из истлевшей книги", "rune");
  } else if (action === "book-seal") {
    const gold = 7 + state.floor;
    state.gold += gold;
    const damage = damageFromEvent(1, 3);
    finishDungeonEvent("КНИГА ЗАПЕЧАТАНА", `Чернила погасли: найдено ${gold} монет, но едкий пар отнял ${damage} здоровья.`, "▤", "Запечатанная книга");
  } else if (action === "ruins-search") {
    const damage = damageFromEvent(3, 6);
    const gear = claimEventGear("armor");
    finishDungeonEvent("РЕЛИКВИЯ РУИН", `Ты поднял пыль и получил ${damage} урона, но нашёл уцелевшую броню.${gear}`, "⌂", "Осмотр заброшенных руин");
  } else if (action === "ruins-salvage") {
    const gold = 8 + state.floor;
    state.gold += gold;
    const potion = state.potions < getPotionLimit();
    if (potion) state.potions += 1;
    finishDungeonEvent("ПОЛЕЗНЫЙ ХЛАМ", `Из руин вынесено ${gold} монет${potion ? " и зелье" : ""}.`, "⌂", "Находки в руинах");
  } else if (action === "grove-drink") {
    const healing = Math.min(randomInt(9, 14), state.maxHp - state.hp);
    state.hp += healing;
    finishDungeonEvent("РОСА С КОРНЕЙ", healing ? `Чистая роса восстановила ${healing} здоровья.` : "Роса свежа, но ты и так полон сил.", "♧", "Передышка в подземной роще", "heal");
  } else if (action === "grove-harvest") {
    state.maxHp += 4;
    const healing = Math.min(4, state.maxHp - state.hp);
    state.hp += healing;
    finishDungeonEvent("СЕМЕНА РОЩИ", `Ты сохранил семена: максимум здоровья навсегда вырос на 4${healing ? `, восстановлено ${healing}` : ""}.`, "♧", "Дар подземной рощи", "rune");
  } else if (action === "rune-strength") {
    state.attack += 1;
    finishDungeonEvent("РУНА ОТКЛИКНУЛАСЬ", "Камень рассыпался искрами. Сила удара навсегда выросла на 1.", "ᛟ", "Руна силы", "rune");
  } else if (action === "rune-vitality") {
    state.maxHp += 5;
    const healing = Math.min(8, state.maxHp - state.hp);
    state.hp += healing;
    finishDungeonEvent("РУНА ЖИЗНИ", `Камень согрел ладонь: максимум здоровья вырос на 5${healing ? `, восстановлено ${healing}` : ""}.`, "ᛟ", "Руна жизни", "rune");
  } else if (action === "wonder-touch") {
    const damage = damageFromEvent(4, 8);
    const gear = claimEventGear(randomInt(0, 1) ? "weapon" : "armor");
    addEventEssence(1);
    finishDungeonEvent("ЧУДО КРИСТАЛЛОВ", `Сияние обожгло на ${damage} здоровья, но подарило реликвию и 1 осколок.${gear}`, "✦", "Дар пещеры чудес", "rune");
  } else if (action === "wonder-gather") {
    const gold = 9 + state.floor;
    state.gold += gold;
    finishDungeonEvent("САМОЦВЕТЫ У ВХОДА", `Ты собрал самоцветы на ${gold} монет и не потревожил кристаллы.`, "✦", "Самоцветы пещеры");
  } else if (action === "wreck-dive") {
    const damage = damageFromEvent(5, 9);
    const gold = 12 + state.floor;
    state.gold += gold;
    addEventEssence(1);
    finishDungeonEvent("ДОБЫЧА ИЗ ТРЮМА", `В трюме нашлось ${gold} монет. Погружение отняло ${damage} здоровья; лагерь получил 1 осколок.`, "⚓", "Затонувший груз", "rune");
  } else if (action === "wreck-scavenge") {
    const gold = 7 + state.floor;
    state.gold += gold;
    const potion = state.potions < getPotionLimit();
    if (potion) state.potions += 1;
    finishDungeonEvent("НАХОДКА НА ПАЛУБЕ", `Среди снастей нашлось ${gold} монет${potion ? " и зелье" : ""}.`, "⚓", "Обыск затонувшей палубы");
  }
}

function revealSecret() {
  const secret = SECRET_LORE.find((item) => item.id === getFloorTheme().id);
  if (!secret) return;
  const newlyFoundThisRun = !state.secretFragments.includes(secret.id);
  if (newlyFoundThisRun) {
    state.secretFragments.push(secret.id);
    advanceQuest("secret");
  }
  const firstDiscovery = !metaProgress.secretsFound.includes(secret.id);
  let discoveryText = secret.text;
  if (firstDiscovery) {
    metaProgress.secretsFound.push(secret.id);
    metaProgress.essence += 1;
    discoveryText += " Ты сохранил знак в летописи лагеря и получил 1 осколок.";
    persistMetaProgress();
  } else {
    const reward = 8 + state.floor;
    state.gold += reward;
    discoveryText += ` Этот знак уже знаком; в тайнике осталось ${reward} монет.`;
  }
  setEvent(firstDiscovery ? "ТАЙНЫЙ ЗАЛ" : "ЗНАК ИЗ ЛЕТОПИСИ", `${secret.title}. ${discoveryText}`, "ᛟ", firstDiscovery ? "+1 ОСКОЛОК" : "СЕКРЕТ");
  addJournal(secret.title, discoveryText, "ᛟ");
  setCaption("Шёпот становится яснее");
  playSound("rune");
}

function spawnEnemy(isBoss, isElite = false, eventEnemy = null) {
  const theme = getFloorTheme();
  const roomEnemies = getRoomEnemies();
  const cycle = Math.floor((state.floor - 1) / FLOOR_THEMES.length);
  const base = eventEnemy || (isBoss ? {
    name: theme.guardian,
    icon: theme.guardianIcon,
    skin: "guardian",
    hp: theme.bossHp + cycle * 15,
    damage: theme.bossDamage + cycle * 2,
    xp: theme.bossXp + cycle * 8,
    gold: theme.bossGold + state.floor,
    boss: true,
  } : isElite
    ? { ...ELITE_TYPES.find((enemy) => enemy.theme === theme.id), elite: true }
    : roomEnemies[randomInt(0, roomEnemies.length - 1)]);
  const scale = 1 + (state.floor - 1) * 0.12;
  state.enemy = {
    name: base.name,
    icon: base.icon,
    skin: base.skin,
    hp: Math.round(base.hp * scale),
    maxHp: Math.round(base.hp * scale),
    damage: Math.ceil(base.damage * scale),
    xp: Math.round(base.xp * (isElite ? 1.2 : 1)),
    gold: Math.round(base.gold * (isElite ? 1.2 : 1)),
    boss: Boolean(base.boss),
    elite: isElite,
  };
  state.extraLifeUsed = false;
  const encounterTitle = isBoss ? `СТРАЖ · ${theme.name.toUpperCase()}` : isElite ? "ЭЛИТНЫЙ ХРАНИТЕЛЬ" : "ОБИТАТЕЛЬ ГЛУБИНЫ";
  const encounterText = `${state.enemy.name} преграждает путь. Здоровье: ${state.enemy.hp}${isElite ? ". Победа принесёт усиленную награду." : "."}`;
  setEvent(encounterTitle, encounterText, isBoss || isElite ? state.enemy.icon : base.icon);
  addJournal(isBoss ? "Страж пробуждён" : isElite ? "Элитный противник" : "Встреча в темноте", `${state.enemy.name} вступает в бой.`, isBoss ? "☠" : "⚔");
  setCaption(isBoss ? "Страж колодца" : isElite ? "Опасный противник" : "Враг приближается");
  playSound(isBoss || isElite ? "boss" : "encounter");
  render();
}

function attackEnemy(multiplier = 1, focusCost = 0, usedAbility = false) {
  if (!state.enemy || state.gameOver || state.focus < focusCost) return;
  if (focusCost > 0) state.focus -= focusCost;
  else state.focus = Math.min(MAX_FOCUS, state.focus + 1);
  let damage = Math.max(1, Math.floor((getAttackPower() + randomInt(0, 3)) * multiplier));
  if (state.enemy.hp === state.enemy.maxHp && getClassStat("bonusDamage")) {
    damage += Math.ceil(getAttackPower() * getClassStat("bonusDamage"));
  }
  if (getClassStat("missingHealthDamage")) {
    damage += Math.ceil(getAttackPower() * getClassStat("missingHealthDamage") * (1 - state.hp / state.maxHp));
  }
  const critical = focusCost === 0 && Math.random() < getClassStat("criticalChance");
  if (critical) damage *= 2;
  if (state.enemy.hp <= state.enemy.maxHp * 0.2 && Math.random() < getClassStat("executeChance")) {
    damage = state.enemy.hp;
  }
  damage = Math.min(damage, state.enemy.hp);
  state.enemy.hp = Math.max(0, state.enemy.hp - damage);
  const healing = focusCost === 0 ? Math.min(
    Math.ceil(damage * getClassStat("lifesteal")),
    state.maxHp - state.hp,
  ) : 0;
  state.hp += healing;
  const focusMessage = focusCost > 0
    ? ` Сокрушительный удар расходует ${focusCost} запаса силы.`
    : state.focus > 0
      ? ` Запас силы: ${state.focus} из ${MAX_FOCUS}.`
      : "";
  setEvent(
    focusCost > 0 ? "СОКРУШИТЕЛЬНЫЙ УДАР" : usedAbility ? getCharacterClass().ability.name.toUpperCase() : "УДАР НАНЕСЁН",
    `${usedAbility ? `${getCharacterClass().ability.description} ` : ""}Ты наносишь ${damage} урона${critical ? " — критический удар" : ""}.${healing ? ` Кровь возвращает ${healing} здоровья.` : ""}${focusMessage} У ${state.enemy.name} осталось ${state.enemy.hp} здоровья.`,
    usedAbility ? getCharacterClass().ability.icon : "⚔",
  );
  ui.scene.classList.add("hit");
  window.setTimeout(() => ui.scene.classList.remove("hit"), 180);
  playSound(focusCost > 0 ? "heavyAttack" : "attack");
  if (state.enemy.hp <= 0) {
    defeatEnemy();
    return;
  }
  enemyTurn(false, !usedAbility);
}

function enemyTurn(guarding = false, advanceCooldown = true) {
  const damageOverTime = Math.ceil(state.enemy.maxHp * getClassStat("damageOverTime"));
  if (damageOverTime > 0) {
    state.enemy.hp = Math.max(0, state.enemy.hp - damageOverTime);
    if (state.enemy.hp === 0) {
      if (advanceCooldown) state.abilityCooldown = Math.max(0, state.abilityCooldown - 1);
      setEvent("ПРОКЛЯТИЕ СРАБОТАЛО", `${state.enemy.name} пал от урона чар.`, "☾");
      defeatEnemy();
      return;
    }
  }
  if (guarding) state.focus = Math.min(MAX_FOCUS, state.focus + 1);
  const rawDamage = randomInt(Math.max(1, state.enemy.damage - 2), state.enemy.damage);
  const armorDefense = getArmorDefense();
  const reducedDamage = Math.max(1, rawDamage - armorDefense);
  const dodgeChance = getDodgeChance();
  const abilityDodge = state.abilityDodge;
  const dodged = !guarding && (abilityDodge || Math.random() < dodgeChance);
  state.abilityDodge = false;
  const abilityGuarding = state.abilityGuarding;
  let damage = dodged ? 0 : Math.max(
    1,
    abilityGuarding
      ? Math.ceil(reducedDamage * 0.25)
      : guarding || state.guarding
        ? Math.ceil(reducedDamage * 0.4)
        : reducedDamage,
  );
  state.abilityGuarding = false;
  state.guarding = false;
  const savedByMastery = state.hp - damage <= 0 && getClassStat("extraLife") && !state.extraLifeUsed;
  if (savedByMastery) {
    damage = state.hp - 1;
    state.extraLifeUsed = true;
  }
  state.hp = Math.max(0, state.hp - damage);
  if (state.hp === 0) {
    awardRunEssence();
    state.gameOver = true;
    state.enemy = null;
    setEvent("ПОСЛЕДНИЙ ВДОХ", `Ты пал на ${state.floor}-м этаже. В лагерь возвращено ${runEssenceReward()} осколков. Лучший спуск: ${bestFloor || state.floor}.`, "☾");
    addJournal("Спуск прерван", "Темнота сомкнулась вокруг. Но легенда колодца останется.", "☾");
    setCaption("Тишина");
  } else {
    const focusMessage = guarding ? ` Запас силы: ${state.focus} из ${MAX_FOCUS}.` : "";
    const armorMessage = armorDefense ? ` Броня поглотила ${Math.min(armorDefense, rawDamage - 1)} урона.` : "";
    setEvent(
      dodged ? "УКЛОНЕНИЕ" : "ВРАГ АТАКУЕТ",
      savedByMastery
        ? `Упорство мастерства спасает тебя от смертельного удара ${state.enemy.name}.`
        : dodged
        ? `Ты увернулся от атаки ${state.enemy.name}.`
        : `${state.enemy.name} наносит ${damage} урона${guarding ? ", но твоя защита смягчает удар" : ""}.${armorMessage}${focusMessage}`,
      dodged ? "◈" : "⬡",
    );
    setCaption(dodged ? "Удар прошёл мимо" : "Бой продолжается");
  }
  if (advanceCooldown) state.abilityCooldown = Math.max(0, state.abilityCooldown - 1);
  playSound(state.gameOver ? "gameOver" : guarding ? "guard" : dodged ? "dodge" : "enemyAttack");
  render();
}

function runEssenceReward() {
  return 1 + Math.floor((state.floor - 1) / 3) + state.runBossesDefeated;
}

function awardRunEssence() {
  if (state.runRewardClaimed) return;
  state.runRewardClaimed = true;
  metaProgress.essence = Math.min(1000000000, metaProgress.essence + runEssenceReward());
  persistMetaProgress();
}

function useClassAbility() {
  const ability = getCharacterClass().ability;
  if (!state.enemy || state.gameOver || state.abilityCooldown > 0 || !ability) return;
  state.abilityCooldown = 3;
  if (ability.type === "guard") {
    state.abilityGuarding = true;
    state.focus = Math.min(MAX_FOCUS, state.focus + 1);
    setEvent(ability.name.toUpperCase(), `${ability.description} Запас силы: ${state.focus} из ${MAX_FOCUS}.`, ability.icon);
    enemyTurn(false, false);
    return;
  }
  if (ability.type === "shadow") state.abilityDodge = true;
  attackEnemy(ability.type === "blast" ? 1.8 : 1.5, 0, true);
}

function defeatEnemy() {
  const enemy = state.enemy;
  state.enemy = null;
  state.abilityGuarding = false;
  state.abilityDodge = false;
  state.gold += enemy.gold;
  gainXp(enemy.xp);
  advanceQuest("defeat");
  let gearMessage = "";
  const lootChance = Math.min(0.8, 0.3 + getClassStat("lootChance"));
  if (enemy.boss || Math.random() < lootChance) {
    if (state.inventory.length < MAX_GEAR) {
      const gear = createGear(randomInt(0, 1) === 0 ? "weapon" : "armor");
      state.inventory.push(gear);
      advanceQuest("gear");
      gearMessage = ` Найдено: ${gear.name} (+${gear.bonus} ${gear.type === "weapon" ? "к силе" : "к защите"}), предмет в рюкзаке.`;
      addJournal("Найдена экипировка", `${gear.name}: +${gear.bonus} ${gear.type === "weapon" ? "к урону" : "к защите"}.`, gear.type === "weapon" ? "⚔" : "⬡");
    } else {
      gearMessage = " Рюкзак полон: трофей остался в зале.";
    }
  }
  const victoryHealing = getClassStat("healingOnVictory");
  const healed = Math.min(victoryHealing, state.maxHp - state.hp);
  state.hp += healed;
  if (enemy.boss) {
    state.runBossesDefeated += 1;
    metaProgress.bossesDefeated = Math.min(1000000000, metaProgress.bossesDefeated + 1);
    persistMetaProgress();
    state.waitingToDescend = true;
    const bonus = Math.min(8, state.maxHp - state.hp);
    state.hp += bonus;
    setEvent("СТРАЖ ПОВЕРЖЕН", `Ты получил ${enemy.xp} опыта и ${enemy.gold} монет.${healed ? ` Класс восстановил ${healed} здоровья.` : ""}${bonus ? ` Передышка вернула ${bonus} здоровья.` : ""}${gearMessage} Путь вниз открыт.`, "✧", "ПУТЬ ОТКРЫТ");
    addJournal("Путь открыт", `Страж повержен. Ты готов спуститься на ${state.floor + 1}-й этаж.`, "↓");
    setCaption("Лестница открыта");
    playSound("bossVictory");
  } else {
    const foundPotion = Math.random() < 0.2 && state.potions < getPotionLimit();
    if (foundPotion) state.potions += 1;
    const eliteReward = enemy.elite ? " Элитная награда!" : "";
    setEvent(enemy.elite ? "ЭЛИТНЫЙ ВРАГ ПОВЕРЖЕН" : "ПОБЕДА", `${enemy.name} повержен: +${enemy.xp} опыта, +${enemy.gold} монет${foundPotion ? ", +1 зелье" : ""}${healed ? `, восстановлено ${healed} здоровья` : ""}.${eliteReward}${gearMessage}`, "✧");
    addJournal(enemy.elite ? "Элитный враг повержен" : "Враг повержен", `+${enemy.xp} опыта и +${enemy.gold} монет.`, "⚔");
    setCaption("В зале тихо");
    playSound("victory");
  }
  render();
}

function gainXp(amount) {
  state.xp += amount;
  let leveledUp = false;
  while (state.xp >= XP_PER_LEVEL * state.level) {
    state.xp -= XP_PER_LEVEL * state.level;
    state.level += 1;
    leveledUp = true;
    state.maxHp += 6;
    state.hp = Math.min(state.maxHp, state.hp + 12);
    state.attack += 1;
    addJournal("Новый уровень", `Уровень ${state.level}: здоровье и сила выросли.`, "✦");
    if (state.level === CLASS_UNLOCK_LEVELS.advanced || state.level === CLASS_UNLOCK_LEVELS.mastery) {
      state.pendingClassLevels.push(state.level);
      addJournal("Новый путь открыт", `На уровне ${state.level} можно выбрать следующий класс.`, "✦");
    }
  }
  if (leveledUp) playSound("levelUp");
}

function getAttackPower() {
  return state.attack + (state.equipment.weapon?.bonus || 0) +
    getClassStat("attack");
}

function getArmorDefense() {
  return (state.equipment.armor?.bonus || 0) + getCharacterClass().defense +
    getClassStat("defense");
}

function getDodgeChance() {
  return Math.min(0.8, getClassStat("dodge"));
}

function getHeavyAttackMultiplier() {
  return (getCharacterClass().heavyMultiplier || 2.2) + getClassStat("heavyMultiplier");
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
  const healing = Math.min(14 + getClassStat("potionHealing"), state.maxHp - state.hp);
  state.hp += healing;
  setEvent("ЗЕЛЬЕ ВЫПИТО", `Ты восстановил ${healing} здоровья.`, "⚗");
  addJournal("Зелье здоровья", `Восстановлено ${healing} здоровья.`, "⚗");
  playSound("heal");
  if (inCombat && state.enemy) enemyTurn(false);
  else render();
}

function descend() {
  if (!state.waitingToDescend || state.gameOver) return;
  state.floor += 1;
  state.room = 0;
  state.waitingToDescend = false;
  state.hp = Math.min(state.maxHp, state.hp + 8);
  state.potions = Math.min(getPotionLimit(), state.potions + 1);
  updateBestFloor();
  setEvent("НОВЫЙ ЭТАЖ", "Ты спустился глубже. Новый источник света дрожит впереди.", "↓", `ЭТАЖ ${state.floor}`);
  addJournal("Глубже во мрак", `Начался ${state.floor}-й этаж. Ты нашёл зелье и немного восстановил силы.`, "↓");
  setCaption("Глубина зовёт");
  playSound("descend");
  render();
}

function merchantPurchase(item) {
  if (!state.merchantAvailable || state.gameOver) return;
  if (item === "potion") {
    if (state.potions >= getPotionLimit() || state.gold < MERCHANT_PRICES.potion) return;
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
  playSound("purchase");
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
  for (const [element, gear, type] of [
    [ui.equippedWeapon, weapon, "оружие"],
    [ui.equippedArmor, armor, "броня"],
  ]) {
    if (!gear) {
      element.replaceChildren(document.createTextNode("Нет"));
      continue;
    }
    element.replaceChildren(
      createArtIcon(getGearArtId(gear), `${gear.name}, ${type}`, "gear-icon"),
      document.createTextNode(`${gear.name} · +${gear.bonus}`),
    );
  }
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
    const icon = createArtIcon(getGearArtId(gear), `${gear.name}, ${gear.type === "weapon" ? "оружие" : "броня"}`, "inventory-art");
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
    item.append(icon, details, equip);
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
  const nodes = getSelectedClassNodes();
  const characterClass = nodes[nodes.length - 1];
  ui.equippedClass.textContent = nodes.map((node) => node.name).join(" → ");
  ui.classPassive.textContent = `${getCharacterClass().passive}${characterClass.tier > 1 ? ` ${characterClass.description}` : ""}`;
  ui.equippedSubclass.replaceChildren();
  const stages = [
    { level: 1, name: nodes[0].name, selected: true },
    { level: CLASS_UNLOCK_LEVELS.advanced, name: state.advancedClassId ? CLASS_BY_ID.get(state.advancedClassId).name : "Класс II", selected: Boolean(state.advancedClassId) },
    { level: CLASS_UNLOCK_LEVELS.mastery, name: state.masteryClassId ? CLASS_BY_ID.get(state.masteryClassId).name : "Мастерство", selected: Boolean(state.masteryClassId) },
  ];
  for (const stage of stages) {
    const row = document.createElement("div");
    row.className = "subclass-progress-row";
    const name = document.createElement("strong");
    name.textContent = stage.name;
    const status = document.createElement("span");
    if (stage.selected) {
      row.classList.add("unlocked");
      status.textContent = stage.level === 1 ? "ОТКРЫТ" : "ВЫБРАН";
    } else if (state.pendingClassLevels.includes(stage.level)) {
      row.classList.add("available");
      status.textContent = "ВЫБЕРИ КЛАСС";
    } else {
      status.textContent = `ОТКРОЕТСЯ · УР. ${stage.level}`;
    }
    row.append(name, status);
    ui.equippedSubclass.append(row);
  }
}

function renderRunQuests() {
  ui.quests.replaceChildren();
  ui.quests.closest(".quest-card").hidden = !state.quests.length;
  if (!state.quests.length) {
    ui.quests.hidden = true;
    return;
  }
  ui.quests.hidden = false;
  for (const progress of state.quests) {
    const quest = RUN_QUESTS.find((item) => item.id === progress.id);
    if (!quest) continue;
    const row = document.createElement("div");
    row.className = `quest-row${progress.completed ? " complete" : ""}`;
    const heading = document.createElement("div");
    heading.className = "quest-heading";
    const title = document.createElement("strong");
    title.textContent = `${quest.icon} ${quest.title}`;
    const reward = document.createElement("span");
    reward.textContent = progress.completed ? "ВЫПОЛНЕНО" : `+${quest.reward} ✦`;
    heading.append(title, reward);
    const description = document.createElement("p");
    description.textContent = quest.text;
    const meter = document.createElement("div");
    meter.className = "quest-progress";
    meter.setAttribute("role", "progressbar");
    meter.setAttribute("aria-label", quest.title);
    meter.setAttribute("aria-valuemin", "0");
    meter.setAttribute("aria-valuemax", String(quest.target));
    meter.setAttribute("aria-valuenow", String(progress.progress));
    const fill = document.createElement("span");
    fill.style.width = `${(progress.progress / quest.target) * 100}%`;
    meter.append(fill);
    const count = document.createElement("small");
    count.textContent = `${progress.progress} / ${quest.target}`;
    row.append(heading, description, meter, count);
    ui.quests.append(row);
  }
}

function render() {
  const theme = getFloorTheme();
  const characterClass = state.classId ? getSelectedClassNodes().slice(-1)[0] : null;
  ui.level.textContent = `УР. ${state.level}`;
  $("player-name").textContent = characterClass ? characterClass.name : "Искатель";
  $("player-subtitle").textContent = characterClass ? characterClass.role : "Последний из наземных";
  const baseClassId = getBaseClassId(characterClass?.id);
  $("portrait-figure").replaceChildren(createArtIcon(
    `hero-${baseClassId}`,
    characterClass ? characterClass.name : "Искатель",
    "portrait-art",
  ));
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
  const classAbility = state.classId ? getCharacterClass().ability : null;
  ui.abilityIcon.textContent = classAbility?.icon || "✦";
  ui.abilityLabel.textContent = classAbility
    ? `${classAbility.name}${state.abilityCooldown ? ` · ${state.abilityCooldown}` : " · готово"}`
    : "Способность";
  ui.abilityButton.disabled = !state.enemy || state.gameOver || state.abilityCooldown > 0;
  ui.abilityButton.title = classAbility
    ? `${classAbility.description}${state.abilityCooldown ? ` Перезарядка: ${state.abilityCooldown} хода.` : ""}`
    : "";
  ui.abilityButton.setAttribute("aria-label", classAbility
    ? `${classAbility.name}: ${classAbility.description}${state.abilityCooldown ? ` Перезарядка ${state.abilityCooldown} хода.` : " Готова."}`
    : "Классовая способность");
  ui.best.textContent = bestFloor ? `ЭТАЖ ${bestFloor}` : "—";
  ui.floor.textContent = state.started ? `ЭТАЖ ${state.floor}` : "—";
  ui.floorTitle.textContent = state.started ? `Зал ${state.room || 1} · ${state.enemy ? state.enemy.name : theme.name}` : "Зов из глубины";
  ui.caption.textContent = state.caption;
  ui.eventKicker.textContent = state.event.kicker;
  ui.eventText.textContent = state.event.text;
  ui.eventIcon.textContent = state.event.icon;
  ui.eventTag.textContent = state.event.tag;
  const eventActions = state.event.actions || [];
  ui.eventActions.replaceChildren();
  for (const action of eventActions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-button";
    button.dataset.eventAction = action;
    button.textContent = DUNGEON_EVENT_ACTIONS.get(action);
    button.disabled = state.gold < getDungeonEventActionCost(action);
    ui.eventActions.append(button);
  }
  ui.eventActions.hidden = eventActions.length === 0;
  ui.scene.classList.toggle("in-combat", Boolean(state.enemy));
  ui.scene.classList.toggle("has-merchant", state.merchantAvailable);
  for (const floorTheme of FLOOR_THEMES) {
    ui.scene.classList.toggle(`floor-${floorTheme.id}`, state.started && theme.id === floorTheme.id);
  }
  ui.enemy.className = `scene-enemy${state.enemy ? ` enemy-${state.enemy.skin || "guardian"}` : ""}`;
  if (state.enemy) {
    const enemyArt = state.enemy.skin === "guardian"
      ? `guardian-${theme.id}`
      : ENEMY_ART[state.enemy.skin] || "enemy-stone";
    ui.enemy.replaceChildren(createArtIcon(enemyArt, state.enemy.name, "scene-art"));
  } else {
    ui.enemy.replaceChildren();
  }
  ui.merchant.textContent = state.merchantAvailable ? "♟" : "";
  ui.character.setAttribute("aria-label", characterClass ? characterClass.name : "Искатель");
  ui.character.replaceChildren(createArtIcon(
    `hero-${baseClassId}`,
    characterClass ? characterClass.name : "Искатель",
    "scene-art",
  ));
  ui.explore.disabled = !state.started || Boolean(state.enemy) || state.gameOver || state.merchantAvailable || state.waitingToDescend || eventActions.length > 0;
  ui.potion.disabled = !state.started || state.potions === 0 || state.hp >= state.maxHp || state.gameOver;
  $("combat-potion-button").disabled = state.potions === 0 || state.hp >= state.maxHp || state.gameOver;
  ui.combatPotionCount.textContent = String(state.potions);
  ui.explore.textContent = state.room === 0 ? "Войти в первый зал" : "Исследовать зал";
  ui.explore.replaceChildren(Object.assign(document.createElement("span"), { textContent: "⌕" }), document.createTextNode(` ${state.room === 0 ? "Войти в первый зал" : "Исследовать зал"}`));
  ui.explore.hidden = !state.started || Boolean(state.enemy) || state.gameOver || state.merchantAvailable || state.waitingToDescend || eventActions.length > 0;
  ui.potion.hidden = !state.started || Boolean(state.enemy) || state.gameOver || state.merchantAvailable || state.waitingToDescend || eventActions.length > 0;
  ui.combatActions.hidden = !state.enemy || state.gameOver;
  ui.merchantActions.hidden = !state.merchantAvailable || state.gameOver;
  ui.buyPotion.disabled = state.potions >= getPotionLimit() || state.gold < MERCHANT_PRICES.potion;
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
      : "Исследуй пять залов и одолей стража на шестом, чтобы открыть путь дальше.";
  ui.journalStatus.textContent = state.gameOver ? "Путешествие завершено" : state.waitingToDescend ? "Лестница в глубину открыта" : state.started ? "Ты внутри колодца" : "Твой путь ждёт начала";
  renderTrack();
  renderJournal();
  renderEquipment();
  renderClassProgression();
  renderMetaProgress();
  renderRunQuests();
  saveActiveRun();
  if (state.started && state.pendingClassLevels.length) renderSubclassChoices();
}

const SOUND_EFFECTS = {
  start: [[220, 0.09], [330, 0.12, 0.08]],
  attack: [[250, 0.07]],
  heavyAttack: [[180, 0.12], [300, 0.1, 0.08]],
  enemyAttack: [[125, 0.1]],
  guard: [[185, 0.1]],
  dodge: [[270, 0.08]],
  encounter: [[165, 0.11], [125, 0.14, 0.08]],
  boss: [[110, 0.16], [82, 0.2, 0.1]],
  victory: [[420, 0.1], [560, 0.13, 0.08]],
  bossVictory: [[420, 0.12], [560, 0.14, 0.1], [700, 0.18, 0.2]],
  loot: [[490, 0.09], [660, 0.12, 0.08]],
  heal: [[360, 0.11], [490, 0.16, 0.09]],
  trap: [[145, 0.12]],
  rune: [[530, 0.11], [700, 0.16, 0.1]],
  merchant: [[310, 0.1], [390, 0.12, 0.08]],
  purchase: [[420, 0.08], [560, 0.12, 0.07]],
  descend: [[220, 0.1], [165, 0.14, 0.09]],
  levelUp: [[440, 0.1], [554, 0.12, 0.09], [659, 0.2, 0.18]],
  gameOver: [[165, 0.16], [110, 0.22, 0.12]],
  toggle: [[330, 0.1]],
};

function playSound(effectName) {
  if (!soundEnabled) return;
  try {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) throw new Error("Web Audio API не поддерживается этим браузером.");
    audioContext ||= new AudioContextConstructor();
    const play = () => {
      const startTime = audioContext.currentTime;
      for (const [frequency, duration, delay = 0] of SOUND_EFFECTS[effectName] || []) {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const noteStart = startTime + delay;
        oscillator.frequency.value = frequency;
        oscillator.type = "sine";
        gain.gain.setValueAtTime(0.035, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + duration);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(noteStart);
        oscillator.stop(noteStart + duration);
      }
    };
    if (audioContext.state === "suspended") {
      audioContext.resume().then(play).catch((error) => {
        console.warn("Не удалось запустить звуковой эффект.", error);
      });
      return;
    }
    play();
  } catch (error) {
    console.warn("Звуковой эффект недоступен.", error);
  }
}

function renderSoundToggle() {
  const button = $("sound-toggle");
  button.setAttribute("aria-pressed", String(soundEnabled));
  button.setAttribute("aria-label", soundEnabled ? "Выключить звук" : "Включить звук");
  button.title = soundEnabled ? "Звук включён" : "Звук выключен";
  $("sound-toggle-label").textContent = soundEnabled ? "Звук: вкл." : "Звук: выкл.";
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
  const option = event.target.closest("button[data-class-node-id]");
  if (option) chooseSubclass(option.dataset.classNodeId);
});
ui.explore.addEventListener("click", explore);
ui.eventActions.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-event-action]");
  if (button) resolveDungeonEvent(button.dataset.eventAction);
});
ui.abilityButton.addEventListener("click", useClassAbility);
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
$("meta-upgrades").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-upgrade]");
  if (button) buyMetaUpgrade(button.dataset.upgrade);
});
$("sound-toggle").addEventListener("click", (event) => {
  soundEnabled = !soundEnabled;
  renderSoundToggle();
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, String(soundEnabled));
  } catch (error) {
    console.warn("Не удалось сохранить настройку звука.", error);
  }
  if (soundEnabled) playSound("toggle");
});

renderSoundToggle();
render();
window.WellCloudSave.initialize({
  readLocal: readLocalCloudSave,
  validateRun: isValidRun,
  defaultMeta: createMetaProgress,
  validateMeta: isValidMetaProgress,
  mergeMeta: mergeMetaProgress,
  refresh: render,
  restore: restoreCloudSave,
});
