"use strict";

(function attachGoldEconomyModel(root) {
  const MAX_GOLD = 1000000000;
  const MAX_HEALTH = 1000000;
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

  root.WellGoldEconomyModel = Object.freeze({ MAX_GOLD, ORDINARY_GEAR_NAMES, gearSalePrice, rubbleEndurance });
})(typeof window !== "undefined" ? window : globalThis);
