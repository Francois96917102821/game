"use strict";

const MAX_ROOMS = 6;
const XP_PER_LEVEL = 20;
const SAVE_KEY = "well-of-whispers-best-floor";
const RUN_SAVE_KEY = "well-of-whispers-active-run";
const META_SAVE_KEY = "well-of-whispers-camp-progress";
const SAVE_VERSION = 1;
const CLOUD_SNAPSHOT_VERSION = 1;
const TAVERN_DB_NAME = "well-of-whispers-tavern";
const TAVERN_DB_VERSION = 1;
const TAVERN_STORE_NAME = "progress";
const TAVERN_DB_KEY = "player";
const POTION_LIMIT = 4;
const MAX_FOCUS = 3;
const HEAVY_ATTACK_COST = 2;
const MAX_GEAR = 6;
const SOUND_PREFERENCE_KEY = "well-of-whispers-sound-enabled";
const PROFILE_SETTINGS_KEY = "well-of-whispers-profile-settings";
const ELITE_TRAITS = {
  curse: "Проклинающий", ghost: "Призрачный", warlike: "Воинственный",
  experienced: "Опытный", punisher: "Карающий", wounded: "Раненый",
  protected: "Защищённый", piercing: "Пробивающий",
};
const DUNGEON_TROPHIES = {
  courage: "Доказательство отваги", valor: "Скрижаль доблести",
  admBlood: "Кровь адмов", elite: "Элитный трофей",
  keeperKey: "Ключ хранителя", keeperHeart: "Сердце хранителя",
  rawFish: "Сырая рыба", shell: "Ракушка", fishEye: "Рыбий глаз",
  fishFat: "Рыбий жир", fishScale: "Рыбья чешуя",
  wealth: "Манускрипт богатства", blood: "Манускрипт крови",
  knowledge: "Манускрипт знаний", fate: "Камень судьбы",
  statPotion: "Зелье характеристик",
};
const META_UPGRADES = {
  vitality: { name: "Крепкое сердце", description: "+3 здоровья в новом забеге", costs: [2, 4, 6] },
  power: { name: "Точная рука", description: "+1 к силе удара в новом забеге", costs: [2, 4, 6] },
  supplies: { name: "Запас зелий", description: "+1 зелье в начале нового забега", costs: [2, 4, 6] },
};
const HOME_RESOURCE_NAMES = {
  logs: "брёвен",
  stone: "камня",
  ore: "руды",
  flax: "льна",
  boards: "досок",
  blocks: "блоков",
  ingots: "слитков",
  cloth: "ткани",
  seeds: "семян",
  herbs: "растений",
  fish: "рыбы",
  bait: "приманки",
};
const SECRET_LORE = [
  { id: "well", title: "Голос у колодца", text: "Колодец не зовёт путников. Он повторяет последнее обещание того, кто исчез внизу." },
  { id: "drowned", title: "Затонувший колокол", text: "Город ушёл под воду, когда его жители позвонили в колокол, чтобы разбудить море." },
  { id: "roots", title: "Память корней", text: "Подземное дерево помнит имена тех, кто укрылся под его корнями, и тех, кто их предал." },
  { id: "forge", title: "Последняя ковка", text: "Пепельный король выковал ключ от выхода, но спрятал его в собственном имени." },
];
const CLASS_UNLOCK_LEVELS = { advanced: 3, mastery: 9 };
const LEGACY_SUBCLASS_LEVELS = [3, 6, 9];
const MERCHANT_PRICES = { potion: 12, weapon: 18, armor: 24, healing: 8, fireSoul: 50 };
const CITY_DISTRICTS = {
  main: {
    title: "Основной район",
    kicker: "СЕРДЦЕ ГОРОДА",
    description: "Здесь путники готовятся к спуску и выбирают свой дальнейший путь.",
    services: [
      { icon: "◉", name: "Колодец", description: "Спуск в подземелья. Продолжи сохранённый забег или начни новый.", status: "ready", statusLabel: "ДОСТУПНО", action: "well" },
      { icon: "⌑", name: "Ворота", description: "Путь за город и путешествия по окрестностям.", status: "soon", statusLabel: "СКОРО" },
      {
        icon: "⚔",
        name: "Гильдия охотников",
        description: "Ежедневные задания, обмен трофеев на золото и репутацию, лавка за репутацию и расширение мешка. Сейчас здесь доступны только постоянные улучшения за осколки — в панели путника.",
        status: "partial",
        statusLabel: "ЧАСТИЧНО",
        action: "upgrades",
        actionLabel: "К улучшениям за осколки",
      },
      { icon: "✦", name: "Башня магов", description: "Временные зачарования, перераспределение характеристик и дополнительные ячейки пассивных умений.", status: "soon", statusLabel: "СКОРО" },
      {
        icon: "ᛟ",
        name: "Орден глубин",
        description: "Классы, развитие владения оружием и доспехами и мастера за репутацию. Выбор классов уже действует: первый продвинутый класс на 3-м уровне открывает Верхний квартал.",
        status: "partial",
        statusLabel: "КЛАССЫ ДОСТУПНЫ",
        action: "classes",
        actionLabel: "Выбрать путь для нового спуска",
      },
    ],
  },
  port: {
    title: "Портовый квартал",
    kicker: "ОТКРЫТ ВСЕМ ПУТНИКАМ",
    description: "Пристанище у воды открыто сразу; таверна принимает путников, остальные службы отмечены отдельно.",
    services: [
      { icon: "♨", name: "Таверна", description: "Еда, временная работа, комнаты отдыха и игры на золото. Поиск игроков и гильдий пока недоступен.", status: "ready", statusLabel: "ДОСТУПНО", action: "tavern", actionLabel: "Войти в таверну" },
      { icon: "⚓", name: "Пристань", description: "Покупай билеты и отправляйся в сюжетные экспедиции на дальние острова.", status: "ready", statusLabel: "ЭКСПЕДИЦИИ", action: "harbor", actionLabel: "Открыть пристань" },
      { icon: "⚒", name: "Мастерская", description: "Место для творческих заказов и работ.", status: "soon", statusLabel: "СКОРО" },
      { icon: "◈", name: "Гильдия убийц", description: "Заказы на PvP-схватки с другими игроками.", status: "soon", statusLabel: "СКОРО" },
    ],
  },
  upper: {
    title: "Верхний квартал",
    kicker: "РАЙОН ДЛЯ ОПЫТНЫХ ИСКАТЕЛЕЙ",
    description: "Элитная часть города с ареной, домами и местами для самых известных героев.",
    services: [
      { icon: "⚔", name: "Арена", description: "PvP и элитные монстры для героев высокого уровня.", status: "soon", statusLabel: "СКОРО" },
      { icon: "⌂", name: "Домашняя лавка", description: "Покупка домов, участки, мастерские, пруд, сад и доступные комнаты.", status: "ready", statusLabel: "ДОСТУПНО", action: "homestead", actionLabel: "Магазин · Дома" },
      { icon: "▤", name: "Ратуша", description: "Гильдии, купоны и городские события.", status: "soon", statusLabel: "СКОРО" },
      { icon: "✧", name: "Аллея славы", description: "Статуи великих игроков и их истории.", status: "soon", statusLabel: "СКОРО" },
    ],
  },
};
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
  ["monty-0", "Дверь 1"], ["monty-1", "Дверь 2"], ["monty-2", "Дверь 3"],
  ["monty-stay", "Оставить выбор"], ["monty-switch", "Сменить дверь"],
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
    text: "Три одинаковые двери закрывают тупик. Только одна скрывает вещь. После выбора смотритель покажет пустую дверь.",
    actions: ["monty-0", "monty-1", "monty-2"],
  },
  {
    minFloor: 2, weight: 4, title: "СЛЕД ЗВЕРЯ", icon: "♧",
    text: "Свежие следы ведут к логову под корнями. Можно выследить зверя или выманить его добычу приманкой.",
    actions: ["hunt-track", "hunt-bait"],
  },
  {
    minFloor: 1, weight: 2, title: "БИТВА С ИГРОКОМ", icon: "◈",
    text: "В проходе слышны шаги. Вызови онлайн-напарника; без живого соперника состоится явно отмеченный бой с призраком, без денежных наград.",
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
  cityHub: $("city-hub"),
  citySummary: $("city-summary"),
  districtTabs: document.querySelector(".district-nav"),
  districtTitle: $("district-title"),
  districtKicker: $("district-kicker"),
  districtDescription: $("district-description"),
  districtLockNote: $("district-lock-note"),
  districtBackButton: $("district-back-button"),
  cityServices: $("city-services"),
  dungeonContent: $("dungeon-content"),
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
  buyFireSoul: $("buy-fire-soul-button"),
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
  harborDialog: $("harbor-dialog"),
  harborTickets: $("harbor-tickets"),
  harborEssence: $("harbor-essence"),
  harborStatus: $("harbor-status"),
  harborContent: $("harbor-content"),
  harborHistory: $("harbor-history"),
  homesteadDialog: $("homestead-dialog"),
  homesteadStatus: $("homestead-status"),
  homesteadWallet: $("homestead-wallet"),
  homesteadContent: $("homestead-content"),
  homesteadOpenButton: $("homestead-open-button"),
  tavernDialog: $("tavern-dialog"),
  tavernStatus: $("tavern-status"),
  tavernGold: $("tavern-gold"),
  tavernSatiety: $("tavern-satiety"),
  tavernSatietyBar: $("tavern-satiety-bar"),
  tavernInjuries: $("tavern-injuries"),
  tavernRecipes: $("tavern-recipes"),
  tavernStash: $("tavern-stash"),
  tavernActiveJob: $("tavern-active-job"),
  tavernGamePanel: $("tavern-game-panel"),
};

let state = createState();
let bestFloor = readBestFloor();
let savedRun = readSavedRun();
let localMetaReadable = true;
let localTavernPresent = false;
let metaProgress = readMetaProgress();
let tavernDialogBusy = false;
let tavernStorageReady = false;
let tavernStorageError = "";
let tavernWriteConflict = false;
let tavernMessage = "";
let pendingTavernState = null;
let pendingTavernRevision = null;
let selectedTavernTab = "food";
let harborMessage = "";
let homesteadMessage = "";
let homesteadBusy = false;
let homesteadAnchor = "";
let mailboxInbox = [];
let mailboxLoading = false;
let tavernSelectedGameId = null;
let selectedDiceToHold = [];
let tavernDatabasePromise = null;
let selectedClassId = "knight";
let selectedDistrict = "main";
let previousTownVisibility = false;
let audioContext = null;
let soundEnabled = readSoundPreference();
let profileSettings = readProfileSettings();

function readSoundPreference() {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) === "true";
  } catch (error) {
    console.warn("Не удалось прочитать настройку звука.", error);
    return false;
  }
}

function normalizeDisplayName(value) {
  if (typeof value !== "string") return "";
  return Array.from(value.trim().replace(/\s+/gu, " ")).slice(0, 24).join("");
}

function readProfileSettings() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(PROFILE_SETTINGS_KEY) || "null");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
      return { displayName: "Искатель", reducedMotion: false, highContrast: false };
    }
    return {
      displayName: normalizeDisplayName(stored.displayName) || "Искатель",
      reducedMotion: stored.reducedMotion === true,
      highContrast: stored.highContrast === true,
    };
  } catch (error) {
    console.warn("Не удалось прочитать профиль и настройки.", error);
    return { displayName: "Искатель", reducedMotion: false, highContrast: false };
  }
}

function applyProfileSettings() {
  document.body.dataset.reduceMotion = String(profileSettings.reducedMotion);
  document.body.dataset.highContrast = String(profileSettings.highContrast);
  $("settings-reduced-motion").checked = profileSettings.reducedMotion;
  $("settings-high-contrast").checked = profileSettings.highContrast;
}

function persistProfileSettings(nextSettings) {
  try {
    window.localStorage.setItem(PROFILE_SETTINGS_KEY, JSON.stringify(nextSettings));
  } catch (error) {
    console.warn("Не удалось сохранить профиль и настройки.", error);
    return false;
  }
  profileSettings = nextSettings;
  applyProfileSettings();
  $("player-name").textContent = profileSettings.displayName;
  return true;
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
    groupInboxReceipts: [],
    coopBattleReceipts: [],
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
    stance: "balanced",
    offhand: "shield",
    extraActionUsed: false,
    combatProgress: null,
    monty: null,
    ghostDuel: null,
    liveDuelId: null,
    guarding: false,
    abilityCooldown: 0,
    abilityGuarding: false,
    abilityDodge: false,
    focus: 0,
    equipment: { weapon: null, armor: null },
    elementalLoadout: [],
    inventory: [],
    gearSequence: 0,
    tavernGearIds: [],
    merchantAvailable: false,
    merchantSoulAvailable: false,
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

function createMetaProgress(now = Date.now()) {
  const tavern = window.WellTavernModel.createState(now);
  if (now === 0) tavern.satietyAt = Date.now();
  return {
    essence: 0,
    upgrades: { vitality: 0, power: 0, supplies: 0 },
    bossesDefeated: 0,
    secretsFound: [],
    groupInboxReceipts: [],
    tavern,
    orderReputation: 0,
    dungeonTrophies: {},
    dungeonVictories: [],
    runeDrops: [],
    runeUses: [],
    souls: window.WellSoulCraftingModel.createState(),
    elemental: window.WellElementalGearModel.createState(),
    harbor: window.WellExpeditionsModel.createState(),
    homestead: window.WellHomesteadModel.createState(now),
  };
}

function isValidInboxReceipts(receipts) {
  return receipts === undefined || (
    Array.isArray(receipts) && receipts.length <= 100000 &&
    receipts.every((id) => typeof id === "string" && /^\d{1,19}$/.test(id)) &&
    new Set(receipts).size === receipts.length
  );
}

function isValidRuneDropLedger(receipts) {
  if (!window.WellRuneModel.isValidReceipts(receipts, window.WellRuneModel.isValidDrop)) return false;
  const original = new Map(receipts.map((receipt) => [receipt.id, receipt]));
  const reconciled = window.WellRuneModel.mergeDrops(receipts, []);
  return reconciled.length === receipts.length && reconciled.every((receipt) => {
    const existing = original.get(receipt.id);
    return existing && existing.type === receipt.type &&
      existing.count === receipt.count && existing.level === receipt.level;
  });
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
    new Set(progress.secretsFound).size === progress.secretsFound.length &&
    isValidInboxReceipts(progress.groupInboxReceipts) &&
    (progress.souls === undefined || window.WellSoulCraftingModel.isValidState(progress.souls)) &&
    (progress.elemental === undefined || window.WellElementalGearModel.isValidState(progress.elemental)) &&
    (progress.orderReputation === undefined || isIntegerBetween(progress.orderReputation, 0, 1000000000)) &&
    (progress.dungeonTrophies === undefined || (
      progress.dungeonTrophies && typeof progress.dungeonTrophies === "object" &&
      !Array.isArray(progress.dungeonTrophies) &&
      Object.entries(progress.dungeonTrophies).every(([key, count]) =>
        Object.prototype.hasOwnProperty.call(DUNGEON_TROPHIES, key) && isIntegerBetween(count, 0, 1000000000))
    )) &&
    (progress.dungeonVictories === undefined || (
      Array.isArray(progress.dungeonVictories) && progress.dungeonVictories.length <= 100000 &&
      new Set(progress.dungeonVictories.map((receipt) => receipt?.id)).size === progress.dungeonVictories.length &&
      progress.dungeonVictories.every((receipt) => receipt && typeof receipt.id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(receipt.id) &&
        isIntegerBetween(receipt.reputation, 1, 100000) &&
        Array.isArray(receipt.trophies) && receipt.trophies.length <= 16 &&
        receipt.trophies.every((key) => Object.prototype.hasOwnProperty.call(DUNGEON_TROPHIES, key)))
    )) &&
    (progress.runeDrops === undefined || isValidRuneDropLedger(progress.runeDrops)) &&
    (progress.runeUses === undefined || window.WellRuneModel.isValidReceipts(progress.runeUses, window.WellRuneModel.isValidUse)) &&
    (progress.tavern === undefined || window.WellTavernModel.isValidState(progress.tavern)) &&
    (progress.harbor === undefined || window.WellExpeditionsModel.isValidState(progress.harbor)) &&
    (progress.homestead === undefined || window.WellHomesteadModel.isValidState(progress.homestead))
  );
}

function normalizeMetaProgress(progress) {
  const normalized = { ...createMetaProgress(0), ...(progress || {}) };
  normalized.tavern = progress?.tavern === undefined
    ? createMetaProgress(0).tavern
    : window.WellTavernModel.withDefaults(progress.tavern);
  normalized.harbor = window.WellExpeditionsModel.withDefaults(progress?.harbor);
  normalized.homestead = window.WellHomesteadModel.withDefaults(progress?.homestead);
  normalized.orderReputation = progress?.orderReputation ?? 0;
  normalized.souls = window.WellSoulCraftingModel.withDefaults(progress?.souls);
  normalized.elemental = window.WellElementalGearModel.withDefaults(progress?.elemental);
  normalized.dungeonTrophies = { ...(progress?.dungeonTrophies || {}) };
  normalized.dungeonVictories = (progress?.dungeonVictories || []).map((receipt) => ({
    ...receipt, trophies: [...receipt.trophies],
  }));
  normalized.runeDrops = (progress?.runeDrops || []).map((receipt) => ({ ...receipt }));
  normalized.runeUses = (progress?.runeUses || []).map((receipt) => ({ ...receipt }));
  return normalized;
}

function mergeSoulCraftedGear(tavernState, soulState) {
  const tavern = JSON.parse(JSON.stringify(tavernState));
  const usedGearIds = new Set(tavern.stash.map((item) => item.id));
  let addedGear = false;
  for (const transaction of soulState.transactions) {
    if (!transaction.gear) continue;
    const gear = transaction.gear;
    const existing = tavern.stash.find((item) => item.id === gear.id);
    if (existing && existing.type === gear.type && existing.name === gear.name &&
      existing.bonus === gear.bonus) continue;
    if (existing) {
      do {
        tavern.nextGearSequence += 1;
        gear.id = `gear-${tavern.nextGearSequence}`;
      } while (usedGearIds.has(gear.id));
    }
    if (tavern.stash.length >= 10000) continue;
    tavern.stash.push({ ...gear });
    usedGearIds.add(gear.id);
    tavern.nextGearSequence = Math.max(tavern.nextGearSequence, Number(gear.id.slice(5)));
    addedGear = true;
  }
  if (addedGear) {
    tavern.revision = Math.min(1000000000, tavern.revision + 1);
    tavern.updatedAt = Date.now();
  }
  return tavern;
}

function readMetaProgress() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(META_SAVE_KEY) || "null");
    if (stored === null) return createMetaProgress();
    if (isValidMetaProgress(stored)) {
      localTavernPresent = stored.tavern !== undefined;
      return normalizeMetaProgress(stored);
    }
    localMetaReadable = false;
    console.warn("Сохранение лагеря несовместимо; использованы безопасные значения по умолчанию.");
  } catch (error) {
    localMetaReadable = false;
    console.warn("Не удалось прочитать развитие лагеря.", error);
  }
  return createMetaProgress();
}

function mergeMetaProgress(left, right) {
  const first = normalizeMetaProgress(isValidMetaProgress(left) ? left : createMetaProgress(0));
  const second = normalizeMetaProgress(isValidMetaProgress(right) ? right : createMetaProgress(0));
  const elemental = window.WellElementalGearModel.merge(first.elemental, second.elemental);
  const victoryById = new Map();
  for (const receipt of [...first.dungeonVictories, ...second.dungeonVictories]) {
    const existing = victoryById.get(receipt.id);
    if (!existing || JSON.stringify(receipt) < JSON.stringify(existing)) victoryById.set(receipt.id, receipt);
  }
  const dungeonVictories = [...victoryById.values()].sort((a, b) => a.id.localeCompare(b.id));
  const reputationSum = (receipts) => receipts.reduce((sum, receipt) => sum + receipt.reputation, 0);
  const runeDrops = window.WellRuneModel.mergeDrops(first.runeDrops, second.runeDrops);
  const runeUseCost = (receipts) => receipts.reduce((sum, receipt) => sum + receipt.cost, 0);
  const reputationBase = Math.max(
    0,
    first.orderReputation - reputationSum(first.dungeonVictories) + runeUseCost(first.runeUses),
    second.orderReputation - reputationSum(second.dungeonVictories) + runeUseCost(second.runeUses),
  );
  const runeProgress = window.WellRuneModel.mergeUses(
    first.runeUses,
    second.runeUses,
    runeDrops,
    Math.min(1000000000, reputationBase + reputationSum(dungeonVictories)),
  );
  const orderReputation = runeProgress.reputation;
  const trophySum = (receipts, key) => receipts.reduce((sum, receipt) =>
    sum + receipt.trophies.filter((trophy) => trophy === key).length, 0);
  const dungeonTrophies = Object.fromEntries(Object.keys(DUNGEON_TROPHIES).map((key) => [
    key, Math.min(1000000000, Math.max(
      0, (first.dungeonTrophies[key] || 0) - trophySum(first.dungeonVictories, key),
      (second.dungeonTrophies[key] || 0) - trophySum(second.dungeonVictories, key),
    ) + trophySum(dungeonVictories, key)),
  ]));
  const useSecondTavern = second.tavern.updatedAt > first.tavern.updatedAt ||
    (second.tavern.updatedAt === first.tavern.updatedAt && second.tavern.revision >= first.tavern.revision)
  const tavernSource = useSecondTavern ? second : first;
  const tavern = window.WellTavernModel.reconcileFood(tavernSource.tavern,
    (useSecondTavern ? first : second).tavern);
  const harbor = window.WellExpeditionsModel.merge(first.harbor, second.harbor);
  const homestead = window.WellHomesteadModel.merge(first.homestead, second.homestead);
  const mailGearByMailId = new Map();
  for (const source of [first, second]) {
    for (const receipt of source.homestead.mailReceipts) {
      const gear = source.tavern.stash.find((item) => item.id === receipt.gearId);
      if (gear && !mailGearByMailId.has(receipt.mailId)) {
        mailGearByMailId.set(receipt.mailId, { receipt, gear });
      }
    }
  }
  const mergedMailReceipts = [];
  const usedGearIds = new Set(tavern.stash.map((item) => item.id));
  for (const receipt of homestead.mailReceipts) {
    const delivered = mailGearByMailId.get(receipt.mailId);
    if (!delivered) continue;
    const existing = tavern.stash.find((item) => item.id === receipt.gearId);
    if (!existing && tavern.stash.length >= 10000) continue;
    let gearId = receipt.gearId;
    if (existing && (existing.type !== delivered.gear.type ||
      existing.name !== delivered.gear.name || existing.bonus !== delivered.gear.bonus)) {
      do {
        tavern.nextGearSequence += 1;
        gearId = `gear-${tavern.nextGearSequence}`;
      } while (usedGearIds.has(gearId));
    }
    if (!usedGearIds.has(gearId)) {
      tavern.stash.push({ ...delivered.gear, id: gearId });
      usedGearIds.add(gearId);
    }
    mergedMailReceipts.push({ mailId: receipt.mailId, gearId });
  }
  homestead.mailReceipts = mergedMailReceipts;
  tavern.nextGearSequence = Math.max(tavern.nextGearSequence,
    ...tavern.stash.map((item) => Number(item.id.slice(5))));
  const souls = window.WellSoulCraftingModel.merge(first.souls, second.souls);
  const firstTicketReceipts = new Set(first.harbor.ticketPurchases.map((receipt) => receipt.id));
  const secondTicketReceipts = new Set(second.harbor.ticketPurchases.map((receipt) => receipt.id));
  const missingDebits = (sourceReceipts, otherHarbor) => otherHarbor.ticketPurchases
    .filter((receipt) => !sourceReceipts.has(receipt.id))
    .reduce((total, receipt) => total + receipt.essenceCost, 0);
  const firstHomesteadReceipts = new Set(first.homestead.receipts.map((receipt) => receipt.id));
  const secondHomesteadReceipts = new Set(second.homestead.receipts.map((receipt) => receipt.id));
  const missingHomesteadDebits = (sourceReceipts, otherHomestead, currency) => otherHomestead.receipts
    .filter((receipt) => !sourceReceipts.has(receipt.id))
    .reduce((total, receipt) => total + receipt[`${currency}Cost`], 0);
  const tavernSourceReceipts = useSecondTavern ? secondHomesteadReceipts : firstHomesteadReceipts;
  const otherHomestead = useSecondTavern ? first.homestead : second.homestead;
  tavern.gold = Math.max(0, tavern.gold -
    missingHomesteadDebits(tavernSourceReceipts, otherHomestead, "gold"));
  const mergedSoulGearTavern = mergeSoulCraftedGear(tavern, souls);
  const essenceAfterHomePurchases = (source, other, sourceReceipts) =>
    source.essence - missingHomesteadDebits(sourceReceipts, other.homestead, "essence");
  return {
    essence: Math.max(
      0,
      essenceAfterHomePurchases(first, second, firstHomesteadReceipts) -
        missingDebits(firstTicketReceipts, second.harbor),
      essenceAfterHomePurchases(second, first, secondHomesteadReceipts) -
        missingDebits(secondTicketReceipts, first.harbor),
    ),
    upgrades: Object.fromEntries(Object.keys(META_UPGRADES).map((id) => [
      id,
      Math.max(first.upgrades[id], second.upgrades[id]),
    ])),
    bossesDefeated: Math.max(first.bossesDefeated, second.bossesDefeated),
    orderReputation,
    dungeonTrophies,
    dungeonVictories,
    runeDrops,
    runeUses: runeProgress.uses,
    secretsFound: [...new Set([...first.secretsFound, ...second.secretsFound])],
    groupInboxReceipts: [...new Set([
      ...(first.groupInboxReceipts || []),
      ...(second.groupInboxReceipts || []),
    ])],
    souls,
    elemental,
    tavern: mergedSoulGearTavern,
    harbor,
    homestead,
  };
}

function persistMetaProgress() {
  let persisted = false;
  try {
    const stored = JSON.parse(window.localStorage.getItem(META_SAVE_KEY) || "null");
    if (stored !== null && isValidMetaProgress(stored)) {
      const local = normalizeMetaProgress(stored);
      const dungeonMerged = mergeMetaProgress(metaProgress, local);
      const foodTavern = window.WellTavernModel.reconcileFood(metaProgress.tavern, local.tavern);
      const reconciledTavern = { ...foodTavern, gold: dungeonMerged.tavern.gold };
      const soulGearTavern = mergeSoulCraftedGear(reconciledTavern, dungeonMerged.souls);
      metaProgress = {
        ...metaProgress,
        essence: dungeonMerged.essence,
        tavern: soulGearTavern,
        homestead: window.WellHomesteadModel.merge(metaProgress.homestead, local.homestead),
        orderReputation: dungeonMerged.orderReputation,
        dungeonTrophies: dungeonMerged.dungeonTrophies,
        dungeonVictories: dungeonMerged.dungeonVictories,
        runeDrops: dungeonMerged.runeDrops,
        runeUses: dungeonMerged.runeUses,
        souls: dungeonMerged.souls,
        elemental: dungeonMerged.elemental,
      };
    }
    window.localStorage.setItem(META_SAVE_KEY, JSON.stringify(metaProgress));
    persisted = true;
  } catch (error) {
    console.warn("Не удалось сохранить развитие лагеря.", error);
  }
  persistTavernToIndexedDb(metaProgress.tavern).catch((error) => {
    console.warn("Не удалось создать резервную копию таверны в браузере.", error);
  });
  if (persisted && window.WellCloudSave) window.WellCloudSave.scheduleSave(getCloudSaveSnapshot());
  return persisted;
}

