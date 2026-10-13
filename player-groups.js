"use strict";

(() => {
  const NOTIFICATIONS_KEY = "well-of-whispers-group-notifications";
  const ESSENCE_PROGRESS_PREFIX = "well-of-whispers-group-essence-progress:";
  const SHARE_REMAINDER_PREFIX = "well-of-whispers-group-share-remainder:";
  const PENDING_SHARES_PREFIX = "well-of-whispers-pending-group-shares:";
  const HEARTBEAT_INTERVAL = 25_000;
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
  };

  let options = null;
  let user = null;
  let group = null;
  let invite = null;
  let playerState = { level: 1, inDungeon: false };
  let busy = false;
  let lastHeartbeatAt = 0;
  let heartbeatInFlight = false;
  let heartbeatRequested = false;
  let lastHeartbeatLevel = null;
  let lastHeartbeatDungeon = null;
  let sharesInFlight = false;
  let sharesFlushRequested = false;
  let lastPartnerActivity = null;
  let toastTimer = 0;

  function notificationsEnabled() {
    try {
      return window.localStorage.getItem(NOTIFICATIONS_KEY) !== "false";
    } catch (error) {
      console.warn("Не удалось прочитать настройку уведомлений групп.", error);
      return true;
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

  function isGroupActive() {
    if (!user || !group || group.members?.length !== 2 || groupRatio() >= 2) return false;
    const own = group.members.find((member) => member.user_id === user.id);
    return Boolean(own?.in_dungeon && playerState.inDungeon && group.members.every((member) => member.in_dungeon));
  }

  function showNotice(message) {
    if (!notificationsEnabled()) return;
    ui.toast.textContent = message;
    ui.toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      ui.toast.hidden = true;
    }, 6000);
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
        const row = document.createElement("div");
        row.className = "group-member";
        const identity = document.createElement("div");
        const name = document.createElement("strong");
        name.textContent = `${member.nickname}${member.user_id === user.id ? " · ты" : ""}`;
        const level = document.createElement("span");
        level.textContent = `Уровень ${member.level}`;
        identity.append(name, level);
        const presence = document.createElement("span");
        presence.className = `group-presence${member.in_dungeon ? " present" : ""}`;
        presence.textContent = member.in_dungeon ? "В подземелье" : "Не в игре";
        row.append(identity, presence);
        ui.members.append(row);
      }
      const partner = group.members.find((member) => member.user_id !== user.id);
      const active = isGroupActive();
      ui.activity.textContent = active
        ? "Вы оба в подземелье: групповые эффекты действуют."
        : partner
          ? groupRatio() >= 2
            ? "Разница уровней велика: групповые эффекты временно отключены."
            : "Бонусы появятся, когда вы оба будете в подземелье."
          : invite
            ? "Пригласи второго игрока по одноразовому коду."
            : "Создай приглашение для второго игрока.";
    }
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

  async function consumeInbox() {
    if (!playerState.inDungeon || !group) return;
    const updates = await rpc("consume_player_group_inbox");
    if (!Array.isArray(updates)) throw new Error("Сервер вернул неверный формат уведомлений группы.");
    let earnedGold = 0;
    let earnedEssence = 0;
    const notices = [];
    for (const update of updates) {
      if (update.kind === "gold" && Number.isInteger(update.amount) && update.amount > 0) {
        earnedGold += update.amount;
      } else if (update.kind === "essence" && Number.isInteger(update.amount) && update.amount > 0) {
        earnedEssence += update.amount;
      } else if (update.kind === "hint_secret" || update.kind === "hint_rare") {
        notices.push(
          update.kind === "hint_secret"
            ? `Сопартиец нашёл тайный зал на этаже ${update.floor}. Проверь этот этаж.`
            : `Сопартиец заметил редкое событие на этаже ${update.floor}.`
        );
      }
    }
    if (earnedGold) options.onSharedGold(earnedGold);
    if (earnedEssence) options.onSharedEssence(earnedEssence);
    if (earnedGold || earnedEssence) {
      showNotice(`Сопартиец поделился добычей: ${earnedGold ? `${earnedGold} монет` : ""}${earnedGold && earnedEssence ? " и " : ""}${earnedEssence ? `${earnedEssence} осколков` : ""}.`);
    }
    for (const message of notices) showNotice(message);
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
      invite = result?.invite || null;
      if (!group) invite = null;
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
    } catch (error) {
      if (user?.id === userId) {
        setStatus(`Не удалось обновить группу: ${friendlyError(error)}`, true);
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
    busy = true;
    render();
    try {
      await action();
      if (successMessage) setStatus(successMessage);
    } catch (error) {
      setStatus(`Не удалось выполнить действие: ${friendlyError(error)}`, true);
      console.error("Ошибка управления группой игроков.", error);
    } finally {
      busy = false;
      render();
    }
  }

  async function createGroup() {
    await withBusy(async () => {
      const result = await rpc("create_player_group", {
        p_nickname: getNickname(),
        p_level: playerState.level,
      });
      group = result?.group || null;
      invite = result?.invite_code ? { invite_code: result.invite_code, expires_at: result.expires_at } : null;
      render();
    }, "Группа создана. Передай сопартийцу одноразовый код приглашения.");
  }

  async function createInvite() {
    await withBusy(async () => {
      const result = await rpc("create_player_group_invite");
      invite = result?.invite_code ? { invite_code: result.invite_code, expires_at: result.expires_at } : null;
      await heartbeat();
    }, "Код приглашения готов.");
  }

  async function acceptInvite() {
    await withBusy(async () => {
      const result = await rpc("accept_player_group_invite", {
        p_code: ui.acceptCode.value.trim().toUpperCase(),
        p_nickname: getNickname(),
        p_level: playerState.level,
      });
      group = result || null;
      invite = null;
      ui.acceptCode.value = "";
      render();
      await heartbeat();
    }, "Ты присоединился к группе.");
  }

  async function dissolveGroup() {
    if (!window.confirm("Распустить группу для обоих игроков?")) return;
    await withBusy(async () => {
      await rpc("dissolve_player_group");
      const pendingCount = refundPendingShares(group.id);
      group = null;
      invite = null;
      lastPartnerActivity = null;
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
    if (sharesInFlight) {
      sharesFlushRequested = true;
      return;
    }
    sharesInFlight = true;
    try {
      const pending = loadPendingShares();
      for (const share of pending) {
        if (share.groupId !== group.id) continue;
        try {
          const result = await rpc("share_player_group_reward", {
            p_kind: share.kind,
            p_amount: share.amount,
            p_request_id: share.requestId,
          });
          if (result?.shared) {
            savePendingShares(loadPendingShares().filter((candidate) => candidate.requestId !== share.requestId));
            continue;
          }
          const rejected = loadPendingShares().filter((candidate) => candidate.groupId === group.id);
          savePendingShares(loadPendingShares().filter((candidate) => candidate.groupId !== group.id));
          for (const pendingShare of rejected) {
            options.onUnsharedReward(pendingShare.kind, pendingShare.fallback || 0);
          }
          const partner = group.members.find((member) => member.user_id !== user.id);
          if (partner) partner.in_dungeon = false;
          setStatus("Сопартиец покинул подземелье; добыча осталась у тебя.");
          render();
          break;
        } catch (error) {
          setStatus(`Не удалось передать долю добычи сопартийцу: ${friendlyError(error)}`, true);
          console.error("Не удалось передать групповую добычу.", error);
          break;
        }
      }
    } finally {
      sharesInFlight = false;
      if (sharesFlushRequested) {
        sharesFlushRequested = false;
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
      lastHeartbeatLevel = null;
      lastHeartbeatDungeon = null;
      lastPartnerActivity = null;
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
    window.WellCloudSave.onAuthChange(setUser);
    setPlayerState(options.getLevel(), options.isInDungeon());
  }

  window.WellPlayerGroups = {
    initialize,
    setPlayerState,
    splitReward,
    hint,
  };
})();
