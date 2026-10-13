"use strict";

(function attachGoldEconomyModel(root) {
  const MAX_GOLD = 1000000000;
  const MAX_HEALTH = 1000000;

  function gearSalePrice(gear) {
    if (!gear || !["weapon", "armor"].includes(gear.type) ||
      !Number.isInteger(gear.bonus) || gear.bonus < 1 ||
      gear.bonus > (gear.type === "weapon" ? 6 : 4)) return null;
    return gear.bonus * 3;
  }

  function rubbleEndurance(maxHp) {
    if (!Number.isInteger(maxHp) || maxHp < 1 || maxHp > MAX_HEALTH) {
      throw new Error("Некорректный максимум здоровья.");
    }
    return Math.min(1, MAX_HEALTH - maxHp);
  }

  root.WellGoldEconomyModel = Object.freeze({ MAX_GOLD, gearSalePrice, rubbleEndurance });
})(typeof window !== "undefined" ? window : globalThis);
