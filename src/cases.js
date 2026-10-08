// Кейсы в стиле CS: шансы редкостей как в оригинале, средняя отдача ~88% цены кейса
(function () {
  const { rnd } = window.Gen;

  const RARITIES = [
    { id: 'mil', name: 'Армейское качество', color: '#4b69ff', p: 0.7992, mult: 0.42 },
    { id: 'res', name: 'Запрещённое', color: '#8847ff', p: 0.1598, mult: 1.21 },
    { id: 'cls', name: 'Засекреченное', color: '#d32ce6', p: 0.032, mult: 3.62 },
    { id: 'cov', name: 'Тайное', color: '#eb4b4b', p: 0.0064, mult: 14.5 },
    { id: 'gold', name: '★ Редкий особый предмет', color: '#ffd700', p: 0.0026, mult: 54.3 },
  ];

  // Износ: множитель к цене, в среднем ~1
  const WEAR = [
    { id: 'FN', name: 'Прямо с завода', p: 0.07, k: 1.25 },
    { id: 'MW', name: 'Немного поношенное', p: 0.14, k: 1.1 },
    { id: 'FT', name: 'После полевых испытаний', p: 0.38, k: 1.04 },
    { id: 'WW', name: 'Поношенное', p: 0.16, k: 0.9 },
    { id: 'BS', name: 'Закалённое в боях', p: 0.25, k: 0.8 },
  ];
  const STATTRAK_P = 0.1, STATTRAK_K = 1.3;

  const CASES = [
    {
      id: 'garage', name: 'Гаражный кейс', icon: '🧰', price: 50, hue: '#5b8def',
      items: {
        mil: [['Ёлочка-вонючка', '🌲'], ['Кубики на зеркало', '🎲'], ['Брелок от сигналки', '🔑'], ['Наклейка «Я за рулём»', '🏷️']],
        res: [['Тонировка в круг', '🕶️'], ['Ксенон 6000K', '💡'], ['Саб в багажник', '🔊']],
        cls: [['Литьё R18', '🛞'], ['Прямоток', '💨']],
        cov: [['Пневма на «Приору»', '🛻']],
        gold: [['Мигалка', '🚨']],
      },
    },
    {
      id: 'blat', name: 'Блатной кейс', icon: '💼', price: 250, hue: '#a06cf0',
      items: {
        mil: [['ВАЗ-2107 «Семёрка»', '🚗'], ['Лада Приора', '🚙'], ['Логан в такси', '🚕']],
        res: [['Camry 3.5', '🚘'], ['Солярис на чёрных дисках', '🚗']],
        cls: [['BMW M5 F90', '🏎️'], ['Mercedes E63', '🏎️']],
        cov: [['Гелик G63', '🚙']],
        gold: [['Номер А777МР 77', '🪪']],
      },
    },
    {
      id: 'boss', name: 'Кейс Смотрящего', icon: '👑', price: 1000, hue: '#f0b35a',
      items: {
        mil: [['Кожаный салон', '🛋️'], ['Камеры 360°', '📷'], ['Шумоизоляция', '🔇']],
        res: [['Синее ведёрко', '🔵'], ['Кортеж из трёх машин', '🚓']],
        cls: [['Майбах', '🚘'], ['Бронированный Аурус', '🛡️']],
        cov: [['Личный вертолёт', '🚁']],
        gold: [['Пропуск «Везде»', '🎫']],
      },
    },
  ];

  function pickRarity() {
    let r = rnd.int(0, 999999) / 1e6;
    for (const ra of RARITIES) { if ((r -= ra.p) < 0) return ra; }
    return RARITIES[0];
  }
  function pickWear() {
    let r = rnd.int(0, 999999) / 1e6;
    for (const w of WEAR) { if ((r -= w.p) < 0) return w; }
    return WEAR[2];
  }

  // Предмет без износа — для ленты рулетки
  function rollItem(c, rarity = pickRarity()) {
    const [name, icon] = rnd.pick(c.items[rarity.id]);
    return { name, icon, rarity: rarity.id, caseId: c.id };
  }

  // Полный дроп: износ, StatTrak и цена продажи
  function openCase(c) {
    const item = rollItem(c);
    const ra = RARITIES.find((x) => x.id === item.rarity);
    const wear = pickWear();
    const st = rnd.int(0, 999) < STATTRAK_P * 1000;
    const value = Math.max(1, Math.round(c.price * ra.mult * wear.k * (st ? STATTRAK_K : 1)));
    return { ...item, wear: wear.id, st, value, id: Date.now().toString(36) + rnd.int(0, 1e6).toString(36), ts: Date.now() };
  }

  window.Cases = { RARITIES, WEAR, CASES, rollItem, openCase };
})();
