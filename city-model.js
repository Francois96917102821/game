(function (root) {
  "use strict";

  const CITY_DISTRICTS = {
    main: {
      title: "Основной район",
      kicker: "СЕРДЦЕ ГОРОДА",
      description: "Здесь путники готовятся к спуску и выбирают свой дальнейший путь.",
      services: [
        { icon: "◉", name: "Колодец", description: "Спуск в подземелья. Продолжи сохранённый забег или начни новый.", status: "ready", statusLabel: "ДОСТУПНО", action: "well" },
        { icon: "⌑", name: "Ворота", description: "Путь за город и путешествия по окрестностям.", status: "soon", statusLabel: "СКОРО" },
        {
          icon: "⚔",
          name: "Гильдия охотников",
          description: "Ежедневные задания, обмен трофеев на золото и репутацию, лавка за репутацию и расширение мешка. Сейчас здесь доступны только постоянные улучшения за осколки — в панели путника.",
          status: "partial",
          statusLabel: "ЧАСТИЧНО",
          action: "upgrades",
          actionLabel: "К улучшениям за осколки",
        },
        { icon: "✦", name: "Башня магов", description: "Временные зачарования, перераспределение характеристик и дополнительные ячейки пассивных умений.", status: "soon", statusLabel: "СКОРО" },
        {
          icon: "ᛟ",
          name: "Орден глубин",
          description: "Классы, развитие владения оружием и доспехами и мастера за репутацию. Выбор классов уже действует: первый продвинутый класс на 3-м уровне открывает Верхний квартал.",
          status: "partial",
          statusLabel: "КЛАССЫ ДОСТУПНЫ",
          action: "classes",
          actionLabel: "Выбрать путь для нового спуска",
        },
      ],
    },
    port: {
      title: "Портовый квартал",
      kicker: "ОТКРЫТ ВСЕМ ПУТНИКАМ",
      description: "Пристанище у воды открыто сразу; таверна принимает путников, остальные службы отмечены отдельно.",
      services: [
        { icon: "♨", name: "Таверна", description: "Еда, временная работа, комнаты отдыха и игры на золото. Поиск игроков и гильдий пока недоступен.", status: "ready", statusLabel: "ДОСТУПНО", action: "tavern", actionLabel: "Войти в таверну" },
        { icon: "⚓", name: "Пристань", description: "Покупай билеты и отправляйся в сюжетные экспедиции на дальние острова.", status: "ready", statusLabel: "ЭКСПЕДИЦИИ", action: "harbor", actionLabel: "Открыть пристань" },
        { icon: "⚒", name: "Мастерская", description: "Место для творческих заказов и работ.", status: "soon", statusLabel: "СКОРО" },
        { icon: "◈", name: "Гильдия убийц", description: "Заказы на PvP-схватки с другими игроками.", status: "soon", statusLabel: "СКОРО" },
      ],
    },
    upper: {
      title: "Верхний квартал",
      kicker: "РАЙОН ДЛЯ ОПЫТНЫХ ИСКАТЕЛЕЙ",
      description: "Элитная часть города с ареной, домами и местами для самых известных героев.",
      services: [
        { icon: "⚔", name: "Арена", description: "PvP и элитные монстры для героев высокого уровня.", status: "soon", statusLabel: "СКОРО" },
        { icon: "⌂", name: "Домашняя лавка", description: "Покупка домов, участки, мастерские, пруд, сад и доступные комнаты.", status: "ready", statusLabel: "ДОСТУПНО", action: "homestead", actionLabel: "Магазин · Дома" },
        { icon: "▤", name: "Ратуша", description: "Гильдии, купоны и городские события.", status: "soon", statusLabel: "СКОРО" },
        { icon: "✧", name: "Аллея славы", description: "Статуи великих игроков и их истории.", status: "soon", statusLabel: "СКОРО" },
      ],
    },
  };

  const api = Object.freeze({ CITY_DISTRICTS });
  root.WellCityModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
