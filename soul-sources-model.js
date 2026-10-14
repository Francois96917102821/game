"use strict";

(function attachSoulSources(root) {
  const RATE = 3;
  const SERPENT_CHANCE = 0.25;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const createState = () => ({ victories: [], exchanges: [], rejected: [] });
  const withDefaults = (value) => value === undefined || value === null ? createState() : copy(value);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function replay(state) {
    const available = new Set(state.victories.filter((entry) => entry.kind === "victor").map((entry) => entry.id));
    const rejected = new Set(state.rejected);
    const accepted = [];
    for (const entry of [...state.exchanges].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id))) {
      if (rejected.has(entry.id) || entry.trophies.some((id) => !available.has(id))) {
        rejected.add(entry.id);
        continue;
      }
      entry.trophies.forEach((id) => available.delete(id));
      accepted.push(entry);
    }
    return { available: [...available].sort(), accepted, rejected: [...rejected].sort() };
  }

  function isValidState(state) {
    if (!state || !Array.isArray(state.victories) || !Array.isArray(state.exchanges) ||
      !Array.isArray(state.rejected) || state.victories.length + state.exchanges.length > 100000) return false;
    const ids = new Set();
    for (const entry of [...state.victories, ...state.exchanges]) {
      if (!entry || !UUID.test(entry.id) || ids.has(entry.id) || !Number.isFinite(entry.at) ||
        !Number.isInteger(entry.level) || entry.level < 1) return false;
      ids.add(entry.id);
    }
    if (state.victories.some((entry) => !["darkwood", "victor"].includes(entry.kind) ||
      typeof entry.serpent !== "boolean" || (entry.kind !== "darkwood" && entry.serpent))) return false;
    if (state.exchanges.some((entry) => !Array.isArray(entry.trophies) ||
      entry.trophies.length !== RATE || new Set(entry.trophies).size !== RATE ||
      entry.trophies.some((id) => !state.victories.some((victory) => victory.id === id && victory.kind === "victor")))) return false;
    if (new Set(state.rejected).size !== state.rejected.length ||
      state.rejected.some((id) => !state.exchanges.some((entry) => entry.id === id))) return false;
    return same([...state.rejected].sort(), replay(state).rejected);
  }

  function merge(left, right) {
    const first = withDefaults(left);
    const second = withDefaults(right);
    if (!isValidState(first) || !isValidState(second)) throw new Error("Летопись вылазок повреждена.");
    const entries = new Map();
    for (const entry of [...first.victories, ...first.exchanges, ...second.victories, ...second.exchanges]) {
      if (entries.has(entry.id) && !same(entries.get(entry.id), entry)) {
        throw new Error("UUID вылазки уже использован с другой наградой.");
      }
      entries.set(entry.id, entry);
    }
    const state = {
      victories: [...entries.values()].filter((entry) => entry.kind).sort((a, b) => a.id.localeCompare(b.id)),
      exchanges: [...entries.values()].filter((entry) => !entry.kind).sort((a, b) => a.id.localeCompare(b.id)),
      rejected: [...new Set([...first.rejected, ...second.rejected])],
    };
    state.rejected = replay(state).rejected;
    if (!isValidState(state)) throw new Error("Летопись вылазок переполнена или несовместима.");
    return state;
  }

  function victory(current, kind, id, level, roll, at = Date.now()) {
    if (!["darkwood", "victor"].includes(kind) || !Number.isFinite(roll) || roll < 0 || roll >= 1) {
      throw new Error("Неверный результат PvE-вылазки.");
    }
    const entry = { id, kind, level, at, serpent: kind === "darkwood" && roll < SERPENT_CHANCE };
    const addition = { ...createState(), victories: [entry] };
    return merge(current, addition);
  }

  function exchange(current, id, level, at = Date.now()) {
    if (!isValidState(current)) throw new Error("Летопись трофеев повреждена.");
    const existing = current.exchanges.find((entry) => entry.id === id);
    if (existing) {
      if (existing.level !== level || existing.at !== at) throw new Error("UUID обмена уже использован.");
      if (current.rejected.includes(id)) throw new Error("Этот обмен ранее отклонён.");
      return copy(current);
    }
    const trophies = replay(current).available.slice(0, RATE);
    if (trophies.length !== RATE) throw new Error(`Для Проклятой души нужны ${RATE} трофея Гладиатора Виктора.`);
    return merge(current, { ...createState(), victories: copy(current.victories),
      exchanges: [{ id, level, at, trophies }] });
  }

  function rewards(state) {
    if (!isValidState(state)) throw new Error("Награды вылазок не прошли проверку.");
    return [
      ...state.victories.filter((entry) => entry.serpent).map((entry) =>
        ({ id: entry.id, level: entry.level, at: entry.at, soul: "serpent", source: "darkwood-boss" })),
      ...replay(state).accepted.map((entry) =>
        ({ id: entry.id, level: entry.level, at: entry.at, soul: "cursed", source: "victor-trophies" })),
    ];
  }

  root.WellSoulSourcesModel = Object.freeze({
    RATE, SERPENT_CHANCE, createState, withDefaults, isValidState, merge, victory, exchange, rewards,
    trophies: (state) => replay(state).available,
  });
})(window);
