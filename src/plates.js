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
  // Выплата за редкость при ставке 10. Базовая отдача ~123%, с полной прокачкой ~146% —
  // крутить выгодно, баланс растёт, а ставки ×25…×100 разгоняют его ещё быстрее
  const SPIN_COST = 10;
  const PAYOUT = { common: 3, uncommon: 17, rare: 58, epic: 98, legendary: 650, mythic: 2600 };
  const BETS = [1, 2, 5, 10, 25, 50, 100];
  // какие ставки открывает каждый уровень «Высоких ставок»
  const BET_UNLOCK = [2, 10, 50, 100];

  const UPGRADES = [
    { id: 'luck', name: 'Связи в ГИБДД', icon: '🤝', per: 1.5, prices: [200, 500, 1200, 2500, 5000],
      desc: (v) => `${v}% шанс крутануть дважды и забрать лучший номер` },
    { id: 'moscow', name: 'Московская прописка', icon: '🏛', per: 2, prices: [400, 1500],
      desc: (v) => `${v}% шанс, что выпадет московский регион` },
    { id: 'collector', name: 'Перекупщик', icon: '💼', per: 2, prices: [300, 1200, 4000],
      desc: (v) => `+${v}% ко всем выплатам` },
    { id: 'garage', name: 'Гараж', icon: '🚗', values: [2, 5, 10, 20, 40], prices: [150, 600, 2500, 10000, 40000],
      desc: (v) => `+${v} монет в минуту, даже когда приложение закрыто (до 12 ч)` },
    { id: 'auto', name: 'Автокрутка ×10', icon: '⚡', per: 1, prices: [600],
      desc: () => 'Кнопка «×10»: десять круток подряд, стоп на легендарке' },
    { id: 'highroller', name: 'Высокие ставки', icon: '🎲', values: ['×5 и ×10', '×25 и ×50', '×100'], prices: [1000, 15000, 100000],
      desc: (v) => `Открывает ставки ${v}` },
  ];

  // Скины — чистая косметика, на баланс не влияют
  const SKINS = [
    { id: 'classic', name: 'Классика', price: 0 },
    { id: 'night', name: 'Ночь', price: 800 },
    { id: 'gold', name: 'Золото', price: 2500 },
    { id: 'taxi', name: 'Такси', price: 3000 },
    { id: 'neon', name: 'Неон', price: 5000 },
    { id: 'police', name: 'Полиция', price: 6000 },
    { id: 'military', name: 'Военный', price: 8000 },
    { id: 'holo', name: 'Голограмма', price: 12000 },
    { id: 'diplomat', name: 'Дипломат', price: 15000 },
    { id: 'ussr', name: 'СССР', price: 20000 },
    { id: 'carbon', name: 'Карбон', price: 30000 },
    { id: 'camo', name: 'Камуфляж', price: 40000 },
    { id: 'chrome', name: 'Хром', price: 50000 },
    { id: 'matrix', name: 'Матрица', price: 80000 },
    { id: 'lava', name: 'Лава', price: 120000 },
    { id: 'ice', name: 'Лёд', price: 120000 },
    { id: 'space', name: 'Космос', price: 250000 },
    // эксклюзивы — только на чёрном рынке
    { id: 'rainbow', name: 'Радуга', price: 200000, market: 'rare' },
    { id: 'blackgold', name: 'Чёрное золото', price: 350000, market: 'epic' },
    { id: 'glitch', name: 'Глитч', price: 400000, market: 'epic' },
    { id: 'plasma', name: 'Плазма', price: 1000000, market: 'legendary' },
    { id: 'diamond', name: 'Бриллиант', price: 1500000, market: 'legendary' },
  ];

  /* ---------------- чёрный рынок ---------------- */
  const MARKET_RARITY = {
    common: { name: 'Обычный', color: '#9a9a95', w: 55 },
    rare: { name: 'Редкий', color: '#5b8def', w: 30 },
    epic: { name: 'Эпический', color: '#a06cf0', w: 12 },
    legendary: { name: 'Легендарный', color: '#f0b35a', w: 3 },
  };

  // Брелки — постоянные бусты, одновременно можно носить 3
  const KEY_SLOTS = 3;
  const BOOST_TEXT = {
    pay: (v) => `+${v}% к выплатам`,
    luck: (v) => `+${v}% шанс двойной крутки`,
    moscow: (v) => `+${v}% к московскому региону`,
    garage: (v) => `+${v}% к доходу гаража`,
    work: (v) => `+${v}% к оплате работы`,
    xp: (v) => `+${v}% опыта`,
    happy: (v) => `счастливый час +${v} мин`,
  };
  const KEYCHAINS = [
    { id: 'tree', name: 'Ёлочка-вонючка', icon: '🌲', rarity: 'common', price: 8000, boost: { pay: 2 } },
    { id: 'dice', name: 'Кубики на зеркало', icon: '🎲', rarity: 'common', price: 8000, boost: { luck: 1 } },
    { id: 'gkey', name: 'Ключ от гаража', icon: '🔑', rarity: 'common', price: 6000, boost: { garage: 20 } },
    { id: 'helmet', name: 'Каска прораба', icon: '⛑️', rarity: 'common', price: 5000, boost: { work: 25 } },
    { id: 'clover', name: 'Клевер', icon: '🍀', rarity: 'rare', price: 40000, boost: { pay: 4 } },
    { id: 'star', name: 'Кремлёвская звезда', icon: '⭐', rarity: 'rare', price: 40000, boost: { moscow: 2 } },
    { id: 'clock', name: 'Будильник', icon: '⏰', rarity: 'rare', price: 35000, boost: { happy: 1 } },
    { id: 'book', name: 'Конспект ПДД', icon: '📘', rarity: 'rare', price: 30000, boost: { xp: 30 } },
    { id: 'goldkey', name: 'Золотой ключик', icon: '🗝️', rarity: 'epic', price: 150000, boost: { pay: 7 } },
    { id: 'siren', name: 'Мигалка', icon: '🚨', rarity: 'epic', price: 150000, boost: { luck: 3 } },
    { id: 'safe', name: 'Сейф', icon: '🧰', rarity: 'epic', price: 120000, boost: { garage: 50, work: 25 } },
    { id: 'crown', name: 'Корона', icon: '👑', rarity: 'legendary', price: 600000, boost: { pay: 12, luck: 2 } },
    { id: 'blackcard', name: 'Чёрная карта', icon: '💳', rarity: 'legendary', price: 500000, boost: { pay: 10, happy: 1 } },
  ];

  // Расходники — копятся в рюкзаке, применяются кнопкой
  const CONSUMABLES = [
    { id: 'energy', name: 'Энергетик', icon: '⚡', rarity: 'common', price: 3000, desc: 'Сразу восстанавливает все силы для работы' },
    { id: 'cash', name: 'Инкассация', icon: '💰', rarity: 'common', price: 5000, desc: 'Сразу 2 часа дохода гаража' },
    { id: 'ticket', name: 'Билет в счастливый час', icon: '🎟️', rarity: 'rare', price: 15000, desc: 'Запускает счастливый час прямо сейчас' },
    { id: 'talon', name: 'Талон удачи', icon: '🧿', rarity: 'rare', price: 20000, desc: 'Следующая крутка — минимум «Редкий»' },
    { id: 'x3', name: 'Купон ×3', icon: '🔥', rarity: 'epic', price: 40000, desc: 'Следующие 10 круток — выплаты ×3' },
  ];

  const MARKET_PERIOD = 2 * 60 * 60000;
  const MARKET_SLOTS = 6;
  const MARKET_REROLL = 25000;

  // Детерминированный ассортимент на окно времени: перезапуск приложения его не меняет
  function marketStock(windowIdx, salt) {
    let a = (windowIdx * 2654435761 + salt) >>> 0;
    const rnd01 = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const pickW = (obj) => { const tot = Object.values(obj).reduce((s, x) => s + x.w, 0); let r = rnd01() * tot; for (const [k, v] of Object.entries(obj)) { if ((r -= v.w) < 0) return k; } return 'common'; };
    const stock = [];
    const used = new Set();
    for (let i = 0; i < MARKET_SLOTS * 4 && stock.length < MARKET_SLOTS; i++) {
      const rarity = pickW(MARKET_RARITY);
      const kindR = rnd01();
      const kind = kindR < 0.45 ? 'key' : kindR < 0.62 ? 'skin' : 'item';
      const pool = kind === 'key' ? KEYCHAINS.filter((k) => k.rarity === rarity)
        : kind === 'skin' ? SKINS.filter((s) => s.market === rarity)
          : CONSUMABLES.filter((c) => c.rarity === rarity);
      if (!pool.length) continue;
      const it = pool[Math.floor(rnd01() * pool.length)];
      if (used.has(it.id)) continue;
      used.add(it.id);
      const sale = rnd01() < 0.2 ? 0.7 : 1; // иногда скидка 30%
      const swing = 0.85 + rnd01() * 0.3; // «цена дня»
      stock.push({
        kind, id: it.id, rarity, sale: sale < 1,
        price: Math.round((it.price * sale * swing) / 100) * 100,
        qty: kind === 'item' ? 1 + Math.floor(rnd01() * 3) : 1,
      });
    }
    return stock;
  }

  /* ---------------- тюнинг номера ---------------- */
  const TUNING_CATS = [
    { id: 'frame', name: 'Рамка', icon: '🖼️' },
    { id: 'glow', name: 'Подсветка', icon: '💡' },
    { id: 'sticker', name: 'Наклейка', icon: '🏷️' },
    { id: 'bolts', name: 'Болты', icon: '🔩' },
    { id: 'aura', name: 'Аура', icon: '✨' },
  ];
  const TUNING = [
    { id: 'f-chrome', cat: 'frame', name: 'Хромированная', price: 10000 },
    { id: 'f-carbon', cat: 'frame', name: 'Карбоновая', price: 40000 },
    { id: 'f-gold', cat: 'frame', name: 'Золотая', price: 150000 },
    { id: 'f-neon', cat: 'frame', name: 'Неоновая', price: 600000 },
    { id: 'f-diamond', cat: 'frame', name: 'Бриллиантовая', price: 3000000 },
    { id: 'f-rainbow', cat: 'frame', name: 'Радужная', price: 15000000 },
    { id: 'g-blue', cat: 'glow', name: 'Синяя', price: 20000 },
    { id: 'g-red', cat: 'glow', name: 'Красная', price: 60000 },
    { id: 'g-green', cat: 'glow', name: 'Кислотная', price: 150000 },
    { id: 'g-rgb', cat: 'glow', name: 'RGB-перелив', price: 1200000 },
    { id: 'g-void', cat: 'glow', name: 'Чёрная дыра', price: 10000000 },
    { id: 's-fire', cat: 'sticker', name: 'Огонёк', icon: '🔥', price: 5000 },
    { id: 's-skull', cat: 'sticker', name: 'Череп', icon: '💀', price: 15000 },
    { id: 's-dragon', cat: 'sticker', name: 'Дракон', icon: '🐉', price: 60000 },
    { id: 's-crown', cat: 'sticker', name: 'Корона', icon: '👑', price: 400000 },
    { id: 's-gem', cat: 'sticker', name: 'Алмаз', icon: '💎', price: 2500000 },
    { id: 's-galaxy', cat: 'sticker', name: 'Галактика', icon: '🌌', price: 20000000 },
    { id: 'b-gold', cat: 'bolts', name: 'Золотые', price: 8000 },
    { id: 'b-black', cat: 'bolts', name: 'Чёрный хром', price: 30000 },
    { id: 'b-ruby', cat: 'bolts', name: 'Рубиновые', price: 500000 },
    { id: 'b-diamond', cat: 'bolts', name: 'Бриллиантовые', price: 5000000 },
    { id: 'a-sparks', cat: 'aura', name: 'Искры', price: 100000 },
    { id: 'a-smoke', cat: 'aura', name: 'Дым', price: 300000 },
    { id: 'a-lightning', cat: 'aura', name: 'Молнии', price: 1500000 },
    { id: 'a-fire', cat: 'aura', name: 'Пламя', price: 6000000 },
    { id: 'a-stars', cat: 'aura', name: 'Звездопад', price: 30000000 },
    { id: 'a-gold', cat: 'aura', name: 'Золотой дождь', price: 100000000 },
  ];
  // Стиль растёт с ценой: 5к ≈ 2, 100М ≈ 23. Бонус к выплатам = стиль надетого / 5 %
  const tuningStyle = (t) => Math.max(1, Math.round(Math.log10(t.price) * 5 - 17));
  const STYLE_DIV = 5;

  // Требование для престижа растёт: 1 млн, 2 млн, 3 млн…
  const prestigeNeed = (n) => 1000000 * (n + 1);
  const PRESTIGE_BONUS = 25;

  const TIER_INDEX = Object.fromEntries(TIERS.map((t, i) => [t.id, i]));
  const atLeast = (st, tier) => Object.entries(st.tiers || {}).some(([id, n]) => n > 0 && TIER_INDEX[id] >= TIER_INDEX[tier]);
  const QUESTS = [
    { id: 'spin1', name: 'Первая крутка', reward: 60, done: (s) => s.spins >= 1 },
    { id: 'spin100', name: '100 круток', reward: 600, done: (s) => s.spins >= 100, progress: (s) => [s.spins, 100] },
    { id: 'spin1000', name: '1000 круток', reward: 4500, done: (s) => s.spins >= 1000, progress: (s) => [s.spins, 1000] },
    { id: 'rare', name: 'Выбей «Редкий» или выше', reward: 150, done: (s) => atLeast(s, 'rare') },
    { id: 'epic', name: 'Выбей «Эпический» или выше', reward: 360, done: (s) => atLeast(s, 'epic') },
    { id: 'legendary', name: 'Выбей «Легендарный» или выше', reward: 1800, done: (s) => atLeast(s, 'legendary') },
    { id: 'mythic', name: 'Выбей «Мифический»', reward: 7500, done: (s) => atLeast(s, 'mythic') },
    { id: 's777', name: 'Три семёрки', reward: 900, done: (s) => !!(s.flags || {}).s777 },
    { id: 'elite', name: 'Любая блатная серия (АМР, ЕКХ…)', reward: 900, done: (s) => !!(s.flags || {}).elite },
    { id: 'word', name: 'Номер-слово', reward: 240, done: (s) => !!(s.flags || {}).word },
    { id: 'r77', name: 'Регион 77', reward: 120, done: (s) => !!(s.flags || {}).r77 },
    { id: 'upgrade', name: 'Купи первое улучшение', reward: 150, done: (s) => Object.values(s.upgrades || {}).some((l) => l > 0) },
    { id: 'skin', name: 'Купи скин номера', reward: 300, done: (s) => (s.skins || []).length > 1 },
    { id: 'bigwin', name: 'Выиграй 1 000 за одну крутку', reward: 1500, done: (s) => (s.bestWin || 0) >= 1000 },
    { id: 'work', name: 'Отработай 20 заданий', reward: 300, done: (s) => (s.jobs || 0) >= 20, progress: (s) => [Math.min(s.jobs || 0, 20), 20] },
    { id: 'online1', name: 'Выиграй онлайн-батл', reward: 450, done: (s) => ((s.pvpStats || {}).wins || 0) >= 1 },
    { id: 'key1', name: 'Купи первый брелок на чёрном рынке', reward: 3000, done: (s) => (s.keys || []).length >= 1 },
    { id: 'prestige1', name: 'Первый престиж', reward: 50000, done: (s) => (s.prestige || 0) >= 1 },
    { id: 'tune1', name: 'Купи первый обвес в тюнинге', reward: 5000, done: (s) => ((s.tuning || {}).owned || []).length >= 1 },
    { id: 'style50', name: 'Набери 50 стиля', reward: 500000, done: (s) => (s.styleNow || 0) >= 50, progress: (s) => [Math.min(s.styleNow || 0, 50), 50] },
    { id: 'rich', name: 'Накопи 5 000 монет', reward: 1200, done: (s) => s.coins >= 5000, progress: (s) => [Math.min(s.coins, 5000), 5000] },
    { id: 'rich2', name: 'Накопи 100 000 монет', reward: 10000, done: (s) => s.coins >= 100000, progress: (s) => [Math.min(s.coins, 100000), 100000] },
    { id: 'million', name: 'Миллионер: накопи 1 000 000', reward: 100000, done: (s) => s.coins >= 1000000, progress: (s) => [Math.min(s.coins, 1000000), 1000000] },
  ];


  /* ---------------- заказы, уровни, колесо ---------------- */
  // Награда за заказ ≈ 0.15 / вероятность: в среднем заказ добавляет ~1.5% отдачи на ставке ×1
  const ORDER_K = 0.45, ORDER_MIN = 45;
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
  const levelReward = (lvl) => 20 + 10 * lvl;
  const TITLES = [
    [1, 'Пешеход'], [3, 'Таксист'], [6, 'Бомбила'], [10, 'Перекупщик'], [15, 'Блатной'],
    [22, 'Авторитет'], [30, 'Вор в законе'], [40, 'Смотрящий за ГИБДД'],
  ];
  const titleFor = (lvl) => [...TITLES].reverse().find(([l]) => lvl >= l)[1];

  const JACKPOT_SEED = 2500, JACKPOT_RATE = 0.05;
  const WHEEL = [150, 250, 400, 500, 250, 1000, 150, 2500];

  const format = (p) => `${p.l1}${p.digits}${p.l2}${p.region}`;

  window.Plates = {
    LETTERS, DIGITS, REGIONS, REGION_CODES, TIERS, ODDS, random, score, format,
    SPIN_COST, PAYOUT, BETS, BET_UNLOCK, UPGRADES, SKINS, QUESTS,
    TUNING_CATS, TUNING, tuningStyle, STYLE_DIV,
    MARKET_RARITY, KEY_SLOTS, BOOST_TEXT, KEYCHAINS, CONSUMABLES, MARKET_PERIOD, MARKET_SLOTS, MARKET_REROLL, marketStock, prestigeNeed, PRESTIGE_BONUS,
    makeOrder, orderTest, ORDER_TTL, xpNeed, levelReward, titleFor, JACKPOT_SEED, JACKPOT_RATE, WHEEL,
  };
})();
