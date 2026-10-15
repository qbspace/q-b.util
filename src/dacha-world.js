// «Дача» — живой мир: погода, времена года, вредители, гиганты и мутации, медали
(function () {
  const D = window.DachaCore;
  if (!D) return;
  const { S, H, A, ART, MIN, HOUR, crop, esc, rub, fmtLeft } = D;
  const O = '#5a3d2b';
  const sw = `stroke="${O}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const svg = (body, cls = '') => `<svg class="${cls}" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  if (!S.wx) S.wx = { done: 0, cover: -1 };
  if (!S.cnt) S.cnt = {};
  if (!S.book) S.book = { giant: {}, mut: {} };
  if (!S.pestAt) S.pestAt = Date.now();

  /* ================= времена года ================= */
  const SEASONS = {
    spring: { name: 'Весна', note: 'Всё растёт на 20% быстрее' },
    summer: { name: 'Лето', note: 'Ягоды и бахча дают +1 к урожаю' },
    autumn: { name: 'Осень', note: 'Овощи дают +1 к урожаю' },
    winter: { name: 'Зима', note: 'На улице растёт медленно (кроме морозостойких). В теплице — как обычно' },
  };
  const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];
  const WEEK = 7 * 24 * HOUR;
  const weekIdx = () => Math.floor((Date.now() + 3 * 24 * HOUR) / WEEK); // неделя с понедельника
  const SEASON_SHIFT = 2; // чтобы первый сезон после выхода был летом
  const season = () => SEASON_ORDER[(weekIdx() + SEASON_SHIFT) % 4];
  const seasonLeft = () => (weekIdx() + 1) * WEEK - 3 * 24 * HOUR - Date.now();
  const BERRIES = ['strawberry', 'raspberry', 'blueberry', 'melon', 'watermelon'];
  const HARDY = ['radish', 'carrot', 'onion', 'beet', 'garlic', 'cabbage'];
  const inGh = (bed) => S.gh.includes(bed);

  /* ================= погода: блоки по 3 часа, у всех одинаковая ================= */
  const BLOCK = 3 * HOUR;
  const blockIdx = (t = Date.now()) => Math.floor(t / BLOCK);
  function hash(n, seed) {
    let x = Math.imul(n ^ Math.imul(seed, 0x9e3779b1), 0x85ebca6b);
    x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16;
    return (x >>> 0) / 4294967296;
  }
  const WX = {
    clear: { name: 'Ясно', note: 'Хорошая погода' },
    rain: { name: 'Дождь', note: 'Сам поливает все грядки на улице' },
    drought: { name: 'Засуха', note: 'Сушит грядки, посаженное растёт на 25% дольше' },
    hail: { name: 'Град', note: 'Бьёт урожай на улице: −1 у трети грядок. Укрой плёнкой!' },
    snow: { name: 'Снег', note: 'Красиво, но поливать не помогает' },
  };
  function weatherAt(b) {
    const r = hash(b, 4242), se = SEASON_ORDER[(Math.floor((b * BLOCK + 3 * 24 * HOUR) / WEEK) + SEASON_SHIFT) % 4];
    if (se === 'winter') return r < 0.35 ? 'snow' : r < 0.42 ? 'hail' : 'clear';
    const rain = se === 'autumn' ? 0.32 : se === 'spring' ? 0.25 : 0.14;
    const dry = se === 'summer' ? 0.2 : 0.08;
    if (r < rain) return 'rain';
    if (r < rain + dry) return 'drought';
    if (r < rain + dry + 0.07) return 'hail';
    return 'clear';
  }
  const weather = () => weatherAt(blockIdx());

  // события в начале блока: засуха сушит, град бьёт
  function weatherTick() {
    const b = blockIdx();
    const w = weatherAt(b);
    if (S.wx.done !== b) {
      S.wx.done = b;
      if (w === 'drought') S.beds.forEach((bed) => { if (bed.c) bed.w = false; });
      if (w === 'hail') {
        if (S.wx.cover === b) A.toast('🛡 Плёнка спасла урожай от града');
        else {
          let hit = 0;
          S.beds.forEach((bed) => { if (bed.c && !bed.hail && D.rnd() < 0.34) { bed.hail = 1; hit++; } });
          if (hit) { A.toast(`🌨 Град побил ${hit} грядок`); if (A.note) A.note('dacha', '🌨 На даче прошёл град', `Побито грядок: ${hit}`); }
        }
      }
      if (w === 'rain' || w === 'drought' || w === 'hail') D.save();
    }
    if (w === 'rain') {
      let n = 0;
      S.beds.forEach((bed) => { if (bed.c && !bed.w && D.stage(bed, false) < 3) { bed.w = true; n++; } });
      if (n) D.save();
    }
  }

  /* ================= вредители ================= */
  const PESTS = {
    beetle: { name: 'Колорадский жук', on: ['potato', 'eggplant', 'pepper', 'tomato'] },
    aphid: { name: 'Тля', on: ['cucumber', 'zucchini', 'peas', 'cabbage', 'rose', 'strawberry', 'raspberry'] },
    mole: { name: 'Крот', on: null },
  };
  const PEST_ART = {
    beetle: `<ellipse cx="32" cy="36" rx="10" ry="13" fill="#f2c14e" ${sw}/><path d="M32 23v26M26 28v16M38 28v16" stroke="${O}" stroke-width="2.4"/><circle cx="32" cy="21" r="5" fill="#d9654b" ${sw}/>
      <path d="M22 30l-6-3M22 38l-7 1M23 46l-6 4M42 30l6-3M42 38l7 1M41 46l6 4" stroke="${O}" stroke-width="2" stroke-linecap="round"/>`,
    aphid: `${[[24, 30], [34, 26], [40, 36], [28, 40], [36, 46]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="4" fill="#a7e06f" stroke="${O}" stroke-width="1.6"/><circle cx="${x + 3}" cy="${y - 1}" r="1" fill="${O}"/>`).join('')}`,
    mole: `<ellipse cx="32" cy="50" rx="20" ry="7" fill="#7d4a35" ${sw}/><ellipse cx="32" cy="40" rx="12" ry="11" fill="#5a4a5a" ${sw}/><ellipse cx="32" cy="44" rx="4" ry="3" fill="#f2a0b0" ${sw}/>
      <circle cx="27" cy="37" r="1.6" fill="#fff"/><circle cx="37" cy="37" r="1.6" fill="#fff"/><path d="M22 46l-6 2M42 46l6 2" stroke="${O}" stroke-width="1.6"/>`,
  };
  const PEST_T = 15 * MIN;
  function pestTick() {
    let steps = Math.min(6, Math.floor((Date.now() - S.pestAt) / PEST_T));
    if (steps < 1) return;
    S.pestAt += steps * PEST_T;
    if (Date.now() - S.pestAt > PEST_T) S.pestAt = Date.now();
    let fresh = 0;
    while (steps--) {
      S.beds.forEach((bed) => {
        if (!bed.c || bed.pest || D.stage(bed, false) === 3 || D.rnd() > 0.04) return;
        const own = Object.entries(PESTS).find(([, p]) => p.on && p.on.includes(bed.c));
        bed.pest = own && D.rnd() < 0.7 ? own[0] : 'mole';
        fresh++;
      });
    }
    if (fresh) D.save();
  }
  H.yieldAdd.push((bed) => -((bed.pest ? 1 : 0) + (bed.hail ? 1 : 0)) + (() => {
    const se = season();
    if (se === 'summer' && BERRIES.includes(bed.c)) return 1;
    if (se === 'autumn' && !BERRIES.includes(bed.c)) return 1;
    return 0;
  })());
  H.bedExtra.push((bed) => (bed.pest ? svg(PEST_ART[bed.pest], `dc-pest p-${bed.pest}`) : '') + (bed.hail ? '<span class="dc-hailmark" title="Побито градом: −1 к урожаю"></span>' : ''));
  H.bedClick.push((bed, gh, el) => {
    if (!bed.pest) return false;
    const p = PESTS[bed.pest];
    bed.pest = null;
    D.addXp(2);
    D.sfx.pull();
    D.floatAt(el, 'прогнал!', null);
    A.toast(`${p.name} прогнан с грядки`);
    return true;
  });
  // сбор не трогает метки — но после сбора грядка чистая
  H.onHarvest.push((id, n, bed) => { bed.pest = null; bed.hail = 0; });

  // сезон и погода влияют на скорость роста посаженного
  H.growMul.push((c, bed) => {
    const se = season();
    let m = 1;
    if (se === 'spring') m *= 0.8;
    if (se === 'winter' && !inGh(bed) && !HARDY.includes(c.id)) m *= 1.6;
    if (weather() === 'drought' && !inGh(bed)) m *= 1.25;
    return m;
  });

  /* ================= гиганты и мутации ================= */
  const MUTS = { glow: 'светится', square: 'квадратная', crystal: 'хрустальная' };
  const special = (id) => {
    const m = /^(giant|mut):([a-z]+)(?::([a-z]+))?$/.exec(String(id));
    return m && crop(m[2]) ? { kind: m[1], base: m[2], mut: m[3] } : null;
  };
  H.itemInfo.push((id) => {
    const sp = special(id);
    if (!sp) return null;
    const c = crop(sp.base);
    if (sp.kind === 'giant') return { name: `${c.name} · гигант`, price: c.price * 20 };
    return { name: `${c.name} · ${MUTS[sp.mut] || 'мутант'}`, price: c.price * 40 };
  });
  const origItem = ART.item;
  ART.item = (id, cls = '') => {
    const sp = special(id);
    if (!sp) return origItem(id, cls);
    return `<span class="dc-sp sp-${sp.kind === 'giant' ? 'giant' : sp.mut}">${origItem(sp.base, cls)}</span>`;
  };
  H.onHarvest.push((id, n, bed, el) => {
    // счётчик для медалей
    const before = S.cnt[id] || 0;
    S.cnt[id] = before + n;
    const t = MEDALS.findIndex((m) => before < m.n && S.cnt[id] >= m.n);
    if (t >= 0) { A.toast(`🏅 Медаль «${MEDALS[t].name}» за ${crop(id).name}: +${Math.round(MEDALS[t].bonus * 100)}% к цене навсегда`); D.celebrate(); }
    const r = D.rnd();
    if (r < 0.006) {
      const kinds = Object.keys(MUTS), k = kinds[Math.floor(D.rnd() * kinds.length)];
      D.addItem(`mut:${id}:${k}`, 1);
      S.book.mut[`${id}:${k}`] = (S.book.mut[`${id}:${k}`] || 0) + 1;
      A.toast(`🧬 Мутация! ${crop(id).name} — ${MUTS[k]}. Стоит ×40`);
      D.celebrate(); D.sfx.level();
    } else if (r < 0.021) {
      D.addItem(`giant:${id}`, 1);
      S.book.giant[id] = (S.book.giant[id] || 0) + 1;
      A.toast(`🎉 Вырос гигант: ${crop(id).name}! Стоит ×20`);
      D.celebrate(); D.sfx.level();
    }
  });

  /* ================= медали ================= */
  const MEDALS = [
    { n: 100, name: 'Бронза', bonus: 0.1, color: '#c98a52' },
    { n: 500, name: 'Серебро', bonus: 0.2, color: '#b8c0c8' },
    { n: 2000, name: 'Золото', bonus: 0.35, color: '#f2c14e' },
  ];
  const medalOf = (id) => { let m = null; MEDALS.forEach((x) => { if ((S.cnt[id] || 0) >= x.n) m = x; }); return m; };
  H.priceMul.push((id) => { const m = crop(id) && medalOf(id); return m ? 1 + m.bonus : 1; });

  /* ================= рисунки погоды ================= */
  const WX_ICON = {
    clear: `<circle cx="32" cy="32" r="12" fill="#ffd95e" ${sw}/>${Array.from({ length: 8 }, (_, i) => `<path d="M32 8v6" stroke="#f2b94a" stroke-width="3.4" stroke-linecap="round" transform="rotate(${i * 45} 32 32)"/>`).join('')}`,
    rain: `<path d="M16 38c-8 0-10-10-3-13 0-9 12-12 17-6 4-8 18-7 19 3 8 0 9 12 1 16z" fill="#e9eef3" ${sw}/><path d="M22 46l-3 8M32 46l-3 8M42 46l-3 8" stroke="#5b8def" stroke-width="3" stroke-linecap="round"/>`,
    drought: `<circle cx="32" cy="26" r="11" fill="#ff9a3c" ${sw}/><path d="M12 46c4-3 8 3 12 0s8 3 12 0 8 3 12 0 8 3 4 0" fill="none" stroke="#e07b16" stroke-width="3" stroke-linecap="round"/><path d="M14 56c4-3 8 3 12 0s8 3 12 0 8 3 12 0" fill="none" stroke="#e07b16" stroke-width="3" stroke-linecap="round" opacity=".6"/>`,
    hail: `<path d="M16 34c-8 0-10-10-3-13 0-9 12-12 17-6 4-8 18-7 19 3 8 0 9 12 1 16z" fill="#a9b4c2" ${sw}/><g fill="#fff" ${sw}><circle cx="22" cy="46" r="3.6"/><circle cx="34" cy="50" r="3.6"/><circle cx="44" cy="44" r="3.6"/><circle cx="28" cy="57" r="3"/></g><path d="M36 34l-5 8h5l-4 7" fill="none" stroke="#f2c14e" stroke-width="2.4" stroke-linejoin="round"/>`,
    snow: `<path d="M16 34c-8 0-10-10-3-13 0-9 12-12 17-6 4-8 18-7 19 3 8 0 9 12 1 16z" fill="#fff" ${sw}/>${[[22, 46], [34, 52], [44, 44]].map(([x, y]) => `<g transform="translate(${x} ${y})" stroke="#7cc6e8" stroke-width="2.2" stroke-linecap="round"><path d="M0-5v10M-4.3-2.5l8.6 5M-4.3 2.5l8.6-5"/></g>`).join('')}`,
  };
  const SEASON_ICON = {
    spring: `<path d="M32 58V30" stroke="#5f9e3f" stroke-width="3" stroke-linecap="round"/>${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="32" cy="16" rx="6" ry="9" fill="#f7a8c4" ${sw} transform="rotate(${r} 32 24)"/>`).join('')}<circle cx="32" cy="24" r="5" fill="#ffd95e" ${sw}/>`,
    summer: WX_ICON.clear,
    autumn: `<path d="M32 8c12 8 18 20 14 34-4 10-10 14-14 16-4-2-10-6-14-16C14 28 20 16 32 8z" fill="#e8823a" ${sw}/><path d="M32 12v48M32 26l-8-6M32 34l9-7M32 44l-9-6" stroke="${O}" stroke-width="1.8" stroke-linecap="round"/>`,
    winter: `<g stroke="#7cc6e8" stroke-width="3.4" stroke-linecap="round"><path d="M32 8v48M11 20l42 24M11 44l42-24"/><path d="M26 12l6 6 6-6M26 52l6-6 6 6"/></g>`,
  };
  const wxIco = (k) => svg(WX_ICON[k] || '', 'dc-wxico');

  /* ================= сцена ================= */
  H.scene.push((scene) => {
    scene.dataset.season = season();
    scene.dataset.wx = weather();
    if (!scene.querySelector('.dc-weather')) {
      const w = document.createElement('div');
      w.className = 'dc-weather';
      w.innerHTML = '<i class="l1"></i><i class="l2"></i>';
      scene.appendChild(w);
    }
  });
  H.buffs.push(() => {
    const se = season(), w = weather();
    const out = [`<span class="dc-buff season" data-wxtab="1" title="${esc(SEASONS[se].note)}">${svg(SEASON_ICON[se], 'dc-ico')}${SEASONS[se].name}</span>`];
    out.push(`<span class="dc-buff wx wx-${w}" data-wxtab="1" title="${esc(WX[w].note)}">${svg(WX_ICON[w], 'dc-ico')}${WX[w].name}</span>`);
    const pests = S.beds.filter((b) => b.pest).length;
    if (pests) out.push(`<span class="dc-buff pest">🐛 вредители на ${pests} грядках</span>`);
    return out;
  });
  H.click.push((t) => { if (t.closest('[data-wxtab]')) { D.setTab('weather'); return true; } return false; });

  /* ================= вкладки ================= */
  const COVER_PRICE = () => 2000 + S.lvl * 800;
  H.tabs.push({
    id: 'weather', label: 'Погода', live: true,
    render(P) {
      const se = season(), w = weather(), b = blockIdx();
      const next = Array.from({ length: 8 }, (_, i) => b + i);
      const nextHail = next.find((x) => x > b && weatherAt(x) === 'hail');
      const hh = (x) => new Date(x * BLOCK).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      P.innerHTML = `
        <div class="dc-wxcard wx-${w}">${wxIco(w)}<div><b>Сейчас: ${WX[w].name}</b><small>${esc(WX[w].note)}</small><i>сменится через ${fmtLeft((b + 1) * BLOCK - Date.now())}</i></div></div>
        <div class="dc-wxcard season s-${se}">${svg(SEASON_ICON[se], 'dc-wxico')}<div><b>${SEASONS[se].name}</b><small>${esc(SEASONS[se].note)}</small><i>до смены сезона ${fmtLeft(seasonLeft())}</i></div></div>
        <span class="dc-cap">ПРОГНОЗ НА СУТКИ</span>
        <div class="dc-forecast">${next.map((x) => `<div class="${x === b ? 'now' : ''}">${wxIco(weatherAt(x))}<b>${x === b ? 'сейчас' : hh(x)}</b><small>${WX[weatherAt(x)].name}</small></div>`).join('')}</div>
        ${nextHail ? `<div class="dc-note">🌨 Град в ${hh(nextHail)}. ${S.wx.cover === nextHail ? '<b>Плёнка уже натянута ✓</b>' : 'Укрой грядки плёнкой заранее:'}</div>
          ${S.wx.cover === nextHail ? '' : `<button class="dc-btn dc-btn-main wide" data-cover="${nextHail}">Натянуть плёнку · ${rub(COVER_PRICE())}</button>`}` : '<div class="dc-note">Града в ближайшие сутки не обещают.</div>'}
        <div class="dc-note">Погода и сезоны у всех кентов одинаковые. Сезон меняется раз в неделю: весна → лето → осень → зима.</div>`;
    },
  });
  H.click.push((t) => {
    const c = t.closest('[data-cover]');
    if (!c) return false;
    if (D.pay(COVER_PRICE())) { S.wx.cover = +c.dataset.cover; D.sfx.coin(); A.toast('🛡 Плёнка натянута — град не страшен'); D.save(); D.render(); }
    return true;
  });

  H.tabs.push({
    id: 'book', label: 'Книга',
    render(P) {
      const crops = D.CROPS;
      const mutTotal = crops.length * Object.keys(MUTS).length, mutFound = Object.keys(S.book.mut).length;
      const giants = Object.values(S.book.giant).reduce((a, b) => a + b, 0);
      P.innerHTML = `<div class="dc-note">Собери по 100, 500 и 2000 штук каждой культуры — получишь медаль и вечную надбавку к цене. Гиганты и мутации выпадают при сборе очень редко.</div>
        <div class="dc-stats"><div><b>${crops.filter((c) => medalOf(c.id)).length}/${crops.length}</b><span>медалей</span></div><div><b>${giants}</b><span>гигантов</span></div><div><b>${mutFound}/${mutTotal}</b><span>мутаций открыто</span></div><div><b>${Object.values(S.cnt).reduce((a, b) => a + b, 0)}</b><span>всего собрано</span></div></div>
        <div class="dc-book">${crops.map((c) => {
          const n = S.cnt[c.id] || 0, m = medalOf(c.id), nx = MEDALS.find((x) => n < x.n);
          const muts = Object.keys(MUTS).map((k) => `<i class="${S.book.mut[`${c.id}:${k}`] ? 'on' : ''}" title="${esc(c.name + ' · ' + MUTS[k])}"></i>`).join('');
          return `<div class="dc-bookrow">${ART.item(c.id)}<div><b>${esc(c.name)} ${m ? `<span class="dc-medal" style="background:${m.color}">${m.name} +${Math.round(m.bonus * 100)}%</span>` : ''}</b>
            <span class="dc-medalbar"><em style="width:${nx ? Math.min(100, (n / nx.n) * 100) : 100}%"></em></span>
            <small>${n} собрано${nx ? ` · до «${nx.name}» ${nx.n - n}` : ' · все медали'}${S.book.giant[c.id] ? ` · гигантов ${S.book.giant[c.id]}` : ''}</small></div><span class="dc-muts">${muts}</span></div>`;
        }).join('')}</div>`;
    },
  });

  H.tick.push(weatherTick, pestTick);
})();
