"use strict";

(function attachSoulCraftingModel(root) {
  const DROP_LEVEL = 1;
  const CRAFT_LEVEL = 150;
  const TRANSFER_LEVEL = 250;
  const SOULS = Object.freeze({
    time: Object.freeze({ name: "Душа времени", symbol: "⌛", weapon: 8, armor: 6, ring: 7 }),
    fire: Object.freeze({ name: "Душа огня", symbol: "♨", weapon: 7, armor: 7, ring: 10 }),
    death: Object.freeze({ name: "Душа смерти", symbol: "☠", weapon: 9, armor: 5, ring: 5 }),
    blood: Object.freeze({ name: "Душа крови", symbol: "♥", weapon: 6, armor: 9, ring: 8 }),
    serpent: Object.freeze({ name: "Душа змея", symbol: "♜", weapon: 10, armor: 10, ring: 9 }),
    cursed: Object.freeze({ name: "Проклятая душа", symbol: "☾", weapon: 5, armor: 8, ring: 8 }),
    fury: Object.freeze({ name: "Душа ярости", symbol: "⚔", weapon: 5, armor: 5, ring: 6 }),
  });
  const EQUIPMENT_NAMES = Object.freeze({
    time: { weapon: "R · Клинок эпохи", armor: "R · Плащ секунд" },
    fire: { weapon: "R · Пламенный меч", armor: "R · Кираса углей" },
    death: { weapon: "R · Коса безмолвия", armor: "R · Покров последнего часа" },
    blood: { weapon: "R · Кровавый резец", armor: "R · Броня алой клятвы" },
    serpent: { weapon: "R · Змеиный клык", armor: "R · Чешуйчатая кираса" },
    cursed: { weapon: "R · Проклятый клинок", armor: "R · Проклятый панцирь" },
    fury: { weapon: "R · Яростная секира", armor: "R · Доспех ярости" },
  });
  const RECIPES = Object.freeze(Object.fromEntries(
    Object.entries(SOULS).flatMap(([soulId, soul]) =>
      ["weapon", "armor"].map((type) => {
        const id = `${soulId}-${type}`;
        return [id, Object.freeze({
          id,
          soulId,
          type,
          name: EQUIPMENT_NAMES[soulId][type],
          bonus: 8,
          amount: soul[type],
          soulName: soul.name,
        })];
      })),
  ));
  const SOUL_IDS = Object.freeze(Object.keys(SOULS));
  const MAX_AMOUNT = 1000000000;

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function emptyBalances() {
    return Object.fromEntries(SOUL_IDS.map((id) => [id, 0]));
  }

  function createState() {
    return { base: emptyBalances(), balances: emptyBalances(), transactions: [] };
  }

  function isBalanceBag(value) {
    return Boolean(
      value && typeof value === "object" && !Array.isArray(value) &&
      Object.keys(value).length === SOUL_IDS.length &&
      SOUL_IDS.every((id) => Number.isInteger(value[id]) && value[id] >= 0 && value[id] <= MAX_AMOUNT),
    );
  }

  function isValidGear(gear) {
    return Boolean(
      gear && typeof gear === "object" &&
      typeof gear.id === "string" && /^gear-\d+$/.test(gear.id) &&
      ["weapon", "armor"].includes(gear.type) &&
      typeof gear.name === "string" && gear.name.length > 0 && gear.name.length <= 60 &&
      Number.isInteger(gear.bonus) && gear.bonus >= 1 && gear.bonus <= 10,
    );
  }

  function replay(base, transactions, rejectedIds = []) {
    const balances = { ...base };
    const rejected = new Set(rejectedIds);
    for (const transaction of [...transactions].sort((left, right) =>
      left.createdAt - right.createdAt || left.id.localeCompare(right.id))) {
      const changes = transaction.changes;
      if (rejected.has(transaction.id)) continue;
      if (Object.entries(changes).some(([soulId, amount]) =>
        balances[soulId] + amount < 0 || balances[soulId] + amount > MAX_AMOUNT)) {
        rejected.add(transaction.id);
        continue;
      }
      for (const [soulId, amount] of Object.entries(changes)) balances[soulId] += amount;
    }
    return { balances, transactions: copy(transactions), rejected: [...rejected].sort() };
  }

  function isValidState(state) {
    if (!state || typeof state !== "object" || !isBalanceBag(state.base) ||
      !isBalanceBag(state.balances) || !Array.isArray(state.transactions) ||
      state.transactions.length > 100000) return false;
    const ids = new Set();
    for (const transaction of state.transactions) {
      const recipe = RECIPES[transaction?.recipeId];
      if (!transaction || typeof transaction !== "object" ||
        typeof transaction.id !== "string" || transaction.id.length < 1 ||
        transaction.id.length > 100 || ids.has(transaction.id) ||
        !["drop", "craft", "transfer-in", "transfer-out"].includes(transaction.kind) ||
        !Number.isFinite(transaction.createdAt) ||
        !transaction.changes || typeof transaction.changes !== "object" ||
        Array.isArray(transaction.changes) ||
        Object.keys(transaction.changes).length < 1 ||
        Object.entries(transaction.changes).some(([soulId, amount]) =>
          !Object.hasOwn(SOULS, soulId) || !Number.isInteger(amount) ||
          amount === 0 || Math.abs(amount) > MAX_AMOUNT) ||
        (transaction.source !== undefined &&
          (typeof transaction.source !== "string" || transaction.source.length > 40)) ||
        (transaction.recipeId !== undefined &&
          (!Object.hasOwn(RECIPES, transaction.recipeId) || transaction.kind !== "craft")) ||
        (transaction.gear !== undefined &&
          (!isValidGear(transaction.gear) || transaction.kind !== "craft")) ||
        (transaction.kind === "craft" &&
          (!transaction.recipeId || !isValidGear(transaction.gear))) ||
        (transaction.kind === "drop" &&
          (Object.keys(transaction.changes).length !== 1 ||
            Object.values(transaction.changes).some((amount) => amount !== 1) ||
            (transaction.changes.serpent && transaction.source !== "darkwood-boss") ||
            (transaction.changes.cursed && transaction.source !== "victor-trophies"))) ||
        (transaction.kind === "craft" &&
          (Object.keys(transaction.changes).length !== 1 ||
            transaction.changes[recipe?.soulId] !== -recipe?.amount ||
            transaction.gear.type !== recipe?.type ||
            transaction.gear.name !== recipe?.name ||
            transaction.gear.bonus !== recipe?.bonus)) ||
        (transaction.kind === "transfer-in" &&
          (Object.keys(transaction.changes).length !== 1 ||
            Object.values(transaction.changes).some((amount) => amount !== 1))) ||
        (transaction.kind === "transfer-out" &&
          (Object.keys(transaction.changes).length !== 1 ||
            Object.values(transaction.changes).some((amount) => amount !== -1)))) return false;
      ids.add(transaction.id);
    }
    const rejected = state.rejected || [];
    if (!Array.isArray(rejected) || new Set(rejected).size !== rejected.length ||
      rejected.some((id) => !ids.has(id))) return false;
    const calculated = replay(state.base, state.transactions, rejected);
    return JSON.stringify(calculated.rejected) === JSON.stringify([...rejected].sort()) &&
      SOUL_IDS.every((id) => calculated.balances[id] === state.balances[id]);
  }

  function withDefaults(value) {
    if (!value || typeof value !== "object") return createState();
    if (!value.base) {
      const legacy = emptyBalances();
      const oldBalances = value.balances || value.counts || {};
      for (const id of SOUL_IDS) {
        if (Number.isInteger(oldBalances[id]) && oldBalances[id] >= 0) {
          legacy[id] = Math.min(MAX_AMOUNT, oldBalances[id]);
        }
      }
      return { base: { ...legacy }, balances: { ...legacy }, transactions: [] };
    }
    const normalized = {
      base: { ...emptyBalances(), ...(value.base || {}) },
      balances: { ...emptyBalances(), ...(value.balances || {}) },
      transactions: Array.isArray(value.transactions) ? copy(value.transactions) : [],
      rejected: Array.isArray(value.rejected) ? [...value.rejected] : [],
    };
    return normalized;
  }

  function apply(current, transaction) {
    const state = withDefaults(current);
    if (!isValidState(state)) return { ok: false, reason: "Запас душ повреждён; действие не выполнено." };
    if (!transaction || typeof transaction.id !== "string" || !transaction.id) {
      return { ok: false, reason: "Не удалось создать квитанцию операции." };
    }
    const previous = state.transactions.find((entry) => entry.id === transaction.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(transaction)) {
        return { ok: false, reason: "Квитанция уже использована для другого действия." };
      }
      if (state.rejected.includes(transaction.id)) {
        return { ok: false, reason: "Эта квитанция ранее отклонена при объединении сохранений." };
      }
      return { ok: true, state, duplicate: true, gear: previous.gear };
    }
    if (Object.entries(transaction.changes).some(([soulId, amount]) =>
      !Object.hasOwn(SOULS, soulId) || !Number.isInteger(amount) ||
      state.balances[soulId] + amount < 0 ||
      state.balances[soulId] + amount > MAX_AMOUNT)) {
      return { ok: false, reason: "Недостаточно душ для этого действия." };
    }
    const next = copy(state);
    for (const [soulId, amount] of Object.entries(transaction.changes)) {
      next.balances[soulId] += amount;
    }
    next.transactions.push(copy(transaction));
    if (!isValidState(next)) return { ok: false, reason: "Изменение запаса душ прошло неверную проверку." };
    return { ok: true, state: next, gear: transaction.gear };
  }

  function grant(current, playerLevel, soulId, receiptId, source, now = Date.now()) {
    if (!Number.isInteger(playerLevel) || playerLevel < DROP_LEVEL) {
      return { ok: false, reason: `Души начинают выпадать с ${DROP_LEVEL}-го уровня.` };
    }
    if (!Object.hasOwn(SOULS, soulId)) return { ok: false, reason: "Неизвестная душа." };
    if ((soulId === "serpent" && source !== "darkwood-boss") ||
      (soulId === "cursed" && source !== "victor-trophies")) {
      return { ok: false, reason: "Эта душа не выпадает из указанного источника." };
    }
    return apply(current, {
      id: receiptId,
      kind: "drop",
      source,
      createdAt: now,
      changes: { [soulId]: 1 },
    });
  }

  function craft(current, playerLevel, recipeId, gearId, receiptId, now = Date.now()) {
    if (!Number.isInteger(playerLevel) || playerLevel < CRAFT_LEVEL) {
      return { ok: false, reason: `R-ремесло доступно с ${CRAFT_LEVEL}-го уровня.` };
    }
    const recipe = RECIPES[recipeId];
    if (!recipe) return { ok: false, reason: "Рецепт R-экипировки не найден." };
    if (typeof gearId !== "string" || !/^gear-\d+$/.test(gearId)) {
      return { ok: false, reason: "Не удалось создать номер предмета." };
    }
    const gear = { id: gearId, type: recipe.type, name: recipe.name, bonus: recipe.bonus };
    const result = apply(current, {
      id: receiptId,
      kind: "craft",
      recipeId,
      createdAt: now,
      changes: { [recipe.soulId]: -recipe.amount },
      gear,
    });
    return result.ok ? { ...result, recipe } : result;
  }

  function transferOut(current, playerLevel, recipientLevel, soulId, receiptId, now = Date.now()) {
    if (!Number.isInteger(playerLevel) || !Number.isInteger(recipientLevel) ||
      playerLevel < TRANSFER_LEVEL || recipientLevel < TRANSFER_LEVEL) {
      return { ok: false, reason: `Передача душ доступна только игрокам от ${TRANSFER_LEVEL}-го уровня.` };
    }
    if (!Object.hasOwn(SOULS, soulId)) return { ok: false, reason: "Неизвестная душа." };
    return apply(current, {
      id: receiptId,
      kind: "transfer-out",
      createdAt: now,
      changes: { [soulId]: -1 },
    });
  }

  function receive(current, playerLevel, soulId, receiptId, now = Date.now()) {
    if (!Number.isInteger(playerLevel) || playerLevel < TRANSFER_LEVEL) {
      return { ok: false, reason: `Получать души можно только с ${TRANSFER_LEVEL}-го уровня.` };
    }
    if (!Object.hasOwn(SOULS, soulId)) return { ok: false, reason: "Неизвестная душа." };
    return apply(current, {
      id: receiptId,
      kind: "transfer-in",
      createdAt: now,
      changes: { [soulId]: 1 },
    });
  }

  function merge(left, right) {
    const first = withDefaults(left);
    const second = withDefaults(right);
    const base = Object.fromEntries(SOUL_IDS.map((id) => [
      id, Math.max(first.base[id] || 0, second.base[id] || 0),
    ]));
    const byId = new Map();
    for (const transaction of [...first.transactions, ...second.transactions]) {
      const existing = byId.get(transaction.id);
      if (existing && JSON.stringify(existing) !== JSON.stringify(transaction)) {
        throw new Error("UUID души уже использован для другой операции.");
      }
      byId.set(transaction.id, transaction);
    }
    const result = replay(base, [...byId.values()], [...first.rejected, ...second.rejected]);
    return { base, ...result };
  }

  function reconcileSources(current, rewards) {
    const state = withDefaults(current);
    const allowed = new Set(rewards.map((entry) => entry.id));
    const rejected = new Set(state.rejected);
    for (const entry of state.transactions) {
      if (["darkwood-boss", "victor-trophies"].includes(entry.source) && !allowed.has(entry.id)) {
        rejected.add(entry.id);
      }
    }
    return { base: state.base, ...replay(state.base, state.transactions, [...rejected]) };
  }

  root.WellSoulCraftingModel = Object.freeze({
    CRAFT_LEVEL,
    DROP_LEVEL,
    RECIPES,
    SOULS,
    TRANSFER_LEVEL,
    createState,
    craft,
    grant,
    isValidState,
    merge,
    receive,
    reconcileSources,
    transferOut,
    withDefaults,
  });
})(window);
