// «Ночной дата-центр» — контент: железо, апгрейды, предметы, локации, события
(function () {
  // Локации — карта серверов. Каждая открывает новую механику
  const LOCS = [
    { id: 'home', name: 'Домашний ПК', icon: '🖥', cost: 0, opens: 'Клик и первое железо' },
    { id: 'garage', name: 'Гараж', icon: '🚗', cost: 5e3, opens: 'Комбо до ×10, кейсы, +1 слот' },
    { id: 'room', name: 'Серверная', icon: '🗄', cost: 1e5, opens: 'Атаки на кентов, защита, bounty' },
    { id: 'dc', name: 'Датацентр', icon: '🏢', cost: 2e6, opens: 'Разгон, охлаждение, Reboot' },
    { id: 'corp', name: 'Корпорация', icon: '🏦', cost: 4e7, opens: 'Чёрный рынок, +1 слот' },
    { id: 'under', name: 'Подземный ДЦ', icon: '⛏', cost: 8e8, opens: 'Исследования: верх дерева' },
    { id: 'orbit', name: 'Орбитальный сервер', icon: '🛰', cost: 1.6e10, opens: 'Глобальный бафф на всех' },
    { id: 'quantum', name: 'Квантовый сервер', icon: '⚛', cost: 3e11, opens: 'Коллапс волновой функции' },
  ];

  // Железо: базовая цена, доход/с, с какой локации доступно
  const HW = [
    { id: 'laptop', name: 'Старый ноутбук', icon: '💻', cost: 15, rate: 0.2, loc: 0, d: 'Гудит как самолёт' },
    { id: 'rig', name: 'Риг на балконе', icon: '⛏', cost: 120, rate: 1.5, loc: 0, d: 'Соседи думают, что это обогреватель' },
    { id: 'avito', name: 'Сервер с Авито', icon: '📦', cost: 1.1e3, rate: 9, loc: 1, d: '«Работал у бабушки, не майнил»' },
    { id: 'rack', name: 'Стойка в гараже', icon: '🗄', cost: 1.2e4, rate: 55, loc: 1, d: 'Рядом с зимней резиной' },
    { id: 'blade', name: 'Блейд-шасси', icon: '🔲', cost: 1.3e5, rate: 320, loc: 2, d: '16 лезвий, ноль сна' },
    { id: 'admin', name: 'Админ-задрот', icon: '🧑‍💻', cost: 1.4e6, rate: 1900, loc: 2, d: 'Работает за доширак' },
    { id: 'gpu', name: 'GPU-кластер', icon: '🎛', cost: 1.6e7, rate: 11e3, loc: 3, d: 'Видеокарты, которых нет в продаже' },
    { id: 'immersion', name: 'Иммерсионная ванна', icon: '🛁', cost: 1.8e8, rate: 65e3, loc: 4, d: 'Серверы плавают в масле' },
    { id: 'ai', name: 'ИИ-ферма', icon: '🧠', cost: 2.1e9, rate: 4e5, loc: 5, d: 'Генерит мемы и деньги' },
    { id: 'sat', name: 'Спутниковая группировка', icon: '🛰', cost: 2.6e10, rate: 2.4e6, loc: 6, d: 'Пинг до Марса 3 мс' },
    { id: 'qubit', name: 'Кубитный массив', icon: '⚛', cost: 3.3e11, rate: 1.5e7, loc: 7, d: 'Одновременно работает и не работает' },
  ];
  const HW_GROWTH = 1.15;

  // Разовые апгрейды. k: click (множитель клика), macro (доля дохода в клик), inc (глобально +%), cool (охлаждение), hw (×2 железу)
  const UPG = [
    { id: 'kb', name: 'Механическая клава', icon: '⌨', cost: 100, loc: 0, k: 'click', v: 2, d: 'Клик ×2' },
    { id: 'fiber', name: 'Оптоволокно', icon: '🧵', cost: 2e4, loc: 1, k: 'inc', v: 0.1, d: 'Весь доход +10%' },
    { id: 'macro', name: 'Макросы в AHK', icon: '📜', cost: 5e3, loc: 1, k: 'macro', v: 0.01, d: 'Клик +1% от дохода/с' },
    { id: 'mouse', name: 'Игровая мышь', icon: '🖱', cost: 5e4, loc: 1, k: 'click', v: 2, d: 'Клик ×2' },
    { id: 'power', name: 'Дешёвое электричество', icon: '🔌', cost: 3e5, loc: 2, k: 'inc', v: 0.15, d: 'Весь доход +15%' },
    { id: 'fan', name: 'Вентилятор с рынка', icon: '🌀', cost: 2e5, loc: 2, k: 'cool', v: 3, d: 'Охлаждение +3/с' },
    { id: 'script', name: 'Автокликер-скрипт', icon: '🤖', cost: 5e5, loc: 2, k: 'macro', v: 0.03, d: 'Клик +3% от дохода/с' },
    { id: 'water', name: 'Водянка', icon: '💧', cost: 5e6, loc: 3, k: 'cool', v: 5, d: 'Охлаждение +5/с' },
    { id: 'gen', name: 'Свой генератор', icon: '⚡', cost: 1e7, loc: 3, k: 'inc', v: 0.2, d: 'Весь доход +20%' },
    { id: 'neuro', name: 'Нейроинтерфейс', icon: '🧬', cost: 5e7, loc: 4, k: 'click', v: 3, d: 'Клик ×3' },
    { id: 'nitro', name: 'Жидкий азот', icon: '🧊', cost: 2e8, loc: 4, k: 'cool', v: 8, d: 'Охлаждение +8/с' },
    { id: 'toaster', name: 'Linux на тостере', icon: '🍞', cost: 1e9, loc: 5, k: 'inc', v: 0.25, d: 'Весь доход +25%' },
    { id: 'deal', name: 'Сделка с энергосбытом', icon: '🤝', cost: 1e11, loc: 6, k: 'inc', v: 0.3, d: 'Весь доход +30%' },
    { id: 'bci', name: 'Мозг в банке', icon: '🫙', cost: 5e11, loc: 7, k: 'macro', v: 0.05, d: 'Клик +5% от дохода/с' },
  ];
  // ×2 на каждое железо, когда его 10+ штук
  HW.forEach((h) => UPG.push({ id: 'x2_' + h.id, name: `Тюнинг: ${h.name}`, icon: h.icon, cost: h.cost * 25, loc: h.loc, k: 'hw', hw: h.id, need: 10, v: 2, d: `${h.name} ×2 (нужно 10 шт.)` }));

  // Защита: уровни
  const DEF = [
    { id: 'fw', name: 'Firewall', icon: '🧱', cost: 2e4, max: 5, d: (l) => `Шанс отбить атаку +${l * 8}%` },
    { id: 'px', name: 'Proxy', icon: '🕶', cost: 3e4, max: 5, d: (l) => `Украдут на ${l * 12}% меньше` },
    { id: 'ad', name: 'Анти-DDoS', icon: '🛡', cost: 1.5e4, max: 4, d: (l) => `DDoS и вирусы короче на ${l * 12}%` },
    { id: 'bk', name: 'Резервный сервер', icon: '💾', cost: 5e4, max: 5, d: (l) => `${l * 10}% кредитов нельзя украсть` },
  ];
  const DEF_GROWTH = 6;

  // Атаки
  const ATK = [
    { id: 'hack', name: 'Взлом', icon: '🔓', short: 'Украсть кредиты',
      how: ['Сразу забираешь часть кредитов цели', 'Базово 3%, больше — с ATK-предметами и веткой ATTACK', 'Proxy цели режет сумму, резервный сервер прячет часть кредитов', 'Забирает bounty, если он назначен на цель'] },
    { id: 'ddos', name: 'DDoS', icon: '🌊', short: 'Положить сервер на 45 с',
      how: ['45 с у цели не работают клики', 'Доход цели падает на 60%', 'Половину потерянного дохода получаешь ты', 'Анти-DDoS цели укорачивает атаку'] },
    { id: 'virus', name: 'Вирус', icon: '🦠', short: 'Мини-игра для цели',
      how: ['Цель должна перебить 10 вирусов за ~8 с', 'Не успела — ты забираешь 5% её кредитов', 'Работает только по тем, кто в сети', 'Хорошо заходит, когда кент отвлёкся'] },
  ];
  const ATK_CD = 150e3;

  // Дерево прокачки за ядра. Ряды 4–5 требуют Подземный ДЦ
  const TREE = {
    farm: { name: 'FARM', color: '#e4f07e', nodes: [
      { id: 'f1', name: 'Плантация', d: 'Доход +20%', c: 1 },
      { id: 'f2', name: 'Стальные пальцы', d: 'Клик +50%', c: 2 },
      { id: 'f3', name: 'Оптовик', d: 'Железо дешевле на 10%', c: 4 },
      { id: 'f4', name: 'Дятел', d: 'Комбо до ×15', c: 8 },
      { id: 'f5', name: 'Вечный двигатель', d: 'Доход ×2', c: 16 },
    ] },
    atk: { name: 'ATTACK', color: '#ff6b6b', nodes: [
      { id: 'a1', name: 'Скрипт-кидди', d: 'Перезарядка атак −25%', c: 1 },
      { id: 'a2', name: 'Жадность', d: 'Взлом крадёт +2%', c: 2 },
      { id: 'a3', name: 'Социнженерия', d: 'Шанс успеха +15%', c: 4 },
      { id: 'a4', name: 'Ботнет', d: 'Урон по боссу ×2', c: 8 },
      { id: 'a5', name: 'Сетевой червь', d: 'Взлом ×2 и игнорит Proxy', c: 16 },
    ] },
    def: { name: 'DEFENCE', color: '#6bc9ff', nodes: [
      { id: 'd1', name: 'Параноик', d: 'Отбить атаку +10%', c: 1 },
      { id: 'd2', name: 'Карантин', d: 'После взлома щит на 90 с', c: 2 },
      { id: 'd3', name: 'Зеркало', d: 'Отбитый хакер платит тебе 2%', c: 4 },
      { id: 'd4', name: 'Бункер', d: 'Плохие события не действуют', c: 8 },
      { id: 'd5', name: 'Крепость', d: 'Крадут максимум 1%, DDoS не берёт', c: 16 },
    ] },
  };

  // Предметы. b: click/inc/steal (доля), def (шанс отбить), cool, luck, boss
  const R = {
    c: { name: 'Обычный', color: '#a4a49e', w: 58, mul: 1 },
    r: { name: 'Редкий', color: '#5fa8ff', w: 27, mul: 3 },
    e: { name: 'Эпический', color: '#b77cff', w: 11, mul: 10 },
    l: { name: 'Легендарный', color: '#ffb340', w: 3.8, mul: 40 },
    p: { name: 'ПРОТОТИП', color: '#ff4f8b', w: 0.2, mul: 300 },
  };
  const RAR = ['c', 'r', 'e', 'l', 'p'];
  const ITEMS = {
    g1: { n: 'GTX 1050 Ti б/у', t: 'GPU', r: 'c', b: { inc: 0.03 } },
    g2: { n: 'RTX 3060', t: 'GPU', r: 'r', b: { inc: 0.08 } },
    g3: { n: 'RTX 4090', t: 'GPU', r: 'e', b: { inc: 0.16 } },
    g4: { n: 'RTX 6090', t: 'GPU', r: 'l', b: { inc: 0.35 } },
    g5: { n: 'RTX 9090 prototype', t: 'GPU', r: 'p', b: { inc: 1, click: 0.5 } },
    c1: { n: 'Celeron из офиса', t: 'CPU', r: 'c', b: { click: 0.06 } },
    c2: { n: 'Ryzen 5', t: 'CPU', r: 'r', b: { click: 0.15 } },
    c3: { n: 'Threadripper', t: 'CPU', r: 'e', b: { click: 0.3, boss: 0.15 } },
    c4: { n: 'Эльбрус-X', t: 'CPU', r: 'l', b: { click: 0.7, boss: 0.4 } },
    c5: { n: 'Квантовый CPU Q-1', t: 'CPU', r: 'p', b: { click: 1.5, boss: 1, inc: 0.3 } },
    a1: { n: 'Скрипт-кидди.py', t: 'ATK', r: 'c', b: { steal: 0.004 } },
    a2: { n: 'Ботнет из чайников', t: 'ATK', r: 'r', b: { steal: 0.01, boss: 0.1 } },
    a3: { n: 'Zero-day эксплойт', t: 'ATK', r: 'e', b: { steal: 0.02, hit: 0.08 } },
    a4: { n: 'Кибероружие АНБ', t: 'ATK', r: 'l', b: { steal: 0.04, hit: 0.15 } },
    a5: { n: 'Stuxnet 2.0', t: 'ATK', r: 'p', b: { steal: 0.08, hit: 0.3, boss: 0.5 } },
    d1: { n: 'Антивирус Касперского', t: 'DEF', r: 'c', b: { def: 0.03 } },
    d2: { n: 'pfSense на роутере', t: 'DEF', r: 'r', b: { def: 0.07 } },
    d3: { n: 'Cisco ASA', t: 'DEF', r: 'e', b: { def: 0.12, prot: 0.1 } },
    d4: { n: 'Iron Dome', t: 'DEF', r: 'l', b: { def: 0.22, prot: 0.2 } },
    k1: { n: 'Кулер Deepcool', t: 'COOL', r: 'c', b: { cool: 1.5 } },
    k2: { n: 'Водоблок EK', t: 'COOL', r: 'r', b: { cool: 3, inc: 0.03 } },
    k3: { n: 'Фреоновый чиллер', t: 'COOL', r: 'e', b: { cool: 6, inc: 0.06 } },
    k4: { n: 'Криокамера', t: 'COOL', r: 'l', b: { cool: 12, inc: 0.12 } },
    s1: { n: 'HDD Seagate', t: 'DISK', r: 'c', b: { luck: 0.05 } },
    s2: { n: 'NVMe Samsung', t: 'DISK', r: 'r', b: { luck: 0.12, inc: 0.03 } },
    s3: { n: 'Флешка с кошельком 2010', t: 'DISK', r: 'e', b: { luck: 0.25, inc: 0.06 } },
    s4: { n: 'Optane «Не выпускается»', t: 'DISK', r: 'l', b: { luck: 0.5, inc: 0.12 } },
  };
  const TYPE_ICON = { GPU: '🎮', CPU: '🔳', ATK: '💀', DEF: '🛡', COOL: '❄', DISK: '💾' };
  const BONUS_TXT = {
    inc: (v) => `доход +${Math.round(v * 100)}%`,
    click: (v) => `клик +${Math.round(v * 100)}%`,
    boss: (v) => `урон боссу +${Math.round(v * 100)}%`,
    steal: (v) => `кража +${(v * 100).toFixed(1).replace('.0', '')}%`,
    hit: (v) => `успех атак +${Math.round(v * 100)}%`,
    def: (v) => `отбить +${Math.round(v * 100)}%`,
    prot: (v) => `защищено +${Math.round(v * 100)}%`,
    cool: (v) => `охлаждение +${v}/с`,
    luck: (v) => `удача +${Math.round(v * 100)}%`,
  };

  // Глобальные события
  const EVENTS = [
    { id: 'power', name: 'Электричество подорожало', icon: '⚡', d: 'Доход всех −40%', bad: true, inc: 0.6 },
    { id: 'btc', name: 'Bitcoin пампанулся', icon: '📈', d: 'Доход всех ×2', inc: 2 },
    { id: 'cops', name: 'Маски-шоу в датацентре', icon: '🚓', d: 'Атаки запрещены, доход −20%', bad: true, inc: 0.8, noAtk: true },
    { id: 'cf', name: 'Cloudflare упал', icon: '☁', d: 'Доход −50%, но атаки проходят на 100%', bad: true, inc: 0.5, sureHit: true },
    { id: 'free', name: 'Бесплатные сервера', icon: '🆓', d: 'Железо за полцены', hwMul: 0.5 },
    { id: 'heat', name: 'Аномальная жара', icon: '🌡', d: 'Нагрев ×2', bad: true, heat: 2 },
    { id: 'drop', name: 'Airdrop', icon: '🪂', d: 'Всем по минуте дохода сразу', airdrop: 60 },
    { id: 'gold', name: 'Золотая лихорадка', icon: '🎰', d: 'Удача в кейсах ×3', luck: 3 },
    { id: 'beta', name: 'Бета-тест мышек', icon: '🖱', d: 'Клики ×3', click: 3 },
    { id: 'rkn', name: 'РКН блокирует всё подряд', icon: '🚫', d: 'Клики ×0.5, урон боссу ×2', bad: true, click: 0.5, boss: 2 },
  ];
  const EVENT_LEN = 90e3;

  const BOSSES = ['MEGA SERVER', 'ГОСУСЛУГИ.EXE', 'Ботоферма «Ольгино»', 'Сервер Пентагона', 'SKYNET v0.9', 'Майнер в школьном ПК', 'Облако Сбера', 'Робот-коллектор'];
  const BOSS_EVERY = 20 * 60e3, BOSS_FIRST = 6 * 60e3, BOSS_LEN = 150e3;

  // Комбо: сколько кликов подряд нужно для множителя
  const COMBO = [[0, 1], [25, 2], [80, 3], [160, 5], [300, 10], [500, 15]];
  const OC = [
    { name: 'Сток', mul: 1, heat: 0, brk: 0 },
    { name: 'Лёгкий', mul: 1.5, heat: 2, brk: 0.01 },
    { name: 'Жёсткий', mul: 2.2, heat: 5, brk: 0.03 },
    { name: 'Безумие', mul: 3, heat: 9.5, brk: 0.06 },
  ];

  const ACH = {
    click1: ['Первый пакет', 'Сделай первый клик'],
    click1k: ['Разминка пальцев', '1 000 кликов'],
    click10k: ['Безработный', '10 000 кликов'],
    combo10: ['Дятел', 'Разгони комбо до ×10'],
    hot: ['Шашлык', 'Перегрей сервер 5 раз'],
    traitor: ['Предатель', 'Атакуй каждого игрока в комнате'],
    robin: ['Робин Гуд', 'Укради суммарно 1 млн'],
    victim: ['Терпила', 'Тебя ограбили 10 раз'],
    legend: ['Легендарщик', 'Выбей легендарку'],
    proto: ['ЕБАТЬ МНЕ ВЫПАЛО', 'Выбей прототип (0.2%)'],
    major: ['Мажор', 'Первым в комнате открой Квантовый сервер'],
    boss: ['Убийца серверов', 'Нанеси больше всех урона боссу'],
    reboot: ['Ctrl+Alt+Del', 'Сделай первый Reboot'],
    hunter: ['Охотник за головами', 'Забери чужой bounty'],
    burnt: ['Сгорел, но не сдался', 'Сломай железо разгоном'],
    shrodi: ['Кот Шрёдингера', 'Схлопни волновую функцию'],
    trader: ['Барыга', 'Продай предмет на рынке'],
    billion: ['Миллиардер', 'Набери 1 млрд очков'],
  };

  const AWARDS = [
    { id: 'king', icon: '👑', name: 'Король ночи', d: 'больше всех очков', key: (p) => p.score },
    { id: 'rich', icon: '💰', name: 'Самый богатый', d: 'кредитов на руках', key: (p) => p.cr },
    { id: 'aggro', icon: '🔪', name: 'Самый агрессивный', d: 'атак', key: (p) => p.st.attacks },
    { id: 'nerd', icon: '🤓', name: 'Главный задрот', d: 'кликов', key: (p) => p.st.clicks },
    { id: 'thief', icon: '🦹', name: 'Вор в законе', d: 'украдено', key: (p) => p.st.stolen },
    { id: 'slayer', icon: '⚔', name: 'Убийца боссов', d: 'урона боссам', key: (p) => p.st.boss },
    { id: 'unlucky', icon: '🥲', name: 'Самый невезучий', d: 'потеряно + перегревы', key: (p) => p.st.lost + p.st.overheats * 1e3 },
    { id: 'gambler', icon: '🎲', name: 'Лудоман', d: 'кейсов открыто', key: (p) => p.st.cases },
    { id: 'spender', icon: '🛍', name: 'Транжира', d: 'потрачено', key: (p) => p.st.spent },
  ];

  window.DCData = {
    LOCS, HW, HW_GROWTH, UPG, DEF, DEF_GROWTH, ATK, ATK_CD, TREE, R, RAR, ITEMS, TYPE_ICON, BONUS_TXT,
    EVENTS, EVENT_LEN, BOSSES, BOSS_EVERY, BOSS_FIRST, BOSS_LEN, COMBO, OC, ACH, AWARDS,
  };
})();
