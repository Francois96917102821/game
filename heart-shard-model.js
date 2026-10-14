"use strict";

(function attachHeartShardModel(root) {
  const MAX_SHARDS = 100000;
  const MAX_RECEIPTS = 100000;
  const SOURCE_REWARDS = Object.freeze({
    "fish-processing": 1,
    "deep-flower": 1,
    "shard-dive": 2,
  });
  const EVENT_SOURCES = Object.freeze(["deep-flower", "shard-dive"]);
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function isValidReceipt(receipt, allowedSources = Object.keys(SOURCE_REWARDS)) {
    return Boolean(receipt && typeof receipt === "object" &&
      typeof receipt.id === "string" && UUID.test(receipt.id) &&
      allowedSources.includes(receipt.source) &&
      Number.isInteger(receipt.shards) && receipt.shards >= 0 &&
      receipt.shards <= SOURCE_REWARDS[receipt.source]);
  }

  function isValidReceipts(receipts, allowedSources = Object.keys(SOURCE_REWARDS)) {
    return Array.isArray(receipts) && receipts.length <= MAX_RECEIPTS &&
      receipts.every((receipt) => isValidReceipt(receipt, allowedSources)) &&
      new Set(receipts.map((receipt) => receipt.id)).size === receipts.length;
  }

  function issue(receipts, id, source, balance) {
    const allowedSources = source === "fish-processing" ? [source] : EVENT_SOURCES;
    if (!isValidReceipts(receipts, allowedSources) ||
      typeof id !== "string" || !UUID.test(id) || !Object.hasOwn(SOURCE_REWARDS, source) ||
      !Number.isInteger(balance) || balance < 0 || balance > MAX_SHARDS) {
      return { ok: false, reason: "invalid" };
    }
    if (receipts.some((receipt) => receipt.id === id)) return { ok: false, reason: "duplicate" };
    if (receipts.length >= MAX_RECEIPTS) return { ok: false, reason: "ledger-full" };
    const shards = Math.min(SOURCE_REWARDS[source], MAX_SHARDS - balance);
    const receipt = { id, source, shards };
    return { ok: true, receipt, receipts: [...receipts, receipt], shards, balance: balance + shards };
  }

  function mergeReceipts(...ledgers) {
    const receiptsById = new Map();
    const conflicts = new Set();
    for (const receipts of ledgers) {
      if (!isValidReceipts(receipts, EVENT_SOURCES)) throw new Error("Квитанции сердечных осколков повреждены.");
      for (const receipt of receipts) {
        const existing = receiptsById.get(receipt.id);
        if (!existing) receiptsById.set(receipt.id, receipt);
        else if (JSON.stringify(existing) !== JSON.stringify(receipt)) conflicts.add(receipt.id);
      }
    }
    return [...receiptsById.entries()]
      .filter(([id]) => !conflicts.has(id))
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(0, MAX_RECEIPTS)
      .map(([, receipt]) => ({ ...receipt }));
  }

  function balance(eventReceipts, fishReceipts) {
    if (!isValidReceipts(eventReceipts, EVENT_SOURCES) ||
      !isValidReceipts(fishReceipts, ["fish-processing"])) {
      throw new Error("Квитанции сердечных осколков повреждены.");
    }
    const byId = new Map();
    const conflicts = new Set();
    for (const receipt of [...eventReceipts, ...fishReceipts]) {
      const existing = byId.get(receipt.id);
      if (!existing) byId.set(receipt.id, receipt);
      else if (JSON.stringify(existing) !== JSON.stringify(receipt)) conflicts.add(receipt.id);
    }
    const total = [...byId.entries()]
      .filter(([id]) => !conflicts.has(id))
      .reduce((sum, [, receipt]) => sum + receipt.shards, 0);
    return Math.min(MAX_SHARDS, total);
  }

  root.WellHeartShardModel = Object.freeze({
    EVENT_SOURCES,
    MAX_RECEIPTS,
    MAX_SHARDS,
    SOURCE_REWARDS,
    balance,
    isValidReceipt,
    isValidReceipts,
    issue,
    mergeReceipts,
  });
})(typeof window !== "undefined" ? window : globalThis);
