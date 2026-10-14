"use strict";

(function attachElementalGearModel(root) {
  const CRAFT_LEVEL = 30;
  const MAX_AMOUNT = 1000000000;
  const MAX_TRANSACTIONS = 100000;
  const CRITICAL_CHANCE = 0.08;
  const GEAR_CRAFTING_BLOCKED_REASON =
    "Стихийное снаряжение пока недоступно: в игре нет системы дальнейшего роста характеристик.";
  const validId = (id) => typeof id === "string" && id.length > 0 && id.length <= 100;
  const MATERIALS = Object.freeze({
    emberglass: Object.freeze({ name: "Угольное стекло", source: "ore-careful", essence: "emberEssence" }),
    tidePearl: Object.freeze({ name: "Жемчужина тихой воды", source: "fish-shiny", essence: "tideEssence" }),
    rootAmber: Object.freeze({ name: "Янтарь корневой рощи", source: "grove-harvest", essence: "rootEssence" }),
    primalWater: Object.freeze({ name: "Первородная чистая вода", source: "grove-drink" }),
    heartFragment: Object.freeze({ name: "Осколок сердца хранителя", source: "keeper-defeat" }),
    recipeBook: Object.freeze({ name: "Свиток шести связей", source: "book-study" }),
  });
  const ESSENCES = Object.freeze({
    emberEssence: Object.freeze({ name: "Эссенция угольного стекла", material: "emberglass" }),
    tideEssence: Object.freeze({ name: "Эссенция тихой воды", material: "tidePearl" }),
    rootEssence: Object.freeze({ name: "Эссенция корневого янтаря", material: "rootAmber" }),
  });
  const ATTRIBUTES = Object.freeze(["strength", "agility", "endurance"]);
  const RECIPES = Object.freeze({
    "ember-edge": Object.freeze({
      id: "ember-edge", name: "Клинок угольного рассвета", type: "weapon",
      essence: "emberEssence", advantage: "strength", drawback: "agility",
    }),
    "ember-mail": Object.freeze({
      id: "ember-mail", name: "Кираса жарких жил", type: "armor",
      essence: "emberEssence", advantage: "strength", drawback: "endurance",
    }),
    "tide-needle": Object.freeze({
      id: "tide-needle", name: "Игла приливного стекла", type: "weapon",
      essence: "tideEssence", advantage: "agility", drawback: "strength",
    }),
    "tide-wrap": Object.freeze({
      id: "tide-wrap", name: "Панцирь зыбкого берега", type: "armor",
      essence: "tideEssence", advantage: "agility", drawback: "endurance",
    }),
    "root-spear": Object.freeze({
      id: "root-spear", name: "Копьё янтарных корней", type: "weapon",
      essence: "rootEssence", advantage: "endurance", drawback: "strength",
    }),
    "root-guard": Object.freeze({
      id: "root-guard", name: "Доспех тихой рощи", type: "armor",
      essence: "rootEssence", advantage: "endurance", drawback: "agility",
    }),
  });
  const RESOURCE_IDS = Object.freeze([
    ...Object.keys(MATERIALS),
    ...Object.keys(ESSENCES),
  ]);

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emptyBalances() {
    return Object.fromEntries(RESOURCE_IDS.map((id) => [id, 0]));
  }

  function createState() {
    return { base: emptyBalances(), balances: emptyBalances(), transactions: [] };
  }

  function isValidAttributes(attributes, recipe) {
    if (!attributes || typeof attributes !== "object" || Array.isArray(attributes) ||
      Object.keys(attributes).length !== ATTRIBUTES.length ||
      !ATTRIBUTES.every((attribute) => Number.isInteger(attributes[attribute]))) return false;
    const positive = ATTRIBUTES.filter((attribute) => attributes[attribute] === 100);
    const negative = ATTRIBUTES.filter((attribute) => attributes[attribute] === -50);
    const neutral = ATTRIBUTES.filter((attribute) => attributes[attribute] === 0);
    return positive.length === 1 && negative.length === 1 && neutral.length === 1 &&
      (!recipe || (attributes[recipe.advantage] === 100 && attributes[recipe.drawback] === -50));
  }

  function isBalanceBag(value) {
    return Boolean(
      value && typeof value === "object" && !Array.isArray(value) &&
      Object.keys(value).length === RESOURCE_IDS.length &&
      RESOURCE_IDS.every((id) => Number.isInteger(value[id]) && value[id] >= 0 && value[id] <= MAX_AMOUNT),
    );
  }

  function validDrop(transaction) {
    const material = MATERIALS[transaction.resourceId];
    return Boolean(
      material && transaction.source === material.source &&
      Number.isInteger(transaction.playerLevel) && transaction.playerLevel >= CRAFT_LEVEL &&
      transaction.count === 1 && transaction.critical === undefined,
    );
  }

  function validEssence(transaction) {
    const essence = ESSENCES[transaction.essenceId];
    return Boolean(
      essence && transaction.materialId === essence.material &&
      typeof transaction.critical === "boolean" &&
      transaction.count === (transaction.critical ? 2 : 1) &&
      Number.isInteger(transaction.playerLevel) && transaction.playerLevel >= CRAFT_LEVEL,
    );
  }

  function transactionChanges(transaction) {
    if (transaction.kind === "drop") return { [transaction.resourceId]: 1 };
    if (transaction.kind === "essence") {
      return {
        [transaction.materialId]: -1,
        primalWater: -1,
        [transaction.essenceId]: transaction.count,
      };
    }
    return null;
  }

  function validTransaction(transaction) {
    if (!transaction || typeof transaction !== "object" ||
      !validId(transaction.id) ||
      !Number.isFinite(transaction.createdAt) ||
      !["drop", "essence"].includes(transaction.kind)) return false;
    if (transaction.kind === "drop") return validDrop(transaction);
    return validEssence(transaction);
  }

  function replay(base, transactions) {
    const balances = { ...base };
    const accepted = [];
    for (const transaction of [...transactions].sort((left, right) =>
      left.createdAt - right.createdAt || left.id.localeCompare(right.id))) {
      if (!validTransaction(transaction)) continue;
      const changes = transactionChanges(transaction);
      if (!changes || Object.entries(changes).some(([id, amount]) =>
        balances[id] + amount < 0 || balances[id] + amount > MAX_AMOUNT)) continue;
      for (const [id, amount] of Object.entries(changes)) balances[id] += amount;
      accepted.push(transaction);
    }
    return { balances, transactions: accepted };
  }

  function isValidState(state) {
    if (!state || typeof state !== "object" || !isBalanceBag(state.base) ||
      !isBalanceBag(state.balances) || !Array.isArray(state.transactions) ||
      state.transactions.length > MAX_TRANSACTIONS ||
      !state.transactions.every(validTransaction) ||
      new Set(state.transactions.map((transaction) => transaction.id)).size !== state.transactions.length) return false;
    const calculated = replay(state.base, state.transactions);
    return calculated.transactions.length === state.transactions.length &&
      RESOURCE_IDS.every((id) => calculated.balances[id] === state.balances[id]);
  }

  function withDefaults(value) {
    if (!value || typeof value !== "object") return createState();
    const state = {
      base: { ...emptyBalances(), ...(value.base || {}) },
      balances: { ...emptyBalances(), ...(value.balances || {}) },
      transactions: Array.isArray(value.transactions) ? copy(value.transactions) : [],
    };
    return state;
  }

  function apply(current, transaction) {
    const state = withDefaults(current);
    if (!isValidState(state)) return { ok: false, reason: "Запас стихийных материалов повреждён; действие не выполнено." };
    if (!validTransaction(transaction)) return { ok: false, reason: "Квитанция стихийного ремесла некорректна." };
    const previous = state.transactions.find((entry) => entry.id === transaction.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(transaction)) {
        return { ok: false, reason: "Квитанция уже использована для другого действия." };
      }
      return { ok: true, state, duplicate: true, gear: previous.gear };
    }
    const changes = transactionChanges(transaction);
    if (Object.entries(changes).some(([id, amount]) =>
      state.balances[id] + amount < 0 || state.balances[id] + amount > MAX_AMOUNT)) {
      return { ok: false, reason: "Недостаточно стихийного материала или первородной воды." };
    }
    const next = copy(state);
    for (const [id, amount] of Object.entries(changes)) next.balances[id] += amount;
    next.transactions.push(copy(transaction));
    if (!isValidState(next)) return { ok: false, reason: "Изменение запаса не прошло проверку." };
    return { ok: true, state: next, gear: transaction.gear };
  }

  function grant(current, playerLevel, resourceId, receiptId, source, now = Date.now()) {
    if (!Number.isInteger(playerLevel) || playerLevel < CRAFT_LEVEL) {
      return { ok: false, reason: `Стихийные находки доступны с ${CRAFT_LEVEL}-го уровня.` };
    }
    const material = MATERIALS[resourceId];
    if (!material || source !== material.source) return { ok: false, reason: "Этот материал нельзя получить из указанного события." };
    return apply(current, {
      id: receiptId,
      kind: "drop",
      resourceId,
      source,
      playerLevel,
      count: 1,
      createdAt: now,
    });
  }

  function createEssence(current, playerLevel, materialId, receiptId, random = Math.random, now = Date.now()) {
    if (!Number.isInteger(playerLevel) || playerLevel < CRAFT_LEVEL) {
      return { ok: false, reason: `Стихийное ремесло доступно с ${CRAFT_LEVEL}-го уровня.` };
    }
    const material = MATERIALS[materialId];
    if (!material || !material.essence) return { ok: false, reason: "Для этого материала нет рецепта эссенции." };
    if (typeof random !== "function") throw new Error("RNG must be a function.");
    const roll = random();
    if (!Number.isFinite(roll) || roll < 0 || roll >= 1) throw new Error("RNG must return a number in [0, 1).");
    const transaction = {
      id: receiptId,
      kind: "essence",
      materialId,
      essenceId: material.essence,
      count: roll < CRITICAL_CHANCE ? 2 : 1,
      critical: roll < CRITICAL_CHANCE,
      playerLevel,
      createdAt: now,
    };
    const result = apply(current, transaction);
    return result.ok ? { ...result, essence: ESSENCES[material.essence], critical: transaction.critical } : result;
  }

  function craft(playerLevel, recipeId) {
    if (!Number.isInteger(playerLevel) || playerLevel < CRAFT_LEVEL) {
      return { ok: false, reason: `Стихийное снаряжение доступно с ${CRAFT_LEVEL}-го уровня.` };
    }
    if (!Object.hasOwn(RECIPES, recipeId)) {
      return { ok: false, reason: "Рецепт стихийного снаряжения не найден." };
    }
    return { ok: false, reason: GEAR_CRAFTING_BLOCKED_REASON };
  }

  function merge(left, right) {
    const first = withDefaults(left);
    const second = withDefaults(right);
    if (!isValidState(first) || !isValidState(second)) {
      throw new Error("Стихийный запас повреждён; слияние не выполнено.");
    }
    const base = Object.fromEntries(RESOURCE_IDS.map((id) => [
      id, Math.max(first.base[id], second.base[id]),
    ]));
    const byId = new Map();
    for (const transaction of [...first.transactions, ...second.transactions]) {
      const existing = byId.get(transaction.id);
      if (existing && JSON.stringify(transaction) !== JSON.stringify(existing)) {
        throw new Error("Конфликт стихийной квитанции: один номер содержит разные операции. Слияние не выполнено.");
      }
      if (!existing) byId.set(transaction.id, transaction);
    }
    const result = replay(base, [...byId.values()]);
    if (result.transactions.length !== byId.size) {
      throw new Error("Конфликт стихийных ресурсов: параллельные операции расходуют один запас. Слияние не выполнено.");
    }
    return { base, balances: result.balances, transactions: result.transactions };
  }

  root.WellElementalGearModel = Object.freeze({
    ATTRIBUTES,
    CRAFT_LEVEL,
    CRITICAL_CHANCE,
    ESSENCES,
    GEAR_CRAFTING_BLOCKED_REASON,
    MATERIALS,
    RECIPES,
    apply,
    craft,
    createEssence,
    createState,
    grant,
    isValidAttributes,
    isValidState,
    merge,
    withDefaults,
  });
})(typeof window !== "undefined" ? window : globalThis);