function openTavernDatabase() {
  if (!window.indexedDB) return Promise.reject(new Error("IndexedDB недоступна."));
  if (tavernDatabasePromise) return tavernDatabasePromise;
  tavernDatabasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(TAVERN_DB_NAME, TAVERN_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(TAVERN_STORE_NAME)) {
        request.result.createObjectStore(TAVERN_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Не удалось открыть IndexedDB."));
    request.onblocked = () => reject(new Error("Открытие резервного хранилища заблокировано другой вкладкой."));
  });
  return tavernDatabasePromise;
}

async function persistTavernToIndexedDb(tavern) {
  if (!window.WellTavernModel.isValidState(tavern)) throw new Error("Состояние таверны не прошло проверку.");
  const database = await openTavernDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(TAVERN_STORE_NAME, "readwrite");
    const store = transaction.objectStore(TAVERN_STORE_NAME);
    const request = store.get(TAVERN_DB_KEY);
    request.onsuccess = () => {
      const existing = request.result;
      if (!existing || existing.revision <= tavern.revision) {
        store.put(JSON.parse(JSON.stringify(tavern)), TAVERN_DB_KEY);
      }
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Не удалось записать резервное хранилище."));
    transaction.onabort = () => reject(transaction.error || new Error("Запись резервного хранилища отменена."));
  });
}

async function commitTavernToIndexedDb(tavern, expectedRevision) {
  const database = await openTavernDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction(TAVERN_STORE_NAME, "readwrite");
    const store = transaction.objectStore(TAVERN_STORE_NAME);
    const request = store.get(TAVERN_DB_KEY);
    let conflict = false;
    request.onsuccess = () => {
      const current = request.result;
      if (current && current.revision !== expectedRevision) {
        conflict = true;
        transaction.abort();
        return;
      }
      store.put(JSON.parse(JSON.stringify(tavern)), TAVERN_DB_KEY);
    };
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error("Не удалось записать резервное хранилище."));
    transaction.onabort = () => {
      const error = conflict
        ? new Error("Таверна изменилась в другой вкладке. Обнови страницу перед следующим действием.")
        : transaction.error || new Error("Запись резервного хранилища отменена.");
      if (conflict) error.code = "TAVERN_REVISION_CONFLICT";
      reject(error);
    };
  });
}

async function readTavernFromIndexedDb() {
  const database = await openTavernDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(TAVERN_STORE_NAME, "readonly");
    const request = transaction.objectStore(TAVERN_STORE_NAME).get(TAVERN_DB_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Не удалось прочитать резервное хранилище."));
  });
}

async function commitTavernProgress(nextTavern) {
  const expectedRevision = metaProgress.tavern.revision;
  const committedTavern = JSON.parse(JSON.stringify(nextTavern));
  committedTavern.revision = expectedRevision + 1;
  committedTavern.updatedAt = Date.now();
  if (!window.WellTavernModel.isValidState(committedTavern)) {
    throw new Error("Состояние таверны не прошло проверку и не было сохранено.");
  }
  let nextMeta = { ...metaProgress, tavern: committedTavern };
  let localSaved = false;
  let indexedDbSaved = false;
  tavernWriteConflict = false;
  try {
    await commitTavernToIndexedDb(committedTavern, expectedRevision);
    indexedDbSaved = true;
  } catch (error) {
    if (error.code === "TAVERN_REVISION_CONFLICT") {
      tavernWriteConflict = true;
      try {
        const latest = await readTavernFromIndexedDb();
        if (window.WellTavernModel.isValidState(latest)) {
          metaProgress.tavern = latest;
          try {
            window.localStorage.setItem(META_SAVE_KEY, JSON.stringify(metaProgress));
          } catch (storageError) {
            console.warn("Не удалось синхронизировать основное сохранение после конфликта.", storageError);
          }
        }
      } catch (readError) {
        console.warn("Не удалось восстановить актуальное состояние после конфликта таверны.", readError);
      }
      tavernStorageError = error.message;
      renderTavern();
      return false;
    }
    console.warn("Резерв IndexedDB не принял запись; проверяю основное хранилище.", error);
  }
  try {
    const stored = JSON.parse(window.localStorage.getItem(META_SAVE_KEY) || "null");
    if (stored !== null && isValidMetaProgress(stored)) nextMeta = mergeMetaProgress(nextMeta, stored);
    window.localStorage.setItem(META_SAVE_KEY, JSON.stringify(nextMeta));
    localSaved = true;
  } catch (error) {
    console.warn("Основное хранилище заблокировано; сохраняю таверну в резерв.", error);
  }
  if (!localSaved && !indexedDbSaved) {
    tavernStorageError = "Не удалось сохранить изменения. Разреши хранилище браузера и повтори действие; награда не применена.";
    renderTavern();
    return false;
  }
  metaProgress = nextMeta;
  tavernStorageError = "";
  if (window.WellCloudSave) window.WellCloudSave.scheduleSave(getCloudSaveSnapshot());
  renderTavern();
  return true;
}

async function initializeTavernPersistence() {
  try {
    const backup = await readTavernFromIndexedDb();
    if (window.WellTavernModel.isValidState(backup) &&
      (!localMetaReadable || !localTavernPresent || backup.updatedAt > metaProgress.tavern.updatedAt ||
        (backup.updatedAt === metaProgress.tavern.updatedAt && backup.revision > metaProgress.tavern.revision))) {
      metaProgress.tavern = backup;
      try {
        window.localStorage.setItem(META_SAVE_KEY, JSON.stringify(metaProgress));
        localMetaReadable = true;
        localTavernPresent = true;
      } catch (error) {
        console.warn("Резерв таверны загружен; основное хранилище недоступно.", error);
      }
    } else if (window.WellTavernModel.isValidState(metaProgress.tavern)) {
      await persistTavernToIndexedDb(metaProgress.tavern);
    }
  } catch (error) {
    tavernStorageError = localMetaReadable
      ? ""
      : "Локальное хранилище недоступно и резерв IndexedDB не открылся. Действия с наградами временно заблокированы.";
    console.warn("Не удалось восстановить резерв таверны.", error);
  }
  tavernStorageReady = true;
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
    !isValidInboxReceipts(saved.groupInboxReceipts) ||
    (saved.coopBattleReceipts !== undefined && (
      !Array.isArray(saved.coopBattleReceipts) || saved.coopBattleReceipts.length > 100000 ||
      !saved.coopBattleReceipts.every((id) => typeof id === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) ||
      new Set(saved.coopBattleReceipts).size !== saved.coopBattleReceipts.length
    )) ||
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
    (saved.stance !== undefined && !["balanced", "defensive", "offensive"].includes(saved.stance)) ||
    (saved.offhand !== undefined && !["shield", "torch", "staff"].includes(saved.offhand)) ||
    (saved.extraActionUsed !== undefined && typeof saved.extraActionUsed !== "boolean") ||
    (saved.combatProgress != null && !window.DungeonModel.isValidFighter(saved.combatProgress)) ||
    (saved.elementalLoadout !== undefined &&
      !window.WellElementalGearModel.isValidLoadout(saved.elementalLoadout)) ||
    (saved.liveDuelId != null && (typeof saved.liveDuelId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.liveDuelId))) ||
    (saved.ghostDuel != null && (
      !window.DungeonModel.isValidFighter(saved.ghostDuel.player) ||
      !window.DungeonModel.isValidFighter(saved.ghostDuel.ghost) ||
      !Number.isFinite(saved.ghostDuel.deadline) ||
      !isIntegerBetween(saved.ghostDuel.round, 1, 1000000) ||
      saved.enemy != null || saved.liveDuelId != null
    )) ||
    (saved.monty != null && (
      !isIntegerBetween(saved.monty.prizeDoor, 0, 2) ||
      !(saved.monty.selected === null || isIntegerBetween(saved.monty.selected, 0, 2)) ||
      !(saved.monty.revealed === null || (
        isIntegerBetween(saved.monty.revealed, 0, 2) &&
        saved.monty.revealed !== saved.monty.selected && saved.monty.revealed !== saved.monty.prizeDoor
      ))
    )) ||
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
    (saved.tavernGearIds !== undefined && (
      !Array.isArray(saved.tavernGearIds) || saved.tavernGearIds.length > MAX_GEAR ||
      !saved.tavernGearIds.every((id) => typeof id === "string" && /^gear-\d+$/.test(id)) ||
      new Set(saved.tavernGearIds).size !== saved.tavernGearIds.length
    )) ||
    typeof saved.waitingToDescend !== "boolean" ||
    (saved.merchantAvailable !== undefined && typeof saved.merchantAvailable !== "boolean") ||
    (saved.merchantSoulAvailable !== undefined && typeof saved.merchantSoulAvailable !== "boolean") ||
    (saved.merchantSoulAvailable === true &&
      (!saved.merchantAvailable || saved.level < window.WellSoulCraftingModel.DROP_LEVEL)) ||
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
      (saved.enemy.elite === true && saved.enemy.boss) ||
      (saved.enemy.special != null && !["keeper", "mimic", "water", "worldeater", "captain"].includes(saved.enemy.special)) ||
      (saved.enemy.runeReceiptId !== undefined && (typeof saved.enemy.runeReceiptId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.enemy.runeReceiptId))) ||
      (saved.enemy.trait !== undefined && !Object.prototype.hasOwnProperty.call(ELITE_TRAITS, saved.enemy.trait)) ||
      (saved.enemy.fighter != null && !window.DungeonModel.isValidFighter(saved.enemy.fighter)) ||
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
      Array.isArray(saved.event.actions) && saved.event.actions.length <= 3 &&
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

function isValidSoulMailItem(item) {
  return Boolean(
    item && typeof item === "object" && item.type === "soul" &&
    Object.hasOwn(window.WellSoulCraftingModel.SOULS, item.soul) &&
    item.name === window.WellSoulCraftingModel.SOULS[item.soul].name &&
    item.amount === 1 &&
    typeof item.id === "string" &&
    new RegExp(`^soul-${item.soul}-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, "i").test(item.id),
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
  let runSaved = true;
  if (state.started) {
    try {
      if (state.gameOver) {
        window.localStorage.removeItem(RUN_SAVE_KEY);
      } else {
        window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state }));
      }
    } catch (error) {
      runSaved = false;
      console.warn("Не удалось автоматически сохранить спуск.", error);
    }
  }
  if (runSaved && state.started && state.tavernGearIds?.length) {
    const usedGear = new Set(state.tavernGearIds);
    const tavern = metaProgress.tavern;
    const stash = tavern.stash.filter((item) => !usedGear.has(item.id));
    if (stash.length !== tavern.stash.length) {
      tavern.stash = stash;
      if (usedGear.has(tavern.preparedGearId)) tavern.preparedGearId = null;
      tavern.revision += 1;
      tavern.updatedAt = Date.now();
      persistMetaProgress();
    }
  }
  if (window.WellCloudSave) window.WellCloudSave.scheduleSave(getCloudSaveSnapshot());
  return runSaved;
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
  persistTavernToIndexedDb(metaProgress.tavern).catch((error) => {
    console.warn("Не удалось восстановить резерв таверны из облачной копии.", error);
  });
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
  try {
    const raw = window.localStorage.getItem(RUN_SAVE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!isValidRun(parsed)) throw new Error("Локальное сохранение не прошло проверку и оставлено без изменений.");
      run = parsed;
    }
  } catch (error) {
    console.warn("Не удалось прочитать локальный забег для облачной синхронизации.", error);
    if (state.started && !state.gameOver) run = { version: SAVE_VERSION, state: JSON.parse(JSON.stringify(state)) };
    else if (savedRun && isValidRun({ version: SAVE_VERSION, state: savedRun })) {
      run = { version: SAVE_VERSION, state: JSON.parse(JSON.stringify(savedRun)) };
    }
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
  state.journal.unshift({ title, text: text.slice(0, 300), symbol, floor: state.floor });
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

function getRuneStat(type) {
  return window.WellRuneModel.stats(metaProgress.runeUses)[type] || 0;
}

function getRuneLevel() {
  return Math.max(state.level, metaProgress.tavern.characterLevel, 1);
}

function canUseEnhancementRunes() {
  const coopBattle = window.WellPlayerGroups?.getBattle();
  return (!state.started || state.gameOver) && !state.enemy && !dungeonDuelLocked() &&
    !(coopBattle && ["waiting", "active"].includes(coopBattle.status));
}

function useEnhancementRune(type) {
  if (!canUseEnhancementRunes()) return;
  if (!window.WellRuneModel.validType(type)) return;
  const rune = window.WellRuneModel.RUNES[type];
  if (metaProgress.runeUses.length >= 100000) {
    setEvent("РУНА НЕ ИСПОЛЬЗОВАНА", "Журнал применения рун достиг предела; состояние не изменено.", "ᛟ", "НЕДОСТУПНО");
    render();
    return;
  }
  const owned = window.WellRuneModel.inventory(metaProgress.runeDrops, metaProgress.runeUses)[type];
  if (owned < 1 || metaProgress.orderReputation < rune.price) {
    setEvent("РУНА НЕ ИСПОЛЬЗОВАНА", owned < 1
      ? `В запасе нет руны «${rune.name}».`
      : `Не хватает репутации: требуется ${rune.price}.`, "ᛟ", "НЕДОСТУПНО");
    render();
    return;
  }
  const previous = JSON.parse(JSON.stringify(metaProgress));
  const receipt = { id: window.crypto.randomUUID(), type, cost: rune.price };
  metaProgress.orderReputation -= rune.price;
  metaProgress.runeUses.push(receipt);
  if (!persistMetaProgress()) {
    metaProgress = previous;
    setEvent("РУНА НЕ ИСПОЛЬЗОВАНА", "Не удалось сохранить покупку и усиление; состояние не изменено.", "ᛟ", "ОШИБКА СОХРАНЕНИЯ");
    render();
    return;
  }
  if (!metaProgress.runeUses.some((item) => item.id === receipt.id)) {
    setEvent("РУНА НЕ ИСПОЛЬЗОВАНА",
      "В сохранении не хватило репутации или запаса руны после объединения. Баланс и характеристики не изменены.",
      "ᛟ", "СОХРАНЕНИЕ ОБЪЕДИНЕНО");
    render();
    return;
  }
  setEvent("РУНА ИСПОЛЬЗОВАНА", `Руна «${rune.name}» навсегда усилила характеристику: ${rune.effect}. Потрачено ${rune.price} репутации ордена.`, "ᛟ", "УСИЛЕНИЕ");
  addJournal("Использована руна усиления", `«${rune.name}»: ${rune.effect}. Потрачено ${rune.price} репутации.`, "ᛟ");
  playSound("purchase");
  render();
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
  $("order-reputation").textContent = String(metaProgress.orderReputation);
  $("dungeon-trophies").textContent = Object.entries(metaProgress.dungeonTrophies)
    .filter(([, count]) => count > 0)
    .map(([key, count]) => `${DUNGEON_TROPHIES[key]}: ${count}`).join(" · ") || "Трофеев пока нет.";
  renderRunes();
}

function renderRunes() {
  const list = $("rune-list");
  const found = window.WellRuneModel.counts(metaProgress.runeDrops);
  const owned = window.WellRuneModel.inventory(metaProgress.runeDrops, metaProgress.runeUses);
  const stats = window.WellRuneModel.stats(metaProgress.runeUses);
  const level = getRuneLevel();
  const campAvailable = canUseEnhancementRunes();
  list.className = "rune-list";
  list.replaceChildren();
  for (const [type, rune] of Object.entries(window.WellRuneModel.RUNES)) {
    const row = document.createElement("div");
    row.className = "rune-entry";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${rune.name} · ${found[type]}/${Math.max(found[type], rune.cap(level))}`;
    const description = document.createElement("span");
    description.textContent = `Запас: ${owned[type]} · использовано: ${stats[type]} · ${rune.effect}`;
    details.append(title, description);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "meta-buy-button";
    button.dataset.runeType = type;
    button.textContent = owned[type] ? `Использовать · ${rune.price}` : `Нет руны · ${rune.price}`;
    button.disabled = !campAvailable || owned[type] < 1 || metaProgress.orderReputation < rune.price;
    button.title = button.disabled
      ? !campAvailable ? "Руны можно использовать только в лагере, вне забега и боя."
        : owned[type] < 1 ? "Сначала найди эту руну в PvE." : "Недостаточно репутации ордена."
      : "Потратить одну руну и репутацию, навсегда повысив характеристику.";
    row.append(details, button);
    list.append(row);
  }
}

function advanceQuest(questId) {
  const definition = RUN_QUESTS.find((quest) => quest.id === questId);
  const progress = state.quests.find((quest) => quest.id === questId);
  if (!definition || !progress || progress.completed) return;
  progress.progress = Math.min(definition.target, progress.progress + 1);
  if (progress.progress < definition.target) return;
  progress.completed = true;
  addGold(definition.reward);
  const rewardMessage = `Задание «${definition.title}» выполнено. Награда: ${definition.reward} монет.`;
  setEvent("ЗАДАНИЕ ВЫПОЛНЕНО", rewardMessage, definition.icon, `+${definition.reward} МОНЕТ`);
  addJournal("Награда за задание", rewardMessage, definition.icon);
}

function setEvent(kicker, text, icon, tag, actions = []) {
  state.event = { kicker, text: text.slice(0, 300), icon, tag: tag || `ЭТАЖ ${state.floor}`, actions };
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
  state.elementalLoadout = window.WellElementalGearModel.equipped(metaProgress.elemental);
  state.gearSequence = metaProgress.tavern.nextGearSequence;
  state.tavernGearIds = [];
  const preparedGear = metaProgress.tavern.stash.find((item) => item.id === metaProgress.tavern.preparedGearId);
  if (preparedGear) {
    state.equipment[preparedGear.type] = JSON.parse(JSON.stringify(preparedGear));
    state.tavernGearIds.push(preparedGear.id);
  }
  state.quests = createRunQuests();
  state.runBossesDefeated = 0;
  state.runRewardClaimed = false;
  state.secretFragments = [];
  state.maxHp = Math.max(
    1,
    characterClass.maxHp + getUpgradeLevel("vitality") * 3 +
      metaProgress.tavern.bonuses.maxHp - metaProgress.tavern.injuries * 2,
  );
  state.hp = state.maxHp;
  state.attack = randomInt(5, 8) + characterClass.attack - 5 +
    getUpgradeLevel("power") + metaProgress.tavern.bonuses.attack;
  metaProgress.tavern.characterLevel = 1;
  metaProgress.tavern.revision += 1;
  metaProgress.tavern.updatedAt = Date.now();
  persistMetaProgress();
  $("player-name").textContent = profileSettings.displayName;
  $("player-subtitle").textContent = `${characterClass.name} · ${characterClass.role}`;
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
  if (state.groupInboxReceipts === undefined) state.groupInboxReceipts = [];
  if (state.coopBattleReceipts === undefined) state.coopBattleReceipts = [];
  if (state.stance === undefined) state.stance = "balanced";
  if (state.offhand === undefined) state.offhand = "shield";
  if (state.extraActionUsed === undefined) state.extraActionUsed = false;
  if (state.combatProgress === undefined) state.combatProgress = null;
  if (state.monty === undefined) state.monty = null;
  if (state.ghostDuel === undefined) state.ghostDuel = null;
  if (state.liveDuelId === undefined) state.liveDuelId = null;
  if (migratedClass && state.level >= CLASS_UNLOCK_LEVELS.advanced) state.pendingClassLevels = [CLASS_UNLOCK_LEVELS.advanced];
  selectedClassId = state.classId;
  savedRun = null;
  render();
  playSound("start");
}

function explore() {
  if (!state.started || state.enemy || dungeonDuelLocked() || state.gameOver || state.merchantAvailable || state.waitingToDescend || state.event.actions?.length) return;
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
    if (dungeonEvent.actions.includes("monty-0")) state.monty = window.DungeonModel.createMonty();
    setCaption("Решение за тобой");
    addJournal(dungeonEvent.title, dungeonEvent.text, dungeonEvent.icon);
    render();
    return;
  }

  const roll = Math.random();
  if (roll < 0.49) {
    spawnEnemy(false);
  } else if (roll < 0.62) {
    if (Math.random() < 0.12) {
      spawnSpecificEnemy("mimic");
      return;
    }
    const reward = randomInt(5, 12) + state.floor;
    addGold(reward);
    const foundPotion = Math.random() < 0.28 && state.potions < getPotionLimit();
    if (foundPotion) state.potions += 1;
    const loot = `Под осыпавшимися камнями нашёлся горшок с ${reward} золотыми${foundPotion ? " и зелье рядом" : ""}.${claimChestLoot()}`;
    setEvent("ГОРШОК С ЗОЛОТОМ", loot, "✦");
    addJournal("Спрятанная добыча", loot, "✦");
    setCaption("Здесь кто-то был");
    playSound("loot");
  } else if (roll < 0.70) {
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
    state.merchantSoulAvailable = state.level >= window.WellSoulCraftingModel.DROP_LEVEL &&
      Math.random() < 0.08;
    setCaption("Кто-то ждёт за прилавком");
    playSound("merchant");
  }
  render();
}

function addEventEssence(amount) {
  addEssence(amount);
}

function addGold(amount) {
  const reward = window.WellPlayerGroups
    ? window.WellPlayerGroups.splitReward("gold", amount)
    : amount;
  state.gold = Math.min(1000000000, state.gold + reward);
  return reward;
}

function addSoulDrop(soulId, source, playerLevel = state.level) {
  const model = window.WellSoulCraftingModel;
  const result = model.grant(
    metaProgress.souls,
    playerLevel,
    soulId,
    `drop-${mailboxRequestId()}`,
    source,
  );
  if (!result.ok) return false;
  const previous = metaProgress;
  metaProgress = { ...previous, souls: result.state };
  if (persistMetaProgress()) return true;
  metaProgress = previous;
  return false;
}

function addElementalResource(resourceId, source, playerLevel = state.level) {
  const model = window.WellElementalGearModel;
  if (playerLevel < model.CRAFT_LEVEL) return false;
  const result = model.grant(
    metaProgress.elemental,
    playerLevel,
    resourceId,
    window.crypto.randomUUID(),
    source,
  );
  if (!result.ok) {
    console.warn("Не удалось выдать стихийный материал.", result.reason);
    return false;
  }
  const previous = metaProgress;
  metaProgress = { ...previous, elemental: result.state };
  if (persistMetaProgress()) return true;
  metaProgress = previous;
  return false;
}

function elementalFindText(resourceId, source) {
  if (!addElementalResource(resourceId, source)) return "";
  return ` Найдено: ${window.WellElementalGearModel.MATERIALS[resourceId].name}.`;
}

function applySharedGoldReward(amount, receiptId) {
  if (!state.started || state.gameOver) return false;
  if (state.groupInboxReceipts?.includes(receiptId)) return true;
  if ((state.groupInboxReceipts || []).length >= 100000) return false;
  const nextState = {
    ...state,
    gold: Math.min(1000000000, state.gold + amount),
    groupInboxReceipts: [...(state.groupInboxReceipts || []), receiptId],
  };
  try {
    window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: nextState }));
  } catch (error) {
    console.warn("Не удалось надёжно сохранить групповую награду монетами.", error);
    return false;
  }
  state = nextState;
  render();
  return true;
}

function applySharedEssenceReward(amount, receiptId) {
  if (metaProgress.groupInboxReceipts?.includes(receiptId)) return true;
  if ((metaProgress.groupInboxReceipts || []).length >= 100000) return false;
  const previous = metaProgress;
  metaProgress = {
    ...metaProgress,
    essence: Math.min(1000000000, metaProgress.essence + amount),
    groupInboxReceipts: [...(metaProgress.groupInboxReceipts || []), receiptId],
  };
  if (!persistMetaProgress()) {
    metaProgress = previous;
    return false;
  }
  render();
  return true;
}

function addEssence(amount) {
  const reward = window.WellPlayerGroups
    ? window.WellPlayerGroups.splitReward("essence", amount)
    : amount;
  metaProgress.essence = Math.min(1000000000, metaProgress.essence + reward);
  persistMetaProgress();
  return reward;
}

function damageFromEvent(minimum, maximum) {
  const damage = Math.min(randomInt(minimum, maximum), state.hp - 1);
  state.hp -= damage;
  return damage;
}

function claimEventGear(type) {
  if (state.inventory.length >= MAX_GEAR) {
    const fallbackGold = 8 + state.floor;
    addGold(fallbackGold);
    return ` Рюкзак полон — заготовку обменяли на ${fallbackGold} монет.`;
  }
  const gear = createGear(type);
  state.inventory.push(gear);
  advanceQuest("gear");
  addJournal("Найдена экипировка", `${gear.name}: +${gear.bonus} ${type === "weapon" ? "к силе" : "к защите"}.`, type === "weapon" ? "⚔" : "⬡");
  return ` Найдено: ${gear.name} (+${gear.bonus} ${type === "weapon" ? "к силе" : "к защите"}), предмет в рюкзаке.`;
}

function claimChestLoot() {
  if (state.inventory.length >= MAX_GEAR) return " Рюкзак полон: вещь осталась за дверью.";
  return claimEventGear(Math.random() < 0.5 ? "weapon" : "armor");
}

function dungeonDuelLocked() {
  return Boolean(state.ghostDuel || state.liveDuelId || window.WellPvp?.isBusy());
}

