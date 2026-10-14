"use strict";

(function attachHomesteadModel(root) {
  const VERSION = 1;
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const REST_MEAL_WINDOW = 2 * HOUR;
  const HOME_TYPES = Object.freeze({
    cabin: Object.freeze({ id: "cabin", name: "Простая хижина", plots: 2, sleepMs: 160 * 60 * 1000, tier: 1 }),
    sturdy: Object.freeze({ id: "sturdy", name: "Добротный дом", plots: 4, sleepMs: 140 * 60 * 1000, tier: 2 }),
    mansion: Object.freeze({ id: "mansion", name: "Богатый особняк", plots: 6, sleepMs: 120 * 60 * 1000, tier: 3 }),
  });
  const RESOURCE_KEYS = Object.freeze([
    "logs", "stone", "ore", "flax", "boards", "blocks", "ingots", "cloth",
    "seeds", "herbs", "fish", "bait",
  ]);
  const CRAFT_RECIPES = Object.freeze({
    roughBlade: Object.freeze({ name: "Клинок домашней кузни", type: "weapon", bonus: 1, tier: 1, recipe: Object.freeze({ boards: 2, ingots: 1 }) }),
    barkArmor: Object.freeze({ name: "Дублёный доспех", type: "armor", bonus: 1, tier: 1, recipe: Object.freeze({ cloth: 2, blocks: 1 }) }),
    steelBlade: Object.freeze({ name: "Стальной клинок", type: "weapon", bonus: 2, tier: 2, recipe: Object.freeze({ boards: 2, ingots: 3 }) }),
    reinforcedArmor: Object.freeze({ name: "Усиленный доспех", type: "armor", bonus: 2, tier: 2, recipe: Object.freeze({ cloth: 3, blocks: 2 }) }),
  });
  const MEALS = Object.freeze({
    grainBread: Object.freeze({ name: "Зерновая лепёшка", satiety: 100, recipe: Object.freeze({ seeds: 1 }), stat: null, afterRest: false }),
    attackMeal: Object.freeze({ name: "Похлёбка силы", satiety: 100, recipe: Object.freeze({ seeds: 1, fish: 1, herbs: 1 }), stat: "attack", afterRest: true }),
    defenseMeal: Object.freeze({ name: "Травяной суп", satiety: 100, recipe: Object.freeze({ seeds: 1, herbs: 2, bait: 1 }), stat: "defense", afterRest: true }),
    dodgeMeal: Object.freeze({ name: "Рыбная похлёбка", satiety: 100, recipe: Object.freeze({ seeds: 1, fish: 2 }), stat: "dodge", afterRest: true }),
  });
  const DUMMY_ARMOR = Object.freeze({
    none: Object.freeze({ name: "Без брони", reduction: 0 }),
    leather: Object.freeze({ name: "Кожаная броня", reduction: 2 }),
    chain: Object.freeze({ name: "Кольчуга", reduction: 5 }),
    plate: Object.freeze({ name: "Латы", reduction: 10 }),
  });
  const MAILBOX_TIER = "mansion";
  const BASEMENT_GOLD_COST = 20000;
  const CAMOUFLAGE_GOLD_COST = 1000;
  const BUILDINGS = Object.freeze({
    boards: Object.freeze({ name: "Столярная мастерская", input: "logs", output: "boards", maxLevel: Infinity, recipe: { logs: 5, stone: 5 } }),
    blocks: Object.freeze({ name: "Каменотёсная мастерская", input: "stone", output: "blocks", maxLevel: Infinity, recipe: { logs: 5, stone: 5 } }),
    ingots: Object.freeze({ name: "Литейная мастерская", input: "ore", output: "ingots", maxLevel: Infinity, recipe: { logs: 5, stone: 5 } }),
    cloth: Object.freeze({ name: "Ткацкая мастерская", input: "flax", output: "cloth", maxLevel: Infinity, recipe: { logs: 5, stone: 5 } }),
    storage: Object.freeze({ name: "Склад", maxLevel: Infinity, recipe: { boards: 5, blocks: 5, ingots: 3, cloth: 3 } }),
    pond: Object.freeze({ name: "Пруд", maxLevel: 18, recipe: { boards: 10, blocks: 10, ingots: 5, cloth: 5 } }),
    garden: Object.freeze({ name: "Сад", maxLevel: 8, recipe: { boards: 15, blocks: 15, ingots: 5, cloth: 5 } }),
  });
  const ALTARS = Object.freeze({
    fishing: Object.freeze({ name: "Рыбалки", maxLevel: 15 }),
    runes: Object.freeze({ name: "Рун", maxLevel: 20 }),
    attributes: Object.freeze({ name: "Характеристик", maxLevel: 100 }),
    pain: Object.freeze({ name: "Боли", maxLevel: 100 }),
  });
  const ALTAR_EFFECTS = Object.freeze({
    fishing: "После ловли возвращает 3–6 + уровень алтаря приманки.",
    runes: "Шанс рун; рунической системы пока нет, алтарь недоступен.",
    attributes: "Шанс роста характеристик; система характеристик пока недоступна.",
    pain: "Травмы; безопасного лимита травм в игре недостаточно для этого эффекта.",
  });

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isValidBook(book) {
    return Boolean(book && typeof book === "object" &&
      typeof book.id === "string" && book.id.length > 0 && book.id.length <= 100 &&
      typeof book.name === "string" && book.name.length > 0 && book.name.length <= 100);
  }

  function hasRoom(state, minimumTier) {
    return Boolean(state.atHome && getBestHome(state) &&
      HOME_TYPES[getBestHome(state).tier].tier >= HOME_TYPES[minimumTier].tier);
  }

  function createState(now = Date.now()) {
    return {
      version: VERSION,
      revision: 0,
      updatedAt: now,
      homes: [],
      plots: [],
      resources: Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0])),
      receipts: [],
      fishProcessingReceipts: [],
      fishProcessingConflicts: [],
      gatheredAt: null,
      atHome: false,
      sleep: null,
      lastCompletedSleepAt: null,
      lastRestMealAt: null,
      meals: Object.fromEntries(Object.keys(MEALS).map((id) => [id, 0])),
      mealBuff: null,
      kitchenReceipts: [],
      kitchenConflicts: [],
      pages: 0,
      books: [],
      equippedBook: null,
      mailReceipts: [],
      clinicAt: null,
      basementPurchased: false,
      dummyHp: 100000,
      dummyArmor: "none",
      dummyAchievement: false,
      camouflage: 0,
      altars: { fishing: 0, runes: 0, attributes: 0, pain: 0 },
      clinicDate: null,
    };
  }

  function isValidReceipt(receipt) {
    return Boolean(
      receipt && typeof receipt === "object" &&
      typeof receipt.id === "string" && receipt.id.length > 0 && receipt.id.length <= 160 &&
      ["home", "plot", "altar", "pages", "basement", "camouflage"].includes(receipt.kind) &&
      Number.isInteger(receipt.essenceCost) && receipt.essenceCost >= 0 && receipt.essenceCost <= 1000000000 &&
      Number.isInteger(receipt.goldCost) && receipt.goldCost >= 0 && receipt.goldCost <= 1000000000 &&
      Number.isFinite(receipt.at) &&
      (receipt.homeId === undefined || typeof receipt.homeId === "string") &&
      (receipt.plotIndex === undefined || Number.isInteger(receipt.plotIndex) && receipt.plotIndex >= 0) &&
      (receipt.altarType === undefined || Object.hasOwn(ALTARS, receipt.altarType)) &&
      (receipt.altarLevel === undefined || Number.isInteger(receipt.altarLevel) && receipt.altarLevel >= 1) &&
      (receipt.pageCount === undefined || Number.isInteger(receipt.pageCount) && [100, 1000].includes(receipt.pageCount))
    );
  }

  function isValidPlot(plot, index) {
    return Boolean(
      plot && typeof plot === "object" &&
      plot.index === index &&
      (plot.building === null || Object.hasOwn(BUILDINGS, plot.building)) &&
      Number.isSafeInteger(plot.level) && plot.level >= 0 &&
      (plot.building !== null || plot.level === 0) &&
      (plot.building !== "pond" || plot.level <= BUILDINGS.pond.maxLevel) &&
      (plot.building !== "garden" || plot.level <= BUILDINGS.garden.maxLevel) &&
      (plot.building !== null || plot.water === 0) &&
      Number.isInteger(plot.water) && plot.water >= 0 && plot.water <= 1000 &&
      (plot.waterAt === null || Number.isFinite(plot.waterAt)) &&
      (plot.fishedAt === null || Number.isFinite(plot.fishedAt)) &&
      (plot.harvestedAt === null || Number.isFinite(plot.harvestedAt)) &&
      plot.daily && typeof plot.daily === "object" &&
      (plot.daily.day === null || /^\d{4}-\d{2}-\d{2}$/.test(plot.daily.day)) &&
      Number.isInteger(plot.daily.processed) && plot.daily.processed >= 0 && plot.daily.processed <= 1000000 &&
      (plot.crop === null || (
        plot.crop && typeof plot.crop === "object" &&
        Number.isFinite(plot.crop.plantedAt) && Number.isFinite(plot.crop.firstWateredAt) &&
        plot.crop.firstWateredAt === plot.crop.plantedAt &&
        (plot.crop.secondWateredAt === null || Number.isFinite(plot.crop.secondWateredAt))
      )) &&
      (plot.building === "pond" || plot.water === 0 && plot.waterAt === null && plot.fishedAt === null) &&
      (plot.building === "garden" || plot.crop === null && plot.harvestedAt === null) &&
      (!Object.hasOwn(BUILDINGS, plot.building) || BUILDINGS[plot.building].input ||
        plot.daily.processed === 0 && plot.daily.day === null)
    );
  }

  function isValidState(state) {
    const fishProcessingIds = new Set(Array.isArray(state?.fishProcessingReceipts)
      ? state.fishProcessingReceipts.map((receipt) => receipt?.id) : []);
    if (!state || typeof state !== "object" || state.version !== VERSION ||
      !Number.isInteger(state.revision) || state.revision < 0 || state.revision > 1000000000 ||
      !Number.isFinite(state.updatedAt) ||
      !Array.isArray(state.homes) || state.homes.length > 10000 ||
      !state.homes.every((home) => home && typeof home === "object" &&
        typeof home.id === "string" && home.id.length > 0 && home.id.length <= 160 &&
        Object.hasOwn(HOME_TYPES, home.tier) && Number.isFinite(home.purchasedAt)) ||
      new Set(state.homes.map((home) => home.id)).size !== state.homes.length ||
      !Array.isArray(state.plots) || state.plots.length > 10000 ||
      !state.plots.every(isValidPlot) ||
      !state.resources || typeof state.resources !== "object" ||
      Object.keys(state.resources).length !== RESOURCE_KEYS.length ||
      !RESOURCE_KEYS.every((key) => Number.isInteger(state.resources[key]) &&
        state.resources[key] >= 0 && state.resources[key] <= 1000000) ||
      !Array.isArray(state.receipts) || state.receipts.length > 100000 ||
      !state.receipts.every(isValidReceipt) ||
      new Set(state.receipts.map((receipt) => receipt.id)).size !== state.receipts.length ||
      (state.fishProcessingReceipts !== undefined && (
        !window.WellHeartShardModel.isValidReceipts(state.fishProcessingReceipts, ["fish-processing"]) ||
        new Set(state.fishProcessingReceipts.map((receipt) => receipt.id)).size !== state.fishProcessingReceipts.length
      )) ||
      (state.fishProcessingConflicts !== undefined && (
        !Array.isArray(state.fishProcessingConflicts) || state.fishProcessingConflicts.length > 100000 ||
        !state.fishProcessingConflicts.every((id) => typeof id === "string" && id.length > 0 && id.length <= 160) ||
        new Set(state.fishProcessingConflicts).size !== state.fishProcessingConflicts.length ||
        state.fishProcessingConflicts.some((id) => fishProcessingIds.has(id))
      )) ||
      (state.gatheredAt !== null && !Number.isFinite(state.gatheredAt)) ||
      typeof state.atHome !== "boolean" ||
      (state.sleep !== null && !(state.sleep && typeof state.sleep === "object" &&
        typeof state.sleep.homeId === "string" && Number.isFinite(state.sleep.startedAt) &&
        Number.isFinite(state.sleep.endsAt) && state.sleep.endsAt > state.sleep.startedAt)) ||
      (state.lastCompletedSleepAt !== undefined && state.lastCompletedSleepAt !== null && !Number.isFinite(state.lastCompletedSleepAt)) ||
      (state.lastRestMealAt !== undefined && state.lastRestMealAt !== null && !Number.isFinite(state.lastRestMealAt)) ||
      (state.meals !== undefined && (!state.meals || Object.keys(state.meals).length !== Object.keys(MEALS).length ||
        !Object.keys(MEALS).every((id) => Number.isInteger(state.meals[id]) && state.meals[id] >= 0 && state.meals[id] <= 1000000))) ||
      (state.kitchenReceipts !== undefined && (!Array.isArray(state.kitchenReceipts) ||
        state.kitchenReceipts.length > 100000 || !state.kitchenReceipts.every(validKitchenReceipt) ||
        new Set(state.kitchenReceipts.map((receipt) => receipt.id)).size !== state.kitchenReceipts.length)) ||
      (state.kitchenConflicts !== undefined && (!Array.isArray(state.kitchenConflicts) ||
        state.kitchenConflicts.length > 100000 ||
        !state.kitchenConflicts.every((id) => typeof id === "string" && id.length > 0 && id.length <= 160) ||
        new Set(state.kitchenConflicts).size !== state.kitchenConflicts.length)) ||
      (state.mealBuff !== undefined && state.mealBuff !== null && !(state.mealBuff && typeof state.mealBuff === "object" &&
        ["attack", "defense", "dodge"].includes(state.mealBuff.stat) &&
        Number.isFinite(state.mealBuff.startedAt) && Number.isFinite(state.mealBuff.expiresAt) &&
        state.mealBuff.expiresAt > state.mealBuff.startedAt)) ||
      (state.pages !== undefined && (!Number.isInteger(state.pages) || state.pages < 0 || state.pages > 1000000000)) ||
      (state.books !== undefined && (!Array.isArray(state.books) || state.books.length > 10000 ||
        !state.books.every((book) => isValidBook(book)))) ||
      (state.equippedBook !== undefined && state.equippedBook !== null && !isValidBook(state.equippedBook)) ||
      (state.mailReceipts !== undefined && (!Array.isArray(state.mailReceipts) || state.mailReceipts.length > 100000 ||
        !state.mailReceipts.every((receipt) => receipt && typeof receipt.mailId === "string" &&
        receipt.mailId.length > 0 && receipt.mailId.length <= 100 &&
        typeof receipt.gearId === "string" && /^gear-\d+$/.test(receipt.gearId)) ||
        new Set(state.mailReceipts.map((receipt) => receipt.mailId)).size !== state.mailReceipts.length)) ||
      (state.clinicAt !== undefined && state.clinicAt !== null && !Number.isFinite(state.clinicAt)) ||
      (state.basementPurchased !== undefined && typeof state.basementPurchased !== "boolean") ||
      (state.dummyHp !== undefined && (!Number.isInteger(state.dummyHp) || state.dummyHp < 0 || state.dummyHp > 100000)) ||
      (state.dummyArmor !== undefined && !Object.hasOwn(DUMMY_ARMOR, state.dummyArmor)) ||
      (state.dummyAchievement !== undefined && typeof state.dummyAchievement !== "boolean") ||
      (state.camouflage !== undefined && (!Number.isInteger(state.camouflage) || state.camouflage < 0 || state.camouflage > 1)) ||
      !state.altars || typeof state.altars !== "object" ||
      Object.keys(state.altars).length !== Object.keys(ALTARS).length ||
      !Object.keys(ALTARS).every((id) => Number.isInteger(state.altars[id]) &&
        state.altars[id] >= 0 && state.altars[id] <= ALTARS[id].maxLevel) ||
      (state.clinicDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(state.clinicDate)) ||
      (state.dummyHp === 0 && !state.dummyAchievement)
    ) return false;
    if (state.plots.some((plot, index) => !isValidPlot(plot, index))) return false;
    return resourceTotal(state) <= getStorageCapacity(state) &&
      state.receipts.filter((receipt) => receipt.kind === "home")
        .every((receipt) => state.homes.some((home) => home.id === receipt.homeId));
  }

  function withDefaults(value, now = Date.now()) {
    if (!value || typeof value !== "object") return createState(now);
    const base = createState(now);
    const state = { ...base, ...copy(value) };
    state.resources = { ...base.resources, ...(value.resources || {}) };
    state.altars = { ...base.altars, ...(value.altars || {}) };
    state.meals = { ...base.meals, ...(value.meals || {}) };
    if (value.clinicAt === undefined && value.clinicDate) {
      const today = new Date(now).toISOString().slice(0, 10);
      state.clinicAt = value.clinicDate === today ? now : null;
    }
    if (!isValidState(state)) return base;
    return state;
  }

  function getBestHome(state) {
    return [...state.homes].sort((left, right) =>
      HOME_TYPES[right.tier].tier - HOME_TYPES[left.tier].tier ||
      left.purchasedAt - right.purchasedAt || left.id.localeCompare(right.id)
    )[0] || null;
  }

  function getPlotLimit(state) {
    const home = getBestHome(state);
    return home ? HOME_TYPES[home.tier].plots : 0;
  }

  function getStorageCapacity(state) {
    const storageLevel = state.plots
      .filter((plot) => plot.building === "storage")
      .reduce((total, plot) => total + plot.level, 0);
    return 20 + 10 * storageLevel;
  }

  function resourceTotal(state) {
    return RESOURCE_KEYS.reduce((total, key) => total + state.resources[key], 0);
  }

  function stamp(state, now) {
    state.revision += 1;
    state.updatedAt = now;
    if (!isValidState(state)) throw new Error("Состояние дома не прошло проверку.");
    return state;
  }

  function fail(state, reason, extra = {}) {
    return { ok: false, reason, state, ...extra };
  }

  function transact(current, { id, kind, essenceCost = 0, goldCost = 0, at, ...details }) {
    if (typeof id !== "string" || !id || id.length > 160) throw new Error("Не удалось создать квитанцию покупки.");
    if (current.receipts.some((receipt) => receipt.id === id)) throw new Error("Эта покупка уже учтена.");
    current.receipts.push({ id, kind, essenceCost, goldCost, at, ...details });
  }

  function canReplaceBuilding(current, plotIndex, building, now = Date.now()) {
    const plot = current.plots[plotIndex];
    if (!plot || !Object.hasOwn(BUILDINGS, building)) {
      return { ok: false, reason: "Не удалось проверить участок или новую постройку." };
    }
    if (plot.building === null || plot.building === building) return { ok: true };
    if (plot.building === "pond") {
      if (plot.water > 0) return { ok: false, reason: "Перед перестройкой пруд должен быть полностью выловлен." };
      if ((plot.waterAt !== null && now - plot.waterAt < 8 * HOUR) ||
        (plot.fishedAt !== null && now - plot.fishedAt < 8 * HOUR)) {
        return { ok: false, reason: "Перед перестройкой дождись завершения таймера пруда (8 часов)." };
      }
    }
    if (plot.building === "garden") {
      if (plot.crop) return { ok: false, reason: "Перед перестройкой собери или освободи посев." };
      if (plot.harvestedAt !== null && now - plot.harvestedAt < 20 * HOUR) {
        return { ok: false, reason: "Перед перестройкой дождись следующего урожая (20 часов)." };
      }
    }
    if (BUILDINGS[plot.building].input && plot.daily.processed > 0 &&
      plot.daily.day === new Date(now).toISOString().slice(0, 10)) {
      return { ok: false, reason: "Переработай дневную квоту до конца или дождись следующего дня." };
    }
    const nextBuilding = BUILDINGS[building];
    const recipeCost = Object.values(nextBuilding.recipe).reduce((sum, amount) => sum + amount, 0);
    const nextCapacity = getStorageCapacity(current) -
      (plot.building === "storage" ? plot.level * 10 : 0) +
      (building === "storage" ? 10 : 0);
    if (resourceTotal(current) - recipeCost > nextCapacity) {
      return { ok: false, reason: "Сначала используй материалы: новый склад не вместит текущий запас." };
    }
    return { ok: true };
  }

  function purchaseHome(current, tier, payment, essence, gold, receiptId, now = Date.now()) {
    const state = copy(current);
    if (current.receipts.some((receipt) => receipt.id === receiptId)) {
      return fail(current, "Эта покупка уже учтена.");
    }
    const type = HOME_TYPES[tier];
    if (!type) return fail(current, "Неизвестный тип дома.");
    let essenceCost = 0;
    let goldCost = 0;
    if (tier === "cabin" && payment === "gold") goldCost = 20000;
    else if (tier === "sturdy" && payment === "essence") essenceCost = 400;
    else if (tier === "mansion" && payment === "essence") essenceCost = 1000;
    else if (tier === "mansion" && payment === "upgrade") {
      if (!current.homes.some((home) => home.tier === "sturdy")) {
        return fail(current, "Для улучшения нужен купленный добротный дом.");
      }
      essenceCost = 600;
    } else return fail(current, "Этот способ оплаты недоступен.");
    if (essence < essenceCost) return fail(current, `Нужно ${essenceCost} осколков.`);
    if (gold < goldCost) return fail(current, `Нужно ${goldCost} золотых в кошельке таверны.`);
    const home = { id: receiptId, tier, purchasedAt: now };
    state.homes.push(home);
    transact(state, {
      id: receiptId,
      kind: "home",
      essenceCost,
      goldCost,
      at: now,
      homeId: home.id,
    });
    return {
      ok: true,
      state: stamp(state, now),
      essence: essence - essenceCost,
      gold: gold - goldCost,
      home,
    };
  }

  function buyPlot(current, essence, receiptId, now = Date.now()) {
    if (!getBestHome(current)) return fail(current, "Сначала купи дом.");
    if (current.receipts.some((receipt) => receipt.id === receiptId)) return fail(current, "Эта покупка уже учтена.");
    if (current.plots.length >= getPlotLimit(current)) return fail(current, "Все участки используемого дома уже куплены.");
    if (essence < 100) return fail(current, "Нужно 100 осколков.");
    const state = copy(current);
    const plot = {
      index: state.plots.length,
      building: null,
      level: 0,
      daily: { day: null, processed: 0 },
      water: 0,
      waterAt: null,
      fishedAt: null,
      crop: null,
      harvestedAt: null,
    };
    state.plots.push(plot);
    transact(state, { id: receiptId, kind: "plot", essenceCost: 100, at: now, plotIndex: plot.index });
    return { ok: true, state: stamp(state, now), essence: essence - 100, plot };
  }

  function buildOrUpgrade(current, plotIndex, building, now = Date.now()) {
    if (!current.atHome) return fail(current, "Строить и улучшать можно только дома.");
    if (!getBestHome(current)) return fail(current, "Сначала купи дом.");
    if (!Number.isInteger(plotIndex) || plotIndex < 0 || plotIndex >= current.plots.length ||
      plotIndex >= getPlotLimit(current)) return fail(current, "Этот участок не куплен или закрыт используемым домом.");
    const definition = BUILDINGS[building];
    if (!definition) return fail(current, "Неизвестная постройка.");
    const original = current.plots[plotIndex];
    if (original.building !== null && original.building !== building) {
      const replacement = canReplaceBuilding(current, plotIndex, building, now);
      if (!replacement.ok) return fail(current, replacement.reason);
    }
    if (original.building === building && original.level >= definition.maxLevel) {
      return fail(current, "Достигнут предел улучшений этой постройки.");
    }
    const resources = current.resources;
    const missing = Object.entries(definition.recipe)
      .find(([key, amount]) => resources[key] < amount);
    if (missing) return fail(current, `Недостаточно материалов: ${missing[1]} ${missing[0]}.`);
    const state = copy(current);
    const plot = state.plots[plotIndex];
    for (const [key, amount] of Object.entries(definition.recipe)) state.resources[key] -= amount;
    if (plot.building !== null && plot.building !== building) {
      plot.level = 0;
      plot.daily = { day: null, processed: 0 };
      plot.water = 0;
      plot.waterAt = null;
      plot.fishedAt = null;
      plot.crop = null;
      plot.harvestedAt = null;
    }
    plot.building = building;
    plot.level += 1;
    if (building === "pond" && plot.level === 1) plot.water = 0;
    return { ok: true, state: stamp(state, now), plot };
  }

  function gather(current, now = Date.now()) {
    if (!current.atHome) return fail(current, "Собирать материалы можно только дома.");
    if (current.gatheredAt !== null && now - current.gatheredAt < DAY) {
      return fail(current, "Домашний сбор доступен раз в 24 часа.");
    }
    const yieldItems = { logs: 5, stone: 5, ore: 3, flax: 3, seeds: 1, bait: 3 };
    if (resourceTotal(current) + Object.values(yieldItems).reduce((sum, value) => sum + value, 0) >
      getStorageCapacity(current)) return fail(current, "На складе нет места. Переработай или используй материалы.");
    const state = copy(current);
    for (const [key, amount] of Object.entries(yieldItems)) state.resources[key] += amount;
    state.gatheredAt = now;
    return { ok: true, state: stamp(state, now), yield: yieldItems };
  }

  function processMaterials(current, plotIndex, operations, now = Date.now()) {
    if (!current.atHome) return fail(current, "Работать в мастерской можно только дома.");
    const plot = current.plots[plotIndex];
    if (!plot || plotIndex >= getPlotLimit(current) || !BUILDINGS[plot.building]?.input) {
      return fail(current, "На этом участке нет мастерской.");
    }
    if (!Number.isInteger(operations) || operations < 1) return fail(current, "Укажи число операций.");
    const today = new Date(now).toISOString().slice(0, 10);
    const usedToday = plot.daily.day === today ? plot.daily.processed : 0;
    const quota = 2 + plot.level;
    if (operations > quota - usedToday) return fail(current, `Сегодня доступно ещё ${Math.max(0, quota - usedToday)} операций.`);
    const definition = BUILDINGS[plot.building];
    if (current.resources[definition.input] < operations * 3) {
      return fail(current, `Для операций нужно ${operations * 3} единиц ресурса ${definition.input}.`);
    }
    const state = copy(current);
    const target = state.plots[plotIndex];
    target.daily = { day: today, processed: usedToday + operations };
    state.resources[definition.input] -= operations * 3;
    state.resources[definition.output] += operations;
    return { ok: true, state: stamp(state, now), operations, output: operations, quota };
  }

  function enterHome(current, now = Date.now()) {
    if (!getBestHome(current)) return fail(current, "Сначала купи дом.");
    const state = copy(current);
    state.atHome = true;
    return { ok: true, state: stamp(state, now) };
  }

  function leaveHome(current, now = Date.now()) {
    const state = copy(current);
    state.atHome = false;
    state.sleep = null;
    return { ok: true, state: stamp(state, now) };
  }

  function drawWater(current, plotIndex, now = Date.now()) {
    if (!current.atHome) return fail(current, "Набрать воду можно только дома.");
    const plot = current.plots[plotIndex];
    if (!plot || plot.building !== "pond" || plotIndex >= getPlotLimit(current)) {
      return fail(current, "На этом участке нет доступного пруда.");
    }
    if (plot.waterAt !== null && now - plot.waterAt < 8 * HOUR) return fail(current, "Воду можно набирать раз в 8 часов.");
    if (plot.water >= 1000) return fail(current, "Пруд уже заполнен.");
    const state = copy(current);
    const target = state.plots[plotIndex];
    target.water = Math.min(1000, target.water + 300);
    target.waterAt = now;
    return { ok: true, state: stamp(state, now), water: target.water };
  }

  function fish(current, plotIndex, now = Date.now(), random = Math.random) {
    if (!current.atHome) return fail(current, "Ловить рыбу можно только дома.");
    const plot = current.plots[plotIndex];
    if (!plot || plot.building !== "pond" || plotIndex >= getPlotLimit(current)) {
      return fail(current, "На этом участке нет доступного пруда.");
    }
    if (plot.water < 300) return fail(current, "Для ловли нужно не менее 300 воды.");
    if (plot.fishedAt !== null && now - plot.fishedAt < 8 * HOUR) return fail(current, "Ловить рыбу можно раз в 8 часов.");
    const baitCost = 2 + plot.level;
    if (current.resources.bait < baitCost) return fail(current, `Для ловли нужно ${baitCost} приманки.`);
    const fishCount = 2 + plot.level;
    const baitReward = current.altars.fishing > 0
      ? Math.floor(random() * 4) + 3 + current.altars.fishing
      : 0;
    if (resourceTotal(current) - baitCost + fishCount + baitReward > getStorageCapacity(current)) {
      return fail(current, "На складе нет места для улова.");
    }
    const state = copy(current);
    const target = state.plots[plotIndex];
    target.water -= 300;
    target.fishedAt = now;
    state.resources.bait -= baitCost;
    state.resources.fish += fishCount;
    state.resources.bait += baitReward;
    return { ok: true, state: stamp(state, now), fish: fishCount, bait: baitReward, water: target.water };
  }

  function processFish(current, receiptId, heartShards, now = Date.now()) {
    if (!current.atHome) return fail(current, "Перерабатывать улов можно только дома.");
    if (current.resources.fish < 1) return fail(current, "Для переработки нужна 1 рыба.");
    const receipts = current.fishProcessingReceipts || [];
    if (receipts.some((receipt) => receipt.id === receiptId) ||
      (current.fishProcessingConflicts || []).includes(receiptId)) {
      return fail(current, "Эта переработка уже учтена.");
    }
    const issued = window.WellHeartShardModel.issue(receipts, receiptId, "fish-processing", heartShards);
    if (!issued.ok) {
      const reason = issued.reason === "duplicate" ? "Эта переработка уже учтена."
        : issued.reason === "ledger-full" ? "Журнал переработки заполнен; рыба не списана."
          : issued.reason === "invalid" ? "Квитанция переработки недействительна; рыба не списана."
            : "Достигнут предел сердечных осколков; рыба не списана.";
      return fail(current, reason);
    }
    if (issued.shards < 1) return fail(current, "Достигнут предел сердечных осколков; рыба не списана.");
    const state = copy(current);
    state.resources.fish -= 1;
    state.fishProcessingReceipts = issued.receipts;
    return {
      ok: true,
      state: stamp(state, now),
      fish: 1,
      shards: issued.shards,
      heartShards: issued.balance,
    };
  }

  function plant(current, plotIndex, now = Date.now()) {
    if (!current.atHome) return fail(current, "Сеять можно только дома.");
    const plot = current.plots[plotIndex];
    if (!plot || plot.building !== "garden" || plotIndex >= getPlotLimit(current)) {
      return fail(current, "На этом участке нет доступного сада.");
    }
    if (plot.crop) return fail(current, "Сначала собери или освободи текущий посев.");
    if (current.resources.seeds < 1) return fail(current, "Нужно семя из домашнего сбора.");
    const state = copy(current);
    state.resources.seeds -= 1;
    state.plots[plotIndex].crop = { plantedAt: now, firstWateredAt: now, secondWateredAt: null };
    return { ok: true, state: stamp(state, now) };
  }

  function waterGarden(current, plotIndex, now = Date.now()) {
    if (!current.atHome) return fail(current, "Поливать можно только дома.");
    const plot = current.plots[plotIndex];
    if (!plot || plotIndex >= getPlotLimit(current) || plot.building !== "garden" || !plot.crop || plot.crop.secondWateredAt !== null) {
      return fail(current, "Нет посева, которому требуется второй полив.");
    }
    const elapsed = now - plot.crop.plantedAt;
    if (elapsed < 10 * HOUR) return fail(current, "Второй полив доступен через 10–12 часов после посева.");
    if (elapsed > 12 * HOUR) return fail(current, "Окно второго полива (10–12 часов) пропущено.");
    const state = copy(current);
    state.plots[plotIndex].crop.secondWateredAt = now;
    return { ok: true, state: stamp(state, now) };
  }

  function harvestGarden(current, plotIndex, now = Date.now()) {
    if (!current.atHome) return fail(current, "Собирать урожай можно только дома.");
    const plot = current.plots[plotIndex];
    if (!plot || plotIndex >= getPlotLimit(current) || plot.building !== "garden" || !plot.crop || plot.crop.secondWateredAt === null) {
      return fail(current, "Для урожая нужны посев и два своевременных полива.");
    }
    if (now - plot.crop.plantedAt < 20 * HOUR) return fail(current, "Урожай созреет через 20 часов после посева.");
    if (plot.harvestedAt !== null && now - plot.harvestedAt < 20 * HOUR) {
      return fail(current, "Урожай в этом саду собирают раз в 20 часов.");
    }
    const amount = 2 + plot.level;
    if (resourceTotal(current) + amount > getStorageCapacity(current)) {
      return fail(current, "На складе нет места для урожая.");
    }
    const state = copy(current);
    state.resources.herbs += amount;
    state.plots[plotIndex].crop = null;
    state.plots[plotIndex].harvestedAt = now;
    return { ok: true, state: stamp(state, now), herbs: amount };
  }

  function discardCrop(current, plotIndex, now = Date.now()) {
    if (!current.atHome) return fail(current, "Освободить грядку можно только дома.");
    const plot = current.plots[plotIndex];
    if (!plot || plotIndex >= getPlotLimit(current) || plot.building !== "garden" || !plot.crop) {
      return fail(current, "На этом участке нет посева.");
    }
    if (plot.crop.secondWateredAt !== null || now - plot.crop.plantedAt <= 12 * HOUR) {
      return fail(current, "Удалить можно только посев с пропущенным окном полива.");
    }
    const state = copy(current);
    state.plots[plotIndex].crop = null;
    return { ok: true, state: stamp(state, now) };
  }

  function startSleep(current, now = Date.now()) {
    if (!current.atHome) return fail(current, "Спать можно только находясь дома.");
    if (current.sleep) return fail(current, "Сон уже идёт.");
    const home = getBestHome(current);
    if (!home) return fail(current, "Сначала купи дом.");
    const state = copy(current);
    const durationMs = HOME_TYPES[home.tier].sleepMs;
    state.sleep = { homeId: home.id, startedAt: now, endsAt: now + durationMs };
    return { ok: true, state: stamp(state, now), durationMs, endsAt: now + durationMs };
  }

  function completeSleep(current, now = Date.now()) {
    if (!current.atHome) return fail(current, "Для завершения сна нужно оставаться дома.");
    if (!current.sleep) return fail(current, "Активного сна нет.");
    if (now < current.sleep.endsAt) return fail(current, "Сон ещё не завершён.");
    if (!current.homes.some((home) => home.id === current.sleep.homeId)) return fail(current, "Дом сна больше не принадлежит путнику.");
    const state = copy(current);
    state.sleep = null;
    state.lastCompletedSleepAt = now;
    return { ok: true, state: stamp(state, now), healed: true };
  }

  function useClinic(current, injuries, now = Date.now()) {
    if (!current.atHome || getBestHome(current)?.tier !== "mansion") {
      return fail(current, "Лечебница доступна только в собственном особняке.");
    }
    if (current.clinicAt !== null && now - current.clinicAt < 20 * HOUR) {
      return fail(current, "Лечебница доступна раз в 20 часов.", {
        availableAt: current.clinicAt + 20 * HOUR,
      });
    }
    const state = copy(current);
    state.clinicAt = now;
    state.clinicDate = null;
    return { ok: true, state: stamp(state, now), healed: Math.max(0, injuries), availableAt: now + 20 * HOUR };
  }

  function craftGear(current, recipeId, gearId, now = Date.now()) {
    if (!hasRoom(current, "cabin")) return fail(current, "Ремесленный стол доступен только дома.");
    const recipe = CRAFT_RECIPES[recipeId];
    if (!recipe) return fail(current, "Рецепт не найден.");
    if (HOME_TYPES[getBestHome(current).tier].tier < recipe.tier) {
      return fail(current, "Для этого рецепта нужен добротный дом или особняк.");
    }
    if (typeof gearId !== "string" || !/^gear-\d+$/.test(gearId)) return fail(current, "Не удалось создать номер предмета.");
    const missing = Object.entries(recipe.recipe).find(([key, amount]) => current.resources[key] < amount);
    if (missing) return fail(current, `Недостаточно материалов: ${missing[1]} ${missing[0]}.`);
    const state = copy(current);
    for (const [key, amount] of Object.entries(recipe.recipe)) state.resources[key] -= amount;
    const gear = { id: gearId, type: recipe.type, name: recipe.name, bonus: recipe.bonus };
    return { ok: true, state: stamp(state, now), gear, recipe };
  }

  function cookMeal(current, mealId, now = Date.now()) {
    if (!hasRoom(current, "cabin")) return fail(current, "Кухня доступна только дома.");
    const meal = MEALS[mealId];
    if (!meal) return fail(current, "Рецепт блюда не найден.");
    if (meal.afterRest && !canUseRestMeal(current, now)) return fail(current,
      "Для специального блюда нужен завершённый сон; окно после подтверждения отдыха — 2 часа.");
    if (meal.afterRest) return fail(current,
      "Нет системы роста силы, ловкости и выносливости. Блюда с +50% шансом роста пока недоступны; ресурсы не списаны.");
    const missing = Object.entries(meal.recipe).find(([key, amount]) => current.resources[key] < amount);
    if (missing) return fail(current, `Недостаточно ресурсов: нужно ${missing[1]} ед. ресурса «${missing[0]}».`);
    const state = withDefaults(current, now);
    for (const [key, amount] of Object.entries(meal.recipe)) state.resources[key] -= amount;
    state.meals[mealId] += 1;
    recordKitchen(state, mealId, 1, meal.recipe, now);
    if (meal.afterRest) state.lastRestMealAt = current.lastCompletedSleepAt;
    return { ok: true, state: stamp(state, now), meal };
  }

  function eatMeal(current, tavern, mealId, now = Date.now(), random = Math.random, inCombat = false) {
    if (!hasRoom(current, "cabin")) return fail(current, "Еду можно использовать только на кухне дома.");
    if (inCombat) return fail(current, "Во время боя еду использовать нельзя.");
    const meal = MEALS[mealId];
    if (!meal || current.meals[mealId] < 1) return fail(current, "Такого блюда нет в запасе.");
    if (!tavern || !Number.isInteger(tavern.satiety) || !Number.isFinite(tavern.satietyAt)) {
      return fail(current, "Не удалось проверить сытость таверны.");
    }
    const state = withDefaults(current, now);
    const nextTavern = copy(tavern);
    state.meals[mealId] -= 1;
    nextTavern.satiety = meal.satiety;
    nextTavern.satietyAt = now;
    nextTavern.satietyChangedAt = now;
    nextTavern.revision += 1;
    nextTavern.updatedAt = now;
    recordKitchen(state, mealId, -1, {}, now);
    const buffTriggered = false;
    return {
      ok: true,
      state: stamp(state, now),
      tavern: nextTavern,
      meal,
      buffTriggered,
      buff: buffTriggered ? state.mealBuff : null,
    };
  }

  function canUseRestMeal(state, now = Date.now()) {
    return state.lastCompletedSleepAt !== null && now >= state.lastCompletedSleepAt &&
      now < state.lastCompletedSleepAt + REST_MEAL_WINDOW &&
      state.lastRestMealAt !== state.lastCompletedSleepAt;
  }

  function validKitchenReceipt(receipt) {
    return Boolean(receipt && typeof receipt.id === "string" && receipt.id.length > 0 &&
      receipt.id.length <= 160 && Object.hasOwn(MEALS, receipt.mealId) &&
      [1, -1].includes(receipt.delta) && receipt.resources && Number.isFinite(receipt.at) &&
      Object.entries(receipt.resources).every(([key, amount]) =>
        RESOURCE_KEYS.includes(key) && Number.isInteger(amount) && amount >= 0 && amount <= 1000000));
  }

  function recordKitchen(state, mealId, delta, resources, now) {
    if (state.kitchenReceipts.length >= 100000) throw new Error("Журнал кухни заполнен; еда не списана.");
    state.kitchenReceipts.push({ id: `kitchen-${now}-${Math.random().toString(36).slice(2)}`,
      mealId, delta, resources: copy(resources), at: now });
  }

  function buyPages(current, count, gold, receiptId, now = Date.now()) {
    if (!hasRoom(current, "sturdy")) return fail(current, "Библиотека доступна только в добротном доме или особняке.");
    if (![100, 1000].includes(count)) return fail(current, "Можно купить 100 или 1 000 пустых страниц.");
    const cost = count === 100 ? 300 : 3000;
    if (current.receipts.some((receipt) => receipt.id === receiptId)) return fail(current, "Эта покупка уже учтена.");
    if (gold < cost) return fail(current, `Нужно ${cost} золотых.`);
    const state = copy(current);
    state.pages += count;
    transact(state, { id: receiptId, kind: "pages", goldCost: cost, pageCount: count, at: now });
    return { ok: true, state: stamp(state, now), gold: gold - cost, count, cost };
  }

  function unequipBook(current, now = Date.now()) {
    if (!hasRoom(current, "sturdy")) return fail(current, "Библиотека доступна только в добротном доме или особняке.");
    if (!current.equippedBook) return fail(current, "Сейчас нет надетой книги.");
    if (current.books.length >= 10000) return fail(current, "Инвентарь книг полон.");
    const state = copy(current);
    state.books.push(state.equippedBook);
    const book = state.equippedBook;
    state.equippedBook = null;
    return { ok: true, state: stamp(state, now), book };
  }

  function purchaseBasement(current, gold, receiptId, now = Date.now()) {
    if (!hasRoom(current, "mansion")) return fail(current, "Подвал можно купить только для особняка.");
    if (current.basementPurchased) return fail(current, "Подвал уже куплен.");
    if (current.receipts.some((receipt) => receipt.id === receiptId)) return fail(current, "Эта покупка уже учтена.");
    if (gold < BASEMENT_GOLD_COST) return fail(current, `Нужно ${BASEMENT_GOLD_COST} золотых.`);
    const state = copy(current);
    state.basementPurchased = true;
    transact(state, { id: receiptId, kind: "basement", goldCost: BASEMENT_GOLD_COST, at: now });
    return { ok: true, state: stamp(state, now), gold: gold - BASEMENT_GOLD_COST };
  }

  function buyCamouflage(current, gold, receiptId, now = Date.now()) {
    if (!hasRoom(current, "mansion") || !current.basementPurchased) {
      return fail(current, "Маскировку можно купить только в подвале особняка.");
    }
    if (current.camouflage > 0) return fail(current, "Маскировка уже есть в инвентаре.");
    if (current.receipts.some((receipt) => receipt.id === receiptId)) return fail(current, "Эта покупка уже учтена.");
    if (gold < CAMOUFLAGE_GOLD_COST) return fail(current, `Нужно ${CAMOUFLAGE_GOLD_COST} золотых.`);
    const state = copy(current);
    state.camouflage = 1;
    transact(state, { id: receiptId, kind: "camouflage", goldCost: CAMOUFLAGE_GOLD_COST, at: now });
    return { ok: true, state: stamp(state, now), gold: gold - CAMOUFLAGE_GOLD_COST };
  }

  function consumeCamouflage(current, now = Date.now()) {
    if (current.camouflage < 1) return fail(current, "Маскировки в инвентаре нет.");
    const state = copy(current);
    state.camouflage -= 1;
    return { ok: true, state: stamp(state, now) };
  }

  function setDummyArmor(current, armorId, now = Date.now()) {
    if (!hasRoom(current, "mansion") || !current.basementPurchased) return fail(current, "Тренировочный зал доступен в купленном подвале особняка.");
    if (!Object.hasOwn(DUMMY_ARMOR, armorId)) return fail(current, "Такого типа брони у манекена нет.");
    const state = copy(current);
    state.dummyArmor = armorId;
    return { ok: true, state: stamp(state, now) };
  }

  function strikeDummy(current, attack, now = Date.now()) {
    if (!hasRoom(current, "mansion") || !current.basementPurchased) return fail(current, "Тренировочный зал доступен в купленном подвале особняка.");
    if (!Number.isInteger(attack) || attack < 1 || attack > 1000000) return fail(current, "Сила удара недопустима.");
    if (current.dummyHp === 0) return fail(current, "Манекен повержен; восстанови его для новой тренировки.");
    const state = copy(current);
    const damage = Math.min(state.dummyHp, Math.max(1, attack - DUMMY_ARMOR[state.dummyArmor].reduction));
    state.dummyHp -= damage;
    const achievementAwarded = state.dummyHp === 0 && !state.dummyAchievement;
    if (achievementAwarded) state.dummyAchievement = true;
    return { ok: true, state: stamp(state, now), damage, achievementAwarded };
  }

  function resetDummy(current, now = Date.now()) {
    if (!hasRoom(current, "mansion") || !current.basementPurchased) return fail(current, "Тренировочный зал доступен в купленном подвале особняка.");
    const state = copy(current);
    state.dummyHp = 100000;
    return { ok: true, state: stamp(state, now) };
  }

  function upgradeAltar(current, altarType, essence, receiptId, now = Date.now()) {
    if (!current.atHome || getBestHome(current)?.tier !== "mansion") {
      return fail(current, "Святилище доступно только в собственном особняке.");
    }
    if (!Object.hasOwn(ALTARS, altarType)) return fail(current, "Неизвестный алтарь.");
    if (altarType !== "fishing") return fail(current, ALTAR_EFFECTS[altarType]);
    if (current.receipts.some((receipt) => receipt.id === receiptId)) return fail(current, "Эта покупка уже учтена.");
    const currentLevel = current.altars[altarType];
    if (currentLevel >= ALTARS[altarType].maxLevel) return fail(current, "Достигнут предел уровня алтаря.");
    const cost = 100 * (currentLevel + 1);
    if (essence < cost) return fail(current, `Нужно ${cost} осколков.`);
    const state = copy(current);
    state.altars[altarType] += 1;
    transact(state, {
      id: receiptId,
      kind: "altar",
      essenceCost: cost,
      at: now,
      altarType,
      altarLevel: currentLevel + 1,
    });
    return { ok: true, state: stamp(state, now), essence: essence - cost, cost };
  }

  function merge(firstState, secondState) {
    const first = withDefaults(firstState);
    const second = withDefaults(secondState);
    const latest = second.updatedAt > first.updatedAt ||
      (second.updatedAt === first.updatedAt && second.revision > first.revision) ? second : first;
    const result = copy(latest);
    const other = latest === first ? second : first;
    const kitchenIds = new Set(result.kitchenReceipts.map((receipt) => receipt.id));
    const kitchenConflicts = new Set([...first.kitchenConflicts, ...second.kitchenConflicts]);
    const mealDeltas = {};
    for (const receipt of other.kitchenReceipts) {
      if (kitchenIds.has(receipt.id)) continue;
      const funded = Object.entries(receipt.resources).every(([key, amount]) => result.resources[key] >= amount);
      if (receipt.delta < 0 || funded) {
        mealDeltas[receipt.mealId] = (mealDeltas[receipt.mealId] || 0) + receipt.delta;
      } else {
        kitchenConflicts.add(receipt.id);
      }
      for (const [key, amount] of Object.entries(receipt.resources)) {
        result.resources[key] = Math.max(0, result.resources[key] - amount);
      }
      result.kitchenReceipts.push(copy(receipt));
      kitchenIds.add(receipt.id);
    }
    for (const [id, delta] of Object.entries(mealDeltas)) result.meals[id] = Math.max(0, result.meals[id] + delta);
    result.kitchenConflicts = [...kitchenConflicts];
    const fishProcessingConflicts = new Set([
      ...(first.fishProcessingConflicts || []),
      ...(second.fishProcessingConflicts || []),
    ]);
    result.fishProcessingReceipts = result.fishProcessingReceipts
      .filter((receipt) => !fishProcessingConflicts.has(receipt.id));
    const fishProcessingById = new Map(result.fishProcessingReceipts.map((receipt) => [receipt.id, receipt]));
    for (const receipt of other.fishProcessingReceipts || []) {
      if (fishProcessingConflicts.has(receipt.id)) continue;
      if (fishProcessingById.has(receipt.id)) {
        const existing = fishProcessingById.get(receipt.id);
        if (existing.source !== receipt.source || existing.shards !== receipt.shards) {
          throw new Error("Конфликт квитанций переработки рыбы; облачное изменение не применено.");
        }
        continue;
      }
      if (result.resources.fish < 1 ||
        result.fishProcessingReceipts.length >= window.WellHeartShardModel.MAX_RECEIPTS) {
        fishProcessingConflicts.add(receipt.id);
        continue;
      }
      result.resources.fish -= 1;
      result.fishProcessingReceipts.push(copy(receipt));
      fishProcessingById.set(receipt.id, receipt);
    }
    result.fishProcessingConflicts = [...fishProcessingConflicts];
    if (result.fishProcessingConflicts.length > window.WellHeartShardModel.MAX_RECEIPTS) {
      throw new Error("Журнал конфликтов переработки заполнен; облачное изменение не применено.");
    }
    const homes = new Map([...first.homes, ...second.homes].map((home) => [home.id, home]));
    result.homes = [...homes.values()].sort((left, right) =>
      HOME_TYPES[left.tier].tier - HOME_TYPES[right.tier].tier ||
      left.purchasedAt - right.purchasedAt || left.id.localeCompare(right.id)
    );
    const plots = new Map();
    for (const plot of [...first.plots, ...second.plots]) {
      const current = plots.get(plot.index);
      if (!current || plot.level > current.level) plots.set(plot.index, plot);
    }
    result.plots = [...plots.values()].sort((left, right) => left.index - right.index);
    result.receipts = [...new Map([...first.receipts, ...second.receipts]
      .map((receipt) => [receipt.id, receipt])).values()];
    for (const id of Object.keys(ALTARS)) result.altars[id] = Math.max(first.altars[id], second.altars[id]);
    result.gatheredAt = Math.max(first.gatheredAt || 0, second.gatheredAt || 0) || null;
    result.clinicDate = null;
    result.clinicAt = Math.max(first.clinicAt || 0, second.clinicAt || 0) || null;
    result.lastCompletedSleepAt = Math.max(first.lastCompletedSleepAt || 0, second.lastCompletedSleepAt || 0) || null;
    result.lastRestMealAt = Math.max(first.lastRestMealAt || 0, second.lastRestMealAt || 0) || null;
    result.mailReceipts = [...new Map([...first.mailReceipts, ...second.mailReceipts]
      .map((receipt) => [receipt.mailId, receipt])).values()];
    result.pages = result.receipts.filter((receipt) => receipt.kind === "pages")
      .reduce((total, receipt) => total + (receipt.pageCount || 0), 0);
    result.basementPurchased = first.basementPurchased || second.basementPurchased;
    result.dummyAchievement = first.dummyAchievement || second.dummyAchievement;
    result.dummyHp = latest.dummyHp;
    result.mealBuff = [first.mealBuff, second.mealBuff]
      .filter(Boolean).sort((left, right) => right.expiresAt - left.expiresAt)[0] || null;
    if (!isValidState(result) && result.kitchenReceipts.length > latest.kitchenReceipts.length) {
      throw new Error("Не удалось согласовать квитанции кухни; облачное изменение не применено.");
    }
    return isValidState(result) ? result : copy(latest);
  }

  root.WellHomesteadModel = Object.freeze({
    ALTARS,
    ALTAR_EFFECTS,
    BUILDINGS,
    BASEMENT_GOLD_COST,
    CAMOUFLAGE_GOLD_COST,
    CRAFT_RECIPES,
    DUMMY_ARMOR,
    MAILBOX_TIER,
    MEALS,
    canReplaceBuilding,
    DAY,
    HOUR,
    REST_MEAL_WINDOW,
    canUseRestMeal,
    HOME_TYPES,
    RESOURCE_KEYS,
    buyPlot,
    buyCamouflage,
    buyPages,
    buildOrUpgrade,
    consumeCamouflage,
    completeSleep,
    cookMeal,
    createState,
    craftGear,
    discardCrop,
    drawWater,
    enterHome,
    eatMeal,
    fail,
    fish,
    processFish,
    gather,
    getBestHome,
    getPlotLimit,
    getStorageCapacity,
    harvestGarden,
    isValidState,
    leaveHome,
    merge,
    plant,
    processMaterials,
    purchaseHome,
    resourceTotal,
    startSleep,
    strikeDummy,
    setDummyArmor,
    purchaseBasement,
    resetDummy,
    upgradeAltar,
    unequipBook,
    useClinic,
    waterGarden,
    withDefaults,
  });
})(window);
