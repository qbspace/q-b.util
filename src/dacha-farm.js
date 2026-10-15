// «Дача» — ферма: животные с кормлением, кот и мыши, кухня, пруд с рыбалкой
(function () {
  const D = window.DachaCore, FA = window.DachaFarmArt;
  if (!D || !FA) return;
  const { S, H, A, ART, MIN, HOUR, crop, esc, rub, fmtLeft } = D;
  if (!S.farm) S.farm = { a: {}, kitchen: [], kSlots: 1, pond: false, rod: false, fish: {}, mouseAt: Date.now(), catPet: 0 };
  const F = S.farm;

  /* ================= товары фермы ================= */
  const GOODS = {
    milk: { name: 'Молоко', price: 1200 }, goatmilk: { name: 'Козье молоко', price: 2000 }, fluff: { name: 'Кроличий пух', price: 2500 }, duckegg: { name: 'Утиные яйца', price: 1600 },
  };
  const FISH = [
    { id: 'ruff', name: 'Ёрш', price: 80, w: 30, min: 1 }, { id: 'roach', name: 'Плотва', price: 120, w: 26, min: 1 }, { id: 'carp_c', name: 'Карась', price: 160, w: 22, min: 1 },
    { id: 'perch', name: 'Окунь', price: 240, w: 16, min: 3 }, { id: 'bream', name: 'Лещ', price: 420, w: 10, min: 6 }, { id: 'carp', name: 'Карп', price: 700, w: 7, min: 9 },
    { id: 'zander', name: 'Судак', price: 1100, w: 4, min: 12 }, { id: 'pike', name: 'Щука', price: 1500, w: 3.2, min: 14 }, { id: 'catfish', name: 'Сом', price: 3000, w: 1.4, min: 18 },
    { id: 'goldfish', name: 'Золотая рыбка', price: 25000, w: 0.25, min: 1 },
  ];
  FISH.forEach((f) => { GOODS['fish_' + f.id] = { name: f.name, price: f.price }; });

  // рецепты: цена блюда = стоимость продуктов × (1.5 + 0.05 за каждый час готовки)
  const RECIPES = [
    { id: 'pickles', name: 'Соленья', lvl: 4, h: 1, need: { cucumber: 6, dill: 1 } },
    { id: 'borscht', name: 'Борщ', lvl: 5, h: 1.5, need: { beet: 2, cabbage: 1, potato: 2, carrot: 1, onion: 1 } },
    { id: 'ukha', name: 'Уха', lvl: 5, h: 1, need: { fish: 3, potato: 2, onion: 1 } },
    { id: 'jamstraw', name: 'Клубничное варенье', lvl: 7, h: 2, need: { strawberry: 6 } },
    { id: 'sauerkraut', name: 'Квашеная капуста', lvl: 8, h: 2, need: { cabbage: 4, carrot: 2 } },
    { id: 'tvorog', name: 'Творог', lvl: 7, h: 2, need: { milk: 3 } },
    { id: 'cider', name: 'Сидр', lvl: 6, h: 3, need: { apple: 8 } },
    { id: 'compote', name: 'Компот', lvl: 10, h: 2, need: { cherry: 4, plum: 4 } },
    { id: 'pie', name: 'Яблочный пирог', lvl: 9, h: 3, need: { egg: 4, apple: 3, honey: 1 } },
    { id: 'cheese', name: 'Козий сыр', lvl: 9, h: 4, need: { goatmilk: 3 } },
    { id: 'porridge', name: 'Тыквенная каша', lvl: 11, h: 2, need: { pumpkin: 1, milk: 2 } },
    { id: 'jamrasp', name: 'Малиновое варенье', lvl: 14, h: 3, need: { raspberry: 6 } },
    { id: 'pillow', name: 'Пуховая подушка', lvl: 11, h: 4, need: { fluff: 4 } },
  ];
  const fishAvg = () => 300;
  const recipeValue = (r) => Math.round(Object.entries(r.need).reduce((s, [id, n]) => s + (id === 'fish' ? fishAvg() : D.basePrice(id)) * n, 0) * (1.5 + r.h * 0.05));
  H.itemInfo.push((id) => {
    if (GOODS[id]) return GOODS[id];
    const r = RECIPES.find((x) => x.id === id);
    return r ? { name: r.name, price: recipeValue(r) } : null;
  });
  const prevItem = ART.item;
  ART.item = (id, cls = '') => (FA.PROD[id] ? FA.svg('0 0 64 64', FA.PROD[id], 'dc-ico ' + cls) : prevItem(id, cls));

  /* ================= животные ================= */
  const ANIMALS = [
    { id: 'cat', name: 'Кот Барсик', lvl: 5, price: 25000, desc: 'Ловит мышей в амбаре' },
    { id: 'cow', name: 'Корова Зорька', lvl: 6, price: 60000, out: 'milk', n: 2, every: 3, eats: ['carrot', 'beet', 'radish', 'onion'], feed: 6 },
    { id: 'goat', name: 'Коза Машка', lvl: 8, price: 90000, out: 'goatmilk', n: 2, every: 4, eats: ['dill', 'onion', 'beet', 'carrot'], feed: 6 },
    { id: 'rabbit', name: 'Кролики', lvl: 10, price: 150000, out: 'fluff', n: 3, every: 5, eats: ['carrot', 'dill', 'radish', 'cabbage'], feed: 8 },
    { id: 'duck', name: 'Утки', lvl: 12, price: 220000, out: 'duckegg', n: 3, every: 3, eats: ['peas', 'beet', 'potato', 'corn'], feed: 6, pond: true },
  ];
  const POND_PRICE = 40000, POND_LVL = 5, ROD_PRICE = 5000, BAIT = { n: 10, price: 1500 };
  const an = (id) => F.a[id];
  // состояние: hungry — ждёт корм, fed — производит, ready — можно собирать
  function animalState(d) {
    const a = an(d.id);
    if (!a) return 'none';
    if (!d.out) return 'pet';
    if (!a.fedAt) return 'hungry';
    return Date.now() - a.fedAt >= d.every * HOUR ? 'ready' : 'fed';
  }
  function feed(d) {
    let left = d.feed;
    const use = {};
    for (const id of d.eats) {
      const take = Math.min(left, S.inv[id] || 0);
      if (take) { use[id] = take; left -= take; }
      if (!left) break;
    }
    if (left) { A.toast(`Нужно ${d.feed} шт. корма: ${d.eats.map((x) => crop(x).name.toLowerCase()).join(', ')}`); return false; }
    Object.entries(use).forEach(([id, n]) => { S.inv[id] -= n; });
    an(d.id).fedAt = Date.now();
    return true;
  }
  function onAnimal(id, el) {
    const d = ANIMALS.find((x) => x.id === id), st = animalState(d);
    if (st === 'none') {
      if (S.lvl < d.lvl) { A.toast(`${d.name} — с ${d.lvl} уровня`); return; }
      if (d.pond && !F.pond) { A.toast('Уткам нужен пруд'); return; }
      if (!D.pay(d.price)) return;
      F.a[id] = { fedAt: 0 };
      D.sfx.coin(); D.celebrate();
      A.toast(`🏡 Теперь у тебя: ${d.name}`);
    } else if (st === 'pet') {
      if (Date.now() - F.catPet > 10 * MIN) { F.catPet = Date.now(); D.addXp(2); A.toast('😺 Барсик мурчит (+2 опыта)'); } else A.toast('😺 Барсик дремлет на солнышке');
      D.sfx.pop();
    } else if (st === 'hungry') { if (feed(d)) { D.sfx.plant(); D.floatAt(el, 'ням!', null); } }
    else if (st === 'ready') {
      D.addItem(d.out, d.n); D.addXp(d.n * 4);
      an(id).fedAt = 0;
      D.floatAt(el, `+${d.n}`, d.out); D.sfx.pop();
    } else A.toast(`${d.name}: будет готово через ${fmtLeft(an(id).fedAt + d.every * HOUR - Date.now())}`);
    D.save(); D.render();
  }

  // мыши: без кота раз в пару часов грызут запасы
  function miceTick() {
    const T = 2 * HOUR;
    if (Date.now() - F.mouseAt < T) return;
    F.mouseAt = Date.now();
    if (an('cat')) return;
    if (D.rnd() > 0.45) return;
    const stacks = Object.entries(S.inv).filter(([id, n]) => crop(id) && n >= 3);
    if (!stacks.length) return;
    const [id, n] = stacks[Math.floor(D.rnd() * stacks.length)];
    const lost = Math.max(1, Math.round(n * 0.1));
    S.inv[id] -= lost;
    A.toast(`🐭 Мыши погрызли ${lost} шт.: ${crop(id).name.toLowerCase()}. Заведи кота!`);
    D.save();
  }

  /* ================= вид «Ферма» в сцене ================= */
  function farmHTML() {
    const tiles = ANIMALS.map((d) => {
      const st = animalState(d), a = an(d.id);
      let badge = '', tag = '';
      if (st === 'none') tag = `<span class="dc-tag">${S.lvl < d.lvl ? `🔒 ${d.lvl} ур.` : rub(d.price)}</span>`;
      if (st === 'hungry') badge = '<span class="dc-badge hot">корм</span>';
      if (st === 'ready') badge = `<span class="dc-badge">${d.n}</span>`;
      const prog = st === 'fed' ? `<span class="dc-prog"><i style="width:${Math.min(100, ((Date.now() - a.fedAt) / (d.every * HOUR)) * 100).toFixed(1)}%"></i></span>` : '';
      const tip = st === 'none' ? `${d.name} — ${d.desc || `даёт ${GOODS[d.out].name.toLowerCase()}`}` : st === 'hungry' ? `Покормить: ${d.feed} шт. (${d.eats.map((x) => crop(x).name.toLowerCase()).join(', ')})` : st === 'ready' ? `Собрать: ${GOODS[d.out].name} × ${d.n}` : st === 'fed' ? `${GOODS[d.out].name} через ${fmtLeft(a.fedAt + d.every * HOUR - Date.now())}` : d.desc;
      return `<button class="dc-animal ${st} a-${d.id}" data-animal="${d.id}" title="${esc(tip)}">${FA.animal(d.id)}${badge}${tag}${prog}<span class="dc-bname">${esc(d.name)}</span></button>`;
    });
    const pond = `<button class="dc-pondtile ${F.pond ? 'own' : 'locked'}" data-pond="1" title="${F.pond ? 'Порыбачить' : `Выкопать пруд · ${rub(POND_PRICE)}`}">${FA.animal('pond')}${F.pond ? '' : `<span class="dc-tag">${S.lvl < POND_LVL ? `🔒 ${POND_LVL} ур.` : rub(POND_PRICE)}</span>`}<span class="dc-bname">Пруд</span></button>`;
    return [...tiles, pond];
  }
  function patchList(box, parts) {
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
  H.scene.push((scene) => {
    const views = scene.querySelector('#dc-views');
    if (views && !views.querySelector('[data-view="farm"]')) views.insertAdjacentHTML('beforeend', '<button data-view="farm">🐄 Ферма</button>');
    const farm = !D.visit && S.view === 'farm';
    scene.classList.toggle('farm', farm);
    if (views) views.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.view === (D.visit ? '' : S.view)));
    let box = scene.querySelector('.dc-farm');
    if (!box) { box = document.createElement('div'); box.className = 'dc-farm'; scene.querySelector('.dc-field').appendChild(box); }
    if (farm) {
      patchList(box, farmHTML());
      // плитки под размер сцены: одна строка, если влезает
      const field = scene.querySelector('.dc-field'), cs = getComputedStyle(field);
      const h = field.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), wv = field.clientWidth - 48, n = box.children.length;
      const fits = (cols) => { const rows = Math.ceil(n / cols), size = Math.min((wv - 12 * (cols - 1)) / cols, ((h - 12 * (rows - 1)) / rows) * 1.15); return size; };
      const cols = [6, 3, 2].reduce((best, c) => (fits(c) > fits(best) ? c : best), 6);
      box.style.gridTemplateColumns = `repeat(${cols}, ${Math.max(70, Math.min(170, fits(cols)))}px)`;
    }
  });
  H.click.push((t) => {
    const a = t.closest('[data-animal]');
    if (a) { onAnimal(a.dataset.animal, a); return true; }
    if (t.closest('[data-pond]')) {
      if (!F.pond) {
        if (S.lvl < POND_LVL) A.toast(`Пруд — с ${POND_LVL} уровня`);
        else if (D.pay(POND_PRICE)) { F.pond = true; D.sfx.coin(); D.celebrate(); A.toast('🎣 Пруд выкопан! Купи удочку во вкладке «Пруд»'); D.save(); }
      }
      D.setTab('pond');
      return true;
    }
    return false;
  });

  /* ================= кухня ================= */
  const KSLOT = [0, 50000, 200000, 600000];
  const fishStock = () => FISH.reduce((s, f) => s + (S.inv['fish_' + f.id] || 0), 0);
  const haveFor = (id, n) => (id === 'fish' ? fishStock() >= n : (S.inv[id] || 0) >= n);
  function takeFish(n) {
    // на уху идёт самая дешёвая рыба
    for (const f of FISH) {
      const k = 'fish_' + f.id, t = Math.min(n, S.inv[k] || 0);
      S.inv[k] = (S.inv[k] || 0) - t; n -= t;
      if (!n) break;
    }
  }
  function cook(rid) {
    const r = RECIPES.find((x) => x.id === rid);
    if (!r || S.lvl < r.lvl) return;
    if (F.kitchen.filter((k) => k).length >= F.kSlots) { A.toast('Все конфорки заняты'); return; }
    if (!Object.entries(r.need).every(([id, n]) => haveFor(id, n))) { A.toast('Не хватает продуктов'); return; }
    Object.entries(r.need).forEach(([id, n]) => { if (id === 'fish') takeFish(n); else S.inv[id] -= n; });
    F.kitchen.push({ r: rid, t: Date.now() });
    D.sfx.plant();
    A.toast(`🍳 Готовится: ${r.name}`);
    D.save(); D.render();
  }
  function collectDish(i) {
    const k = F.kitchen[i], r = k && RECIPES.find((x) => x.id === k.r);
    if (!r || Date.now() - k.t < r.h * HOUR) return;
    D.addItem(r.id, 1); D.addXp(Math.round(r.h * 12));
    F.kitchen.splice(i, 1);
    D.sfx.pop();
    A.toast(`🍽 Готово: ${r.name} → в погребе (амбаре)`);
    D.save(); D.render();
  }
  H.tabs.push({
    id: 'kitchen', label: 'Кухня', live: true,
    render(P) {
      const nx = KSLOT[F.kSlots];
      P.innerHTML = `<div class="dc-note">Из урожая готовятся заготовки — они стоят дороже, чем продукты по отдельности. Готовое ложится в амбар.</div>
        <div class="dc-stove">${Array.from({ length: F.kSlots }, (_, i) => {
          const k = F.kitchen[i], r = k && RECIPES.find((x) => x.id === k.r);
          if (!r) return '<div class="dc-pot empty"><span>Свободная конфорка</span></div>';
          const left = k.t + r.h * HOUR - Date.now(), done = left <= 0;
          return `<div class="dc-pot ${done ? 'done' : ''}">${ART.item(r.id)}<div><b>${esc(r.name)}</b><span class="dc-medalbar"><em style="width:${Math.min(100, ((Date.now() - k.t) / (r.h * HOUR)) * 100)}%"></em></span>
            <small>${done ? 'готово!' : `ещё ${fmtLeft(left)}`}</small></div>${done ? `<button class="dc-mini dark" data-dish="${i}">Забрать</button>` : ''}</div>`;
        }).join('')}${nx ? `<button class="dc-btn wide" data-kslot="1">＋ конфорка · ${rub(nx)}</button>` : ''}</div>
        <span class="dc-cap">РЕЦЕПТЫ</span>
        <div class="dc-recipes">${RECIPES.map((r) => {
          const lock = S.lvl < r.lvl, ok = !lock && Object.entries(r.need).every(([id, n]) => haveFor(id, n));
          return `<div class="dc-recipe ${lock ? 'lock' : ''}">${ART.item(r.id)}<div><b>${esc(r.name)}</b>
            <span class="dc-ingr">${Object.entries(r.need).map(([id, n]) => `<span class="${haveFor(id, n) ? 'have' : ''}" title="${esc(id === 'fish' ? 'Любая рыба' : D.itemName(id))}">${id === 'fish' ? ART.item('fish_carp_c') : ART.item(id)}<small>${id === 'fish' ? fishStock() : S.inv[id] || 0}/${n}</small></span>`).join('')}</span>
            <small>${fmtLeft(r.h * HOUR)} · продаётся ≈ ${rub(recipeValue(r))}</small></div>
            <button class="dc-mini ${ok ? 'dark' : ''}" data-cook="${r.id}" ${ok ? '' : 'disabled'}>${lock ? `🔒 ${r.lvl}` : 'Готовить'}</button></div>`;
        }).join('')}</div>`;
    },
  });

  /* ================= пруд и рыбалка ================= */
  const FISH_T = { wait: 0, bite: 0, timer: 0, state: 'idle', last: null };
  function rollFish() {
    const pool = FISH.filter((f) => S.lvl >= f.min);
    const total = pool.reduce((s, f) => s + f.w, 0);
    let r = D.rnd() * total;
    for (const f of pool) { r -= f.w; if (r <= 0) return f; }
    return pool[0];
  }
  function cast() {
    if (!F.rod || FISH_T.state !== 'idle') return;
    if (!(S.tools.bait > 0)) { A.toast('Кончилась наживка — купи банку червей'); return; }
    S.tools.bait--;
    FISH_T.state = 'wait';
    FISH_T.last = null;
    D.sfx.water();
    const wait = 1800 + D.rnd() * 5200;
    FISH_T.timer = setTimeout(() => {
      FISH_T.state = 'bite';
      FISH_T.bite = Date.now();
      D.sfx.pop();
      paintPond();
      FISH_T.timer = setTimeout(() => { FISH_T.state = 'idle'; FISH_T.last = { miss: true }; paintPond(); }, 950);
    }, wait);
    D.save();
    paintPond();
  }
  function hook() {
    if (FISH_T.state === 'wait') { clearTimeout(FISH_T.timer); FISH_T.state = 'idle'; FISH_T.last = { early: true }; paintPond(); return; }
    if (FISH_T.state !== 'bite') return;
    clearTimeout(FISH_T.timer);
    const f = rollFish(), wt = +(0.6 + D.rnd() * 1.4).toFixed(2);
    D.addItem('fish_' + f.id, 1);
    D.addXp(Math.max(1, Math.round(f.price / 60)));
    const rec = F.fish[f.id] || 0;
    if (wt > rec) F.fish[f.id] = wt;
    FISH_T.state = 'idle';
    FISH_T.last = { f, wt, rec: wt > rec };
    D.sfx.level();
    if (f.id === 'goldfish') { D.celebrate(); A.toast('✨ ЗОЛОТАЯ РЫБКА! Стоит 25 000 ₽'); }
    D.save();
    D.renderPanel();
  }
  function paintPond() {
    const w = document.getElementById('dc-pondgame');
    if (!w) return;
    w.className = `dc-pondgame st-${FISH_T.state}`;
    const L = FISH_T.last;
    w.querySelector('.dc-pond-msg').innerHTML = FISH_T.state === 'wait' ? 'Ждём поклёвку… не дёргай раньше времени' : FISH_T.state === 'bite' ? '<b>КЛЮЁТ! ЖМИ!</b>'
      : L && L.f ? `${ART.item('fish_' + L.f.id)} <b>${esc(L.f.name)}</b> · ${L.wt} кг${L.rec ? ' · рекорд!' : ''}` : L && L.miss ? 'Сорвалась… надо быстрее' : L && L.early ? 'Рано дёрнул — рыба ушла' : 'Закинь удочку';
    const b = document.getElementById('dc-castbtn');
    if (b) { b.textContent = FISH_T.state === 'idle' ? `Закинуть · наживки ${S.tools.bait || 0}` : 'Подсечь!'; b.classList.toggle('dc-btn-main', FISH_T.state !== 'wait'); }
  }
  H.tabs.push({
    id: 'pond', label: 'Пруд',
    render(P) {
      if (!F.pond) {
        P.innerHTML = `<div class="dc-empty">Пруда пока нет. Выкопай его на ферме (вид «🐄 Ферма») — ${rub(POND_PRICE)}, с ${POND_LVL} уровня.</div>`;
        return;
      }
      P.innerHTML = `${F.rod ? `<div class="dc-pondgame" id="dc-pondgame"><div class="dc-water"><i class="dc-float-b"></i><i class="dc-ripple"></i></div><div class="dc-pond-msg"></div></div>
          <button class="dc-btn wide" id="dc-castbtn" data-cast="1"></button>` : `<button class="dc-btn dc-btn-main wide" data-rod="1">Купить удочку · ${rub(ROD_PRICE)}</button>`}
        <button class="dc-btn wide" data-bait="1">${ART.item('bait')}Банка червей × ${BAIT.n} · ${rub(BAIT.price)}</button>
        <div class="dc-note">Закинул — жди, пока поплавок нырнёт, и жми сразу. Чем выше уровень, тем крупнее рыба. Рыбу продают или варят из неё уху.</div>
        <span class="dc-cap">УЛОВ И РЕКОРДЫ</span>
        <div class="dc-fishbook">${FISH.map((f) => `<div class="${F.fish[f.id] ? 'got' : ''} ${S.lvl < f.min ? 'lock' : ''}">${ART.item('fish_' + f.id)}<b>${F.fish[f.id] || S.lvl >= f.min ? esc(f.name) : '???'}</b><small>${F.fish[f.id] ? `рекорд ${F.fish[f.id]} кг` : S.lvl < f.min ? `с ${f.min} ур.` : 'не ловил'}</small></div>`).join('')}</div>`;
      paintPond();
    },
  });
  H.click.push((t) => {
    const d = t.closest('[data-dish]'); if (d) { collectDish(+d.dataset.dish); return true; }
    const c = t.closest('[data-cook]'); if (c) { cook(c.dataset.cook); return true; }
    if (t.closest('[data-kslot]')) { const p = KSLOT[F.kSlots]; if (p && D.pay(p)) { F.kSlots++; D.sfx.coin(); D.save(); D.render(); } return true; }
    if (t.closest('[data-cast]') || t.closest('#dc-pondgame')) { if (FISH_T.state === 'idle') cast(); else hook(); return true; }
    if (t.closest('[data-rod]')) { if (D.pay(ROD_PRICE)) { F.rod = true; S.tools.bait = (S.tools.bait || 0) + 5; D.sfx.coin(); A.toast('🎣 Удочка куплена, 5 червей в подарок'); D.save(); D.render(); } return true; }
    if (t.closest('[data-bait]')) { if (D.pay(BAIT.price)) { S.tools.bait = (S.tools.bait || 0) + BAIT.n; D.sfx.coin(); D.save(); D.render(); } return true; }
    return false;
  });

  H.tick.push(miceTick);
  H.buffs.push(() => {
    const out = [];
    const hungry = ANIMALS.filter((d) => d.out && animalState(d) === 'hungry').length, ready = ANIMALS.filter((d) => d.out && animalState(d) === 'ready').length;
    if (ready) out.push(`<span class="dc-buff">🐄 на ферме готово: ${ready}</span>`);
    if (hungry) out.push(`<span class="dc-buff pest">🥕 голодные: ${hungry}</span>`);
    const done = F.kitchen.filter((k) => { const r = RECIPES.find((x) => x.id === k.r); return r && Date.now() - k.t >= r.h * HOUR; }).length;
    if (done) out.push(`<span class="dc-buff">🍽 на кухне готово: ${done}</span>`);
    return out;
  });
})();