function resolveMonty(action) {
  if (!state.monty) return;
  if (/^monty-[012]$/.test(action)) {
    state.monty = window.DungeonModel.chooseMonty(state.monty, Number(action.slice(-1)));
    setEvent("СМОТРИТЕЛЬ ОТКРЫЛ ДВЕРЬ", `Дверь ${state.monty.revealed + 1} пуста. Ты выбрал дверь ${state.monty.selected + 1}. Сменишь выбор на оставшуюся?`, "⚿", "ВТОРОЙ ВЫБОР", ["monty-stay", "monty-switch"]);
    render();
    return;
  }
  const result = window.DungeonModel.finishMonty(state.monty, action === "monty-switch");
  state.monty = null;
  if (result.won) {
    finishDungeonEvent("ДВЕРЬ С ПРИЗОМ", `За дверью ${result.door + 1} лежала вещь из обычного сундука.${claimChestLoot()}`, "✧", "Удачный выбор");
  } else {
    const loss = randomInt(0, 2);
    if (loss === 0) spawnEnemy(false);
    else if (loss === 1) {
      const damage = damageFromEvent(3, 6);
      finishDungeonEvent("ЛОВУШКА ЗА ДВЕРЬЮ", `Под порогом щёлкнул механизм: потеряно ${damage} здоровья.`, "⌁", "Дверная ловушка", "trap");
    } else finishDungeonEvent("ПУСТАЯ КОМНАТА", "За порогом только пыль. Ни добычи, ни опасности.", "⚿", "Пустая дверь");
  }
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
    !state.started || state.gameOver || state.enemy || dungeonDuelLocked() || state.merchantAvailable ||
    !state.event.actions?.includes(action) ||
    state.gold < getDungeonEventActionCost(action)
  ) return;
  state.event.actions = [];
  if (action.startsWith("monty-")) {
    resolveMonty(action);
    return;
  }

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
    addGold(8 + state.floor);
    finishDungeonEvent("ВОЗВРАЩЁННЫЙ КОШЕЛЬ", `Ты отдал 3 монеты и забрал кошель с ${8 + state.floor} монетами.`, "♟", "Сделка с гоблином");
  } else if (action === "find-careful") {
    const gold = 5 + state.floor;
    addGold(gold);
    const potion = state.potions < getPotionLimit() && Math.random() < 0.35;
    if (potion) state.potions += 1;
    finishDungeonEvent("ЛАРЕЦ ОТКРЫТ", `Внутри ${gold} монет${potion ? " и зелье" : ""}; печать удалось не повредить.`, "✧", "Ценная находка");
  } else if (action === "find-break") {
    const damage = damageFromEvent(4, 7);
    const gold = 12 + state.floor;
    addGold(gold);
    const gear = claimEventGear(randomInt(0, 1) ? "weapon" : "armor");
    finishDungeonEvent("ПЕЧАТЬ РАЗБИТА", `Осколки задели тебя на ${damage} здоровья. В ларце ${gold} монет.${gear}`, "✧", "Разбитая печать");
  } else if (action === "rubble-clear") {
    const damage = damageFromEvent(3, 6);
    const gold = 4 + state.floor;
    addGold(gold);
    const endurance = window.WellGoldEconomyModel.rubbleEndurance(state.maxHp);
    state.maxHp += endurance;
    const gear = claimEventGear("armor");
    finishDungeonEvent("ПРОХОД РАСЧИЩЕН", `Завал поддался, но камни отняли ${damage} здоровья. За ними было ${gold} монет. Выносливость: +${endurance} к максимуму здоровья до конца спуска.${gear}`, "⚒", "Разобранный завал");
  } else if (action === "rubble-squeeze") {
    const gold = 3 + state.floor;
    addGold(gold);
    finishDungeonEvent("ЛАЗ НАЙДЕН", `Ты протиснулся между камнями и подобрал ${gold} монет, не рискуя здоровьем.`, "⌕", "Лаз между камнями");
  } else if (action === "dive-deep") {
    const damage = damageFromEvent(4, 8);
    const gold = 4 + state.floor;
    addGold(gold);
    addEventEssence(1);
    finishDungeonEvent("ОСКОЛОК ИЗ ГЛУБИНЫ", `Ты нырнул за сияющим осколком, потерял ${damage} здоровья и нашёл ${gold} монет. Лагерь получил 1 осколок.`, "♆", "Погружение за осколком");
  } else if (action === "dive-shallow") {
    const gold = 4 + state.floor;
    addGold(gold);
    finishDungeonEvent("НАХОДКА У БЕРЕГА", `У самой кромки воды ты собрал ${gold} монет и сохранил силы.`, "♆", "Находка у берега");
  } else if (action === "ore-careful") {
    const gold = 4 + state.floor;
    addGold(gold);
    state.attack += 1;
    const find = elementalFindText("emberglass", action);
    finishDungeonEvent("РУДНАЯ ЗАГОТОВКА", `Ты аккуратно добыл ${gold} монет ценного металла. Сила удара выросла на 1.${find}`, "⚒", "Добыта руда");
  } else if (action === "ore-force") {
    const damage = damageFromEvent(4, 8);
    const gold = 14 + state.floor;
    addGold(gold);
    finishDungeonEvent("БОГАТАЯ ЖИЛА", `Сильный удар расколол жилу: ты получил ${gold} монет, но потерял ${damage} здоровья.`, "⚒", "Богатая рудная жила");
  } else if (action === "fish-net") {
    if (Math.random() < 0.2) {
      spawnSpecificEnemy("water");
      return;
    }
    let soulText = "";
    if (Math.random() < 0.15 && addSoulDrop("time", "fishing")) {
      soulText = " В улове оказалась Душа времени.";
    }
    if (state.hp < state.maxHp) {
      const healing = Math.min(randomInt(8, 13), state.maxHp - state.hp);
      state.hp += healing;
      finishDungeonEvent("УЛОВ", `В сети оказалась светлая рыба. Она восстановила ${healing} здоровья.${soulText}`, "≋", "Подземный улов", "heal");
    } else if (state.potions < getPotionLimit()) {
      state.potions += 1;
      finishDungeonEvent("УЛОВ", `В сети оказалась целебная рыба; ты приготовил из неё зелье.${soulText}`, "≋", "Подземный улов", "heal");
    } else {
      const gold = 6 + state.floor;
      addGold(gold);
      finishDungeonEvent("УЛОВ", `Рыбу обменяли на ${gold} монет — запас зелий уже полон.${soulText}`, "≋", "Подземный улов");
    }
  } else if (action === "fish-shiny") {
    const gold = 8 + state.floor;
    addGold(gold);
    addEventEssence(1);
    const find = elementalFindText("tidePearl", action);
    finishDungeonEvent("БЛЕСК НА ДНЕ", `Среди камней нашлись жемчужина и ${gold} монет. Её сияние укрепило лагерь на 1 осколок.${find}`, "✧", "Жемчужина из ручья");
  } else if (action === "door-listen") {
    const gold = 5 + state.floor;
    addGold(gold);
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
    addGold(gold);
    const healing = Math.min(randomInt(4, 7), state.maxHp - state.hp);
    state.hp += healing;
    finishDungeonEvent("ДОБЫЧА У ЛОГОВА", `Зверь не вышел, но приманка отвлекла его: найдено ${gold} монет${healing ? ` и восстановлено ${healing} здоровья` : ""}.`, "♧", "След охотника");
  } else if (action === "echo-duel") {
    requestDungeonDuel(true);
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
    addGold(gold);
    finishDungeonEvent("ПОТЕРЯННЫЙ ТАЙНИК", `Контрабандист скрылся, оставив ${gold} монет. В суматохе ты потерял ${damage} здоровья.`, "♜", "Тайник контрабандиста");
  } else if (action === "maze-mark") {
    const gold = 4 + state.floor;
    addGold(gold);
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
    addGold(gold);
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
    const find = elementalFindText("recipeBook", action);
    finishDungeonEvent("ЗАПОМНЕННАЯ ГЛАВА", `Ты успел разобрать один боевой приём до того, как чернила поблёкли. Сила удара навсегда выросла на 1.${find}`, "▤", "Страница из истлевшей книги", "rune");
  } else if (action === "book-seal") {
    const gold = 7 + state.floor;
    addGold(gold);
    const damage = damageFromEvent(1, 3);
    finishDungeonEvent("КНИГА ЗАПЕЧАТАНА", `Чернила погасли: найдено ${gold} монет, но едкий пар отнял ${damage} здоровья.`, "▤", "Запечатанная книга");
  } else if (action === "ruins-search") {
    const damage = damageFromEvent(3, 6);
    const gear = claimEventGear("armor");
    finishDungeonEvent("РЕЛИКВИЯ РУИН", `Ты поднял пыль и получил ${damage} урона, но нашёл уцелевшую броню.${gear}`, "⌂", "Осмотр заброшенных руин");
  } else if (action === "ruins-salvage") {
    const gold = 8 + state.floor;
    addGold(gold);
    const potion = state.potions < getPotionLimit();
    if (potion) state.potions += 1;
    finishDungeonEvent("ПОЛЕЗНЫЙ ХЛАМ", `Из руин вынесено ${gold} монет${potion ? " и зелье" : ""}.`, "⌂", "Находки в руинах");
  } else if (action === "grove-drink") {
    const healing = Math.min(randomInt(9, 14), state.maxHp - state.hp);
    state.hp += healing;
    const find = elementalFindText("primalWater", action);
    finishDungeonEvent("РОСА С КОРНЕЙ", `${healing ? `Чистая роса восстановила ${healing} здоровья.` : "Роса свежа, но ты и так полон сил."}${find}`, "♧", "Передышка в подземной роще", "heal");
  } else if (action === "grove-harvest") {
    state.maxHp += 4;
    const healing = Math.min(4, state.maxHp - state.hp);
    state.hp += healing;
    const find = elementalFindText("rootAmber", action);
    finishDungeonEvent("СЕМЕНА РОЩИ", `Ты сохранил семена: максимум здоровья навсегда вырос на 4${healing ? `, восстановлено ${healing}` : ""}.${find}`, "♧", "Дар подземной рощи", "rune");
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
    addGold(gold);
    finishDungeonEvent("САМОЦВЕТЫ У ВХОДА", `Ты собрал самоцветы на ${gold} монет и не потревожил кристаллы.`, "✦", "Самоцветы пещеры");
  } else if (action === "wreck-dive") {
    const damage = damageFromEvent(5, 9);
    const gold = 12 + state.floor;
    addGold(gold);
    addEventEssence(1);
    finishDungeonEvent("ДОБЫЧА ИЗ ТРЮМА", `В трюме нашлось ${gold} монет. Погружение отняло ${damage} здоровья; лагерь получил 1 осколок.`, "⚓", "Затонувший груз", "rune");
  } else if (action === "wreck-scavenge") {
    const gold = 7 + state.floor;
    addGold(gold);
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
  if (window.WellPlayerGroups) window.WellPlayerGroups.hint("secret", state.floor);
  if (firstDiscovery) {
    metaProgress.secretsFound.push(secret.id);
    addEssence(1);
    discoveryText += " Ты сохранил знак в летописи лагеря и получил 1 осколок.";
    persistMetaProgress();
  } else {
    const reward = 8 + state.floor;
    addGold(reward);
    discoveryText += ` Этот знак уже знаком; в тайнике осталось ${reward} монет.`;
  }
  setEvent(firstDiscovery ? "ТАЙНЫЙ ЗАЛ" : "ЗНАК ИЗ ЛЕТОПИСИ", `${secret.title}. ${discoveryText}`, "ᛟ", firstDiscovery ? "+1 ОСКОЛОК" : "СЕКРЕТ");
  addJournal(secret.title, discoveryText, "ᛟ");
  setCaption("Шёпот становится яснее");
  playSound("rune");
}

function spawnEnemy(isBoss, isElite = false, eventEnemy = null) {
  if (!isBoss && !isElite && !eventEnemy) {
    const specialRoll = Math.random();
    if (specialRoll < 0.02 && state.floor >= 4) return spawnSpecificEnemy("worldeater");
    if (specialRoll < 0.07) return spawnSpecificEnemy("keeper");
  }
  if (isElite && window.WellPlayerGroups) window.WellPlayerGroups.hint("rare", state.floor);
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
    special: base.special || null,
    round: 0,
    armor: base.armor || 0,
    concentration: base.concentration ?? 0.25,
    accuracy: base.accuracy ?? 0.85,
    bleeding: 0,
    runeReceiptId: window.crypto.randomUUID(),
  };
  if (isElite && !base.special) {
    const trait = Object.keys(ELITE_TRAITS)[randomInt(0, 7)];
    const eliteFighter = window.DungeonModel.createElite(window.DungeonModel.createFighter({
      hp: state.enemy.hp, maxHp: state.enemy.maxHp, attack: state.enemy.damage,
      armor: state.enemy.armor, concentration: state.enemy.concentration, accuracy: state.enemy.accuracy,
    }), trait);
    Object.assign(state.enemy, {
      hp: eliteFighter.hp, maxHp: eliteFighter.maxHp, damage: eliteFighter.attack,
      armor: eliteFighter.armor, concentration: eliteFighter.concentration,
      accuracy: eliteFighter.accuracy, bleeding: eliteFighter.bleeding, trait,
      name: `${ELITE_TRAITS[trait]} · ${state.enemy.name}`,
    });
  }
  state.combatProgress = null;
  state.extraActionUsed = false;
  state.extraLifeUsed = false;
  const encounterTitle = isBoss ? `СТРАЖ · ${theme.name.toUpperCase()}` : isElite ? "ЭЛИТНЫЙ ХРАНИТЕЛЬ" : "ОБИТАТЕЛЬ ГЛУБИНЫ";
  const encounterText = `${state.enemy.name} преграждает путь. Здоровье: ${state.enemy.hp}${isElite ? ". Победа принесёт усиленную награду." : "."}`;
  setEvent(encounterTitle, encounterText, isBoss || isElite ? state.enemy.icon : base.icon);
  addJournal(isBoss ? "Страж пробуждён" : isElite ? "Элитный противник" : "Встреча в темноте", `${state.enemy.name} вступает в бой.`, isBoss ? "☠" : "⚔");
  setCaption(isBoss ? "Страж колодца" : isElite ? "Опасный противник" : "Враг приближается");
  playSound(isBoss || isElite ? "boss" : "encounter");
  render();
}

function spawnSpecificEnemy(kind) {
  const foes = {
    keeper: { name: "Хранитель прохода", icon: "⚿", skin: "stone", hp: 22, damage: 6, xp: 18, gold: 10 },
    mimic: { name: "Мимик", icon: "⌑", skin: "hound", hp: 18, damage: 6, xp: 16, gold: 12 },
    water: { name: "Водяной", icon: "♆", skin: "drowned", hp: 20, damage: 6, xp: 18, gold: 12 },
    worldeater: { name: "Пожиратель миров · демон", icon: "☠", skin: "elite-forge",
      hp: 44, damage: 12, xp: 40, gold: 20, armor: 0.65, concentration: 1 },
  };
  const foe = foes[kind];
  if (!foe) throw new Error("Неизвестный особый противник.");
  if (kind === "worldeater") {
    metaProgress.tavern.satiety = 10;
    metaProgress.tavern.satietyAt = Date.now();
    metaProgress.tavern.satietyChangedAt = metaProgress.tavern.satietyAt;
    metaProgress.tavern.updatedAt = Date.now();
    metaProgress.tavern.revision += 1;
    persistMetaProgress();
  }
  spawnEnemy(false, kind === "worldeater", { ...foe, special: kind });
}

function attackEnemy(multiplier = 1, focusCost = 0, usedAbility = false) {
  if (!state.enemy || state.gameOver || state.focus < focusCost) return;
  runPveRound(multiplier, focusCost, usedAbility);
}

function getDungeonFighter() {
  const ability = getCharacterClass().ability;
  const attack = getAttackPower() +
    Math.ceil(getAttackPower() * getClassStat("missingHealthDamage") * (1 - state.hp / state.maxHp)) +
    (state.enemy && state.enemy.hp === state.enemy.maxHp ? Math.ceil(getAttackPower() * getClassStat("bonusDamage")) : 0);
  return window.DungeonModel.createFighter({
    ...(state.combatProgress || {}),
    hp: state.hp, maxHp: state.maxHp, attack,
    armor: Math.min(0.75, getArmorDefense() * 0.06 + getRuneStat("resistance") * 0.01 +
      (state.stance === "defensive" ? 0.2 : 0)),
    accuracy: Math.min(1, 0.9 + getRuneStat("accuracy") * 0.01),
    concentration: Math.min(1.5, (state.stance === "offensive" ? 0.5 : 0.35) +
      getRuneStat("concentration") * 0.01),
    agility: Math.min(1, getDodgeChance() * 2), evasion: Math.min(0.5, getDodgeChance()),
    potions: state.potions, focus: state.focus, offhand: state.offhand,
    skillType: ability.type, skillDamage: ability.type === "guard" ? Math.ceil(state.maxHp * 0.25) : Math.ceil(attack * 0.8),
    skillCooldown: state.abilityCooldown, skillCooldownMax: 3,
    revivalChance: getClassStat("extraLife") ? 1 : 0, revivalUsed: state.extraLifeUsed,
    criticalChance: getClassStat("criticalChance"), executeChance: getClassStat("executeChance"),
    lifesteal: getClassStat("lifesteal"),
    poisonDamage: state.combatProgress?.poisonDamage || 0,
  });
}

function runPveRound(multiplier = 1, focusCost = 0, forcedSkill = false) {
  if (!state.enemy || state.gameOver || dungeonDuelLocked()) return;
  const enemy = state.enemy;
  let player = getDungeonFighter();
  if (focusCost) state.focus -= focusCost;
  else state.focus = Math.min(MAX_FOCUS, state.focus + 1);
  player.focus = state.focus;
  player.damageMultiplier = multiplier * (state.stance === "offensive" ? 1.2 : 1);
  if (forcedSkill) player.concentration = 2;
  player = window.DungeonModel.pveModifiers(player, enemy, state.stance === "defensive");
  const foe = window.DungeonModel.createFighter({
    ...(enemy.fighter || {}), hp: enemy.hp, maxHp: enemy.maxHp,
    attack: enemy.damage, armor: enemy.armor || 0,
    accuracy: enemy.accuracy ?? 0.85, concentration: enemy.concentration ?? 0.25,
    bleeding: enemy.bleeding || 0, skillDamage: Math.ceil(enemy.damage * 0.5),
    poisonDamage: Math.ceil(enemy.maxHp * getClassStat("damageOverTime")),
    skillType: "blast", skillCooldownMax: enemy.trait === "experienced" ? 0 : 2,
  });
  const result = window.DungeonModel.pveRound(player, foe, Math.random,
    window.WellElementalGearModel.combatEffects(state.elementalLoadout || []));
  state.hp = result.actor.hp;
  state.extraLifeUsed = result.actor.revivalUsed;
  state.abilityCooldown = Math.min(3, result.actor.skillCooldown || 0);
  state.combatProgress = result.actor;
  enemy.hp = result.target.hp;
  enemy.fighter = result.target;
  enemy.bleeding = result.target.bleeding;
  enemy.round = (enemy.round || 0) + 1;
  state.extraActionUsed = false;
  setEvent("РАУНД ЗАВЕРШЁН", result.log.join(" ").slice(0, 300), "⚔", `РАУНД ${enemy.round}`);
  addJournal("Раунд боя", result.log.join(" ").slice(0, 300), "⚔");
  if (state.hp <= 0) {
    finishDungeonDefeat(true);
  } else if (enemy.hp <= 0) {
    defeatEnemy();
  }
  playSound(state.gameOver ? "gameOver" : "attack");
  render();
}

function finishDungeonDefeat(rewardEssence) {
  if (rewardEssence) awardRunEssence();
  state.gameOver = true;
  state.enemy = null;
  state.combatProgress = null;
  recordTavernInjury();
  const deathSoul = rewardEssence && addSoulDrop("death", "pve-death")
    ? " Смерть оставила Душу смерти."
    : "";
  setEvent("СПУСК ПРЕРВАН", rewardEssence
    ? `Ты пал на ${state.floor}-м этаже. В лагерь возвращено ${runEssenceReward()} осколков.${deathSoul}`
    : "Поединок проигран. За PvP и бой с призраком осколки и золото не выдаются.", "☾");
  setCaption("Тишина");
}

function canRequestDungeonDuel() {
  const coop = window.WellPlayerGroups?.getBattle();
  return state.started && !state.gameOver && !state.enemy && !state.ghostDuel && !state.liveDuelId &&
    !state.merchantAvailable && !state.waitingToDescend &&
    !(coop && ["waiting", "active"].includes(coop.status)) &&
    !(state.event.actions?.length);
}

function requestDungeonDuel(randomEncounter) {
  if (!canRequestDungeonDuel()) return;
  window.WellPvp.start(randomEncounter);
}

function startGhostDuel() {
  const player = getDungeonFighter();
  const ghost = window.DungeonModel.createFighter({
    hp: player.maxHp, maxHp: player.maxHp, attack: player.attack,
    armor: player.armor, accuracy: player.accuracy, concentration: player.concentration,
    agility: player.agility, evasion: player.evasion, offhand: player.offhand,
  });
  state.ghostDuel = { player, ghost, deadline: Date.now() + 40000, round: 1 };
  setEvent("ПРИЗРАК · НЕ ОНЛАЙН-ИГРОК", "Живого соперника нет. Ты сражаешься с ИИ по снимку своих показателей. По 40 секунд на ход; золота, опыта, репутации и осколков за этот бой нет.", "◈");
  render();
}

function ghostAction(action) {
  const duel = state.ghostDuel;
  if (!duel || state.gameOver) return;
  try {
    const result = window.DungeonModel.pvpTurn(duel.player, duel.ghost, action);
    duel.player = result.actor;
    duel.ghost = result.target;
    let finished = result.finished;
    let playerWon = result.winner === "actor";
    let log = result.log;
    if (!finished) {
      const reply = window.DungeonModel.pvpTurn(duel.ghost, duel.player, "attack");
      duel.ghost = reply.actor;
      duel.player = reply.target;
      log = [...log, ...reply.log];
      finished = reply.finished;
      playerWon = reply.winner === "target";
    }
    state.hp = duel.player.hp;
    state.potions = duel.player.potions;
    state.focus = duel.player.focus;
    state.offhand = duel.player.offhand;
    state.combatProgress = duel.player;
    state.extraLifeUsed = duel.player.revivalUsed;
    duel.round += 1;
    duel.deadline = action === "skip" ? duel.deadline + 40000 : Date.now() + 40000;
    setEvent("ПРИЗРАК · БОЙ С ИИ", log.join(" ").slice(0, 300), "◈", `ХОД ${duel.round}`);
    if (finished) {
      state.ghostDuel = null;
      if (!playerWon) finishDungeonDefeat(false);
      else setEvent("ПРИЗРАК РАССЕЯЛСЯ", "Ты одолел снимок искателя. Награды нет; путь свободен.", "◈");
    }
    render();
  } catch (error) {
    console.error("Не удалось провести ход с призраком.", error);
    setEvent("ХОД НЕ ПРИНЯТ", error.message, "◈");
    render();
  }
}

function applyPvpBattle(battle, userId) {
  const own = battle.players.find((player) => player.user_id === userId);
  if (!own || !state.started || state.gameOver) return;
  state.hp = own.hp;
  state.potions = own.potions;
  state.focus = own.focus;
  state.offhand = own.offhand;
  state.combatProgress = window.DungeonModel.createFighter({
    ...(own.fighter || own), maxHp: own.max_hp ?? own.maxHp,
    cooldowns: {
      shield: own.shield_cooldown ?? own.cooldowns?.shield ?? 0,
      torch: own.torch_cooldown ?? own.cooldowns?.torch ?? 0,
      staff: own.staff_cooldown ?? own.cooldowns?.staff ?? 0,
    },
  });
  state.extraLifeUsed = Boolean(own.revivalUsed);
  if (battle.status === "finished") {
    state.liveDuelId = null;
    if (battle.winner_id !== userId) finishDungeonDefeat(false);
    else setEvent("ДУЭЛЬ ЗАВЕРШЕНА", "Ты победил напарника. За PvP нет золота, осколков, опыта или репутации.", "◈");
  } else {
    state.liveDuelId = battle.id;
    setEvent("ОНЛАЙН PvP", "Ходы идут по очереди. Сервер отводит 40 секунд; три пропуска подряд означают поражение. Действия — в панели дуэли.", "◈");
  }
  render();
}

function useCombatExtra(action) {
  if (!state.enemy || state.gameOver || dungeonDuelLocked() || state.extraActionUsed) return;
  state.extraActionUsed = true;
  if (action === "stance") {
    state.stance = { balanced: "defensive", defensive: "offensive", offensive: "balanced" }[state.stance];
    setEvent("СТОЙКА ИЗМЕНЕНА", `Стойка: ${{ balanced: "сбалансированная", defensive: "защитная", offensive: "атакующая" }[state.stance]}. Дополнительное действие потрачено; теперь проведи раунд.`, "⬡");
  } else if (action === "escape") {
    if (state.enemy.special === "captain") {
      setEvent("ПУТЬ ПЕРЕКРЫТ", "Капитан связал тебя ближним боем. Побег невозможен.", "⬡");
    } else if (Math.random() < 0.5 && !state.enemy.boss) {
      state.enemy = null;
      state.combatProgress = null;
      setEvent("ТЫ УШЁЛ ОТ БОЯ", "Противник остался позади. Опыт, репутация и добыча не получены.", "↓");
    } else setEvent("ПОБЕГ НЕ УДАЛСЯ", "Враг перекрыл проход. Дополнительное действие потрачено; проведи раунд.", "⬡");
  } else if (action === "offhand") {
    const fighter = getDungeonFighter();
    const cooldown = fighter.cooldowns[state.offhand];
    if (cooldown > 0) {
      state.extraActionUsed = false;
      return;
    }
    fighter.cooldowns[state.offhand] = state.offhand === "torch" ? 2 : 4;
    if (state.offhand === "shield") fighter.barrier += Math.ceil(state.maxHp * 0.2);
    else if (state.offhand === "torch") state.enemy.bleeding = (state.enemy.bleeding || 0) + 2;
    else {
      state.hp = Math.min(state.maxHp, state.hp + 8);
      fighter.hp = state.hp;
    }
    state.combatProgress = fighter;
    setEvent("ОСОБЕННОСТЬ ПРЕДМЕТА", "Дополнительный предмет использован. Откат сохранён за типом предмета, а не за слотом. Теперь проведи раунд.", "✦");
  }
  render();
}

function runEssenceReward() {
  return 1 + Math.floor((state.floor - 1) / 3) + state.runBossesDefeated;
}

function awardRunEssence() {
  if (state.runRewardClaimed) return;
  state.runRewardClaimed = true;
  addEssence(runEssenceReward());
}

function awardEnhancementRune(level, receiptId) {
  if (metaProgress.runeDrops.length >= 100000 ||
    metaProgress.runeDrops.some((receipt) => receipt.id === receiptId)) return null;
  const drop = window.WellRuneModel.rollDrop(level, metaProgress.runeDrops);
  if (!drop) return null;
  const receipt = { id: receiptId || window.crypto.randomUUID(), ...drop };
  metaProgress.runeDrops.push(receipt);
  addJournal("Руна усиления найдена",
    `Руна «${window.WellRuneModel.RUNES[drop.type].name}» добавлена в запас.`, "ᛟ");
  return receipt;
}

function useClassAbility() {
  const ability = getCharacterClass().ability;
  if (!state.enemy || state.gameOver || state.abilityCooldown > 0 || !ability) return;
  runPveRound(1, 0, true);
}

