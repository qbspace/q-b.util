// Генерация номеров РФ (формат А000АА 000) и оценка «блатности»
(function () {
  const { rnd } = window.Gen;

  // На номерах используются только буквы, совпадающие по написанию с латиницей
  const LETTERS = 'АВЕКМНОРСТУХ'.split('');
  const DIGITS = '0123456789'.split('');

  const REGIONS = {
    '01': 'Адыгея', '02': 'Башкортостан', '102': 'Башкортостан', '702': 'Башкортостан', '03': 'Бурятия', '05': 'Дагестан',
    '07': 'Кабардино-Балкария', '10': 'Карелия', '11': 'Коми', '12': 'Марий Эл', '13': 'Мордовия', '14': 'Якутия',
    '16': 'Татарстан', '116': 'Татарстан', '716': 'Татарстан', '18': 'Удмуртия', '19': 'Хакасия', '21': 'Чувашия',
    '22': 'Алтайский край', '23': 'Краснодарский край', '93': 'Краснодарский край', '123': 'Краснодарский край',
    '24': 'Красноярский край', '124': 'Красноярский край', '25': 'Приморский край', '125': 'Приморский край',
    '26': 'Ставропольский край', '27': 'Хабаровский край', '29': 'Архангельская обл.', '31': 'Белгородская обл.',
    '32': 'Брянская обл.', '33': 'Владимирская обл.', '34': 'Волгоградская обл.', '134': 'Волгоградская обл.',
    '35': 'Вологодская обл.', '36': 'Воронежская обл.', '136': 'Воронежская обл.', '37': 'Ивановская обл.',
    '38': 'Иркутская обл.', '138': 'Иркутская обл.', '39': 'Калининградская обл.', '40': 'Калужская обл.',
    '42': 'Кемеровская обл.', '142': 'Кемеровская обл.', '43': 'Кировская обл.', '44': 'Костромская обл.',
    '45': 'Курганская обл.', '46': 'Курская обл.', '47': 'Ленинградская обл.', '147': 'Ленинградская обл.',
    '48': 'Липецкая обл.', '50': 'Московская обл.', '90': 'Московская обл.', '150': 'Московская обл.',
    '190': 'Московская обл.', '750': 'Московская обл.', '790': 'Московская обл.', '51': 'Мурманская обл.',
    '52': 'Нижегородская обл.', '152': 'Нижегородская обл.', '53': 'Новгородская обл.', '54': 'Новосибирская обл.',
    '154': 'Новосибирская обл.', '55': 'Омская обл.', '56': 'Оренбургская обл.', '57': 'Орловская обл.',
    '58': 'Пензенская обл.', '59': 'Пермский край', '159': 'Пермский край', '60': 'Псковская обл.',
    '61': 'Ростовская обл.', '161': 'Ростовская обл.', '761': 'Ростовская обл.', '62': 'Рязанская обл.',
    '63': 'Самарская обл.', '163': 'Самарская обл.', '763': 'Самарская обл.', '64': 'Саратовская обл.',
    '66': 'Свердловская обл.', '96': 'Свердловская обл.', '196': 'Свердловская обл.', '67': 'Смоленская обл.',
    '68': 'Тамбовская обл.', '69': 'Тверская обл.', '70': 'Томская обл.', '71': 'Тульская обл.',
    '72': 'Тюменская обл.', '73': 'Ульяновская обл.', '74': 'Челябинская обл.', '174': 'Челябинская обл.',
    '75': 'Забайкальский край', '76': 'Ярославская обл.', '77': 'Москва', '97': 'Москва', '99': 'Москва',
    '177': 'Москва', '197': 'Москва', '199': 'Москва', '777': 'Москва', '797': 'Москва', '799': 'Москва',
    '977': 'Москва', '78': 'Санкт-Петербург', '98': 'Санкт-Петербург', '178': 'Санкт-Петербург',
    '198': 'Санкт-Петербург', '82': 'Крым', '86': 'ХМАО — Югра', '186': 'ХМАО — Югра', '89': 'ЯНАО',
    '92': 'Севастополь', '95': 'Чечня',
  };
  const REGION_CODES = Object.keys(REGIONS);
  const MOSCOW = new Set(['77', '97', '99', '177', '197', '199', '777', '797', '799', '977']);

  // Серии, которые принято считать «блатными»
  const ELITE = {
    'АМР': ['АМР', 'серия Администрации Президента', 70],
    'ЕКХ': ['ЕКХ', '«Едет Куда Хочет» — ФСО', 65],
    'ААА': ['ААА', 'правительственная серия', 55],
    'ООО': ['ООО', 'спецсерия', 50],
    'МММ': ['МММ', 'спецсерия', 45],
    'ВОР': ['ВОР', 'легендарная мем-серия', 40],
    'КМР': ['КМР', 'серия правительства Москвы', 45],
    'ММР': ['ММР', 'серия мэрии', 40],
    'ВМР': ['ВМР', 'серия мэрии', 35],
    'СМР': ['СМР', 'серия мэрии', 35],
    'ТМР': ['ТМР', 'серия мэрии', 35],
    'АОО': ['АОО', 'серия правительства', 40],
    'ХКХ': ['ХКХ', 'спецсерия', 30],
  };
  const WORDS = new Set(['КОТ', 'ТОК', 'РОК', 'СОК', 'НОС', 'СОН', 'РОТ', 'ХОР', 'ВОТ', 'ТАК', 'МАК', 'РАК', 'ХАН', 'ВЕК', 'МОР', 'ТОР', 'КОМ', 'СОМ', 'ХАМ', 'ТАМ', 'ВАН', 'МАХ', 'ОХА', 'АХА', 'ОКО', 'ОНО', 'ТАТ']);

  const TIERS = [
    { id: 'common', name: 'Обычный', min: 0, color: '#9a9a95' },
    { id: 'uncommon', name: 'Необычный', min: 8, color: '#5fc2ae' },
    { id: 'rare', name: 'Редкий', min: 20, color: '#5b8def' },
    { id: 'epic', name: 'Эпический', min: 40, color: '#a06cf0' },
    { id: 'legendary', name: 'Легендарный', min: 65, color: '#f0b35a' },
    { id: 'mythic', name: 'Мифический', min: 100, color: '#ff4d6d' },
  ];

  const MOSCOW_CODES = [...MOSCOW];

  // moscowChance — бонус от улучшения «Московская прописка»
  // r — источник случайности: по умолчанию криптостойкий, в онлайн-батле общий для обоих игроков
  function random(moscowChance = 0, r = rnd) {
    let digits;
    do digits = String(r.int(0, 9)) + r.int(0, 9) + r.int(0, 9); while (digits === '000'); // 000 не выдаётся
    return {
      l1: r.pick(LETTERS),
      digits,
      l2: r.pick(LETTERS) + r.pick(LETTERS),
      region: moscowChance && r.int(0, 9999) < moscowChance * 10000 ? r.pick(MOSCOW_CODES) : r.pick(REGION_CODES),
    };
  }

  function score(p) {
    const reasons = [];
    const add = (pts, label, text, key) => reasons.push({ pts, label, text, key });
    const d = p.digits, [a, b, c] = d;
    const series = p.l1 + p.l2;

    // цифры
    if (d === '777') add(60, '777', 'три семёрки', 's777');
    else if (a === b && b === c) add(45, d, 'три одинаковые цифры');
    else if (d.startsWith('00')) add(40, d, 'первая десятка');
    else if (a === '0' && c === '0') add(25, d, 'круглый номер');
    else if (b === '0' && c === '0') add(25, d, 'круглая сотня');
    else if ('0123456789'.includes(d) || '9876543210'.includes(d)) add(15, d, 'цифры по порядку');
    else if (a === c) add(12, d, 'зеркальный номер');
    else if (a === b || b === c) add(5, d, 'пара цифр');

    // буквы
    if (ELITE[series]) add(ELITE[series][2], series, ELITE[series][1], 'elite');
    else if (p.l1 === p.l2[0] && p.l2[0] === p.l2[1]) add(40, series, 'три одинаковые буквы');
    else if (WORDS.has(series)) add(15, series, 'читается как слово', 'word');
    else if (p.l1 === p.l2[0] || p.l2[0] === p.l2[1] || p.l1 === p.l2[1]) add(4, series, 'пара букв');

    // одинаковые цифры и буквы-«нули»: О000О/ООО и т.п.
    if (series === 'ООО' && /^0+[1-9]?$/.test(d)) add(15, 'О0О', 'нули к нулям');

    // регион
    if (p.region === '77') add(15, '77', 'старая Москва', 'r77');
    else if (p.region === '777' || p.region === '797' || p.region === '799') add(12, p.region, 'Москва, «топовый» регион');
    else if (MOSCOW.has(p.region)) add(8, p.region, 'Москва');
    else if (p.region === '78') add(8, '78', 'старый Петербург');
    else if (REGIONS[p.region] === 'Санкт-Петербург') add(5, p.region, 'Петербург');

    let total = reasons.reduce((s, r) => s + r.pts, 0);
    // блатная серия + красивые цифры — множитель
    const digitsNice = reasons.some((r) => r.label === d && r.pts >= 25);
    const lettersNice = reasons.some((r) => r.label === series && r.pts >= 40);
    if (digitsNice && lettersNice) {
      total = Math.round(total * 1.5);
      reasons.push({ pts: 0, label: '×1.5', text: 'красивые цифры + блатная серия' });
    }

    const tier = [...TIERS].reverse().find((t) => total >= t.min);
    return { total, tier, reasons };
  }

  // Вероятность выпасть для каждой редкости — посчитано заранее на 1 млн случайных номеров
  const ODDS = { common: 0.719, uncommon: 0.214, rare: 0.0366, epic: 0.0279, legendary: 0.00152, mythic: 0.000273 };

  /* ---------------- экономика ---------------- */
  // Выплата за редкость при ставке 10. Базовая отдача ~93%, с полной прокачкой ~108%
  const SPIN_COST = 10;
  const PAYOUT = { common: 2, uncommon: 13, rare: 45, epic: 75, legendary: 500, mythic: 2000 };
  const BETS = [1, 2, 5, 10];

  const UPGRADES = [
    { id: 'luck', name: 'Связи в ГИБДД', icon: '🤝', per: 1.5, prices: [200, 500, 1200, 2500, 5000],
      desc: (v) => `${v}% шанс крутануть дважды и забрать лучший номер` },
    { id: 'moscow', name: 'Московская прописка', icon: '🏛', per: 2, prices: [400, 1500],
      desc: (v) => `${v}% шанс, что выпадет московский регион` },
    { id: 'collector', name: 'Перекупщик', icon: '💼', per: 2, prices: [300, 1200, 4000],
      desc: (v) => `+${v}% ко всем выплатам` },
    { id: 'garage', name: 'Гараж', icon: '🚗', per: 1, prices: [150, 400, 1000, 2500, 6000],
      desc: (v) => `+${v} монет в минуту, даже когда приложение закрыто (до 6 ч)` },
    { id: 'auto', name: 'Автокрутка ×10', icon: '⚡', per: 1, prices: [600],
      desc: () => 'Кнопка «×10»: десять круток подряд, стоп на легендарке' },
    { id: 'highroller', name: 'Высокие ставки', icon: '🎲', per: 1, prices: [1000],
      desc: () => 'Открывает ставки ×5 и ×10 — больше риск, больше куш' },
  ];

  // Скины — чистая косметика, на баланс не влияют
  const SKINS = [
    { id: 'classic', name: 'Классика', price: 0 },
    { id: 'night', name: 'Ночь', price: 800 },
    { id: 'gold', name: 'Золото', price: 2500 },
    { id: 'neon', name: 'Неон', price: 5000 },
    { id: 'holo', name: 'Голограмма', price: 12000 },
  ];

  const TIER_INDEX = Object.fromEntries(TIERS.map((t, i) => [t.id, i]));
  const atLeast = (st, tier) => Object.entries(st.tiers || {}).some(([id, n]) => n > 0 && TIER_INDEX[id] >= TIER_INDEX[tier]);
  const QUESTS = [
    { id: 'spin1', name: 'Первая крутка', reward: 20, done: (s) => s.spins >= 1 },
    { id: 'spin100', name: '100 круток', reward: 200, done: (s) => s.spins >= 100, progress: (s) => [s.spins, 100] },
    { id: 'spin1000', name: '1000 круток', reward: 1500, done: (s) => s.spins >= 1000, progress: (s) => [s.spins, 1000] },
    { id: 'rare', name: 'Выбей «Редкий» или выше', reward: 50, done: (s) => atLeast(s, 'rare') },
    { id: 'epic', name: 'Выбей «Эпический» или выше', reward: 120, done: (s) => atLeast(s, 'epic') },
    { id: 'legendary', name: 'Выбей «Легендарный» или выше', reward: 600, done: (s) => atLeast(s, 'legendary') },
    { id: 'mythic', name: 'Выбей «Мифический»', reward: 2500, done: (s) => atLeast(s, 'mythic') },
    { id: 's777', name: 'Три семёрки', reward: 300, done: (s) => !!(s.flags || {}).s777 },
    { id: 'elite', name: 'Любая блатная серия (АМР, ЕКХ…)', reward: 300, done: (s) => !!(s.flags || {}).elite },
    { id: 'word', name: 'Номер-слово', reward: 80, done: (s) => !!(s.flags || {}).word },
    { id: 'r77', name: 'Регион 77', reward: 40, done: (s) => !!(s.flags || {}).r77 },
    { id: 'upgrade', name: 'Купи первое улучшение', reward: 50, done: (s) => Object.values(s.upgrades || {}).some((l) => l > 0) },
    { id: 'skin', name: 'Купи скин номера', reward: 100, done: (s) => (s.skins || []).length > 1 },
    { id: 'bigwin', name: 'Выиграй 1 000 за одну крутку', reward: 500, done: (s) => (s.bestWin || 0) >= 1000 },
    { id: 'work', name: 'Отработай 20 заданий', reward: 100, done: (s) => (s.jobs || 0) >= 20, progress: (s) => [Math.min(s.jobs || 0, 20), 20] },
    { id: 'case1', name: 'Открой первый кейс', reward: 30, done: (s) => (s.casesOpened || 0) >= 1 },
    { id: 'case50', name: 'Открой 50 кейсов', reward: 400, done: (s) => (s.casesOpened || 0) >= 50, progress: (s) => [Math.min(s.casesOpened || 0, 50), 50] },
    { id: 'caseGold', name: 'Выбей ★ из кейса', reward: 1500, done: (s) => !!(s.flags || {}).caseGold },
    { id: 'online1', name: 'Выиграй онлайн-батл', reward: 150, done: (s) => ((s.pvpStats || {}).wins || 0) >= 1 },
    { id: 'rich', name: 'Накопи 5 000 монет', reward: 400, done: (s) => s.coins >= 5000, progress: (s) => [Math.min(s.coins, 5000), 5000] },
  ];


  /* ---------------- заказы, уровни, колесо ---------------- */
  // Награда за заказ ≈ 0.15 / вероятность: в среднем заказ добавляет ~1.5% отдачи на ставке ×1
  const ORDER_K = 0.15, ORDER_MIN = 15;
  const pickL = () => rnd.pick(LETTERS);
  const regionGroups = (() => {
    const g = {};
    Object.entries(REGIONS).forEach(([code, name]) => { (g[name] = g[name] || []).push(code); });
    delete g['Москва'];
    delete g['Санкт-Петербург'];
    return Object.entries(g);
  })();

  const ORDER_TEMPLATES = [
    { w: 1, make: () => {
      const d = String(rnd.int(1, 9)).repeat(3);
      return { text: `Цифры ${d}`, p: 1 / 999 };
    } },
    { w: 2, make: () => ({ text: 'Три одинаковые цифры', p: 0.0089 }) },
    { w: 2, make: () => {
      const a = pickL(), b = pickL();
      return { text: `Начинается на ${a}, кончается на ${b}`, p: 1 / 144 };
    } },
    { w: 2, make: () => {
      const s = pickL() + pickL();
      return { text: `Серия заканчивается на ${s}`, p: 1 / 144 };
    } },
    { w: 2, make: () => ({ text: 'Три одинаковые буквы', p: 0.007 }) },
    { w: 2, make: () => ({ text: 'Цифры по порядку (123, 987…)', p: 0.0157 }) },
    { w: 2, make: () => ({ text: 'Номер-слово (КОТ, РОК…)', p: 0.0155 }) },
    { w: 1, make: () => ({ text: 'Любой «Легендарный» или выше', p: 0.0019 }) },
    { w: 3, make: () => {
      const [name, codes] = rnd.pick(regionGroups);
      return {
        text: `${name} (${codes.join(', ')}) и «Необычный»+`,
        p: (codes.length / REGION_CODES.length) * 0.28,
      };
    } },
  ];
  const ORDER_TTL = 20 * 60000;
  const CLIENTS = ['Ашот', 'Гоша с рынка', 'Дядя Валера', 'Тимур', 'Серёга-таксист', 'Рустам', 'Михалыч', 'Арсен', 'Батя Кирилла', 'Жека'];

  function makeOrder() {
    const total = ORDER_TEMPLATES.reduce((s, t) => s + t.w, 0);
    let r = rnd.int(0, total - 1), tpl = ORDER_TEMPLATES[0];
    for (const t of ORDER_TEMPLATES) { if ((r -= t.w) < 0) { tpl = t; break; } }
    const o = tpl.make();
    return {
      id: Date.now().toString(36) + rnd.int(0, 1e6).toString(36),
      tpl: ORDER_TEMPLATES.indexOf(tpl), text: o.text, client: rnd.pick(CLIENTS),
      reward: Math.max(ORDER_MIN, Math.round(ORDER_K / o.p / 5) * 5),
      expires: Date.now() + ORDER_TTL,
    };
  }

  // Условие заказа восстанавливаем из текста — так заказы переживают перезапуск
  function orderTest(order, pl, sc) {
    const t = order.text;
    let m;
    if ((m = t.match(/^Цифры (\d{3})$/))) return pl.digits === m[1];
    if (t === 'Три одинаковые цифры') return /^(\d)\1\1$/.test(pl.digits);
    if ((m = t.match(/^Начинается на (.), кончается на (.)$/))) return pl.l1 === m[1] && pl.l2[1] === m[2];
    if ((m = t.match(/^Серия заканчивается на (..)$/))) return pl.l2 === m[1];
    if (t === 'Три одинаковые буквы') return pl.l1 === pl.l2[0] && pl.l2[0] === pl.l2[1];
    if (t.startsWith('Цифры по порядку')) return '0123456789'.includes(pl.digits) || '9876543210'.includes(pl.digits);
    if (t.startsWith('Номер-слово')) return sc.reasons.some((r) => r.key === 'word');
    if (t.startsWith('Любой «Легендарный»')) return TIERS.indexOf(sc.tier) >= 4;
    if ((m = t.match(/\(([\d, ]+)\) и «Необычный»\+$/))) return m[1].split(', ').includes(pl.region) && TIERS.indexOf(sc.tier) >= 1;
    return false;
  }

  // Уровни: опыт за крутку 1 + 2×редкость, награда за уровень небольшая
  const xpNeed = (lvl) => 40 + 20 * (lvl - 1);
  const levelReward = (lvl) => 6 + 3 * lvl;
  const TITLES = [
    [1, 'Пешеход'], [3, 'Таксист'], [6, 'Бомбила'], [10, 'Перекупщик'], [15, 'Блатной'],
    [22, 'Авторитет'], [30, 'Вор в законе'], [40, 'Смотрящий за ГИБДД'],
  ];
  const titleFor = (lvl) => [...TITLES].reverse().find(([l]) => lvl >= l)[1];

  const JACKPOT_SEED = 500, JACKPOT_RATE = 0.03;
  const WHEEL = [30, 50, 75, 100, 50, 150, 30, 300];

  const format = (p) => `${p.l1}${p.digits}${p.l2}${p.region}`;

  window.Plates = {
    LETTERS, DIGITS, REGIONS, REGION_CODES, TIERS, ODDS, random, score, format,
    SPIN_COST, PAYOUT, BETS, UPGRADES, SKINS, QUESTS,
    makeOrder, orderTest, ORDER_TTL, xpNeed, levelReward, titleFor, JACKPOT_SEED, JACKPOT_RATE, WHEEL,
  };
})();
