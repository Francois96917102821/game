"use strict";

// Server-authoritative guild treasury: server gold balance, guild patrol expeditions
// and gold transfers. Local (save-file) gold is only displayed, never converted.
(() => {
  const START_PREFIX = "well-of-whispers-guild-expedition-start:";
  const TRANSFER_PREFIX = "well-of-whispers-guild-transfer:";
  const ROUTE = "guild_patrol";
  const MIN_TRANSFER = 100;
  const MAX_TRANSFER = 1_000_000_000_000;
  const GOLD_FEE_BASIS_POINTS = 1000;
  const DAY_MS = 86_400_000;
  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const SERVER_MESSAGES = new Map([
    ["Authentication required.", "Войди в облачный аккаунт."],
    ["Request UUID required.", "Не удалось сформировать ключ запроса. Обнови страницу."],
    ["Request UUID was already used with a different payload.", "Ключ запроса уже использован для другого маршрута. Обнови страницу и попробуй снова."],
    ["Unknown expedition route.", "Неизвестный маршрут экспедиции."],
    ["Claim the previous expedition first.", "Сначала забери награду за предыдущую экспедицию: одновременно доступна только одна незабранная."],
    ["Daily expedition limit reached.", "Дневной лимит исчерпан: не более трёх экспедиций за календарные сутки UTC."],
    ["Expedition not found.", "Экспедиция не найдена на сервере."],
    ["Expedition is not ready.", "Экспедиция ещё не вернулась. Награду можно забрать после окончания таймера."],
  ]);

  const $ = (id) => document.getElementById(id);
  let ui = null;
  let options = null;
  let user = null;
  let snapshot = null;
  let busy = false;
  let schemaMissing = false;
  let message = "";
  let messageIsError = false;
  let reward = null;
  let transferDraft = null;
  let transferResult = "";
  let transferResultIsError = false;
  let timer = 0;
  let refreshGeneration = 0;

  function monotonic() {
    return window.performance.now();
  }

  function newUuid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  function formatGold(value) {
    return Number.isFinite(value) ? `${value.toLocaleString("ru-RU")} золота` : "—";
  }

  function formatDuration(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const parts = [];
    if (hours) parts.push(`${hours} ч`);
    if (hours || minutes) parts.push(`${minutes} мин`);
    parts.push(`${seconds} с`);
    return parts.join(" ");
  }

  function storageKey(prefix) {
    return user?.id ? `${prefix}${user.id}` : null;
  }

  function loadPending(prefix) {
    const key = storageKey(prefix);
    if (!key) return null;
    try {
      const value = JSON.parse(window.localStorage.getItem(key) || "null");
      return value && typeof value === "object" && UUID_PATTERN.test(value.requestId) ? value : null;
    } catch (error) {
      console.warn("Не удалось прочитать неподтверждённый серверный запрос.", error);
      return null;
    }
  }

  function savePending(prefix, value) {
    const key = storageKey(prefix);
    if (!key) throw new Error("Войди в облачный аккаунт.");
    if (value) window.localStorage.setItem(key, JSON.stringify(value));
    else window.localStorage.removeItem(key);
  }

  function isConfigured() {
    try {
      return Boolean(options?.isConfigured());
    } catch {
      return false;
    }
  }

  function isOffline() {
    return window.navigator.onLine === false;
  }

  function isSchemaError(error) {
    return error?.status === 404 || /PGRST202|could not find the function/i.test(`${error?.code || ""} ${error?.message || ""}`);
  }

  // Only an explicit PostgREST rejection (raised exception, HTTP 400) proves nothing was
  // recorded. Network failures, 5xx, auth or rate-limit errors keep the same request UUID.
  function isDefinitiveRejection(error) {
    return !error?.network && (error?.status === 400 || error?.code === "P0001");
  }

  function translateError(error) {
    if (error?.network || isOffline()) {
      return "Нет связи с сервером. Повтори действие, когда сеть вернётся: повтор безопасен, сервер не выполнит один запрос дважды.";
    }
    if (isSchemaError(error)) {
      return "На сервере не применена схема казны и экспедиций. Владелец игры должен выполнить обновлённый supabase/schema.sql.";
    }
    const text = String(error?.message || "").trim();
    if (SERVER_MESSAGES.has(text)) {
      if (text === "Daily expedition limit reached." && snapshot) {
        const now = serverNow();
        const nextDay = Math.floor(now / DAY_MS) * DAY_MS + DAY_MS;
        return `${SERVER_MESSAGES.get(text)} Следующий старт — после 00:00 UTC, примерно через ${formatDuration(nextDay - now)}.`;
      }
      return SERVER_MESSAGES.get(text);
    }
    if (/jwt|401|token/i.test(text)) return "Сессия облачного аккаунта истекла. Войди снова.";
    if (/[а-яё]/i.test(text)) return text;
    return `Сервер отклонил запрос: ${text || "неизвестная ошибка"}.`;
  }

  function setMessage(text, isError = false) {
    message = text;
    messageIsError = isError;
  }

  function serverNow() {
    return snapshot ? snapshot.serverNowMs + (monotonic() - snapshot.monotonicAt) : NaN;
  }

  function parseTime(value) {
    const time = typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(time) ? time : NaN;
  }

  function normalizeExpedition(raw) {
    if (!raw || typeof raw !== "object" || !UUID_PATTERN.test(raw.id)) return null;
    if (raw.status === "claimed") {
      return {
        id: raw.id, status: "claimed", claimedAt: parseTime(raw.claimed_at),
        gold: Number.isSafeInteger(raw.gold) ? raw.gold : null,
      };
    }
    const startedAt = parseTime(raw.started_at);
    const readyAt = parseTime(raw.ready_at);
    if (!Number.isFinite(startedAt) || !Number.isFinite(readyAt)) return null;
    return { id: raw.id, status: "running", startedAt, readyAt };
  }

  // Claim responses may carry an optional server-issued item ({item_id, gear}); older ones omit it.
  function describeItem(item) {
    const gear = item && typeof item === "object" ? item.gear : null;
    if (!gear || typeof gear.name !== "string" || !gear.name.trim()) return null;
    const bonus = Number.isSafeInteger(gear.bonus) && gear.bonus > 0 ? ` +${gear.bonus}` : "";
    return `«${gear.name.trim().slice(0, 60)}»${bonus}`;
  }

  function readGold(balances) {
    const gold = Number(balances?.gold);
    return Number.isSafeInteger(gold) && gold >= 0 ? gold : null;
  }

  function activeExpedition() {
    return snapshot?.expeditions.find((expedition) => expedition.status !== "claimed") || null;
  }

  async function callRpc(name, args) {
    const before = monotonic();
    const result = await options.rpc(name, args);
    return { result, monotonicAt: (before + monotonic()) / 2 };
  }

  async function refresh() {
    if (!ui || !isConfigured() || !user) {
      render();
      return;
    }
    const generation = ++refreshGeneration;
    const userId = user.id;
    try {
      const { result, monotonicAt } = await callRpc("guild_expedition_get_owned", {});
      if (generation !== refreshGeneration || user?.id !== userId) return;
      const serverNowMs = parseTime(result?.server_now);
      if (!Number.isFinite(serverNowMs) || !Array.isArray(result?.expeditions)) {
        throw new Error("Сервер вернул неожиданный ответ казны.");
      }
      snapshot = {
        serverNowMs,
        monotonicAt,
        gold: readGold(result.balances),
        expeditions: result.expeditions.map(normalizeExpedition).filter(Boolean),
      };
      schemaMissing = false;
      if (messageIsError && !loadPending(START_PREFIX)) setMessage("");
    } catch (error) {
      if (generation !== refreshGeneration) return;
      schemaMissing = isSchemaError(error);
      setMessage(snapshot && (error.network || isOffline())
        ? "Нет связи с сервером — показаны последние полученные данные."
        : translateError(error), true);
      console.error("Не удалось обновить серверную казну.", error);
    } finally {
      render();
    }
  }

  async function perform(work) {
    if (busy) return;
    busy = true;
    render();
    try {
      await work();
    } catch (error) {
      if (isSchemaError(error)) schemaMissing = true;
      setMessage(translateError(error), true);
      console.error("Ошибка серверной казны.", error);
    } finally {
      busy = false;
      render();
    }
  }

  function startExpedition() {
    if (!user || !isConfigured() || busy) return Promise.resolve();
    return perform(async () => {
      let pending = loadPending(START_PREFIX);
      if (!pending) {
        pending = { requestId: newUuid(), route: ROUTE, createdAt: new Date().toISOString() };
        savePending(START_PREFIX, pending);
      }
      let response;
      try {
        ({ result: response } = await callRpc("guild_expedition_start", {
          p_request_id: pending.requestId,
          p_route: pending.route,
        }));
      } catch (error) {
        if (isDefinitiveRejection(error)) savePending(START_PREFIX, null);
        throw error;
      }
      const expedition = normalizeExpedition(response);
      if (!expedition) throw new Error("Сервер вернул неожиданный ответ на старт экспедиции.");
      savePending(START_PREFIX, null);
      reward = null;
      if (snapshot) {
        snapshot.expeditions = [
          ...snapshot.expeditions.filter((item) => item.id !== expedition.id), expedition,
        ];
      }
      setMessage(expedition.status === "claimed"
        ? "Этот запрос уже был выполнен ранее; награда за него получена."
        : "Отряд отправлен в патруль. Таймер идёт по серверному времени.");
      await refresh();
    });
  }

  function claimExpedition() {
    const expedition = activeExpedition();
    if (!expedition || busy) return Promise.resolve();
    return perform(async () => {
      const { result } = await callRpc("guild_expedition_claim", { p_expedition_id: expedition.id });
      if (result?.status !== "claimed" || result.id !== expedition.id || !Number.isSafeInteger(result.gold)) {
        throw new Error("Сервер вернул неожиданный ответ на получение награды.");
      }
      reward = { id: result.id, gold: result.gold, item: describeItem(result.item) };
      const claimed = normalizeExpedition(result);
      snapshot.expeditions = snapshot.expeditions.map((item) => item.id === claimed.id ? claimed : item);
      const gold = readGold(result.balances);
      if (gold !== null) snapshot.gold = gold;
      const itemText = reward.item ? ` и предмет ${reward.item}` : "";
      setMessage(`Награда сервера: ${formatGold(result.gold)}${itemText} зачислено в серверную казну.`);
      await refresh();
    });
  }

  function transferFee(amount) {
    return Math.floor((amount * GOLD_FEE_BASIS_POINTS) / 10000);
  }

  function reviewTransfer(event) {
    event?.preventDefault();
    if (busy || loadPending(TRANSFER_PREFIX)) return;
    const recipient = ui.recipient.value.trim().toLowerCase();
    const amount = Number(ui.amount.value);
    let error = "";
    if (!UUID_PATTERN.test(recipient)) error = "Укажи ID аккаунта получателя — 36 символов в формате UUID.";
    else if (recipient === user?.id) error = "Нельзя перевести золото самому себе.";
    else if (!Number.isSafeInteger(amount) || amount < MIN_TRANSFER || amount > MAX_TRANSFER) {
      error = `Сумма — целое число от ${MIN_TRANSFER} до 1 000 000 000 000.`;
    } else if (snapshot?.gold !== null && snapshot?.gold !== undefined && amount > snapshot.gold) {
      error = "Недостаточно серверного золота.";
    }
    if (error) {
      transferResult = error;
      transferResultIsError = true;
      render();
      (UUID_PATTERN.test(recipient) && recipient !== user?.id ? ui.amount : ui.recipient).focus();
      return;
    }
    transferDraft = { recipient, amount };
    transferResult = "";
    render();
    ui.sendTransfer.focus();
  }

  function cancelTransfer() {
    transferDraft = null;
    render();
    ui.reviewTransfer.focus();
  }

  function sendTransfer() {
    if (busy || !user) return Promise.resolve();
    let pending = loadPending(TRANSFER_PREFIX);
    if (!pending) {
      if (!transferDraft) return Promise.resolve();
      pending = {
        requestId: newUuid(), currency: "gold",
        recipient: transferDraft.recipient, amount: transferDraft.amount,
      };
      savePending(TRANSFER_PREFIX, pending);
    }
    transferDraft = null;
    return perform(async () => {
      let result;
      try {
        ({ result } = await callRpc("wallet_transfer", {
          p_currency: pending.currency,
          p_recipient_id: pending.recipient,
          p_amount: pending.amount,
          p_request_id: pending.requestId,
        }));
      } catch (error) {
        if (isDefinitiveRejection(error)) {
          savePending(TRANSFER_PREFIX, null);
          transferResult = `Перевод отклонён: ${translateError(error)}`;
        } else {
          transferResult = `Ответ сервера не получен: ${translateError(error)} Повтор отправит тот же ключ и не спишет золото дважды.`;
        }
        transferResultIsError = true;
        render();
        return;
      }
      savePending(TRANSFER_PREFIX, null);
      const balance = readGold({ gold: result?.balance });
      if (snapshot && balance !== null) snapshot.gold = balance;
      transferResult = `Перевод подтверждён сервером: списано ${formatGold(result?.amount)}, комиссия ${formatGold(result?.fee)}, получатель получил ${formatGold(result?.received)}.`;
      transferResultIsError = false;
      ui.amount.value = "";
      await refresh();
    });
  }

  function forgetTransfer() {
    if (busy || !loadPending(TRANSFER_PREFIX)) return;
    if (!window.confirm("Забыть неподтверждённый перевод? Он мог уже выполниться на сервере — сначала обнови баланс. Новый перевод получит другой ключ и может списать золото повторно.")) return;
    savePending(TRANSFER_PREFIX, null);
    transferResult = "Неподтверждённый перевод забыт. Проверь серверный баланс перед новой отправкой.";
    transferResultIsError = false;
    render();
  }

  async function copyOwnId() {
    if (!user?.id) return;
    try {
      await window.navigator.clipboard.writeText(user.id);
      transferResult = "ID скопирован. Передай его игроку, который хочет отправить тебе золото.";
      transferResultIsError = false;
    } catch {
      ui.ownId.select();
      transferResult = "Не удалось скопировать автоматически — ID выделен, скопируй его вручную.";
      transferResultIsError = true;
    }
    render();
  }

  function renderLocalGold() {
    const local = options?.getLocalGold?.() || {};
    const tavern = Number.isFinite(local.tavern) ? local.tavern : 0;
    ui.localGold.textContent = formatGold(tavern);
    ui.localDetail.textContent = Number.isFinite(local.run)
      ? `Постоянное золото таверны; ещё ${formatGold(local.run)} в текущем спуске. Хранится в этом браузере, не переводится в серверную казну.`
      : "Постоянное золото таверны. Хранится в этом браузере, не переводится в серверную казну.";
  }

  function render() {
    if (!ui) return;
    renderLocalGold();
    const configured = isConfigured();
    const offline = isOffline();
    const pendingStart = user ? loadPending(START_PREFIX) : null;
    const pendingTransfer = user ? loadPending(TRANSFER_PREFIX) : null;
    const active = activeExpedition();
    const now = serverNow();
    const ready = Boolean(active && Number.isFinite(now) && now >= active.readyAt);

    let status = message;
    let statusIsError = messageIsError;
    if (!configured) {
      status = "Облако не настроено: серверная казна недоступна. Локальная игра и её золото работают как обычно.";
      statusIsError = false;
    } else if (!user) {
      status = "Войди в облачный аккаунт, чтобы видеть серверное золото и отправлять экспедиции. Локальная игра работает без входа.";
      statusIsError = false;
    } else if (offline && !message) {
      status = snapshot
        ? "Нет сети — показаны последние полученные данные. Действия станут доступны после подключения."
        : "Нет сети. Серверная казна загрузится после подключения; локальная игра продолжает работать.";
      statusIsError = true;
    } else if (busy && !status) {
      status = "Связываюсь с сервером…";
    } else if (!snapshot && !status) {
      status = "Загружаю серверную казну…";
    }
    ui.status.textContent = status;
    ui.status.classList.toggle("treasury-error", Boolean(statusIsError));
    ui.authActions.hidden = !configured || Boolean(user);

    const online = configured && Boolean(user) && !schemaMissing;
    ui.serverGold.textContent = online && snapshot?.gold !== null && snapshot?.gold !== undefined
      ? formatGold(snapshot.gold) : "—";

    if (!online || !snapshot) {
      ui.timer.textContent = online && pendingStart
        ? "Есть неподтверждённая отправка экспедиции — её можно повторить с тем же ключом."
        : "Серверные данные недоступны.";
    } else if (!active) {
      ui.timer.textContent = "Отряд в гильдии. Можно отправить новую экспедицию.";
    } else if (ready) {
      ui.timer.textContent = "Экспедиция вернулась! Забери награду.";
    } else {
      ui.timer.textContent = `В пути: вернётся через ${formatDuration(active.readyAt - now)} (по серверному времени).`;
    }
    ui.reward.hidden = !reward;
    ui.reward.textContent = reward
      ? `Последняя награда сервера: ${formatGold(reward.gold)}${reward.item ? ` и предмет ${reward.item} (в серверном реестре)` : ""}.`
      : "";

    const canAct = online && !busy && !offline;
    ui.start.disabled = !canAct || (!pendingStart && (!snapshot || Boolean(active)));
    ui.start.textContent = pendingStart ? "Повторить отправку (тот же запрос)" : "Отправить экспедицию";
    ui.claim.disabled = !canAct || !ready;
    ui.refresh.disabled = !configured || !user || busy;

    ui.ownId.value = user?.id || "";
    ui.copyId.disabled = !user;
    const formDisabled = !canAct || !snapshot || Boolean(pendingTransfer);
    for (const control of [ui.recipient, ui.amount, ui.reviewTransfer]) control.disabled = formDisabled;
    ui.confirm.hidden = !transferDraft || Boolean(pendingTransfer);
    if (transferDraft) {
      const fee = transferFee(transferDraft.amount);
      ui.confirmText.textContent = `Отправить ${formatGold(transferDraft.amount)} аккаунту ${transferDraft.recipient}? ` +
        `Комиссия казны ${formatGold(fee)}, получатель получит ${formatGold(transferDraft.amount - fee)}. Отменить перевод после подтверждения нельзя.`;
    }
    ui.sendTransfer.disabled = !canAct;
    ui.pendingTransfer.hidden = !pendingTransfer;
    if (pendingTransfer) {
      ui.pendingText.textContent = `Перевод ${formatGold(pendingTransfer.amount)} аккаунту ${pendingTransfer.recipient} не подтверждён сервером. ` +
        "Повтор использует тот же ключ запроса: золото не будет списано дважды.";
    }
    ui.retryTransfer.disabled = !online || busy || offline;
    ui.forgetTransfer.disabled = busy;
    ui.transferResult.textContent = transferResult;
    ui.transferResult.classList.toggle("treasury-error", transferResultIsError);
  }

  function tick() {
    if (!ui.dialog.open) return;
    render();
  }

  function open() {
    if (!ui) return Promise.resolve();
    syncUser();
    if (!ui.dialog.open) ui.dialog.showModal();
    render();
    window.clearInterval(timer);
    timer = window.setInterval(tick, 1000);
    return refresh();
  }

  function close() {
    if (ui?.dialog.open) ui.dialog.close();
  }

  function setUser(nextUser, quiet = false) {
    const nextId = nextUser?.id || null;
    if (nextId === (user?.id || null)) return;
    user = nextUser && nextId ? { id: nextId } : null;
    snapshot = null;
    reward = null;
    transferDraft = null;
    transferResult = "";
    schemaMissing = false;
    setMessage("");
    refreshGeneration += 1;
    if (quiet) return;
    if (ui?.dialog.open) refresh();
    else render();
  }

  function syncUser() {
    try {
      if (options?.getUser) setUser(options.getUser(), true);
    } catch (error) {
      console.warn("Не удалось прочитать облачный аккаунт для казны.", error);
    }
  }

  function initialize(config) {
    options = config;
    ui = {
      dialog: $("treasury-dialog"),
      status: $("treasury-status"),
      authActions: $("treasury-auth-actions"),
      signIn: $("treasury-signin-button"),
      serverGold: $("treasury-server-gold"),
      localGold: $("treasury-local-gold"),
      localDetail: $("treasury-local-detail"),
      timer: $("treasury-timer"),
      reward: $("treasury-reward"),
      start: $("treasury-start-button"),
      claim: $("treasury-claim-button"),
      refresh: $("treasury-refresh-button"),
      ownId: $("treasury-own-id"),
      copyId: $("treasury-copy-id-button"),
      form: $("treasury-transfer-form"),
      recipient: $("treasury-recipient"),
      amount: $("treasury-amount"),
      reviewTransfer: $("treasury-review-button"),
      confirm: $("treasury-confirm"),
      confirmText: $("treasury-confirm-text"),
      sendTransfer: $("treasury-send-button"),
      cancelTransfer: $("treasury-cancel-button"),
      pendingTransfer: $("treasury-pending-transfer"),
      pendingText: $("treasury-pending-text"),
      retryTransfer: $("treasury-retry-transfer-button"),
      forgetTransfer: $("treasury-forget-transfer-button"),
      transferResult: $("treasury-transfer-result"),
      returnButton: $("treasury-return-button"),
    };
    ui.start.addEventListener("click", startExpedition);
    ui.claim.addEventListener("click", claimExpedition);
    ui.refresh.addEventListener("click", () => {
      setMessage("");
      syncUser();
      refresh();
    });
    ui.signIn.addEventListener("click", () => options.openCloud?.());
    ui.copyId.addEventListener("click", copyOwnId);
    ui.form.addEventListener("submit", reviewTransfer);
    ui.sendTransfer.addEventListener("click", sendTransfer);
    ui.cancelTransfer.addEventListener("click", cancelTransfer);
    ui.retryTransfer.addEventListener("click", sendTransfer);
    ui.forgetTransfer.addEventListener("click", forgetTransfer);
    ui.returnButton.addEventListener("click", close);
    ui.dialog.addEventListener("close", () => {
      window.clearInterval(timer);
      timer = 0;
      options.onClose?.();
    });
    window.addEventListener("online", () => {
      if (ui.dialog.open) refresh();
    });
    window.addEventListener("offline", render);
    options.onAuthChange?.(setUser);
    render();
  }

  window.WellGuildTreasury = {
    initialize,
    open,
    close,
    refresh,
    startExpedition,
    claimExpedition,
    render,
    isReady: () => Boolean(ui),
    isOpen: () => Boolean(ui?.dialog.open),
  };
})();