function defeatEnemy() {
  const enemy = state.enemy;
  const victoryLevel = state.level;
  const reputation = state.level * (enemy.special === "worldeater" ? 10 : 1);
  metaProgress.orderReputation = Math.min(1000000000, metaProgress.orderReputation + reputation);
  const trophy = (key) => {
    metaProgress.dungeonTrophies[key] = Math.min(1000000000, (metaProgress.dungeonTrophies[key] || 0) + 1);
  };
  const collected = [];
  const trophyKeys = [];
  const giveTrophy = (key) => { trophy(key); trophyKeys.push(key); collected.push(DUNGEON_TROPHIES[key]); };
  if (enemy.elite) giveTrophy("elite");
  if (enemy.special === "keeper") {
    giveTrophy("keeperKey");
    giveTrophy("keeperHeart");
  }
  if (enemy.special === "water") {
    giveTrophy("rawFish");
    giveTrophy(["shell", "fishEye", "fishFat", "fishScale"][randomInt(0, 3)]);
  }
  if (enemy.special === "worldeater") {
    ["wealth", "blood", "knowledge", "fate", "statPotion"].forEach(giveTrophy);
    metaProgress.tavern.satiety = 100;
    metaProgress.tavern.satietyAt = Date.now();
    metaProgress.tavern.satietyChangedAt = metaProgress.tavern.satietyAt;
    metaProgress.tavern.updatedAt = Date.now();
    metaProgress.tavern.revision += 1;
  } else {
    if (Math.random() < 0.15) giveTrophy("courage");
    if (Math.random() < 0.06) giveTrophy("valor");
    if (Math.random() < 0.03) giveTrophy("admBlood");
  }
  if (metaProgress.dungeonVictories.length < 100000) {
    metaProgress.dungeonVictories.push({ id: window.crypto.randomUUID(), reputation, trophies: trophyKeys });
  } else {
    console.warn("Летопись боёв достигла предела; новая репутация сохранена в базовом счётчике.");
  }
  state.enemy = null;
  state.combatProgress = null;
  state.abilityGuarding = false;
  state.abilityDodge = false;
  addGold(enemy.gold);
  gainXp(enemy.xp);
  advanceQuest("defeat");
  let gearMessage = ` Репутация ордена: +${reputation}.${collected.length ? ` Трофеи: ${collected.join(", ")}.` : ""}`;
  if (enemy.special === "keeper") {
    const heartFragment = addElementalResource("heartFragment", "keeper-defeat", victoryLevel);
    if (heartFragment) {
      gearMessage += ` Найдено: ${window.WellElementalGearModel.MATERIALS.heartFragment.name}.`;
    }
  }
  if (state.level >= window.WellSoulCraftingModel.DROP_LEVEL && Math.random() < 0.08) {
    const soulId = Math.random() < 0.5 ? "blood" : "fury";
    if (addSoulDrop(soulId, "random-combat-drop")) {
      gearMessage += ` Найдена ${window.WellSoulCraftingModel.SOULS[soulId].name}.`;
    }
  }
  const lootChance = Math.min(0.8, 0.3 + getClassStat("lootChance") + getRuneStat("luck") * 0.01);
  if (enemy.boss || Math.random() < lootChance) {
    if (state.inventory.length < MAX_GEAR) {
      const gear = createGear(randomInt(0, 1) === 0 ? "weapon" : "armor");
      state.inventory.push(gear);
      advanceQuest("gear");
      gearMessage += ` Найдено: ${gear.name} (+${gear.bonus} ${gear.type === "weapon" ? "к силе" : "к защите"}), предмет в рюкзаке.`;
      addJournal("Найдена экипировка", `${gear.name}: +${gear.bonus} ${gear.type === "weapon" ? "к урону" : "к защите"}.`, gear.type === "weapon" ? "⚔" : "⬡");
    } else {
      gearMessage += " Рюкзак полон: трофей остался в зале.";
    }
  }
  const victoryHealing = getClassStat("healingOnVictory");
  const healed = Math.min(victoryHealing, state.maxHp - state.hp);
  state.hp += healed;
  if (metaProgress.runeDrops.length >= 100000) {
    console.warn("Журнал добычи рун достиг предела; новая руна не выпала.");
  } else {
    const drop = awardEnhancementRune(victoryLevel, enemy.runeReceiptId);
    if (drop) {
      const total = window.WellRuneModel.counts(metaProgress.runeDrops)[drop.type];
      gearMessage += ` Найдена руна «${window.WellRuneModel.RUNES[drop.type].name}» (${total}/${window.WellRuneModel.RUNES[drop.type].cap(victoryLevel)}).`;
    }
  }
  if (Math.random() < 0.02 && state.inventory.length < MAX_GEAR) {
    const admGear = createGear(Math.random() < 0.5 ? "weapon" : "armor");
    admGear.name = admGear.type === "weapon" ? "Клинок адмов" : "Доспех адмов";
    admGear.bonus = Math.min(10, admGear.bonus + 2);
    state.inventory.push(admGear);
    gearMessage += ` Найдено: ${admGear.name}.`;
    advanceQuest("gear");
  }
  persistMetaProgress();
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
  if (leveledUp) {
    metaProgress.tavern.characterLevel = state.level;
    metaProgress.tavern.revision += 1;
    metaProgress.tavern.updatedAt = Date.now();
    persistMetaProgress();
    playSound("levelUp");
  }
}

function recordTavernInjury() {
  metaProgress.tavern = window.WellTavernModel.createInjury(metaProgress.tavern);
  persistMetaProgress();
}

function getAttackPower() {
  const base = state.attack + (state.equipment.weapon?.bonus || 0) +
    getClassStat("attack") + getRuneStat("attack");
  return hasActiveMealBuff("attack") ? Math.floor(base * 1.5) : base;
}

function getArmorDefense() {
  const base = (state.equipment.armor?.bonus || 0) + getCharacterClass().defense +
    getClassStat("defense") + getRuneStat("armor");
  return hasActiveMealBuff("defense") ? Math.floor(base * 1.5) : base;
}

function getDodgeChance() {
  const chance = getClassStat("dodge");
  return Math.min(0.8, hasActiveMealBuff("dodge") ? chance * 1.5 : chance);
}

function hasActiveMealBuff(stat, now = Date.now()) {
  const buff = metaProgress.homestead.mealBuff;
  return Boolean(buff && buff.stat === stat && buff.expiresAt > now);
}

function getHeavyAttackMultiplier() {
  return (getCharacterClass().heavyMultiplier || 2.2) + getClassStat("heavyMultiplier");
}

function getGroupBattlePlayer() {
  return {
    hp: state.hp,
    max_hp: state.maxHp,
    potions: state.potions,
    attack: Math.max(1, getAttackPower()),
    defense: Math.max(0, getArmorDefense() + getRuneStat("resistance")),
    focus: state.focus,
    heavy_multiplier: getHeavyAttackMultiplier(),
  };
}

function applyGroupBattleUpdate(battle, userId) {
  if (!battle || !userId || !state.started) return;
  const own = battle.players?.find((player) => player.user_id === userId);
  if (own) {
    state.hp = own.hp;
    state.potions = own.potions;
    state.focus = own.focus;
  }
  if (battle.status === "waiting" || battle.status === "active") {
    state.floor = battle.floor;
    state.room = MAX_ROOMS;
    state.enemy = {
      name: battle.boss.name,
      icon: battle.boss.icon,
      skin: battle.boss.skin,
      hp: battle.boss.hp,
      maxHp: battle.boss.max_hp,
      damage: battle.boss.damage,
      xp: battle.xp,
      gold: battle.gold,
      boss: true,
      elite: false,
    };
    state.waitingToDescend = false;
    state.gameOver = false;
    setCaption("Бьётесь со стражем вместе");
    setEvent("СОВМЕСТНЫЙ БОЙ", "Каждый искатель делает ход; после обоих ходов страж отвечает атакой.", battle.boss.icon, `РАУНД ${battle.round}`);
  } else if (battle.status === "victory") {
    if (state.coopBattleReceipts.includes(battle.id)) return;
    state.coopBattleReceipts.push(battle.id);
    const victoryLevel = state.level;
    state.floor = battle.floor;
    state.room = MAX_ROOMS;
    state.enemy = null;
    state.waitingToDescend = true;
    state.runBossesDefeated += 1;
    state.gold = Math.min(1000000000, state.gold + battle.gold);
    gainXp(battle.xp);
    advanceQuest("defeat");
    const runeDrop = awardEnhancementRune(victoryLevel, battle.id);
    const runeText = runeDrop
      ? ` Найдена руна «${window.WellRuneModel.RUNES[runeDrop.type].name}».`
      : "";
    metaProgress.bossesDefeated = Math.min(1000000000, metaProgress.bossesDefeated + 1);
    persistMetaProgress();
    let trophyText = "";
    if (state.inventory.length < MAX_GEAR) {
      const gear = createGear(randomInt(0, 1) === 0 ? "weapon" : "armor");
      state.inventory.push(gear);
      advanceQuest("gear");
      addJournal("Найдена экипировка", `${gear.name}: +${gear.bonus} ${gear.type === "weapon" ? "к урону" : "к защите"}.`, gear.type === "weapon" ? "⚔" : "⬡");
      trophyText = ` Трофей: ${gear.name} (+${gear.bonus}).`;
    } else {
      trophyText = " Рюкзак полон — трофей остался в зале.";
    }
    const victoryHealing = Math.min(getClassStat("healingOnVictory"), state.maxHp - state.hp);
    state.hp += victoryHealing;
    const healing = Math.min(8, state.maxHp - state.hp);
    state.hp += healing;
    setEvent(
      "СТРАЖ ПОВЕРЖЕН ВМЕСТЕ",
      `Оба искателя получили общую победу: +${battle.xp} опыта и +${battle.gold} монет.${victoryHealing ? ` Класс восстановил ${victoryHealing} здоровья.` : ""}${healing ? ` Передышка вернула ${healing} здоровья.` : ""}${trophyText}${runeText} Путь вниз открыт.`,
      "✧",
      "ПУТЬ ОТКРЫТ",
    );
    addJournal("Совместная победа", `${battle.boss.name} повержен отрядом. Открыт путь на ${battle.floor + 1}-й этаж.`, "✧");
    setCaption("Лестница открыта");
    playSound("bossVictory");
  } else if (battle.status === "defeat") {
    state.enemy = null;
    state.waitingToDescend = false;
    if (!state.gameOver) recordTavernInjury();
    state.gameOver = true;
    awardRunEssence();
    setEvent("ОТРЯД ПАЛ", `Совместный бой завершился поражением на ${battle.floor}-м этаже.`, "☾");
    addJournal("Совместный бой прерван", "Страж одолел отряд искателей.", "☾");
    setCaption("Тишина");
    playSound("gameOver");
  } else if (battle.status === "abandoned") {
    state.floor = battle.floor;
    state.room = MAX_ROOMS;
    state.enemy = {
      name: battle.boss.name,
      icon: battle.boss.icon,
      skin: battle.boss.skin,
      hp: battle.boss.hp,
      maxHp: battle.boss.max_hp,
      damage: battle.boss.damage,
      xp: battle.xp,
      gold: battle.gold,
      boss: true,
      elite: false,
    };
    setCaption("Совместный бой оставлен");
  }
  updateBestFloor();
  render();
}

function createGear(type) {
  const theme = getFloorTheme();
  const names = window.WellGoldEconomyModel.ORDINARY_GEAR_NAMES;
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
  if (!state.started || state.gameOver || state.enemy || dungeonDuelLocked()) return;
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

function getRunGearSalePrice(gear) {
  if (!isValidGear(gear) || state.tavernGearIds?.includes(gear.id)) return null;
  return window.WellGoldEconomyModel.gearSalePrice(gear);
}

function sellRunGear(gearId) {
  if (!state.started || state.gameOver || state.enemy || dungeonDuelLocked() ||
    state.event.actions?.length) return;
  const gear = state.inventory.find((item) => item.id === gearId);
  const price = getRunGearSalePrice(gear);
  if (price === null) return;
  try {
    if (state.gold + price > window.WellGoldEconomyModel.MAX_GOLD) {
      throw new Error("В кошельке нет места: сначала потрать золото. Предмет не продан.");
    }
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith("well-of-whispers-mail-outbox:")) continue;
      const operation = JSON.parse(window.localStorage.getItem(key));
      if (operation?.itemId === gearId) {
        throw new Error("Предмет ожидает подтверждения отправки по почте. Продажа заблокирована.");
      }
    }
    const stored = window.localStorage.getItem(RUN_SAVE_KEY);
    if (stored !== JSON.stringify({ version: SAVE_VERSION, state })) {
      throw new Error("Сохранение спуска изменилось. Перезагрузи игру перед продажей.");
    }
    const candidate = JSON.parse(JSON.stringify(state));
    candidate.inventory = candidate.inventory.filter((item) => item.id !== gearId);
    candidate.gold += price;
    if (!isValidRun({ version: SAVE_VERSION, state: candidate })) {
      throw new Error("Не удалось проверить продажу. Предмет не продан.");
    }
    // Item removal and payment share one durable run snapshot.
    window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: candidate }));
    state = candidate;
    setEvent("ПРЕДМЕТ ПРОДАН", `${gear.name}: получено ${price} золота в кошелёк спуска.`, "✦");
    addJournal("Продажа добычи", `${gear.name} продан за ${price} золота.`, "✦");
  } catch (error) {
    console.warn("Не удалось продать добычу.", error);
    // Do not render/save a stale run over another tab's committed transaction.
    ui.eventText.textContent = `Продажа не выполнена: ${error.message}`;
    return;
  }
  render();
}

function useCamouflage() {
  if (!state.enemy || state.gameOver || state.extraActionUsed || state.enemy.boss || state.enemy.elite || dungeonDuelLocked()) return;
  const previous = metaProgress;
  const result = window.WellHomesteadModel.consumeCamouflage(metaProgress.homestead, Date.now());
  if (!result.ok) {
    setEvent("МАСКИРОВКИ НЕТ", result.reason, "◈");
    render();
    return;
  }
  metaProgress = { ...metaProgress, homestead: result.state };
  if (!persistMetaProgress()) {
    metaProgress = previous;
    setEvent("МАСКИРОВКА НЕ СОХРАНЕНА", "Предмет остался в инвентаре; бой продолжается.", "◈");
    render();
    return;
  }
  const escapedEnemy = state.enemy.name;
  state.enemy = null;
  setEvent("МАСКИРОВКА СРАБОТАЛА", `${escapedEnemy} не заметил тебя: маскировка позволила обойти обычного врага. Опыт и добыча не получены.`, "◈");
  addJournal("Тихий обход", `${escapedEnemy} не заметил тебя; маскировка израсходована.`, "◈");
  setCaption("Проход свободен");
  render();
}

function drinkPotion(inCombat = false) {
  if (!state.started || state.potions <= 0 || state.hp >= state.maxHp || state.gameOver || dungeonDuelLocked() ||
    (state.enemy && state.extraActionUsed)) return;
  if (state.enemy) state.extraActionUsed = true;
  state.potions -= 1;
  const healing = Math.min(14 + getClassStat("potionHealing"), state.maxHp - state.hp);
  state.hp += healing;
  setEvent("ЗЕЛЬЕ ВЫПИТО", `Ты восстановил ${healing} здоровья.`, "⚗");
  addJournal("Зелье здоровья", `Восстановлено ${healing} здоровья.`, "⚗");
  playSound("heal");
  render();
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
  } else if (item === "fireSoul") {
    if (!state.merchantSoulAvailable || state.level < window.WellSoulCraftingModel.DROP_LEVEL ||
      state.gold < MERCHANT_PRICES.fireSoul) return;
    if (!addSoulDrop("fire", "wandering-merchant")) return;
    state.gold -= MERCHANT_PRICES.fireSoul;
    state.merchantSoulAvailable = false;
    setEvent("РЕДКИЙ ТОВАР КУПЛЕН",
      `Ты купил Душу огня за ${MERCHANT_PRICES.fireSoul} монет.`, "♨", "КУПЛЕНО");
    addJournal("Покупка у странствующего торговца",
      `Душа огня куплена за ${MERCHANT_PRICES.fireSoul} монет.`, "♨");
  }
  playSound("purchase");
  render();
}

