"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const PREFIX = "well-of-whispers-pvp:";
  let callbacks;
  let battle = null;
  let invitation = null;
  let busy = false;
  let polling = false;
  let userId = null;
  let pending = null;

  function context() {
    return window.WellPlayerGroups.getPvpContext();
  }

  function notify(message) {
    $("pvp-status").textContent = message;
  }

  function storePending(value) {
    window.localStorage.setItem(`${PREFIX}${userId}`, JSON.stringify(value));
    pending = value;
  }

  function snapshot() {
    const fighter = callbacks.getFighter();
    return {
      hp: fighter.hp, max_hp: fighter.maxHp, attack: fighter.attack, armor: fighter.armor,
      accuracy: fighter.accuracy, concentration: fighter.concentration, agility: fighter.agility,
      evasion: fighter.evasion, regeneration: fighter.regeneration, bleeding: fighter.bleeding,
      infection: fighter.infection, potions: fighter.potions, focus: fighter.focus,
      revivalChance: fighter.revivalUsed ? 0 : fighter.revivalChance, offhand: fighter.offhand,
      criticalChance: fighter.criticalChance, executeChance: fighter.executeChance,
      lifesteal: fighter.lifesteal, skillType: fighter.skillType,
      skillDamage: fighter.skillDamage, skillCooldownMax: fighter.skillCooldownMax,
    };
  }

  async function rpc(name, args) {
    return window.WellCloudSave.groupRpc(name, args);
  }

  function acceptState(next) {
    if (!next || !next.id || !Array.isArray(next.players)) throw new Error("Сервер вернул некорректное состояние дуэли.");
    battle = next;
    invitation = null;
    callbacks.onBattle(next, userId);
    render();
  }

  function render() {
    const panel = $("pvp-panel");
    panel.hidden = !battle && !invitation && !pending;
    $("pvp-join-button").hidden = !invitation;
    $("pvp-join-button").disabled = busy || !callbacks.canDuel();
    $("pvp-retry-button").hidden = !pending;
    if (!battle) {
      for (const button of panel.querySelectorAll("[data-pvp-action]")) button.disabled = true;
      $("pvp-leave-button").hidden = true;
      $("pvp-close-button").hidden = true;
      if (invitation) notify("Напарник приглашает на PvP. Вступи из свободного зала — до согласия бой не начнётся.");
      return;
    }
    const own = battle.players.find((player) => player.user_id === userId);
    const canAct = battle.status === "active" && battle.current_user_id === userId && !busy && !pending;
    $("pvp-players").textContent = battle.players.map((player) =>
      `${player.nickname || "Искатель"}${player.user_id === userId ? " · ты" : ""}: ${player.hp}/${player.max_hp ?? player.maxHp} HP`
    ).join(" · ");
    const remaining = Math.max(0, Math.ceil((Date.parse(battle.deadline_at) - Date.now()) / 1000));
    $("pvp-turn").textContent = battle.status === "active"
      ? `Ход ${battle.turn} · ${battle.current_user_id === userId ? "твой" : "напарника"} · ${remaining} с (таймер проверяет сервер)`
      : battle.status === "waiting" ? "Ожидаем согласия напарника."
      : `Поединок завершён · ${battle.winner_id === userId ? "победа" : "поражение"} · ${battle.reason || ""}`;
    const log = $("pvp-log");
    log.replaceChildren(...(battle.log || []).slice(-12).map((entry) => {
      const line = document.createElement("p");
      line.textContent = typeof entry === "string" ? entry : entry.text || "";
      return line;
    }));
    for (const button of panel.querySelectorAll("[data-pvp-action]")) {
      const action = button.dataset.pvpAction;
      const cooldown = own?.[`${action}_cooldown`] ?? own?.cooldowns?.[action] ?? 0;
      button.disabled = !canAct || (
        ["shield", "torch", "staff"].includes(action) && (own?.offhand !== action || cooldown > 1)
      ) || (action === "heavy" && own?.focus < 2) ||
        (action === "potion" && (!own?.potions || own.hp >= (own.max_hp ?? own.maxHp)));
    }
    $("pvp-leave-button").hidden = !["active", "waiting"].includes(battle.status);
    $("pvp-leave-button").disabled = busy;
    $("pvp-close-button").hidden = battle.status !== "finished";
  }

  async function perform(work) {
    if (busy) return;
    busy = true;
    render();
    try {
      await work();
      notify("");
    } catch (error) {
      console.error("Ошибка PvP.", error);
      notify(`PvP: ${error.message}. Неподтверждённый ход сохранён; повтори отправку кнопкой «Повторить».`);
    } finally {
      busy = false;
      $("pvp-retry-button").hidden = !pending;
      render();
    }
  }

  async function submitPending() {
    if (!pending || pending.userId !== userId) return;
    const operation = pending;
    const result = await rpc(operation.rpc, operation.args);
    if (operation.userId !== userId) return;
    storePending(null);
    acceptState(result);
  }

  async function start(randomEncounter = false) {
    if (!callbacks) {
      notify("PvP ещё подключается. Дождись восстановления сохранения.");
      return;
    }
    if (!callbacks.canDuel() || busy || battle && ["waiting", "active"].includes(battle.status)) return;
    const info = context();
    if (!info.userId || !info.active) {
      if (randomEncounter) callbacks.onGhost();
      else notify("!ганг требует двух онлайн-напарников в подземелье. Вступи в группу; случайное событие допускает бой с призраком.");
      return;
    }
    userId = info.userId;
    await perform(async () => {
      if (!pending) storePending({
        userId, rpc: "pvp_start",
        args: { p_player: snapshot(), p_request_id: window.crypto.randomUUID() },
      });
      await submitPending();
    });
  }

  async function action(name) {
    if (!battle || battle.status !== "active" || battle.current_user_id !== userId || pending) return;
    await perform(async () => {
      storePending({
        userId, rpc: "pvp_action",
        args: { p_battle_id: battle.id, p_expected_turn: battle.turn, p_action: name, p_request_id: window.crypto.randomUUID() },
      });
      await submitPending();
    });
  }

  async function poll() {
    if (!callbacks || polling || busy) return;
    const info = context();
    if (info.userId !== userId) {
      userId = info.userId;
      battle = null;
      invitation = null;
      pending = null;
      try {
        pending = userId ? JSON.parse(window.localStorage.getItem(`${PREFIX}${userId}`) || "null") : null;
      } catch (error) {
        notify("Не удалось прочитать незавершённую отправку PvP.");
        console.error("PvP storage.", error);
      }
      render();
    }
    if (!userId || !callbacks.inDungeon()) return;
    polling = true;
    try {
      const id = battle && ["waiting", "active"].includes(battle.status) ? battle.id : callbacks.getBattleId();
      if (id) {
        const result = await rpc("pvp_get", { p_battle_id: id });
        if (info.userId === context().userId) {
          if (pending?.rpc === "pvp_action" && (result.status !== "active" || result.turn > pending.args.p_expected_turn)) {
            storePending(null);
            notify("Сохранённая отправка больше не нужна: сервер уже завершил тот ход. Показано актуальное состояние.");
          }
          acceptState(result);
        }
      } else if (info.active && callbacks.canDuel()) {
        const found = await rpc("pvp_find", {});
        if (info.userId !== context().userId) return;
        if (found && found.players?.some((player) => player.user_id === userId)) acceptState(found);
        else invitation = found;
      }
    } catch (error) {
      notify(`Не удалось обновить PvP: ${error.message}`);
      console.error("Не удалось обновить PvP.", error);
    } finally {
      polling = false;
      render();
    }
  }

  function initialize(options) {
    if (callbacks) return;
    callbacks = options;
    $("gang-form").addEventListener("submit", (event) => {
      event.preventDefault();
      if ($("gang-command").value.trim().toLocaleLowerCase("ru-RU") !== "!ганг") {
        notify("Доступная команда: !ганг");
        return;
      }
      start(false);
    });
    $("gang-button").addEventListener("click", () => start(false));
    $("pvp-join-button").addEventListener("click", () => start(false));
    $("pvp-retry-button").addEventListener("click", () => perform(submitPending));
    $("pvp-panel").addEventListener("click", (event) => {
      const button = event.target.closest("[data-pvp-action]");
      if (button) action(button.dataset.pvpAction);
    });
    $("pvp-leave-button").addEventListener("click", () => perform(async () => {
      const result = await rpc("pvp_leave", { p_battle_id: battle.id });
      storePending(null);
      acceptState(result);
    }));
    $("pvp-close-button").addEventListener("click", () => { battle = null; render(); });
    window.setInterval(poll, 4000);
    window.setInterval(render, 1000);
    poll();
  }

  window.WellPvp = {
    initialize, start, refresh: poll,
    isReady: () => Boolean(callbacks),
    isBusy: () => busy || Boolean(pending) || Boolean(battle && ["waiting", "active"].includes(battle.status)),
  };
})();
