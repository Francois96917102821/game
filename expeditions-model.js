"use strict";

(() => {
  const TICKET_PRICE = 100;
  const MAX_RECORDS = 10000;
  const MAX_CHOICES = 20;

  const EXPEDITIONS = [
    {
      id: "mist-lighthouse",
      title: "Остров туманного маяка",
      icon: "◉",
      cost: 1,
      description: "Найди источник огня, который каждую ночь зовёт корабли на пустые скалы.",
      reward: { relic: "Линза последнего смотрителя", record: "Имя смотрителя маяка" },
      start: "shore",
      nodes: {
        shore: {
          text: "Туман стелется по палубе, хотя море спокойно. Впереди два огня: высокий маяк и крошечный огонёк у самой воды. За кормой ещё виден порт.",
          choices: [
            { id: "high-light", label: "Подняться к маяку по ступеням", to: "stairs" },
            { id: "low-light", label: "Проследить за огоньком у воды", to: "tide" },
            { id: "turn-back", label: "Развернуть корабль к порту", to: "retreat" },
          ],
        },
        stairs: {
          text: "На стене башни вырезан ряд стёкол: тёмное, светлое, тёмное. Внизу скрипит механизм, отвечающий на перестановку линз.",
          choices: [
            { id: "dark-light-dark", label: "Повторить узор: тёмное — светлое — тёмное", to: "keeper" },
            { id: "light-dark-dark", label: "Повернуть сначала самое яркое стекло", to: "lost" },
            { id: "leave-tower", label: "Не трогать механизм и отступить", to: "retreat" },
          ],
        },
        tide: {
          text: "Огонёк горит не на берегу, а на буйке. Каждая третья волна обнажает каменный проход под водой.",
          choices: [
            { id: "third-wave", label: "Войти в проход на третьей волне", to: "keeper" },
            { id: "swim-now", label: "Прыгнуть в воду, пока проход скрыт", to: "lost" },
            { id: "wait-port", label: "Вернуться на корабль и уйти", to: "retreat" },
          ],
        },
        keeper: {
          ending: "success",
          title: "Свет, который помнит",
          text: "В башне ты находишь смотрителя — вернее, его имя, выгравированное на линзе. Маяк гаснет, и туман впервые за долгие годы расступается.",
        },
        lost: {
          ending: "failure",
          title: "Скалы в молоке",
          text: "Туман стирает обратный путь. Ты находишь дорогу к кораблю лишь на рассвете; маяк продолжает звать чужие суда.",
        },
        retreat: {
          ending: "retreat",
          title: "Обратный огонь",
          text: "Корабль возвращается в порт. Маяк остаётся загадкой, но однажды к нему можно отправиться снова.",
        },
      },
    },
    {
      id: "sunken-archipelago",
      title: "Затонувший архипелаг",
      icon: "⌁",
      cost: 2,
      description: "Исследуй острова, которые поднимаются из моря только в часы отлива.",
      reward: { relic: "Медный колокол глубин", record: "Карта затонувших островов" },
      start: "bells",
      nodes: {
        bells: {
          text: "Из-под воды доносится звон. Среди рифов видны обломки корабля и три круга ряби; четвёртый звук приходит с запозданием.",
          choices: [
            { id: "three-ripples", label: "Держать курс на три настоящих круга ряби", to: "island" },
            { id: "fourth-echo", label: "Искать источник запоздалого четвёртого звона", to: "deep" },
            { id: "return", label: "Не рисковать кораблём и вернуться", to: "retreat" },
          ],
        },
        island: {
          text: "На острове торчит мачта. На её табличке написано: «Сначала назови корабль, потом открывай каюту». В воде ещё читается имя «Северная звезда».",
          choices: [
            { id: "name-ship", label: "Прошептать имя корабля и открыть каюту", to: "captain" },
            { id: "break-lock", label: "Сорвать замок силой", to: "deep" },
            { id: "leave-island", label: "Отплыть, пока не начался прилив", to: "retreat" },
          ],
        },
        deep: {
          ending: "failure",
          title: "Четвёртый звон",
          text: "Запоздалый звук оказывается эхом подводной расщелины. Волна сносит метки, и ты возвращаешься без карты; архипелаг появится вновь во время другого отлива.",
        },
        captain: {
          ending: "success",
          title: "Капитан пустого моря",
          text: "Каюта открывается. Капитанский журнал отмечает безопасный проход между островами и последний звон колокола — тот самый, что предупреждает об отливе.",
        },
        retreat: {
          ending: "retreat",
          title: "До следующего отлива",
          text: "Ты уводишь корабль на глубокую воду. Острова скрываются под волнами, но их звон ещё долго слышен за кормой.",
        },
      },
    },
    {
      id: "ash-reef",
      title: "Пепельный риф",
      icon: "♨",
      cost: 1,
      description: "Пройди между горячими источниками и узнай, почему чёрный песок хранит голоса.",
      reward: { relic: "Обсидиановая раковина", record: "Песнь пепельного рифа" },
      start: "black-sand",
      nodes: {
        "black-sand": {
          text: "Чёрный песок шепчет под ногами. На берегу лежат четыре раковины: три чёрные, одна белая. Между камнями поднимается пар.",
          choices: [
            { id: "white-shell", label: "Взять единственную белую раковину", to: "song" },
            { id: "black-shell", label: "Собрать чёрные раковины", to: "steam" },
            { id: "sail-away", label: "Оставить риф и вернуться в порт", to: "retreat" },
          ],
        },
        song: {
          text: "Белая раковина звучит только в паузе между порывами пара. Камни отмечены короткими и длинными струями, повторяющими ритм прибоя.",
          choices: [
            { id: "wait-pause", label: "Дождаться тишины и ответить коротким ритмом", to: "heart" },
            { id: "shout-now", label: "Крикнуть в раковину, пока пар шумит", to: "steam" },
            { id: "keep-shell", label: "Унести раковину и не тревожить риф", to: "retreat" },
          ],
        },
        steam: {
          ending: "failure",
          title: "Слепой берег",
          text: "Пар закрывает тропу. Ты находишь корабль, но голоса рифа стихают, пока он не скроется за горизонтом.",
        },
        heart: {
          ending: "success",
          title: "Риф отвечает",
          text: "В паузе раковина повторяет древнюю песню. Пепельные камни расходятся, открывая безопасную бухту и чёрное стекло, отполированное морем.",
        },
        retreat: {
          ending: "retreat",
          title: "Тишина за кормой",
          text: "Ты возвращаешься в порт с пустыми руками. Пепельный риф останется на карте — попытку можно повторить.",
        },
      },
    },
  ];
  const EXPEDITION_BY_ID = new Map(EXPEDITIONS.map((expedition) => [expedition.id, expedition]));

  function createState() {
    return {
      ticketPurchases: [],
      purchased: [],
      completed: [],
      relics: [],
      history: [],
      active: null,
    };
  }

  function isId(value) {
    return typeof value === "string" && /^[\w-]{1,100}$/.test(value);
  }

  function isValidState(state) {
    if (!state || typeof state !== "object" || Array.isArray(state)) return false;
    if (!Array.isArray(state.ticketPurchases) || state.ticketPurchases.length > MAX_RECORDS ||
      !Array.isArray(state.purchased) || state.purchased.length > EXPEDITIONS.length ||
      !Array.isArray(state.completed) || state.completed.length > EXPEDITIONS.length ||
      !Array.isArray(state.relics) || state.relics.length > EXPEDITIONS.length ||
      !Array.isArray(state.history) || state.history.length > MAX_RECORDS) return false;
    if (!state.ticketPurchases.every((entry) => entry && isId(entry.id) &&
      Number.isInteger(entry.amount) && entry.amount > 0 && entry.amount <= 1000 &&
      entry.essenceCost === entry.amount * TICKET_PRICE)) return false;
    if (new Set(state.ticketPurchases.map((entry) => entry.id)).size !== state.ticketPurchases.length) return false;
    for (const key of ["purchased", "completed", "relics"]) {
      if (!state[key].every((id) => EXPEDITION_BY_ID.has(id)) || new Set(state[key]).size !== state[key].length) return false;
    }
    if (state.completed.some((id) => !state.purchased.includes(id))) return false;
    if (!state.history.every((entry) => entry && isId(entry.id) && EXPEDITION_BY_ID.has(entry.expeditionId) &&
      ["success", "failure", "retreat"].includes(entry.outcome) && Number.isInteger(entry.createdAt) &&
      Array.isArray(entry.choices) && entry.choices.length <= MAX_CHOICES &&
      entry.choices.every((choice) => choice && isId(choice.nodeId) && isId(choice.choiceId) &&
        typeof choice.label === "string" && choice.label.length <= 160))) return false;
    if (new Set(state.history.map((entry) => entry.id)).size !== state.history.length) return false;
    if (state.active !== null) {
      const active = state.active;
      const expedition = EXPEDITION_BY_ID.get(active.expeditionId);
      if (!expedition || !state.purchased.includes(active.expeditionId) ||
        !isId(active.nodeId) || !expedition.nodes[active.nodeId] ||
        !Number.isInteger(active.startedAt) || !Number.isInteger(active.updatedAt) ||
        !Array.isArray(active.choices) || active.choices.length >= MAX_CHOICES ||
        !active.choices.every((choice) => choice && isId(choice.nodeId) && isId(choice.choiceId) &&
          typeof choice.label === "string" && choice.label.length <= 160)) return false;
    }
    return true;
  }

  function withDefaults(state) {
    return isValidState(state) ? clone(state) : createState();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function ticketBalance(state) {
    const saved = withDefaults(state);
    const purchasedTickets = saved.ticketPurchases.reduce((total, receipt) => total + receipt.amount, 0);
    const spentTickets = saved.purchased.reduce((total, id) => total + EXPEDITION_BY_ID.get(id).cost, 0);
    return Math.max(0, purchasedTickets - spentTickets);
  }

  function buyTickets(state, essence, amount, receiptId) {
    const saved = withDefaults(state);
    if (!Number.isInteger(amount) || amount < 1 || amount > 1000 || !isId(receiptId)) {
      return { state: saved, essence, bought: false, reason: "invalid" };
    }
    if (saved.ticketPurchases.some((receipt) => receipt.id === receiptId)) {
      return { state: saved, essence, bought: true, reason: "duplicate" };
    }
    if (!Number.isInteger(essence) || essence < amount * TICKET_PRICE) {
      return { state: saved, essence, bought: false, reason: "essence" };
    }
    if (saved.ticketPurchases.length >= MAX_RECORDS) {
      return { state: saved, essence, bought: false, reason: "limit" };
    }
    saved.ticketPurchases.push({ id: receiptId, amount, essenceCost: amount * TICKET_PRICE });
    return { state: saved, essence: essence - amount * TICKET_PRICE, bought: true, reason: "" };
  }

  function purchase(state, expeditionId) {
    const saved = withDefaults(state);
    const expedition = EXPEDITION_BY_ID.get(expeditionId);
    if (!expedition) return { state: saved, purchased: false, reason: "unknown" };
    if (saved.purchased.includes(expeditionId)) return { state: saved, purchased: true, reason: "owned" };
    if (ticketBalance(saved) < expedition.cost) return { state: saved, purchased: false, reason: "tickets" };
    saved.purchased.push(expeditionId);
    return { state: saved, purchased: true, reason: "" };
  }

  function start(state, expeditionId, now = Date.now()) {
    const saved = withDefaults(state);
    const expedition = EXPEDITION_BY_ID.get(expeditionId);
    if (!expedition) return { state: saved, started: false, reason: "unknown" };
    if (!saved.purchased.includes(expeditionId)) return { state: saved, started: false, reason: "locked" };
    if (saved.active) return { state: saved, started: false, reason: "active" };
    saved.active = {
      expeditionId,
      nodeId: expedition.start,
      choices: [],
      startedAt: now,
      updatedAt: now,
    };
    return { state: saved, started: true, reason: "" };
  }

  function choose(state, choiceId, now = Date.now(), historyId = `voyage-${now}-${Math.random().toString(36).slice(2)}`) {
    const saved = withDefaults(state);
    if (!saved.active) return { state: saved, outcome: "", rewardGranted: false, reason: "inactive" };
    const expedition = EXPEDITION_BY_ID.get(saved.active.expeditionId);
    const node = expedition.nodes[saved.active.nodeId];
    const choice = node.choices?.find((option) => option.id === choiceId);
    if (!choice) return { state: saved, outcome: "", rewardGranted: false, reason: "invalid-choice" };
    if (!isId(historyId) || saved.history.length >= MAX_RECORDS) {
      return { state: saved, outcome: "", rewardGranted: false, reason: "limit" };
    }
    saved.active.choices.push({ nodeId: saved.active.nodeId, choiceId: choice.id, label: choice.label });
    saved.active.nodeId = choice.to;
    saved.active.updatedAt = now;
    const ending = expedition.nodes[choice.to];
    if (!ending.ending) return { state: saved, outcome: "", rewardGranted: false, reason: "" };

    const record = {
      id: historyId,
      expeditionId: expedition.id,
      outcome: ending.ending,
      title: ending.title,
      text: ending.text,
      choices: saved.active.choices,
      createdAt: now,
    };
    const rewardGranted = ending.ending === "success" && !saved.completed.includes(expedition.id);
    if (ending.ending === "success" && !saved.completed.includes(expedition.id)) {
      saved.completed.push(expedition.id);
      saved.relics.push(expedition.id);
    }
    saved.history.push(record);
    saved.active = null;
    return {
      state: saved,
      outcome: ending.ending,
      rewardGranted,
      reward: rewardGranted ? expedition.reward : null,
      record,
      reason: "",
    };
  }

  function merge(left, right) {
    const first = withDefaults(left);
    const second = withDefaults(right);
    const ticketPurchases = new Map(first.ticketPurchases.map((entry) => [entry.id, entry]));
    for (const entry of second.ticketPurchases) ticketPurchases.set(entry.id, entry);
    const history = new Map(first.history.map((entry) => [entry.id, entry]));
    for (const entry of second.history) history.set(entry.id, entry);
    const active = !first.active ? second.active
      : !second.active ? first.active
        : second.active.updatedAt > first.active.updatedAt ? second.active : first.active;
    const combined = {
      ticketPurchases: [...ticketPurchases.values()],
      purchased: [...new Set([...first.purchased, ...second.purchased])],
      completed: [...new Set([...first.completed, ...second.completed])],
      relics: [...new Set([...first.relics, ...second.relics])],
      history: [...history.values()].slice(-MAX_RECORDS),
      active: active ? clone(active) : null,
    };
    combined.completed = combined.completed.filter((id) => combined.purchased.includes(id));
    combined.relics = combined.relics.filter((id) => combined.completed.includes(id));
    if (combined.active && combined.completed.includes(combined.active.expeditionId) &&
      combined.active.updatedAt < Math.max(...combined.history
        .filter((entry) => entry.expeditionId === combined.active.expeditionId && entry.outcome === "success")
        .map((entry) => entry.createdAt), 0)) combined.active = null;
    return combined;
  }

  window.WellExpeditionsModel = Object.freeze({
    TICKET_PRICE,
    EXPEDITIONS,
    createState,
    isValidState,
    withDefaults,
    ticketBalance,
    buyTickets,
    purchase,
    start,
    choose,
    merge,
  });
})();
