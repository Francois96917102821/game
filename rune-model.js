"use strict";

(function attachRuneModel(root) {
  const MAX_RECEIPTS = 100000;
  const DROP_RATE_PER_TYPE = 0.04;
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const RUNES = Object.freeze({
    attack: Object.freeze({
      name: "Атака", price: 500, cap: (level) => Math.max(0, (level - 29) * 2),
      effect: "+1 к силе удара",
    }),
    armor: Object.freeze({
      name: "Броня", price: 1000, cap: (level) => Math.max(0, level - 29),
      effect: "+1 к защите (6 п. п. снижения физического урона)",
    }),
    resistance: Object.freeze({
      name: "Сопротивление", price: 1000, cap: (level) => Math.max(0, level - 29),
      effect: "+1 п. п. снижения входящего урона",
    }),
    accuracy: Object.freeze({
      name: "Точность", price: 2000, cap: (level) => Math.max(0, Math.ceil((level - 29) / 2)),
      effect: "+1 п. п. точности",
    }),
    concentration: Object.freeze({
      name: "Концентрация", price: 4000, cap: (level) => Math.max(0, Math.floor(level / 5) - 5),
      effect: "+1 п. п. концентрации",
    }),
    luck: Object.freeze({
      name: "Удача", price: 10000, cap: (level) => Math.max(0, Math.floor(level / 5) - 5),
      effect: "+1 п. п. к шансу боевой добычи",
    }),
  });

  function sample(rng) {
    if (typeof rng !== "function") throw new Error("RNG must be a function.");
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error("RNG must return a number in [0, 1).");
    }
    return value;
  }

  function validType(type) {
    return Object.prototype.hasOwnProperty.call(RUNES, type);
  }

  function counts(drops) {
    const found = Object.fromEntries(Object.keys(RUNES).map((type) => [type, 0]));
    for (const receipt of mergeDrops(drops, [])) {
      if (receipt && validType(receipt.type) && Number.isInteger(receipt.count) && receipt.count > 0) {
        found[receipt.type] = Math.min(1000000000, found[receipt.type] + receipt.count);
      }
    }
    return found;
  }

  function inventory(drops, uses) {
    const owned = counts(drops);
    for (const receipt of uses || []) {
      if (isValidUse(receipt)) owned[receipt.type] = Math.max(0, owned[receipt.type] - 1);
    }
    return owned;
  }

  function isValidDrop(receipt) {
    return Boolean(
      receipt && typeof receipt === "object" && UUID.test(receipt.id) &&
      validType(receipt.type) && Number.isInteger(receipt.level) && receipt.level >= 30 &&
      Number.isInteger(receipt.count) && receipt.count >= 1 && receipt.count <= 2 &&
      receipt.count <= RUNES[receipt.type].cap(receipt.level),
    );
  }

  function isValidUse(receipt) {
    return Boolean(
      receipt && typeof receipt === "object" && UUID.test(receipt.id) &&
      validType(receipt.type) && receipt.cost === RUNES[receipt.type].price,
    );
  }

  function isValidReceipts(receipts, validator) {
    return Array.isArray(receipts) && receipts.length <= MAX_RECEIPTS &&
      receipts.every(validator) && new Set(receipts.map((receipt) => receipt.id)).size === receipts.length;
  }

  function mergeDrops(first, second) {
    const byId = new Map();
    for (const receipt of [...(first || []), ...(second || [])]) {
      if (!isValidDrop(receipt)) continue;
      const existing = byId.get(receipt.id);
      if (!existing || JSON.stringify(receipt) < JSON.stringify(existing)) byId.set(receipt.id, receipt);
    }
    const found = Object.fromEntries(Object.keys(RUNES).map((type) => [type, 0]));
    const accepted = [];
    for (const receipt of [...byId.values()].sort((a, b) =>
      b.level - a.level || a.id.localeCompare(b.id))) {
      const remaining = Math.max(0, RUNES[receipt.type].cap(receipt.level) - found[receipt.type]);
      const count = Math.min(receipt.count, remaining);
      if (!count) continue;
      accepted.push({ ...receipt, count });
      found[receipt.type] += count;
    }
    return accepted.sort((a, b) => a.id.localeCompare(b.id));
  }

  function rollDrop(level, drops, rng = Math.random, hasRuneRing = false) {
    if (!Number.isInteger(level) || level < 30) return null;
    const found = counts(drops);
    const roll = sample(rng);
    let threshold = 0;
    for (const type of Object.keys(RUNES)) {
      const cap = RUNES[type].cap(level);
      const remaining = Math.max(0, cap - found[type]);
      if (!remaining) continue;
      threshold = Math.round((threshold + DROP_RATE_PER_TYPE * (remaining / cap)) * 1e12) / 1e12;
      if (roll < threshold) {
        return { type, count: Math.min(hasRuneRing ? 2 : 1, remaining), level };
      }
    }
    return null;
  }

  function mergeUses(first, second, drops, availableReputation) {
    const found = counts(drops);
    const owned = { ...found };
    const byId = new Map();
    for (const receipt of [...(first || []), ...(second || [])]) {
      if (!isValidUse(receipt)) continue;
      const existing = byId.get(receipt.id);
      if (!existing || JSON.stringify(receipt) < JSON.stringify(existing)) byId.set(receipt.id, receipt);
    }
    let reputation = Math.max(0, Math.min(1000000000, availableReputation));
    const accepted = [];
    for (const receipt of [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))) {
      if (owned[receipt.type] < 1 || reputation < receipt.cost) continue;
      owned[receipt.type] -= 1;
      reputation -= receipt.cost;
      accepted.push(receipt);
    }
    return { drops: found, owned, uses: accepted, reputation };
  }

  function stats(uses) {
    const result = Object.fromEntries(Object.keys(RUNES).map((type) => [type, 0]));
    for (const receipt of uses || []) {
      if (isValidUse(receipt)) result[receipt.type] = Math.min(1000000000, result[receipt.type] + 1);
    }
    return result;
  }

  root.WellRuneModel = Object.freeze({
    RUNES, DROP_RATE_PER_TYPE, validType, counts, inventory, isValidDrop, isValidUse, isValidReceipts,
    rollDrop, mergeDrops, mergeUses, stats,
  });
})(typeof window !== "undefined" ? window : globalThis);
