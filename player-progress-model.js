"use strict";

(() => {
  const VERSION = 1;
  const MAX_COUNT = 1_000_000_000;
  const MAX_FLOOR = 1_000_000;
  const ACHIEVEMENTS = [
    {
      id: "first-descent",
      title: "Первый шаг",
      description: "Начать первый спуск в колодец.",
      unlocked: (stats) => stats.descentsStarted >= 1,
    },
    {
      id: "first-guardian",
      title: "Страж пал",
      description: "Победить первого стража колодца.",
      unlocked: (stats) => stats.guardiansDefeated >= 1,
    },
    {
      id: "second-floor",
      title: "Глубже во тьму",
      description: "Спуститься на второй этаж.",
      unlocked: (stats) => stats.deepestFloor >= 2,
    },
  ];

  function createStats() {
    return { version: VERSION, descentsStarted: 0, guardiansDefeated: 0, deepestFloor: 0 };
  }

  function isCount(value, maximum = MAX_COUNT) {
    return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
  }

  function isValidStats(value) {
    return Boolean(
      value && typeof value === "object" && !Array.isArray(value) &&
      value.version === VERSION &&
      isCount(value.descentsStarted) &&
      isCount(value.guardiansDefeated) &&
      isCount(value.deepestFloor, MAX_FLOOR),
    );
  }

  function normalizeStats(value) {
    const stats = createStats();
    if (!value || typeof value !== "object" || Array.isArray(value) ||
      (value.version !== undefined && value.version !== VERSION)) return stats;
    return {
      version: VERSION,
      descentsStarted: isCount(value.descentsStarted) ? value.descentsStarted : 0,
      guardiansDefeated: isCount(value.guardiansDefeated) ? value.guardiansDefeated : 0,
      deepestFloor: isCount(value.deepestFloor, MAX_FLOOR) ? value.deepestFloor : 0,
    };
  }

  function record(stats, event, value) {
    const next = normalizeStats(stats);
    if (event === "descent-started") {
      next.descentsStarted = Math.min(MAX_COUNT, next.descentsStarted + 1);
      next.deepestFloor = Math.max(1, next.deepestFloor);
    } else if (event === "guardian-defeated") {
      next.guardiansDefeated = Math.min(MAX_COUNT, next.guardiansDefeated + 1);
    } else if (event === "floor-reached" && isCount(value, MAX_FLOOR) && value >= 1) {
      next.deepestFloor = Math.max(next.deepestFloor, value);
    }
    return next;
  }

  function listAchievements(stats) {
    const normalized = normalizeStats(stats);
    return ACHIEVEMENTS.map(({ id, title, description, unlocked }) => ({
      id,
      title,
      description,
      unlocked: unlocked(normalized),
    }));
  }

  window.WellPlayerProgressModel = Object.freeze({
    createStats,
    isValidStats,
    normalizeStats,
    record,
    listAchievements,
  });
})();