function leaveMerchant() {
  if (!state.merchantAvailable) return;
  state.merchantAvailable = false;
  state.merchantSoulAvailable = false;
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
  const craftButton = $("profile-crafting-button");
  const bestHome = window.WellHomesteadModel.getBestHome(metaProgress.homestead);
  craftButton.disabled = state.started && !state.gameOver;
  craftButton.textContent = bestHome
    ? `Ремесленный стол · ${metaProgress.homestead.atHome ? "доступен дома" : "войти в дом"}`
    : "Ремесленный стол · сначала купи дом";
  const soulCraftButton = $("profile-soul-crafting-button");
  soulCraftButton.disabled = state.started && !state.gameOver;
  soulCraftButton.textContent =
    `Стихийное ремесло · ур. ${window.WellElementalGearModel.CRAFT_LEVEL} · R-ремесло · ур. ${window.WellSoulCraftingModel.CRAFT_LEVEL}`;
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
    equip.disabled = Boolean(state.enemy) || state.gameOver || dungeonDuelLocked();
    const actions = document.createElement("div");
    actions.className = "inventory-actions";
    actions.append(equip);
    const price = getRunGearSalePrice(gear);
    if (price !== null) {
      const sell = document.createElement("button");
      sell.className = "equip-button";
      sell.type = "button";
      sell.dataset.sellGearId = gear.id;
      sell.textContent = `Продать · ${price} зол.`;
      sell.setAttribute("aria-label", `Продать ${gear.name} за ${price} золота спуска`);
      sell.disabled = equip.disabled || Boolean(state.event.actions?.length) ||
        state.gold + price > window.WellGoldEconomyModel.MAX_GOLD;
      actions.append(sell);
    }
    item.append(icon, details, actions);
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

function createCityServiceCard(service, locked = false) {
  const card = document.createElement("article");
  const status = locked ? "locked" : service.status;
  card.className = `service-card service-${status}`;

  const heading = document.createElement("div");
  heading.className = "service-heading";
  const icon = document.createElement("span");
  icon.className = "service-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = service.icon;
  const badge = document.createElement("span");
  badge.className = "service-status";
  badge.textContent = locked ? "ЗАКРЫТО" : service.statusLabel;
  heading.append(icon, badge);

  const title = document.createElement("h4");
  title.textContent = service.name;
  const description = document.createElement("p");
  description.textContent = service.description;
  card.append(heading, title, description);

  if (service.action && !locked) {
    const actions = document.createElement("div");
    actions.className = "service-actions";
    const button = document.createElement("button");
    button.type = "button";
    button.className = service.action === "well" ? "primary-button" : "service-button";
    button.dataset.cityAction = service.action;
    button.textContent = service.actionLabel || (
      savedRun ? "Продолжить сохранённый спуск" : "Выбрать класс и начать спуск"
    );
    actions.append(button);
    if (service.action === "well" && savedRun) {
      const newRunButton = document.createElement("button");
      newRunButton.type = "button";
      newRunButton.className = "service-button";
      newRunButton.dataset.cityAction = "new-run";
      newRunButton.textContent = "Начать новый спуск";
      actions.append(newRunButton);
    }
    card.append(actions);
  }
  return card;
}

function renderCity() {
  const townVisible = !state.started || state.gameOver;
  if (townVisible && !previousTownVisibility) selectedDistrict = "main";
  previousTownVisibility = townVisible;
  ui.cityHub.hidden = !townVisible;
  ui.dungeonContent.hidden = townVisible;
  if (!townVisible) return;

  const characterProgress = state.started ? state : savedRun;
  const ownsHome = metaProgress.homestead.homes.length > 0;
  const upperUnlocked = Boolean(characterProgress?.advancedClassId || characterProgress?.masteryClassId || ownsHome);
  const district = CITY_DISTRICTS[selectedDistrict];
  ui.citySummary.textContent = savedRun
    ? `Сохранённый спуск: этаж ${savedRun.floor}, уровень ${savedRun.level}. Его можно продолжить из Колодца.`
    : state.gameOver
      ? `Последний спуск завершён на ${state.floor}-м этаже. Отдохни и выбери следующий путь.`
      : "Выбери, куда направиться перед следующим путешествием.";
  ui.districtKicker.textContent = district.kicker;
  ui.districtTitle.textContent = district.title;
  ui.districtDescription.textContent = district.description;
  ui.districtBackButton.hidden = selectedDistrict === "main";
  ui.districtLockNote.hidden = selectedDistrict !== "upper" || upperUnlocked;
  ui.districtLockNote.textContent = ownsHome
    ? ""
    : "Верхний квартал откроется после выбора первого продвинутого класса на 3-м уровне или покупки любого дома.";
  ui.homesteadOpenButton.disabled = Boolean(state.started && !state.gameOver);
  ui.homesteadOpenButton.title = ui.homesteadOpenButton.disabled
    ? "Домашняя лавка доступна между спусками."
    : "Открыть магазин домов и личные владения.";
  for (const tab of ui.districtTabs.querySelectorAll("[data-district]")) {
    const active = tab.dataset.district === selectedDistrict;
    tab.setAttribute("aria-pressed", String(active));
    if (tab.dataset.district === "upper") {
      tab.setAttribute("aria-label", upperUnlocked ? "Верхний квартал" : "Верхний квартал, закрыто до выбора первого продвинутого класса");
      tab.querySelector("span").textContent = upperUnlocked ? "" : " · закрыт";
    }
  }
  ui.cityServices.className = `city-services district-services-${selectedDistrict}`;
  ui.cityServices.replaceChildren(...district.services.map((service) =>
    createCityServiceCard(service, selectedDistrict === "upper" && !upperUnlocked)));
}

function harborReceiptId() {
  return window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `voyage-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function harborActionButton(label, action, data = {}, disabled = false, className = "service-button") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.dataset.harborAction = action;
  for (const [key, value] of Object.entries(data)) button.dataset[key] = String(value);
  button.disabled = disabled;
  return button;
}

function homesteadReceiptId() {
  return window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `home-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function homesteadButton(label, action, data = {}, disabled = false) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "service-button";
  button.textContent = label;
  button.dataset.homesteadAction = action;
  for (const [key, value] of Object.entries(data)) button.dataset[key] = String(value);
  button.disabled = disabled || homesteadBusy || !localMetaReadable;
  return button;
}

function homeSection(title, description = "") {
  const section = document.createElement("section");
  section.className = "homestead-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.append(heading);
  if (description) {
    const note = document.createElement("p");
    note.className = "homestead-note";
    note.textContent = description;
    section.append(note);
  }
  return section;
}

function homeCard(title, description, actions = []) {
  const card = document.createElement("article");
  card.className = "homestead-card";
  const heading = document.createElement("h4");
  heading.textContent = title;
  const detail = document.createElement("p");
  detail.textContent = description;
  card.append(heading, detail);
  if (actions.length) {
    const controls = document.createElement("div");
    controls.className = "homestead-actions";
    controls.append(...actions);
    card.append(controls);
  }
  return card;
}

function formatHomeCountdown(timestamp, now = Date.now()) {
  const remaining = Math.max(0, timestamp - now);
  const hours = Math.floor(remaining / window.WellHomesteadModel.HOUR);
  const minutes = Math.ceil((remaining % window.WellHomesteadModel.HOUR) / 60000);
  return `${hours} ч ${minutes} мин`;
}

function renderHomestead() {
  if (!ui.homesteadDialog?.open || !metaProgress?.homestead) return;
  const model = window.WellHomesteadModel;
  const homestead = model.withDefaults(metaProgress.homestead);
  const bestHome = model.getBestHome(homestead);
  const homeType = bestHome ? model.HOME_TYPES[bestHome.tier] : null;
  const now = Date.now();
  ui.homesteadStatus.textContent = homesteadMessage || (bestHome
    ? homestead.atHome
      ? `Ты дома: используется ${homeType.name}. Закрытие окна покидает дом и прерывает сон.`
      : `${homeType.name} используется автоматически. Войди в дом, чтобы собирать и строить.`
    : "Домов пока нет. Покупка любого дома откроет Верхний квартал.");
  ui.homesteadStatus.classList.toggle("error", Boolean(homesteadMessage) &&
    /Не удалось|Недостаточно|Нужно |недоступ|заблок|ошиб/i.test(homesteadMessage));
  ui.homesteadWallet.replaceChildren();
  const walletData = [
    ["ОСКОЛКИ", `${metaProgress.essence} ✦`],
    ["ЗОЛОТО ТАВЕРНЫ", `${metaProgress.tavern.gold} золота`],
    ["СКЛАД", `${model.resourceTotal(homestead)} / ${model.getStorageCapacity(homestead)}`],
  ];
  for (const [label, value] of walletData) {
    const cell = document.createElement("div");
    const caption = document.createElement("span");
    caption.textContent = label;
    const amount = document.createElement("strong");
    amount.textContent = value;
    cell.append(caption, amount);
    ui.homesteadWallet.append(cell);
  }
  ui.homesteadContent.replaceChildren();

  const shop = homeSection("Магазин домов", "После каждой покупки автоматически выбирается лучший дом. Домов можно покупать сколько угодно.");
  shop.append(
    homeCard("Простая хижина · 2 участка · сон 2 ч 40 мин",
      "Комнаты: спальня, ремесленный стол и кухня. Почтовый ящик требует особняк у обоих игроков. Цена: 20 000 золота таверны.",
      [homesteadButton("Купить хижину · 20 000 золота", "buy-home", { tier: "cabin", payment: "gold" },
        metaProgress.tavern.gold < 20000)]),
    homeCard("Добротный дом · 4 участка · сон 2 ч 20 мин",
      "Комнаты: спальня, ремесленный стол, почтовый ящик, кухня, библиотека. Цена: 400 осколков.",
      [homesteadButton("Купить дом · 400 осколков", "buy-home", { tier: "sturdy", payment: "essence" },
        metaProgress.essence < 400)]),
    homeCard("Богатый особняк · 6 участков · сон 2 ч",
      "Комнаты: спальня, ремесленный стол, почтовый ящик, кухня, библиотека, лечебница и святилище. Подвал с тренировочным залом покупается отдельно за золото.",
      [
        homesteadButton("Купить · 1 000 осколков", "buy-home", { tier: "mansion", payment: "essence" },
          metaProgress.essence < 1000),
        homesteadButton("Добротный дом + 600 осколков", "buy-home", { tier: "mansion", payment: "upgrade" },
          !homestead.homes.some((home) => home.tier === "sturdy") || metaProgress.essence < 600),
      ]),
  );
  ui.homesteadContent.append(shop);
  const soulModel = window.WellSoulCraftingModel;
  const soulCrafting = homeSection(
    "R-ремесло душ",
    `Доступно с ${soulModel.CRAFT_LEVEL}-го уровня. Созданная экипировка попадёт в постоянный запас таверны. ` +
      Object.keys(soulModel.SOULS)
        .map((id) => `${soulModel.SOULS[id].name}: ${metaProgress.souls.balances[id]}`).join(" · "),
  );
  for (const recipe of Object.values(soulModel.RECIPES)) {
    const missing = metaProgress.souls.balances[recipe.soulId] < recipe.amount;
    const level = metaProgress.tavern.characterLevel;
    const unavailable = level < soulModel.CRAFT_LEVEL || missing || metaProgress.tavern.stash.length >= 10000;
    soulCrafting.append(homeCard(
      `${recipe.name} · ${recipe.type === "weapon" ? "урон" : "защита"} +${recipe.bonus}`,
      `${recipe.amount} × ${recipe.soulName}. ${level < soulModel.CRAFT_LEVEL
        ? `Нужен ${soulModel.CRAFT_LEVEL}-й уровень.`
        : missing ? "Недостаточно душ."
          : metaProgress.tavern.stash.length >= 10000 ? "Постоянный запас переполнен."
            : "Один предмет будет создан и сохранён."}`,
      [homesteadButton(`Создать · ${recipe.amount} душ`, "craft-soul", { recipeId: recipe.id }, unavailable)],
    ));
  }
  ui.homesteadContent.append(soulCrafting);
  const elementalModel = window.WellElementalGearModel;
  const elementalState = elementalModel.withDefaults(metaProgress.elemental);
  const elementalLevel = metaProgress.tavern.characterLevel;
  const elementalCounts = Object.entries(elementalModel.MATERIALS)
    .concat(Object.entries(elementalModel.ESSENCES))
    .map(([id, resource]) => `${resource.name}: ${elementalState.balances[id]}`)
    .join(" · ");
  const elementalCrafting = homeSection(
    "Стихийное снаряжение",
    `С ${elementalModel.CRAFT_LEVEL}-го уровня. Решение координатора: отдельные стихийные слоты, ` +
      `только PvE; оружие +${elementalModel.COMBAT_BONUS * 100}% урона, броня −${elementalModel.COMBAT_BONUS * 100}% входящего урона. ` +
      `Общий потолок каждого эффекта ${elementalModel.COMBAT_CAP * 100}%. Характеристики и PvP не меняются. ` +
      `Выбор фиксируется в начале нового спуска. ${elementalCounts}`,
  );
  for (const [materialId, material] of Object.entries(elementalModel.MATERIALS)) {
    if (!material.essence) continue;
    const missing = elementalState.balances[materialId] < 1 ||
      elementalState.balances.primalWater < 1;
    const unavailable = elementalLevel < elementalModel.CRAFT_LEVEL || missing;
    elementalCrafting.append(homeCard(
      `Эссенция · ${material.name}`,
      `${material.name} + 1 × ${elementalModel.MATERIALS.primalWater.name}. ` +
        `Критический результат: ${elementalModel.CRITICAL_CHANCE * 100}% на 2 эссенции.`,
      [homesteadButton("Смешать эссенцию", "make-elemental-essence", { materialId }, unavailable)],
    ));
  }
  for (const recipe of Object.values(elementalModel.RECIPES)) {
    const price = elementalModel.cost(recipe.id);
    const priceText = Object.entries(price).map(([id, amount]) =>
      `${amount} × ${(elementalModel.ESSENCES[id] || elementalModel.MATERIALS[id]).name}`).join(", ");
    elementalCrafting.append(homeCard(
      `${recipe.name} · ${recipe.type === "weapon" ? "оружие" : "броня"}`,
      `Цена (допущение координатора): ${priceText}. ` +
        (recipe.type === "weapon" ? "Стихийный урон" : "Стихийная защита") +
        ` ${elementalModel.COMBAT_BONUS * 100}%, только PvE.`,
      [homesteadButton("Создать", "craft-elemental-gear", { recipeId: recipe.id },
        elementalLevel < elementalModel.CRAFT_LEVEL ||
        Object.entries(price).some(([id, amount]) => elementalState.balances[id] < amount))],
    ));
  }
  const selectedElemental = new Set(elementalModel.preparedGear(elementalState).map((gear) => gear.id));
  for (const gear of elementalModel.inventory(elementalState)) {
    const recipe = elementalModel.RECIPES[gear.recipeId];
    const selected = selectedElemental.has(gear.id);
    elementalCrafting.append(homeCard(
      recipe.name, selected ? "Подготовлено к новому спуску." : "В постоянном стихийном запасе.",
      [homesteadButton(selected ? "Снять" : "Подготовить", "equip-elemental-gear",
        { slot: recipe.type, gearId: selected ? "" : gear.id })],
    ));
  }
  ui.homesteadContent.append(elementalCrafting);
  if (!bestHome) return;

  const holdings = homeSection("Личные владения", `Куплено домов: ${homestead.homes.length} · используется ${homeType.name} · открыто ${model.getPlotLimit(homestead)} участков.`);
  const enter = homestead.atHome
    ? homesteadButton("Ты находишься дома", "noop", {}, true)
    : homesteadButton("Войти в дом", "enter");
  holdings.append(homeCard("Автоматический выбор дома",
    `Всегда активен самый высокий купленный уровень: ${homeType.name}. Смена дома не удаляет купленные участки.`,
    [enter]));
  if (homestead.plots.length < model.getPlotLimit(homestead)) {
    holdings.append(homeCard(`Новый участок · 100 осколков`,
      `Куплено участков: ${homestead.plots.length} / ${model.getPlotLimit(homestead)}. Участок сохраняет номер и не пропадает при смене дома.`,
      [homesteadButton("Купить участок · 100 осколков", "buy-plot", {}, metaProgress.essence < 100)]));
  }
  if (!homestead.atHome) {
    holdings.append(homeCard("Работы и сбор доступны только дома",
      "Войди в дом, чтобы заниматься участками. Покупать дома и участки можно и сейчас."));
    ui.homesteadContent.append(holdings);
    return;
  }

  holdings.append(homeCard("Домашний сбор · раз в 24 часа",
    "Собирай ровно 5 брёвен, 5 камня, 3 руды, 3 льна, 1 семя и 3 приманки. Никаких бесконечных бесплатных материалов; сбор доступен только дома.",
    [homesteadButton(
      homestead.gatheredAt !== null && now - homestead.gatheredAt < model.DAY
        ? `Следующий сбор через ${formatHomeCountdown(homestead.gatheredAt + model.DAY, now)}`
        : "Собрать дневные материалы",
      "gather",
      {},
      Boolean(homestead.gatheredAt !== null && now - homestead.gatheredAt < model.DAY) ||
        model.resourceTotal(homestead) + 20 > model.getStorageCapacity(homestead),
    )]));
  const house = homeType;
  const bedroom = homeSection("Комнаты", `Уровень сна выбранного дома: ${house.sleepMs / 60000} минут. Спальня восстанавливает травмы только по завершении таймера, пока путник остаётся дома.`);
  bedroom.append(homeCard("Спальня",
    homestead.sleep
      ? now >= homestead.sleep.endsAt
        ? "Сон окончен. Нажми, чтобы завершить отдых и вылечить травмы таверны."
        : `Сон завершится через ${formatHomeCountdown(homestead.sleep.endsAt, now)}. Не покидай дом.`
      : "Отдых лечит все травмы после точного срока; выход из дома отменяет сон.",
    [homestead.sleep
      ? homesteadButton(now >= homestead.sleep.endsAt ? "Завершить сон и вылечить травмы" : "Сон продолжается",
        "finish-sleep", {}, now < homestead.sleep.endsAt)
      : homesteadButton(`Лечь спать · ${Math.floor(house.sleepMs / 60000)} минут`, "sleep")]));
  bedroom.append(homeCard("Ремесленный стол",
    "Создавай экипировку из материалов домашних мастерских. Предмет попадёт в постоянный запас таверны для подготовки к следующему спуску.",
    [homesteadButton("Открыть рецепты ремесла", "room-tab", { anchor: "craft" })]));
  bedroom.append(homeCard("Кухня",
    "Готовь лепёшку из домашнего зерна или одно специальное блюдо после завершённого сна. Каждая порция восстанавливает сытость до 100; специальное блюдо имеет 50% шанс дать выбранный временный боевой бонус на 2 часа.",
    [homesteadButton("Перейти к рецептам кухни", "room-tab", { anchor: "kitchen" })]));
  if (house.tier >= 3) {
    bedroom.append(homeCard("Почтовый ящик",
      "Отправка доступна только между владельцами особняков, состоящими в одной активной группе. Предмет сначала поступает в серверный эскроу и выдаётся только после локального сохранения отправителя.",
      [homesteadButton("Открыть почтовый ящик", "room-tab", { anchor: "mailbox" })]));
  } else {
    bedroom.append(homeCard("Почтовый ящик · нужен особняк",
      "Для отправителя и получателя требуется купленный особняк и свежий статус в одной группе."));
  }
  if (house.tier >= 2) {
    bedroom.append(homeCard("Библиотека",
      `Пустых страниц: ${homestead.pages}. Покупка не меняет характеристики. Надетая книга: ${homestead.equippedBook?.name || "нет"}.`,
      [
        homesteadButton("100 страниц · 300 золота", "buy-pages", { count: 100 }, metaProgress.tavern.gold < 300),
        homesteadButton("1 000 страниц · 3 000 золота", "buy-pages", { count: 1000 }, metaProgress.tavern.gold < 3000),
        homesteadButton("Снять надетую книгу", "unequip-book", {}, !homestead.equippedBook || homestead.books.length >= 10000),
      ]));
  }
  if (house.tier >= 3) {
    const clinic = model.useClinic(homestead, metaProgress.tavern.injuries, now);
    const clinicReadyAt = homestead.clinicAt === null ? null : homestead.clinicAt + 20 * model.HOUR;
    bedroom.append(homeCard("Лечебница",
      `Лечит все травмы раз в 20 часов. Травм сейчас: ${metaProgress.tavern.injuries} / 3.${clinicReadyAt && !clinic.ok ? ` Доступна через ${formatHomeCountdown(clinicReadyAt, now)}.` : " Приём доступен; даже без травм начинается перезарядка."}`,
      [homesteadButton("Пройти лечение · перезарядка 20 ч", "clinic", {}, !clinic.ok)]));
    bedroom.append(homeCard("Подвал особняка",
      homestead.basementPurchased
        ? "Подвал куплен отдельно. Тренировочный зал не наносит урон игроку и не выдаёт золото или опыт."
        : `Подвал отдельно открывает тренировочный зал. Цена: ${model.BASEMENT_GOLD_COST.toLocaleString("ru-RU")} золота таверны.`,
      homestead.basementPurchased
        ? [homesteadButton("Перейти к тренировочному залу", "room-tab", { anchor: "basement" })]
        : [homesteadButton(`Купить подвал · ${model.BASEMENT_GOLD_COST.toLocaleString("ru-RU")} золота`,
          "buy-basement", {}, metaProgress.tavern.gold < model.BASEMENT_GOLD_COST)]));
    bedroom.append(homeCard("Святилище",
      "Алтарь рыбалки влияет на настоящий улов. Рун, характеристик и боли в боевой системе пока нет: эти алтари честно отмечены недоступными.",
      [homesteadButton("К святилищу", "sanctuary")]));
  }
  holdings.append(bedroom);

  const workshop = homeSection("Ремесленный стол · профиль", "Все цены показаны до подтверждения. Экипировка сохраняется в постоянный запас; на материалы начисляются только рецептурные расходы.");
  workshop.dataset.roomSection = "craft";
  for (const [recipeId, recipe] of Object.entries(model.CRAFT_RECIPES)) {
    const cost = Object.entries(recipe.recipe)
      .map(([key, amount]) => `${amount} ${HOME_RESOURCE_NAMES[key]}`).join(" + ");
    const tierLocked = house.tier < recipe.tier;
    workshop.append(homeCard(`${recipe.name} · ${recipe.type === "weapon" ? "урон" : "защита"} +${recipe.bonus}`,
      `Рецепт: ${cost}. ${tierLocked ? "Нужен добротный дом или особняк." : "Материалы списываются только после подтверждения."}`,
      [homesteadButton(`Создать · ${cost}`, "craft-gear", { recipeId },
        tierLocked || metaProgress.tavern.stash.length >= 10000 ||
          Object.entries(recipe.recipe).some(([key, amount]) => homestead.resources[key] < amount))]));
  }

  const kitchen = homeSection("Кухня", "Лепёшка пока требует 1 семя (seeds) из домашнего сбора: отдельного снопа зерна в инвентаре нет. Это адаптация к существующему ингредиенту. Сытость 100%, без таймера и лимита. Окно специальной еды — 2 часа после подтверждения сна; выход и возвращение его не отменяют.");
  kitchen.dataset.roomSection = "kitchen";
  if (homestead.kitchenConflicts.length) {
    kitchen.append(homeCard("Конфликт офлайн-готовки",
      `${homestead.kitchenConflicts.length} квитанций готовки не добавили порции: разные устройства потратили одни и те же ингредиенты. Уже съеденную еду отменить нельзя. Это не защита от одновременного офлайн-расхода.`));
  }
  const buffLabels = { attack: "атаки", defense: "защиты", dodge: "уклонения" };
  const growthLabels = { attack: "силы", defense: "выносливости", dodge: "ловкости" };
  for (const [mealId, meal] of Object.entries(model.MEALS)) {
    const ingredients = Object.entries(meal.recipe)
      .map(([key, amount]) => `${amount} ${HOME_RESOURCE_NAMES[key]}`).join(" + ");
    const afterRest = meal.afterRest;
    const lockedByRest = afterRest && !model.canUseRestMeal(homestead, now);
    const effect = meal.stat
      ? `Недоступно: нет системы роста силы, ловкости и выносливости. Требуемый эффект — +50% к шансу роста ${growthLabels[meal.stat]} на 2 часа, не прямой боевой бонус. Старые порции можно съесть только для сытости.`
      : "Восстанавливает сытость до 100 без боевого усиления.";
    kitchen.append(homeCard(`${meal.name} · запас ${homestead.meals[mealId]}`,
      `Цена: ${ingredients}. ${effect}${afterRest && homestead.lastCompletedSleepAt !== null && !lockedByRest
        ? " Отдых завершён: специальное блюдо можно приготовить сейчас."
        : afterRest ? " Сначала заверши сон." : ""}`,
      [
        homesteadButton(`Приготовить · ${ingredients}`, "cook-meal", { mealId },
          afterRest || lockedByRest || Object.entries(meal.recipe).some(([key, amount]) => homestead.resources[key] < amount)),
        homesteadButton("Съесть · сытость 100%", "eat-meal", { mealId }, homestead.meals[mealId] < 1),
      ]));
  }
  if (homestead.mealBuff) {
    const statName = buffLabels[homestead.mealBuff.stat] || homestead.mealBuff.stat;
    kitchen.append(homeCard("Старый боевой эффект еды (не шанс роста характеристики)",
      homestead.mealBuff.expiresAt > now
        ? `+50% к ${statName} действует ещё ${formatHomeCountdown(homestead.mealBuff.expiresAt, now)}.`
        : `Эффект +50% к ${statName} завершился; время окончания ${new Date(homestead.mealBuff.expiresAt).toLocaleString("ru-RU")}.`));
  }

  if (house.tier >= 2) {
    const library = homeSection("Библиотека");
    library.dataset.roomSection = "library";
    library.append(homeCard(`Пустые страницы · ${homestead.pages} в запасе`,
      "100 страниц стоят ровно 300 золота; 1 000 страниц — ровно 3 000 золота. Покупка не расходует осколки и не меняет постоянные характеристики.",
      [
        homesteadButton("Купить 100 · 300 золота", "buy-pages", { count: 100 }, metaProgress.tavern.gold < 300),
        homesteadButton("Купить 1 000 · 3 000 золота", "buy-pages", { count: 1000 }, metaProgress.tavern.gold < 3000),
      ]));
    library.append(homeCard(`Надетая книга · ${homestead.equippedBook?.name || "нет"}`,
      homestead.books.length ? `Книг в инвентаре: ${homestead.books.length}.` : "Книг в инвентаре нет.",
      [homesteadButton("Снять книгу в инвентарь", "unequip-book", {},
        !homestead.equippedBook || homestead.books.length >= 10000)]));
    holdings.append(library);
  }

  if (house.tier >= 3) {
    const mailbox = homeSection("Почтовый ящик");
    mailbox.dataset.roomSection = "mailbox";
    mailbox.append(homeCard("Условия безопасной доставки",
      `Оба игрока должны владеть особняком, иметь сохранённый уровень ${window.WellSoulCraftingModel.TRANSFER_LEVEL}+ и быть в одной группе с heartbeat до 75 секунд. ` +
        "Экипировка и души идут через серверный эскроу и выдаются только после облачного сохранения; партнёрские сохранения не читаются.",
      [homesteadButton(mailboxLoading ? "Обновление входящих…" : "Обновить входящие", "mail-refresh", {}, mailboxLoading)]));
    const mailboxContext = window.WellPlayerGroups?.getMailboxContext?.();
    const partners = mailboxContext?.fresh
      ? mailboxContext.members.filter((member) => member.user_id !== mailboxContext.userId)
      : [];
    const transferRun = getMailboxRunState();
    const availableGear = transferRun
      ? [
        ...["weapon", "armor"].map((type) => transferRun.equipment?.[type]).filter(Boolean)
          .map((gear) => ({ gear, source: "equipment" })),
        ...(transferRun.inventory || []).map((gear) => ({ gear, source: "inventory" })),
      ]
      : [];
    const availableSouls = Object.keys(window.WellSoulCraftingModel.SOULS)
      .filter((soulId) => metaProgress.souls.balances[soulId] > 0);
    if (!partners.length) {
      mailbox.append(homeCard("Получатель не найден",
        mailboxContext?.members?.length
          ? "Обнови группу и дождись свежего heartbeat партнёра."
          : "Войди в аккаунт и создай или вступи в группу из двух игроков."));
    } else if (!availableGear.length && !availableSouls.length) {
      mailbox.append(homeCard("Нет переносимых предметов",
        "Для отправки нужен сохранённый предмет экипировки или хотя бы одна душа."));
    }
    if (partners.length && availableGear.length) {
      for (const partner of partners) {
        for (const entry of availableGear) {
          mailbox.append(homeCard(`Отправить ${entry.gear.name} к ${partner.nickname}`,
            `${entry.gear.type === "weapon" ? "Оружие" : "Броня"} · +${entry.gear.bonus}. Подтверди цену 0; предмет сначала будет принят серверным эскроу.`,
            [homesteadButton("Передать предмет", "mail-send", {
              gearId: entry.gear.id,
              recipientId: partner.user_id,
              recipientName: partner.nickname,
            }, !mailboxContext.fresh)]));
        }
      }
    }
    if (partners.length) {
      const playerLevel = metaProgress.tavern.characterLevel;
      for (const partner of partners) {
        if (playerLevel < window.WellSoulCraftingModel.TRANSFER_LEVEL ||
          !Number.isInteger(partner.level) || partner.level < window.WellSoulCraftingModel.TRANSFER_LEVEL) {
          mailbox.append(homeCard(`Души · передача к ${partner.nickname} недоступна`,
            `Отправитель и получатель должны иметь уровень ${window.WellSoulCraftingModel.TRANSFER_LEVEL}+ ` +
              `(сейчас: ${playerLevel} / ${Number.isInteger(partner.level) ? partner.level : "неизвестно"}).`));
          continue;
        }
        for (const soulId of availableSouls) {
          const soul = window.WellSoulCraftingModel.SOULS[soulId];
          mailbox.append(homeCard(`Передать ${soul.name} к ${partner.nickname}`,
            `В наличии: ${metaProgress.souls.balances[soulId]}. Передаётся одна душа через серверный эскроу.`,
            [homesteadButton("Передать одну душу", "mail-send-soul", {
              soulId,
              recipientId: partner.user_id,
              recipientName: partner.nickname,
              recipientLevel: partner.level,
            })]));
        }
      }
    }
    const pendingMail = loadPendingMailboxOperations();
    for (const pending of pendingMail) {
      mailbox.append(homeCard(`Отправка · ${pending.gear?.name || pending.itemId}`,
        pending.removed
          ? "Предмет удалён локально; эскроу откроется только после облачного сохранения. При сбое сначала нажми «Синхронизировать» в окне облака, затем повтори."
          : "Предмет остаётся у отправителя, пока локальное и облачное удаление не сохранится.",
        [homesteadButton("Повторить безопасное подтверждение", "mail-retry", { key: pending.key })]));
    }
    for (const incoming of mailboxInbox) {
      const isSoul = incoming.gear?.type === "soul";
      const soulClaimLocked = isSoul && incoming.status === "ready" &&
        metaProgress.tavern.characterLevel < window.WellSoulCraftingModel.TRANSFER_LEVEL;
      mailbox.append(homeCard(`Входящее · ${incoming.gear?.name || "экипировка"} · от ${incoming.sender_nickname || "сопартийца"}`,
        incoming.status === "delivered"
          ? "Уже сохранено; повторная выдача защищена квитанцией."
          : isSoul
            ? `Серверный эскроу хранит одну душу. Получение доступно с уровня ${window.WellSoulCraftingModel.TRANSFER_LEVEL}+; после сохранения душа попадёт в запас ремесла.`
            : `Серверный эскроу хранит ${incoming.gear?.type === "armor" ? "броню" : "оружие"} +${incoming.gear?.bonus || "?"}; после подтверждения предмет останется в постоянном запасе таверны.`,
        [homesteadButton(incoming.status === "delivered" ? "Проверить квитанцию" : "Принять в постоянный запас",
          "mail-claim", { mailId: incoming.id }, soulClaimLocked)]));
    }
    holdings.append(mailbox);
  }

  if (house.tier >= 3 && homestead.basementPurchased) {
    const basement = homeSection("Тренировочный зал · подвал");
    basement.dataset.roomSection = "basement";
    const armor = model.DUMMY_ARMOR[homestead.dummyArmor];
    basement.append(homeCard(`Манекен · ${homestead.dummyHp.toLocaleString("ru-RU")} / 100 000 HP`,
      `Броня манекена: ${armor.name} (снижает тренировочный урон на ${armor.reduction}). Удары не ранят игрока, не дают золото или опыт.${homestead.dummyAchievement ? " Достижение «Манекен повержен» уже сохранено." : ""}`,
      [
        ...Object.entries(model.DUMMY_ARMOR).map(([id, definition]) =>
          homesteadButton(`Броня: ${definition.name}`, "dummy-armor", { armorId: id }, homestead.dummyArmor === id)),
        homesteadButton("Ударить манекен", "dummy-hit", {}, homestead.dummyHp === 0),
        homesteadButton("Восстановить манекен · 100 000 HP", "dummy-reset", {}, homestead.dummyHp > 0),
      ]));
    basement.append(homeCard(`Маскировка · ${homestead.camouflage} в инвентаре`,
      `Цена: ${model.CAMOUFLAGE_GOLD_COST.toLocaleString("ru-RU")} золота. Расходуется, чтобы пропустить одного обычного врага (не босса и не элиту) в следующем спуске.`,
      [homesteadButton("Купить маскировку · 1 000 золота", "buy-camouflage", {},
        homestead.camouflage > 0 || metaProgress.tavern.gold < model.CAMOUFLAGE_GOLD_COST)]));
    holdings.append(basement);
  }

  holdings.append(workshop, kitchen);

  const plotsSection = homeSection("Участки и постройки", "На каждом участке — одна постройка. Перестройка в другой тип стоит полный рецепт новой постройки и не возвращает прежние материалы; активные посевы, вода и дневные квоты защищены.");
  const resources = model.RESOURCE_KEYS.map((key) =>
    `${HOME_RESOURCE_NAMES[key]}: ${homestead.resources[key]}`
  ).join(" · ");
  const inventory = document.createElement("p");
  inventory.className = "homestead-note";
  inventory.textContent = `Материалы: ${resources}`;
  plotsSection.append(inventory);
  if (!homestead.plots.length) {
    plotsSection.append(homeCard("Участков пока нет", "Купи участок выше за 100 осколков, чтобы построить сооружение."));
  }
  const buildingLabels = model.BUILDINGS;
  for (const plot of homestead.plots) {
    const inactive = plot.index >= model.getPlotLimit(homestead);
    const built = plot.building ? `${buildingLabels[plot.building].name} · ур. ${plot.level}` : "Пустой участок";
    const actions = [];
    if (!inactive && !plot.building) {
      for (const [buildingId, definition] of Object.entries(buildingLabels)) {
        const price = Object.entries(definition.recipe)
          .map(([key, amount]) => `${amount} ${HOME_RESOURCE_NAMES[key]}`).join(" + ");
        actions.push(homesteadButton(`Построить ${definition.name} · ${price}`, "build",
          { index: plot.index, building: buildingId },
          Object.entries(definition.recipe).some(([key, amount]) => homestead.resources[key] < amount)));
      }
    } else if (!inactive && plot.building) {
      const definition = buildingLabels[plot.building];
      const price = Object.entries(definition.recipe)
        .map(([key, amount]) => `${amount} ${HOME_RESOURCE_NAMES[key]}`).join(" + ");
      const capped = plot.level >= definition.maxLevel;
      actions.push(homesteadButton(capped ? "Достигнут предел уровня" : `Улучшить · ${price}`,
        "build", { index: plot.index, building: plot.building },
        capped || Object.entries(definition.recipe).some(([key, amount]) => homestead.resources[key] < amount)));
      for (const [buildingId, replacement] of Object.entries(buildingLabels)) {
        if (buildingId === plot.building) continue;
        const replacementPrice = Object.entries(replacement.recipe)
          .map(([key, amount]) => `${amount} ${HOME_RESOURCE_NAMES[key]}`).join(" + ");
        const canReplace = model.canReplaceBuilding(homestead, plot.index, buildingId, now);
        actions.push(homesteadButton(`Перестроить в ${replacement.name} · ${replacementPrice}`, "build",
          { index: plot.index, building: buildingId },
          !canReplace.ok ||
            Object.entries(replacement.recipe).some(([key, amount]) => homestead.resources[key] < amount)));
      }
      if (plot.building === "boards" || plot.building === "blocks" ||
        plot.building === "ingots" || plot.building === "cloth") {
        const today = new Date(now).toISOString().slice(0, 10);
        const used = plot.daily.day === today ? plot.daily.processed : 0;
        const quota = 2 + plot.level;
        const raw = definition.input;
        actions.push(homesteadButton(`Переработать 3 ${HOME_RESOURCE_NAMES[raw]} → 1 ${HOME_RESOURCE_NAMES[definition.output]} · ${used}/${quota} сегодня`,
          "process", { index: plot.index }, used >= quota || homestead.resources[raw] < 3));
      } else if (plot.building === "pond") {
        const waterReady = plot.waterAt === null || now - plot.waterAt >= 8 * model.HOUR;
        const fishReady = plot.fishedAt === null || now - plot.fishedAt >= 8 * model.HOUR;
        actions.push(homesteadButton(
          waterReady ? "Набрать 300 воды (кулдаун 8 ч)" : `Вода через ${formatHomeCountdown(plot.waterAt + 8 * model.HOUR, now)}`,
          "draw-water", { index: plot.index }, !waterReady || plot.water >= 1000));
        const baitCost = 2 + plot.level;
        actions.push(homesteadButton(
          fishReady ? `Ловить · ≥300 воды, ${baitCost} приманки, кулдаун 8 ч` : `Ловля через ${formatHomeCountdown(plot.fishedAt + 8 * model.HOUR, now)}`,
          "fish", { index: plot.index }, !fishReady || plot.water < 300 || homestead.resources.bait < baitCost));
        const waterNote = document.createElement("p");
        waterNote.className = "homestead-note";
        waterNote.textContent = `В пруду ${plot.water} / 1 000 воды. Ловля даёт ${2 + plot.level} рыбы; источник воды: 300 каждые 8 часов, только пока ты дома.`;
        plotsSection.append(homeCard(`Участок ${plot.index + 1} · ${built}`, "", actions), waterNote);
        continue;
      } else if (plot.building === "garden") {
        const crop = plot.crop;
        if (!crop) {
          actions.push(homesteadButton("Посеять · 1 семя", "plant", { index: plot.index },
            homestead.resources.seeds < 1));
        } else if (crop.secondWateredAt === null) {
          const elapsed = now - crop.plantedAt;
          actions.push(homesteadButton(
            elapsed < 10 * model.HOUR ? `Второй полив через ${formatHomeCountdown(crop.plantedAt + 10 * model.HOUR, now)}`
              : elapsed > 12 * model.HOUR ? "Окно полива пропущено" : "Полить второй раз (10–12 ч)",
            elapsed > 12 * model.HOUR ? "discard-crop" : "water-garden",
            { index: plot.index },
            elapsed < 10 * model.HOUR));
        } else {
          actions.push(homesteadButton(
            now - crop.plantedAt < 20 * model.HOUR
              ? `Урожай через ${formatHomeCountdown(crop.plantedAt + 20 * model.HOUR, now)}`
              : `Собрать ${2 + plot.level} растений`,
            "harvest-garden", { index: plot.index }, now - crop.plantedAt < 20 * model.HOUR));
        }
      }
    }
    if (inactive) {
      plotsSection.append(homeCard(`Участок ${plot.index + 1} · не активен`,
        "Этот ранее купленный участок сохранён, но доступен после приобретения дома более высокого уровня."));
    } else {
      plotsSection.append(homeCard(`Участок ${plot.index + 1} · ${built}`, "", actions));
    }
    if (plot.building === "garden" && plot.crop) {
      const cropNote = document.createElement("p");
      cropNote.className = "homestead-note";
      cropNote.textContent = `Посев от ${new Date(plot.crop.plantedAt).toLocaleString("ru-RU")}; первый полив уже выполнен. Второй обязателен через 10–12 часов.`;
      plotsSection.append(cropNote);
    }
  }
  holdings.append(plotsSection);

  if (house.tier >= 3) {
    const sanctuary = homeSection("Алтари особняка");
    for (const [id, altar] of Object.entries(model.ALTARS)) {
      const level = homestead.altars[id];
      if (id === "fishing") {
        const cost = 100 * (level + 1);
        sanctuary.append(homeCard(`Алтарь рыбалки · ур. ${level} / ${altar.maxLevel}`,
          `${model.ALTAR_EFFECTS[id]} Следующее улучшение: ${cost} осколков.`,
          [homesteadButton(level >= altar.maxLevel ? "Предел уровня" : `Улучшить · ${cost} осколков`,
            "upgrade-altar", { altar: id, cost },
            level >= altar.maxLevel || metaProgress.essence < cost)]));
      } else {
        sanctuary.append(homeCard(`Алтарь ${altar.name} · ур. ${level} / ${altar.maxLevel} · недоступен`,
          `${model.ALTAR_EFFECTS[id]} Списание осколков отключено, пока нет работающего эффекта.`));
      }
    }
    holdings.append(sanctuary);
  }
  ui.homesteadContent.append(holdings);
  if (homesteadAnchor) {
    const target = [...ui.homesteadContent.querySelectorAll("[data-room-section]")]
      .find((section) => section.dataset.roomSection === homesteadAnchor);
    if (target) window.setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }
}

function saveHomesteadResult(result, message, options = {}) {
  if (!result.ok) {
    homesteadMessage = result.reason;
    renderHomestead();
    return false;
  }
  const previous = metaProgress;
  let tavern = result.tavern ? JSON.parse(JSON.stringify(result.tavern)) : previous.tavern;
  if (!result.tavern && result.gold !== undefined && result.gold !== previous.tavern.gold) {
    tavern = {
      ...previous.tavern,
      gold: result.gold,
      revision: previous.tavern.revision + 1,
      updatedAt: Date.now(),
    };
  }
  if (options.healInjuries) {
    tavern = {
      ...tavern,
      injuries: 0,
      revision: tavern.revision + 1,
      updatedAt: Date.now(),
    };
  }
  metaProgress = {
    ...previous,
    essence: result.essence === undefined ? previous.essence : result.essence,
    tavern,
    homestead: result.state,
  };
  if (!persistMetaProgress()) {
    metaProgress = previous;
    homesteadMessage = "Не удалось сохранить изменение дома. Ничего не списано и действие не применено.";
    renderHomestead();
    return false;
  }
  homesteadMessage = message;
  render();
  renderHomestead();
  return true;
}

function latestHomesteadBalances() {
  let stored;
  try {
    stored = JSON.parse(window.localStorage.getItem(META_SAVE_KEY) || "null");
  } catch {
    throw new Error("Не удалось проверить сохранённый кошелёк. Покупка не выполнена.");
  }
  if (stored === null) {
    return { essence: metaProgress.essence, gold: metaProgress.tavern.gold };
  }
  if (!isValidMetaProgress(stored)) {
    throw new Error("Сохранённый кошелёк повреждён; покупка заблокирована без списания.");
  }
  metaProgress = mergeMetaProgress(metaProgress, stored);
  return {
    essence: metaProgress.essence,
    gold: metaProgress.tavern.gold,
  };
}

function getMailboxRunState() {
  return !state.started && savedRun && isValidRun({ version: SAVE_VERSION, state: savedRun })
    ? savedRun
    : null;
}

function mailboxStoragePrefix(userId) {
  return `well-of-whispers-mail-outbox:${userId}:`;
}

function loadPendingMailboxOperations() {
  const context = window.WellPlayerGroups?.getMailboxContext?.();
  if (!context?.userId) return [];
  const prefix = mailboxStoragePrefix(context.userId);
  const pending = [];
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(prefix)) continue;
      const operation = JSON.parse(window.localStorage.getItem(key) || "null");
      if (operation && operation.key === key && typeof operation.itemId === "string" &&
        typeof operation.recipientId === "string" && typeof operation.requestId === "string" &&
        (isValidGear(operation.gear) || isValidSoulMailItem(operation.gear))) pending.push(operation);
    }
  } catch (error) {
    console.warn("Не удалось прочитать очередь почтового ящика.", error);
    homesteadMessage = "Не удалось проверить незавершённые отправки; новые письма временно заблокированы.";
  }
  return pending;
}

