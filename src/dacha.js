// «Дача» — уютная ферма: грядки растут в реальном времени, двор, заказы соседей, кенты в гостях
(function () {
  const A = window.QBApp, ART = window.DachaArt;
  const root = document.getElementById('dc');
  if (!A || !ART || !root) return;
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rub = (n) => Math.floor(n).toLocaleString('ru-RU') + ' ₽';
  const rnd = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  const MIN = 60e3, HOUR = 3600e3;

  /* ================= справочник ================= */
  // grow — минуты; yield базово 2 шт., полив +1, сорняк −1
  const CROPS = [
    { id: 'radish', name: 'Редиска', grow: 2, seed: 1, price: 4, xp: 1, lvl: 1 },
    { id: 'carrot', name: 'Морковь', grow: 5, seed: 2, price: 10, xp: 2, lvl: 1 },
    { id: 'dill', name: 'Укроп', grow: 10, seed: 7, price: 33, xp: 3, lvl: 2 },
    { id: 'potato', name: 'Картошка', grow: 30, seed: 30, price: 145, xp: 5, lvl: 3 },
    { id: 'cucumber', name: 'Огурцы', grow: 60, seed: 80, price: 383, xp: 8, lvl: 4 },
    { id: 'tomato', name: 'Помидоры', grow: 120, seed: 210, price: 972, xp: 12, lvl: 5 },
    { id: 'strawberry', name: 'Клубника', grow: 240, seed: 585, price: 2730, xp: 18, lvl: 7 },
    { id: 'cabbage', name: 'Капуста', grow: 360, seed: 1010, price: 4720, xp: 22, lvl: 8 },
    { id: 'pumpkin', name: 'Тыква', grow: 480, seed: 1685, price: 7860, xp: 30, lvl: 10 },
    { id: 'sunflower', name: 'Подсолнух', grow: 720, seed: 3065, price: 14300, xp: 40, lvl: 12 },
    { id: 'watermelon', name: 'Арбуз', grow: 1440, seed: 7865, price: 36700, xp: 60, lvl: 15 },
    { id: 'onion', name: 'Лук', grow: 15, seed: 11, price: 51, xp: 3, lvl: 2 },
    { id: 'beet', name: 'Свёкла', grow: 20, seed: 20, price: 94, xp: 4, lvl: 3 },
    { id: 'garlic', name: 'Чеснок', grow: 45, seed: 60, price: 282, xp: 6, lvl: 4 },
    { id: 'peas', name: 'Горох', grow: 90, seed: 155, price: 716, xp: 10, lvl: 5 },
    { id: 'zucchini', name: 'Кабачок', grow: 180, seed: 375, price: 1750, xp: 15, lvl: 6 },
    { id: 'pepper', name: 'Перец', grow: 300, seed: 930, price: 4340, xp: 20, lvl: 9 },
    { id: 'eggplant', name: 'Баклажан', grow: 420, seed: 1595, price: 7450, xp: 26, lvl: 11 },
    { id: 'corn', name: 'Кукуруза', grow: 600, seed: 2725, price: 12710, xp: 34, lvl: 13 },
    { id: 'raspberry', name: 'Малина', grow: 840, seed: 4170, price: 19460, xp: 44, lvl: 14 },
    { id: 'melon', name: 'Дыня', grow: 1080, seed: 6540, price: 30520, xp: 52, lvl: 17 },
    { id: 'lavender', name: 'Лаванда', grow: 1200, seed: 7720, price: 36020, xp: 56, lvl: 18 },
    { id: 'rose', name: 'Розы', grow: 1800, seed: 13100, price: 61130, xp: 80, lvl: 20 },
    { id: 'blueberry', name: 'Голубика', grow: 2160, seed: 17400, price: 81200, xp: 95, lvl: 22 },
    { id: 'goldpumpkin', name: 'Золотая тыква', grow: 2880, seed: 0, price: 177710, xp: 200, lvl: 15, seedItem: 'goldseed' },
  ].sort((a, b) => a.lvl - b.lvl || a.grow - b.grow);
  const GOODS = {
    egg: { name: 'Яйца', price: 300 }, honey: { name: 'Мёд', price: 2100 },
    apple: { name: 'Яблоки', price: 300 }, cherry: { name: 'Вишня', price: 350 }, pear: { name: 'Груши', price: 700 }, plum: { name: 'Сливы', price: 800 },
    apricot: { name: 'Абрикосы', price: 1400 }, peach: { name: 'Персики', price: 2100 }, walnut: { name: 'Грецкие орехи', price: 3000 }, orange: { name: 'Апельсины', price: 4500 },
  };
  // деревья: сажаешь раз, потом плодоносят бесконечно. grow и every — минуты
  const TREES = [
    { id: 'apple', name: 'Яблоня', lvl: 4, price: 2000, grow: 180, every: 120, n: 4 },
    { id: 'cherry', name: 'Вишня', lvl: 6, price: 4500, grow: 240, every: 180, n: 6 },
    { id: 'pear', name: 'Груша', lvl: 8, price: 7500, grow: 360, every: 180, n: 4 },
    { id: 'plum', name: 'Слива', lvl: 10, price: 12500, grow: 480, every: 240, n: 5 },
    { id: 'apricot', name: 'Абрикос', lvl: 13, price: 25000, grow: 720, every: 300, n: 5 },
    { id: 'peach', name: 'Персик', lvl: 16, price: 45000, grow: 960, every: 360, n: 5 },
    { id: 'walnut', name: 'Грецкий орех', lvl: 20, price: 100000, grow: 1440, every: 480, n: 6 },
    { id: 'orange', name: 'Апельсин', lvl: 24, price: 200000, grow: 1440, every: 360, n: 6 },
  ];
  const treeDef = (id) => TREES.find((t) => t.id === id);
  // места под деревья: 2 бесплатно, дальше докупаются
  const ORCH = [{ price: 15000, lvl: 4 }, { price: 50000, lvl: 6 }, { price: 150000, lvl: 9 }, { price: 400000, lvl: 12 }, { price: 1000000, lvl: 16 }, { price: 2500000, lvl: 20 }];
  // сельпо: инструменты, редкие семена и защита от воров
  const SHOP = [
    { id: 'fert', kind: 'tool', name: 'Удобрение', price: 750, always: true, desc: 'Грядка дорастает вдвое быстрее' },
    { id: 'compost', kind: 'tool', name: 'Компост', price: 600, always: true, desc: '+1 к урожаю грядки' },
    { id: 'scarecrow', kind: 'guard', name: 'Пугало', price: 1500, always: true, hours: 2, p: 0.3, desc: 'Отпугивает воров: 30% на 2 часа' },
    { id: 'grow', kind: 'tool', name: 'Золотая лейка', price: 4500, desc: 'Грядка созревает мгновенно' },
    { id: 'treefert', kind: 'tool', name: 'Подкормка для сада', price: 7500, desc: 'Дерево сразу дорастает и даёт плоды' },
    { id: 'goldseed', kind: 'tool', name: 'Семена золотой тыквы', price: 40000, lvl: 15, desc: 'Бывают только в сельпо. Тыква — 177 000 ₽ за штуку' },
    { id: 'trap', kind: 'guard', name: 'Капкан', price: 4000, hours: 24, p: 1, once: true, desc: 'Ловит первого же вора (сутки)' },
    { id: 'camera', kind: 'guard', name: 'Камера', price: 7500, hours: 6, p: 0.55, desc: 'Воры палятся: 55% на 6 часов' },
    { id: 'alarm', kind: 'guard', name: 'Сигнализация', price: 20000, hours: 12, p: 0.7, desc: 'Орёт на всю округу: 70% на 12 часов' },
    { id: 'watch', kind: 'guard', name: 'Дорогие часы на заборе', price: 45000, hours: 8, p: 0.75, desc: 'Вор залипает на часы и попадается: 75% на 8 часов' },
    { id: 'guard', kind: 'guard', name: 'Сторож дядя Вася', price: 100000, hours: 24, p: 0.88, desc: 'Сторожит сутки: 88%' },
  ];
  const shopDef = (id) => SHOP.find((x) => x.id === id);
  const STOCK_T = 2 * HOUR;
  const crop = (id) => CROPS.find((c) => c.id === id);
  // точки расширения: модули (погода, кухня, пруд…) подключаются сюда
  const H = { growMul: [], yieldAdd: [], priceMul: [], onHarvest: [], tick: [], bedExtra: [], bedClick: [], buffs: [], scene: [], tabs: [], click: [], itemInfo: [] };
  const sumH = (k, ...a) => H[k].reduce((acc, f) => acc + (+f(...a) || 0), 0);
  const mulH = (k, ...a) => H[k].reduce((acc, f) => { const v = f(...a); return acc * (v == null ? 1 : v); }, 1);
  const info = (id) => { for (const f of H.itemInfo) { const r = f(id); if (r) return r; } return crop(id) || GOODS[id] || null; };
  const itemName = (id) => (info(id) || {}).name || id;
  const basePrice = (id) => (info(id) || {}).price || 0;

  const BUILD = [
    { id: 'coop', name: 'Курятник', lvl: 3, price: 4000, desc: 'Куры несут яйца раз в 40 минут' },
    { id: 'well', name: 'Колодец', lvl: 4, price: 7500, desc: 'Всё, что сажаешь, сразу полито' },
    { id: 'dog', name: 'Будка с Бубликом', lvl: 5, price: 12500, desc: 'Бублик гоняет воров с грядок' },
    { id: 'hive', name: 'Пасека', lvl: 6, price: 20000, desc: 'Банка мёда раз в 2 часа' },
    { id: 'greenhouse', name: 'Теплица', lvl: 8, price: 45000, desc: '+3 грядки, растут в 1.5 раза быстрее' },
    { id: 'banya', name: 'Баня', lvl: 10, price: 80000, desc: 'Попарился — 30 минут продаёшь на 20% дороже' },
  ];
  const DECO = [
    { id: 'gnome', name: 'Садовый гном', price: 20000, cozy: 1 },
    { id: 'flowers', name: 'Клумба', price: 50000, cozy: 2 },
    { id: 'bench', name: 'Скамейка', price: 100000, cozy: 2 },
    { id: 'grill', name: 'Мангал', price: 250000, cozy: 3 },
    { id: 'swing', name: 'Качели', price: 600000, cozy: 4 },
    { id: 'fountain', name: 'Фонтан', price: 1500000, cozy: 5 },
    { id: 'gazebo', name: 'Беседка', price: 4000000, cozy: 6 },
    { id: 'pool', name: 'Бассейн', price: 10000000, cozy: 8 },
  ];
  // участок: сколько грядок, цена и уровень
  const LAND = [{ n: 6, price: 0, lvl: 1 }, { n: 9, price: 2500, lvl: 2 }, { n: 12, price: 10000, lvl: 4 }, { n: 16, price: 30000, lvl: 7 }, { n: 20, price: 75000, lvl: 10 }];
  const EGG_T = 40 * MIN, HONEY_T = 2 * HOUR, WEED_T = 10 * MIN, STEAM_LEN = 30 * MIN, STEAM_CD = 4 * HOUR;
  const COOP_MAX = 6, COOP_HEN = (n) => 3000 * 2 ** n; // докупить курицу
  const NEIGHBORS = [
    { name: 'Баба Валя', color: '#ec6a8c' }, { name: 'Дед Михалыч', color: '#5b8def' }, { name: 'Сосед Толик', color: '#f2a93b' },
    { name: 'Тётя Люба', color: '#9a6cf0' }, { name: 'Председатель', color: '#5fae8f' },
  ];
  const need = (l) => Math.round(15 * l ** 1.7);

  /* ================= состояние ================= */
  const S = Object.assign({
    rub: 300, xp: 0, lvl: 1, land: 0, beds: [], gh: [], b: {}, hens: 0, coopAt: 0, hiveAt: 0,
    steamAt: 0, steamUntil: 0, inv: {}, orders: [], orderNext: 0, weedAt: Date.now(), seed: 'radish', deco: [],
    stats: { harvest: 0, earned: 0, stolen: 0, caught: 0 }, steals: {},
    view: 'garden', orch: [], orchSlots: 0, sapling: 'apple', tools: {}, guards: {}, arm: null, stockW: 0, bought: {},
  }, A.load('qb.dacha', {}));
  const fixBeds = () => {
    const slots = 2 + S.orchSlots;
    while (S.orch.length < slots) S.orch.push({ tr: null, t: 0, fAt: 0 });
    const n = LAND[S.land].n;
    while (S.beds.length < n) S.beds.push({ c: null, t: 0, w: false, weed: false, s: 0 });
    if (S.b.greenhouse) while (S.gh.length < 3) S.gh.push({ c: null, t: 0, w: false, weed: false, s: 0 });
  };
  fixBeds();
  let saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => A.store('qb.dacha', S), 300); };

  const cozy = () => S.deco.reduce((s, id) => s + ((DECO.find((d) => d.id === id) || {}).cozy || 0), 0);
  const steaming = () => Date.now() < S.steamUntil;
  // цены на рынке меняются раз в день (одинаково у всех)
  function dayMult(id) {
    const key = new Date().toISOString().slice(0, 10) + id;
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return 0.82 + ((h >>> 0) % 1000) / 1000 * 0.36;
  }
  function hotItem() {
    const pool = CROPS.filter((c) => c.lvl <= Math.max(3, S.lvl) && !c.seedItem);
    const d = new Date().toISOString().slice(0, 10);
    let h = 0;
    for (let i = 0; i < d.length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
    return pool[h % pool.length].id;
  }
  const sellPrice = (id) => Math.round(basePrice(id) * dayMult(id) * (id === hotItem() ? 1.5 : 1) * (1 + cozy() / 100) * (steaming() ? 1.2 : 1) * mulH('priceMul', id));

  // грядка: длительность и стадия
  const growMs = (bed, gh) => (bed.g || crop(bed.c).grow * MIN) / (gh ? 1.5 : 1);
  function stage(bed, gh) {
    if (!bed.c) return -1;
    const p = (Date.now() - bed.t) / growMs(bed, gh);
    return p >= 1 ? 3 : p >= 0.6 ? 2 : p >= 0.2 ? 1 : 0;
  }
  const leftMs = (bed, gh) => Math.max(0, bed.t + growMs(bed, gh) - Date.now());
  const yieldOf = (bed) => Math.max(1, 2 + (bed.w ? 1 : 0) + (bed.cp || 0) - (bed.weed ? 1 : 0) - (bed.s || 0) + sumH('yieldAdd', bed));
  const fmtLeft = (ms) => {
    const m = Math.ceil(ms / MIN);
    if (m >= 60) return `${Math.floor(m / 60)} ч ${m % 60 ? (m % 60) + ' мин' : ''}`.trim();
    return ms < MIN ? `${Math.ceil(ms / 1000)} с` : `${m} мин`;
  };

  /* ================= звук ================= */
  let ac = null;
  function tone(f, at, dur, vol, type = 'sine', f2) {
    try {
      ac = ac || new AudioContext();
      const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) { /* без звука */ }
  }
  const sfx = {
    plant: () => tone(220, 0, 0.12, 0.05, 'triangle', 140),
    pop: () => { tone(660, 0, 0.09, 0.05, 'sine', 990); tone(990, 0.06, 0.12, 0.035, 'sine', 1320); },
    water: () => { for (let i = 0; i < 5; i++) tone(900 + rnd() * 700, i * 0.04, 0.06, 0.018, 'sine', 400); },
    coin: () => { tone(1320, 0, 0.12, 0.04, 'triangle'); tone(1760, 0.07, 0.18, 0.035, 'triangle'); },
    pull: () => tone(300, 0, 0.1, 0.05, 'square', 120),
    level: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.09, 0.25, 0.05, 'triangle')),
    woof: () => { tone(240, 0, 0.12, 0.08, 'sawtooth', 160); tone(260, 0.18, 0.12, 0.08, 'sawtooth', 170); },
  };

  /* ================= экономика ================= */
  function addXp(n) {
    S.xp += n;
    while (S.xp >= need(S.lvl)) {
      S.xp -= need(S.lvl);
      S.lvl++;
      sfx.level();
      A.toast(`🌱 Дача: уровень ${S.lvl}!`);
      celebrate();
    }
  }
  const addItem = (id, n) => { S.inv[id] = (S.inv[id] || 0) + n; };
  function pay(x) {
    if (S.rub < x) { A.toast('Не хватает рублей'); return false; }
    S.rub -= x;
    return true;
  }

  /* ================= грядки ================= */
  const bedAt = (key) => { const [k, i] = key.split(':'); return { bed: (k === 'g' ? S.gh : S.beds)[+i], gh: k === 'g' }; };

  function plantBed(bed, quiet) {
    const c = crop(S.seed);
    if (!c || c.lvl > S.lvl || bed.c || bed.weed) return false;
    if (c.seedItem) {
      if (!(S.tools[c.seedItem] > 0)) { if (!quiet) A.toast('Семена золотой тыквы бывают только в сельпо'); return false; }
      S.tools[c.seedItem]--;
    } else if (!pay(c.seed)) return false;
    Object.assign(bed, { c: c.id, t: Date.now(), w: !!S.b.well, s: 0, cp: 0, g: Math.round(c.grow * MIN * mulH('growMul', c, bed)) });
    if (!quiet) sfx.plant();
    return true;
  }
  function harvestBed(bed, el) {
    const n = yieldOf(bed), id = bed.c, c = crop(id);
    addItem(id, n);
    addXp(c.xp);
    S.stats.harvest += n;
    H.onHarvest.forEach((f) => f(id, n, bed, el));
    Object.assign(bed, { c: null, t: 0, w: false, weed: false, s: 0, cp: 0, g: 0 });
    if (el) floatAt(el, `+${n}`, id);
    sfx.pop();
  }
  function onBed(key, el) {
    if (visit) return onVisitBed(key, el);
    const { bed, gh } = bedAt(key);
    const st = stage(bed, gh);
    if (H.bedClick.some((f) => f(bed, gh, el))) { save(); render(); return; }
    if (S.arm && S.arm !== 'treefert' && st >= 0 && st < 3) { useTool(bed, gh, el); save(); render(); return; }
    if (bed.weed && st !== 3) { bed.weed = false; addXp(1); sfx.pull(); floatAt(el, '🌿', null); }
    else if (st === 3) harvestBed(bed, el);
    else if (st === -1) { if (!plantBed(bed)) { if (crop(S.seed).lvl > S.lvl) A.toast('Эти семена откроются позже'); } }
    else if (!bed.w) { bed.w = true; sfx.water(); el.classList.add('splash'); }
    else A.toast(`${crop(bed.c).name}: созреет через ${fmtLeft(leftMs(bed, gh))}`);
    save();
    render();
  }
  const allBeds = () => [...S.beds.map((b) => [b, false]), ...S.gh.map((b) => [b, true])];
  function harvestAll() {
    let n = 0;
    allBeds().forEach(([b, gh]) => { if (stage(b, gh) === 3) { harvestBed(b); n++; } });
    S.orch.forEach((o) => { if (treeStage(o) === 3) { const d = treeDef(o.tr); addItem(d.id, d.n); addXp(Math.round(d.n * 3 + d.lvl)); S.stats.harvest += d.n; o.fAt = Date.now(); n++; } });
    if (n) { A.toast(`🧺 Собрано с ${n} грядок`); save(); render(); } else A.toast('Пока нечего собирать');
  }
  function waterAll() {
    let n = 0;
    allBeds().forEach(([b, gh]) => { if (b.c && stage(b, gh) < 3 && !b.w) { b.w = true; n++; } });
    if (n) { sfx.water(); save(); render(); } else A.toast('Всё уже полито');
  }
  function plantAll() {
    let n = 0;
    for (const [b] of allBeds()) { if (!b.c && !b.weed) { if (!plantBed(b, true)) break; n++; } }
    if (n) { sfx.plant(); A.toast(`🌱 Посажено: ${crop(S.seed).name} × ${n}`); save(); render(); }
  }

  // сорняки: раз в 10 минут каждая незасеянная или растущая грядка может зарасти
  function weedTick() {
    const now = Date.now();
    let steps = Math.min(6, Math.floor((now - S.weedAt) / WEED_T));
    if (steps < 1) return;
    S.weedAt += steps * WEED_T;
    if (now - S.weedAt > WEED_T) S.weedAt = now;
    while (steps--) allBeds().forEach(([b, gh]) => { if (!b.weed && stage(b, gh) !== 3 && rnd() < 0.05) b.weed = true; });
    save();
  }


  /* ================= сельпо и инструменты ================= */
  const stockWin = () => Math.floor(Date.now() / STOCK_T);
  // сток одинаковый у всех кентов: считается из номера окна
  function stock() {
    const w = stockWin();
    let h = 2166136261 ^ w;
    const next = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    const list = [];
    SHOP.forEach((x) => {
      if (x.always) list.push({ id: x.id, qty: Infinity });
      else if (next() < 0.6) list.push({ id: x.id, qty: 1 + Math.floor(next() * (x.kind === 'guard' ? 2 : 4)) });
    });
    return list;
  }
  function stockLeft(id, qty) {
    if (S.stockW !== stockWin()) { S.stockW = stockWin(); S.bought = {}; }
    return qty - (S.bought[id] || 0);
  }
  const guardOn = (id) => (S.guards[id] || 0) > Date.now();
  function buyShop(id) {
    const x = shopDef(id), it = stock().find((s) => s.id === id);
    if (!x || !it) return;
    if (x.lvl && S.lvl < x.lvl) { A.toast(`Откроется на ${x.lvl} уровне`); return; }
    if (stockLeft(id, it.qty) <= 0) { A.toast('Разобрали — жди завоз'); return; }
    if (!pay(x.price)) return;
    S.bought[id] = (S.bought[id] || 0) + 1;
    if (x.kind === 'guard') {
      S.guards[id] = Math.max(S.guards[id] || 0, Date.now()) + x.hours * HOUR;
      A.toast(`🛡 ${x.name} — дача под охраной`);
    } else S.tools[id] = (S.tools[id] || 0) + 1;
    sfx.coin();
    track();
    save(); render();
  }
  function useTool(bed, gh, el) {
    const id = S.arm;
    if (!(S.tools[id] > 0)) { S.arm = null; return; }
    if (id === 'fert') { const left = leftMs(bed, gh); bed.t -= left / 2; }
    else if (id === 'compost') { if ((bed.cp || 0) >= 1) { A.toast('Тут уже есть компост'); return; } bed.cp = 1; }
    else if (id === 'grow') bed.t = Date.now() - growMs(bed, gh);
    S.tools[id]--;
    if (!S.tools[id]) S.arm = null;
    sfx.water();
    floatAt(el, '✨', null);
  }
  // защита: собака и всё купленное складываются
  function protection() {
    let miss = S.b.dog ? 0.3 : 1;
    SHOP.filter((x) => x.kind === 'guard' && !x.once && guardOn(x.id)).forEach((x) => { miss *= 1 - x.p; });
    return 1 - miss;
  }
  const guardsActive = () => SHOP.filter((x) => x.kind === 'guard' && guardOn(x.id)).map((x) => x.id);
  const CAUGHT_BY = {
    trap: 'попался в капкан', guard: 'нарвался на сторожа дядю Васю', watch: 'залип на твои часы и попался', alarm: 'перепугался сигнализации',
    camera: 'попал на камеру', scarecrow: 'испугался пугала', dog: 'укушен Бубликом',
  };

  /* ================= сад ================= */
  function treeStage(o) {
    if (!o || !o.tr) return -1;
    const d = treeDef(o.tr), now = Date.now(), age = now - o.t;
    if (age < d.grow * MIN * 0.35) return 0;
    if (age < d.grow * MIN) return 1;
    return now - o.fAt >= d.every * MIN ? 3 : 2;
  }
  function treeLeft(o) {
    const d = treeDef(o.tr), now = Date.now();
    if (now - o.t < d.grow * MIN) return o.t + d.grow * MIN - now;
    return Math.max(0, o.fAt + d.every * MIN - now);
  }
  function onTree(i, el) {
    if (visit) return;
    const o = S.orch[i], st = treeStage(o);
    if (st === -1) {
      const d = treeDef(S.sapling);
      if (!d || d.lvl > S.lvl) { A.toast('Выбери саженец в «Семенах»'); tab = 'seeds'; render(); return; }
      if (!pay(d.price)) return;
      Object.assign(o, { tr: d.id, t: Date.now(), fAt: Date.now() + d.grow * MIN - d.every * MIN });
      sfx.plant();
    } else if (S.arm === 'treefert' && st < 3) {
      if (!(S.tools.treefert > 0)) { S.arm = null; return; }
      const d = treeDef(o.tr);
      if (Date.now() - o.t < d.grow * MIN) o.t = Date.now() - d.grow * MIN;
      o.fAt = Date.now() - d.every * MIN;
      S.tools.treefert--;
      if (!S.tools.treefert) S.arm = null;
      sfx.water();
      floatAt(el, '✨', null);
    } else if (st === 3) {
      const d = treeDef(o.tr);
      addItem(d.id, d.n);
      addXp(Math.round(d.n * 3 + d.lvl));
      S.stats.harvest += d.n;
      o.fAt = Date.now();
      floatAt(el, `+${d.n}`, d.id);
      sfx.pop();
    } else A.toast(`${treeDef(o.tr).name}: ${st < 2 ? 'подрастёт' : 'плоды будут'} через ${fmtLeft(treeLeft(o))}`);
    save(); render();
  }
  function buyOrchSlot() {
    const nx = ORCH[S.orchSlots];
    if (!nx) return;
    if (S.lvl < nx.lvl) { A.toast(`Новое место в саду — с ${nx.lvl} уровня`); return; }
    if (!pay(nx.price)) return;
    S.orchSlots++;
    fixBeds();
    sfx.coin(); celebrate();
    save(); render();
  }

  /* ================= двор ================= */
  const eggsReady = () => (S.b.coop ? Math.min(S.hens * 2, Math.floor((Date.now() - S.coopAt) / EGG_T) * S.hens) : 0);
  const honeyReady = () => (S.b.hive ? Math.min(3, Math.floor((Date.now() - S.hiveAt) / HONEY_T)) : 0);
  function onBuilding(id, el) {
    if (visit) return;
    const def = BUILD.find((b) => b.id === id);
    if (!S.b[id]) {
      if (S.lvl < def.lvl) { A.toast(`${def.name} откроется на ${def.lvl} уровне`); return; }
      if (!pay(def.price)) return;
      S.b[id] = true;
      if (id === 'coop') { S.hens = 2; S.coopAt = Date.now(); }
      if (id === 'hive') S.hiveAt = Date.now();
      if (id === 'greenhouse') fixBeds();
      sfx.coin();
      celebrate();
      A.toast(`🏡 Построено: ${def.name}`);
    } else if (id === 'coop') {
      const n = eggsReady();
      if (!n) { A.toast(`Куры ещё не снеслись · кур: ${S.hens}`); return; }
      addItem('egg', n); addXp(n);
      S.coopAt = Date.now() - ((Date.now() - S.coopAt) % EGG_T);
      floatAt(el, `+${n}`, 'egg'); sfx.pop();
    } else if (id === 'hive') {
      const n = honeyReady();
      if (!n) { A.toast('Пчёлы ещё работают'); return; }
      addItem('honey', n); addXp(n * 5);
      S.hiveAt = Date.now() - ((Date.now() - S.hiveAt) % HONEY_T);
      floatAt(el, `+${n}`, 'honey'); sfx.pop();
    } else if (id === 'banya') {
      if (Date.now() - S.steamAt < STEAM_CD) { A.toast(`Баня остывает · ещё ${fmtLeft(STEAM_CD - (Date.now() - S.steamAt))}`); return; }
      S.steamAt = Date.now(); S.steamUntil = Date.now() + STEAM_LEN;
      A.toast('🧖 С лёгким паром! 30 минут продаёшь на 20% дороже');
      sfx.level();
    } else if (id === 'dog') { sfx.woof(); A.toast('Бублик виляет хвостом 🐕'); }
    else if (id === 'well') { waterAll(); return; }
    else if (id === 'greenhouse') A.toast('Теплица: грядки справа растут в 1.5 раза быстрее');
    save();
    render();
  }

  /* ================= заказы соседей ================= */
  function newOrder() {
    const pool = [...CROPS.filter((c) => c.lvl <= S.lvl && !c.seedItem).map((c) => c.id), ...(S.b.coop ? ['egg'] : []), ...(S.b.hive ? ['honey'] : []), ...new Set(S.orch.filter((o) => o.tr).map((o) => o.tr))];
    const kinds = Math.min(pool.length, 1 + Math.floor(rnd() * 3)), want = {};
    while (Object.keys(want).length < kinds) {
      const id = pool[Math.floor(rnd() * pool.length)];
      want[id] = Math.max(1, Math.round((2 + rnd() * 6) * Math.min(1, 300 / basePrice(id) + 0.25)));
    }
    const value = Object.entries(want).reduce((s, [id, n]) => s + basePrice(id) * n, 0);
    const who = NEIGHBORS[Math.floor(rnd() * NEIGHBORS.length)];
    return { id: Date.now() + '' + Math.floor(rnd() * 1e6), who: who.name, color: who.color, want, reward: Math.round(value * 1.45), xp: Math.max(2, Math.round(value / 40)) };
  }
  function ordersTick() {
    // в начале — сразу три заказа, дальше новый раз в 5 минут
    if (!S.orders.length && !S.orderNext) { S.orders = [newOrder(), newOrder(), newOrder()]; S.orderNext = 1; save(); return; }
    if (S.orders.length < 3 && Date.now() >= S.orderNext) {
      S.orders.push(newOrder());
      S.orderNext = Date.now() + 5 * MIN;
      save();
    }
  }
  function fulfil(oid) {
    const o = S.orders.find((x) => x.id === oid);
    if (!o || !Object.entries(o.want).every(([id, n]) => (S.inv[id] || 0) >= n)) return;
    Object.entries(o.want).forEach(([id, n]) => { S.inv[id] -= n; });
    S.rub += o.reward; S.stats.earned += o.reward;
    addXp(o.xp);
    S.orders = S.orders.filter((x) => x.id !== oid);
    S.orderNext = Date.now() + 5 * MIN;
    sfx.coin();
    A.toast(`📦 ${o.who}: «Спасибо, милок!» +${rub(o.reward)}`);
    save(); render();
  }
  function skipOrder(oid) {
    S.orders = S.orders.filter((x) => x.id !== oid);
    S.orderNext = Date.now() + 10 * MIN;
    save(); render();
  }

  /* ================= рынок ================= */
  function sell(id, n) {
    n = Math.min(n, S.inv[id] || 0);
    if (!n) return;
    const sum = sellPrice(id) * n;
    S.inv[id] -= n; S.rub += sum; S.stats.earned += sum;
    sfx.coin();
    save(); render();
  }
  function sellAll() {
    let sum = 0;
    Object.keys(S.inv).forEach((id) => { const n = S.inv[id] || 0; if (n) { sum += sellPrice(id) * n; S.inv[id] = 0; } });
    if (!sum) { A.toast('Амбар пуст'); return; }
    S.rub += sum; S.stats.earned += sum;
    sfx.coin();
    A.toast(`💰 Продано на ${rub(sum)}`);
    save(); render();
  }

  /* ================= отрисовка ================= */
  let tab = 'seeds', visit = null;
  root.innerHTML = `
    <div class="dc-main">
      <div class="dc-hud">
        <div class="dc-money"><span>Кошелёк</span><b id="dc-rub"></b></div>
        <div class="dc-lvl"><div class="dc-lvl-top"><b id="dc-lvl"></b><small id="dc-xp"></small></div><div class="dc-xpbar"><i id="dc-xpbar"></i></div></div>
        <div class="dc-buffs" id="dc-buffs"></div>
        <div class="dc-acts">
          <button class="dc-btn" id="dc-harvest">🧺 Собрать всё</button>
          <button class="dc-btn" id="dc-water">💧 Полить всё</button>
          <button class="dc-btn dc-btn-main" id="dc-plant"></button>
        </div>
      </div>
      <div class="dc-scene" id="dc-scene">
        <div class="dc-sky"><div class="dc-stars"></div><div class="dc-sunwrap" id="dc-sun"></div>
          <div class="dc-cl c1">${ART.cloud()}</div><div class="dc-cl c2">${ART.cloud()}</div><div class="dc-cl c3">${ART.cloud()}</div></div>
        <div class="dc-hills"></div>
        <div class="dc-house" id="dc-house">${ART.building('house')}</div>
        <div class="dc-decos" id="dc-decos"></div>
        <div class="dc-visit" id="dc-visit" hidden></div>
        <div class="dc-views" id="dc-views"><button data-view="garden">🥕 Огород</button><button data-view="orchard">🌳 Сад</button></div>
        <div class="dc-field"><div class="dc-beds" id="dc-beds"></div><div class="dc-ghbox" id="dc-gh"></div><div class="dc-orch" id="dc-orch"></div></div>
        <div class="dc-yard" id="dc-yard"></div>
        <div class="dc-fx" id="dc-fx"></div>
      </div>
    </div>
    <aside class="dc-side">
      <div class="dc-tabs" id="dc-tabs">
      </div>
      <div class="dc-panel" id="dc-panel"></div>
    </aside>`;

  function timeOfDay() {
    const h = new Date().getHours();
    return h >= 6 && h < 18 ? 'day' : h >= 18 && h < 22 ? 'eve' : 'night';
  }

  function bedHTML(b, key, gh, readonly) {
    const st = b.st != null ? b.st : stage(b, gh);
    const cls = ['dc-bed', st === -1 ? 'empty' : '', st === 3 ? 'ripe' : '', b.w ? 'wet' : '', b.weed ? 'weedy' : ''].join(' ');
    let inner = st >= 0 ? ART.plant(b.c, st) : '';
    if (b.weed) inner += ART.weed();
    if (!readonly) inner += H.bedExtra.map((f) => f(b, gh) || '').join('');
    let tip = '';
    if (!readonly) {
      if (st === -1) tip = b.weed ? 'Выдернуть сорняк' : `Посадить: ${crop(S.seed).name} · ${crop(S.seed).seed} ₽`;
      else if (st === 3) tip = `Собрать: ${crop(b.c).name} × ${yieldOf(b)}`;
      else tip = `${crop(b.c).name} · ${fmtLeft(leftMs(b, gh))}${b.w ? '' : ' · полей!'}`;
    } else tip = st === 3 ? `${crop(b.c).name} — созрело` : st >= 0 ? crop(b.c).name : 'Пусто';
    const prog = st >= 0 && st < 3 && b.t ? Math.min(100, ((Date.now() - b.t) / growMs(b, gh)) * 100) : 0;
    return `<button class="${cls}" data-k="${key}" title="${esc(tip)}">
      <span class="dc-soil"></span>${inner}
      ${prog ? `<span class="dc-prog"><i style="width:${prog.toFixed(1)}%"></i></span>` : ''}
      ${!readonly && st >= 0 && st < 3 ? `<span class="dc-left">${fmtLeft(leftMs(b, gh))}</span>` : ''}
      ${!readonly && st >= 0 && st < 3 && !b.w ? '<span class="dc-thirst">💧</span>' : ''}
    </button>`;
  }

  // меняем только изменившиеся элементы, чтобы анимации не дёргались
  function patch(box, parts) {
    const kids = [...box.children];
    parts.forEach((h, i) => {
      if (kids[i] && kids[i]._h === h) return;
      const t = document.createElement('template');
      t.innerHTML = h.trim();
      const el = t.content.firstElementChild;
      el._h = h;
      if (kids[i]) box.replaceChild(el, kids[i]); else box.appendChild(el);
    });
    for (let i = parts.length; i < kids.length; i++) kids[i].remove();
  }
  const setHTML = (el, h) => { if (el._h !== h) { el._h = h; el.innerHTML = h; } };

  function renderScene() {
    const F = visit || S;
    const scene = $('#dc-scene');
    scene.dataset.time = timeOfDay();
    scene.classList.toggle('visiting', !!visit);
    setHTML($('#dc-sun'), timeOfDay() === 'night' ? ART.moon() : ART.sun());
    const beds = visit ? visit.beds : S.beds;
    const total = beds.length + (!visit && LAND[S.land + 1] ? 1 : 0);
    const cols = total <= 6 ? 3 : total <= 9 ? 3 : total <= 12 ? 4 : total <= 15 ? 5 : total <= 18 ? 6 : 7;
    const box = $('#dc-beds');
    box.style.setProperty('--cols', cols);
    const parts = beds.map((b, i) => bedHTML(b, `b:${i}`, false, !!visit));
    const next = LAND[S.land + 1];
    if (!visit && next) {
      parts.push(`<button class="dc-bed dc-land" data-land="1" ${S.lvl < next.lvl ? 'disabled' : ''}>
        <b>＋</b><span>${S.lvl < next.lvl ? `с ${next.lvl} ур.` : rub(next.price)}</span><small>${next.n - LAND[S.land].n} грядки</small></button>`);
    }
    patch(box, parts);
    const orchard = !visit && S.view === 'orchard';
    scene.classList.toggle('orchard', orchard);
    $$('#dc-views button').forEach((b) => b.classList.toggle('on', b.dataset.view === (orchard ? 'orchard' : 'garden')));
    $('#dc-views').hidden = !!visit;
    if (orchard) {
      const nx = ORCH[S.orchSlots];
      patch($('#dc-orch'), [...S.orch.map((o, i) => {
        const st = treeStage(o), d = o.tr && treeDef(o.tr);
        const tip = st === -1 ? `Посадить: ${treeDef(S.sapling).name} · ${rub(treeDef(S.sapling).price)}` : st === 3 ? `Собрать: ${GOODS[d.id].name} × ${d.n}` : `${d.name} · ${fmtLeft(treeLeft(o))}`;
        return `<button class="dc-treeslot ${st === 3 ? 'ripe' : ''} ${st === -1 ? 'empty' : ''}" data-tree="${i}" title="${esc(tip)}">
          <span class="dc-mound"></span>${st >= 0 ? ART.tree(o.tr, st) : '<b>＋</b><small>саженец</small>'}
          ${st >= 0 && st < 3 ? `<span class="dc-left">${fmtLeft(treeLeft(o))}</span>` : ''}${d ? `<span class="dc-treename">${esc(d.name)}</span>` : ''}</button>`;
      }), ...(nx ? [`<button class="dc-treeslot dc-land" data-orchslot="1" ${S.lvl < nx.lvl ? 'disabled' : ''}><b>＋</b><span>${S.lvl < nx.lvl ? `с ${nx.lvl} ур.` : rub(nx.price)}</span><small>место в саду</small></button>`] : [])]);
    }
    if (orchard) {
      // деревья под высоту сцены
      const o = $('#dc-orch'), field = $('.dc-field'), cs = getComputedStyle(field);
      const n = o.children.length, cols2 = n <= 5 ? Math.max(3, n) : Math.ceil(n / 2), rows = Math.ceil(n / cols2);
      const h = field.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      o.style.gridTemplateColumns = `repeat(${cols2}, minmax(0, 1fr))`;
      o.style.setProperty('--th', `${Math.max(70, Math.min(160, (h - 10 * (rows - 1)) / rows))}px`);
    } else fitBeds(beds.length + (!visit && next ? 1 : 0), cols);
    const gh = visit ? visit.gh || [] : S.gh;
    const ghBox = $('#dc-gh');
    ghBox.hidden = !(visit ? visit.b.greenhouse : S.b.greenhouse);
    patch(ghBox, [`<div class="dc-gh-roof">${ART.building('greenhouse')}</div>`, ...gh.map((b, i) => bedHTML(b, `g:${i}`, true, !!visit))]);
    // двор
    const yb = visit ? visit.b : S.b;
    patch($('#dc-yard'), BUILD.filter((d) => d.id !== 'greenhouse').map((d) => {
      const own = !!yb[d.id];
      let badge = '';
      if (!visit && own && d.id === 'coop' && eggsReady()) badge = `<span class="dc-badge">${eggsReady()}</span>`;
      if (!visit && own && d.id === 'hive' && honeyReady()) badge = `<span class="dc-badge">${honeyReady()}</span>`;
      if (!visit && own && d.id === 'banya' && Date.now() - S.steamAt >= STEAM_CD) badge = '<span class="dc-badge hot">♨</span>';
      const hens = d.id === 'coop' && own ? Array.from({ length: Math.min(4, visit ? 2 : S.hens) }, (_, i) => ART.B.hen(22 + i * 22)).join('') : '';
      const lock = own ? '' : visit ? '<span class="dc-tag">нет</span>' : `<span class="dc-tag">${S.lvl < d.lvl ? `🔒 ${d.lvl} ур.` : rub(d.price)}</span>`;
      return `<button class="dc-bld-tile ${own ? 'own' : 'locked'} b-${d.id}" data-b="${d.id}" title="${esc(d.name + ' — ' + d.desc)}">${ART.building(d.id, hens)}${badge}${lock}<span class="dc-bname">${esc(d.name)}</span></button>`;
    }));
    patch($('#dc-decos'), (visit ? visit.deco || [] : S.deco).map((id, i) => `<span class="dc-deco d-${id}" style="--i:${i}" title="${esc((DECO.find((d) => d.id === id) || {}).name || '')}">${ART.deco(id)}</span>`));
    $('#dc-house').classList.toggle('lit', timeOfDay() !== 'day');
    const v = $('#dc-visit');
    v.hidden = !visit;
    if (visit) setHTML(v, `<span>🏡 В гостях у <b>${esc(visit.nick)}</b> · ур. ${visit.lvl}${visit.b.dog ? ' · 🐕 тут Бублик' : ''}${(visit.guards || []).map((g) => ` · ${esc(shopDef(g).name.toLowerCase())}`).join('')}</span><small>Созревшее можно стащить, растущее — полить</small><button class="dc-btn" id="dc-home">Домой</button>`);
  }

  // грядки подстраиваются под высоту сцены
  function fitBeds(n, cols) {
    const field = $('.dc-field'), box = $('#dc-beds'), gh = $('#dc-gh');
    const cs = getComputedStyle(field);
    const h = field.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const rows = Math.ceil(n / cols), gap = 12;
    const wAvail = field.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - (gh.hidden ? 0 : gh.offsetWidth + 18);
    const size = Math.max(36, Math.min(112, (h - gap * (rows - 1)) / rows, (wAvail - gap * (cols - 1)) / cols));
    box.style.width = `${cols * size + gap * (cols - 1)}px`;
    const ghSize = Math.max(36, Math.min(size, (h - 46 - 20) / 3));
    gh.style.width = `${ghSize + 20}px`;
  }

  function renderHud() {
    $('#dc-rub').textContent = rub(S.rub);
    $('#dc-lvl').textContent = `Уровень ${S.lvl}`;
    $('#dc-xp').textContent = `${S.xp} / ${need(S.lvl)}`;
    $('#dc-xpbar').style.width = Math.min(100, (S.xp / need(S.lvl)) * 100) + '%';
    const c = crop(S.seed);
    setHTML($('#dc-plant'), `${ART.item(c.id)}<span>Посадить везде</span>`);
    const buffs = [];
    if (steaming()) buffs.push(`<span class="dc-buff">🧖 +20% к ценам · ${fmtLeft(S.steamUntil - Date.now())}</span>`);
    if (cozy()) buffs.push(`<span class="dc-buff">🌸 уют +${cozy()}%</span>`);
    guardsActive().forEach((id) => buffs.push(`<span class="dc-buff guard" title="${esc(shopDef(id).desc)}">${ART.item(id)}${esc(shopDef(id).name)} · ${fmtLeft(S.guards[id] - Date.now())}</span>`));
    if (S.b.dog || guardsActive().length) buffs.push(`<span class="dc-buff shield">🛡 защита ${Math.round(protection() * 100)}%${guardOn('trap') ? ' + капкан' : ''}</span>`);
    if (S.arm) buffs.push(`<button class="dc-buff armed" data-disarm="1">${ART.item(S.arm)}${esc(shopDef(S.arm).name)} × ${S.tools[S.arm] || 0} — жми на ${S.arm === 'treefert' ? 'дерево' : 'грядку'} · ✕</button>`);
    H.buffs.forEach((f) => buffs.push(...(f() || [])));
    setHTML($('#dc-buffs'), buffs.join(''));
  }

  /* ================= боковая панель ================= */
  const trend = (id) => { const m = dayMult(id) * (id === hotItem() ? 1.5 : 1); return m >= 1.12 ? '<i class="up">▲</i>' : m <= 0.9 ? '<i class="down">▼</i>' : ''; };
  const CORE_TABS = [['seeds', 'Семена'], ['barn', 'Амбар'], ['orders', 'Заказы'], ['shop', 'Сельпо'], ['deco', 'Уют'], ['friends', 'Соседи']];
  function renderTabs() {
    const all = [...CORE_TABS, ...H.tabs.map((x) => [x.id, x.label])];
    setHTML($('#dc-tabs'), all.map(([id, l]) => `<button data-t="${id}">${l}</button>`).join(''));
    $$('#dc-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
  }
  function renderPanel() {
    renderTabs();
    const P = $('#dc-panel');
    const ext = H.tabs.find((x) => x.id === tab);
    if (ext) { ext.render(P); return; }
    if (tab === 'seeds' && S.view === 'orchard' && !visit) {
      P.innerHTML = `<div class="dc-note">Саженцы сажаются один раз и плодоносят всегда. Выбери и жми на пустое место в саду.</div>
        <div class="dc-seeds">${TREES.map((d) => {
          const lock = d.lvl > S.lvl;
          return `<button class="dc-seed ${S.sapling === d.id ? 'on' : ''} ${lock ? 'lock' : ''}" data-sapling="${d.id}" ${lock ? 'disabled' : ''}>
            ${ART.item(d.id)}<b>${d.name}</b><small>${lock ? `🔒 ${d.lvl} уровень` : `${rub(d.price)} · растёт ${fmtLeft(d.grow * MIN)}`}</small>
            ${lock ? '' : `<em>${d.n} шт. раз в ${fmtLeft(d.every * MIN)}</em>`}</button>`;
        }).join('')}</div>`;
    } else if (tab === 'shop') {
      const st = stock(), left = (stockWin() + 1) * STOCK_T - Date.now();
      P.innerHTML = `<div class="dc-note">Завоз раз в 2 часа, у всех кентов одинаковый. Следующий через <b>${fmtLeft(left)}</b>.</div>
        <div class="dc-shop">${st.map((it) => {
          const x = shopDef(it.id), n = it.qty === Infinity ? Infinity : stockLeft(it.id, it.qty), lock = x.lvl && S.lvl < x.lvl;
          const have = x.kind === 'tool' ? S.tools[x.id] || 0 : 0, on = x.kind === 'guard' && guardOn(x.id);
          return `<div class="dc-shop-row ${x.kind}">${ART.item(x.id)}<div><b>${esc(x.name)}</b><small>${esc(x.desc)}</small>
            <i>${n === Infinity ? 'всегда в наличии' : n > 0 ? `осталось ${n}` : 'разобрали'}${have ? ` · у тебя ${have}` : ''}${on ? ` · работает ${fmtLeft(S.guards[x.id] - Date.now())}` : ''}</i></div>
            <span class="dc-shop-btns">${have && x.id !== 'goldseed' ? `<button class="dc-mini" data-arm="${x.id}">Взять</button>` : ''}
            <button class="dc-mini dark" data-buy="${x.id}" ${n <= 0 || lock ? 'disabled' : ''}>${lock ? `🔒 ${x.lvl} ур.` : rub(x.price)}</button></span></div>`;
        }).join('')}</div>`;
    } else if (tab === 'seeds') {
      P.innerHTML = `<div class="dc-note">Выбери семена и жми на пустую грядку. Политые дают +1 к урожаю.</div>
        <div class="dc-seeds">${CROPS.map((c) => {
          const lock = c.lvl > S.lvl;
          const perH = Math.round(((c.price * 2 - c.seed) / c.grow) * 60), gs = c.seedItem ? S.tools[c.seedItem] || 0 : 0;
          return `<button class="dc-seed ${S.seed === c.id ? 'on' : ''} ${lock ? 'lock' : ''}" data-seed="${c.id}" ${lock ? 'disabled' : ''}>
            ${ART.item(c.id)}<b>${c.name}</b><small>${lock ? `🔒 ${c.lvl} уровень` : c.seedItem ? `${fmtLeft(c.grow * MIN)} · семян: ${gs}` : `${fmtLeft(c.grow * MIN)} · ${c.seed} ₽`}</small>
            ${lock ? '' : `<em>+${rub(c.price * 2 - c.seed)} · ≈ ${perH.toLocaleString('ru-RU')} ₽/ч</em>`}</button>`;
        }).join('')}</div>`;
    } else if (tab === 'barn') {
      const items = Object.entries(S.inv).filter(([, n]) => n > 0);
      P.innerHTML = `<div class="dc-note">Цены на рынке меняются каждый день. Сегодня в спросе: <b>${itemName(hotItem())}</b> — ×1.5</div>
        ${items.length ? `<div class="dc-barn">${items.map(([id, n]) => `<div class="dc-barn-row">
          ${ART.item(id)}<div><b>${itemName(id)} <span>× ${n}</span></b><small>${rub(sellPrice(id))} за шт. ${trend(id)}</small></div>
          <button class="dc-mini" data-sell="${id}" data-n="1">1</button><button class="dc-mini dark" data-sell="${id}" data-n="999999">Все · ${rub(sellPrice(id) * n)}</button></div>`).join('')}</div>
          <button class="dc-btn dc-btn-main wide" id="dc-sellall">Продать всё</button>` : '<div class="dc-empty">Амбар пуст — собери урожай 🧺</div>'}`;
    } else if (tab === 'orders') {
      P.innerHTML = `<div class="dc-note">Соседи платят в 1.5 раза больше рынка и дают опыт.</div>${S.orders.map((o) => {
        const ok = Object.entries(o.want).every(([id, n]) => (S.inv[id] || 0) >= n);
        return `<div class="dc-order"><div class="dc-order-top"><i style="background:${o.color}">${esc(o.who[0])}</i><b>${esc(o.who)}</b><button class="dc-x" data-skip="${o.id}" title="Отказаться">✕</button></div>
          <div class="dc-want">${Object.entries(o.want).map(([id, n]) => `<span class="${(S.inv[id] || 0) >= n ? 'have' : ''}">${ART.item(id)}<small>${Math.min(S.inv[id] || 0, n)}/${n}</small></span>`).join('')}</div>
          <button class="dc-btn ${ok ? 'dc-btn-main' : ''} wide" data-ord="${o.id}" ${ok ? '' : 'disabled'}>Отдать · ${rub(o.reward)} · +${o.xp} опыта</button></div>`;
      }).join('')}${S.orders.length < 3 ? `<div class="dc-empty">Новый заказ через ${fmtLeft(Math.max(0, S.orderNext - Date.now()))}</div>` : ''}`;
    } else if (tab === 'deco') {
      P.innerHTML = `<div class="dc-note">Уют поднимает цены продажи. Сейчас: <b>+${cozy()}%</b></div><div class="dc-decolist">${DECO.map((d) => {
        const own = S.deco.includes(d.id);
        return `<button class="dc-decocard ${own ? 'own' : ''}" data-deco="${d.id}" ${own ? 'disabled' : ''}>${ART.deco(d.id)}<b>${d.name}</b><small>+${d.cozy}% уюта</small><em>${own ? 'Стоит во дворе' : rub(d.price)}</em></button>`;
      }).join('')}</div>${S.b.coop && S.hens < COOP_MAX ? `<button class="dc-btn wide" id="dc-hen">🐔 Докупить курицу · ${rub(COOP_HEN(S.hens))}</button>` : ''}`;
    } else if (tab === 'friends') {
      const list = net.hall.filter((h) => h.id !== A.pid);
      P.innerHTML = `<div class="dc-note">Кенты с открытой дачей. Заходи в гости: спелое можно стащить (если нет Бублика), растущее — полить.</div>
        ${!sb ? '<div class="dc-empty">Онлайн недоступен</div>' : list.length ? list.map((h) => `<div class="dc-friend"><i>${esc(String(h.nick || '?')[0])}</i><div><b>${esc(h.nick)}</b><small>ур. ${h.lvl || 1}${h.dog ? ' · 🐕' : ''}</small></div><button class="dc-btn" data-visit="${esc(h.id)}">В гости</button></div>`).join('') : '<div class="dc-empty">Пока никого — позови кентов на дачу 🏡</div>'}
        <div class="dc-stats"><div><b>${S.stats.harvest}</b><span>собрано</span></div><div><b>${rub(S.stats.earned)}</b><span>заработано</span></div><div><b>${S.stats.stolen}</b><span>стащено</span></div><div><b>${S.stats.caught}</b><span>Бублик поймал</span></div></div>`;
    }
  }

  function render() {
    if (!root.closest('.page.active')) return;
    renderHud();
    renderScene();
    H.scene.forEach((f) => f($('#dc-scene')));
    renderPanel();
  }

  /* ================= эффекты ================= */
  function floatAt(el, text, id) {
    if (!el) return;
    const s = $('#dc-scene').getBoundingClientRect(), r = el.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'dc-float';
    f.innerHTML = `${id ? ART.item(id) : ''}<b>${text}</b>`;
    f.style.left = r.left - s.left + r.width / 2 + 'px';
    f.style.top = r.top - s.top + 10 + 'px';
    $('#dc-fx').appendChild(f);
    setTimeout(() => f.remove(), 1200);
  }
  function celebrate() {
    const fx = $('#dc-fx');
    if (!fx) return;
    const colors = ['#8fd06a', '#ffd95e', '#ec6a8c', '#7cc6e8', '#f39233'];
    for (let i = 0; i < 26; i++) {
      const p = document.createElement('i');
      p.className = 'dc-petal';
      p.style.left = 20 + rnd() * 60 + '%';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--dx', (rnd() * 160 - 80).toFixed(0) + 'px');
      p.style.animationDelay = (rnd() * 0.3).toFixed(2) + 's';
      fx.appendChild(p);
      setTimeout(() => p.remove(), 1800);
    }
  }

  /* ================= события ================= */
  root.addEventListener('click', (e) => {
    const t = e.target;
    if (H.click.some((f) => f(t, e))) return;
    const bed = t.closest('.dc-bed[data-k]');
    if (bed) return onBed(bed.dataset.k, bed);
    if (t.closest('[data-land]')) {
      const next = LAND[S.land + 1];
      if (next && S.lvl >= next.lvl && pay(next.price)) { S.land++; fixBeds(); sfx.coin(); celebrate(); save(); render(); }
      return;
    }
    const bld = t.closest('[data-b]');
    if (bld) return onBuilding(bld.dataset.b, bld);
    const tb = t.closest('#dc-tabs [data-t]');
    if (tb) { tab = tb.dataset.t; renderPanel(); return; }
    const ts = t.closest('[data-tree]');
    if (ts) return onTree(+ts.dataset.tree, ts);
    if (t.closest('[data-orchslot]')) return buyOrchSlot();
    const vw = t.closest('[data-view]');
    if (vw) { S.view = vw.dataset.view; save(); render(); return; }
    const sp = t.closest('[data-sapling]');
    if (sp) { S.sapling = sp.dataset.sapling; save(); render(); return; }
    const bu = t.closest('[data-buy]');
    if (bu) return buyShop(bu.dataset.buy);
    const ar = t.closest('[data-arm]');
    if (ar) { S.arm = ar.dataset.arm; if (S.arm === 'treefert') S.view = 'orchard'; else S.view = 'garden'; A.toast(`${shopDef(S.arm).name}: жми на ${S.arm === 'treefert' ? 'дерево' : 'растущую грядку'}`); save(); render(); return; }
    if (t.closest('[data-disarm]')) { S.arm = null; save(); render(); return; }
    const sd = t.closest('[data-seed]');
    if (sd) { S.seed = sd.dataset.seed; save(); renderHud(); renderPanel(); renderScene(); return; }
    const sl = t.closest('[data-sell]');
    if (sl) return sell(sl.dataset.sell, +sl.dataset.n);
    if (t.closest('#dc-sellall')) return sellAll();
    const od = t.closest('[data-ord]');
    if (od) return fulfil(od.dataset.ord);
    const sk = t.closest('[data-skip]');
    if (sk) return skipOrder(sk.dataset.skip);
    const dc = t.closest('[data-deco]');
    if (dc) {
      const d = DECO.find((x) => x.id === dc.dataset.deco);
      if (d && !S.deco.includes(d.id) && pay(d.price)) { S.deco.push(d.id); sfx.coin(); celebrate(); A.toast(`🌸 ${d.name} во дворе`); save(); render(); }
      return;
    }
    if (t.closest('#dc-hen')) { if (S.hens < COOP_MAX && pay(COOP_HEN(S.hens))) { S.hens++; sfx.coin(); save(); render(); } return; }
    if (t.closest('#dc-harvest')) return harvestAll();
    if (t.closest('#dc-water')) return waterAll();
    if (t.closest('#dc-plant')) return plantAll();
    const vs = t.closest('[data-visit]');
    if (vs) return startVisit(vs.dataset.visit);
    if (t.closest('#dc-home')) { visit = null; render(); }
  });

  /* ================= соседи онлайн ================= */
  // Хозяин дачи сам решает, что можно стащить: все изменения его участка проходят через его клиент
  const sb = window.supabase && window.QB_ONLINE
    ? window.supabase.createClient(window.QB_ONLINE.url, window.QB_ONLINE.key, { auth: { persistSession: false } })
    : null;
  const net = { ch: null, live: false, hall: [] };
  const STEAL_CD = 20 * MIN;
  const send = (event, payload) => net.ch && net.live && net.ch.send({ type: 'broadcast', event, payload: { ...payload, from: A.pid } });
  const snapshot = () => ({
    nick: A.nick(), lvl: S.lvl, b: { ...S.b }, deco: S.deco.slice(0, 8), guards: guardsActive().filter((g) => g !== 'trap'),
    beds: S.beds.map((b) => ({ c: b.c, st: stage(b, false), w: b.w, weed: b.weed })),
    gh: S.gh.map((b) => ({ c: b.c, st: stage(b, true), w: b.w, weed: b.weed })),
  });
  function track() {
    if (net.ch && net.live) net.ch.track({ id: A.pid, nick: A.nick(), lvl: S.lvl, dog: !!S.b.dog });
  }
  function startVisit(id) {
    send('peek', { to: id });
    A.toast('Стучимся в калитку…');
  }
  function onVisitBed(key, el) {
    const [k, i] = key.split(':');
    const b = (k === 'g' ? visit.gh : visit.beds)[+i];
    if (!b) return;
    if (b.st === 3) send('steal', { to: visit.id, k, i: +i });
    else if (b.st >= 0 && !b.w) send('help', { to: visit.id, k, i: +i });
    else A.toast(b.st >= 0 ? 'Уже полито' : 'Пустая грядка');
  }
  function join() {
    if (!sb) return;
    net.ch = sb.channel('qb-dacha-hall', { config: { broadcast: { self: false }, presence: { key: A.pid } } });
    net.ch.on('presence', { event: 'sync' }, () => {
      net.hall = Object.values(net.ch.presenceState()).map((a) => a[0]).filter((h) => h && h.id);
      if (tab === 'friends') render();
    });
    // ко мне постучались — показываю участок
    net.ch.on('broadcast', { event: 'peek' }, ({ payload }) => { if (payload.to === A.pid) send('farm', { to: payload.from, farm: snapshot() }); });
    net.ch.on('broadcast', { event: 'farm' }, ({ payload }) => {
      if (payload.to !== A.pid || !payload.farm) return;
      const f = payload.farm;
      if (!Array.isArray(f.beds)) return;
      visit = { id: payload.from, nick: String(f.nick || 'Кент').slice(0, 20), lvl: +f.lvl || 1, b: f.b || {}, deco: (f.deco || []).filter((d) => DECO.some((x) => x.id === d)),
        guards: (Array.isArray(f.guards) ? f.guards : []).filter((g) => shopDef(g)),
        beds: f.beds.slice(0, 20).map(cleanBed), gh: (f.gh || []).slice(0, 3).map(cleanBed) };
      render();
    });
    // кто-то тащит с моей грядки
    net.ch.on('broadcast', { event: 'steal' }, ({ payload }) => {
      if (payload.to !== A.pid) return;
      const b = (payload.k === 'g' ? S.gh : S.beds)[payload.i];
      const who = nickOf(payload.from);
      const reply = (r) => send('steal-res', { to: payload.from, ...r, farm: snapshot() });
      if (!b || stage(b, payload.k === 'g') !== 3 || (b.s || 0) >= 1) return reply({ ok: false, why: 'Тут уже нечего брать' });
      if (Date.now() - (S.steals[payload.from] || 0) < STEAL_CD) return reply({ ok: false, why: 'Хозяин тебя уже запомнил — приходи позже' });
      S.steals[payload.from] = Date.now();
      // капкан ловит наверняка, остальное — по шансу
      let by = null;
      if (guardOn('trap')) { by = 'trap'; delete S.guards.trap; }
      else if (rnd() < protection()) {
        const act = guardsActive().filter((id) => id !== 'trap').sort((a, b) => shopDef(b).p - shopDef(a).p);
        by = act.length && (!S.b.dog || rnd() < 0.6) ? act[0] : S.b.dog ? 'dog' : act[0];
      }
      if (by) {
        S.stats.caught++;
        sfx.woof();
        A.toast(`🛡 ${who} ${CAUGHT_BY[by]}! Штраф твой`);
        save(); render(); track();
        return reply({ ok: false, caught: true, by });
      }
      b.s = (b.s || 0) + 1;
      A.toast(`😤 ${who} стащил у тебя ${crop(b.c).name.toLowerCase()}!`);
      if (A.note) A.note('dacha', '😤 С твоей дачи что-то стащили', `${who}: ${crop(b.c).name}`);
      save(); render();
      reply({ ok: true, item: b.c });
    });
    net.ch.on('broadcast', { event: 'steal-res' }, ({ payload }) => {
      if (payload.to !== A.pid) return;
      if (payload.ok && crop(payload.item)) {
        addItem(payload.item, 1); S.stats.stolen++; addXp(2); sfx.pop();
        A.toast(`🤫 Стащил: ${crop(payload.item).name}`);
      } else if (payload.caught) {
        const fine = Math.min(S.rub, 300 + S.lvl * 150);
        S.rub -= fine; sfx.woof();
        const how = { trap: 'Попал в капкан!', guard: 'Дядя Вася поймал тебя!', watch: 'Залип на дорогие часы и попался!', alarm: 'Сработала сигнализация!', camera: 'Тебя сняла камера!', scarecrow: 'Испугался пугала!', dog: 'Бублик укусил за штанину!' }[payload.by] || 'Поймали!';
        A.toast(`🚨 ${how} Штраф ${rub(fine)}`);
      } else A.toast(payload.why || 'Не вышло');
      if (visit && payload.farm) visit.beds = payload.farm.beds.slice(0, 20).map(cleanBed), visit.gh = (payload.farm.gh || []).slice(0, 3).map(cleanBed);
      save(); render();
    });
    // кент полил мою грядку
    net.ch.on('broadcast', { event: 'help' }, ({ payload }) => {
      if (payload.to !== A.pid) return;
      const b = (payload.k === 'g' ? S.gh : S.beds)[payload.i];
      const ok = b && b.c && stage(b, payload.k === 'g') < 3 && !b.w;
      if (ok) { b.w = true; A.toast(`💧 ${nickOf(payload.from)} полил твою грядку`); save(); render(); }
      send('help-res', { to: payload.from, ok, farm: snapshot() });
    });
    net.ch.on('broadcast', { event: 'help-res' }, ({ payload }) => {
      if (payload.to !== A.pid) return;
      if (payload.ok) { addXp(2); sfx.water(); A.toast('💧 Полил — сосед будет рад (+2 опыта)'); }
      if (visit && payload.farm) visit.beds = payload.farm.beds.slice(0, 20).map(cleanBed), visit.gh = (payload.farm.gh || []).slice(0, 3).map(cleanBed);
      save(); render();
    });
    net.ch.subscribe((st) => { net.live = st === 'SUBSCRIBED'; if (net.live) track(); });
  }
  const cleanBed = (b) => ({ c: crop(b && b.c) ? b.c : null, st: crop(b && b.c) ? Math.max(0, Math.min(3, +b.st || 0)) : -1, w: !!(b && b.w), weed: !!(b && b.weed) });
  const nickOf = (id) => String((net.hall.find((h) => h.id === id) || {}).nick || 'Кент').slice(0, 20);

  /* ================= такт ================= */
  let lastRipe = -1, lastLvl = S.lvl;
  function tick() {
    H.tick.forEach((f) => f());
    weedTick();
    ordersTick();
    if (S.lvl !== lastLvl) { lastLvl = S.lvl; track(); }
    // уведомление, когда всё созрело
    const ripe = allBeds().filter(([b, gh]) => stage(b, gh) === 3).length;
    if (ripe > 0 && lastRipe === 0 && A.note) A.note('dacha', '🧺 На даче созрел урожай', `Готово грядок: ${ripe}`);
    lastRipe = ripe;
    if (!root.closest('.page.active')) return;
    renderHud();
    renderScene();
    H.scene.forEach((f) => f($('#dc-scene')));
    const ext = H.tabs.find((x) => x.id === tab);
    if ((tab === 'orders' && S.orders.length < 3) || (ext && ext.live)) renderPanel();
  }
  window.addEventListener('qb:page', (e) => { if (e.detail === 'dacha') { visit = null; render(); } });
  window.DachaCore = {
    S, H, A, ART, CROPS, GOODS, TREES, MIN, HOUR, crop, itemName, basePrice, sellPrice, stage, allBeds, growMs, leftMs, fmtLeft,
    save, render, renderPanel, addItem, addXp, pay, rub, sfx, floatAt, celebrate, rnd, esc, $, $$,
    get tab() { return tab; }, setTab: (t) => { tab = t; render(); }, get visit() { return visit; },
  };
  setInterval(tick, 1000);
  ordersTick();
  join();
})();
