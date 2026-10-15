// «Дача» — селекция, выставка с голосованием, колхоз и обмен урожаем с кентами
(function () {
  const D = window.DachaCore;
  if (!D) return;
  const { S, H, A, ART, MIN, HOUR, crop, esc, rub, fmtLeft } = D;
  if (!S.hyb) S.hyb = {};
  if (!S.show) S.show = { w: -1, item: null, votes: {}, voted: {}, claimed: -1, seen: {} };
  if (!S.kolkhoz) S.kolkhoz = { w: -1, mine: 0, others: {}, claimed: -1 };
  const WEEK = 7 * 24 * HOUR;
  const weekIdx = () => Math.floor((Date.now() + 3 * 24 * HOUR) / WEEK);
  const weekLeft = () => (weekIdx() + 1) * WEEK - 3 * 24 * HOUR - Date.now();

  /* ================= селекция ================= */
  const HYBRIDS = [
    { id: 'pomperets', name: 'Помперец', a: 'tomato', b: 'pepper' },
    { id: 'ogurdynya', name: 'Огурдыня', a: 'cucumber', b: 'melon' },
    { id: 'klubmalina', name: 'Клубмалина', a: 'strawberry', b: 'raspberry' },
    { id: 'kartomat', name: 'Картомат', a: 'potato', b: 'tomato' },
    { id: 'morsvekla', name: 'Морсвёкла', a: 'carrot', b: 'beet' },
    { id: 'tykvarbuz', name: 'Тыкварбуз', a: 'pumpkin', b: 'watermelon' },
    { id: 'kapuluk', name: 'Капулук', a: 'cabbage', b: 'onion' },
    { id: 'lavroza', name: 'Лавроза', a: 'rose', b: 'lavender' },
    { id: 'kukabach', name: 'Кукабачок', a: 'corn', b: 'zucchini' },
    { id: 'golubnika', name: 'Голубника', a: 'blueberry', b: 'raspberry' },
  ];
  // гибрид — отдельная культура: семена только от скрещивания, цена выше родителей
  HYBRIDS.forEach((h) => {
    const A1 = crop(h.a), B1 = crop(h.b);
    if (!A1 || !B1) return;
    h.ok = true;
    D.CROPS.push({ id: h.id, name: h.name, grow: Math.round((A1.grow + B1.grow) / 2), seed: 0, price: Math.round((A1.price + B1.price) * 1.8),
      xp: A1.xp + B1.xp, lvl: Math.max(A1.lvl, B1.lvl), seedItem: 'hyb_' + h.id, hyb: true });
  });
  const hyb = (id) => HYBRIDS.find((h) => h.id === id && h.ok);
  const origItem = ART.item, origPlant = ART.plant;
  ART.item = (id, cls = '') => {
    const h = hyb(String(id).replace(/^hyb_/, ''));
    if (!h) return origItem(id, cls);
    return `<span class="dc-hyb ${String(id).startsWith('hyb_') ? 'seedpack' : ''}">${origItem(h.a, cls)}${origItem(h.b, cls)}</span>`;
  };
  ART.plant = (id, st) => {
    const h = hyb(id);
    if (!h) return origPlant(id, st);
    return st < 3 ? origPlant(h.a, st) : `<span class="dc-plant dc-hybplant">${origPlant(h.a, 3)}${origPlant(h.b, 3)}</span>`;
  };
  // опыление: при сборе — соседняя по порядку грядка с подходящей культурой
  H.onHarvest.push((id, n, bed) => {
    const i = S.beds.indexOf(bed);
    if (i < 0) return;
    [S.beds[i - 1], S.beds[i + 1]].forEach((nb) => {
      if (!nb || !nb.c) return;
      const h = HYBRIDS.find((x) => x.ok && ((x.a === id && x.b === nb.c) || (x.b === id && x.a === nb.c)));
      if (!h || D.rnd() > 0.07) return;
      S.tools['hyb_' + h.id] = (S.tools['hyb_' + h.id] || 0) + 2;
      const first = !S.hyb[h.id];
      S.hyb[h.id] = true;
      A.toast(`🧬 Опыление! ${first ? 'Новый сорт' : 'Семена'} «${h.name}» × 2`);
      if (first) { D.celebrate(); D.sfx.level(); }
    });
  });
  H.tabs.push({
    id: 'breed', label: 'Селекция',
    render(P) {
      const found = HYBRIDS.filter((h) => h.ok && S.hyb[h.id]).length;
      P.innerHTML = `<div class="dc-note">Сажай разные культуры <b>на соседних грядках</b> (рядом по порядку). При сборе они иногда опыляются — и выпадают семена нового сорта. Гибриды стоят почти вдвое дороже родителей.</div>
        <div class="dc-stats"><div><b>${found}/${HYBRIDS.filter((h) => h.ok).length}</b><span>сортов выведено</span></div><div><b>${HYBRIDS.reduce((s, h) => s + (S.tools['hyb_' + h.id] || 0), 0)}</b><span>семян гибридов</span></div></div>
        <div class="dc-book">${HYBRIDS.filter((h) => h.ok).map((h) => {
          const c = crop(h.id), got = S.hyb[h.id], seeds = S.tools['hyb_' + h.id] || 0;
          return `<div class="dc-bookrow">${got ? ART.item(h.id) : `<span class="dc-hyb unknown">${ART.item(h.a)}${ART.item(h.b)}</span>`}<div><b>${got ? esc(h.name) : '???'}</b>
            <small>${esc(crop(h.a).name)} + ${esc(crop(h.b).name)}${got ? ` · ${rub(c.price)} за шт. · семян ${seeds}` : ' — посади рядом'}</small></div>
            ${got && seeds ? `<button class="dc-mini dark" data-hseed="${h.id}">Сажать</button>` : ''}</div>`;
        }).join('')}</div>`;
    },
  });
  H.click.push((t) => {
    const b = t.closest('[data-hseed]');
    if (!b) return false;
    S.seed = b.dataset.hseed; S.view = 'garden';
    A.toast(`Выбраны семена «${crop(S.seed).name}» — жми на пустую грядку`);
    D.save(); D.setTab('seeds');
    return true;
  });

  /* ================= сеть: выставка, колхоз, обмен ================= */
  const sb = window.supabase && window.QB_ONLINE ? window.supabase.createClient(window.QB_ONLINE.url, window.QB_ONLINE.key, { auth: { persistSession: false } }) : null;
  const net = { ch: null, live: false, hall: [] };
  const send = (event, payload) => net.ch && net.live && net.ch.send({ type: 'broadcast', event, payload: { ...payload, from: A.pid } });
  const nickOf = (id) => String((net.hall.find((h) => h.id === id) || {}).nick || 'Кент').slice(0, 20);

  /* --- выставка --- */
  const RAR = (id) => (/^mut:/.test(id) ? 120 : /^giant:/.test(id) ? 60 : hyb(id) ? 45 : id === 'goldpumpkin' ? 70 : Math.min(40, Math.round(Math.log10(D.basePrice(id) + 10) * 8)));
  const BOTS = ['Баба Валя', 'Дед Михалыч', 'Тётя Люба'];
  function botEntries() {
    const w = weekIdx();
    return BOTS.map((name, i) => ({ id: 'bot' + i, nick: name, bot: true, score: 30 + ((w * 37 + i * 53) % 70) }));
  }
  function showFresh() {
    if (S.show.w !== weekIdx()) {
      // неделя кончилась — подводим итоги
      if (S.show.item && S.show.claimed !== S.show.w) claimShow();
      Object.assign(S.show, { w: weekIdx(), item: null, votes: {}, voted: {}, seen: {} });
    }
  }
  const myShowScore = () => (S.show.item ? RAR(S.show.item) + Object.keys(S.show.votes).length * 20 : 0);
  function showBoard() {
    const rows = [...botEntries()];
    Object.values(S.show.seen).forEach((e) => rows.push(e));
    if (S.show.item) rows.push({ id: A.pid, nick: 'Ты', item: S.show.item, score: myShowScore(), me: true });
    return rows.sort((a, b) => b.score - a.score);
  }
  function claimShow() {
    const board = showBoard(), place = board.findIndex((r) => r.me) + 1;
    const prize = [0, 500000, 200000, 100000][place] || 20000;
    S.rub += prize;
    if (place === 1) { S.trophies = (S.trophies || 0) + 1; }
    S.show.claimed = S.show.w;
    A.toast(`🏆 Итоги выставки: ${place} место — ${rub(prize)}${place === 1 ? ' и кубок!' : ''}`);
    D.save();
  }
  function enterShow(id) {
    showFresh();
    if (S.show.item || !(S.inv[id] > 0)) return;
    S.inv[id]--;
    S.show.item = id;
    D.sfx.coin();
    A.toast(`🏅 ${D.itemName(id)} — на выставке! Кенты могут голосовать`);
    track();
    D.save(); D.render();
  }
  H.priceMul.push(() => 1 + Math.min(10, S.trophies || 0) * 0.02);

  /* --- колхоз: общая цель недели --- */
  const KH_GOAL = 400;
  function khItem() {
    const pool = D.CROPS.filter((c) => !c.seedItem && c.lvl <= 8);
    return pool[(weekIdx() * 7919) % pool.length].id;
  }
  function khFresh() { if (S.kolkhoz.w !== weekIdx()) Object.assign(S.kolkhoz, { w: weekIdx(), mine: 0, others: {} }); }
  const khTotal = () => S.kolkhoz.mine + Object.values(S.kolkhoz.others).reduce((s, x) => s + x.n, 0);
  function contribute(n) {
    khFresh();
    const id = khItem();
    n = Math.min(n, S.inv[id] || 0, Math.max(0, KH_GOAL - khTotal()));
    if (n <= 0) return;
    S.inv[id] -= n;
    S.kolkhoz.mine += n;
    D.addXp(Math.ceil(n / 2));
    D.sfx.coin();
    track();
    D.save(); D.render();
  }
  function khClaim() {
    if (khTotal() < KH_GOAL || !S.kolkhoz.mine || S.kolkhoz.claimed === S.kolkhoz.w) return;
    const prize = 50000 + Math.round(S.kolkhoz.mine * D.basePrice(khItem()) * 1.6);
    S.rub += prize;
    S.kolkhoz.claimed = S.kolkhoz.w;
    D.celebrate(); D.sfx.level();
    A.toast(`🚜 Колхоз выполнил план! Твоя премия ${rub(prize)}`);
    D.save(); D.render();
  }

  /* --- обмен --- */
  const OFFER_TTL = 15 * MIN;
  if (!S.offers) S.offers = {};
  const incoming = [];
  const validItem = (id) => typeof id === 'string' && id.length < 40 && !!D.itemName(id) && D.basePrice(id) > 0;
  function propose(to, give, gn, want, wn) {
    gn = Math.floor(gn); wn = Math.floor(wn);
    if (!to || !validItem(give) || !validItem(want) || gn < 1 || wn < 1) { A.toast('Заполни обмен'); return; }
    if ((S.inv[give] || 0) < gn) { A.toast('Столько у тебя нет'); return; }
    S.inv[give] -= gn; // держим у себя до ответа
    const oid = Date.now().toString(36) + Math.floor(D.rnd() * 1e6).toString(36);
    S.offers[oid] = { to, give, gn, want, wn, t: Date.now() };
    send('offer', { to, oid, give, gn, want, wn, nick: A.nick() });
    A.toast(`📨 Предложение отправлено: ${nickOf(to)}`);
    D.save(); D.render();
  }
  function refund(oid, why) {
    const o = S.offers[oid];
    if (!o) return;
    S.inv[o.give] = (S.inv[o.give] || 0) + o.gn;
    delete S.offers[oid];
    if (why) A.toast(why);
    D.save(); D.render();
  }
  function accept(i) {
    const o = incoming[i];
    if (!o || Date.now() - o.t > OFFER_TTL - MIN || !net.hall.some((h) => h.id === o.from)) { A.toast('Предложение устарело'); incoming.splice(i, 1); D.render(); return; }
    if ((S.inv[o.want] || 0) < o.wn) { A.toast(`Нужно ${o.wn} шт.: ${D.itemName(o.want)}`); return; }
    S.inv[o.want] -= o.wn;
    D.addItem(o.give, o.gn);
    send('accepted', { to: o.from, oid: o.oid });
    incoming.splice(i, 1);
    D.sfx.coin();
    A.toast(`🤝 Обмен с ${o.nick}: +${o.gn} ${D.itemName(o.give)}`);
    D.save(); D.render();
  }

  /* --- канал --- */
  function track() {
    if (!net.ch || !net.live) return;
    khFresh(); showFresh();
    net.ch.track({ id: A.pid, nick: A.nick(), lvl: S.lvl, show: S.show.item ? { item: S.show.item, score: myShowScore(), w: S.show.w } : null, kh: { w: S.kolkhoz.w, n: S.kolkhoz.mine } });
  }
  function join() {
    if (!sb) return;
    net.ch = sb.channel('qb-dacha-village', { config: { broadcast: { self: false }, presence: { key: A.pid } } });
    net.ch.on('presence', { event: 'sync' }, () => {
      net.hall = Object.values(net.ch.presenceState()).map((a) => a[0]).filter((h) => h && h.id && h.id !== A.pid);
      khFresh(); showFresh();
      net.hall.forEach((h) => {
        const nick = String(h.nick || 'Кент').slice(0, 20);
        if (h.kh && h.kh.w === S.kolkhoz.w && +h.kh.n > 0) S.kolkhoz.others[h.id] = { nick, n: Math.min(KH_GOAL, Math.max((S.kolkhoz.others[h.id] || {}).n || 0, +h.kh.n)) };
        if (h.show && h.show.w === S.show.w && validItem(h.show.item)) S.show.seen[h.id] = { id: h.id, nick, item: h.show.item, score: Math.min(1000, +h.show.score || 0) };
      });
      D.save();
      if (['village', 'trade'].includes(D.tab)) D.renderPanel();
    });
    net.ch.on('broadcast', { event: 'vote' }, ({ payload }) => {
      if (payload.to !== A.pid || !S.show.item || S.show.votes[payload.from]) return;
      S.show.votes[payload.from] = 1;
      A.toast(`👍 ${nickOf(payload.from)} проголосовал за твой экспонат`);
      track(); D.save();
    });
    net.ch.on('broadcast', { event: 'offer' }, ({ payload: p }) => {
      if (p.to !== A.pid || !validItem(p.give) || !validItem(p.want)) return;
      incoming.push({ from: p.from, oid: String(p.oid).slice(0, 30), give: p.give, gn: Math.max(1, Math.floor(+p.gn || 1)), want: p.want, wn: Math.max(1, Math.floor(+p.wn || 1)), nick: String(p.nick || 'Кент').slice(0, 20), t: Date.now() });
      A.toast(`📨 ${String(p.nick || 'Кент').slice(0, 20)} предлагает обмен — вкладка «Обмен»`);
      if (A.note) A.note('dacha', '📨 Предложение обмена', `${p.nick}: ${D.itemName(p.give)} на ${D.itemName(p.want)}`);
      if (D.tab === 'trade') D.renderPanel();
    });
    net.ch.on('broadcast', { event: 'accepted' }, ({ payload: p }) => {
      const o = p.to === A.pid && S.offers[p.oid];
      if (!o || o.to !== p.from) return;
      D.addItem(o.want, o.wn);
      delete S.offers[p.oid];
      D.sfx.coin();
      A.toast(`🤝 Обмен состоялся: +${o.wn} ${D.itemName(o.want)}`);
      D.save(); D.render();
    });
    net.ch.on('broadcast', { event: 'declined' }, ({ payload: p }) => { if (p.to === A.pid && S.offers[p.oid]) refund(p.oid, `${nickOf(p.from)} отказался от обмена`); });
    net.ch.on('broadcast', { event: 'cancel' }, ({ payload: p }) => {
      if (p.to !== A.pid) return;
      const i = incoming.findIndex((o) => o.oid === p.oid && o.from === p.from);
      if (i >= 0) { incoming.splice(i, 1); if (D.tab === 'trade') D.renderPanel(); }
    });
    net.ch.subscribe((st) => { net.live = st === 'SUBSCRIBED'; if (net.live) track(); });
  }

  /* --- вкладки --- */
  H.tabs.push({
    id: 'village', label: 'Посёлок',
    render(P) {
      showFresh(); khFresh();
      const id = khItem(), total = khTotal(), done = total >= KH_GOAL;
      const board = showBoard();
      const candidates = Object.entries(S.inv).filter(([k, n]) => n > 0 && D.basePrice(k) > 0).sort((a, b) => RAR(b[0]) - RAR(a[0])).slice(0, 12);
      P.innerHTML = `
        <div class="dc-village"><b>🚜 Колхоз: план недели</b><small>Всем посёлком сдаём ${KH_GOAL} шт.: ${ART.item(id)} <b>${esc(crop(id).name)}</b>. Выполним — каждый, кто сдал, получит премию.</small>
          <span class="dc-medalbar big"><em style="width:${Math.min(100, (total / KH_GOAL) * 100)}%"></em></span>
          <small>${total} / ${KH_GOAL} · ты сдал ${S.kolkhoz.mine} · до конца недели ${fmtLeft(weekLeft())}</small>
          <div class="dc-row">${done ? (S.kolkhoz.claimed === S.kolkhoz.w ? '<span class="dc-note">✓ Премия получена</span>' : S.kolkhoz.mine ? '<button class="dc-btn dc-btn-main wide" data-khclaim="1">Получить премию</button>' : '<span class="dc-note">План выполнен без тебя 😅</span>')
            : `<button class="dc-btn" data-kh="10">Сдать 10</button><button class="dc-btn dc-btn-main" data-kh="9999">Сдать все (${S.inv[id] || 0})</button>`}</div>
          ${Object.values(S.kolkhoz.others).length ? `<small>Сдали: ${Object.values(S.kolkhoz.others).map((o) => `${esc(o.nick)} — ${o.n}`).join(', ')}</small>` : ''}</div>
        <div class="dc-village"><b>🏅 Выставка урожая</b><small>Раз в неделю. Выстави лучший экспонат — очки дают редкость (гиганты, мутации, гибриды) и голоса кентов (+20 за голос). Итоги через ${fmtLeft(weekLeft())}: 1 место — 500 000 ₽ и кубок (+2% к ценам навсегда).</small>
          ${S.show.item ? `<div class="dc-myentry">${ART.item(S.show.item)}<div><b>${esc(D.itemName(S.show.item))}</b><small>${myShowScore()} очков · голосов ${Object.keys(S.show.votes).length}</small></div></div>`
            : `<div class="dc-pick">${candidates.map(([k]) => `<button data-enter="${esc(k)}" title="${esc(D.itemName(k))} · ${RAR(k)} очков">${ART.item(k)}<small>${RAR(k)}</small></button>`).join('') || '<span class="dc-note">Амбар пуст</span>'}</div>`}
          <div class="dc-board">${board.map((r, i) => `<div class="${r.me ? 'me' : ''}"><em>${i + 1}</em>${r.item ? ART.item(r.item) : '<span class="dc-botava">🧺</span>'}<b>${esc(r.nick)}</b><span>${r.score}</span>
            ${!r.me && !r.bot ? `<button class="dc-mini ${S.show.voted[r.id] ? '' : 'dark'}" data-vote="${esc(r.id)}" ${S.show.voted[r.id] ? 'disabled' : ''}>${S.show.voted[r.id] ? '✓' : '👍'}</button>` : ''}</div>`).join('')}</div>
          ${S.trophies ? `<small>🏆 Твоих кубков: ${S.trophies}</small>` : ''}</div>`;
    },
  });
  H.tabs.push({
    id: 'trade', label: 'Обмен',
    render(P) {
      const inv = Object.entries(S.inv).filter(([k, n]) => n > 0 && validItem(k));
      const wants = [...D.CROPS.filter((c) => !c.hyb || S.hyb[c.id]).map((c) => c.id), ...Object.keys(D.GOODS)];
      const out = Object.entries(S.offers);
      P.innerHTML = `${!sb ? '<div class="dc-empty">Онлайн недоступен</div>' : ''}
        ${incoming.length ? `<span class="dc-cap">ВХОДЯЩИЕ</span>${incoming.map((o, i) => `<div class="dc-offer in"><div><b>${esc(o.nick)}</b><small>даёт ${o.gn} × ${esc(D.itemName(o.give))} · хочет ${o.wn} × ${esc(D.itemName(o.want))}</small></div>
          <span class="dc-shop-btns"><button class="dc-mini dark" data-acc="${i}">Принять</button><button class="dc-mini" data-dec="${i}">Нет</button></span></div>`).join('')}` : ''}
        ${out.length ? `<span class="dc-cap">ТВОИ ПРЕДЛОЖЕНИЯ</span>${out.map(([oid, o]) => `<div class="dc-offer"><div><b>${esc(nickOf(o.to))}</b><small>ты даёшь ${o.gn} × ${esc(D.itemName(o.give))} за ${o.wn} × ${esc(D.itemName(o.want))} · ${fmtLeft(o.t + OFFER_TTL - Date.now())}</small></div><button class="dc-mini" data-cancel="${oid}">Отменить</button></div>`).join('')}` : ''}
        <span class="dc-cap">НОВЫЙ ОБМЕН</span>
        ${net.hall.length ? `<div class="dc-tradeform">
          <label>Кому<select id="tr-to">${net.hall.map((h) => `<option value="${esc(h.id)}">${esc(String(h.nick || 'Кент').slice(0, 20))} · ур. ${+h.lvl || 1}</option>`).join('')}</select></label>
          <label>Отдаю<select id="tr-give">${inv.map(([k, n]) => `<option value="${esc(k)}">${esc(D.itemName(k))} (${n})</option>`).join('')}</select></label>
          <label>Сколько<input id="tr-gn" type="number" min="1" value="1"></label>
          <label>Хочу<select id="tr-want">${wants.map((k) => `<option value="${k}">${esc(D.itemName(k))}</option>`).join('')}</select></label>
          <label>Сколько<input id="tr-wn" type="number" min="1" value="1"></label>
          <button class="dc-btn dc-btn-main wide" data-propose="1" ${inv.length ? '' : 'disabled'}>Предложить</button></div>
          <div class="dc-note">Отданное держится у тебя «в залоге»: если кент не ответит за 15 минут или откажется — вернётся.</div>` : '<div class="dc-empty">Никого из кентов сейчас нет на даче</div>'}`;
    },
  });
  H.click.push((t) => {
    const g = (s) => t.closest(s);
    if (g('[data-kh]')) { contribute(+g('[data-kh]').dataset.kh); return true; }
    if (g('[data-khclaim]')) { khClaim(); return true; }
    if (g('[data-enter]')) { enterShow(g('[data-enter]').dataset.enter); return true; }
    if (g('[data-vote]')) {
      const id = g('[data-vote]').dataset.vote;
      if (!S.show.voted[id]) { S.show.voted[id] = 1; send('vote', { to: id }); D.sfx.pop(); A.toast('👍 Голос отдан'); D.save(); D.renderPanel(); }
      return true;
    }
    if (g('[data-propose]')) {
      const v = (id) => document.getElementById(id).value;
      propose(v('tr-to'), v('tr-give'), +v('tr-gn'), v('tr-want'), +v('tr-wn'));
      return true;
    }
    if (g('[data-acc]')) { accept(+g('[data-acc]').dataset.acc); return true; }
    if (g('[data-dec]')) { const i = +g('[data-dec]').dataset.dec, o = incoming[i]; if (o) { send('declined', { to: o.from, oid: o.oid }); incoming.splice(i, 1); D.renderPanel(); } return true; }
    if (g('[data-cancel]')) { const oid = g('[data-cancel]').dataset.cancel, o = S.offers[oid]; if (o) send('cancel', { to: o.to, oid }); refund(oid, 'Предложение отменено'); return true; }
    return false;
  });
  H.tick.push(() => {
    Object.entries(S.offers).forEach(([oid, o]) => { if (Date.now() - o.t > OFFER_TTL) refund(oid, 'Кент не ответил — вещи вернулись'); });
    if (S.show.w !== weekIdx() || S.kolkhoz.w !== weekIdx()) { showFresh(); khFresh(); track(); D.save(); }
  });
  H.buffs.push(() => (incoming.length ? [`<span class="dc-buff hot" data-tradetab="1">📨 предложений обмена: ${incoming.length}</span>`] : []));
  H.click.push((t) => { if (t.closest('[data-tradetab]')) { D.setTab('trade'); return true; } return false; });
  join();
})();
