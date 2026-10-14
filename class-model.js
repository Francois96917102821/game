"use strict";

(function attachClassModel(root) {
  const CLASS_UNLOCK_LEVELS = { advanced: 3, mastery: 9 };
  const LEGACY_SUBCLASS_LEVELS = [3, 6, 9];
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

  function getBaseClassId(classId) {
    let characterClass = CLASS_BY_ID.get(classId);
    while (characterClass?.tier > 1) characterClass = CLASS_BY_ID.get(characterClass.parent);
    return characterClass?.id || "knight";
  }

  const api = Object.freeze({
    CLASS_UNLOCK_LEVELS, LEGACY_SUBCLASS_LEVELS,
    BASE_CLASSES, ADVANCED_CLASSES, MASTERY_CLASSES, CLASS_BY_ID,
    LEGACY_CLASS_MIGRATIONS, LEGACY_SUBCLASS_IDS, getBaseClassId,
  });
  root.WellClassModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
