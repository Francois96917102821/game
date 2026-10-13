"use strict";

(() => {
  const VERSION = 1;
  const MAX_RECORDS = 100000;
  const MAX_ITEM_COUNT = 1000000;
  const MATERIAL_CAP = 20;
  const HOUSE_TYPES = Object.freeze({
    cabin: Object.freeze({ name: "Простая хижина", tier: 1, plots: 2, sleepMs: 160 * 60 * 1000, gold: 20000, essence: 0 }),
    sturdy: Object.freeze({ name: "Добротный дом", tier: 2, plots: 4, sleepMs: 140 * 60 * 1000, gold: 0, essence: 400 }),
    mansion: Object.freeze({ name: "Богатый особняк", tier: 3, plots: 6, sleepMs: 120 * 60 * 1000, gold: 0, essence: 1000 }),
  });
  const BUILDING_TYPES = Object.freeze({
    boards: Object.freeze({ name: "Доски · мастерская", input: "logs", output: "boards", amount: 3, recipe: { logs: 5, stone: 5 }, maxLevel: null }),
    blocks: Object.freeze({ name: "Блоки · мастерская", input: "stone", output: "blocks", amount: 3, recipe: { logs: 5, stone: 5 }, maxLevel: null }),
    ingots: Object.freeze({ name: "Слитки · мастерская", input: "ore", output: "ingots", amount: 3, recipe: { logs: 5, stone: 5 }, maxLevel: null }),
    cloth: Object.freeze({ name: "Ткань · мастерская", input: "flax", output: "cloth", amount: 3, recipe: { logs: 5, stone: 5 }, maxLevel: null }),
    shed: Object.freeze({ name: "Склад", recipe: { boards: 5, blocks: 5, ingots: 3, cloth: 3 }, maxLevel: null }),
    pond: Object.freeze({ name: "Пруд", recipe: { boards: 10, blocks: 10, ingots: 5, cloth: 5 }, maxLevel: 18 }),
    garden: Object.freeze({ name: "Сад", recipe: { boards: 15, blocks: 15, ingots: 5, cloth: 5 }, maxLevel: 8 }),
  });
  const ALTARS = Object.freeze({
    fishing: Object.freeze({ name: "Рыбалки", maxLevel: 15 }),
    runes: Object.freeze({ name: "Рун", maxLevel: 20 }),
    strength: Object.freeze({ name: "Силы", maxLevel: null }),
    agility: Object.freeze({ name: "Ловкости", maxLevel: null }),
    endurance: Object.freeze({ name: "Выносливости", maxLevel: null }),
    pain: Object.freeze({ name: "Боли", maxLevel: null }),
  });
  const MATERIALS = Object.freeze(["logs", "stone", "ore", "flax", "boards", "blocks", "ingots", "cloth"]);
  const COUNTS = Object.freeze(["water", "plants", "seeds", "grain", "bait"]);
  const MATERIAL_SET = new Set(MATERIALS);
  const COUNT_SET = new Set(COUNTS);
  const ALL_ITEM_SET = new Set([...MATERIALS, ...COUNTS]);
  const TRANSACTION_TYPES = new Set([
    "house-purchase", "plot-purchase", "loot", "build", "upgrade", "craft",
    "garden-harvest", "plant", "crop-harvest", "crop-expired", "fishing", "sleep-start", "sleep-complete",
  ]);
  const HOUR = 60 * 60 * 1000;

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createState() {
    return {
      version: VERSION,
      houses: [],
      plots: [],
      stock: Object.fromEntries(MATERIALS.map((item) => [item, 0])),
      water: 0,
      plants: 0,
      seeds: 0,
      grain: 0,
      bait: 0,
      crop: null,
      sleep: null,
      altars: Object.fromEntries(Object.keys(ALTARS).map((id) => [id, 0])),
      transactions: [],
    };
  }

  function isId(value) {
    return typeof value === "string" && /^[\w.:-]{1,120}$/.test(value);
  }

  function validCount(value) {
    return Number.isInteger(value) && value >= 0 && value <= MAX_ITEM_COUNT;
  }

  function activeHouse(state) {
    return state.houses.reduce((best, house) =>
      !best || HOUSE_TYPES[house.tier].tier > HOUSE_TYPES[best.tier].tier ? house : best, null);
  }

  function activePlotLimit(state) {
    const house = activeHouse(state);
    return house ? HOUSE_TYPES[house.tier].plots : 0;
  }

  function materialCapacity(state) {
    const warehouse = state.plots.reduce((level, plot) =>
      plot.building?.type === "shed" ? level + plot.building.level : level, 0);
    return MATERIAL_CAP + (warehouse ? warehouse * 10 + 20 : 0);
  }

  function materialTotal(stock) {
    return MATERIALS.reduce((total, item) => total + stock[item], 0);
  }

  function transactionValid(transaction) {
    if (!transaction || typeof transaction !== "object" || !isId(transaction.id) ||
      !Number.isInteger(transaction.at) || transaction.at < 0 ||
      !TRANSACTION_TYPES.has(transaction.type)) return false;
    if (transaction.costs !== undefined) {
      if (!transaction.costs || typeof transaction.costs !== "object" ||
        Object.keys(transaction.costs).some((key) => !["gold", "essence"].includes(key)) ||
        Object.values(transaction.costs).some((amount) => !Number.isInteger(amount) || amount < 0 || amount > MAX_ITEM_COUNT)) return false;
      if (!["house-purchase", "plot-purchase"].includes(transaction.type)) return false;
    }
    if (transaction.delta !== undefined) {
      if (!transaction.delta || typeof transaction.delta !== "object" ||
        Object.keys(transaction.delta).some((key) => !ALL_ITEM_SET.has(key)) ||
        Object.values(transaction.delta).some((amount) => !Number.isInteger(amount) || Math.abs(amount) > MAX_ITEM_COUNT)) return false;
    }
    if (transaction.type === "house-purchase") {
      const price = transaction.tier === "cabin" && transaction.payment === "gold" ? { gold: 20000, essence: 0 }
        : transaction.tier === "sturdy" && transaction.payment === "essence" ? { gold: 0, essence: 400 }
          : transaction.tier === "mansion" && transaction.payment === "essence" ? { gold: 0, essence: 1000 }
            : transaction.tier === "mansion" && transaction.payment === "sturdy-upgrade" ? { gold: 0, essence: 600 }
              : null;
      if (!isId(transaction.houseId) || !price || !transaction.costs ||
        transaction.costs.gold !== price.gold || transaction.costs.essence !== price.essence) return false;
    } else if (transaction.type === "plot-purchase") {
      if (!isId(transaction.plotId) || !transaction.costs ||
        transaction.costs.gold !== 0 || transaction.costs.essence !== 100) return false;
    } else if (transaction.type === "build" || transaction.type === "upgrade") {
      const definition = BUILDING_TYPES[transaction.buildingType];
      if (!isId(transaction.plotId) || !definition || !transaction.delta ||
        Object.keys(transaction.delta).length !== Object.keys(definition.recipe).length ||
        Object.entries(definition.recipe).some(([item, amount]) => transaction.delta[item] !== -amount)) return false;
    } else if (transaction.type === "plant") {
      if (!isId(transaction.plotId) || !transaction.delta ||
        transaction.delta.seeds !== -1 || transaction.delta.water !== -1 ||
        Object.keys(transaction.delta).length !== 2) return false;
    } else if (transaction.type === "crop-harvest") {
      if (!isId(transaction.cropId) || !isId(transaction.plotId) || !transaction.delta ||
        transaction.delta.water !== -1 || transaction.delta.grain !== 1 ||
        Object.keys(transaction.delta).length !== 2) return false;
    } else if (transaction.type === "crop-expired") {
      if (!isId(transaction.cropId) || !isId(transaction.plotId) || transaction.delta !== undefined) return false;
    }
    return true;
  }

  function isValidState(state) {
    if (!state || typeof state !== "object" || Array.isArray(state) || state.version !== VERSION ||
      !Array.isArray(state.houses) || state.houses.length > MAX_RECORDS ||
      !Array.isArray(state.transactions) || state.transactions.length > MAX_RECORDS ||
      !state.transactions.every(transactionValid) ||
      new Set(state.transactions.map((transaction) => transaction.id)).size !== state.transactions.length ||
      !state.houses.every((house) => house && isId(house.id) && Object.hasOwn(HOUSE_TYPES, house.tier) &&
        Number.isInteger(house.purchasedAt) && house.purchasedAt >= 0) ||
      new Set(state.houses.map((house) => house.id)).size !== state.houses.length ||
      !state.houses.every((house) => state.transactions.some((transaction) => transaction.type === "house-purchase" &&
        transaction.houseId === house.id && transaction.tier === house.tier && transaction.at === house.purchasedAt)) ||
      !Array.isArray(state.plots) || state.plots.length > MAX_RECORDS ||
      !state.plots.every((plot) => plot && isId(plot.id) &&
        (plot.building === null || plot.building && Object.hasOwn(BUILDING_TYPES, plot.building.type) &&
          Number.isInteger(plot.building.level) && plot.building.level >= 1 && plot.building.level <= MAX_ITEM_COUNT &&
          Number.isInteger(plot.building.builtAt) && plot.building.builtAt >= 0 &&
          (!BUILDING_TYPES[plot.building.type].maxLevel || plot.building.level <= BUILDING_TYPES[plot.building.type].maxLevel))) ||
      new Set(state.plots.map((plot) => plot.id)).size !== state.plots.length ||
      !state.plots.every((plot) => state.transactions.some((transaction) => transaction.type === "plot-purchase" &&
        transaction.plotId === plot.id)) ||
      !state.stock || Object.keys(state.stock).length !== MATERIALS.length ||
      !MATERIALS.every((item) => validCount(state.stock[item])) ||
      !validCount(state.water) || state.water > 1000 ||
      !validCount(state.plants) || !validCount(state.seeds) || !validCount(state.grain) || !validCount(state.bait) ||
      !state.altars || Object.keys(state.altars).length !== Object.keys(ALTARS).length ||
      !Object.entries(ALTARS).every(([id, altar]) => Number.isInteger(state.altars[id]) && state.altars[id] >= 0 &&
        (!altar.maxLevel || state.altars[id] <= altar.maxLevel)) ||
      (state.crop !== null && !(state.crop && isId(state.crop.id) &&
        Number.isInteger(state.crop.plantedAt) && state.crop.plantedAt >= 0 &&
        isId(state.crop.plotId) && state.plots.some((plot) => plot.id === state.crop.plotId &&
          plot.building?.type === "garden") &&
        state.transactions.some((transaction) => transaction.type === "plant" &&
          transaction.id === `${state.crop.id}:planted` && transaction.plotId === state.crop.plotId &&
          transaction.at === state.crop.plantedAt) &&
        !state.transactions.some((transaction) =>
          (transaction.type === "crop-harvest" || transaction.type === "crop-expired") &&
          transaction.cropId === state.crop.id) &&
        (state.crop.secondWaterAt === null || Number.isInteger(state.crop.secondWaterAt) && state.crop.secondWaterAt >= state.crop.plantedAt))) ||
      (state.sleep !== null && !(state.sleep && isId(state.sleep.id) && Object.hasOwn(HOUSE_TYPES, state.sleep.tier) &&
        Number.isInteger(state.sleep.startedAt) && Number.isInteger(state.sleep.endsAt) &&
        state.sleep.endsAt - state.sleep.startedAt === HOUSE_TYPES[state.sleep.tier].sleepMs &&
        state.houses.some((house) => house.tier === state.sleep.tier) &&
        state.transactions.some((transaction) => transaction.type === "sleep-start" &&
          transaction.id === state.sleep.id && transaction.at === state.sleep.startedAt)))) return false;
    return true;
  }

  function withDefaults(value) {
    if (value === undefined || value === null) return createState();
    if (!isValidState(value)) return createState();
    return copy(value);
  }

  function transactionExists(state, id) {
    return state.transactions.some((transaction) => transaction.id === id);
  }

  function addTransaction(state, transaction) {
    if (!isId(transaction.id) || transactionExists(state, transaction.id)) return false;
    if (state.transactions.length >= MAX_RECORDS) return false;
    state.transactions.push(transaction);
    return true;
  }

  function getCost(currency, amount) {
    return { gold: currency === "gold" ? amount : 0, essence: currency === "essence" ? amount : 0 };
  }

  function purchaseHouse(current, balances, tier, payment, id, houseId, now = Date.now()) {
    const state = withDefaults(current);
    if (!Object.hasOwn(HOUSE_TYPES, tier) || !isId(id) || !isId(houseId) ||
      !Number.isInteger(now) || now < 0 || transactionExists(state, id)) {
      return { state, balances, purchased: false, reason: "invalid" };
    }
    if (state.houses.some((house) => house.id === houseId)) return { state, balances, purchased: false, reason: "owned" };
    const ownedSturdy = state.houses.some((house) => house.tier === "sturdy");
    let currency;
    let amount;
    if (tier === "cabin" && payment === "gold") [currency, amount] = ["gold", 20000];
    else if (tier === "sturdy" && payment === "essence") [currency, amount] = ["essence", 400];
    else if (tier === "mansion" && payment === "essence") [currency, amount] = ["essence", 1000];
    else if (tier === "mansion" && payment === "sturdy-upgrade" && ownedSturdy) [currency, amount] = ["essence", 600];
    else return { state, balances, purchased: false, reason: "payment" };
    if (!balances || !Number.isInteger(balances.gold) || balances.gold < 0 || balances.gold > 1000000000 ||
      !Number.isInteger(balances.essence) || balances.essence < 0 || balances.essence > 1000000000 ||
      balances[currency] < amount) {
      return { state, balances, purchased: false, reason: currency };
    }
    const nextBalances = { ...balances, [currency]: balances[currency] - amount };
    if (state.transactions.length >= MAX_RECORDS) return { state, balances, purchased: false, reason: "limit" };
    state.houses.push({ id: houseId, tier, purchasedAt: now });
    if (!addTransaction(state, { id, type: "house-purchase", at: now, houseId, tier, payment, costs: getCost(currency, amount) })) {
      return { state: current, balances, purchased: false, reason: "limit" };
    }
    return { state, balances: nextBalances, purchased: true, reason: "" };
  }

  function buyPlot(current, essence, id, plotId, now = Date.now()) {
    const state = withDefaults(current);
    if (!Number.isInteger(essence) || essence < 0 || !isId(id) || !isId(plotId) ||
      !Number.isInteger(now) || now < 0 || transactionExists(state, id)) {
      return { state, essence, purchased: false, reason: "invalid" };
    }
    if (!activeHouse(state)) return { state, essence, purchased: false, reason: "no-house" };
    if (state.plots.length >= activePlotLimit(state)) return { state, essence, purchased: false, reason: "cap" };
    if (state.plots.some((plot) => plot.id === plotId)) return { state, essence, purchased: false, reason: "owned" };
    if (essence < 100) return { state, essence, purchased: false, reason: "essence" };
    if (state.transactions.length >= MAX_RECORDS) return { state, essence, purchased: false, reason: "limit" };
    state.plots.push({ id: plotId, building: null });
    addTransaction(state, { id, type: "plot-purchase", at: now, plotId, costs: getCost("essence", 100) });
    return { state, essence: essence - 100, purchased: true, reason: "" };
  }

  function recordLoot(current, loot, id, now = Date.now()) {
    const state = withDefaults(current);
    if (!isId(id) || !Number.isInteger(now) || now < 0 || transactionExists(state, id) ||
      !loot || typeof loot !== "object" || Object.keys(loot).some((key) => ![...MATERIALS, "water"].includes(key)) ||
      Object.entries(loot).some(([item, amount]) => !Number.isInteger(amount) || amount < 0 ||
        amount > (item === "water" ? 100 : 10))) {
      return { state, added: {}, reason: "invalid" };
    }
    const lastLoot = state.transactions.filter((transaction) => transaction.type === "loot")
      .reduce((latest, transaction) => Math.max(latest, transaction.at), -1);
    if (lastLoot >= 0 && now - lastLoot < 2 * HOUR) {
      return { state, added: {}, reason: "cooldown", availableAt: lastLoot + 2 * HOUR };
    }
    if (state.transactions.length >= MAX_RECORDS) return { state, added: {}, reason: "limit" };
    const delta = {};
    for (const [item, amount] of Object.entries(loot)) {
      if (item === "water") {
        delta.water = Math.min(amount, 1000 - state.water);
        state.water += delta.water;
      } else {
        const room = Math.max(0, materialCapacity(state) - materialTotal(state.stock));
        delta[item] = Math.min(amount, room);
        state.stock[item] += delta[item];
      }
    }
    addTransaction(state, { id, type: "loot", at: now, delta });
    return { state, added: delta, reason: "" };
  }

  function plotById(state, plotId, buildingType) {
    return state.plots.find((plot) => plot.id === plotId &&
      plot.building?.type === buildingType && plot.building.level >= 1);
  }

  function construct(current, plotId, buildingType, id, now = Date.now()) {
    const state = withDefaults(current);
    const definition = BUILDING_TYPES[buildingType];
    const plot = state.plots.find((candidate) => candidate.id === plotId);
    if (!definition || !plot || !isId(id) || !Number.isInteger(now) || now < 0 || transactionExists(state, id)) {
      return { state, built: false, reason: "invalid" };
    }
    if (state.transactions.length >= MAX_RECORDS) return { state, built: false, reason: "limit" };
    const currentLevel = plot.building?.level || 0;
    if (plot.building && plot.building.type !== buildingType) return { state, built: false, reason: "occupied" };
    if (definition.maxLevel && currentLevel >= definition.maxLevel) return { state, built: false, reason: "max-level" };
    if (Object.entries(definition.recipe).some(([item, amount]) => state.stock[item] < amount)) {
      return { state, built: false, reason: "materials" };
    }
    if (currentLevel === 0 && state.plots.filter((slot) => slot.building).length >= activePlotLimit(state)) {
      return { state, built: false, reason: "inactive-plot" };
    }
    for (const [item, amount] of Object.entries(definition.recipe)) state.stock[item] -= amount;
    plot.building = { type: buildingType, level: currentLevel + 1, builtAt: now };
    const delta = Object.fromEntries(Object.entries(definition.recipe).map(([item, amount]) => [item, -amount]));
    addTransaction(state, { id, type: currentLevel ? "upgrade" : "build", at: now, plotId, buildingType, delta });
    return { state, built: true, level: currentLevel + 1, reason: "" };
  }

  function usedToday(state, plotId, now) {
    const date = new Date(now).toISOString().slice(0, 10);
    return state.transactions.filter((transaction) => transaction.type === "craft" &&
      transaction.plotId === plotId && new Date(transaction.at).toISOString().slice(0, 10) === date).length;
  }

  function craft(current, plotId, id, now = Date.now()) {
    const state = withDefaults(current);
    const plot = state.plots.find((candidate) => candidate.id === plotId);
    const definition = plot?.building && BUILDING_TYPES[plot.building.type];
    if (!definition?.output || !isId(id) || !Number.isInteger(now) || now < 0 || transactionExists(state, id)) {
      return { state, crafted: false, reason: "invalid" };
    }
    if (usedToday(state, plotId, now) >= 2 + plot.building.level) return { state, crafted: false, reason: "daily-limit" };
    if (state.stock[definition.input] < 3) return { state, crafted: false, reason: "materials" };
    if (materialTotal(state.stock) - 3 + 1 > materialCapacity(state)) return { state, crafted: false, reason: "storage" };
    if (state.transactions.length >= MAX_RECORDS) return { state, crafted: false, reason: "limit" };
    state.stock[definition.input] -= 3;
    state.stock[definition.output] += 1;
    addTransaction(state, {
      id, type: "craft", at: now, plotId,
      delta: { [definition.input]: -3, [definition.output]: 1 },
    });
    return { state, crafted: true, item: definition.output, amount: 1, remaining: 2 + plot.building.level - usedToday(state, plotId, now), reason: "" };
  }

  function collectGarden(current, plotId, id, now = Date.now()) {
    const state = withDefaults(current);
    const plot = plotById(state, plotId, "garden");
    if (!plot || !isId(id) || !Number.isInteger(now) || now < 0 || transactionExists(state, id)) {
      return { state, collected: false, reason: "invalid" };
    }
    const last = state.transactions.filter((transaction) => transaction.type === "garden-harvest" &&
      transaction.plotId === plotId).reduce((latest, transaction) => Math.max(latest, transaction.at), -1);
    if (last >= 0 && now - last < 20 * HOUR) return { state, collected: false, reason: "cooldown", availableAt: last + 20 * HOUR };
    const plants = 2 + plot.building.level;
    if (state.plants + plants > MAX_ITEM_COUNT || state.seeds >= MAX_ITEM_COUNT) return { state, collected: false, reason: "limit" };
    if (state.transactions.length >= MAX_RECORDS) return { state, collected: false, reason: "limit" };
    state.plants += plants;
    state.seeds += 1;
    addTransaction(state, { id, type: "garden-harvest", at: now, plotId, delta: { plants, seeds: 1 } });
    return { state, collected: true, plants, seeds: 1, reason: "" };
  }

  function plantCrop(current, plotId, id, now = Date.now()) {
    const state = withDefaults(current);
    if (!plotById(state, plotId, "garden") || !isId(id) || !isId(`${id}:planted`) || !Number.isInteger(now) || now < 0 ||
      transactionExists(state, id) || transactionExists(state, `${id}:planted`)) return { state, planted: false, reason: "invalid" };
    if (state.crop) return { state, planted: false, reason: "crop-active" };
    if (state.seeds < 1 || state.water < 1) return { state, planted: false, reason: "materials" };
    if (state.transactions.length >= MAX_RECORDS) return { state, planted: false, reason: "limit" };
    state.seeds -= 1;
    state.water -= 1;
    state.crop = { id, plotId, plantedAt: now, secondWaterAt: null };
    addTransaction(state, { id: `${id}:planted`, type: "plant", at: now, plotId, delta: { seeds: -1, water: -1 } });
    return { state, planted: true, reason: "" };
  }

  function waterCrop(current, id, now = Date.now()) {
    const state = withDefaults(current);
    if (!state.crop || !isId(id) || !Number.isInteger(now) || now < 0 || transactionExists(state, id)) {
      return { state, watered: false, reason: "invalid" };
    }
    if (state.crop.secondWaterAt !== null) return { state, watered: false, reason: "already-watered" };
    const elapsed = now - state.crop.plantedAt;
    if (elapsed < 10 * HOUR) return { state, watered: false, reason: "too-soon" };
    if (elapsed > 12 * HOUR) return { state, watered: false, reason: "window-missed" };
    if (state.water < 1) return { state, watered: false, reason: "water" };
    if (state.transactions.length >= MAX_RECORDS) return { state, watered: false, reason: "limit" };
    state.water -= 1;
    state.grain += 1;
    const crop = state.crop;
    state.crop = null;
    addTransaction(state, {
      id, type: "crop-harvest", at: now, plotId: crop.plotId, cropId: crop.id,
      delta: { water: -1, grain: 1 },
    });
    return { state, watered: true, grain: 1, reason: "" };
  }

  function discardExpiredCrop(current, id, now = Date.now()) {
    const state = withDefaults(current);
    if (!state.crop || !isId(id) || !Number.isInteger(now) || now < 0 || transactionExists(state, id)) {
      return { state, discarded: false, reason: "invalid" };
    }
    if (now <= state.crop.plantedAt + 12 * HOUR) {
      return { state, discarded: false, reason: "not-expired" };
    }
    if (state.transactions.length >= MAX_RECORDS) return { state, discarded: false, reason: "limit" };
    const crop = state.crop;
    state.crop = null;
    addTransaction(state, { id, type: "crop-expired", at: now, plotId: crop.plotId, cropId: crop.id });
    return { state, discarded: true, reason: "" };
  }

  function fish(current, plotId, id, now = Date.now()) {
    const state = withDefaults(current);
    const plot = plotById(state, plotId, "pond");
    if (!plot || !isId(id) || !Number.isInteger(now) || now < 0 || transactionExists(state, id)) {
      return { state, caught: false, reason: "invalid" };
    }
    if (state.water < 300) return { state, caught: false, reason: "water" };
    const last = state.transactions.filter((transaction) => transaction.type === "fishing" &&
      transaction.plotId === plotId).reduce((latest, transaction) => Math.max(latest, transaction.at), -1);
    if (last >= 0 && now - last < 8 * HOUR) return { state, caught: false, reason: "cooldown", availableAt: last + 8 * HOUR };
    const amount = 2 + plot.building.level;
    if (state.bait + amount > MAX_ITEM_COUNT) return { state, caught: false, reason: "limit" };
    if (state.transactions.length >= MAX_RECORDS) return { state, caught: false, reason: "limit" };
    state.bait += amount;
    addTransaction(state, { id, type: "fishing", at: now, plotId, delta: { bait: amount } });
    return { state, caught: true, bait: amount, reason: "" };
  }

  function startSleep(current, id, now = Date.now()) {
    const state = withDefaults(current);
    const house = activeHouse(state);
    if (!house || !isId(id) || !Number.isInteger(now) || now < 0 || transactionExists(state, id)) {
      return { state, started: false, reason: "invalid" };
    }
    if (state.sleep) return { state, started: false, reason: "active" };
    if (state.transactions.length >= MAX_RECORDS) return { state, started: false, reason: "limit" };
    state.sleep = {
      id,
      tier: house.tier,
      startedAt: now,
      endsAt: now + HOUSE_TYPES[house.tier].sleepMs,
    };
    addTransaction(state, { id, type: "sleep-start", at: now });
    return { state, started: true, endsAt: state.sleep.endsAt, reason: "" };
  }

  function claimSleep(current, id, injuries, now = Date.now()) {
    const state = withDefaults(current);
    if (!state.sleep || !isId(id) || !Number.isInteger(injuries) || injuries < 0 || injuries > 3 ||
      !Number.isInteger(now) || now < 0 || transactionExists(state, id)) {
      return { state, claimed: false, injuries, reason: "invalid" };
    }
    if (now < state.sleep.endsAt) return { state, claimed: false, injuries, reason: "early", availableAt: state.sleep.endsAt };
    if (state.transactions.length >= MAX_RECORDS) return { state, claimed: false, injuries, reason: "limit" };
    state.sleep = null;
    addTransaction(state, { id, type: "sleep-complete", at: now });
    return { state, claimed: true, injuries: 0, reason: "" };
  }

  function altarCost(level) {
    return Number.isInteger(level) && level >= 0 && level < MAX_ITEM_COUNT
      ? 100 * (level + 1)
      : null;
  }

  function altarAtCap(id, level) {
    const definition = ALTARS[id];
    return !definition || !Number.isInteger(level) || level < 0 ||
      definition.maxLevel !== null && level >= definition.maxLevel;
  }

  function merge(leftValue, rightValue) {
    const first = withDefaults(leftValue);
    const second = withDefaults(rightValue);
    const transactions = new Map(first.transactions.map((transaction) => [transaction.id, transaction]));
    for (const transaction of second.transactions) {
      if (!transactions.has(transaction.id)) transactions.set(transaction.id, transaction);
    }
    const firstIds = new Set(first.transactions.map((transaction) => transaction.id));
    const secondIds = new Set(second.transactions.map((transaction) => transaction.id));
    const adjustments = (source, otherIds) => source.transactions
      .filter((transaction) => !otherIds.has(transaction.id))
      .reduce((result, transaction) => {
        for (const [item, amount] of Object.entries(transaction.delta || {})) result[item] += amount;
        return result;
      }, Object.fromEntries([...ALL_ITEM_SET].map((item) => [item, 0])));
    const firstAdjust = adjustments(first, secondIds);
    const secondAdjust = adjustments(second, firstIds);
    const houses = new Map(first.houses.map((house) => [house.id, house]));
    for (const house of second.houses) if (!houses.has(house.id)) houses.set(house.id, house);
    const plots = new Map(first.plots.map((plot) => [plot.id, plot]));
    for (const plot of second.plots) {
      const existing = plots.get(plot.id);
      const candidate = plot.building;
      const current = existing?.building;
      const replace = !existing || candidate && (!current ||
        (candidate.type === current.type
          ? candidate.level > current.level ||
            candidate.level === current.level && candidate.builtAt > current.builtAt
          : candidate.builtAt > current.builtAt ||
            candidate.builtAt === current.builtAt && candidate.type.localeCompare(current.type) > 0));
      if (replace) plots.set(plot.id, plot);
    }
    const merged = createState();
    merged.houses = [...houses.values()];
    merged.plots = [...plots.values()];
    merged.transactions = [...transactions.values()].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)).slice(-MAX_RECORDS);
    merged.altars = Object.fromEntries(Object.keys(ALTARS).map((id) => [id, Math.max(first.altars[id], second.altars[id])]));
    for (const item of MATERIALS) {
      merged.stock[item] = Math.max(0, first.stock[item] + secondAdjust[item], second.stock[item] + firstAdjust[item]);
    }
    merged.water = Math.min(1000, Math.max(0, first.water + secondAdjust.water, second.water + firstAdjust.water));
    for (const item of ["plants", "seeds", "grain", "bait"]) {
      merged[item] = Math.max(0, first[item] + secondAdjust[item], second[item] + firstAdjust[item]);
    }
    const sleepTransactions = merged.transactions.filter((transaction) =>
      transaction.type === "sleep-start" || transaction.type === "sleep-complete");
    const lastSleepAction = sleepTransactions[sleepTransactions.length - 1];
    if (lastSleepAction?.type === "sleep-start") {
      const source = [first, second].find((candidate) => candidate.sleep?.id === lastSleepAction.id);
      if (source) merged.sleep = copy(source.sleep);
    }
    const activeCrop = [first, second].filter((candidate) => candidate.crop)
      .sort((a, b) => b.crop.plantedAt - a.crop.plantedAt)[0];
    if (activeCrop) {
      const harvestedAt = merged.transactions.filter((transaction) =>
        (transaction.type === "crop-harvest" || transaction.type === "crop-expired") &&
        transaction.cropId === activeCrop.crop.id)
        .reduce((latest, transaction) => Math.max(latest, transaction.at), -1);
      if (harvestedAt < activeCrop.crop.plantedAt) merged.crop = copy(activeCrop.crop);
    }
    return isValidState(merged) ? merged : createState();
  }

  function mergeCosts(leftValue, rightValue) {
    const left = withDefaults(leftValue);
    const right = withDefaults(rightValue);
    const leftIds = new Set(left.transactions.map((transaction) => transaction.id));
    const rightIds = new Set(right.transactions.map((transaction) => transaction.id));
    const missingCosts = (source, otherIds, currency) => source.transactions
      .filter((transaction) => !otherIds.has(transaction.id))
      .reduce((total, transaction) => total + (transaction.costs?.[currency] || 0), 0);
    return {
      goldFromRight: missingCosts(right, leftIds, "gold"),
      goldFromLeft: missingCosts(left, rightIds, "gold"),
      essenceFromRight: missingCosts(right, leftIds, "essence"),
      essenceFromLeft: missingCosts(left, rightIds, "essence"),
    };
  }

  window.WellHousingModel = Object.freeze({
    VERSION, HOUSE_TYPES, BUILDING_TYPES, ALTARS, MATERIALS, MATERIAL_CAP, HOUR,
    createState, isValidState, withDefaults, activeHouse, activePlotLimit, materialCapacity,
    purchaseHouse, buyPlot, recordLoot, construct, craft, collectGarden, plantCrop, waterCrop,
    fish, discardExpiredCrop, startSleep, claimSleep, altarCost, altarAtCap, merge, mergeCosts,
  });
})();
