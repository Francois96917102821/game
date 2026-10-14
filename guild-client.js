"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const REQUEST_KEY = "well-of-whispers-pending-guild-request";
  const RESOURCE_NAMES = {
    boards: "Доски", blocks: "Каменные блоки", cloth: "Ткань", ingots: "Железные слитки",
    knowledge_roots: "Корни знаний", heart_fragments: "Обломки сердца",
  };
  const BUILDINGS = [
    ["castle", "Замок", "1 000 репутации · 50 досок · 50 блоков · 25 ткани · 25 слитков"],
    ["treasury", "Казна", "20 досок · 20 блоков · 20 слитков"],
    ["book_storage", "Книгохранилище", "20 досок · 20 блоков · 20 ткани"],
    ["warehouse", "Склад", "Уровень: 10 досок · 10 блоков · 5 ткани · 5 слитков"],
    ["treasurer", "Казначей", "500 репутации · 250 000 золота"],
    ["healer", "Лекарь", "300 репутации"],
    ["alchemist", "Алхимик", "200 репутации"],
    ["statue", "Статуя неизвестного бога", "50 репутации"],
    ["scribe", "Летописец", "500 репутации · 25 корней знаний"],
    ["craft", "Ремесленная комната", "100 репутации · обломок сердца"],
    ["forge", "Кузница", "400 репутации · обломок сердца"],
  ];
  let options;
  let guild = null;
  let busy = false;
  let pending = null;
  let tab = "hall";
  let refreshInFlight = false;

  function rpc(name, args = {}) {
    return window.WellCloudSave.groupRpc(name, args);
  }

  function requestId() {
    if (!window.crypto?.randomUUID) throw new Error("Браузер не поддерживает безопасные квитанции.");
    return window.crypto.randomUUID();
  }

  function savePending(action, args, localChange = null) {
    pending = { action, args, localChange };
    window.localStorage.setItem(REQUEST_KEY, JSON.stringify(pending));
  }

  function setStatus(message, isError = false) {
    const status = $("guild-status");
    status.textContent = message;
    status.classList.toggle("guild-error", isError);
  }

  function appendText(parent, tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = text;
    parent.append(node);
    return node;
  }

  function getBuildings() {
    return guild?.buildings || {};
  }

  function renderMessages() {
    const messages = $("guild-chat-messages");
    messages.replaceChildren();
    for (const message of guild?.messages || []) {
      const row = document.createElement("article");
      row.className = `guild-message guild-message-${message.kind}`;
      const time = Number.isFinite(Date.parse(message.created_at))
        ? new Date(message.created_at).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
        : "";
      appendText(row, "strong", "", message.nickname);
      appendText(row, "small", "", time);
      appendText(row, "p", "", message.body);
      messages.append(row);
    }
    messages.scrollTop = messages.scrollHeight;
  }

  function renderMembers() {
    const roster = $("guild-roster");
    roster.replaceChildren();
    for (const member of guild?.members || []) {
      const line = document.createElement("div");
      line.className = "guild-roster-row";
      const rank = { leader: "Глава", officer: "Офицер", member: "Участник" }[member.rank];
      appendText(line, "span", "", `${member.nickname} · ${rank}`);
      if (guild.role === "leader" && member.rank !== "leader") {
        for (const [action, label] of [
          [member.rank === "officer" ? "demote" : "promote", member.rank === "officer" ? "Снять офицера" : "Назначить офицером"],
          ["kick", "Исключить"],
        ]) {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "action-button";
          button.textContent = label;
          button.addEventListener("click", () => invoke("guild_member_manage", {
            p_member_id: member.user_id, p_action: action,
          }));
          line.append(button);
        }
      }
      roster.append(line);
    }
  }

  function renderHall() {
    const panel = $("guild-hall-content");
    panel.replaceChildren();
    const buildings = getBuildings();
    const memberCooldowns = guild.cooldowns || {};
    for (const [id, name, cost] of BUILDINGS) {
      const card = document.createElement("article");
      card.className = "guild-building";
      appendText(card, "strong", "", `${name}${buildings[id] ? ` · ур. ${buildings[id]}` : ""}`);
      appendText(card, "p", "", cost);
      const unavailable = id === "scribe" || id === "craft" || id === "forge";
      if (unavailable) {
        appendText(card, "small", "guild-unavailable", id === "scribe"
          ? "Пока недоступно: в игре нет корней знаний и книг."
          : "Пока недоступно: обломки сердца не добываются в текущей версии.");
      }
      if (!buildings[id] || id === "warehouse" || id === "treasurer") {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "action-button";
        button.textContent = unavailable ? "Материал отсутствует" : id === "warehouse" ? "Улучшить склад" : buildings[id] ? "Уже построено" : "Построить";
        button.disabled = unavailable || busy || !["leader", "officer"].includes(guild.role);
        button.addEventListener("click", () => invoke("guild_build", {
          p_building: id, p_request_id: requestId(),
        }));
        card.append(button);
      }
      panel.append(card);
    }

    for (const [service, name, description] of [
      ["healer", "Лекарь", `Лечение всех травм · ${memberCooldowns.healer ? `доступно ${new Date(memberCooldowns.healer).toLocaleString("ru-RU")}` : "перезарядка 20 ч"}`],
      ["alchemist", "Алхимик", `Набор: ${10 + (buildings.alchemist_bonus || 0) * 10} лечебных, ${1 + (buildings.alchemist_bonus || 0)} регенерационных зелий, маскировка · перезарядка 20 ч`],
      ["statue", "Статуя неизвестного бога", `Удача +${buildings.statue_free ? 15 : 10} на 10 минут · перезарядка 20 ч`],
      ["scribe", "Летописец", "Случайная книга раз в 20 часов"],
    ]) {
      if (!buildings[service]) continue;
      const card = document.createElement("article");
      card.className = "guild-building";
      appendText(card, "strong", "", name);
      appendText(card, "p", "", description);
      const claim = document.createElement("button");
      claim.type = "button";
      claim.className = "action-button";
      claim.textContent = service === "healer" ? "Снять все травмы · 1 репутация" : service === "scribe" ? "Недоступно" : "Получить";
      const availableAt = Date.parse(guild.cooldowns?.[service] || "");
      claim.disabled = busy || service === "scribe" ||
        (Number.isFinite(availableAt) && availableAt > Date.now()) ||
        !guild.buildings?.healer_free && service === "healer" && guild.reputation < 1 ||
        service === "statue" && !guild.buildings?.statue_free && guild.reputation < 1 ||
        service === "alchemist" && guild.reputation < 1;
      claim.addEventListener("click", () => invoke("guild_hall_claim", {
        p_service: service, p_request_id: requestId(),
      }, { kind: "service", service }));
      card.append(claim);
      if (service === "healer" && !buildings.healer_free || service === "statue" && !buildings.statue_free ||
        service === "alchemist") {
        const upgrade = document.createElement("button");
        upgrade.type = "button";
        upgrade.className = "action-button";
        upgrade.textContent = service === "healer" ? "Сделать бесплатным · 2 000 репутации"
          : service === "statue" ? "Улучшить · 1 000 000 золота"
            : `Увеличить набор · ${50 * ((buildings.alchemist_bonus || 0) + 1)} репутации`;
        upgrade.disabled = busy || service === "healer" && Boolean(buildings.healer_free) ||
          service === "statue" && Boolean(buildings.statue_free);
        upgrade.addEventListener("click", () => invoke("guild_hall_upgrade", {
          p_upgrade: service === "alchemist" ? "alchemist_bonus" : `${service}_free`,
          p_request_id: requestId(),
        }));
        card.append(upgrade);
      }
      panel.append(card);
    }
  }

  function renderWarehouse() {
    const panel = $("guild-storage-content");
    panel.replaceChildren();
    const resources = guild.resources || {};
    const summary = document.createElement("p");
    summary.className = "guild-warehouse-balances";
    summary.textContent = `Золото ${guild.treasury_gold} · осколки ${guild.treasury_essence} · репутация ${guild.reputation}`;
    panel.append(summary);
    for (const [key, label] of Object.entries(RESOURCE_NAMES)) {
      appendText(panel, "p", "guild-resource-row", `${label}: ${resources[key] || 0}`);
    }
    const capacity = 90 + (getBuildings().warehouse || 0) * 10;
    appendText(panel, "p", "guild-warehouse-balances", `Предметы: ${(guild.items || []).length} / ${capacity}`);
    for (const entry of guild.items || []) {
      const line = document.createElement("div");
      line.className = "guild-item-row";
      appendText(line, "span", "", `${entry.item.name} · +${entry.item.bonus} ${entry.item.type === "weapon" ? "к атаке" : "к защите"}`);
      const take = document.createElement("button");
      take.type = "button";
      take.className = "action-button";
      take.textContent = "Забрать";
      take.disabled = busy || pending || !options.canTakeItem() ||
        (guild.role !== "leader" && (guild.role !== "officer" || guild.settings.withdrawal !== "officer"));
      take.addEventListener("click", () => invoke("guild_storage_take", {
        p_item_id: entry.id, p_request_id: requestId(),
      }, { kind: "item_take" }));
      line.append(take);
      panel.append(line);
    }
    $("guild-withdraw-button").disabled = busy || pending || !["leader", "officer"].includes(guild.role) ||
      (guild.role === "officer" && guild.settings.withdrawal !== "officer");
    $("guild-withdraw-button").title = getBuildings().treasury
      ? "Изъятие проходит без комиссии."
      : "Сначала требуется построить казну.";
    $("guild-withdraw-button").disabled ||= !getBuildings().treasury;
    $("guild-contribution-button").disabled = busy || pending;
  }

  function render() {
    const dialog = $("guild-dialog");
    const account = window.WellCloudSave.getCurrentUser();
    $("guild-empty").hidden = Boolean(guild);
    $("guild-membership").hidden = !guild;
    $("guild-open-button").disabled = !account;
    $("guild-open-button").title = account ? "Открыть гильдейский холл" : "Гильдии доступны после входа в облачный аккаунт.";
    if (!guild) return;
    $("guild-title").textContent = guild.name;
    $("guild-summary").textContent =
      `Уровень ${guild.guild_level} · репутация ${guild.reputation} · казна ${guild.treasury_gold} золота / ${guild.treasury_essence} осколков · ${guild.role === "leader" ? "глава" : guild.role === "officer" ? "офицер" : "участник"}`;
    $("guild-invite-code").textContent = guild.invitation?.code || "Выпусти код";
    $("guild-invite-expiry").textContent = guild.invitation?.expires_at
      ? `Код действует до ${new Date(guild.invitation.expires_at).toLocaleString("ru-RU")}` : "";
    $("guild-invite-button").disabled = busy || !["leader", "officer"].includes(guild.role);
    $("guild-level-button").disabled = busy || guild.role !== "leader";
    $("guild-disband-button").disabled = busy || guild.role !== "leader";
    $("guild-withdrawal").value = guild.settings?.withdrawal || "officer";
    $("guild-withdrawal").disabled = busy || guild.role !== "leader";
    $("guild-withdrawal-save").disabled = busy || guild.role !== "leader";
    $("guild-pending-retry").hidden = !pending;
    for (const button of document.querySelectorAll("[data-guild-tab]")) {
      button.setAttribute("aria-pressed", String(button.dataset.guildTab === tab));
    }
    $("guild-hall-content").hidden = tab !== "hall";
    $("guild-storage-content").hidden = tab !== "storage";
    $("guild-chat-pane").hidden = tab !== "chat";
    renderMembers();
    renderMessages();
    renderHall();
    renderWarehouse();
  }

  async function executePending() {
    if (!pending) return;
    const operation = pending;
    const result = await rpc(operation.action, operation.args);
    const nextGuild = result.guild?.guild || result.guild || null;
    if (operation.localChange && operation.localChange.kind !== "service") {
      await options.applyWalletChange(operation.localChange, operation.args.p_request_id, result);
    }
    if (operation.localChange?.kind === "service") {
      await options.applyHallReward(result, operation.args.p_request_id);
    }
    pending = null;
    window.localStorage.removeItem(REQUEST_KEY);
    if (nextGuild) guild = nextGuild;
    else if (operation.action === "guild_leave" || operation.action === "guild_disband") guild = null;
    render();
    setStatus("Изменение гильдии сохранено.");
  }

  async function invoke(action, args, localChange = null) {
    if (busy || pending) return;
    const request = { ...args, p_request_id: args.p_request_id || requestId() };
    try {
      savePending(action, request, localChange);
      busy = true;
      render();
      await executePending();
    } catch (error) {
      console.error("Не удалось выполнить операцию гильдии.", error);
      setStatus(`Не удалось подтвердить действие: ${error.message}. Повтори его с той же квитанцией.`, true);
    } finally {
      busy = false;
      render();
    }
  }

  async function perform(action) {
    if (busy || pending) return;
    busy = true;
    render();
    try {
      await action();
      setStatus("");
    } catch (error) {
      console.error("Не удалось обновить гильдию.", error);
      setStatus(error.message, true);
    } finally {
      busy = false;
      render();
    }
  }

  async function refresh() {
    if (refreshInFlight || !window.WellCloudSave.getCurrentUser()) return;
    refreshInFlight = true;
    try {
      const result = await rpc("guild_state");
      guild = result.guild || null;
      render();
    } catch (error) {
      setStatus(`Не удалось загрузить гильдию: ${error.message}`, true);
      console.error("Не удалось загрузить гильдию.", error);
    } finally {
      refreshInFlight = false;
    }
  }

  function availableContributions() {
    return [
      ["elite_trophy", "Элитный трофей · 1 репутация"],
      ["boards", "Доски"], ["blocks", "Каменные блоки"],
      ["cloth", "Ткань"], ["ingots", "Железные слитки"],
      ["gold", "Золото · комиссия 10%"], ["essence", "Осколки · комиссия 5%"],
      ["item", "Предмет из личного запаса"],
    ];
  }

  function contribute() {
    const kind = $("guild-contribution-kind").value;
    const amount = Number($("guild-contribution-amount").value);
    if (!Number.isSafeInteger(amount) || amount < 1) {
      setStatus("Укажи количество от 1.", true);
      return;
    }
    if (kind === "item") {
      const item = options.getItems().find((entry) => entry.id === $("guild-contribution-item").value);
      if (!item) {
        setStatus("Выбери предмет, который не экипирован и не подготовлен к спуску.", true);
        return;
      }
      invoke("guild_contribute", {
        p_kind: "item", p_amount: 1, p_balance: 1,
        p_item: { id: item.id, type: item.type, name: item.name, bonus: item.bonus },
      }, { kind: "item_deposit", itemId: item.id });
      return;
    }
    const wallet = options.getBalance(kind);
    if (!Number.isSafeInteger(wallet) || wallet < amount) {
      setStatus("В личном запасе недостаточно средств или материалов.", true);
      return;
    }
    if (kind === "gold" || kind === "essence") {
      invoke("guild_treasury_move", {
        p_kind: kind, p_amount: amount, p_direction: "deposit", p_wallet_balance: wallet,
      }, { kind, amount });
    } else {
      invoke("guild_contribute", {
        p_kind: kind, p_amount: amount, p_balance: wallet, p_item: null,
      }, { kind, amount });
    }
  }

  function createGuild() {
    perform(async () => {
      const nickname = options.getNickname();
      const result = await rpc("guild_create", {
        p_name: $("guild-create-name").value.trim(), p_nickname: nickname,
      });
      guild = result.guild || null;
      render();
      setStatus("Гильдия создана. Собирайте элитные трофеи и материалы; для строительства сначала требуется замок.");
    });
  }

  function joinGuild() {
    perform(async () => {
      const result = await rpc("guild_join", {
        p_code: $("guild-join-code").value.trim(),
        p_nickname: options.getNickname(),
      });
      guild = result.guild || null;
      $("guild-join-code").value = "";
      render();
    });
  }

  function sendChat(event) {
    event.preventDefault();
    const body = $("guild-chat-input").value.trim();
    if (!body || busy || pending) return;
    const id = requestId();
    invoke("guild_chat_send", { p_body: body, p_request_id: id });
    $("guild-chat-input").value = "";
  }

  function initialize(callbacks) {
    options = callbacks;
    $("guild-open-button").addEventListener("click", async () => {
      if (!$("guild-dialog").open) $("guild-dialog").showModal();
      await refresh();
    });
    $("guild-close-button").addEventListener("click", () => $("guild-dialog").close());
    $("guild-create-button").addEventListener("click", createGuild);
    $("guild-join-button").addEventListener("click", joinGuild);
    $("guild-invite-button").addEventListener("click", () => perform(async () => {
      const result = await rpc("guild_create_invite");
      guild = result.guild || null;
    }));
    $("guild-invite-copy").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(guild?.invitation?.code || "");
        setStatus("Код приглашения скопирован.");
      } catch (error) {
        setStatus(`Не удалось скопировать код: ${error.message}`, true);
      }
    });
    $("guild-level-button").addEventListener("click", () => invoke("guild_level_up", {
      p_request_id: requestId(),
    }));
    $("guild-disband-button").addEventListener("click", () => {
      if (window.confirm("Распустить гильдию? Замок, склад, казна и сообщения будут удалены.")) {
        perform(async () => {
          await rpc("guild_disband");
          guild = null;
        });
      }
    });
    $("guild-leave-button").addEventListener("click", () => {
      if (window.confirm("Покинуть гильдию?")) perform(async () => {
        await rpc("guild_leave");
        guild = null;
      });
    });
    $("guild-contribution-button").addEventListener("click", contribute);
    $("guild-withdrawal-save").addEventListener("click", () => perform(async () => {
      const result = await rpc("guild_settings_set", { p_withdrawal: $("guild-withdrawal").value });
      guild = result.guild || null;
    }));
    $("guild-chat-form").addEventListener("submit", sendChat);
    $("guild-pending-retry").addEventListener("click", () => perform(executePending));
    for (const button of document.querySelectorAll("[data-guild-tab]")) {
      button.addEventListener("click", () => {
        tab = button.dataset.guildTab;
        render();
      });
    }
    for (const [value, label] of availableContributions()) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      $("guild-contribution-kind").append(option);
    }
    $("guild-contribution-kind").addEventListener("change", () => {
      const kind = $("guild-contribution-kind").value;
      const balance = options.getBalance(kind);
      const itemSelect = $("guild-contribution-item");
      const isItem = kind === "item";
      itemSelect.hidden = !isItem;
      $("guild-contribution-amount").hidden = isItem;
      itemSelect.replaceChildren();
      if (isItem) {
        const items = options.getItems();
        for (const item of items) {
          const option = document.createElement("option");
          option.value = item.id;
          option.textContent = item.label;
          itemSelect.append(option);
        }
        if (!items.length) {
          const option = document.createElement("option");
          option.value = "";
          option.textContent = "Нет свободных предметов";
          itemSelect.append(option);
        }
        $("guild-contribution-button").disabled = busy || pending || !items.length;
      } else {
        $("guild-contribution-amount").max = String(balance);
        $("guild-contribution-amount").value = balance ? "1" : "0";
        $("guild-contribution-button").disabled = busy || pending;
      }
    });
    $("guild-withdraw-button").addEventListener("click", () => {
      const kind = $("guild-withdraw-kind").value;
      const amount = Number($("guild-withdraw-amount").value);
      if (!Number.isSafeInteger(amount) || amount < 1) {
        setStatus("Укажи количество от 1.", true);
        return;
      }
      invoke("guild_treasury_move", {
        p_kind: kind, p_amount: amount, p_direction: "withdraw",
        p_wallet_balance: options.getBalance(kind), p_request_id: requestId(),
      }, { kind: `withdraw_${kind}`, amount });
    });
    $("guild-dialog").addEventListener("close", () => {
      guild = guild || null;
    });
    window.WellCloudSave.onAuthChange(() => {
      guild = null;
      refresh();
      render();
    });
    try {
      pending = JSON.parse(window.localStorage.getItem(REQUEST_KEY) || "null");
    } catch (error) {
      setStatus(`Не удалось прочитать незавершённый запрос гильдии: ${error.message}`, true);
      console.error("Повреждённая квитанция гильдии.", error);
    }
    window.setInterval(() => {
      if ($("guild-dialog").open) refresh();
    }, 12000);
    render();
  }

  window.WellGuild = {
    initialize,
    getGuild: () => guild,
    isGuildmate(userId) {
      return Boolean(userId && guild?.members?.some((member) => member.user_id === userId));
    },
    refresh,
    isReady: () => Boolean(options),
  };
})();
