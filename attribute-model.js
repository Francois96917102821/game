"use strict";

(function attachAttributeModel(root) {
  const BASE = 10;
  const CAP = 30;
  const MAX_LEVEL = 10000;
  const FOOD_CAP = Math.floor(CAP * 1.2);
  const KEYS = Object.freeze(["strength", "agility", "endurance"]);

  function atLevel(level = 1) {
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) {
      throw new Error("Invalid attribute progression level.");
    }
    const value = BASE + Math.min(CAP - BASE, level - 1);
    return { version: 1, level, strength: value, agility: value, endurance: value };
  }

  function isValid(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
      value.version !== 1 || !Number.isInteger(value.level) ||
      value.level < 1 || value.level > MAX_LEVEL) return false;
    const expected = atLevel(value.level);
    return KEYS.every((key) => value[key] === expected[key]) &&
      Object.keys(value).every((key) => Object.hasOwn(expected, key));
  }

  function advance(value, level) {
    if (!isValid(value)) throw new Error("Invalid attributes.");
    return atLevel(Math.max(value.level, atLevel(level).level));
  }

  function merge(left, right) {
    if (!isValid(left) || !isValid(right)) throw new Error("Invalid attribute merge.");
    return atLevel(Math.max(left.level, right.level));
  }

  function effects(value) {
    if (!isValid(value)) throw new Error("Invalid attribute effects.");
    return {
      attack: Math.floor((value.strength - BASE) / 5),
      defense: Math.floor((value.endurance - BASE) / 10),
      maxHp: (value.endurance - BASE) * 2,
      accuracy: (value.agility - BASE) * 0.002,
      concentration: (value.agility - BASE) * 0.005,
    };
  }

  function effectiveEffects(value, buffs, now = Date.now()) {
    if (!isValid(value)) throw new Error("Invalid effective attribute effects.");
    if (!buffs || typeof buffs !== "object" || Array.isArray(buffs) ||
      Object.keys(buffs).length !== KEYS.length ||
      !KEYS.every((key) => Object.hasOwn(buffs, key)) || !Number.isFinite(now)) {
      throw new Error("Invalid attribute food effects.");
    }
    const effective = Object.fromEntries(KEYS.map((key) => {
      const buff = buffs[key];
      if (buff !== null && (!buff || typeof buff !== "object" ||
        typeof buff.receiptId !== "string" || buff.receiptId.length < 1 || buff.receiptId.length > 160 ||
        !Number.isFinite(buff.expiresAt) || buff.expiresAt < 0 ||
        Object.keys(buff).length !== 2 || !Object.hasOwn(buff, "receiptId") ||
        !Object.hasOwn(buff, "expiresAt"))) {
        throw new Error("Invalid attribute food effect.");
      }
      return [key, buff && buff.expiresAt > now
        ? Math.min(FOOD_CAP, Math.floor(value[key] * 1.2))
        : value[key]];
    }));
    return {
      attack: Math.min(5, Math.floor((effective.strength - BASE) / 5)),
      defense: Math.min(2, Math.floor((effective.endurance - BASE) / 10)),
      maxHp: Math.min(52, (effective.endurance - BASE) * 2),
      accuracy: Math.min(0.052, (effective.agility - BASE) * 0.002),
      concentration: Math.min(0.13, (effective.agility - BASE) * 0.005),
    };
  }

  root.WellAttributeModel = Object.freeze({
    BASE, CAP, MAX_LEVEL, KEYS, atLevel, isValid, advance, merge, effects, effectiveEffects,
  });
})(window);
