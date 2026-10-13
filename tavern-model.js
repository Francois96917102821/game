"use strict";

(function attachTavernModel(root) {
  const VERSION = 1;
  const MAX_GOLD = 1000000000;
  const MAX_INJURIES = 3;
  const MAX_RECIPES = 3;
  const MEAL_PRICE = 6;
  const MEAL_SATIETY = 20;
  const HOUR = 60 * 60 * 1000;
  const SATIETY_PER_HOUR = 5;
  const RECIPE_LIST = [
    { id: "root-biscuit", name: "Корневое печенье", description: "+20 сытости", satiety: 20, ingredients: "Корни из нижних гротов и чистая вода." },
    { id: "spiced-meat", name: "Пряное мясо", description: "+20 сытости", satiety: 20, ingredients: "Мясо с портовыми травами." },
    { id: "fish-fillet", name: "Рыбное филе", description: "+20 сытости", satiety: 20, ingredients: "Свежая рыба и щепоть соли." },
    { id: "pickled-mushrooms", name: "Маринованные грибы", description: "+30 сытости", satiety: 30, ingredients: "Два тёмных гриба, болотная зелень и вода." },
    { id: "boiled-oysters", name: "Варёные устрицы", description: "+30 сытости", satiety: 30, ingredients: "Морские устрицы и чистая вода." },
    { id: "fish-in-sauce", name: "Рыба в каменном соусе", description: "+30 сытости, лечит 1 травму", satiety: 30, injuries: -1, ingredients: "Рыба, масло и каменный цвет." },
    { id: "hell-skewer", name: "Острый шашлык", description: "+30 сытости, наносит 1 травму", satiety: 30, injuries: 1, ingredients: "Жареное мясо с едкой приправой." },
    { id: "foul-sausage", name: "Копчёная колбаса", description: "+40 сытости, наносит 1 травму", satiety: 40, injuries: 1, ingredients: "Мясо, горькая зелень и корень." },
    { id: "strange-soup", name: "Суп из кладовой", description: "+40 сытости, наносит 1 травму", satiety: 40, injuries: 1, ingredients: "Коренья, вода и рыбий глаз." },
    { id: "vital-water", name: "Живительная вода", description: "Лечит все травмы", satiety: 0, injuries: -MAX_INJURIES, ingredients: "Чистая вода и два каменных цветка." },
  ];
  const RECIPES = Object.freeze(Object.fromEntries(RECIPE_LIST.map((recipe) => [recipe.id, Object.freeze(recipe)])));
  const JOBS = Object.freeze({
    cook: { title: "Готовка", durationMs: HOUR, gold: [8, 14] },
    cleaning: { title: "Уборка", durationMs: 4 * HOUR, gold: [18, 28] },
    waiter: { title: "Официант", durations: [2, 4, 8], gold: { 2: 16, 4: 36, 8: 80 } },
    cellar: { title: "Разбор погреба", durationMs: 8 * HOUR, gold: [42, 60] },
    room: { title: "Комната", durationMs: 3 * HOUR },
  });
  const CARD_SUITS = ["♠", "♥", "♦", "♣"];

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function randomInteger(random, min, max) {
    return Math.floor(random() * (max - min + 1)) + min;
  }

  function createId(now, random) {
    return `${now}-${Math.floor(random() * 0x100000000).toString(16)}`;
  }

  function createState(now = Date.now()) {
    return {
      version: VERSION,
      revision: 0,
      updatedAt: now,
      gold: 0,
      satiety: 50,
      satietyAt: now,
      injuries: 0,
      characterLevel: 1,
      recipes: Object.fromEntries(RECIPE_LIST.map((recipe) => [recipe.id, 0])),
      activeJob: null,
      jobReceipts: [],
      stash: [],
      preparedGearId: null,
      nextGearSequence: 0,
      bonuses: { attack: 0, maxHp: 0 },
      game: null,
    };
  }

  function isValidGear(item) {
    return Boolean(
      item && typeof item === "object" &&
      typeof item.id === "string" && /^gear-\d+$/.test(item.id) &&
      (item.type === "weapon" || item.type === "armor") &&
      typeof item.name === "string" && item.name.length > 0 && item.name.length <= 60 &&
      Number.isInteger(item.bonus) && item.bonus >= 1 && item.bonus <= 10
    );
  }

  function validCard(card) {
    return Boolean(card && Number.isInteger(card.value) && card.value >= 2 && card.value <= 14 &&
      CARD_SUITS.includes(card.suit));
  }

  function isValidGame(game) {
    if (game === null) return true;
    if (!game || typeof game !== "object" || typeof game.id !== "string" ||
      !["21", "dice"].includes(game.kind) || !Number.isInteger(game.bet) ||
      game.bet < 1 || game.bet > 10000 || !["playing", "finished"].includes(game.status) ||
      !Number.isFinite(game.startedAt)) return false;
    if (game.kind === "21") {
      return Array.isArray(game.deck) && game.deck.length <= 52 && game.deck.every(validCard) &&
        Array.isArray(game.player) && game.player.length >= 2 && game.player.length <= 12 && game.player.every(validCard) &&
        Array.isArray(game.dealer) && game.dealer.length >= 2 && game.dealer.length <= 12 && game.dealer.every(validCard) &&
        (game.payout === null || Number.isInteger(game.payout) && game.payout >= 0 && game.payout <= MAX_GOLD);
    }
    return Array.isArray(game.dice) && game.dice.length === 5 &&
      game.dice.every((die) => Number.isInteger(die) && die >= 1 && die <= 6) &&
      Number.isInteger(game.rollsLeft) && game.rollsLeft >= 0 && game.rollsLeft <= 2 &&
      Array.isArray(game.held) && game.held.length <= 5 &&
      game.held.every((die) => Number.isInteger(die) && die >= 0 && die < 5) &&
      new Set(game.held).size === game.held.length &&
      (game.payout === null || Number.isInteger(game.payout) && game.payout >= 0 && game.payout <= MAX_GOLD);
  }

  function isValidState(state) {
    return Boolean(
      state && typeof state === "object" && state.version === VERSION &&
      Number.isInteger(state.revision) && state.revision >= 0 && state.revision <= 1000000000 &&
      Number.isFinite(state.updatedAt) && Number.isInteger(state.gold) && state.gold >= 0 && state.gold <= MAX_GOLD &&
      Number.isInteger(state.satiety) && state.satiety >= 0 && state.satiety <= 100 &&
      Number.isFinite(state.satietyAt) && Number.isInteger(state.injuries) && state.injuries >= 0 &&
      state.injuries <= MAX_INJURIES && Number.isInteger(state.characterLevel) &&
      state.characterLevel >= 1 && state.characterLevel <= 10000 &&
      state.recipes && Object.keys(state.recipes).length === RECIPE_LIST.length &&
      RECIPE_LIST.every((recipe) => Number.isInteger(state.recipes[recipe.id]) &&
        state.recipes[recipe.id] >= 0 && state.recipes[recipe.id] <= MAX_RECIPES) &&
      (state.activeJob === null || (
        state.activeJob && typeof state.activeJob === "object" &&
        typeof state.activeJob.id === "string" && Object.hasOwn(JOBS, state.activeJob.kind) &&
        Number.isFinite(state.activeJob.startedAt) && Number.isFinite(state.activeJob.endsAt) &&
        state.activeJob.endsAt > state.activeJob.startedAt &&
        Number.isInteger(state.activeJob.durationMs) &&
        state.activeJob.endsAt - state.activeJob.startedAt === state.activeJob.durationMs &&
        state.activeJob.reward && Number.isInteger(state.activeJob.reward.gold) &&
        state.activeJob.reward.gold >= 0 && state.activeJob.reward.gold <= 10000 &&
        (state.activeJob.reward.recipeId === undefined || Object.hasOwn(RECIPES, state.activeJob.reward.recipeId)) &&
        (state.activeJob.reward.item === undefined || isValidGear(state.activeJob.reward.item)) &&
        (state.activeJob.reward.bonus === undefined || ["attack", "maxHp", null].includes(state.activeJob.reward.bonus))
      )) &&
      Array.isArray(state.jobReceipts) && state.jobReceipts.length <= 100000 &&
      state.jobReceipts.every((id) => typeof id === "string") &&
      new Set(state.jobReceipts).size === state.jobReceipts.length &&
      Array.isArray(state.stash) && state.stash.length <= 10000 && state.stash.every(isValidGear) &&
      new Set(state.stash.map((item) => item.id)).size === state.stash.length &&
      (state.preparedGearId === null || state.stash.some((item) => item.id === state.preparedGearId)) &&
      Number.isInteger(state.nextGearSequence) && state.nextGearSequence >= 0 &&
      state.stash.every((item) => Number(item.id.slice(5)) <= state.nextGearSequence) &&
      state.bonuses && Number.isInteger(state.bonuses.attack) && state.bonuses.attack >= 0 &&
      state.bonuses.attack <= 100000 && Number.isInteger(state.bonuses.maxHp) &&
      state.bonuses.maxHp >= 0 && state.bonuses.maxHp <= 100000 &&
      isValidGame(state.game)
    );
  }

  function withDefaults(value, now = Date.now()) {
    if (!value || typeof value !== "object") return createState(now);
    const state = { ...createState(now), ...copy(value) };
    state.recipes = { ...createState(now).recipes, ...(value.recipes || {}) };
    state.bonuses = { ...createState(now).bonuses, ...(value.bonuses || {}) };
    if (!isValidState(state)) return createState(now);
    return state;
  }

  function updateSatiety(state, now = Date.now()) {
    const next = copy(state);
    const hoursElapsed = Math.floor(Math.max(0, now - next.satietyAt) / HOUR);
    if (hoursElapsed > 0) {
      next.satiety = Math.max(0, next.satiety - hoursElapsed * SATIETY_PER_HOUR);
      next.satietyAt += hoursElapsed * HOUR;
      next.updatedAt = now;
      next.revision += 1;
    }
    return next;
  }

  function startJob(current, kind, options = {}, now = Date.now(), random = Math.random) {
    const state = updateSatiety(current, now);
    if (state.activeJob) throw new Error("Сначала заверши или получи награду за текущее дело.");
    const definition = JOBS[kind];
    if (!definition) throw new Error("Такого дела в таверне нет.");
    const level = Number.isInteger(options.level) && options.level >= 1
      ? options.level
      : state.characterLevel;
    let durationMs = definition.durationMs;
    let gold = 0;
    const reward = {};
    if (kind === "room") {
      if (state.injuries === 0) throw new Error("Снимать комнату незачем: травм нет.");
      gold = level * 2;
      if (state.gold < gold) throw new Error(`Нужно ${gold} золотых.`);
      state.gold -= gold;
      durationMs = 3 * HOUR;
    } else if (kind === "waiter") {
      const hours = options.hours;
      if (!definition.durations.includes(hours)) throw new Error("Выбери смену на 2, 4 или 8 часов.");
      durationMs = hours * HOUR;
      gold = definition.gold[hours];
    } else if (kind === "cook") {
      const available = RECIPE_LIST.filter((recipe) => state.recipes[recipe.id] < MAX_RECIPES);
      if (!available.length) throw new Error("Все рецепты уже хранятся по 3 штуки. Используй еду перед новой готовкой.");
      reward.recipeId = available[randomInteger(random, 0, available.length - 1)].id;
      gold = randomInteger(random, ...definition.gold);
    } else if (kind === "cleaning") {
      if (!isValidGear(options.item)) throw new Error("Не удалось подготовить предмет из сундука.");
      reward.item = copy(options.item);
      gold = randomInteger(random, ...definition.gold);
    } else if (kind === "cellar") {
      gold = randomInteger(random, ...definition.gold);
      const success = random() < 0.25;
      reward.bonus = success ? random() < 0.5 ? "attack" : "maxHp" : null;
    }
    reward.gold = gold;
    state.activeJob = {
      id: createId(now, random),
      kind,
      startedAt: now,
      endsAt: now + durationMs,
      durationMs,
      reward,
    };
    state.revision = current.revision + 1;
    state.updatedAt = now;
    if (!isValidState(state)) throw new Error("Не удалось проверить сохранение задания.");
    return state;
  }

  function claimJob(current, now = Date.now()) {
    const state = updateSatiety(current, now);
    const job = state.activeJob;
    if (!job) throw new Error("Сейчас нет дела, за которое можно получить награду.");
    if (now < job.endsAt) throw new Error("Время дела ещё не истекло.");
    if (state.jobReceipts.includes(job.id)) throw new Error("Эта награда уже получена.");
    if (state.gold + job.reward.gold > MAX_GOLD) throw new Error("В кошельке нет места для награды: потрать немного золота.");
    if (job.reward.recipeId && state.recipes[job.reward.recipeId] >= MAX_RECIPES) {
      throw new Error("Для рецепта нет места. Используй одну порцию и попробуй получить награду снова.");
    }
    if (job.reward.item && state.stash.length >= 10000) {
      throw new Error("Склад полон. Освободи место, прежде чем забирать трофей.");
    }
    state.gold += job.reward.gold;
    if (job.kind === "room") {
      state.injuries = 0;
    } else {
      if (job.reward.recipeId) state.recipes[job.reward.recipeId] += 1;
      if (job.reward.item) state.stash.push(copy(job.reward.item));
      if (job.reward.bonus === "attack") state.bonuses.attack += 1;
      if (job.reward.bonus === "maxHp") state.bonuses.maxHp += 2;
    }
    state.jobReceipts.push(job.id);
    state.activeJob = null;
    state.revision = current.revision + 1;
    state.updatedAt = now;
    if (!isValidState(state)) throw new Error("Не удалось проверить сохранение награды.");
    return state;
  }

  function useRecipe(current, recipeId, now = Date.now()) {
    const recipe = RECIPES[recipeId];
    if (!recipe) throw new Error("Рецепт не найден.");
    const state = updateSatiety(current, now);
    if (state.recipes[recipeId] < 1) throw new Error("Этого рецепта нет в запасе.");
    state.recipes[recipeId] -= 1;
    state.satiety = Math.min(100, state.satiety + recipe.satiety);
    if (recipe.injuries < 0) state.injuries = Math.max(0, state.injuries + recipe.injuries);
    if (recipe.injuries > 0) state.injuries = Math.min(MAX_INJURIES, state.injuries + recipe.injuries);
    state.revision = current.revision + 1;
    state.updatedAt = now;
    return state;
  }

  function buyMeal(current, now = Date.now()) {
    if (!isValidState(current)) throw new Error("Некорректное сохранение таверны.");
    const state = updateSatiety(current, now);
    if (state.gold < MEAL_PRICE) throw new Error(`Нужно ${MEAL_PRICE} золотых на еду.`);
    if (state.satiety === 100) throw new Error("Ты уже сыт. Золото не списано.");
    state.gold -= MEAL_PRICE;
    state.satiety = Math.min(100, state.satiety + MEAL_SATIETY);
    state.revision = current.revision + 1;
    state.updatedAt = now;
    if (!isValidState(state)) throw new Error("Не удалось проверить покупку еды.");
    return state;
  }

  function buildDeck(random) {
    const deck = [];
    for (const suit of CARD_SUITS) {
      for (let value = 2; value <= 14; value += 1) deck.push({ value, suit });
    }
    for (let index = deck.length - 1; index > 0; index -= 1) {
      const swap = randomInteger(random, 0, index);
      [deck[index], deck[swap]] = [deck[swap], deck[index]];
    }
    return deck;
  }

  function draw(game) {
    return game.deck.pop();
  }

  function cardTotal(cards) {
    let total = 0;
    let aces = 0;
    for (const card of cards) {
      if (card.value === 14) {
        aces += 1;
        total += 11;
      } else {
        total += Math.min(card.value, 10);
      }
    }
    while (total > 21 && aces > 0) {
      total -= 10;
      aces -= 1;
    }
    return total;
  }

  function finishGame(state, payout, result, now) {
    if (state.game.status !== "playing") throw new Error("Эта игра уже завершена.");
    if (state.gold + payout > MAX_GOLD) throw new Error("В кошельке нет места для выплаты.");
    state.gold += payout;
    state.game.status = "finished";
    state.game.payout = payout;
    state.game.result = result;
    state.game.finishedAt = now;
  }

  function settle21(state, now) {
    const player = cardTotal(state.game.player);
    const dealer = cardTotal(state.game.dealer);
    while (dealer < 17 && state.game.deck.length) state.game.dealer.push(draw(state.game));
    const finalDealer = cardTotal(state.game.dealer);
    if (player > 21) finishGame(state, 0, `Перебор: ${player}. Ставка потеряна.`, now);
    else if (finalDealer > 21 || player > finalDealer) finishGame(state, state.game.bet * 2, `Победа: ${player} против ${finalDealer}. Возврат 2× ставки.`, now);
    else if (player === finalDealer) finishGame(state, state.game.bet, `Ничья: ${player}. Возврат ставки.`, now);
    else finishGame(state, 0, `Дилер выиграл: ${finalDealer} против ${player}. Ставка потеряна.`, now);
  }

  function startGame(current, kind, bet, now = Date.now(), random = Math.random) {
    const state = updateSatiety(current, now);
    if (!["21", "dice"].includes(kind)) throw new Error("Такой игры нет.");
    if (state.game?.status === "playing") throw new Error("Сначала закончи текущую партию.");
    if (!Number.isInteger(bet) || bet < 1 || bet > 10000) throw new Error("Ставка должна быть от 1 до 10 000 золотых.");
    if (state.gold < bet) throw new Error("В кошельке недостаточно золота для этой ставки.");
    state.gold -= bet;
    if (kind === "21") {
      const game = {
        id: createId(now, random),
        kind,
        bet,
        startedAt: now,
        status: "playing",
        deck: buildDeck(random),
        player: [],
        dealer: [],
        payout: null,
      };
      game.player.push(draw(game), draw(game));
      game.dealer.push(draw(game), draw(game));
      state.game = game;
      if (cardTotal(game.player) === 21) settle21(state, now);
    } else {
      state.game = {
        id: createId(now, random),
        kind,
        bet,
        startedAt: now,
        status: "playing",
        dice: Array.from({ length: 5 }, () => randomInteger(random, 1, 6)),
        rollsLeft: 2,
        held: [],
        payout: null,
      };
    }
    state.revision = current.revision + 1;
    state.updatedAt = now;
    if (!isValidState(state)) throw new Error("Не удалось проверить сохранение партии.");
    return state;
  }

  function hit21(current, now = Date.now(), random = Math.random) {
    const state = updateSatiety(current, now);
    if (!state.game || state.game.kind !== "21" || state.game.status !== "playing") throw new Error("Сейчас нет активной партии в 21.");
    state.game.player.push(draw(state.game));
    if (cardTotal(state.game.player) >= 21) settle21(state, now);
    state.revision = current.revision + 1;
    state.updatedAt = now;
    if (!isValidState(state)) throw new Error("Не удалось сохранить ход.");
    return state;
  }

  function stand21(current, now = Date.now()) {
    const state = updateSatiety(current, now);
    if (!state.game || state.game.kind !== "21" || state.game.status !== "playing") throw new Error("Сейчас нет активной партии в 21.");
    settle21(state, now);
    state.revision = current.revision + 1;
    state.updatedAt = now;
    if (!isValidState(state)) throw new Error("Не удалось сохранить ход.");
    return state;
  }

  function diceRank(dice) {
    const counts = Object.values(dice.reduce((result, value) => {
      result[value] = (result[value] || 0) + 1;
      return result;
    }, {})).sort((left, right) => right - left);
    const sorted = [...new Set(dice)].sort((left, right) => left - right);
    if (counts[0] === 5) return { name: "Пять одинаковых", multiplier: 25 };
    if (counts[0] === 4) return { name: "Каре", multiplier: 10 };
    if (counts[0] === 3 && counts[1] === 2) return { name: "Фул-хаус", multiplier: 6 };
    if (sorted.length === 5 && (sorted[4] - sorted[0] === 4)) return { name: "Стрит", multiplier: 4 };
    if (counts[0] === 3) return { name: "Тройка", multiplier: 3 };
    if (counts[0] === 2 && counts[1] === 2) return { name: "Две пары", multiplier: 2 };
    return { name: "Пара или ниже", multiplier: 0 };
  }

  function rollDice(current, heldIndices, now = Date.now(), random = Math.random) {
    const state = updateSatiety(current, now);
    const game = state.game;
    if (!game || game.kind !== "dice" || game.status !== "playing") throw new Error("Сейчас нет активной партии в кости.");
    if (!Array.isArray(heldIndices) || heldIndices.length > 5 ||
      !heldIndices.every((index) => Number.isInteger(index) && index >= 0 && index < 5) ||
      new Set(heldIndices).size !== heldIndices.length) throw new Error("Выбери кости, которые нужно оставить.");
    if (game.rollsLeft < 1) throw new Error("Перебросы закончились.");
    const held = new Set(heldIndices);
    game.dice = game.dice.map((value, index) => held.has(index) ? value : randomInteger(random, 1, 6));
    game.held = [...held].sort((left, right) => left - right);
    game.rollsLeft -= 1;
    if (game.rollsLeft === 0) {
      const rank = diceRank(game.dice);
      const payout = game.bet * rank.multiplier;
      finishGame(state, payout, `${rank.name}: возврат ${rank.multiplier}× ставки.`, now);
    }
    state.revision = current.revision + 1;
    state.updatedAt = now;
    if (!isValidState(state)) throw new Error("Не удалось сохранить переброс.");
    return state;
  }

  function createInjury(state, now = Date.now()) {
    const next = updateSatiety(state, now);
    next.injuries = Math.min(MAX_INJURIES, next.injuries + 1);
    next.characterLevel = Math.max(1, Math.min(10000, state.characterLevel));
    next.revision = state.revision + 1;
    next.updatedAt = now;
    return next;
  }

  const api = Object.freeze({
    VERSION,
    MAX_GOLD,
    MAX_INJURIES,
    MAX_RECIPES,
    MEAL_PRICE,
    MEAL_SATIETY,
    HOUR,
    RECIPE_LIST,
    RECIPES,
    JOBS,
    createState,
    withDefaults,
    isValidState,
    updateSatiety,
    startJob,
    claimJob,
    useRecipe,
    buyMeal,
    startGame,
    hit21,
    stand21,
    rollDice,
    diceRank,
    createInjury,
    cardTotal,
  });
  root.WellTavernModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
