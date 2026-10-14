"use strict";

(function attachDungeonModel(root) {
  const ITEMS = Object.freeze(["none", "shield", "torch", "staff"]);
  const ACTIONS = Object.freeze(["attack", "heavy", "potion", "guard", "shield", "torch", "staff", "skip",
    "equip-shield", "equip-torch", "equip-staff"]);
  const COOLDOWNS = Object.freeze({ shield: 4, torch: 2, staff: 4 });
  const ELITES = Object.freeze(["curse", "ghost", "warlike", "experienced", "punisher", "wounded", "protected", "piercing", "worldeater"]);
  const clamp = (min, max, value) => Math.min(max, Math.max(min, value));
  const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const positive = (value, fallback = 0) => clamp(0, 1000000, number(value, fallback));
  const fraction = (value, fallback = 0) => clamp(0, 1, number(value, fallback));
  const count = (value) => Math.floor(positive(value));

  function sample(rng) {
    if (typeof rng !== "function") throw new Error("RNG must be a function.");
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error("RNG must return a number in [0, 1).");
    return value;
  }

  function createFighter(input = {}) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid fighter.");
    const maxHp = clamp(1, 1000000, number(input.maxHp, number(input.hp, 100)));
    const fighter = {
      hp: clamp(0, maxHp, number(input.hp, maxHp)),
      maxHp,
      attack: positive(input.attack, 10),
      armor: fraction(input.armor),
      accuracy: fraction(input.accuracy, 0.8),
      concentration: clamp(0, 2, number(input.concentration, 0.35)),
      agility: fraction(input.agility),
      evasion: fraction(input.evasion),
      regeneration: positive(input.regeneration),
      bleeding: positive(input.bleeding),
      infection: count(input.infection),
      potions: count(input.potions),
      revivalChance: fraction(input.revivalChance),
      offhand: ITEMS.includes(input.offhand) ? input.offhand : "none",
      focus: positive(input.focus),
      cooldowns: {
        shield: count(input.cooldowns && input.cooldowns.shield),
        torch: count(input.cooldowns && input.cooldowns.torch),
        staff: count(input.cooldowns && input.cooldowns.staff),
      },
      turns: count(input.turns),
      skips: count(input.skips),
    };
    for (const key of ["skillDamage", "poisonDamage",
      "barrier", "firstTurnBarrier", "barrierAttack"]) {
      if (input[key] !== undefined) fighter[key] = positive(input[key]);
    }
    for (const key of ["skillCooldown", "skillCooldownMax"]) {
      if (input[key] !== undefined) fighter[key] = count(input[key]);
    }
    for (const key of ["criticalChance", "executeChance", "lifesteal"]) {
      if (input[key] !== undefined) fighter[key] = fraction(input[key]);
    }
    if (input.damageMultiplier !== undefined) fighter.damageMultiplier = positive(input.damageMultiplier, 1);
    if (input.revivalUsed !== undefined) fighter.revivalUsed = Boolean(input.revivalUsed);
    if (input.guarded !== undefined) fighter.guarded = Boolean(input.guarded);
    if (input.shadowEvade !== undefined) fighter.shadowEvade = Boolean(input.shadowEvade);
    if (["guard", "blast", "shadow"].includes(input.skillType)) fighter.skillType = input.skillType;
    if (ELITES.includes(input.eliteType)) fighter.eliteType = input.eliteType;
    if (ELITES.includes(input.trait)) fighter.trait = input.trait;
    if (input.special === "worldeater") fighter.special = input.special;
    return fighter;
  }

  function isValidFighter(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const bounded = (key, min = 0, max = 1000000) => Number.isFinite(value[key]) && value[key] >= min && value[key] <= max;
    const integer = (key) => bounded(key) && Number.isInteger(value[key]);
    if (!bounded("maxHp", 1) || !bounded("hp", 0, value.maxHp) ||
      !["attack", "regeneration", "bleeding", "focus"].every((key) => bounded(key)) ||
      !["armor", "accuracy", "agility", "evasion", "revivalChance"].every((key) => bounded(key, 0, 1)) ||
      !bounded("concentration", 0, 2) ||
      !["infection", "potions", "turns", "skips"].every(integer) || !ITEMS.includes(value.offhand) ||
      !value.cooldowns || typeof value.cooldowns !== "object" ||
      !Object.keys(COOLDOWNS).every((key) => Number.isInteger(value.cooldowns[key]) &&
        value.cooldowns[key] >= 0 && value.cooldowns[key] <= 1000000)) return false;
    for (const key of ["skillDamage", "skillCooldown", "skillCooldownMax", "poisonDamage",
      "barrier", "firstTurnBarrier", "barrierAttack", "damageMultiplier"]) {
      if (value[key] !== undefined && !bounded(key)) return false;
    }
    for (const key of ["criticalChance", "executeChance", "lifesteal"]) {
      if (value[key] !== undefined && !bounded(key, 0, 1)) return false;
    }
    for (const key of ["skillCooldown", "skillCooldownMax"]) {
      if (value[key] !== undefined && !integer(key)) return false;
    }
    for (const key of ["revivalUsed", "guarded", "shadowEvade"]) {
      if (value[key] !== undefined && typeof value[key] !== "boolean") return false;
    }
    return (value.skillType === undefined || ["guard", "blast", "shadow"].includes(value.skillType)) &&
      (value.eliteType === undefined || ELITES.includes(value.eliteType)) &&
      (value.trait === undefined || ELITES.includes(value.trait)) &&
      (value.special === undefined || value.special === "worldeater");
  }

  function hitChance(actor, target) {
    return clamp(0.05, 0.95, number(actor.accuracy, 0.8) - number(target.evasion));
  }

  function skillChance(actor, target) {
    return clamp(0.05, 0.95, number(actor.concentration, 0.35) -
      number(target.concentration, 0.35) * 0.5 + number(actor.agility) * 0.1 +
      number(actor.accuracy, 0.8) * 0.05);
  }

  function heal(fighter, amount) {
    if (fighter.hp > 0) fighter.hp = Math.min(fighter.maxHp, fighter.hp + amount);
  }

  function damage(target, amount) {
    const blocked = Math.min(positive(target.barrier), amount);
    if (target.barrier !== undefined) target.barrier -= blocked;
    const dealt = Math.min(target.hp, Math.max(0, amount - blocked));
    target.hp = Math.max(0, target.hp - Math.max(0, amount - blocked));
    return dealt;
  }

  function revive(fighter, rng, multiplier, log, label) {
    if (fighter.hp > 0 || fighter.revivalUsed || fighter.revivalChance <= 0) return;
    if (sample(rng) < fighter.revivalChance * multiplier) {
      fighter.hp = Math.max(1, Math.ceil(fighter.maxHp / 2));
      fighter.revivalUsed = true;
      log.push(`${label}: revival`);
    }
  }

  function result(actor, target, log, rng, pvp, skipped = false) {
    if (!skipped) revive(actor, rng, pvp ? 0.5 : 1, log, "actor");
    revive(target, rng, pvp ? 0.5 : 1, log, "target");
    const finished = actor.hp <= 0 || target.hp <= 0;
    return { actor, target, log, finished, winner: !finished ? null : actor.hp <= 0 ? "target" : "actor" };
  }

  function tick(fighter) {
    fighter.turns = count(fighter.turns + 1);
    for (const key of Object.keys(COOLDOWNS)) fighter.cooldowns[key] = Math.max(0, fighter.cooldowns[key] - 1);
    if (fighter.skillCooldown !== undefined) fighter.skillCooldown = Math.max(0, fighter.skillCooldown - 1);
    if (fighter.turns === 1 && fighter.firstTurnBarrier) fighter.barrier = positive(fighter.barrier) + fighter.firstTurnBarrier;
  }

  function elementalDamage(amount, bonus = 0, reduction = 0) {
    return amount + Math.floor(amount * bonus) - Math.floor(amount * reduction);
  }

  function strike(actor, target, rng, log, label, multiplier = 1, allowShadow = false, bonus = 0, reduction = 0) {
    if (allowShadow && target.shadowEvade) {
      target.shadowEvade = false;
      log.push(`${label}: shadow evaded`);
      return;
    }
    if (sample(rng) >= hitChance(actor, target)) {
      log.push(`${label}: miss`);
      return;
    }
    const critical = actor.criticalChance > 0 && sample(rng) < actor.criticalChance;
    const guarded = target.guarded ? 0.5 : 1;
    target.guarded = false;
    const amount = elementalDamage(Math.max(1, Math.round((actor.attack + positive(actor.barrierAttack) * positive(actor.barrier)) *
      multiplier * number(actor.damageMultiplier, 1) * (critical ? 2 : 1) * (1 - target.armor) * guarded)), bonus, reduction);
    const dealt = damage(target, amount);
    log.push(`${label}: hit ${amount}${critical ? " critical" : ""}`);
    if (actor.lifesteal) heal(actor, dealt * actor.lifesteal);
    if (target.hp > 0 && actor.executeChance > 0 && sample(rng) < actor.executeChance) {
      target.hp = 0;
      log.push(`${label}: execute`);
    }
  }

  function periodic(actor, target, log, label, pvp = false, reduction = 0) {
    heal(actor, actor.regeneration);
    const source = pvp ? target : actor;
    const amount = elementalDamage(source.bleeding + source.infection * 2 + positive(source.poisonDamage), 0, reduction);
    if (amount > 0) {
      damage(source, amount);
      log.push(`${label}: periodic ${amount}`);
    }
  }

  function pvpTurn(actorInput, targetInput, action, rng = Math.random) {
    if (!ACTIONS.includes(action)) throw new Error("Unknown action.");
    if (typeof rng !== "function") throw new Error("RNG must be a function.");
    const actor = createFighter(actorInput);
    const target = createFighter(targetInput);
    if (actor.hp <= 0 || target.hp <= 0) throw new Error("Combat is already finished.");
    if (action === "potion" && actor.potions < 1) throw new Error("No potions available.");
    if (Object.hasOwn(COOLDOWNS, action)) {
      if (actor.offhand !== action) throw new Error("Offhand item is not equipped.");
      if (actor.cooldowns[action] > 1) throw new Error("Offhand item is on cooldown.");
    }
    const log = [];
    tick(actor);
    actor.skips = action === "skip" ? count(actor.skips + 1) : 0;
    if (actor.skips >= 3) {
      actor.hp = 0;
      log.push("actor: defeated after three skips");
      return result(actor, target, log, rng, true, true);
    }
    if (action === "potion") {
      actor.potions -= 1;
      heal(actor, Math.max(1, Math.ceil(actor.maxHp * 0.3)));
      log.push("actor: potion");
    } else if (action.startsWith("equip-")) {
      actor.offhand = action.slice(6);
      log.push(`actor: ${action}`);
    } else if (action === "guard") {
      actor.focus = positive(actor.focus + 1);
      actor.guarded = true;
      log.push("actor: guard");
    } else if (action === "shield") {
      actor.guarded = sample(rng) < skillChance(actor, target);
      log.push(`actor: shield${actor.guarded ? "" : " miss"}`);
    } else if (action === "torch" || action === "staff" || action === "heavy") {
      if (sample(rng) < skillChance(actor, target)) {
        const multiplier = action === "staff" ? 1.25 : action === "heavy" ? 1.5 : 0.75;
        const guarded = target.guarded ? 0.5 : 1;
        target.guarded = false;
        const amount = Math.max(1, Math.round(actor.attack * multiplier * (1 - target.armor) * guarded));
        damage(target, amount);
        if (action === "torch") target.bleeding = positive(target.bleeding + 2);
        log.push(`actor: ${action} skill ${amount}`);
      } else log.push(`actor: ${action} skill miss`);
      if (target.hp > 0) strike(actor, target, rng, log, "actor");
    } else if (action === "attack") {
      strike(actor, target, rng, log, "actor");
    } else log.push("actor: skip");
    if (Object.hasOwn(COOLDOWNS, action)) actor.cooldowns[action] = COOLDOWNS[action];
    periodic(actor, target, log, "actor", true);
    return result(actor, target, log, rng, true);
  }

  function createElite(enemy, type) {
    if (!ELITES.includes(type)) throw new Error("Unknown elite type.");
    const fighter = createFighter(enemy);
    fighter.eliteType = type;
    if (type === "warlike") fighter.attack = positive(fighter.attack * 1.5);
    if (type === "experienced") {
      fighter.concentration = 1.1;
      fighter.skillCooldown = 0;
      fighter.skillCooldownMax = 1;
    }
    if (type === "punisher") fighter.accuracy = 0.95;
    if (type === "wounded") {
      fighter.hp = Math.max(1, fighter.maxHp / 2);
      fighter.attack = positive(fighter.attack * 2);
    }
    if (type === "protected") fighter.armor = Math.max(fighter.armor, 0.75);
    return fighter;
  }

  function pveModifiers(player, enemy, defensive = false) {
    const actor = createFighter(player);
    const type = enemy.eliteType || enemy.trait;
    if (type === "curse") actor.concentration = 0.05;
    if (type === "ghost") actor.accuracy = 0.05;
    if (type === "piercing" && !defensive) actor.armor = 0;
    if (type === "worldeater" || enemy.special === "worldeater") {
      actor.armor *= 0.5;
      actor.concentration *= 0.5;
      actor.accuracy *= 0.5;
    }
    return actor;
  }

  function autoSkill(actor, target, rng, log, label, bonus = 0, reduction = 0) {
    if (!actor.skillType || actor.skillCooldown > 0 ||
      sample(rng) >= clamp(0, 1, actor.concentration)) return;
    actor.skillCooldown = number(actor.skillCooldownMax, 3);
    if (actor.skillType === "guard") {
      actor.barrier = positive(actor.barrier) + positive(actor.skillDamage, actor.attack);
      log.push(`${label}: guard skill`);
    } else {
      if (actor.skillType === "shadow") actor.shadowEvade = true;
      const amount = elementalDamage(Math.max(1, Math.round(number(actor.skillDamage, actor.attack) * (1 - target.armor))), bonus, reduction);
      damage(target, amount);
      log.push(`${label}: ${actor.skillType} skill ${amount}`);
    }
  }

  function pveRound(player, enemy, rng = Math.random, effects = {}) {
    if (typeof rng !== "function") throw new Error("RNG must be a function.");
    const bonus = effects.outgoingDamage === undefined ? 0 : effects.outgoingDamage;
    const reduction = effects.incomingReduction === undefined ? 0 : effects.incomingReduction;
    if (![bonus, reduction].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
      throw new Error("Invalid PvE damage effects.");
    }
    const original = createFighter(player);
    const target = createFighter(enemy);
    if (original.hp <= 0 || target.hp <= 0) throw new Error("Combat is already finished.");
    const actor = pveModifiers(original, target);
    const log = [];
    tick(actor);
    tick(target);
    autoSkill(actor, target, rng, log, "actor", bonus);
    if (target.hp <= 0) {
      for (const key of ["armor", "accuracy", "concentration"]) actor[key] = original[key];
      return result(actor, target, log, rng, false);
    }
    autoSkill(target, actor, rng, log, "target", 0, reduction);
    strike(target, actor, rng, log, "target", 1, true, 0, reduction);
    // Both hits belong to this round even if the enemy's strike was fatal.
    strike(actor, target, rng, log, "actor", 1, true, bonus);
    periodic(actor, target, log, "actor", false, reduction);
    periodic(target, actor, log, "target");
    // Encounter modifiers are temporary, never compounded into the saved player.
    for (const key of ["armor", "accuracy", "concentration"]) actor[key] = original[key];
    return result(actor, target, log, rng, false);
  }

  function validMonty(state, chosen = false) {
    const door = (value) => Number.isInteger(value) && value >= 0 && value <= 2;
    if (!state || !door(state.prizeDoor)) throw new Error("Invalid Monty state.");
    if (!chosen && (state.selected !== null || state.revealed !== null)) throw new Error("Door already selected.");
    if (chosen && (!door(state.selected) || !door(state.revealed) ||
      state.revealed === state.selected || state.revealed === state.prizeDoor)) throw new Error("Select a door first.");
  }

  function createMonty(rng = Math.random) {
    return { prizeDoor: Math.floor(sample(rng) * 3), selected: null, revealed: null };
  }

  function chooseMonty(state, door, rng = Math.random) {
    validMonty(state);
    if (!Number.isInteger(door) || door < 0 || door > 2) throw new Error("Invalid door.");
    const goats = [0, 1, 2].filter((candidate) => candidate !== door && candidate !== state.prizeDoor);
    const revealed = goats.length === 1 ? goats[0] : goats[Math.floor(sample(rng) * goats.length)];
    return { ...state, selected: door, revealed };
  }

  function finishMonty(state, switchDoor) {
    validMonty(state, true);
    if (typeof switchDoor !== "boolean") throw new Error("Switch choice must be boolean.");
    const door = switchDoor ? [0, 1, 2].find((candidate) => candidate !== state.selected && candidate !== state.revealed) : state.selected;
    return { won: door === state.prizeDoor, door };
  }

  root.DungeonModel = Object.freeze({
    createFighter, isValidFighter, hitChance, skillChance, pvpTurn, pveRound, createElite, pveModifiers,
    createMonty, chooseMonty, finishMonty,
  });
})(typeof window !== "undefined" ? window : globalThis);
