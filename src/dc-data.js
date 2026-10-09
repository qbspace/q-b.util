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
    { id: 'moon', name: 'Лунная база', icon: '🌙', cost: 1e14, opens: '2-й слот лаборатории, лунное железо' },
    { id: 'dyson', name: 'Сфера Дайсона', icon: '☀', cost: 2e16, opens: 'Дерево: ряды 6–8' },
    { id: 'multi', name: 'Мультивселенная', icon: '🌀', cost: 5e18, opens: '+1 слот предметов, звёзды предметов сильнее' },
    { id: 'sim', name: 'Симуляция', icon: '🕶', cost: 1e21, opens: 'Сингулярность — престиж над престижем' },
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
    { id: 'lunar', name: 'Лунный ЦОД', icon: '🌙', cost: 4e12, rate: 9e7, loc: 8, d: 'Охлаждение бесплатное: −173°C' },
    { id: 'dysonp', name: 'Панели Дайсона', icon: '☀', cost: 5e13, rate: 5.5e8, loc: 9, d: 'Питаются целой звездой' },
    { id: 'mbrain', name: 'Мозг-матрёшка', icon: '🪆', cost: 6.5e14, rate: 3.3e9, loc: 10, d: 'Компьютер размером с орбиту' },
    { id: 'shard', name: 'Осколок мультиверса', icon: '💠', cost: 8e15, rate: 2e10, loc: 10, d: 'Майнит во всех вселенных сразу' },
    { id: 'god', name: 'Сервер Бога', icon: '👁', cost: 1e17, rate: 1.2e11, loc: 11, d: 'root@reality:~#' },
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
    { id: 'chair', name: 'Кресло за 300к', icon: '🪑', cost: 2e9, loc: 5, k: 'click', v: 2, d: 'Клик ×2' },
    { id: 'redbull', name: 'Ящик энергетиков', icon: '🥫', cost: 8e9, loc: 5, k: 'macro', v: 0.03, d: 'Клик +3% от дохода/с' },
    { id: 'starlink', name: 'Свой Starlink', icon: '📡', cost: 3e10, loc: 6, k: 'inc', v: 0.35, d: 'Весь доход +35%' },
    { id: 'cryo', name: 'Криокупол', icon: '🧊', cost: 5e10, loc: 6, k: 'cool', v: 12, d: 'Охлаждение +12/с' },
    { id: 'qrng', name: 'Квантовый ГСЧ', icon: '🎲', cost: 2e12, loc: 7, k: 'inc', v: 0.4, d: 'Весь доход +40%' },
    { id: 'void', name: 'Холод космоса', icon: '🌌', cost: 1.5e13, loc: 8, k: 'cool', v: 20, d: 'Охлаждение +20/с' },
    { id: 'helium', name: 'Гелий-3', icon: '⚗', cost: 5e13, loc: 8, k: 'inc', v: 0.5, d: 'Весь доход +50%' },
    { id: 'gloves', name: 'Перчатки из графена', icon: '🧤', cost: 2e14, loc: 8, k: 'click', v: 4, d: 'Клик ×4' },
    { id: 'swarm', name: 'Рой Дайсона', icon: '🐝', cost: 2e15, loc: 9, k: 'inc', v: 0.6, d: 'Весь доход +60%' },
    { id: 'telepathy', name: 'Телепатия', icon: '🔮', cost: 1e16, loc: 9, k: 'macro', v: 0.08, d: 'Клик +8% от дохода/с' },
    { id: 'paradox', name: 'Парадокс-движок', icon: '♾', cost: 1e17, loc: 10, k: 'click', v: 5, d: 'Клик ×5' },
    { id: 'entropy', name: 'Обращение энтропии', icon: '⏳', cost: 4e17, loc: 10, k: 'inc', v: 0.8, d: 'Весь доход +80%' },
    { id: 'rootreal', name: 'Root-доступ к реальности', icon: '🗝', cost: 5e18, loc: 11, k: 'inc', v: 1.5, d: 'Весь доход +150%' },
  ];
  // ×2 на каждое железо, когда его 10+ штук
  HW.forEach((h) => UPG.push({ id: 'x2_' + h.id, name: `Тюнинг: ${h.name}`, icon: h.icon, cost: h.cost * 25, loc: h.loc, k: 'hw', hw: h.id, need: 10, v: 2, d: `${h.name} ×2 (нужно 10 шт.)` }));
  HW.forEach((h) => UPG.push({ id: 'x3_' + h.id, name: `Тюнинг II: ${h.name}`, icon: h.icon, cost: h.cost * 800, loc: h.loc, k: 'hw', hw: h.id, need: 50, v: 3, d: `${h.name} ×3 (нужно 50 шт.)` }));
  HW.forEach((h) => UPG.push({ id: 'x5_' + h.id, name: `Тюнинг III: ${h.name}`, icon: h.icon, cost: h.cost * 6e4, loc: h.loc, k: 'hw', hw: h.id, need: 100, v: 5, d: `${h.name} ×5 (нужно 100 шт.)` }));

  // Защита: уровни
  // Лаборатория (с Подземного ДЦ): исследования идут в реальном времени и остаются навсегда, даже после Reboot
  const RES = [
    { id: 'r1', name: 'Оптимизация кода', icon: '🧹', min: 2, base: 5e8, b: { inc: 0.1 }, d: 'Доход +10%' },
    { id: 'r2', name: 'Квантовое шифрование', icon: '🔐', min: 3, base: 1e9, b: { def: 0.06 }, d: 'Отбить атаку +6%' },
    { id: 'r3', name: 'Нейро-трейдер', icon: '📊', min: 3, base: 2e9, b: { sell: 0.5 }, d: 'Продажа предметов +50%' },
    { id: 'r4', name: 'Сверхпроводники', icon: '🧲', min: 4, base: 4e9, b: { cool: 10 }, d: 'Охлаждение +10/с' },
    { id: 'r5', name: 'Фабрика эксплойтов', icon: '🏭', min: 5, base: 8e9, b: { cd: 0.15 }, d: 'Перезарядка атак −15%' },
    { id: 'r6', name: 'Автоматизация', icon: '🦾', min: 5, base: 2e10, b: { macro: 0.02 }, d: 'Клик +2% от дохода/с' },
    { id: 'r7', name: 'Генная удача', icon: '🍀', min: 6, base: 5e10, b: { luck: 0.25 }, d: 'Удача в кейсах +25%' },
    { id: 'r8', name: 'Армия ботов', icon: '🤖', min: 6, base: 1e11, b: { boss: 0.5 }, d: 'Урон боссу +50%' },
    { id: 'r9', name: 'Холодный синтез', icon: '⚛', min: 8, base: 3e11, b: { inc: 0.25 }, d: 'Доход +25%' },
    { id: 'r10', name: 'Тёмная материя', icon: '🕳', min: 10, base: 1e12, b: { cores: 0.25 }, d: 'Reboot даёт +25% ядер' },
    { id: 'r11', name: 'Предсказание будущего', icon: '🔭', min: 10, base: 5e12, b: { hit: 0.1 }, d: 'Шанс атак +10%' },
    { id: 'r12', name: 'Сознание ИИ', icon: '🧠', min: 15, base: 2e13, b: { incMul: 0.5 }, d: 'Доход ×1.5' },
    { id: 'r13', name: 'Варп-сеть', icon: '🚀', min: 15, base: 1e14, b: { case: 0.3 }, d: 'Кейсы дешевле на 30%' },
    { id: 'r14', name: 'Червоточина', icon: '🌀', min: 20, base: 1e15, b: { incMul: 1 }, d: 'Доход ×2' },
  ];
  // цена исследования растёт с твоим доходом, чтобы не было «бесплатно»
  const resCost = (r, stable) => Math.max(r.base, Math.round(stable * r.min * 40));

  // Общий проект всей комнаты: скидываетесь на Мега-ДЦ, каждый уровень даёт всем +10% дохода навсегда
  const MEGA_STAGES = ['Фундамент', 'Энергоблок', 'Машинный зал', 'Градирни', 'Оптический хаб', 'Термоядерный реактор', 'Орбитальный лифт', 'Квантовое ядро', 'Портал', 'Сингулярность'];
  const megaGoal = (lvl) => 1e8 * Math.pow(12, lvl);

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
      { id: 'f6', name: 'Конвейер', d: 'Доход +75%', c: 40 },
      { id: 'f7', name: 'Фабрика ядер', d: 'Reboot даёт +50% ядер', c: 90 },
      { id: 'f8', name: 'Бог фарма', d: 'Доход ×3', c: 200 },
    ] },
    atk: { name: 'ATTACK', color: '#ff6b6b', nodes: [
      { id: 'a1', name: 'Скрипт-кидди', d: 'Перезарядка атак −25%', c: 1 },
      { id: 'a2', name: 'Жадность', d: 'Взлом крадёт +2%', c: 2 },
      { id: 'a3', name: 'Социнженерия', d: 'Шанс успеха +15%', c: 4 },
      { id: 'a4', name: 'Ботнет', d: 'Урон по боссу ×2', c: 8 },
      { id: 'a5', name: 'Сетевой червь', d: 'Взлом ×2 и игнорит Proxy', c: 16 },
      { id: 'a6', name: 'Кибервойна', d: 'DDoS дольше на 50% и перехват 100%', c: 40 },
      { id: 'a7', name: 'Мародёр', d: 'Взлом крадёт и случайный ненадетый предмет', c: 90 },
      { id: 'a8', name: 'Апокалипсис', d: 'Перезарядка −50%, кража ×1.5', c: 200 },
    ] },
    def: { name: 'DEFENCE', color: '#6bc9ff', nodes: [
      { id: 'd1', name: 'Параноик', d: 'Отбить атаку +10%', c: 1 },
      { id: 'd2', name: 'Карантин', d: 'После взлома щит на 90 с', c: 2 },
      { id: 'd3', name: 'Зеркало', d: 'Отбитый хакер платит тебе 2%', c: 4 },
      { id: 'd4', name: 'Бункер', d: 'Плохие события не действуют', c: 8 },
      { id: 'd5', name: 'Крепость', d: 'Крадут максимум 1%, DDoS не берёт', c: 16 },
      { id: 'd6', name: 'Ханипот', d: 'Отбитый хакер платит 6% вместо 2%', c: 40 },
      { id: 'd7', name: 'Облачный бэкап', d: 'Ещё +30% кредитов нельзя украсть', c: 90 },
      { id: 'd8', name: 'Неуязвимость', d: 'После любой атаки — щит 3 минуты', c: 200 },
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
    s5: { n: 'Кристалл памяти 5D', t: 'DISK', r: 'p', b: { luck: 1.5, inc: 0.4 } },
    d5: { n: 'Квантовый файрвол', t: 'DEF', r: 'p', b: { def: 0.35, prot: 0.35 } },
    k5: { n: 'Чёрная дыра (кулер)', t: 'COOL', r: 'p', b: { cool: 40, inc: 0.4 } },
    n1: { n: 'Роутер TP-Link', t: 'NET', r: 'c', b: { inc: 0.02, hit: 0.02 } },
    n2: { n: 'Оптика 10G', t: 'NET', r: 'r', b: { inc: 0.05, hit: 0.04 } },
    n3: { n: 'Магистраль 400G', t: 'NET', r: 'e', b: { inc: 0.1, hit: 0.07, boss: 0.1 } },
    n4: { n: 'Подводный кабель', t: 'NET', r: 'l', b: { inc: 0.22, hit: 0.12, boss: 0.25 } },
    n5: { n: 'Квантовая телепортация', t: 'NET', r: 'p', b: { inc: 0.6, hit: 0.25, boss: 0.6 } },
    p1: { n: 'Блок питания noname', t: 'PSU', r: 'c', b: { click: 0.04, cool: 0.5 } },
    p2: { n: 'Seasonic Titanium', t: 'PSU', r: 'r', b: { click: 0.1, cool: 1 } },
    p3: { n: 'Дизель-генератор', t: 'PSU', r: 'e', b: { click: 0.2, inc: 0.06 } },
    p4: { n: 'Мини-АЭС', t: 'PSU', r: 'l', b: { click: 0.45, inc: 0.15 } },
    p5: { n: 'Звезда в банке', t: 'PSU', r: 'p', b: { click: 1.2, inc: 0.5 } },
  };
  const TYPE_ICON = { GPU: '🎮', CPU: '🔳', ATK: '💀', DEF: '🛡', COOL: '❄', DISK: '💾', NET: '🌐', PSU: '🔋' };
  const STAR_MAX = 5;
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
    { id: 'friday', name: 'Чёрная пятница', icon: '🛍', d: 'Кейсы за полцены', caseMul: 0.5 },
    { id: 'hackathon', name: 'Хакатон', icon: '👨‍💻', d: 'Перезарядка атак ×0.3', cdMul: 0.3 },
    { id: 'solar', name: 'Солнечная вспышка', icon: '🌞', d: 'Доход ×1.5, нагрев ×3', inc: 1.5, heat: 3 },
    { id: 'leak', name: 'Утечка базы паролей', icon: '🔑', d: 'Взломы крадут ×2', stealMul: 2 },
    { id: 'grant', name: 'Госгрант на ИИ', icon: '🏛', d: 'Исследования идут ×3 быстрее', resMul: 3 },
    { id: 'halving', name: 'Халвинг', icon: '✂', d: 'Доход ×0.7, клики ×2.5', bad: true, inc: 0.7, click: 2.5 },
    { id: 'outage', name: 'Блэкаут в городе', icon: '🕯', d: 'Доход ×0.5, зато атаки запрещены', bad: true, inc: 0.5, noAtk: true },
    { id: 'meteor', name: 'Метеоритный дождь', icon: '☄', d: 'Каждому — бесплатный кейс', freeCase: true },
  ];
  const EVENT_LEN = 90e3;

  const RAID_BOSSES = ['☢ ЦЕНТРОБАНК.EXE', '☢ МАТРИЦА', '☢ GOOGLE DATACENTER', '☢ ЧЁРНЫЙ ЛЕБЕДЬ'];
  const BOSSES = ['MEGA SERVER', 'Ботнет «Mirai 2»', 'Нейросеть-коллектор', 'Сервер Госдумы', 'ГОСУСЛУГИ.EXE', 'Ботоферма «Ольгино»', 'Сервер Пентагона', 'SKYNET v0.9', 'Майнер в школьном ПК', 'Облако Сбера', 'Робот-коллектор'];
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
    trillion: ['Триллионер', 'Набери 1 трлн очков'],
    lab1: ['Учёный', 'Заверши первое исследование'],
    laball: ['Нобелевка', 'Заверши все исследования'],
    ally: ['Братва', 'Вступи в альянс'],
    patron: ['Меценат', 'Вложи в Мега-ДЦ 1 млрд'],
    star: ['Кузнец', 'Сплавь предмет на ★'],
    star5: ['Пять звёзд', 'Получи предмет ★★★★★'],
    moon: ['Лунатик', 'Переберись на Лунную базу'],
    neo: ['Нео', 'Дойди до Симуляции'],
    sing: ['Сингулярность', 'Сделай Сингулярность'],
    raid: ['Рейдер', 'Победи рейд-босса'],
    ddos10: ['Ботовод', '10 успешных DDoS'],
    cases100: ['Лудоман', 'Открой 100 кейсов'],
    hw1k: ['Барон серверов', 'Купи 1 000 единиц железа'],
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
    { id: 'patron', icon: '🏗', name: 'Строитель Мега-ДЦ', d: 'вложено в общий проект', key: (p) => p.st.mega || 0 },
    { id: 'scientist', icon: '🔬', name: 'Главный учёный', d: 'исследований', key: (p) => (p.res || []).length },
  ];

  window.DCData = {
    LOCS, HW, HW_GROWTH, UPG, RES, resCost, MEGA_STAGES, megaGoal, STAR_MAX, RAID_BOSSES, DEF, DEF_GROWTH, ATK, ATK_CD, TREE, R, RAR, ITEMS, TYPE_ICON, BONUS_TXT,
    EVENTS, EVENT_LEN, BOSSES, BOSS_EVERY, BOSS_FIRST, BOSS_LEN, COMBO, OC, ACH, AWARDS,
  };
})();
