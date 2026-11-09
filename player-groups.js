"use strict";

(() => {
  const NOTIFICATIONS_KEY = "well-of-whispers-group-notifications";
  const ESSENCE_PROGRESS_PREFIX = "well-of-whispers-group-essence-progress:";
  const SHARE_REMAINDER_PREFIX = "well-of-whispers-group-share-remainder:";
  const PENDING_SHARES_PREFIX = "well-of-whispers-pending-group-shares:";
  const PENDING_INBOX_PREFIX = "well-of-whispers-pending-group-inbox:";
  const PENDING_BATTLE_INVITE_PREFIX = "well-of-whispers-pending-battle-invite:";
  const ACTIVE_BATTLE_PREFIX = "well-of-whispers-active-group-battle:";
  const PENDING_BATTLE_ACTION_PREFIX = "well-of-whispers-pending-group-battle-action:";
  const HANDLED_HINTS_PREFIX = "well-of-whispers-handled-group-hints:";
  const HEARTBEAT_INTERVAL = 25_000;
  const PRESENCE_TTL = 75_000;
  const $ = (id) => document.getElementById(id);
  const ui = {
    open: $("group-open-button"),
    dialog: $("group-dialog"),
    status: $("group-status"),
    nickname: $("group-nickname"),
    create: $("group-create-button"),
    acceptCode: $("group-accept-code"),
    accept: $("group-accept-button"),
    empty: $("group-empty-panel"),
    roster: $("group-roster-panel"),
    members: $("group-members"),
    activity: $("group-activity"),
    invite: $("group-invite-button"),
    inviteCode: $("group-invite-code"),
    inviteExpiry: $("group-invite-expiry"),
    copyInvite: $("group-copy-invite-button"),
    disband: $("group-disband-button"),
    notifications: $("group-notifications"),
    toast: $("group-notice"),
    toastText: $("group-notice-text"),
    battleInviteButton: $("group-battle-invite-button"),
  };

  let options = null;
  let user = null;
  let group = null;
  let invite = null;
  let playerState = { level: 1, inDungeon: false };
  let busy = false;
  let lastHeartbeatAt = 0;
  let groupStateReceivedAt = 0;
  let heartbeatInFlight = false;
  let heartbeatRequested = false;
  let lastHeartbeatLevel = null;
  let lastHeartbeatDungeon = null;
  const sharesInFlight = new Set();
  const sharesFlushRequested = new Set();
  const inboxInFlight = new Map();
  let lastPartnerActivity = null;
  let toastTimer = 0;
  let battle = null;
  let battleInvite = null;
  let battlePollTimer = 0;
  let battlePollInFlight = false;
  let battleActionInFlight = false;
  let pendingBattleAction = null;

  function notificationsEnabled() {
    try {
      return window.localStorage.getItem(NOTIFICATIONS_KEY) !== "false";
    } catch (error) {
      console.warn("Не удалось прочитать настройку уведомлений групп.", error);
      return true;
    }
  }

  function savePendingBattleAction(operation) {
    try {
      const key = `${PENDING_BATTLE_ACTION_PREFIX}${operation?.userId || user?.id}`;
      if (operation) window.localStorage.setItem(key, JSON.stringify(operation));
      else if (user) window.localStorage.removeItem(key);
      pendingBattleAction = operation;
      return true;
    } catch (error) {
      pendingBattleAction = null;
      console.error("Не удалось сохранить незавершённый ход совместного боя.", error);
      setStatus(operation
        ? "Не удалось сохранить ход для безопасного повтора; действие не отправлено."
        : "Сервер уже принял ход, но локальный ключ повтора не удалён; повтор будет безопасным.", true);
      return false;
    }
  }

  function readPendingBattleAction(userId) {
    if (!userId) return null;
    try {
      const saved = JSON.parse(window.localStorage.getItem(`${PENDING_BATTLE_ACTION_PREFIX}${userId}`) || "null");
      if (saved === null) return null;
      if (saved.userId !== userId || typeof saved.battleId !== "string" ||
        !Number.isInteger(saved.round) || saved.round < 1 ||
        !["attack", "heavy", "potion", "guard"].includes(saved.action) ||
        typeof saved.requestId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(saved.requestId)) {
        throw new Error("Сохранённый ход совместного боя имеет неверный формат.");
      }
      return saved;
    } catch (error) {
      console.error("Не удалось восстановить незавершённый ход совместного боя.", error);
      setStatus("Не удалось восстановить незавершённый ход совместного боя.", true);
      return null;
    }
  }

  function refundPendingShares(groupId) {
    const pending = loadPendingShares();
    const rejected = pending.filter((share) => share.groupId === groupId);
    if (!rejected.length) return 0;
    savePendingShares(pending.filter((share) => share.groupId !== groupId));
    for (const share of rejected) options.onUnsharedReward(share.kind, share.fallback || 0);
    return rejected.length;
  }

  function setStatus(message, isError = false) {
    ui.status.textContent = message;
    ui.status.classList.toggle("group-error", isError);
  }

  function getNickname() {
    const entered = ui.nickname.value.trim();
    if (entered) return entered.slice(0, 24);
    const fallback = user?.email?.split("@")[0]?.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
    return fallback || "Искатель";
  }

  function groupRatio() {
    const levels = group?.members?.map((member) => Number(member.level)) || [];
    if (levels.length !== 2 || levels.some((level) => !Number.isInteger(level) || level < 1)) return Infinity;
    return Math.max(...levels) / Math.min(...levels);
  }

  function hasFreshGroupState() {
    return Boolean(group && groupStateReceivedAt && Date.now() - groupStateReceivedAt < PRESENCE_TTL);
  }

  function isGroupActive() {
    if (!user || !group || !hasFreshGroupState() || group.members?.length !== 2 || groupRatio() >= 3) return false;
    const own = group.members.find((member) => member.user_id === user.id);
    return Boolean(own?.in_dungeon && playerState.inDungeon && group.members.every((member) => member.in_dungeon));
  }

  function showNotice(message, force = false) {
    if (!force && !notificationsEnabled()) return;
    ui.toastText.textContent = message;
    ui.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      ui.toast.hidden = Boolean(battleInvite);
    }, 6000);
  }

  function getBattlePlayer() {
    const player = options?.getBattlePlayer?.();
    if (!player || !Number.isInteger(player.hp) || !Number.isInteger(player.max_hp) ||
      !Number.isInteger(player.potions) || !Number.isInteger(player.attack) ||
      !Number.isInteger(player.defense) || !Number.isInteger(player.focus) ||
      !Number.isFinite(player.heavy_multiplier)) {
      throw new Error("Не удалось получить показатели искателя для совместного боя.");
    }
    return player;
  }

  function saveActiveBattleId(battleId, groupId) {
    try {
      window.localStorage.setItem(`${ACTIVE_BATTLE_PREFIX}${user?.id}`, JSON.stringify({ battleId, groupId }));
    } catch (error) {
      console.error("Не удалось сохранить совместный бой.", error);
      setStatus("Не удалось сохранить ссылку на совместный бой; не закрывай эту вкладку до конца боя.", true);
    }
  }

  function clearPendingBattleInvite() {
    battleInvite = null;
    try {
      if (user) window.localStorage.removeItem(`${PENDING_BATTLE_INVITE_PREFIX}${user.id}`);
    } catch (error) {
      console.warn("Не удалось удалить обработанное приглашение в бой.", error);
    }
    renderBattleInvite();
  }

  function renderBattleInvite() {
    const visible = Boolean(battleInvite && battleInvite.group_id === group?.id && playerState.inDungeon);
    ui.battleInviteButton.hidden = !visible;
  }

  function formatBattleLogItem(item, players) {
    const participant = players.find((entry) => entry.user_id === item.user_id);
    const target = players.find((entry) => entry.user_id === item.target_id);
    const name = participant?.nickname || "Игрок";
    const targetName = target?.nickname || "игрока";
    if (item.type === "player" && item.action === "attack") return `${name} нанёс ${item.damage} урона!`;
    if (item.type === "player" && item.action === "heavy") return `${name} нанёс сокрушительный удар на ${item.damage} урона!`;
    if (item.type === "player" && item.action === "potion") return `${name} выпил зелье и восстановил ${item.healing} здоровья.`;
    if (item.type === "player" && item.action === "guard") return `${name} приготовился защищаться.`;
    if (item.type === "boss") return `Страж атакует ${targetName} на ${item.damage} урона!`;
    return item.text || "";
  }

  function renderBattleControls() {
    const panel = $("coop-battle-panel");
    panel.hidden = !battle || !["waiting", "active", "victory", "defeat"].includes(battle.status);
    $("coop-start-button").hidden = !canStartBattle() || Boolean(battle && ["waiting", "active"].includes(battle.status));
    if (!battle) return;

    const own = battle.players?.find((player) => player.user_id === user?.id);
    const boss = battle.boss || {};
    $("coop-boss-name").textContent = boss.name || "Страж";
    $("coop-boss-icon").textContent = boss.icon || "☠";
    $("coop-boss-hp").textContent = `${boss.hp ?? 0} / ${boss.max_hp ?? 0}`;
    $("coop-boss-health").style.width = `${boss.max_hp ? Math.max(0, boss.hp / boss.max_hp * 100) : 0}%`;
    const members = $("coop-players");
    members.replaceChildren();
    for (const player of battle.players || []) {
      const card = document.createElement("div");
      card.className = `coop-player-card${player.user_id === user?.id ? " own-player" : ""}`;
      const avatar = document.createElement("span");
      avatar.className = "coop-player-avatar";
      avatar.textContent = (player.nickname || "?").trim().slice(0, 1).toLocaleUpperCase("ru-RU");
      const heading = document.createElement("div");
      heading.className = "coop-card-heading";
      const nickname = document.createElement("strong");
      nickname.textContent = `${player.nickname}${player.user_id === user?.id ? " · ты" : ""}`;
      const health = document.createElement("span");
      health.textContent = `${player.hp} / ${player.max_hp}`;
      heading.append(nickname, health);
      const meter = document.createElement("div");
      meter.className = "meter health-meter";
      const fill = document.createElement("span");
      fill.style.width = `${player.max_hp ? Math.max(0, player.hp / player.max_hp * 100) : 0}%`;
      meter.append(fill);
      const resources = document.createElement("small");
      resources.textContent = `Зелья: ${player.potions} · запас силы: ${player.focus} / 3`;
      const turn = document.createElement("small");
      turn.textContent = player.acted ? "Ход сделан" : battle.status === "active" ? "Ждёт хода" : "Подключается";
      card.append(avatar, heading, meter, resources, turn);
      members.append(card);
    }

    const statusMessage = $("coop-turn-message");
    if (battle.status === "waiting") {
      statusMessage.textContent = "Ждём напарника — он получил приглашение в бой.";
    } else if (battle.status === "victory") {
      statusMessage.textContent = "Победа! Оба искателя могут спускаться глубже.";
    } else if (battle.status === "defeat") {
      statusMessage.textContent = "Отряд пал. Совместный бой завершён.";
    } else if (battle.status === "abandoned") {
      statusMessage.textContent = "Бой покинут.";
    } else if (own?.acted) {
      statusMessage.textContent = "Ты уже походил. Ждём напарника — после его хода ответит страж.";
    } else {
      statusMessage.textContent = `Раунд ${battle.round} · твой ход! Напарник тоже должен походить, затем атакует страж.`;
    }

    const log = $("coop-log");
    log.replaceChildren();
    for (const item of (battle.action_log || []).slice(-18)) {
      const row = document.createElement("p");
      row.textContent = formatBattleLogItem(item, battle.players || []);
      log.append(row);
    }
    log.scrollTop = log.scrollHeight;
    const canAct = battle.status === "active" && own && own.hp > 0 && !own.acted &&
      !battleActionInFlight && !pendingBattleAction;
    for (const id of ["coop-attack-button", "coop-heavy-button", "coop-potion-button", "coop-guard-button"]) {
      $(id).disabled = !canAct;
    }
    $("coop-heavy-button").disabled = !canAct || (own?.focus || 0) < 2;
    $("coop-potion-button").textContent = `⚗ Выпить зелье · ${own?.potions ?? 0}`;
    $("coop-potion-button").disabled = !canAct || !own?.potions || own.hp >= own.max_hp;
    $("coop-leave-button").hidden = !["waiting", "active"].includes(battle.status);
    $("coop-retry-button").hidden = !pendingBattleAction;
    $("coop-retry-button").disabled = battleActionInFlight || pendingBattleAction?.userId !== user?.id ||
      pendingBattleAction?.battleId !== battle.id;
  }

  function setBattle(nextBattle) {
    if (pendingBattleAction?.battleId === nextBattle?.id) {
      const own = nextBattle.players?.find((player) => player.user_id === pendingBattleAction.userId);
      if (nextBattle.status !== "active" || nextBattle.round > pendingBattleAction.round || own?.acted) {
        savePendingBattleAction(null);
      }
    }
    battle = nextBattle;
    if (battle?.id && group?.id) saveActiveBattleId(battle.id, group.id);
    if (typeof options?.onBattleUpdate === "function") options.onBattleUpdate(battle, user?.id);
    renderBattleControls();
    if (battle && ["waiting", "active"].includes(battle.status)) scheduleBattlePoll();
    else if (battlePollTimer) {
      window.clearTimeout(battlePollTimer);
      battlePollTimer = 0;
    }
  }

  function scheduleBattlePoll() {
    if (battlePollTimer || !battle || !["waiting", "active"].includes(battle.status)) return;
    battlePollTimer = window.setTimeout(pollBattle, 1800);
  }

  async function pollBattle() {
    battlePollTimer = 0;
    if (!battle?.id || !user || battlePollInFlight) return;
    const userId = user.id;
    const battleId = battle.id;
    battlePollInFlight = true;
    try {
      const result = await rpc("get_player_group_battle", { p_battle_id: battleId });
      if (user?.id === userId && battle?.id === battleId) setBattle(result);
    } catch (error) {
      if (user?.id === userId && battle?.id === battleId) {
        setStatus(`Не удалось обновить совместный бой: ${friendlyError(error)}`, true);
        console.error("Не удалось опросить состояние совместного боя.", error);
      }
    } finally {
      battlePollInFlight = false;
      scheduleBattlePoll();
    }
  }

  async function restoreBattle() {
    if (!user || !group || !playerState.inDungeon || battle) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(`${ACTIVE_BATTLE_PREFIX}${user.id}`) || "null");
      if (!saved || saved.groupId !== group.id || typeof saved.battleId !== "string") return;
      const result = await rpc("get_player_group_battle", { p_battle_id: saved.battleId });
      if (user && group?.id === saved.groupId && result?.id === saved.battleId) setBattle(result);
    } catch (error) {
      console.warn("Не удалось восстановить совместный бой.", error);
    }
  }

  async function startBattle(boss) {
    if (!canStartBattle()) throw new Error("Совместный бой доступен, когда оба игрока находятся в подземелье.");
    const userId = user.id;
    const groupId = group.id;
    const result = await rpc("start_player_group_battle", {
      p_floor: boss.floor,
      p_boss_name: boss.name,
      p_boss_icon: boss.icon,
      p_boss_skin: boss.skin,
      p_boss_hp: boss.hp,
      p_boss_max_hp: boss.max_hp,
      p_boss_damage: boss.damage,
      p_boss_xp: boss.xp,
      p_boss_gold: boss.gold,
      p_player: getBattlePlayer(),
    });
    if (!isCurrentContext(userId, groupId)) return;
    setBattle(result);
    if (result.status === "waiting") showNotice("Приглашение отправлено напарнику. Ждём его в бою.");
    else showNotice("Совместный бой начался!");
  }

  async function joinBattle(battleId) {
    if (!battleId || !playerState.inDungeon) throw new Error("Чтобы вступить в совместный бой, сначала начни свой спуск.");
    const userId = user.id;
    const groupId = group.id;
    const result = await rpc("join_player_group_battle", {
      p_battle_id: battleId,
      p_player: getBattlePlayer(),
    });
    if (!isCurrentContext(userId, groupId)) return;
    const invitation = battleInvite;
    clearPendingBattleInvite();
    setBattle(result);
    if (invitation?.inbox_id) {
      try {
        const pending = loadPendingInbox(userId) || [];
        savePendingInbox(userId, pending.filter((update) => update.id !== invitation.inbox_id));
        await rpc("ack_player_group_inbox", { p_ids: [invitation.inbox_id] });
      } catch (error) {
        console.warn("Не удалось подтвердить приглашение в совместный бой.", error);
      }
    }
    showNotice("Ты вступил в совместный бой со стражем!");
  }

  function canStartBattle() {
    return Boolean(
      !window.WellPvp?.isBusy() && isGroupActive() && playerState.inDungeon && group?.members?.length === 2 &&
      options?.getBossEncounter?.()
    );
  }

  async function submitPendingBattleAction() {
    const operation = pendingBattleAction;
    if (!operation || operation.userId !== user?.id || operation.battleId !== battle?.id || battleActionInFlight) return;
    battleActionInFlight = true;
    renderBattleControls();
    try {
      const result = await rpc("player_group_battle_action", {
        p_battle_id: operation.battleId,
        p_action: operation.action,
        p_request_id: operation.requestId,
      });
      if (user?.id !== operation.userId || battle?.id !== operation.battleId) return;
      savePendingBattleAction(null);
      setBattle(result);
    } catch (error) {
      if (user?.id === operation.userId && battle?.id === operation.battleId) {
        setStatus(`Не удалось выполнить ход: ${friendlyError(error)}. Запрос сохранён — повтори отправку.`, true);
        console.error("Не удалось выполнить действие совместного боя.", error);
      }
    } finally {
      battleActionInFlight = false;
      if (user?.id === operation.userId && battle?.id === operation.battleId) renderBattleControls();
    }
  }

  function requestBattleAction(action) {
    if (!battle?.id || battleActionInFlight || pendingBattleAction) return;
    const operation = {
      userId: user?.id,
      battleId: battle.id,
      round: battle.round,
      action,
      requestId: createRequestId(),
    };
    if (!operation.userId || !savePendingBattleAction(operation)) return;
    submitPendingBattleAction();
  }

  function retryBattleAction() {
    if (pendingBattleAction?.userId === user?.id && pendingBattleAction.battleId === battle?.id) {
      submitPendingBattleAction();
    }
  }

  async function leaveBattle() {
    if (!battle?.id) return;
    const result = await rpc("leave_player_group_battle", { p_battle_id: battle.id });
    setBattle(result);
  }

  function render() {
    const signedIn = Boolean(user && window.WellCloudSave?.isConfigured());
    ui.empty.hidden = Boolean(group);
    ui.roster.hidden = !group;
    ui.create.disabled = !signedIn || Boolean(group) || busy;
    ui.accept.disabled = !signedIn || Boolean(group) || busy || !ui.acceptCode.value.trim();
    ui.invite.disabled = busy || group?.members?.length !== 1;
    ui.disband.disabled = busy || !group;
    ui.copyInvite.disabled = busy || !invite?.invite_code;
    ui.battleInviteButton.disabled = busy;
    ui.notifications.checked = notificationsEnabled();
    ui.nickname.disabled = Boolean(group) || busy;
    ui.acceptCode.disabled = Boolean(group) || busy;
    ui.inviteCode.value = invite?.invite_code || "";
    ui.inviteExpiry.textContent = invite?.expires_at
      ? `Действует до ${new Date(invite.expires_at).toLocaleTimeString()}. Код одноразовый.`
      : "";
    ui.members.replaceChildren();

    if (!signedIn) {
      ui.activity.textContent = "Группы доступны после входа в облачный аккаунт.";
    } else if (!group) {
      ui.activity.textContent = "Создай группу или введи код приглашения. В группе может быть только два игрока.";
    } else {
      for (const member of group.members || []) {
        const inDungeon = hasFreshGroupState() && member.in_dungeon;
        const row = document.createElement("div");
        row.className = "group-member";
        const identity = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = `${member.nickname}${member.user_id === user.id ? " · ты" : ""}`;
        const level = document.createElement("span");
        level.textContent = `Уровень ${member.level}`;
        identity.append(name, level);
        const presence = document.createElement("span");
        presence.className = `group-presence${inDungeon ? " present" : ""}`;
        presence.textContent = inDungeon ? "В подземелье" : "Не в игре";
        row.append(identity, presence);
        ui.members.append(row);
      }
      const partner = group.members.find((member) => member.user_id !== user.id);
      const active = isGroupActive();
      ui.activity.textContent = active
        ? "Вы оба в подземелье: групповые эффекты действуют."
        : partner
          ? !hasFreshGroupState()
            ? "Нет свежего статуса группы: эффекты временно отключены."
            : groupRatio() >= 3
              ? "Разница уровней велика: групповые эффекты временно отключены."
              : "Бонусы появятся, когда вы оба будете в подземелье."
          : invite
            ? "Пригласи второго игрока по одноразовому коду."
            : "Создай приглашение для второго игрока.";
    }
    renderBattleInvite();
    renderBattleControls();
  }

  function friendlyError(error) {
    const message = error?.message || "неизвестная ошибка";
    if (/PGRST202|could not find the function|404|player_group_/i.test(message)) {
      return `Группы ещё не настроены в Supabase. Выполни обновлённый supabase/schema.sql, затем обнови игру. (${message})`;
    }
    return message;
  }

  async function rpc(name, args) {
    return window.WellCloudSave.groupRpc(name, args);
  }

  function mailboxRpc(name, args = {}) {
    if (!/^player_mailbox_[a-z_]+$/.test(name)) throw new Error("Недопустимая операция почтового ящика.");
    return rpc(name, args);
  }

  function getMailboxContext() {
    return {
      userId: user?.id || null,
      groupId: group?.id || null,
      fresh: Boolean(user && group && hasFreshGroupState() && group.members?.length === 2),
      members: (group?.members || []).map((member) => ({
        user_id: member.user_id,
        nickname: member.nickname,
        level: member.level,
      })),
    };
  }

  function isCurrentContext(userId, groupId) {
    return user?.id === userId && group?.id === groupId;
  }

  function contextKey(userId, groupId) {
    return JSON.stringify([userId, groupId]);
  }

  function pendingInboxKey(userId) {
    return `${PENDING_INBOX_PREFIX}${userId}`;
  }

  function loadPendingInbox(userId) {
    try {
      const saved = JSON.parse(window.localStorage.getItem(pendingInboxKey(userId)) || "[]");
      if (!Array.isArray(saved)) throw new Error("Очередь уведомлений должна быть массивом.");
      return saved.filter((update) =>
        update && typeof update.id === "string" && /^\d{1,19}$/.test(update.id) &&
        typeof update.group_id === "string" &&
        ["gold", "essence", "hint_secret", "hint_rare", "coop_battle"].includes(update.kind) &&
        Number.isInteger(update.amount) && update.amount >= 0 &&
        Number.isInteger(update.floor) && update.floor >= 0 &&
        (update.kind !== "coop_battle" || typeof update.battle_id === "string")
      );
    } catch (error) {
      console.error("Не удалось восстановить очередь групповых обновлений.", error);
      return null;
    }
  }

  function savePendingInbox(userId, updates) {
    try {
      window.localStorage.setItem(pendingInboxKey(userId), JSON.stringify(updates));
      return true;
    } catch (error) {
      console.error("Не удалось сохранить очередь групповых обновлений.", error);
      setStatus("Не удалось надёжно сохранить групповые обновления; серверная очередь оставлена без подтверждения.", true);
      return false;
    }
  }

  function markHintHandled(userId, updateId) {
    const key = `${HANDLED_HINTS_PREFIX}${userId}`;
    try {
      const saved = JSON.parse(window.localStorage.getItem(key) || "[]");
      if (!Array.isArray(saved)) throw new Error("Список обработанных подсказок повреждён.");
      if (saved.includes(updateId)) return false;
      window.localStorage.setItem(key, JSON.stringify([...saved, updateId]));
      return true;
    } catch (error) {
      console.error("Не удалось сохранить обработанную групповую подсказку.", error);
      setStatus("Не удалось сохранить групповую подсказку; она останется в очереди.", true);
      return null;
    }
  }

  function applyInboxUpdate(userId, update) {
    if (user?.id !== userId) return false;
    if (update.kind === "coop_battle" && update.battle_id) {
      if (battle?.id === update.battle_id) return true;
      if (battleInvite?.battle_id !== update.battle_id) {
        battleInvite = { battle_id: update.battle_id, group_id: update.group_id, inbox_id: update.id };
        let persisted = true;
        try {
          window.localStorage.setItem(`${PENDING_BATTLE_INVITE_PREFIX}${userId}`, JSON.stringify(battleInvite));
        } catch (error) {
          persisted = false;
          console.error("Не удалось сохранить приглашение в совместный бой.", error);
        }
        showNotice("Напарник зовёт на совместный бой со стражем!", true);
        renderBattleInvite();
        return persisted;
      }
      return true;
    }
    if (update.kind === "gold" && Number.isInteger(update.amount) && update.amount > 0) {
      return options.onSharedGold(update.amount, update.id) === true;
    }
    if (update.kind === "essence" && Number.isInteger(update.amount) && update.amount > 0) {
      return options.onSharedEssence(update.amount, update.id) === true;
    }
    if (update.kind === "hint_secret" || update.kind === "hint_rare") {
      const firstDelivery = markHintHandled(userId, update.id);
      if (firstDelivery === null) return false;
      if (firstDelivery) {
        showNotice(update.kind === "hint_secret"
          ? `Сопартиец нашёл тайный зал на этаже ${update.floor}. Проверь этот этаж.`
          : `Сопартиец заметил редкое событие на этаже ${update.floor}.`);
      }
      return true;
    }
    return false;
  }

  async function consumeInbox() {
    if (!playerState.inDungeon || !group || !user) return;
    const userId = user.id;
    const groupId = group.id;
    const key = contextKey(userId, groupId);
    if (inboxInFlight.has(key)) {
      inboxInFlight.set(key, true);
      return;
    }
    inboxInFlight.set(key, false);
    try {
      let pending = loadPendingInbox(userId);
      if (!pending) throw new Error("Локальная очередь групповых обновлений недоступна.");

      let readError = null;
      try {
        const updates = await rpc("consume_player_group_inbox");
        if (!isCurrentContext(userId, groupId)) return;
        if (!Array.isArray(updates) || updates.some((update) =>
          !update || typeof update.id !== "string" || update.group_id !== groupId
        )) {
          throw new Error("Сервер вернул неверный формат уведомлений группы.");
        }
        const byId = new Map(pending.map((update) => [update.id, update]));
        for (const update of updates) byId.set(update.id, update);
        pending = [...byId.values()];
        if (!savePendingInbox(userId, pending)) return;
      } catch (error) {
        readError = error;
      }

      const acknowledgedIds = [];
      const remaining = pending.slice(100);
      for (const update of pending.slice(0, 100)) {
        if (!isCurrentContext(userId, groupId)) return;
        if (applyInboxUpdate(userId, update)) acknowledgedIds.push(update.id);
        else remaining.push(update);
      }
      if (acknowledgedIds.length) {
        const result = await rpc("ack_player_group_inbox", { p_ids: acknowledgedIds });
        if (!isCurrentContext(userId, groupId)) return;
        if (!Number.isInteger(result?.acknowledged) || result.acknowledged < 0) {
          throw new Error("Сервер вернул неверное подтверждение групповых обновлений.");
        }
        if (!savePendingInbox(userId, remaining)) return;
      } else if (remaining.length !== pending.length) {
        if (!savePendingInbox(userId, remaining)) return;
      }
      if (readError && user?.id === userId) throw readError;
    } finally {
      const requested = inboxInFlight.get(key);
      inboxInFlight.delete(key);
      if (requested && isCurrentContext(userId, groupId)) {
        window.setTimeout(consumeInbox, 0);
      }
    }
  }

  async function heartbeat() {
    if (!user || !window.WellCloudSave?.isConfigured()) return;
    if (heartbeatInFlight) {
      heartbeatRequested = true;
      return;
    }
    const userId = user.id;
    const sentState = { ...playerState };
    heartbeatInFlight = true;
    lastHeartbeatAt = Date.now();
    lastHeartbeatLevel = sentState.level;
    lastHeartbeatDungeon = sentState.inDungeon;
    try {
      const result = await rpc("heartbeat_player_group", {
        p_nickname: getNickname(),
        p_level: sentState.level,
        p_in_dungeon: sentState.inDungeon,
      });
      if (user?.id !== userId) return;
      const previousGroup = group;
      const previousPartnerActive = lastPartnerActivity;
      group = result?.group || null;
      groupStateReceivedAt = group ? Date.now() : 0;
      invite = result?.invite || null;
      if (result?.partner_expired) {
        setStatus("Напарник не отправлял heartbeat дольше 75 секунд: его место освобождено.");
        showNotice("Напарник отключился более чем на 75 секунд; можно пригласить другого игрока.");
      }
      if (!group) {
        invite = null;
        battle = null;
        battleActionInFlight = false;
        battleInvite = null;
        if (battlePollTimer) window.clearTimeout(battlePollTimer);
        battlePollTimer = 0;
        renderBattleControls();
        renderBattleInvite();
      }
      const partner = group?.members?.find((member) => member.user_id !== user.id);
      lastPartnerActivity = partner ? Boolean(partner.in_dungeon) : null;
      if (result?.dissolved) {
        invite = null;
        setStatus("Группа распущена: разница уровней достигла 3 раз.");
        showNotice("Группа автоматически распущена из-за разницы уровней.");
      } else if (previousGroup?.id && !group) {
        setStatus("Группа больше не существует.");
      } else if (partner && previousPartnerActive !== null && previousPartnerActive !== lastPartnerActivity) {
        showNotice(lastPartnerActivity
          ? `${partner.nickname} спустился в подземелье.`
          : `${partner.nickname} покинул подземелье.`);
      }
      render();
      if (!group && previousGroup?.id) {
        if (refundPendingShares(previousGroup.id)) {
          setStatus("Группа распущена; ожидавшая отправки доля добычи не была передана.", true);
        }
      }
      if (isGroupActive()) await flushPendingShares();
      if (playerState.inDungeon && group) await consumeInbox();
      await restoreBattle();
    } catch (error) {
      if (user?.id === userId) {
        setStatus(`Не удалось обновить группу: ${friendlyError(error)}`, true);
        render();
        console.error("Не удалось обновить статус группы игроков.", error);
      }
    } finally {
      heartbeatInFlight = false;
      if (heartbeatRequested) {
        heartbeatRequested = false;
        window.setTimeout(heartbeat, 0);
      }
    }
  }

  async function withBusy(action, successMessage) {
    if (busy) return;
    const userId = user?.id;
    busy = true;
    render();
    try {
      await action();
      if (successMessage && user?.id === userId) setStatus(successMessage);
    } catch (error) {
      if (user?.id === userId) {
        setStatus(`Не удалось выполнить действие: ${friendlyError(error)}`, true);
        console.error("Ошибка управления группой игроков.", error);
      }
    } finally {
      busy = false;
      render();
    }
  }

  async function createGroup() {
    await withBusy(async () => {
      const userId = user?.id;
      const result = await rpc("create_player_group", {
        p_nickname: getNickname(),
        p_level: playerState.level,
      });
      if (user?.id !== userId) return;
      group = result?.group || null;
      groupStateReceivedAt = group ? Date.now() : 0;
      invite = result?.invite_code ? { invite_code: result.invite_code, expires_at: result.expires_at } : null;
      render();
    }, "Группа создана. Передай сопартийцу одноразовый код приглашения.");
  }

  async function createInvite() {
    await withBusy(async () => {
      const userId = user?.id;
      const groupId = group?.id;
      const result = await rpc("create_player_group_invite");
      if (!isCurrentContext(userId, groupId)) return;
      invite = result?.invite_code ? { invite_code: result.invite_code, expires_at: result.expires_at } : null;
      await heartbeat();
    }, "Код приглашения готов.");
  }

  async function acceptInvite() {
    await withBusy(async () => {
      const userId = user?.id;
      const result = await rpc("accept_player_group_invite", {
        p_code: ui.acceptCode.value.trim().toUpperCase(),
        p_nickname: getNickname(),
        p_level: playerState.level,
      });
      if (user?.id !== userId) return;
      group = result || null;
      groupStateReceivedAt = group ? Date.now() : 0;
      invite = null;
      ui.acceptCode.value = "";
      render();
      await heartbeat();
    }, "Ты присоединился к группе.");
  }

  async function dissolveGroup() {
    const userId = user?.id;
    const groupId = group?.id;
    if (!groupId) return;
    if (!window.confirm("Распустить группу для обоих игроков?")) return;
    if (!isCurrentContext(userId, groupId)) return;
    await withBusy(async () => {
      await rpc("dissolve_player_group");
      if (!isCurrentContext(userId, groupId)) return;
      const pendingCount = refundPendingShares(groupId);
      group = null;
      groupStateReceivedAt = 0;
      invite = null;
      lastPartnerActivity = null;
      battle = null;
      battleInvite = null;
      if (battlePollTimer) window.clearTimeout(battlePollTimer);
      battlePollTimer = 0;
      if (pendingCount) setStatus("Группа распущена; невыплаченную сопартийцу долю вернул себе.");
    }, "Группа распущена.");
  }

  function copyInvite() {
    if (!invite?.invite_code) return;
    const copy = navigator.clipboard?.writeText
      ? navigator.clipboard.writeText(invite.invite_code)
      : Promise.reject(new Error("Буфер обмена недоступен; скопируй код вручную."));
    copy.then(() => setStatus("Код приглашения скопирован."))
      .catch((error) => setStatus(error.message, true));
  }

  function storedEssenceProgress() {
    try {
      const value = Number(window.localStorage.getItem(`${ESSENCE_PROGRESS_PREFIX}${user?.id || "guest"}`) || 0);
      return Number.isFinite(value) && value >= 0 && value < 1 ? value : 0;
    } catch (error) {
      console.warn("Не удалось прочитать остаток групповой награды.", error);
      return 0;
    }
  }

  function saveEssenceProgress(value) {
    try {
      window.localStorage.setItem(`${ESSENCE_PROGRESS_PREFIX}${user?.id || "guest"}`, String(value));
    } catch (error) {
      console.warn("Не удалось сохранить остаток групповой награды.", error);
    }
  }

  function loadPendingShares() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(`${PENDING_SHARES_PREFIX}${user?.id || "guest"}`) || "[]");
      return Array.isArray(saved) ? saved.filter((share) =>
        share && typeof share.groupId === "string" &&
        (share.kind === "gold" || share.kind === "essence") &&
        Number.isInteger(share.amount) && share.amount > 0 &&
        Number.isInteger(share.fallback) && share.fallback >= 0 &&
        typeof share.requestId === "string"
      ) : [];
    } catch (error) {
      console.warn("Не удалось восстановить очередь групповых наград.", error);
      return [];
    }
  }

  function savePendingShares(shares) {
    try {
      window.localStorage.setItem(`${PENDING_SHARES_PREFIX}${user?.id || "guest"}`, JSON.stringify(shares));
      return true;
    } catch (error) {
      console.error("Не удалось сохранить очередь групповых наград.", error);
      setStatus("Не удалось сохранить очередь доли добычи для сопартийца.", true);
      return false;
    }
  }

  function splitRemainderKey(kind, partnerId) {
    return `${SHARE_REMAINDER_PREFIX}${user?.id || "guest"}:${group?.id}:${partnerId}:${kind}`;
  }

  function readSplitRemainder(key) {
    try {
      const value = Number(window.localStorage.getItem(key) || 0);
      return Number.isFinite(value) && value >= 0 && value < 1 ? value : 0;
    } catch (error) {
      console.warn("Не удалось прочитать остаток деления групповой награды.", error);
      return 0;
    }
  }

  function saveSplitRemainder(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (error) {
      console.warn("Не удалось сохранить остаток деления групповой награды.", error);
    }
  }

  function createRequestId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
      const random = Math.floor(Math.random() * 16);
      return (character === "x" ? random : (random & 3) | 8).toString(16);
    });
  }

  async function flushPendingShares() {
    if (!isGroupActive()) return;
    const userId = user.id;
    const groupId = group.id;
    const key = contextKey(userId, groupId);
    if (sharesInFlight.has(key)) {
      sharesFlushRequested.add(key);
      return;
    }
    sharesInFlight.add(key);
    try {
      const pending = loadPendingShares();
      for (const share of pending) {
        if (!isCurrentContext(userId, groupId)) return;
        if (share.groupId !== groupId) continue;
        try {
          const result = await rpc("share_player_group_reward", {
            p_kind: share.kind,
            p_amount: share.amount,
            p_request_id: share.requestId,
          });
          if (!isCurrentContext(userId, groupId)) return;
          if (result?.shared) {
            savePendingShares(loadPendingShares().filter((candidate) => candidate.requestId !== share.requestId));
            continue;
          }
          const rejected = loadPendingShares().filter((candidate) => candidate.groupId === groupId);
          savePendingShares(loadPendingShares().filter((candidate) => candidate.groupId !== groupId));
          for (const pendingShare of rejected) {
            options.onUnsharedReward(pendingShare.kind, pendingShare.fallback || 0);
          }
          const partner = group.members.find((member) => member.user_id !== user.id);
          if (partner) partner.in_dungeon = false;
          setStatus("Сопартиец покинул подземелье; добыча осталась у тебя.");
          render();
          break;
        } catch (error) {
          if (isCurrentContext(userId, groupId)) {
            setStatus(`Не удалось передать долю добычи сопартийцу: ${friendlyError(error)}`, true);
            console.error("Не удалось передать групповую добычу.", error);
          }
          break;
        }
      }
    } finally {
      sharesInFlight.delete(key);
      if (sharesFlushRequested.delete(key) && isCurrentContext(userId, groupId)) {
        window.setTimeout(flushPendingShares, 0);
      }
    }
  }

  function splitReward(kind, amount) {
    if (!Number.isInteger(amount) || amount <= 0 || !isGroupActive()) return amount;
    let boosted = amount;
    if (kind === "gold") {
      boosted = Math.round(amount * 1.1);
    } else if (kind === "essence") {
      const progress = storedEssenceProgress() + amount * 0.1;
      const bonus = Math.floor(progress + 1e-9);
      saveEssenceProgress(Math.max(0, progress - bonus));
      boosted += bonus;
    }
    const ownMember = group.members.find((member) => member.user_id === user.id);
    const partner = group.members.find((member) => member.user_id !== user.id);
    const remainderKey = splitRemainderKey(kind, partner.user_id);
    const priorRemainder = readSplitRemainder(remainderKey);
    const pendingPartnerShare = priorRemainder +
      boosted * partner.level / (ownMember.level + partner.level);
    const partnerShare = Math.floor(pendingPartnerShare + 1e-9);
    saveSplitRemainder(remainderKey, Math.max(0, pendingPartnerShare - partnerShare));
    const ownShare = boosted - partnerShare;
    if (partnerShare) {
      const pending = loadPendingShares();
      pending.push({
        groupId: group.id,
        kind,
        amount: partnerShare,
        fallback: amount - ownShare,
        requestId: createRequestId(),
      });
      if (!savePendingShares(pending)) {
        saveSplitRemainder(remainderKey, priorRemainder);
        return boosted;
      }
      flushPendingShares();
    }
    return ownShare;
  }

  function hint(kind, floor) {
    if (!isGroupActive()) return;
    rpc("send_player_group_hint", {
      p_kind: kind === "secret" ? "hint_secret" : "hint_rare",
      p_floor: floor,
    }).catch((error) => {
      setStatus(`Не удалось отправить подсказку сопартийцу: ${friendlyError(error)}`, true);
      console.error("Не удалось отправить групповую подсказку.", error);
    });
  }

  function setPlayerState(level, inDungeon) {
    const previous = playerState;
    playerState = {
      level: Number.isInteger(level) && level > 0 ? level : 1,
      inDungeon: Boolean(inDungeon && document.visibilityState === "visible"),
    };
    const own = group?.members?.find((member) => member.user_id === user?.id);
    if (own) {
      own.level = playerState.level;
      own.in_dungeon = playerState.inDungeon;
    }
    render();
    renderBattleInvite();
    const changed = previous.level !== playerState.level || previous.inDungeon !== playerState.inDungeon ||
      lastHeartbeatLevel !== playerState.level || lastHeartbeatDungeon !== playerState.inDungeon;
    if (user && (changed || Date.now() - lastHeartbeatAt >= HEARTBEAT_INTERVAL)) heartbeat();
  }

  function setUser(nextUser) {
    const changed = user?.id !== nextUser?.id;
    user = nextUser;
    if (changed) {
      group = null;
      invite = null;
      lastHeartbeatAt = 0;
      groupStateReceivedAt = 0;
      lastHeartbeatLevel = null;
      lastHeartbeatDungeon = null;
      lastPartnerActivity = null;
      battle = null;
      battleActionInFlight = false;
      pendingBattleAction = readPendingBattleAction(user?.id);
      battlePollInFlight = false;
      if (battlePollTimer) window.clearTimeout(battlePollTimer);
      battlePollTimer = 0;
      try {
        battleInvite = JSON.parse(window.localStorage.getItem(`${PENDING_BATTLE_INVITE_PREFIX}${user?.id}`) || "null");
      } catch (error) {
        battleInvite = null;
        console.warn("Не удалось восстановить приглашение в совместный бой.", error);
      }
    }
    render();
    if (user) heartbeat();
    else setStatus("Группы доступны после входа в облачный аккаунт.");
  }

  function initialize(callbacks) {
    options = callbacks;
    ui.open.addEventListener("click", () => {
      if (!ui.dialog.open) ui.dialog.showModal();
      heartbeat();
    });
    ui.create.addEventListener("click", createGroup);
    ui.accept.addEventListener("click", acceptInvite);
    ui.acceptCode.addEventListener("input", render);
    ui.invite.addEventListener("click", createInvite);
    ui.copyInvite.addEventListener("click", copyInvite);
    ui.disband.addEventListener("click", dissolveGroup);
    ui.battleInviteButton.addEventListener("click", () => {
      if (!battleInvite) return;
      withBusy(() => joinBattle(battleInvite.battle_id), "Совместный бой начался.");
    });
    $("coop-start-button").addEventListener("click", () => {
      const encounter = options.getBossEncounter();
      if (encounter) startBattle(encounter).catch((error) => {
        setStatus(`Не удалось начать совместный бой: ${friendlyError(error)}`, true);
        console.error("Не удалось начать совместный бой.", error);
      });
    });
    $("coop-attack-button").addEventListener("click", () => requestBattleAction("attack"));
    $("coop-heavy-button").addEventListener("click", () => requestBattleAction("heavy"));
    $("coop-potion-button").addEventListener("click", () => requestBattleAction("potion"));
    $("coop-guard-button").addEventListener("click", () => requestBattleAction("guard"));
    $("coop-retry-button").addEventListener("click", retryBattleAction);
    $("coop-leave-button").addEventListener("click", () => leaveBattle().catch((error) => {
      setStatus(`Не удалось покинуть совместный бой: ${friendlyError(error)}`, true);
      console.error("Не удалось покинуть совместный бой.", error);
    }));
    ui.notifications.addEventListener("change", () => {
      try {
        window.localStorage.setItem(NOTIFICATIONS_KEY, String(ui.notifications.checked));
      } catch (error) {
        console.warn("Не удалось сохранить настройку уведомлений групп.", error);
      }
    });
    document.addEventListener("visibilitychange", () => {
      setPlayerState(playerState.level, options.isInDungeon());
    });
    window.setInterval(() => {
      if (user && document.visibilityState === "visible") heartbeat();
    }, HEARTBEAT_INTERVAL);
    render();
    renderBattleInvite();
    renderBattleControls();
    window.WellCloudSave.onAuthChange(setUser);
    setPlayerState(options.getLevel(), options.isInDungeon());
  }

  window.WellPlayerGroups = {
    initialize,
    setPlayerState,
    splitReward,
    hint,
    canStartBattle,
    getBattle: () => battle,
    getMailboxContext,
    mailboxRpc,
    getPvpContext: () => ({
      userId: user?.id || null,
      groupId: group?.id || null,
      active: isGroupActive(),
      members: (group?.members || []).map((member) => ({ ...member })),
    }),
  };
})();
