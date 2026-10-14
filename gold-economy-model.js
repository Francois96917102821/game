"use strict";

(function attachGoldEconomyModel(root) {
  const MAX_GOLD = 1000000000;
  const MAX_HEALTH = 1000000;
  const TROPHY_KEYS = Object.freeze([
    "courage", "valor", "admBlood", "shell", "fishEye", "fishFat", "fishScale",
  ]);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function trophySalePrice(key) {
    return TROPHY_KEYS.includes(key) ? 1 : null;
  }

  function trophySaleCounts(receipts) {
    const units = Object.fromEntries(TROPHY_KEYS.map((key) => [key, new Set()]));
    for (const receipt of receipts) units[receipt.key].add(receipt.unit);
    return Object.fromEntries(TROPHY_KEYS.map((key) => [key, units[key].size]));
  }

  function isValidTrophySales(receipts) {
    if (receipts === undefined) return true;
    if (!Array.isArray(receipts) || receipts.length > 100000 ||
      receipts.some((receipt) => !receipt || typeof receipt.id !== "string" || !UUID.test(receipt.id) ||
        trophySalePrice(receipt.key) === null || !Number.isInteger(receipt.unit) ||
        receipt.unit < 1 || receipt.unit > 100000) ||
      new Set(receipts.map((receipt) => receipt.id)).size !== receipts.length) return false;
    const counts = trophySaleCounts(receipts);
    return receipts.every((receipt) => receipt.unit <= counts[receipt.key]);
  }

  function mergeTrophySales(first, second) {
    if (!isValidTrophySales(first) || !isValidTrophySales(second)) {
      throw new Error("Некорректный журнал выкупа трофеев.");
    }
    const receipts = new Map();
    for (const receipt of [...(first || []), ...(second || [])]) {
      const existing = receipts.get(receipt.id);
      if (existing && (existing.key !== receipt.key || existing.unit !== receipt.unit)) {
        throw new Error("Конфликт квитанции выкупа трофея.");
      }
      receipts.set(receipt.id, { ...receipt });
    }
    const merged = [...receipts.values()].sort((a, b) => a.id.localeCompare(b.id));
    if (!isValidTrophySales(merged)) throw new Error("Достигнут предел журнала выкупа трофеев.");
    return merged;
  }

  function sellTrophy(progress, key, id, now = Date.now()) {
    if (trophySalePrice(key) === null || typeof id !== "string" || !UUID.test(id) ||
      !isValidTrophySales(progress.trophySales)) throw new Error("Этот трофей нельзя продать.");
    const receipts = progress.trophySales || [];
    const existing = receipts.find((receipt) => receipt.id === id);
    if (existing) {
      if (existing.key !== key) throw new Error("Квитанция уже использована для другого трофея.");
      return progress;
    }
    const count = progress.dungeonTrophies?.[key] ?? 0;
    const gold = progress.tavern?.gold;
    if (!Number.isInteger(count) || count < 1 || count > MAX_GOLD) {
      throw new Error("Нет подходящего трофея для выкупа.");
    }
    if (!Number.isInteger(gold) || gold < 0 || gold >= MAX_GOLD) {
      throw new Error("Баланс золота не допускает выкуп.");
    }
    if (receipts.length >= 100000 || !Number.isInteger(progress.tavern.revision) ||
      progress.tavern.revision < 0 || progress.tavern.revision >= MAX_GOLD ||
      !Number.isFinite(now) || now < 0) throw new Error("Достигнут предел сохранения выкупа.");
    // Offline branches selling the same inventory ordinal pay only once on merge.
    const unit = trophySaleCounts(receipts)[key] + 1;
    return {
      ...progress,
      dungeonTrophies: { ...progress.dungeonTrophies, [key]: count - 1 },
      trophySales: [...receipts, { id, key, unit }],
      tavern: { ...progress.tavern, gold: gold + 1,
        revision: progress.tavern.revision + 1, updatedAt: now },
    };
  }
  const ORDINARY_GEAR_NAMES = Object.freeze({
    well: Object.freeze({ weapon: "Клинок каменного эха", armor: "Плащ колодезного стража" }),
    drowned: Object.freeze({ weapon: "Якорный тесак", armor: "Панцирь глубин" }),
    roots: Object.freeze({ weapon: "Серп живых корней", armor: "Кора древнего собора" }),
    forge: Object.freeze({ weapon: "Молот пепельной кузни", armor: "Кованый доспех" }),
  });

  function gearSalePrice(gear) {
    if (!gear || !["weapon", "armor"].includes(gear.type) ||
      !Number.isInteger(gear.bonus) || gear.bonus < 1 ||
      gear.bonus > (gear.type === "weapon" ? 6 : 4) ||
      !Object.values(ORDINARY_GEAR_NAMES).some((names) => names[gear.type] === gear.name)) return null;
    return gear.bonus * 3;
  }

  function rubbleEndurance(maxHp) {
    if (!Number.isInteger(maxHp) || maxHp < 1 || maxHp > MAX_HEALTH) {
      throw new Error("Некорректный максимум здоровья.");
    }
    return Math.min(1, MAX_HEALTH - maxHp);
  }

  root.WellGoldEconomyModel = Object.freeze({
    MAX_GOLD, ORDINARY_GEAR_NAMES, gearSalePrice, rubbleEndurance,
    TROPHY_KEYS, trophySalePrice, trophySaleCounts, isValidTrophySales, mergeTrophySales, sellTrophy,
  });
})(typeof window !== "undefined" ? window : globalThis);
