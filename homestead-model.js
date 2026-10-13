"use strict";

(function attachHomesteadModel(root) {
  const VERSION = 1;
  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const HOME_TYPES = Object.freeze({
    cabin: Object.freeze({ id: "cabin", name: "Простая хижина", plots: 2, sleepMs: 160 * 60 * 1000, tier: 1 }),
    sturdy: Object.freeze({ id: "sturdy", name: "Добротный дом", plots: 4, sleepMs: 140 * 60 * 1000, tier: 2 }),
    mansion: Object.freeze({ id: "mansion", name: "Богатый особняк", plots: 6, sleepMs: 120 * 60 * 1000, tier: 3 }),
  });
  const RESOURCE_KEYS = Object.freeze([
    "logs", "stone", "ore", "flax", "boards", "blocks", "ingots", "cloth",
    "seeds", "herbs", "fish", "bait",
  ]);
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

  function createState(now = Date.now()) {
    return {
      version: VERSION,
      revision: 0,
      updatedAt: now,
      homes: [],
      plots: [],
      resources: Object.fromEntries(RESOURCE_KEYS.map((key) => [key, 0])),
      receipts: [],
      gatheredAt: null,
      atHome: false,
      sleep: null,
      altars: { fishing: 0, runes: 0, attributes: 0, pain: 0 },
      clinicDate: null,
    };
  }

  function isValidReceipt(receipt) {
    return Boolean(
      receipt && typeof receipt === "object" &&
      typeof receipt.id === "string" && receipt.id.length > 0 && receipt.id.length <= 160 &&
      ["home", "plot", "altar"].includes(receipt.kind) &&
      Number.isInteger(receipt.essenceCost) && receipt.essenceCost >= 0 && receipt.essenceCost <= 1000000000 &&
      Number.isInteger(receipt.goldCost) && receipt.goldCost >= 0 && receipt.goldCost <= 1000000000 &&
      Number.isFinite(receipt.at) &&
      (receipt.homeId === undefined || typeof receipt.homeId === "string") &&
      (receipt.plotIndex === undefined || Number.isInteger(receipt.plotIndex) && receipt.plotIndex >= 0) &&
      (receipt.altarType === undefined || Object.hasOwn(ALTARS, receipt.altarType)) &&
      (receipt.altarLevel === undefined || Number.isInteger(receipt.altarLevel) && receipt.altarLevel >= 1)
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
      (state.gatheredAt !== null && !Number.isFinite(state.gatheredAt)) ||
      typeof state.atHome !== "boolean" ||
      (state.sleep !== null && !(state.sleep && typeof state.sleep === "object" &&
        typeof state.sleep.homeId === "string" && Number.isFinite(state.sleep.startedAt) &&
        Number.isFinite(state.sleep.endsAt) && state.sleep.endsAt > state.sleep.startedAt)) ||
      !state.altars || typeof state.altars !== "object" ||
      Object.keys(state.altars).length !== Object.keys(ALTARS).length ||
      !Object.keys(ALTARS).every((id) => Number.isInteger(state.altars[id]) &&
        state.altars[id] >= 0 && state.altars[id] <= ALTARS[id].maxLevel) ||
      (state.clinicDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(state.clinicDate))
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
    return { ok: true, state: stamp(state, now), healed: true };
  }

  function useClinic(current, injuries, now = Date.now()) {
    if (!current.atHome || getBestHome(current)?.tier !== "mansion") {
      return fail(current, "Лечебница доступна только в собственном особняке.");
    }
    if (injuries <= 0) return fail(current, "Лечить травмы не требуется.");
    const today = new Date(now).toISOString().slice(0, 10);
    if (current.clinicDate === today) return fail(current, "Лечебница принимает раз в календарный день.");
    const state = copy(current);
    state.clinicDate = today;
    return { ok: true, state: stamp(state, now), healed: injuries };
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
    result.clinicDate = [first.clinicDate, second.clinicDate].filter(Boolean).sort().slice(-1)[0] || null;
    return isValidState(result) ? result : copy(latest);
  }

  root.WellHomesteadModel = Object.freeze({
    ALTARS,
    ALTAR_EFFECTS,
    BUILDINGS,
    canReplaceBuilding,
    DAY,
    HOUR,
    HOME_TYPES,
    RESOURCE_KEYS,
    buyPlot,
    buildOrUpgrade,
    completeSleep,
    createState,
    discardCrop,
    drawWater,
    enterHome,
    fail,
    fish,
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
    upgradeAltar,
    useClinic,
    waterGarden,
    withDefaults,
  });
})(window);