function persistMailboxOperation(operation) {
  try {
    window.localStorage.setItem(operation.key, JSON.stringify(operation));
    return true;
  } catch (error) {
    console.warn("Не удалось сохранить состояние отправки предмета.", error);
    throw new Error("Не удалось сохранить локальную квитанцию отправки. Предмет не будет снят с вашего сохранения.");
  }
}

function mailboxRequestId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes].map((value, index) => {
    const hex = value.toString(16).padStart(2, "0");
    return [4, 6, 8, 10].includes(index) ? `-${hex}` : hex;
  }).join("");
}

async function mailboxRpc(name, args = {}) {
  const api = window.WellPlayerGroups;
  if (!api?.mailboxRpc) throw new Error("Почтовый ящик не настроен в клиенте групп.");
  return api.mailboxRpc(name, args);
}

function writeSavedMailboxRun(nextRun) {
  try {
    window.localStorage.setItem(RUN_SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, state: nextRun }));
  } catch (error) {
    console.warn("Не удалось сохранить спуск после подготовки почты.", error);
    return false;
  }
  savedRun = nextRun;
  if (window.WellCloudSave) window.WellCloudSave.scheduleSave(getCloudSaveSnapshot());
  return true;
}

async function finishMailboxSend(operation) {
  let escrow = operation.escrowId
    ? { id: operation.escrowId }
    : await mailboxRpc("player_mailbox_send", {
      p_recipient_id: operation.recipientId,
      p_request_id: operation.requestId,
      p_gear: operation.gear,
    });
  if (!escrow || typeof escrow.id !== "string") throw new Error("Сервер не подтвердил приём предмета в эскроу.");
  operation.escrowId = escrow.id;
  persistMailboxOperation(operation);

  if (operation.kind === "soul") {
    const result = window.WellSoulCraftingModel.transferOut(
      metaProgress.souls,
      metaProgress.tavern.characterLevel,
      operation.recipientLevel,
      operation.soulId,
      `mail-out-${operation.requestId}`,
      operation.createdAt,
    );
    if (!result.ok) throw new Error(result.reason);
    if (!result.duplicate) {
      const previous = metaProgress;
      metaProgress = { ...previous, souls: result.state };
      if (!persistMetaProgress()) {
        metaProgress = previous;
        throw new Error("Не удалось сохранить списание души. Предмет остался у отправителя.");
      }
    }
  } else {
    const currentRun = getMailboxRunState();
    const itemStillExists = currentRun &&
      [...(currentRun.inventory || []), currentRun.equipment?.weapon, currentRun.equipment?.armor]
        .filter(Boolean).some((item) => item.id === operation.itemId);
    if (itemStillExists) {
      const nextRun = JSON.parse(JSON.stringify(currentRun));
      nextRun.inventory = nextRun.inventory.filter((item) => item.id !== operation.itemId);
      for (const type of ["weapon", "armor"]) {
        if (nextRun.equipment?.[type]?.id === operation.itemId) nextRun.equipment[type] = null;
      }
      if (!writeSavedMailboxRun(nextRun)) {
        throw new Error("Предмет принят сервером в ожидающий эскроу, но локальный спуск не сохранился. Предмет остался у вас; повтори подтверждение позже.");
      }
    }
  }
  operation.removed = true;
  persistMailboxOperation(operation);
  if (!window.WellCloudSave?.saveNow) {
    throw new Error("Немедленное облачное сохранение недоступно; эскроу остаётся закрытым.");
  }
  await window.WellCloudSave.saveNow(getCloudSaveSnapshot());

  const receipt = await mailboxRpc("player_mailbox_sender_removed", { p_mail_id: operation.escrowId });
  if (!receipt || !["ready", "claimed", "delivered"].includes(receipt.status)) {
    throw new Error("Сервер не подтвердил завершение отправки. Повтори подтверждение; идентификатор эскроу сохранён.");
  }
  window.localStorage.removeItem(operation.key);
  return receipt;
}

async function sendMailboxGear(gearId, recipientId, recipientName) {
  const context = window.WellPlayerGroups?.getMailboxContext?.();
  const run = getMailboxRunState();
  if (!metaProgress.homestead.atHome || window.WellHomesteadModel.getBestHome(metaProgress.homestead)?.tier !== "mansion") {
    throw new Error("Отправка доступна только из почтового ящика особняка.");
  }
  if (!context?.fresh || !context.members.some((member) => member.user_id === recipientId)) {
    throw new Error("Получатель не найден в группе с актуальным heartbeat.");
  }
  if (!run) throw new Error("Для отправки нужен сохранённый спуск между боями.");
  const gear = [
    ...(run.inventory || []),
    run.equipment?.weapon,
    run.equipment?.armor,
  ].filter(Boolean).find((item) => item.id === gearId);
  if (!isValidGear(gear)) throw new Error("Можно отправить только валидную экипировку из сохранённого инвентаря.");
  if (!window.confirm(`Передать ${gear.name} (+${gear.bonus}) игроку ${recipientName || "из вашей группы"}? Цена отправки — 0. Предмет останется вашим, пока локальное удаление не сохранится.`)) return;
  const key = `${mailboxStoragePrefix(context.userId)}${encodeURIComponent(gear.id)}:${encodeURIComponent(recipientId)}`;
  let operation;
  try {
    operation = JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    throw new Error("Локальная квитанция почты повреждена; предмет не отправлен.");
  }
  if (!operation) {
    operation = {
      key,
      requestId: mailboxRequestId(),
      itemId: gear.id,
      kind: "gear",
      recipientId,
      gear: JSON.parse(JSON.stringify(gear)),
      createdAt: Date.now(),
      removed: false,
    };
    persistMailboxOperation(operation);
  }
  const receipt = await finishMailboxSend(operation);
  homesteadMessage = `Экипировка сохранена в серверном эскроу и открыта получателю. Статус: ${receipt.status}.`;
}

async function sendMailboxSoul(soulId, recipientId, recipientName, recipientLevel) {
  const context = window.WellPlayerGroups?.getMailboxContext?.();
  const partner = context?.members?.find((member) => member.user_id === recipientId);
  if (!metaProgress.homestead.atHome ||
    window.WellHomesteadModel.getBestHome(metaProgress.homestead)?.tier !== "mansion") {
    throw new Error("Передача доступна только из почтового ящика особняка.");
  }
  if (!context?.fresh || !partner || partner.level !== recipientLevel) {
    throw new Error("Получатель не найден в группе с актуальным уровнем и heartbeat.");
  }
  if (metaProgress.tavern.characterLevel < window.WellSoulCraftingModel.TRANSFER_LEVEL ||
    recipientLevel < window.WellSoulCraftingModel.TRANSFER_LEVEL) {
    throw new Error(`Оба игрока должны иметь уровень ${window.WellSoulCraftingModel.TRANSFER_LEVEL}+.`);
  }
  const soul = window.WellSoulCraftingModel.SOULS[soulId];
  if (!soul) throw new Error("Неизвестная душа.");
  if (!window.confirm(`Передать одну «${soul.name}» игроку ${recipientName || "из вашей группы"}? Цена — 0.`)) return;
  const requestId = mailboxRequestId();
  const soulItem = {
    id: `soul-${soulId}-${requestId}`,
    type: "soul",
    soul: soulId,
    name: soul.name,
    amount: 1,
  };
  const key = `${mailboxStoragePrefix(context.userId)}${encodeURIComponent(soulItem.id)}:${encodeURIComponent(recipientId)}`;
  const operation = {
    key,
    requestId,
    itemId: soulItem.id,
    kind: "soul",
    soulId,
    recipientId,
    recipientLevel,
    gear: soulItem,
    createdAt: Date.now(),
    removed: false,
  };
  persistMailboxOperation(operation);
  const receipt = await finishMailboxSend(operation);
  homesteadMessage = `${soul.name} передана в серверный эскроу. Статус: ${receipt.status}.`;
}

async function retryMailboxSend(key) {
  if (typeof key !== "string" || !key.startsWith("well-of-whispers-mail-outbox:")) {
    throw new Error("Неверная квитанция отправки.");
  }
  let operation;
  try {
    operation = JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    throw new Error("Не удалось прочитать квитанцию отправки.");
  }
  if (!operation || operation.key !== key ||
    !(isValidGear(operation.gear) || isValidSoulMailItem(operation.gear))) {
    throw new Error("Квитанция отправки отсутствует или повреждена.");
  }
  const receipt = await finishMailboxSend(operation);
  homesteadMessage = `Отправка подтверждена. Статус эскроу: ${receipt.status}.`;
}

async function refreshMailbox() {
  mailboxLoading = true;
  renderHomestead();
  try {
    const result = await mailboxRpc("player_mailbox_list");
    if (!Array.isArray(result) || result.some((row) =>
      !row || typeof row.id !== "string" || typeof row.status !== "string"
    )) throw new Error("Сервер вернул неверный список писем.");
    mailboxInbox = result.filter((row) => ["ready", "claimed", "delivered"].includes(row.status));
    homesteadMessage = `Почтовый ящик обновлён: писем для получения — ${mailboxInbox.length}.`;
  } finally {
    mailboxLoading = false;
    renderHomestead();
  }
}

async function claimMailboxItem(mailId) {
  const claim = await mailboxRpc("player_mailbox_claim", { p_mail_id: mailId });
  if (!claim || claim.id !== mailId ||
    !(isValidGear(claim.gear) || isValidSoulMailItem(claim.gear))) {
    throw new Error("Сервер не вернул валидный предмет для получения.");
  }
  if (isValidSoulMailItem(claim.gear)) {
    const result = window.WellSoulCraftingModel.receive(
      metaProgress.souls,
      metaProgress.tavern.characterLevel,
      claim.gear.soul,
      `mail-in-${mailId}`,
      0,
    );
    if (!result.ok) throw new Error(result.reason);
    if (!result.duplicate) {
      const previous = metaProgress;
      metaProgress = { ...previous, souls: result.state };
      if (!persistMetaProgress()) {
        metaProgress = previous;
        throw new Error("Не удалось сохранить полученную душу. Серверный эскроу не подтверждён и её можно забрать повторно.");
      }
    }
    if (!window.WellCloudSave?.saveNow) {
      throw new Error("Немедленное облачное сохранение недоступно; серверный эскроу не подтверждён.");
    }
    await window.WellCloudSave.saveNow(getCloudSaveSnapshot());
    const receipt = await mailboxRpc("player_mailbox_ack_claim", { p_mail_id: mailId });
    if (!receipt || receipt.acknowledged !== true) {
      throw new Error("Душа сохранена локально, но серверное подтверждение не получено. Повтори получение; квитанция исключит дубликат.");
    }
    homesteadMessage = "Получение души подтверждено; запас обновлён.";
    return;
  }
  const current = metaProgress.homestead;
  const existingReceipt = current.mailReceipts.find((receipt) => receipt.mailId === mailId);
  if (!existingReceipt) {
    if (metaProgress.tavern.stash.length >= 10000) {
      throw new Error("Постоянный запас переполнен. Эскроу хранит предмет; освободи место и повтори получение.");
    }
    const nextHome = JSON.parse(JSON.stringify(current));
    const nextTavern = JSON.parse(JSON.stringify(metaProgress.tavern));
    const highestSequence = Math.max(
      nextTavern.nextGearSequence,
      ...nextTavern.stash.map((item) => Number(item.id.slice(5))),
    );
    const gearId = `gear-${highestSequence + 1}`;
    const gear = {
      id: gearId,
      type: claim.gear.type,
      name: claim.gear.name,
      bonus: claim.gear.bonus,
    };
    nextTavern.stash.push(gear);
    nextTavern.nextGearSequence = highestSequence + 1;
    nextTavern.revision += 1;
    nextTavern.updatedAt = Date.now();
    nextHome.mailReceipts.push({ mailId, gearId });
    nextHome.revision += 1;
    nextHome.updatedAt = Date.now();
    const saved = saveHomesteadResult({ ok: true, state: nextHome, tavern: nextTavern },
      `${gear.name} сохранён в постоянном запасе таверны.`);
    if (!saved) throw new Error("Не удалось сохранить предмет получателя. Серверный эскроу не подтверждён и его можно забрать повторно.");
  }
  if (!window.WellCloudSave?.saveNow) {
    throw new Error("Немедленное облачное сохранение недоступно; серверный эскроу не подтверждён.");
  }
  await window.WellCloudSave.saveNow(getCloudSaveSnapshot());
  const receipt = await mailboxRpc("player_mailbox_ack_claim", { p_mail_id: mailId });
  if (!receipt || receipt.acknowledged !== true) {
    throw new Error("Предмет сохранён локально, но серверное подтверждение не получено. Повтори получение; квитанция исключит дубликат.");
  }
  homesteadMessage = "Получение подтверждено; предмет добавлен в постоянный запас.";
}

function openHomestead(anchor = "") {
  homesteadAnchor = anchor;
  if (state.started && !state.gameOver) {
    homesteadMessage = "Домашняя лавка доступна между спусками.";
    return;
  }
  homesteadMessage = "";
  const homestead = metaProgress.homestead;
  if (window.WellHomesteadModel.getBestHome(homestead) && !homestead.atHome) {
    const entered = window.WellHomesteadModel.enterHome(homestead);
    if (!saveHomesteadResult(entered, "")) return;
  }
  if (!ui.homesteadDialog.open) ui.homesteadDialog.showModal();
  renderHomestead();
}

function closeHomestead() {
  if (metaProgress.homestead.atHome) {
    const result = window.WellHomesteadModel.leaveHome(metaProgress.homestead);
    if (!saveHomesteadResult(result, "Ты покинул дом; незавершённый сон отменён.")) return false;
  }
  if (ui.homesteadDialog.open) ui.homesteadDialog.close();
  homesteadAnchor = "";
  selectedDistrict = "upper";
  renderCity();
  return true;
}

