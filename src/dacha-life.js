// «Дача» — жизнь: прокачка дома, Бублик с уровнями, ярмарка выходного дня, истории соседей
(function () {
  const D = window.DachaCore;
  if (!D) return;
  const { S, H, A, ART, MIN, HOUR, crop, esc, rub, fmtLeft } = D;
  const O = '#5a3d2b';
  const sw = `stroke="${O}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const svg = (vb, body, cls = '') => `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  if (!S.house) S.house = 1;
  if (!S.dog) S.dog = { lvl: 1, xp: 0, walkAt: 0, findAt: Date.now(), caught: S.stats.caught || 0 };
  if (!S.fair) S.fair = { w: '', bought: {} };
  if (!S.story) S.story = { chain: null, step: 0, nextAt: 0, done: [] };
  if (!S.fx) S.fx = {};

  /* ================= дом ================= */
  const win = (x, y, w = 18, h = 16) => `<rect class="win" x="${x}" y="${y}" width="${w}" height="${h}" rx="2.5" fill="#bfe3f2" ${sw}/><path d="M${x + w / 2} ${y}v${h}M${x} ${y + h / 2}h${w}" stroke="${O}" stroke-width="1.6"/>`;
  const HOUSE_ART = {
    2: `<rect x="8" y="50" width="104" height="46" rx="4" fill="#f6e2bf" ${sw}/><path d="M12 62h96M12 74h96M12 86h96" stroke="#e2c99c" stroke-width="2"/>
      <path d="M0 54 40 22h40l40 32z" fill="#c4563f" ${sw}/><rect x="86" y="18" width="10" height="20" fill="#a5664a" ${sw}/>
      ${win(16, 60)}${win(44, 60)}${win(86, 60)}<rect x="62" y="64" width="18" height="32" rx="3" fill="#a5664a" ${sw}/><path d="M40 40h40" stroke="#a5402f" stroke-width="2"/>`,
    3: `<rect x="14" y="30" width="92" height="66" rx="4" fill="#fff3dc" ${sw}/><path d="M14 62h92" stroke="${O}" stroke-width="2"/>
      <path d="M4 34 60 4l56 30z" fill="#5b7fbf" ${sw}/><rect x="84" y="6" width="10" height="18" fill="#9aa1a8" ${sw}/>
      ${win(22, 38)}${win(51, 38)}${win(80, 38)}${win(22, 70)}${win(80, 70)}<rect x="51" y="68" width="18" height="28" rx="3" fill="#7d4a35" ${sw}/>
      <path d="M44 62h32v-4H44z" fill="#c98a52" ${sw}/><path d="M46 58v-6M54 58v-6M62 58v-6M70 58v-6M44 52h32" stroke="${O}" stroke-width="1.6"/>`,
    4: `<rect x="4" y="38" width="112" height="58" rx="3" fill="#fbf4e4" ${sw}/><path d="M0 42 60 10l60 32z" fill="#7d4a35" ${sw}/><circle cx="60" cy="30" r="6" fill="#bfe3f2" ${sw}/>
      ${[18, 38, 82, 102].map((x) => `<rect x="${x - 3}" y="46" width="6" height="50" fill="#fff" ${sw}/>`).join('')}
      ${win(8, 52, 14, 14)}${win(26, 52, 14, 14)}${win(80, 52, 14, 14)}${win(98, 52, 14, 14)}<path d="M48 96V66a12 12 0 0 1 24 0v30z" fill="#7d4a35" ${sw}/>
      <path d="M40 96h40" stroke="${O}" stroke-width="3"/>`,
    5: `<rect x="2" y="44" width="34" height="52" rx="3" fill="#f6ead2" ${sw}/><rect x="84" y="44" width="34" height="52" rx="3" fill="#f6ead2" ${sw}/><rect x="30" y="30" width="60" height="66" rx="3" fill="#fbf4e4" ${sw}/>
      <path d="M0 48 19 30l19 18zM82 48l19-18 19 18z" fill="#3f6f5a" ${sw}/><path d="M24 34 60 4l36 30z" fill="#3f6f5a" ${sw}/><path d="M60 0v-6" stroke="#f2c14e" stroke-width="3"/><circle cx="60" cy="-8" r="3" fill="#f2c14e"/>
      ${win(8, 56, 22, 14)}${win(90, 56, 22, 14)}${win(38, 40, 16, 16)}${win(66, 40, 16, 16)}<path d="M50 96V70a10 10 0 0 1 20 0v26z" fill="#7d4a35" ${sw}/>
      <path d="M2 78h34M84 78h34" stroke="#e2c99c" stroke-width="2"/><g fill="#ec6a8c">${[10, 22, 94, 106].map((x) => `<circle cx="${x}" cy="94" r="3"/>`).join('')}</g>`,
  };
  const HOUSES = [
    null,
    { name: 'Домик', bonus: 0 },
    { name: 'Дом', price: 80000, lvl: 6, bonus: 5 },
    { name: 'Коттедж', price: 600000, lvl: 11, bonus: 12 },
    { name: 'Особняк', price: 3500000, lvl: 16, bonus: 20 },
    { name: 'Усадьба', price: 15000000, lvl: 22, bonus: 30 },
  ];
  H.priceMul.push(() => 1 + (HOUSES[S.house] || {}).bonus / 100 || 1);
  H.scene.push((scene) => {
    const h = scene.querySelector('#dc-house');
    if (!h) return;
    const key = 'house' + S.house;
    if (h._k !== key) {
      h._k = key;
      h.innerHTML = S.house > 1 && HOUSE_ART[S.house] ? svg('0 -10 120 108', HOUSE_ART[S.house], 'dc-bld') : ART.building('house');
    }
    h.dataset.lvl = S.house;
    h.title = `${HOUSES[S.house].name} — нажми, чтобы улучшить`;
  });

  /* ================= Бублик ================= */
  const DOG_NEED = (l) => 60 * l * l;
  const DOG_PERKS = [
    { lvl: 2, name: 'Команда «Сидеть»', note: 'Слушается — уже прогресс' },
    { lvl: 3, name: 'Нюх', note: 'Раз в 3 часа приносит находку' },
    { lvl: 5, name: 'Сторож', note: 'Ловит воров в 80% случаев' },
    { lvl: 7, name: 'Кладоискатель', note: 'Находки ценнее, бывают семена золотой тыквы' },
    { lvl: 10, name: 'Чемпион породы', note: 'Ловит воров в 90% случаев, находки каждые 2 часа' },
  ];
  const dogPower = () => (S.dog.lvl >= 10 ? 0.9 : S.dog.lvl >= 5 ? 0.8 : 0.7);
  const findEvery = () => (S.dog.lvl >= 10 ? 2 : 3) * HOUR;
  function dogXp(n) {
    S.dog.xp += n;
    while (S.dog.lvl < 10 && S.dog.xp >= DOG_NEED(S.dog.lvl)) {
      S.dog.xp -= DOG_NEED(S.dog.lvl);
      S.dog.lvl++;
      const p = DOG_PERKS.find((x) => x.lvl === S.dog.lvl);
      A.toast(`🐕 Бублик вырос до ${S.dog.lvl} уровня!${p ? ` Новый навык: ${p.name}` : ''}`);
      D.sfx.woof(); D.celebrate();
    }
    S.dogPower = dogPower();
  }
  S.dogPower = dogPower();
  function dogFind() {
    const r = D.rnd(), rich = S.dog.lvl >= 7;
    if (rich && r < 0.08) { S.tools.goldseed = (S.tools.goldseed || 0) + 1; return 'семена золотой тыквы'; }
    if (r < 0.35) { const n = 3 + Math.floor(D.rnd() * 4); S.tools.bait = (S.tools.bait || 0) + n; return `${n} червей для рыбалки`; }
    if (r < 0.6) { const n = 1 + Math.floor(D.rnd() * 2); S.tools.fert = (S.tools.fert || 0) + n; return `удобрение × ${n}`; }
    const coins = Math.round((800 + S.lvl * 400) * (rich ? 2.5 : 1) * (0.6 + D.rnd()));
    S.rub += coins;
    return `кошелёк с ${rub(coins)}`;
  }
  function onDog(el) {
    if (!S.b.dog) return false;
    if (S.dog.lvl >= 3 && Date.now() - S.dog.findAt >= findEvery()) {
      S.dog.findAt = Date.now();
      const what = dogFind();
      dogXp(15);
      A.toast(`🦴 Бублик притащил: ${what}`);
      D.floatAt(el, '🦴', null); D.sfx.woof();
    } else if (Date.now() - S.dog.walkAt >= 4 * HOUR) {
      S.dog.walkAt = Date.now();
      dogXp(25);
      A.toast('🐕 Погуляли с Бубликом (+25 опыта псу)');
      D.sfx.woof();
    } else {
      const next = Math.min(4 * HOUR - (Date.now() - S.dog.walkAt), S.dog.lvl >= 3 ? findEvery() - (Date.now() - S.dog.findAt) : Infinity);
      A.toast(`Бублик отдыхает. Загляни через ${fmtLeft(next)}`);
    }
    D.save(); D.render();
    return true;
  }
  H.tick.push(() => {
    // за пойманных воров пёс растёт
    if ((S.stats.caught || 0) > S.dog.caught) { dogXp(50 * (S.stats.caught - S.dog.caught)); S.dog.caught = S.stats.caught; D.save(); }
  });

  /* ================= вкладка «Дом» ================= */
  H.tabs.push({
    id: 'home', label: 'Дом',
    render(P) {
      const cur = HOUSES[S.house], nx = HOUSES[S.house + 1];
      const perkList = DOG_PERKS.map((p) => `<div class="${S.dog.lvl >= p.lvl ? 'on' : ''}"><b>${p.lvl} ур. · ${esc(p.name)}</b><small>${esc(p.note)}</small></div>`).join('');
      P.innerHTML = `
        <div class="dc-homecard"><div class="dc-homeart">${S.house > 1 ? svg('0 -10 120 108', HOUSE_ART[S.house], 'dc-bld') : ART.building('house')}</div>
          <div><b>${cur.name}</b><small>${cur.bonus ? `+${cur.bonus}% ко всем ценам продажи` : 'Скромно, но своё'}</small></div></div>
        ${nx ? `<div class="dc-homecard next"><div class="dc-homeart">${svg('0 -10 120 108', HOUSE_ART[S.house + 1], 'dc-bld')}</div>
          <div><b>Следующий: ${nx.name}</b><small>+${nx.bonus}% ко всем ценам продажи</small>
          <button class="dc-btn ${S.lvl >= nx.lvl ? 'dc-btn-main' : ''}" data-house="1" ${S.lvl >= nx.lvl ? '' : 'disabled'}>${S.lvl >= nx.lvl ? `Построить · ${rub(nx.price)}` : `🔒 с ${nx.lvl} уровня`}</button></div></div>` : '<div class="dc-note">🏰 У тебя лучшая усадьба в посёлке</div>'}
        <span class="dc-cap">БУБЛИК</span>
        ${S.b.dog ? `<div class="dc-dogcard">${ART.building('dog')}<div><b>Бублик · ${S.dog.lvl} уровень</b>
            <span class="dc-medalbar"><em style="width:${S.dog.lvl >= 10 ? 100 : Math.min(100, (S.dog.xp / DOG_NEED(S.dog.lvl)) * 100)}%"></em></span>
            <small>${S.dog.lvl >= 10 ? 'Максимальный уровень' : `${S.dog.xp} / ${DOG_NEED(S.dog.lvl)} опыта`} · ловит воров в ${Math.round(dogPower() * 100)}% случаев</small>
            <small>Опыт: прогулки раз в 4 часа, находки, пойманные воры. Жми на будку во дворе.</small></div></div>
          <div class="dc-perks">${perkList}</div>` : '<div class="dc-empty">Сначала заведи Бублика — будка во дворе</div>'}`;
    },
  });
  H.click.push((t) => {
    const b = t.closest('[data-b="dog"]');
    if (b && S.b.dog && !D.visit) return onDog(b);
    if (t.closest('#dc-house') && !D.visit) { D.setTab('home'); return true; }
    if (t.closest('[data-house]')) {
      const nx = HOUSES[S.house + 1];
      if (nx && S.lvl >= nx.lvl && D.pay(nx.price)) { S.house++; D.sfx.level(); D.celebrate(); A.toast(`🏡 Новоселье! Теперь у тебя ${nx.name}`); D.save(); D.render(); }
      return true;
    }
    return false;
  });
  H.buffs.push(() => {
    const out = [];
    if ((HOUSES[S.house] || {}).bonus) out.push(`<span class="dc-buff">🏡 ${HOUSES[S.house].name} +${HOUSES[S.house].bonus}%</span>`);
    if (S.b.dog && S.dog.lvl >= 3 && Date.now() - S.dog.findAt >= findEvery()) out.push('<span class="dc-buff hot">🦴 Бублик что-то нашёл</span>');
    return out;
  });

  /* ================= ярмарка выходного дня ================= */
  const FAIR = [
    { id: 'goldpack', name: 'Семена золотой тыквы × 3', price: 100000, qty: 2, ico: 'goldseed', desc: 'Только на ярмарке — сразу три пакета' },
    { id: 'giantin', name: 'Гигантин', price: 60000, qty: 3, ico: 'grow', desc: 'Капни на растущую грядку — вырастет гигант' },
    { id: 'mutagen', name: 'Мутаген', price: 150000, qty: 2, ico: 'fert', desc: 'Капни на растущую грядку — будет мутация' },
    { id: 'bone', name: 'Сахарная косточка', price: 20000, qty: 3, ico: 'treefert', desc: '+150 опыта Бублику' },
    { id: 'feedmix', name: 'Комбикорм «Рекордист»', price: 40000, qty: 2, ico: 'compost', desc: 'Все сытые животные сразу готовы' },
    { id: 'livebait', name: 'Живая наживка × 30', price: 6000, qty: 2, ico: 'bait', desc: 'Для рыбалки' },
  ];
  const fairOpen = () => [0, 6].includes(new Date().getDay());
  const fairKey = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 1) % 7)); return d.toISOString().slice(0, 10); };
  function untilFair() {
    const d = new Date(), add = (6 - d.getDay() + 7) % 7 || 7;
    const t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + add);
    return t - d;
  }
  function fairLeft(it) {
    if (S.fair.w !== fairKey()) { S.fair.w = fairKey(); S.fair.bought = {}; }
    return it.qty - (S.fair.bought[it.id] || 0);
  }
  function buyFair(id) {
    const it = FAIR.find((x) => x.id === id);
    if (!it || !fairOpen() || fairLeft(it) <= 0 || !D.pay(it.price)) return;
    S.fair.bought[id] = (S.fair.bought[id] || 0) + 1;
    if (id === 'goldpack') S.tools.goldseed = (S.tools.goldseed || 0) + 3;
    else if (id === 'bone') { if (!S.b.dog) A.toast('Косточку отдашь, когда заведёшь Бублика'); dogXp(150); }
    else if (id === 'livebait') S.tools.bait = (S.tools.bait || 0) + 30;
    else if (id === 'feedmix') {
      const f = S.farm && S.farm.a;
      if (f) Object.values(f).forEach((a) => { if (a.fedAt) a.fedAt = 1; });
      A.toast('🐄 Животные наелись «Рекордиста» — всё готово к сбору');
    } else S.fx[id] = (S.fx[id] || 0) + 1;
    D.sfx.coin();
    D.save(); D.render();
  }
  H.tabs.push({
    id: 'fair', label: 'Ярмарка', live: true,
    render(P) {
      if (!fairOpen()) {
        P.innerHTML = `<div class="dc-faircard closed"><b>🎪 Ярмарка выходного дня</b><small>Приезжает по субботам и воскресеньям. До открытия: <b>${fmtLeft(untilFair())}</b></small></div>
          <div class="dc-note">На ярмарке продают то, чего нет больше нигде: гигантин, мутаген, пакеты золотых семян, косточки для Бублика и комбикорм.</div>`;
        return;
      }
      P.innerHTML = `<div class="dc-faircard"><b>🎪 Ярмарка открыта!</b><small>Товар ограничен — на эти выходные у каждого своя квота</small></div>
        <div class="dc-shop">${FAIR.map((it) => { const n = fairLeft(it); return `<div class="dc-shop-row fair">${ART.item(it.ico)}<div><b>${esc(it.name)}</b><small>${esc(it.desc)}</small><i>${n > 0 ? `осталось ${n}` : 'раскупили'}${S.fx[it.id] ? ` · у тебя ${S.fx[it.id]}` : ''}</i></div>
          <span class="dc-shop-btns">${S.fx[it.id] ? `<button class="dc-mini" data-fxarm="${it.id}">Взять</button>` : ''}<button class="dc-mini dark" data-fair="${it.id}" ${n > 0 ? '' : 'disabled'}>${rub(it.price)}</button></span></div>`; }).join('')}</div>`;
    },
  });
  // гигантин и мутаген: на растущую грядку
  H.bedClick.push((bed, gh, el) => {
    const id = S.fx.arm;
    if (!id || !bed.c || D.stage(bed, gh) >= 3) return false;
    if (!(S.fx[id] > 0)) { S.fx.arm = null; return false; }
    if (id === 'giantin') bed.gi = 1; else bed.mu = 1;
    S.fx[id]--;
    if (!S.fx[id]) S.fx.arm = null;
    D.sfx.water();
    D.floatAt(el, '🧪', null);
    return true;
  });
  H.onHarvest.push((id, n, bed) => {
    if (bed.gi) { D.addItem(`giant:${id}`, 1); if (S.book) S.book.giant[id] = (S.book.giant[id] || 0) + 1; A.toast(`🎉 Гигантин сработал: ${crop(id).name}-гигант!`); }
    if (bed.mu) {
      const k = ['glow', 'square', 'crystal'][Math.floor(D.rnd() * 3)];
      D.addItem(`mut:${id}:${k}`, 1);
      if (S.book) S.book.mut[`${id}:${k}`] = (S.book.mut[`${id}:${k}`] || 0) + 1;
      A.toast(`🧬 Мутаген сработал: ${crop(id).name} мутировала!`);
    }
    bed.gi = 0; bed.mu = 0;
  });
  H.bedExtra.push((bed) => (bed.gi || bed.mu ? `<span class="dc-boost">${bed.gi ? 'XL' : '🧬'}</span>` : ''));
  H.buffs.push(() => (S.fx.arm ? [`<button class="dc-buff armed" data-fxdisarm="1">${esc((FAIR.find((x) => x.id === S.fx.arm) || {}).name)} × ${S.fx[S.fx.arm] || 0} — жми на растущую грядку · ✕</button>`] : (fairOpen() ? ['<span class="dc-buff hot" data-fairtab="1">🎪 ярмарка открыта</span>'] : [])));

  /* ================= истории соседей ================= */
  const CHAINS = [
    { id: 'goat', who: 'Баба Валя', color: '#ec6a8c', lvl: 3, title: 'Пропавшая коза', steps: [
      { text: 'Ой, милок, беда! Коза моя Белка убежала. Приманить бы её морковкой…', need: { carrot: 8 } },
      { text: 'Говорят, её видели у пруда, возле рыбаков. Принеси рыбки — она за рыбаками ходит.', need: { fish: 3 } },
      { text: 'Нашлась, родимая! Только исхудала вся. Подкормить бы капусткой.', need: { cabbage: 4 } },
    ], reward: { rub: 60000, xp: 220, tools: { goldseed: 1 } }, end: 'Спасибо тебе! Вот семена с моей грядки — золотая тыква. Только никому не говори.' },
    { id: 'market', who: 'Дед Михалыч', color: '#5b8def', lvl: 6, title: 'Михалыч едет на рынок', steps: [
      { text: 'Собрался я в город на рынок, а продавать нечего. Подкинь яблочек, а?', need: { apple: 12 } },
      { text: 'Яблоки разлетелись! Покупатели про мёд спрашивают. Есть?', need: { honey: 3 } },
      { text: 'А теперь — фирменное. Сидр! Говорят, у тебя самый лучший.', need: { cider: 2 } },
    ], reward: { rub: 180000, xp: 380 }, end: 'Расторговался подчистую! Держи свою долю, заслужил.' },
    { id: 'fence', who: 'Председатель', color: '#5fae8f', lvl: 8, title: 'Новый забор для СНТ', steps: [
      { text: 'Товарищ! Скидываемся на новый забор для всего садового товарищества.', pay: 30000 },
      { text: 'Рабочих надо кормить. Нужна картошка — много картошки.', need: { potato: 15 } },
      { text: 'И чтоб по-людски — сварить им борща. Две кастрюли.', need: { borscht: 2 } },
    ], reward: { rub: 240000, xp: 450 }, end: 'Забор стоит! От лица правления — благодарность и премия.' },
    { id: 'fish', who: 'Сосед Толик', color: '#f2a93b', lvl: 14, title: 'Рыбацкая байка', steps: [
      { text: 'Спорим, ты щуку не поймаешь? Я вот поймал… ну почти.', need: { fish_pike: 1 } },
      { text: 'Ладно, щука — это несерьёзно. Вот сом — это рыба! Слабо?', need: { fish_catfish: 1 } },
      { text: 'Признаю, ты мастер. Давай ухи сварим, отметим.', need: { ukha: 2 } },
    ], reward: { rub: 450000, xp: 650, tools: { bait: 50 } }, end: 'Лучшая уха в моей жизни. Держи червей — ты их заслужил.' },
    { id: 'wedding', who: 'Тётя Люба', color: '#9a6cf0', lvl: 20, title: 'Тётя Люба выходит замуж', steps: [
      { text: 'Я выхожу замуж! За Михалыча! Нужен букет — розы, да покрасивее.', need: { rose: 6 } },
      { text: 'Гостей будет полный двор. Испеки пирогов, а?', need: { pie: 3 } },
      { text: 'И к чаю — варенья клубничного. Как у мамы.', need: { jamstraw: 3 } },
    ], reward: { rub: 900000, xp: 900 }, end: 'Это была лучшая свадьба в посёлке! Спасибо тебе, родной.' },
  ];
  const STEP_PAUSE = HOUR;
  const fishCount = () => Object.keys(S.inv).filter((k) => k.startsWith('fish_')).reduce((s, k) => s + (S.inv[k] || 0), 0);
  const has = (id, n) => (id === 'fish' ? fishCount() >= n : (S.inv[id] || 0) >= n);
  function takeFishAny(n) {
    Object.keys(S.inv).filter((k) => k.startsWith('fish_') && S.inv[k] > 0).sort((a, b) => D.basePrice(a) - D.basePrice(b)).forEach((k) => {
      const t = Math.min(n, S.inv[k]); S.inv[k] -= t; n -= t;
    });
  }
  function nextChain() {
    return CHAINS.find((c) => !S.story.done.includes(c.id) && S.lvl >= c.lvl) || null;
  }
  function storyTick() {
    if (!S.story.chain) {
      const c = nextChain();
      if (c && Date.now() >= S.story.nextAt) { S.story.chain = c.id; S.story.step = 0; D.save(); A.toast(`💬 ${c.who}: «Есть разговор…» — загляни в «Истории»`); }
    }
  }
  function advance() {
    const c = CHAINS.find((x) => x.id === S.story.chain);
    if (!c || Date.now() < S.story.nextAt) return;
    const st = c.steps[S.story.step];
    if (st.pay) { if (!D.pay(st.pay)) return; }
    else {
      if (!Object.entries(st.need).every(([id, n]) => has(id, n))) { A.toast('Пока не хватает'); return; }
      Object.entries(st.need).forEach(([id, n]) => { if (id === 'fish') takeFishAny(n); else S.inv[id] -= n; });
    }
    D.sfx.coin();
    S.story.step++;
    if (S.story.step >= c.steps.length) {
      S.rub += c.reward.rub; D.addXp(c.reward.xp);
      Object.entries(c.reward.tools || {}).forEach(([id, n]) => { S.tools[id] = (S.tools[id] || 0) + n; });
      S.story.done.push(c.id);
      S.story.chain = null;
      S.story.nextAt = Date.now() + 2 * HOUR;
      D.celebrate(); D.sfx.level();
      A.toast(`🎉 История «${c.title}» завершена: +${rub(c.reward.rub)}`);
      S.story.last = c.id;
    } else S.story.nextAt = Date.now() + STEP_PAUSE;
    D.save(); D.render();
  }
  H.tabs.push({
    id: 'stories', label: 'Истории', live: true,
    render(P) {
      const c = CHAINS.find((x) => x.id === S.story.chain);
      const last = !c && S.story.last && CHAINS.find((x) => x.id === S.story.last);
      let main;
      if (c) {
        const st = c.steps[S.story.step], wait = S.story.nextAt - Date.now();
        main = `<div class="dc-story"><div class="dc-story-top"><i style="background:${c.color}">${esc(c.who[0])}</i><div><b>${esc(c.who)}</b><small>«${esc(c.title)}» · шаг ${S.story.step + 1} из ${c.steps.length}</small></div></div>
          ${wait > 0 ? `<div class="dc-bubble muted">${esc(c.who)} ушла по делам… Вернётся через ${fmtLeft(wait)}</div>` : `<div class="dc-bubble">${esc(st.text)}</div>
          ${st.pay ? `<button class="dc-btn dc-btn-main wide" data-story="1">Скинуться · ${rub(st.pay)}</button>` : `<div class="dc-want">${Object.entries(st.need).map(([id, n]) => `<span class="${has(id, n) ? 'have' : ''}">${ART.item(id === 'fish' ? 'fish_carp_c' : id)}<small>${Math.min(id === 'fish' ? fishCount() : S.inv[id] || 0, n)}/${n}</small></span>`).join('')}</div>
          <button class="dc-btn ${Object.entries(st.need).every(([id, n]) => has(id, n)) ? 'dc-btn-main' : ''} wide" data-story="1">Отдать</button>`}`}
          <div class="dc-note">Награда: ${rub(c.reward.rub)} и ${c.reward.xp} опыта${c.reward.tools ? ' + подарок' : ''}</div></div>`;
      } else {
        const nx = nextChain();
        main = last ? `<div class="dc-story"><div class="dc-story-top"><i style="background:${last.color}">${esc(last.who[0])}</i><div><b>${esc(last.who)}</b><small>«${esc(last.title)}» — завершено</small></div></div><div class="dc-bubble">${esc(last.end)}</div></div>` : '';
        main += `<div class="dc-empty">${nx ? (Date.now() < S.story.nextAt ? `Соседи заняты. Новая история через ${fmtLeft(S.story.nextAt - Date.now())}` : 'Скоро кто-нибудь постучит…') : 'Все истории пройдены — новые ещё пишутся ✍️'}</div>`;
      }
      P.innerHTML = `${main}<span class="dc-cap">ВСЕ ИСТОРИИ</span><div class="dc-storylist">${CHAINS.map((x) => `<div class="${S.story.done.includes(x.id) ? 'done' : x.id === S.story.chain ? 'cur' : S.lvl < x.lvl ? 'lock' : ''}"><i style="background:${x.color}">${esc(x.who[0])}</i><b>${esc(x.title)}</b><small>${S.story.done.includes(x.id) ? '✓ пройдена' : x.id === S.story.chain ? 'идёт сейчас' : S.lvl < x.lvl ? `с ${x.lvl} ур.` : 'впереди'}</small></div>`).join('')}</div>`;
    },
  });
  H.tick.push(storyTick);
  H.buffs.push(() => {
    const c = CHAINS.find((x) => x.id === S.story.chain);
    return c && Date.now() >= S.story.nextAt ? [`<span class="dc-buff hot" data-storytab="1">💬 ${esc(c.who)} ждёт тебя</span>`] : [];
  });
  H.click.push((t) => {
    const f = t.closest('[data-fair]'); if (f) { buyFair(f.dataset.fair); return true; }
    const a = t.closest('[data-fxarm]'); if (a) { S.fx.arm = a.dataset.fxarm; S.view = 'garden'; A.toast('Жми на растущую грядку'); D.save(); D.render(); return true; }
    if (t.closest('[data-fxdisarm]')) { S.fx.arm = null; D.save(); D.render(); return true; }
    if (t.closest('[data-fairtab]')) { D.setTab('fair'); return true; }
    if (t.closest('[data-storytab]')) { D.setTab('stories'); return true; }
    if (t.closest('[data-story]')) { advance(); return true; }
    return false;
  });
})();