async function handleHomesteadAction(action, data = {}) {
  if (["make-elemental-essence", "craft-elemental-gear", "equip-elemental-gear"].includes(action) && !data.elementalLockAcquired) {
    if (!navigator.locks) {
      homesteadMessage = "Браузер не поддерживает безопасную блокировку ремесла. Материалы не списаны.";
      renderHomestead();
      return;
    }
    return navigator.locks.request("well-elemental-crafting", () =>
      handleHomesteadAction(action, { ...data, elementalLockAcquired: true }));
  }
  if (["cook-meal", "eat-meal"].includes(action) && !data.foodLockAcquired) {
    if (!navigator.locks) {
      homesteadMessage = "Браузер не поддерживает безопасную блокировку кухни. Еда не списана.";
      renderHomestead();
      return;
    }
    return navigator.locks.request("well-food", () =>
      handleHomesteadAction(action, { ...data, foodLockAcquired: true }));
  }
  if (homesteadBusy || !localMetaReadable) return;
  homesteadBusy = true;
  const model = window.WellHomesteadModel;
  let current = metaProgress.homestead;
  const now = Date.now();
  try {
    let result;
    let message = "";
    let options = {};
    if (action === "noop") return;
    if (action === "enter") {
      result = model.enterHome(current, now);
      message = "Ты вошёл в дом.";
    } else if (action === "buy-home") {
      const price = data.payment === "gold" ? "20 000 золотых таверны"
        : data.payment === "upgrade" ? "600 осколков"
          : data.tier === "sturdy" ? "400 осколков" : "1 000 осколков";
      if (!window.confirm(`Купить «${model.HOME_TYPES[data.tier]?.name}» за ${price}? Будет списан только существующий игровой баланс.`)) return;
      const balances = latestHomesteadBalances();
      current = metaProgress.homestead;
      result = model.purchaseHome(current, data.tier, data.payment, balances.essence,
        balances.gold, homesteadReceiptId(), now);
      if (result.ok) {
        result.state = model.enterHome(result.state, now).state;
        message = `${model.HOME_TYPES[data.tier].name} куплен. Теперь автоматически используется лучший дом.`;
      }
    } else if (action === "buy-plot") {
      if (!window.confirm("Купить новый участок за 100 имеющихся осколков?")) return;
      const balances = latestHomesteadBalances();
      current = metaProgress.homestead;
      result = model.buyPlot(current, balances.essence, homesteadReceiptId(), now);
      message = result.ok ? `Участок ${result.plot.index + 1} куплен.` : "";
    } else if (action === "gather") {
      result = model.gather(current, now);
      message = result.ok ? "Материалы собраны. Следующий сбор — через 24 часа." : "";
    } else if (action === "build") {
      const plotIndex = Number(data.index);
      const plot = current.plots[plotIndex];
      if (plot?.building && plot.building !== data.building) {
        const replacement = model.canReplaceBuilding(current, plotIndex, data.building, now);
        if (!replacement.ok) throw new Error(replacement.reason);
        const definition = model.BUILDINGS[data.building];
        if (!definition) throw new Error("Неизвестная постройка.");
        const recipe = Object.entries(definition.recipe)
          .map(([key, amount]) => `${amount} ${HOME_RESOURCE_NAMES[key]}`).join(" + ");
        if (!window.confirm(
          `Перестроить участок ${plotIndex + 1} в «${definition.name}» за ${recipe}? ` +
          "Полный рецепт будет списан; уровень и вложенные материалы прежней постройки не возвращаются.",
        )) return;
      }
      result = model.buildOrUpgrade(current, plotIndex, data.building, now);
      message = result.ok ? `${model.BUILDINGS[data.building].name}: уровень ${result.plot.level}. Материалы списаны по рецепту.` : "";
    } else if (action === "process") {
      result = model.processMaterials(current, Number(data.index), 1, now);
      message = result.ok ? `Переработано: ${result.output} ед. материала. Операции списаны из дневного лимита.` : "";
    } else if (action === "draw-water") {
      result = model.drawWater(current, Number(data.index), now);
      message = result.ok ? `В пруду ${result.water} / 1 000 воды.` : "";
    } else if (action === "fish") {
      result = model.fish(current, Number(data.index), now);
      message = result.ok ? `Улов: ${result.fish} рыбы${result.bait ? ` и ${result.bait} приманки` : ""}.` : "";
    } else if (action === "plant") {
      result = model.plant(current, Number(data.index), now);
      message = result.ok ? "Посев сделан и полит. Второй полив требуется через 10–12 часов." : "";
    } else if (action === "water-garden") {
      result = model.waterGarden(current, Number(data.index), now);
      message = result.ok ? "Второй полив выполнен. Урожай созреет через 20 часов после посева." : "";
    } else if (action === "discard-crop") {
      result = model.discardCrop(current, Number(data.index), now);
      message = result.ok ? "Посев удалён без возврата семени." : "";
    } else if (action === "harvest-garden") {
      result = model.harvestGarden(current, Number(data.index), now);
      message = result.ok ? `Собрано растений: ${result.herbs}.` : "";
    } else if (action === "sleep") {
      result = model.startSleep(current, now);
      message = result.ok ? `Сон начался на ${result.durationMs / 60000} минут. Не покидай дом.` : "";
    } else if (action === "finish-sleep") {
      result = model.completeSleep(current, now);
      options.healInjuries = result.ok;
      message = result.ok ? "Сон завершён; травмы вылечены." : "";
    } else if (action === "clinic") {
      result = model.useClinic(current, metaProgress.tavern.injuries, now);
      options.healInjuries = result.ok;
      message = result.ok
        ? `Приём запущен. Снято травм: ${result.healed}. Следующий доступен через 20 часов.`
        : "";
    } else if (action === "room-tab") {
      homesteadAnchor = data.anchor;
      homesteadMessage = "";
      renderHomestead();
      window.setTimeout(() => {
        const target = ui.homesteadContent.querySelector(`[data-room-section="${CSS.escape(data.anchor)}"]`);
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
      return;
    } else if (action === "craft-gear") {
      const recipe = model.CRAFT_RECIPES[data.recipeId];
      if (!recipe) throw new Error("Рецепт не найден.");
      const cost = Object.entries(recipe.recipe)
        .map(([key, amount]) => `${amount} ${HOME_RESOURCE_NAMES[key]}`).join(" + ");
      if (!window.confirm(`Создать «${recipe.name}» (+${recipe.bonus}) за ${cost}? Предмет попадёт в постоянный запас таверны.`)) return;
      if (metaProgress.tavern.stash.length >= 10000) throw new Error("Постоянный запас полон. Создание не выполнено и материалы не списаны.");
      const gearId = `gear-${metaProgress.tavern.nextGearSequence + 1}`;
      result = model.craftGear(current, data.recipeId, gearId, now);
      if (result.ok) {
        result.tavern = JSON.parse(JSON.stringify(metaProgress.tavern));
        result.tavern.stash.push(result.gear);
        result.tavern.nextGearSequence += 1;
        result.tavern.revision += 1;
        result.tavern.updatedAt = now;
        message = `${recipe.name} сохранён в постоянном запасе.`;
      }
    } else if (action === "craft-soul") {
      const soulModel = window.WellSoulCraftingModel;
      const recipe = soulModel.RECIPES[data.recipeId];
      if (!recipe) throw new Error("Рецепт R-экипировки не найден.");
      if (!window.confirm(
        `Создать «${recipe.name}» (+${recipe.bonus}) за ${recipe.amount} × ${recipe.soulName}? ` +
        "Души будут списаны только при сохранении предмета в постоянный запас.",
      )) return;
      if (metaProgress.tavern.stash.length >= 10000) {
        throw new Error("Постоянный запас полон. Души не списаны.");
      }
      const previous = metaProgress;
      const tavern = JSON.parse(JSON.stringify(previous.tavern));
      const nextSequence = Math.max(tavern.nextGearSequence,
        ...tavern.stash.map((item) => Number(item.id.slice(5))));
      const result = soulModel.craft(
        previous.souls,
        tavern.characterLevel,
        recipe.id,
        `gear-${nextSequence + 1}`,
        homesteadReceiptId(),
        now,
      );
      if (!result.ok) {
        homesteadMessage = result.reason;
        return;
      }
      tavern.stash.push(result.gear);
      tavern.nextGearSequence = nextSequence + 1;
      tavern.revision += 1;
      tavern.updatedAt = now;
      metaProgress = { ...previous, souls: result.state, tavern };
      if (!persistMetaProgress()) {
        metaProgress = previous;
        throw new Error("Не удалось сохранить R-экипировку. Души не списаны.");
      }
      homesteadMessage = `${result.gear.name} сохранён в постоянном запасе. Списано ${recipe.amount} × ${recipe.soulName}.`;
      render();
      return;
    } else if (action === "make-elemental-essence") {
      latestHomesteadBalances();
      const previous = metaProgress;
      const model = window.WellElementalGearModel;
      const material = model.MATERIALS[data.materialId];
      if (!material?.essence) throw new Error("Для этого материала нет рецепта эссенции.");
      if (!window.confirm(
        `Смешать одну «${material.name}» и одну «${model.MATERIALS.primalWater.name}»? ` +
        `Шанс получить 2 эссенции: ${model.CRITICAL_CHANCE * 100}%.`,
      )) return;
      const result = model.createEssence(
        previous.elemental,
        previous.tavern.characterLevel,
        data.materialId,
        homesteadReceiptId(),
      );
      if (!result.ok) {
        homesteadMessage = result.reason;
        return;
      }
      metaProgress = { ...previous, elemental: result.state };
      if (!persistMetaProgress()) {
        metaProgress = previous;
        throw new Error("Не удалось сохранить эссенцию. Материалы и вода не списаны.");
      }
      homesteadMessage = `${result.essence.name} создана${result.critical ? " в критическом результате: получено 2" : ""}.`;
      render();
      return;
    } else if (["craft-elemental-gear", "equip-elemental-gear"].includes(action)) {
      latestHomesteadBalances();
      const previous = metaProgress;
      const model = window.WellElementalGearModel;
      const result = action === "craft-elemental-gear"
        ? model.craft(previous.elemental, previous.tavern.characterLevel, data.recipeId, homesteadReceiptId())
        : model.equip(previous.elemental, data.slot, data.gearId || null, homesteadReceiptId());
      if (!result.ok) {
        homesteadMessage = result.reason;
        return;
      }
      metaProgress = { ...previous, elemental: result.state };
      if (!persistMetaProgress()) {
        metaProgress = previous;
        throw new Error("Не удалось сохранить стихийную экипировку. Действие не выполнено.");
      }
      homesteadMessage = action === "craft-elemental-gear"
        ? "Стихийный предмет создан в постоянном запасе. Материалы списаны."
        : "Стихийная экипировка изменена только для новых спусков.";
      render();
      return;
    } else if (action === "cook-meal") {
      latestHomesteadBalances();
      current = metaProgress.homestead;
      result = model.cookMeal(current, data.mealId, now);
      message = result.ok ? `${result.meal.name} приготовлено и добавлено в запас.` : "";
    } else if (action === "eat-meal") {
      latestHomesteadBalances();
      current = metaProgress.homestead;
      result = model.eatMeal(current, metaProgress.tavern, data.mealId, now, Math.random,
        Boolean(state.enemy && !state.gameOver) || foodCombatLocked());
      if (result.ok) {
        message = result.meal.stat
          ? "Старая порция съедена: сытость 100%. Шанс роста характеристик недоступен; боевой бонус не подменяет его."
          : "Сытость восстановлена до 100.";
      }
    } else if (action === "buy-pages") {
      const count = Number(data.count);
      const cost = count === 100 ? 300 : count === 1000 ? 3000 : null;
      if (cost === null || !window.confirm(`Купить ${count.toLocaleString("ru-RU")} пустых страниц за ${cost.toLocaleString("ru-RU")} золотых таверны?`)) return;
      const balances = latestHomesteadBalances();
      current = metaProgress.homestead;
      result = model.buyPages(current, count, balances.gold, homesteadReceiptId(), now);
      if (result.ok) {
        result.tavern = { ...metaProgress.tavern, gold: result.gold,
          revision: metaProgress.tavern.revision + 1, updatedAt: now };
        message = `Куплено страниц: ${result.count}. Осталось ${result.tavern.gold} золотых.`;
      }
    } else if (action === "unequip-book") {
      result = model.unequipBook(current, now);
      message = result.ok ? `Книга «${result.book.name}» перемещена в инвентарь.` : "";
    } else if (action === "buy-basement") {
      if (!window.confirm(`Отдельно купить подвал особняка за ${model.BASEMENT_GOLD_COST.toLocaleString("ru-RU")} золотых? Откроется тренировочный зал.`)) return;
      const balances = latestHomesteadBalances();
      current = metaProgress.homestead;
      result = model.purchaseBasement(current, balances.gold, homesteadReceiptId(), now);
      if (result.ok) {
        result.tavern = { ...metaProgress.tavern, gold: result.gold,
          revision: metaProgress.tavern.revision + 1, updatedAt: now };
        message = "Подвал особняка куплен за золото таверны.";
      }
    } else if (action === "buy-camouflage") {
      if (!window.confirm(`Купить одну маскировку за ${model.CAMOUFLAGE_GOLD_COST.toLocaleString("ru-RU")} золота? Ею можно пропустить одного обычного врага, но не элиту или босса.`)) return;
      const balances = latestHomesteadBalances();
      current = metaProgress.homestead;
      result = model.buyCamouflage(current, balances.gold, homesteadReceiptId(), now);
      if (result.ok) {
        result.tavern = { ...metaProgress.tavern, gold: result.gold,
          revision: metaProgress.tavern.revision + 1, updatedAt: now };
        message = "Маскировка добавлена в инвентарь подвала.";
      }
    } else if (action === "dummy-armor") {
      result = model.setDummyArmor(current, data.armorId, now);
      message = result.ok ? `На манекен надета броня: ${model.DUMMY_ARMOR[data.armorId].name}.` : "";
    } else if (action === "dummy-hit") {
      const attack = state.started ? getAttackPower() : state.attack;
      result = model.strikeDummy(current, Math.max(1, attack), now);
      message = result.ok
        ? `Манекен получил ${result.damage} урона; осталось ${result.state.dummyHp} HP.${result.achievementAwarded ? " Достижение «Манекен повержен» получено!" : ""}`
        : "";
    } else if (action === "dummy-reset") {
      result = model.resetDummy(current, now);
      message = result.ok ? "Манекен восстановлен до 100 000 HP. Достижение сохраняется." : "";
    } else if (action === "mail-send") {
      await sendMailboxGear(data.gearId, data.recipientId, data.recipientName);
      renderHomestead();
      return;
    } else if (action === "mail-send-soul") {
      await sendMailboxSoul(data.soulId, data.recipientId, data.recipientName, Number(data.recipientLevel));
      renderHomestead();
      return;
    } else if (action === "mail-retry") {
      await retryMailboxSend(data.key);
      renderHomestead();
      return;
    } else if (action === "mail-refresh") {
      await refreshMailbox();
      return;
    } else if (action === "mail-claim") {
      await claimMailboxItem(data.mailId);
      renderHomestead();
      return;
    } else if (action === "upgrade-altar") {
      const cost = Number(data.cost);
      if (!window.confirm(`Улучшить алтарь рыбалки за ${cost} имеющихся осколков?`)) return;
      const balances = latestHomesteadBalances();
      current = metaProgress.homestead;
      result = model.upgradeAltar(current, data.altar, balances.essence, homesteadReceiptId(), now);
      message = result.ok ? `Алтарь рыбалки улучшен до уровня ${result.state.altars.fishing}.` : "";
    } else if (action === "kitchen") {
      if (!model.getBestHome(current) || !current.atHome) throw new Error("Кухня доступна только в собственном доме.");
      if (!closeHomestead()) return;
      openTavern();
      return;
    } else if (action === "sanctuary") {
      homesteadMessage = "Алтари доступны в разделе «Алтари особняка» ниже.";
      renderHomestead();
      ui.homesteadContent.scrollTo({ top: ui.homesteadContent.scrollHeight, behavior: "smooth" });
      return;
    } else {
      throw new Error("Неизвестное действие домашней лавки.");
    }
    if (!result) return;
    saveHomesteadResult(result, message, options);
  } catch (error) {
    homesteadMessage = error.message;
  } finally {
    homesteadBusy = false;
    renderHomestead();
  }
}

function openHarbor() {
  if (state.started && !state.gameOver) return;
  selectedDistrict = "port";
  renderCity();
  harborMessage = "";
  if (!ui.harborDialog.open) ui.harborDialog.showModal();
  renderHarbor();
}

function closeHarbor() {
  if (ui.harborDialog.open) ui.harborDialog.close();
  selectedDistrict = "port";
  renderCity();
}

function renderHarbor() {
  if (!ui.harborDialog || !metaProgress?.harbor) return;
  const model = window.WellExpeditionsModel;
  const harbor = metaProgress.harbor;
  const expeditions = model.EXPEDITIONS;
  ui.harborTickets.textContent = String(model.ticketBalance(harbor));
  ui.harborEssence.textContent = `${metaProgress.essence} ✦`;
  ui.harborStatus.textContent = harborMessage ||
    "Билеты покупаются за осколки. Осколки — ценная премиальная валюта; перед покупкой проверь цену.";
  ui.harborStatus.classList.toggle("error", harborMessage.startsWith("Не удалось") || harborMessage.startsWith("Недостаточно"));
  ui.harborContent.replaceChildren();

  if (harbor.active) {
    const expedition = expeditions.find((item) => item.id === harbor.active.expeditionId);
    const node = expedition.nodes[harbor.active.nodeId];
    const scene = document.createElement("section");
    scene.className = "expedition-scene";
    const title = document.createElement("h3");
    title.textContent = `${expedition.icon} ${expedition.title}`;
    const story = document.createElement("p");
    story.className = "expedition-story";
    story.textContent = node.text;
    const choices = document.createElement("div");
    choices.className = "expedition-choices";
    for (const choice of node.choices || []) {
      choices.append(harborActionButton(choice.label, "choose", { choiceId: choice.id }));
    }
    scene.append(title, story, choices);
    ui.harborContent.append(scene);
  } else {
    const ticketShop = document.createElement("section");
    ticketShop.className = "harbor-ticket-shop";
    const shopTitle = document.createElement("h3");
    shopTitle.textContent = "Билеты на корабль";
    const shopNote = document.createElement("p");
    shopNote.textContent = "1 билет = 100 осколков. Осколки — ценная премиальная валюта.";
    const shopActions = document.createElement("div");
    shopActions.className = "harbor-ticket-actions";
    for (const amount of [1, 5]) {
      shopActions.append(harborActionButton(
        `Купить ${amount} ${amount === 1 ? "билет" : "билета"} · ${amount * model.TICKET_PRICE} ✦`,
        "buy-tickets",
        { amount },
        metaProgress.essence < amount * model.TICKET_PRICE,
      ));
    }
    ticketShop.append(shopTitle, shopNote, shopActions);
    ui.harborContent.append(ticketShop);

    const catalog = document.createElement("section");
    catalog.className = "expedition-catalog";
    const catalogTitle = document.createElement("h3");
    catalogTitle.textContent = "Экспедиции";
    catalog.append(catalogTitle);
    for (const expedition of expeditions) {
      const card = document.createElement("article");
      card.className = "expedition-card";
      const title = document.createElement("h4");
      title.textContent = `${expedition.icon} ${expedition.title}`;
      const description = document.createElement("p");
      description.textContent = expedition.description;
      const reward = document.createElement("p");
      reward.className = "expedition-reward";
      const completed = harbor.completed.includes(expedition.id);
      reward.textContent = `Первое успешное прохождение: ${expedition.reward.relic} и запись «${expedition.reward.record}». ${completed ? "Награда уже получена." : ""}`;
      const access = harbor.purchased.includes(expedition.id);
      const button = harborActionButton(
        access ? (completed ? "Исследовать ещё раз" : "Отправиться в экспедицию") : `Купить доступ · ${expedition.cost} ${expedition.cost === 1 ? "билет" : "билета"}`,
        access ? "start" : "purchase",
        { expeditionId: expedition.id },
        !access && model.ticketBalance(harbor) < expedition.cost,
        access ? "primary-button" : "service-button",
      );
      card.append(title, description, reward, button);
      catalog.append(card);
    }
    ui.harborContent.append(catalog);
  }

  ui.harborHistory.replaceChildren();
  const historyHeading = document.createElement("h3");
  historyHeading.textContent = "Журнал экспедиций";
  ui.harborHistory.append(historyHeading);
  if (harbor.history.length === 0) {
    const empty = document.createElement("p");
    empty.className = "harbor-empty";
    empty.textContent = "Здесь появятся найденные пути, неудачи и записи о возвращении.";
    ui.harborHistory.append(empty);
  } else {
    for (const entry of harbor.history.slice(-5).reverse()) {
      const row = document.createElement("article");
      row.className = "harbor-history-entry";
      const expedition = expeditions.find((item) => item.id === entry.expeditionId);
      const title = document.createElement("strong");
      title.textContent = `${expedition.title} · ${
        entry.outcome === "success" ? "успех" : entry.outcome === "failure" ? "неудача" : "отступление"
      }`;
      const story = document.createElement("span");
      story.textContent = `${entry.title}. ${entry.text}`;
      const path = document.createElement("small");
      path.textContent = entry.choices.map((choice) => choice.label).join(" → ");
      row.append(title, story, path);
      ui.harborHistory.append(row);
    }
  }
}

function handleHarborAction(action, data) {
  const model = window.WellExpeditionsModel;
  const now = Date.now();
  if (action === "buy-tickets") {
    const result = model.buyTickets(metaProgress.harbor, metaProgress.essence, Number(data.amount), harborReceiptId());
    if (!result.bought) {
      harborMessage = result.reason === "essence" ? "Недостаточно осколков для покупки билетов." : "Не удалось купить билеты.";
      renderHarbor();
      return;
    }
    const previous = metaProgress;
    metaProgress = { ...metaProgress, essence: result.essence, harbor: result.state };
    if (!persistMetaProgress()) {
      metaProgress = previous;
      harborMessage = "Не удалось сохранить покупку билетов; осколки не списаны.";
      renderHarbor();
      return;
    }
    harborMessage = `Куплено билетов: ${data.amount}. Списано ${Number(data.amount) * model.TICKET_PRICE} осколков.`;
  } else if (action === "purchase") {
    const result = model.purchase(metaProgress.harbor, data.expeditionId);
    if (!result.purchased) {
      harborMessage = result.reason === "tickets" ? "Недостаточно билетов для этой экспедиции." : "Не удалось купить доступ.";
      renderHarbor();
      return;
    }
    const previous = metaProgress;
    metaProgress = { ...metaProgress, harbor: result.state };
    if (!persistMetaProgress()) {
      metaProgress = previous;
      harborMessage = "Не удалось сохранить покупку доступа; билеты не списаны.";
      renderHarbor();
      return;
    }
    harborMessage = "Доступ к экспедиции куплен навсегда. Повторные прохождения не требуют билетов.";
  } else if (action === "start") {
    const result = model.start(metaProgress.harbor, data.expeditionId, now);
    if (!result.started) {
      harborMessage = result.reason === "active" ? "Сначала заверши или покинь текущую экспедицию." : "Эта экспедиция пока недоступна.";
      renderHarbor();
      return;
    }
    const previous = metaProgress;
    metaProgress = { ...metaProgress, harbor: result.state };
    if (!persistMetaProgress()) {
      metaProgress = previous;
      harborMessage = "Не удалось сохранить начало экспедиции; попробуй снова.";
      renderHarbor();
      return;
    }
    harborMessage = "";
  } else if (action === "choose") {
    const result = model.choose(metaProgress.harbor, data.choiceId, now, harborReceiptId());
    if (result.reason) {
      harborMessage = "Не удалось записать этот выбор. Обнови окно и попробуй снова.";
      renderHarbor();
      return;
    }
    const previous = metaProgress;
    metaProgress = { ...metaProgress, harbor: result.state };
    if (result.outcome === "success") {
      harborMessage = result.rewardGranted
        ? `Экспедиция пройдена! Получена реликвия «${result.reward.relic}» и запись «${result.reward.record}». Награда выдаётся только один раз.`
        : "Ты снова прошёл экспедицию и открыл другую ветвь сюжета. Повторная награда не выдаётся.";
    } else if (result.outcome === "failure") {
      harborMessage = "Экспедиция завершилась неудачей. Доступ сохранён — можно попробовать другой путь.";
    } else if (result.outcome === "retreat") {
      harborMessage = "Ты вернулся в порт. Купленный доступ остаётся навсегда.";
    }
    if (!persistMetaProgress()) {
      metaProgress = previous;
      harborMessage = "Не удалось сохранить выбор; состояние экспедиции не изменено.";
    }
  }
  renderHarbor();
}

function getTavernLevel() {
  return state.started ? state.level : savedRun?.level || metaProgress.tavern.characterLevel;
}

function tavernActionButton(label, action, data = {}, className = "action-button") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.dataset.tavernAction = action;
  for (const [key, value] of Object.entries(data)) button.dataset[key] = String(value);
  button.disabled = tavernDialogBusy || !tavernStorageReady || Boolean(tavernStorageError) || Boolean(pendingTavernState);
  return button;
}

function foodCombatLocked() {
  const battle = window.WellPlayerGroups?.getBattle();
  return dungeonDuelLocked() || Boolean(battle && ["waiting", "active"].includes(battle.status));
}

function renderFoodInventory() {
  const container = $("food-inventory");
  renderRecipeList(container, false);
  $("food-status").textContent = tavernStorageError || tavernMessage;
  if (pendingTavernState) {
    const retry = tavernActionButton("Повторить сохранение", "retry");
    retry.disabled = tavernDialogBusy;
    $("food-status").append(" ", retry);
  }
  $("food-satiety").textContent = `${window.WellTavernModel.updateSatiety(metaProgress.tavern).satiety} / 100`;
}

function renderRecipeList(container, showAll) {
  const tavern = metaProgress.tavern;
  const signature = JSON.stringify([tavern.recipes, tavernDialogBusy, tavernStorageReady,
    tavernStorageError, Boolean(pendingTavernState), foodCombatLocked()]);
  if (container.dataset.signature === signature) return;
  container.dataset.signature = signature;
  container.replaceChildren();
  for (const recipe of window.WellTavernModel.RECIPE_LIST) {
    if (!showAll && !tavern.recipes[recipe.id]) continue;
    const row = document.createElement("article");
    row.className = "tavern-recipe";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${recipe.name} · ${tavern.recipes[recipe.id]}/3`;
    const description = document.createElement("span");
    description.textContent = `${recipe.description}. ${recipe.ingredients}`;
    details.append(title, description);
    const button = tavernActionButton("Съесть", "eat", { recipeId: recipe.id });
    button.disabled = button.disabled || tavern.recipes[recipe.id] < 1 || foodCombatLocked();
    row.append(details, button);
    container.append(row);
  }
}

function openTavern() {
  if (state.started && !state.gameOver) return;
  selectedDistrict = "port";
  renderCity();
  selectedTavernTab = "food";
  tavernMessage = "";
  if (!ui.tavernDialog.open) ui.tavernDialog.showModal();
  renderTavern();
}

function closeTavern() {
  if (ui.tavernDialog.open) ui.tavernDialog.close();
  selectedDistrict = "port";
  renderCity();
}

function tavernTimeRemaining(endsAt) {
  const seconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function tavernRewardDescription(job) {
  if (job.kind === "room") return "Лечение травм доступно по завершении трёхчасового срока.";
  const parts = [`+${job.reward.gold} золотых`];
  if (job.reward.recipeId) {
    parts.push(`рецепт «${window.WellTavernModel.RECIPES[job.reward.recipeId].name}»`);
  }
  if (job.reward.item) parts.push(`предмет «${job.reward.item.name}» на склад`);
  if (job.reward.bonus === "attack") parts.push("постоянно +1 к атаке");
  if (job.reward.bonus === "maxHp") parts.push("постоянно +2 к максимуму здоровья");
  if (job.kind === "cellar" && !job.reward.bonus) parts.push("характеристика не повысилась");
  return parts.join(" · ");
}

function isTavernGearAlreadyInRun(gearId) {
  const run = savedRun || (state.started ? state : null);
  if (!run) return false;
  return (run.tavernGearIds || []).includes(gearId) ||
    [...(run.inventory || []), run.equipment?.weapon, run.equipment?.armor]
      .filter(Boolean).some((gear) => gear.id === gearId);
}

function cardLabel(card) {
  const rank = card.value === 14 ? "A" : card.value === 13 ? "K" : card.value === 12 ? "Q" : card.value === 11 ? "J" : String(card.value);
  return `${rank}${card.suit}`;
}

function renderTavernGame() {
  ui.tavernGamePanel.replaceChildren();
  const tavern = metaProgress.tavern;
  const game = tavern.game;
  if (game?.kind === "dice" && game.id !== tavernSelectedGameId) {
    tavernSelectedGameId = game.id;
    selectedDiceToHold = [...game.held];
  }
  const busy = tavernDialogBusy || !tavernStorageReady || Boolean(tavernStorageError) || Boolean(pendingTavernState);
  for (const button of ui.tavernDialog.querySelectorAll("[data-tavern-game]")) {
    button.disabled = busy || Boolean(game?.status === "playing");
  }
  $("tavern-bet").disabled = busy || Boolean(game?.status === "playing");
  if (!game) {
    const empty = document.createElement("p");
    empty.className = "tavern-game-result";
    empty.textContent = "Партия не начата. Выбери ставку; она будет списана сразу при первой раздаче.";
    ui.tavernGamePanel.append(empty);
    return;
  }
  const summary = document.createElement("p");
  summary.className = "tavern-game-result";
  summary.textContent = `Ставка ${game.bet} зол. · ${game.status === "playing" ? "партия сохранена, продолжай" : game.result}`;
  ui.tavernGamePanel.append(summary);
  const appendButton = (label, action, data = {}) => {
    const button = tavernActionButton(label, action, data);
    ui.tavernGamePanel.append(button);
  };
  if (game.kind === "21") {
    const cards = document.createElement("div");
    cards.className = "tavern-game-cards";
    const formatCards = (hand) => hand.map((card) => {
      const span = document.createElement("span");
      span.className = card.suit === "♥" || card.suit === "♦" ? "red-card" : "";
      span.textContent = `${cardLabel(card)} `;
      return span;
    });
    const playerLabel = document.createElement("strong");
    playerLabel.textContent = `Твои карты · ${window.WellTavernModel.cardTotal(game.player)}: `;
    const dealerLabel = document.createElement("strong");
    dealerLabel.textContent = `Карты дилера · ${window.WellTavernModel.cardTotal(game.dealer)}: `;
    const dealerCards = document.createElement("span");
    dealerCards.append(...formatCards(game.dealer));
    const playerCards = document.createElement("span");
    playerCards.append(...formatCards(game.player));
    cards.append(dealerLabel, dealerCards, document.createElement("br"), playerLabel, playerCards);
    ui.tavernGamePanel.append(cards);
    if (game.status === "playing") {
      appendButton("Взять карту", "hit");
      appendButton("Остановиться", "stand");
    } else {
      const payout = document.createElement("p");
      payout.className = "tavern-game-result";
      payout.textContent = `Начислено: ${game.payout} золотых.`;
      ui.tavernGamePanel.append(payout);
    }
  } else {
    const dice = document.createElement("div");
    dice.className = "tavern-dice-row";
    game.dice.forEach((value, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "tavern-die";
      button.dataset.dieIndex = String(index);
      button.textContent = String(value);
      button.setAttribute("aria-label", `Кость ${index + 1}: ${value}${selectedDiceToHold.includes(index) ? ", оставить" : ", перебросить"}`);
      button.setAttribute("aria-pressed", String(selectedDiceToHold.includes(index)));
      button.disabled = busy || game.status !== "playing" || game.rollsLeft === 0;
      dice.append(button);
    });
    ui.tavernGamePanel.append(dice);
    if (game.status === "playing") {
      const status = document.createElement("p");
      status.className = "tavern-game-result";
      status.textContent = `Осталось перебросов: ${game.rollsLeft}. Выбери кости, которые оставить, затем нажми «Перебросить».`;
      ui.tavernGamePanel.append(status);
      appendButton("Перебросить выбранные", "roll");
    } else {
      const payout = document.createElement("p");
      payout.className = "tavern-game-result";
      payout.textContent = `Начислено: ${game.payout} золотых.`;
      ui.tavernGamePanel.append(payout);
    }
  }
}

function renderTavern() {
  if (!ui.tavernDialog || !metaProgress?.tavern) return;
  let tavern = metaProgress.tavern;
  const refreshedSatiety = window.WellTavernModel.updateSatiety(tavern);
  if (refreshedSatiety.satietyAt !== tavern.satietyAt) {
    metaProgress.tavern = refreshedSatiety;
    tavern = refreshedSatiety;
    persistMetaProgress();
  }
  ui.tavernStatus.textContent = tavernStorageError || tavernMessage ||
    (!tavernStorageReady ? "Восстанавливаю сохранённые дела таверны…" : "Ставки и награды остаются в отдельном кошельке между забегами.");
  ui.tavernStatus.classList.toggle("error", Boolean(tavernStorageError));
  if (pendingTavernState) {
    const retry = tavernActionButton("Повторить сохранение", "retry", {}, "primary-button");
    retry.disabled = tavernDialogBusy;
    ui.tavernStatus.append(" ");
    ui.tavernStatus.append(retry);
  }
  ui.tavernGold.textContent = `${tavern.gold} ✦`;
  ui.tavernSatiety.textContent = `${tavern.satiety} / 100`;
  ui.tavernSatietyBar.style.width = `${tavern.satiety}%`;
  ui.tavernInjuries.textContent = `${tavern.injuries} / ${window.WellTavernModel.MAX_INJURIES}`;
  for (const tab of ui.tavernDialog.querySelectorAll("[data-tavern-tab]")) {
    const active = tab.dataset.tavernTab === selectedTavernTab;
    tab.setAttribute("aria-pressed", String(active));
  }
  for (const pane of ui.tavernDialog.querySelectorAll("[data-tavern-pane]")) {
    pane.hidden = pane.dataset.tavernPane !== selectedTavernTab;
  }
  renderRecipeList(ui.tavernRecipes, true);
  const menu = $("tavern-menu");
  const menuSignature = JSON.stringify([getTavernLevel(), tavern.gold,
    Date.now() < tavern.foodAvailableAt, tavernDialogBusy, tavernStorageReady,
    tavernStorageError, Boolean(pendingTavernState)]);
  if (menu.dataset.signature !== menuSignature) {
    menu.dataset.signature = menuSignature;
    menu.replaceChildren();
    for (const [mealId, meal] of Object.entries(window.WellTavernModel.MEALS)) {
      const row = document.createElement("article");
      row.className = "tavern-recipe";
      const text = document.createElement("span");
      const price = meal.pricePerLevel * getTavernLevel();
      text.textContent = `${meal.name} · ${meal.pricePerLevel} × ${getTavernLevel()} = ${price} зол. · сытость 100%. ${
        meal.stat ? `+20% (${meal.stat}) на 1 час — недоступно: системы этой характеристики нет.` : ""}`;
      const button = tavernActionButton("Заказать", "buy-meal", { mealId });
      button.disabled = button.disabled || Boolean(meal.stat) || tavern.gold < price ||
        Date.now() < tavern.foodAvailableAt;
      row.append(text, button);
      menu.append(row);
    }
  }
  $("tavern-food-cooldown").textContent = Date.now() < tavern.foodAvailableAt
    ? `Следующее блюдо через ${tavernTimeRemaining(tavern.foodAvailableAt)}.`
    : "Блюдо доступно. Общий перерыв — 4 часа.";
  ui.tavernStash.replaceChildren();
  const availableStash = tavern.stash.filter((item) => !isTavernGearAlreadyInRun(item.id));
  if (availableStash.length === 0) {
    const empty = document.createElement("p");
    empty.className = "tavern-note";
    empty.textContent = "Склад пока пуст.";
    ui.tavernStash.append(empty);
  }
  for (const gear of availableStash) {
    const row = document.createElement("article");
    row.className = "tavern-stash-item";
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = gear.name;
    const description = document.createElement("span");
    description.textContent = `${gear.type === "weapon" ? "Оружие" : "Броня"} · +${gear.bonus} к ${gear.type === "weapon" ? "атаке" : "защите"}`;
    details.append(title, description);
    const button = tavernActionButton(
      tavern.preparedGearId === gear.id ? "Подготовлено" : "Взять в новый спуск",
      "prepare-gear",
      { gearId: gear.id },
    );
    button.disabled = button.disabled || Boolean(state.started && !state.gameOver);
    row.append(details, button);
    ui.tavernStash.append(row);
  }
  const activeJob = tavern.activeJob;
  ui.tavernActiveJob.replaceChildren();
  ui.tavernActiveJob.hidden = !activeJob;
  if (activeJob) {
    const details = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${window.WellTavernModel.JOBS[activeJob.kind].title} · ${activeJob.durationMs / window.WellTavernModel.HOUR} ч`;
    const text = document.createElement("span");
    const complete = Date.now() >= activeJob.endsAt;
    text.textContent = complete
      ? `Время истекло. Награда ожидает получения: ${tavernRewardDescription(activeJob)}.`
      : `Осталось ${tavernTimeRemaining(activeJob.endsAt)}. Награда заранее закреплена: ${tavernRewardDescription(activeJob)}.`;
    details.append(title, text);
    ui.tavernActiveJob.append(details);
    if (complete) {
      const claim = tavernActionButton(activeJob.kind === "room" ? "Получить лечение" : "Получить награду", "claim-job");
      ui.tavernActiveJob.append(claim);
    }
  }
  const canStartJob = !activeJob && !tavernDialogBusy && tavernStorageReady &&
    !tavernStorageError && !pendingTavernState;
  for (const button of ui.tavernDialog.querySelectorAll("[data-tavern-job]")) {
    button.disabled = !canStartJob;
  }
  const waiterHours = Number($("tavern-waiter-hours").value);
  const waiterGold = window.WellTavernModel.JOBS.waiter.gold[waiterHours];
  ui.tavernDialog.querySelector('[data-tavern-job="waiter"]').textContent =
    `Принять смену · ${waiterGold} зол.`;
  const roomPrice = getTavernLevel() * 2;
  $("tavern-room-description").textContent =
    `Текущий уровень ${getTavernLevel()}: цена строго ${getTavernLevel()} × 2 = ${roomPrice} зол. После истечения ровно 3 часов полностью лечит травмы.`;
  const roomButton = ui.tavernDialog.querySelector('[data-tavern-job="room"]');
  roomButton.textContent = `Снять комнату · ${roomPrice} зол.`;
  roomButton.disabled = !canStartJob || tavern.injuries === 0 || tavern.gold < roomPrice;
  $("tavern-waiter-hours").disabled = !canStartJob;
  renderTavernGame();
}

function createTavernGear(tavern) {
  const themes = {
    well: { weapon: "Клинок каменного эха", armor: "Плащ колодезного стража" },
    drowned: { weapon: "Якорный тесак", armor: "Панцирь глубин" },
    roots: { weapon: "Серп живых корней", armor: "Кора древнего собора" },
    forge: { weapon: "Молот пепельной кузни", armor: "Кованый доспех" },
  };
  const type = randomInt(0, 1) === 0 ? "weapon" : "armor";
  const theme = FLOOR_THEMES[randomInt(0, FLOOR_THEMES.length - 1)];
  const sequence = tavern.nextGearSequence + 1;
  tavern.nextGearSequence = sequence;
  return {
    id: `gear-${sequence}`,
    type,
    name: themes[theme.id][type],
    bonus: Math.min(type === "weapon" ? 6 : 4, 1 + Math.floor((getTavernLevel() - 1) / 3)),
  };
}

async function persistTavernCandidate(candidate) {
  if (!tavernStorageReady) {
    tavernMessage = "Подожди завершения восстановления сохранения таверны.";
    renderTavern();
    return false;
  }
  const expectedRevision = metaProgress.tavern.revision;
  const saved = await commitTavernProgress(candidate);
  if (!saved) {
    if (!tavernWriteConflict) {
      pendingTavernState = JSON.parse(JSON.stringify(candidate));
      pendingTavernRevision = expectedRevision;
    }
    renderTavern();
    return false;
  }
  pendingTavernState = null;
  pendingTavernRevision = null;
  tavernMessage = "Изменение сохранено.";
  renderTavern();
  return true;
}

async function handleTavernAction(action, data = {}) {
  if (["eat", "buy-meal", "claim-job", "retry"].includes(action) && !data.foodLockAcquired) {
    if (!navigator.locks) {
      tavernMessage = "Браузер не поддерживает безопасную блокировку еды. Ничего не списано.";
      renderTavern();
      renderFoodInventory();
      return;
    }
    return navigator.locks.request("well-food", () =>
      handleTavernAction(action, { ...data, foodLockAcquired: true }));
  }
  if (tavernDialogBusy) return;
  if (action === "retry") {
    if (!pendingTavernState) return;
    tavernDialogBusy = true;
    renderTavern();
    try {
      if (pendingTavernRevision !== metaProgress.tavern.revision) {
        pendingTavernState = null;
        pendingTavernRevision = null;
        throw new Error("Сохранение изменилось после ошибки. Устаревшее действие отменено; перезагрузи игру для актуального запаса.");
      }
      const known = new Set(metaProgress.tavern.foodReceipts.map((receipt) => receipt.id));
      const changes = pendingTavernState.foodReceipts.filter((receipt) => !known.has(receipt.id));
      if (changes.some((receipt) => receipt.recipeDelta < 0) && foodCombatLocked()) {
        throw new Error("Еда недоступна во время онлайн-боя или дуэли; повтори сохранение после боя.");
      }
      if (changes.some((receipt) => receipt.goldDelta < 0) && state.started && !state.gameOver) {
        throw new Error("Сохранить заказ блюда таверны можно только в городе.");
      }
      await persistTavernCandidate(pendingTavernState);
    } catch (error) {
      tavernStorageError = error.message;
    } finally {
      tavernDialogBusy = false;
      renderTavern();
      renderFoodInventory();
    }
    return;
  }
  if (!tavernStorageReady || tavernStorageError || pendingTavernState) return;
  tavernDialogBusy = true;
  renderTavern();
  renderFoodInventory();
  try {
    const now = Date.now();
    if (action === "eat" && foodCombatLocked()) throw new Error("Еда недоступна во время онлайн-боя или дуэли.");
    if (action === "buy-meal" && state.started && !state.gameOver) throw new Error("Блюда таверны доступны только в городе.");
    if (["eat", "buy-meal", "claim-job"].includes(action)) latestHomesteadBalances();
    let candidate = window.WellTavernModel.withDefaults(metaProgress.tavern);
    if (action === "eat") {
      candidate = window.WellTavernModel.useRecipe(candidate, data.recipeId, now);
    } else if (action === "buy-meal") {
      candidate = window.WellTavernModel.buyMeal(candidate, data.mealId, getTavernLevel(), now);
    } else if (action === "start-job") {
      const kind = data.kind;
      const options = { level: getTavernLevel() };
      if (kind === "waiter") options.hours = Number($("tavern-waiter-hours").value);
      if (kind === "cleaning") options.item = createTavernGear(candidate);
      candidate = window.WellTavernModel.startJob(candidate, kind, options, now);
      tavernMessage = `Дело начато. Награда закреплена, получить её можно после окончания таймера.`;
    } else if (action === "claim-job") {
      const job = candidate.activeJob;
      candidate = window.WellTavernModel.claimJob(candidate, now);
      tavernMessage = job.kind === "room"
        ? "Комната оплачена и срок истёк: травмы вылечены."
        : `Награда получена один раз: ${tavernRewardDescription(job)}.`;
    } else if (action === "prepare-gear") {
      const gear = candidate.stash.find((item) => item.id === data.gearId);
      if (!gear || isTavernGearAlreadyInRun(gear.id)) throw new Error("Этот предмет уже подготовлен к сохранённому спуску.");
      candidate.preparedGearId = candidate.preparedGearId === gear.id ? null : gear.id;
      candidate.updatedAt = now;
      tavernMessage = candidate.preparedGearId ? `${gear.name} подготовлен к следующему новому спуску.` : "Подготовка предмета отменена.";
    } else if (action === "start-game") {
      const kind = data.kind;
      const bet = Number($("tavern-bet").value);
      candidate = window.WellTavernModel.startGame(candidate, kind, bet, now);
      tavernMessage = `Ставка ${bet} золотых списана. Партия сохранена до каждого хода.`;
    } else if (action === "hit") {
      candidate = window.WellTavernModel.hit21(candidate, now);
      tavernMessage = candidate.game.status === "finished" ? candidate.game.result : "Карта взята; ход сохранён.";
    } else if (action === "stand") {
      candidate = window.WellTavernModel.stand21(candidate, now);
      tavernMessage = candidate.game.result;
    } else if (action === "roll") {
      candidate = window.WellTavernModel.rollDice(candidate, selectedDiceToHold, now);
      selectedDiceToHold = [...candidate.game.held];
      tavernMessage = candidate.game.status === "finished" ? candidate.game.result : "Переброс сохранён.";
    } else {
      throw new Error("Неизвестное действие таверны.");
    }
    await persistTavernCandidate(candidate);
  } catch (error) {
    tavernMessage = error.message;
  } finally {
    tavernDialogBusy = false;
    renderTavern();
    renderFoodInventory();
  }
}

function render() {
  renderFoodInventory();
  const theme = getFloorTheme();
  const characterClass = state.classId ? getSelectedClassNodes().slice(-1)[0] : null;
  ui.level.textContent = `УР. ${state.level}`;
  $("player-name").textContent = profileSettings.displayName;
  $("player-subtitle").textContent = characterClass
    ? `${characterClass.name} · ${characterClass.role}`
    : "Последний из наземных";
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
  const coopBattle = window.WellPlayerGroups?.getBattle();
  const inGroupBattle = Boolean(coopBattle && ["waiting", "active"].includes(coopBattle.status));
  ui.combatActions.hidden = !state.enemy || state.gameOver || inGroupBattle;
  const dueling = dungeonDuelLocked();
  if (dueling) {
    ui.explore.hidden = true;
    ui.potion.hidden = true;
    ui.explore.disabled = true;
    ui.potion.disabled = true;
    ui.descend.hidden = true;
  }
  $("gang-form").hidden = !state.started || state.gameOver || dueling;
  $("gang-button").disabled = !canRequestDungeonDuel();
  $("gang-form").querySelector('button[type="submit"]').disabled = !canRequestDungeonDuel();
  $("dungeon-kit").hidden = !state.started || state.gameOver || Boolean(state.liveDuelId);
  $("offhand-select").value = state.offhand || "shield";
  $("offhand-select").disabled = Boolean(state.enemy && state.extraActionUsed) || inGroupBattle || window.WellPvp?.isBusy();
  const cooldown = state.combatProgress?.cooldowns?.[state.offhand] || 0;
  $("offhand-button").disabled = state.extraActionUsed || cooldown > 0;
  $("offhand-button").textContent = `${{ shield: "Щит", torch: "Факел", staff: "Посох" }[state.offhand]} · ${cooldown ? `откат ${cooldown}` : "готово"}`;
  $("escape-button").disabled = state.extraActionUsed || state.enemy?.special === "captain";
  $("guard-button").disabled = state.extraActionUsed;
  $("combat-potion-button").disabled ||= state.extraActionUsed;
  $("combat-extra-status").textContent = `Доп. действие: ${state.extraActionUsed ? "потрачено" : "1 доступно"}. Стойка: ${{ balanced: "баланс", defensive: "защита", offensive: "атака" }[state.stance]}. Удар / классовая способность запускают весь раунд.`;
  $("ghost-panel").hidden = !state.ghostDuel;
  if (state.ghostDuel) {
    const duel = state.ghostDuel;
    $("ghost-status").textContent = `Призрак: ${duel.ghost.hp}/${duel.ghost.maxHp} HP · ход ${duel.round} · ${Math.max(0, Math.ceil((duel.deadline - Date.now()) / 1000))} с · пропуски ${duel.player.skips}/3`;
    for (const button of $("ghost-panel").querySelectorAll("[data-ghost-action]")) {
      const action = button.dataset.ghostAction;
      button.disabled = ["shield", "torch", "staff"].includes(action) &&
        (duel.player.offhand !== action || duel.player.cooldowns[action] > 1) ||
        action === "heavy" && duel.player.focus < 2 ||
        action === "potion" && (!duel.player.potions || duel.player.hp >= duel.player.maxHp);
    }
  }
  const camouflageButton = $("camouflage-run-button");
  camouflageButton.hidden = !state.enemy || state.gameOver || state.enemy.boss || state.enemy.elite;
  camouflageButton.disabled = state.extraActionUsed || metaProgress.homestead.camouflage < 1;
  camouflageButton.textContent = `Маскировка · ${metaProgress.homestead.camouflage} в инвентаре`;
  ui.merchantActions.hidden = !state.merchantAvailable || state.gameOver;
  ui.buyPotion.disabled = state.potions >= getPotionLimit() || state.gold < MERCHANT_PRICES.potion;
  ui.buyPotion.textContent = `⚗ Зелье · ${MERCHANT_PRICES.potion} ✦`;
  ui.buyWeapon.disabled = state.gold < MERCHANT_PRICES.weapon;
  ui.buyWeapon.textContent = `⚔ Заточка · ${MERCHANT_PRICES.weapon} ✦`;
  ui.buyArmor.disabled = state.inventory.length >= MAX_GEAR || state.gold < MERCHANT_PRICES.armor;
  ui.buyArmor.textContent = `⬡ Броня · ${MERCHANT_PRICES.armor} ✦`;
  ui.buyHealing.disabled = state.hp >= state.maxHp || state.gold < MERCHANT_PRICES.healing;
  ui.buyHealing.textContent = `✚ Лечение · ${MERCHANT_PRICES.healing} ✦`;
  ui.buyFireSoul.hidden = !state.merchantSoulAvailable;
  ui.buyFireSoul.disabled = !state.merchantSoulAvailable || state.level < window.WellSoulCraftingModel.DROP_LEVEL ||
    state.gold < MERCHANT_PRICES.fireSoul;
  ui.buyFireSoul.textContent = `♨ Душа огня · ${MERCHANT_PRICES.fireSoul} ✦`;
  ui.descend.hidden = !state.waitingToDescend || state.gameOver || dueling;
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
  renderCity();
  if (ui.tavernDialog.open) renderTavern();
  saveActiveRun();
  if (window.WellPlayerGroups) {
    window.WellPlayerGroups.setPlayerState(
      Math.max(state.level, metaProgress.tavern.characterLevel),
      state.started && !state.gameOver,
    );
  }
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
  $("settings-sound").checked = soundEnabled;
}

function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  renderSoundToggle();
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, String(soundEnabled));
    return true;
  } catch (error) {
    console.warn("Не удалось сохранить настройку звука.", error);
    return false;
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
  useCombatExtra("stance");
});
$("camouflage-run-button").addEventListener("click", useCamouflage);
$("offhand-button").addEventListener("click", () => useCombatExtra("offhand"));
$("escape-button").addEventListener("click", () => useCombatExtra("escape"));
$("ghost-panel").addEventListener("click", (event) => {
  const button = event.target.closest("[data-ghost-action]");
  if (button) ghostAction(button.dataset.ghostAction);
});
$("offhand-select").addEventListener("change", (event) => {
  const offhand = event.target.value;
  if (!["shield", "torch", "staff"].includes(offhand) || state.liveDuelId || state.gameOver) return;
  if (state.ghostDuel) ghostAction(`equip-${offhand}`);
  else if (!state.enemy || !state.extraActionUsed) {
    state.offhand = offhand;
    if (state.enemy) state.extraActionUsed = true;
    render();
  }
});
setInterval(() => {
  if (!state.ghostDuel) return;
  for (let skip = 0; state.ghostDuel && Date.now() >= state.ghostDuel.deadline && skip < 3; skip += 1) ghostAction("skip");
  if (state.ghostDuel) render();
}, 1000);
ui.descend.addEventListener("click", descend);
ui.restart.addEventListener("click", openClassDialog);
ui.buyPotion.addEventListener("click", () => merchantPurchase("potion"));
ui.buyWeapon.addEventListener("click", () => merchantPurchase("weapon"));
ui.buyArmor.addEventListener("click", () => merchantPurchase("armor"));
ui.buyHealing.addEventListener("click", () => merchantPurchase("healing"));
ui.buyFireSoul.addEventListener("click", () => merchantPurchase("fireSoul"));
ui.leaveMerchant.addEventListener("click", leaveMerchant);
$("food-panel").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-tavern-action]");
  if (button) handleTavernAction(button.dataset.tavernAction, button.dataset);
});
ui.inventory.addEventListener("click", (event) => {
  const sell = event.target.closest("button[data-sell-gear-id]");
  if (sell) {
    sellRunGear(sell.dataset.sellGearId);
    return;
  }
  const button = event.target.closest("button[data-gear-id]");
  if (button) equipGear(button.dataset.gearId);
});
$("meta-upgrades").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-upgrade]");
  if (button) buyMetaUpgrade(button.dataset.upgrade);
});
$("rune-list").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-rune-type]");
  if (button) useEnhancementRune(button.dataset.runeType);
});
$("sound-toggle").addEventListener("click", (event) => {
  setSoundEnabled(!soundEnabled);
  if (soundEnabled) playSound("toggle");
});

const settingsDialog = $("settings-dialog");
$("settings-open-button").addEventListener("click", () => {
  $("settings-status").textContent = "";
  $("profile-display-name").value = profileSettings.displayName;
  settingsDialog.showModal();
});
$("profile-settings-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const displayName = normalizeDisplayName($("profile-display-name").value);
  if (!displayName) {
    $("settings-status").textContent = "Введи имя из одного или нескольких символов.";
    $("profile-display-name").focus();
    return;
  }
  if (persistProfileSettings({ ...profileSettings, displayName })) {
    $("profile-display-name").value = displayName;
    $("settings-status").textContent = "Имя путника сохранено в этом браузере.";
  } else {
    $("settings-status").textContent = "Не удалось сохранить имя. Проверь доступность хранилища браузера.";
  }
});
$("settings-sound").addEventListener("change", (event) => {
  const saved = setSoundEnabled(event.currentTarget.checked);
  if (soundEnabled) playSound("toggle");
  $("settings-status").textContent = saved
    ? "Настройка звука сохранена."
    : "Звук изменён до закрытия страницы, но не сохранён в браузере.";
});
for (const [inputId, settingKey, label] of [
  ["settings-reduced-motion", "reducedMotion", "анимации"],
  ["settings-high-contrast", "highContrast", "контраста"],
]) {
  $(inputId).addEventListener("change", (event) => {
    const nextSettings = { ...profileSettings, [settingKey]: event.currentTarget.checked };
    const saved = persistProfileSettings(nextSettings);
    if (!saved) event.currentTarget.checked = profileSettings[settingKey];
    $("settings-status").textContent = saved
      ? `Настройка ${label} сохранена.`
      : `Не удалось сохранить настройку ${label}. Проверь доступность хранилища браузера.`;
  });
}

renderSoundToggle();
applyProfileSettings();
render();
ui.districtTabs.addEventListener("click", (event) => {
  const tab = event.target.closest("button[data-district]");
  if (!tab || !Object.prototype.hasOwnProperty.call(CITY_DISTRICTS, tab.dataset.district)) return;
  selectedDistrict = tab.dataset.district;
  renderCity();
});
ui.districtBackButton.addEventListener("click", () => {
  selectedDistrict = "main";
  renderCity();
});
ui.cityServices.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-city-action]");
  if (!button) return;
  if (button.dataset.cityAction === "well") {
    if (savedRun) resumeGame();
    else openClassDialog();
  } else if (button.dataset.cityAction === "new-run" || button.dataset.cityAction === "classes") {
    openClassDialog();
  } else if (button.dataset.cityAction === "upgrades") {
    $("meta-panel").scrollIntoView({ behavior: "smooth", block: "center" });
  } else if (button.dataset.cityAction === "tavern") {
    openTavern();
  } else if (button.dataset.cityAction === "harbor") {
    openHarbor();
  } else if (button.dataset.cityAction === "homestead") {
    openHomestead();
  }
});
ui.homesteadOpenButton.addEventListener("click", openHomestead);
$("profile-crafting-button").addEventListener("click", () => openHomestead("craft"));
$("profile-soul-crafting-button").addEventListener("click", () => openHomestead("soul-craft"));
ui.homesteadContent.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-homestead-action]");
  if (button) handleHomesteadAction(button.dataset.homesteadAction, button.dataset);
});
$("homestead-close-button").addEventListener("click", closeHomestead);
$("homestead-return-button").addEventListener("click", closeHomestead);
ui.homesteadDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  closeHomestead();
});
ui.homesteadDialog.addEventListener("close", () => {
  selectedDistrict = "upper";
  renderCity();
});
ui.harborDialog.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-harbor-action]");
  if (button) handleHarborAction(button.dataset.harborAction, button.dataset);
});
ui.harborDialog.addEventListener("close", () => {
  selectedDistrict = "port";
  renderCity();
});
ui.tavernDialog.addEventListener("click", (event) => {
  const tab = event.target.closest("button[data-tavern-tab]");
  if (tab) {
    selectedTavernTab = tab.dataset.tavernTab;
    renderTavern();
    return;
  }
  const die = event.target.closest("button[data-die-index]");
  if (die && metaProgress.tavern.game?.status === "playing") {
    const index = Number(die.dataset.dieIndex);
    selectedDiceToHold = selectedDiceToHold.includes(index)
      ? selectedDiceToHold.filter((held) => held !== index)
      : [...selectedDiceToHold, index].sort((left, right) => left - right);
    renderTavernGame();
    return;
  }
  const job = event.target.closest("button[data-tavern-job]");
  if (job) {
    handleTavernAction("start-job", { kind: job.dataset.tavernJob });
    return;
  }
  const game = event.target.closest("button[data-tavern-game]");
  if (game) {
    handleTavernAction("start-game", { kind: game.dataset.tavernGame });
    return;
  }
  const actionButton = event.target.closest("button[data-tavern-action]");
  if (actionButton) {
    handleTavernAction(actionButton.dataset.tavernAction, actionButton.dataset);
  }
});
ui.tavernDialog.addEventListener("close", () => {
  selectedDistrict = "port";
  renderCity();
});
$("tavern-return-button").addEventListener("click", closeTavern);
$("harbor-return-button").addEventListener("click", closeHarbor);
$("tavern-waiter-hours").addEventListener("change", renderTavern);
setInterval(() => {
  if (ui.tavernDialog.open) renderTavern();
}, 1000);
setInterval(() => {
  if (ui.homesteadDialog.open) renderHomestead();
}, 1000);

async function initializeGameServices() {
  await initializeTavernPersistence();
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
  window.WellPlayerGroups.initialize({
  getLevel: () => state.level,
  isInDungeon: () => state.started && !state.gameOver,
  getBattlePlayer: getGroupBattlePlayer,
  getBossEncounter: () => state.enemy?.boss ? {
    floor: state.floor,
    name: state.enemy.name,
    icon: state.enemy.icon || "☠",
    skin: state.enemy.skin || "guardian",
    hp: state.enemy.hp,
    max_hp: state.enemy.maxHp,
    damage: state.enemy.damage,
    xp: state.enemy.xp,
    gold: state.enemy.gold,
  } : null,
  onBattleUpdate: applyGroupBattleUpdate,
  onSharedGold: applySharedGoldReward,
  onSharedEssence: applySharedEssenceReward,
  onUnsharedReward: (kind, amount) => {
    if (kind === "gold" && state.started && !state.gameOver) {
      state.gold = Math.min(1000000000, state.gold + amount);
      render();
    } else if (kind === "essence" && amount > 0) {
      metaProgress.essence = Math.min(1000000000, metaProgress.essence + amount);
      persistMetaProgress();
      render();
    }
  },
  });
  window.WellPvp.initialize({
    getFighter: getDungeonFighter,
    getBattleId: () => state.liveDuelId,
    canDuel: canRequestDungeonDuel,
    inDungeon: () => state.started && !state.gameOver,
    onBattle: applyPvpBattle,
    onGhost: startGhostDuel,
  });
}

const gameServicesReady = initializeGameServices().catch((error) => {
  tavernStorageError = "Не удалось восстановить сохранения таверны; новые действия с наградами заблокированы.";
  tavernStorageReady = true;
  console.error("Не удалось инициализировать сохранения игры.", error);
  render();
});
