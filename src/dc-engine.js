// «Ночной дата-центр» — движок. Состояние комнаты считает только ведущий (хост), остальные шлют ему намерения
(function () {
  const D = window.DCData;
  const { LOCS, HW, UPG, DEF, ITEMS, R, RAR, EVENTS, OC, COMBO, TREE, ACH } = D;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const B = (p) => `<b>${esc(p.nick)}</b>`;

  function fmt(n) {
    n = Number(n) || 0;
    const neg = n < 0; n = Math.abs(n);
    const U = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
    let i = 0;
    while (n >= 1000 && i < U.length - 1) { n /= 1000; i++; }
    const s = i === 0 ? (n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString()) : n.toFixed(n < 10 ? 2 : n < 100 ? 1 : 0);
    return (neg ? '−' : '') + s + U[i];
  }

  // исходящие личные сообщения игрокам (тосты, вирусы, дропы) — сеть забирает через drain()
  let outbox = [];
  const pm = (to, kind, data = {}) => outbox.push({ to, kind, ...data });
  const drain = () => { const o = outbox; outbox = []; return o; };

  function feed(s, txt, k = '') {
    s.feed.unshift({ t: Date.now(), txt, k });
    if (s.feed.length > 60) s.feed.length = 60;
  }

  /* ---------------- создание ---------------- */
  function newRoom(code, hours, now = Date.now()) {
    return {
      v: 1, code, created: now, end: now + hours * 3600e3, over: false, ver: 0, now,
      players: {}, feed: [], boss: null, nextBoss: now + D.BOSS_FIRST, bossN: 0,
      event: null, nextEvent: now + rnd(150e3, 270e3), lastEv: '',
      bm: { w: -1, items: [] }, market: [], bounty: {}, orbit: null, viruses: {}, firsts: {}, idc: 1, awards: null,
    };
  }

  function newPlayer(id, nick) {
    return {
      id, nick, cr: 0, run: 0, score: 0, loc: 0, hw: {}, up: [], def: {}, tree: [], cores: 0, coresAll: 0,
      heat: 0, streak: 0, lastClk: 0, down: 0, ddos: 0, shield: 0, lastHit: 0, oc: 0, items: [], eq: [],
      cd: {}, ach: [], targets: [], ct: null, ctAt: 0, on: true, joined: Date.now(), cw: 0, cwN: 0,
      st: { clicks: 0, earned: 0, stolen: 0, lost: 0, robbed: 0, attacks: 0, atkOk: 0, boss: 0, cases: 0, spent: 0, overheats: 0, reboots: 0, breaks: 0 },
    };
  }

  function ensurePlayer(s, id, nick) {
    let p = s.players[id];
    if (!p) {
      p = s.players[id] = newPlayer(id, nick);
      feed(s, `🔌 ${B(p)} подключил свою ноду`, 'sys');
      assignContract(s, p, Date.now());
    }
    if (nick && p.nick !== nick) p.nick = nick.slice(0, 20);
    return p;
  }

  /* ---------------- расчёт показателей ---------------- */
  const has = (p, id) => p.tree.includes(id);
  const evOf = (s, now) => (s.event && now < s.event.until ? EVENTS.find((e) => e.id === s.event.id) : null);

  function itemBonus(p) {
    const b = { inc: 0, click: 0, boss: 0, steal: 0, hit: 0, def: 0, prot: 0, cool: 0, luck: 0 };
    p.eq.forEach((u) => {
      const it = p.items.find((i) => i.u === u);
      const t = it && ITEMS[it.k];
      if (t) for (const k in t.b) b[k] += t.b[k];
    });
    return b;
  }

  function calc(p, s, now = Date.now()) {
    const b = itemBonus(p);
    const evRaw = evOf(s, now);
    const ev = evRaw && !(evRaw.bad && has(p, 'd4')) ? evRaw : {};
    let base = 0;
    HW.forEach((h) => { const n = p.hw[h.id] || 0; if (n) base += n * h.rate * (p.up.includes('x2_' + h.id) ? 2 : 1); });
    let incUp = 0, clickMul = 1, macro = 0, coolUp = 0;
    p.up.forEach((id) => {
      const u = UPG.find((x) => x.id === id);
      if (!u) return;
      if (u.k === 'inc') incUp += u.v;
      if (u.k === 'click') clickMul *= u.v;
      if (u.k === 'macro') macro += u.v;
      if (u.k === 'cool') coolUp += u.v;
    });
    const incMul = (1 + incUp) * (1 + b.inc) * (1 + 0.04 * p.coresAll) * (1 + 0.01 * p.ach.length) * (has(p, 'f1') ? 1.2 : 1) * (has(p, 'f5') ? 2 : 1);
    const stable = base * incMul * OC[p.oc].mul;
    const orbit = s.orbit && now < s.orbit.until ? (s.orbit.by === p.id ? 2 : 1.25) : 1;
    const temp = (ev.inc || 1) * orbit * (now < p.down ? 0.2 : 1) * (now < p.ddos ? 0.5 : 1);
    const click = (1 + stable * macro) * clickMul * (1 + b.click) * (has(p, 'f2') ? 1.5 : 1) * (ev.click || 1);
    const def = (id) => p.def[id] || 0;
    return {
      base, stable, inc: stable * temp, click, macro,
      cool: 4 + coolUp + b.cool,
      heatGain: OC[p.oc].heat * (ev.heat || 1),
      block: clamp(def('fw') * 0.08 + b.def + (has(p, 'd1') ? 0.1 : 0), 0, 0.65),
      proxy: Math.min(0.6, def('px') * 0.12),
      ddosRed: def('ad') * 0.18,
      prot: Math.min(0.8, def('bk') * 0.1 + b.prot),
      steal: 0.03 + b.steal + (has(p, 'a2') ? 0.02 : 0),
      hit: 0.7 + b.hit + (has(p, 'a3') ? 0.15 : 0),
      cd: D.ATK_CD * (has(p, 'a1') ? 0.75 : 1),
      slots: 2 + (p.loc >= 1) + (p.loc >= 4),
      comboCap: p.loc >= 1 ? (has(p, 'f4') ? 15 : 10) : 2,
      bossMul: (1 + b.boss) * (has(p, 'a4') ? 2 : 1) * (ev.boss || 1),
      luck: (1 + b.luck) * (ev.luck || 1),
      hwDisc: (has(p, 'f3') ? 0.9 : 1) * (ev.hwMul || 1),
      casePrice: Math.max(300, Math.round(stable * 90 + click * 40)),
      ev: evRaw,
    };
  }

  function comboMul(p, cap) {
    let m = 1;
    COMBO.forEach(([n, x]) => { if (p.streak >= n && x <= cap) m = x; });
    return m;
  }
  const nextCombo = (p, cap) => COMBO.find(([n, x]) => x <= cap && p.streak < n);

  const hwCost = (p, h, c, k = 0) => Math.ceil(h.cost * Math.pow(D.HW_GROWTH, (p.hw[h.id] || 0) + k) * c.hwDisc);
  const defCost = (p, d) => Math.ceil(d.cost * Math.pow(D.DEF_GROWTH, p.def[d.id] || 0));
  const rebootGain = (p) => Math.floor(Math.sqrt(p.run / 1e6));

  /* ---------------- деньги ---------------- */
  function earn(s, p, amt, kind = 'earn') {
    if (!(amt > 0)) return;
    p.cr += amt; p.run += amt; p.score += amt; p.st.earned += amt;
    if (p.ct && p.ct.type === 'earn') p.ct.prog += amt;
  }
  function spend(p, amt) {
    if (!(amt >= 0) || p.cr < amt) return false;
    p.cr -= amt; p.st.spent += amt;
    return true;
  }

  /* ---------------- предметы ---------------- */
  function rollItem(s, luck = 1, minR = 0) {
    const w = RAR.map((r, i) => (i < minR ? 0 : R[r].w * Math.pow(luck, i * 0.7)));
    let x = Math.random() * w.reduce((a, b) => a + b, 0), ri = 0;
    while (x > w[ri] && ri < w.length - 1) { x -= w[ri]; ri++; }
    const keys = Object.keys(ITEMS).filter((k) => ITEMS[k].r === RAR[ri]);
    return { u: s.idc++, k: pick(keys) };
  }

  function giveItem(s, p, it, src) {
    const t = ITEMS[it.k];
    if (p.items.length >= 40) {
      // склад забит — сразу продаём
      const c = calc(p, s);
      earn(s, p, Math.round(c.casePrice * R[t.r].mul * 0.35));
      pm(p.id, 'note', { txt: `Склад полон — ${t.n} продан автоматически` });
      return;
    }
    p.items.push(it);
    if (p.eq.length < calc(p, s).slots) p.eq.push(it.u);
    pm(p.id, 'drop', { item: it, src });
    if (t.r === 'p') {
      feed(s, `🚨 ${B(p)} выбил <i class="r-p">${esc(t.n)}</i> — шанс 0.2%!!!`, 'proto');
      unlock(s, p, 'proto');
    } else if (t.r === 'l') {
      feed(s, `✨ ${B(p)} выбил легендарку <i class="r-l">${esc(t.n)}</i>`, 'loot');
      unlock(s, p, 'legend');
    } else if (t.r === 'e') feed(s, `🎁 ${B(p)} выбил <i class="r-e">${esc(t.n)}</i>`, 'loot');
  }

  /* ---------------- ачивки ---------------- */
  function unlock(s, p, id) {
    if (p.ach.includes(id) || !ACH[id]) return;
    p.ach.push(id);
    feed(s, `🏆 ${B(p)} получил ачивку «${ACH[id][0]}»`, 'ach');
    pm(p.id, 'ach', { id });
  }
  function checkAch(s, p) {
    if (p.st.clicks >= 1) unlock(s, p, 'click1');
    if (p.st.clicks >= 1000) unlock(s, p, 'click1k');
    if (p.st.clicks >= 10000) unlock(s, p, 'click10k');
    if (p.st.overheats >= 5) unlock(s, p, 'hot');
    if (p.st.stolen >= 1e6) unlock(s, p, 'robin');
    if (p.st.robbed >= 10) unlock(s, p, 'victim');
    if (p.score >= 1e9) unlock(s, p, 'billion');
    const others = Object.keys(s.players).filter((id) => id !== p.id);
    if (others.length >= 2 && others.every((id) => p.targets.includes(id))) unlock(s, p, 'traitor');
  }

  /* ---------------- контракты ---------------- */
  function assignContract(s, p, now) {
    const c = calc(p, s, now);
    const inc = Math.max(c.stable, 2);
    const types = [
      { type: 'earn', goal: Math.max(500, Math.round(inc * 300 * 1.3)), txt: (g) => `Заработай ${fmt(g)} за 5 минут` },
      { type: 'clicks', goal: 300, txt: (g) => `Сделай ${g} кликов` },
      { type: 'hw', goal: 10, txt: (g) => `Купи ${g} единиц железа` },
    ];
    if (p.loc >= 1) types.push({ type: 'cases', goal: 2, txt: (g) => `Открой ${g} кейса` });
    if (p.loc >= 2 && Object.keys(s.players).length > 1) types.push({ type: 'steal', goal: 2, txt: (g) => `Успешно атакуй ${g} раза` });
    if (s.boss) types.push({ type: 'boss', goal: Math.round(c.click * 150), txt: (g) => `Нанеси боссу ${fmt(g)} урона` });
    const t = pick(types);
    p.ct = { type: t.type, goal: t.goal, prog: 0, txt: t.txt(t.goal), until: now + (t.type === 'steal' ? 480e3 : 300e3), rew: Math.max(800, Math.round(inc * 150 + c.click * 60)) };
  }
  function ctAdd(p, type, n) { if (p.ct && p.ct.type === type) p.ct.prog += n; }
  function ctCheck(s, p, now) {
    if (!p.ct) { if (now > p.ctAt) assignContract(s, p, now); return; }
    if (p.ct.prog >= p.ct.goal) {
      earn(s, p, p.ct.rew);
      feed(s, `📋 ${B(p)} закрыл контракт и забрал ${fmt(p.ct.rew)}`, 'ct');
      giveItem(s, p, rollItem(s, calc(p, s, now).luck), 'Контракт');
      pm(p.id, 'note', { txt: `Контракт выполнен: +${fmt(p.ct.rew)} и кейс` });
      p.ct = null; p.ctAt = now + 15e3;
    } else if (now > p.ct.until) {
      pm(p.id, 'note', { txt: 'Контракт провален — время вышло' });
      p.ct = null; p.ctAt = now + 15e3;
    }
  }

  /* ---------------- перегрев ---------------- */
  function overheat(s, p, now) {
    p.down = now + 15e3; p.heat = 55; p.streak = 0; p.st.overheats++;
    feed(s, `🔥 ${B(p)} перегрел сервер 💀`, 'bad');
    pm(p.id, 'overheat');
  }

  /* ---------------- тик ведущего ---------------- */
  function tick(s, now = Date.now()) {
    if (s.over) return;
    const dt = Math.min(5, Math.max(0, (now - (s.now || now)) / 1000));
    s.now = now;
    if (now >= s.end) return finish(s);
    const list = Object.values(s.players);
    const doBreak = Math.floor(now / 10e3) !== Math.floor((now - dt * 1000) / 10e3);

    list.forEach((p) => {
      const c = calc(p, s, now);
      earn(s, p, c.inc * dt * (p.on ? 1 : 0.5));
      if (now > p.down) {
        p.heat = Math.max(0, p.heat + (c.heatGain - c.cool) * dt);
        if (p.heat >= 100) overheat(s, p, now);
      }
      if (now - p.lastClk > 1200) p.streak = 0;
      if (doBreak && p.oc > 0 && p.on && Math.random() < OC[p.oc].brk) breakHw(s, p);
      if (s.boss && p.on) bossHit(s, p, c.inc * 0.25 * c.bossMul, true);
      ctCheck(s, p, now);
      checkAch(s, p);
    });

    // босс
    if (!s.boss && now >= s.nextBoss) spawnBoss(s, now);
    if (s.boss && now >= s.boss.until) endBoss(s, false, now);

    // события
    if (s.event && now >= s.event.until) { feed(s, `${EVENTS.find((e) => e.id === s.event.id).icon} Событие закончилось`, 'sys'); s.event = null; }
    if (!s.event && now >= s.nextEvent) startEvent(s, now);

    // чёрный рынок — новый ассортимент каждые 10 минут
    const w = Math.floor((now - s.created) / 600e3);
    if (s.bm.w !== w) refreshBm(s, w);

    // зависшие вирусы — не ответил вовремя, значит не почистил
    Object.entries(s.viruses).forEach(([vid, v]) => { if (now > v.until) virusResult(s, vid, false); });
    if (s.orbit && now > s.orbit.until) s.orbit = null;
  }

  function breakHw(s, p) {
    const h = [...HW].reverse().find((x) => (p.hw[x.id] || 0) > 0);
    if (!h) return;
    const lost = Math.max(1, Math.ceil(p.hw[h.id] * 0.1));
    p.hw[h.id] -= lost; p.st.breaks++;
    feed(s, `💥 ${B(p)} спалил разгоном ${lost}× ${esc(h.name)}`, 'bad');
    pm(p.id, 'note', { txt: `💥 Разгон спалил ${lost}× ${h.name}` });
    unlock(s, p, 'burnt');
  }

  function startEvent(s, now) {
    const pool = EVENTS.filter((e) => e.id !== s.lastEv);
    const e = pick(pool);
    s.event = { id: e.id, until: now + D.EVENT_LEN };
    s.lastEv = e.id;
    s.nextEvent = now + D.EVENT_LEN + rnd(180e3, 360e3);
    feed(s, `${e.icon} <b>${esc(e.name)}</b> — ${esc(e.d)}`, e.bad ? 'evbad' : 'ev');
    if (e.airdrop) Object.values(s.players).forEach((p) => earn(s, p, calc(p, s, now).stable * e.airdrop));
  }

  function refreshBm(s, w) {
    const ps = Object.values(s.players);
    const avg = ps.length ? ps.reduce((a, p) => a + calc(p, s).stable, 0) / ps.length : 10;
    const items = [0, 1, 2].map(() => {
      const it = rollItem(s, 1, Math.random() < 0.04 ? 4 : Math.random() < 0.3 ? 3 : 2);
      return { item: it, price: Math.round(Math.max(2e4, avg * 25) * R[ITEMS[it.k].r].mul / 100) * 100, sold: null };
    });
    s.bm = { w, items };
    if (w > 0) feed(s, '🕶 На чёрном рынке новый товар', 'sys');
  }

  /* ---------------- босс ---------------- */
  function spawnBoss(s, now) {
    const on = Object.values(s.players).filter((p) => p.on);
    const hp = Math.max(1500, on.reduce((a, p) => { const c = calc(p, s, now); return a + c.click * 200 + c.stable * 40; }, 0));
    s.bossN++;
    s.boss = { name: D.BOSSES[(s.bossN - 1) % D.BOSSES.length], hp, max: hp, until: now + D.BOSS_LEN, dmg: {} };
    s.nextBoss = now + D.BOSS_EVERY;
    feed(s, `☠ Появился <b>${esc(s.boss.name)}</b>! Все на рейд — 2.5 минуты`, 'boss');
    pm('*', 'boss');
  }
  function bossHit(s, p, dmg, passive) {
    const b = s.boss;
    if (!b || !(dmg > 0)) return;
    b.hp -= dmg;
    b.dmg[p.id] = (b.dmg[p.id] || 0) + dmg;
    p.st.boss += dmg;
    ctAdd(p, 'boss', dmg);
    if (!passive && !b.started) { b.started = true; feed(s, `⚔ ${B(p)} начал рейд на босса`, 'boss'); }
    if (b.hp <= 0) endBoss(s, true, Date.now());
  }
  function endBoss(s, win, now) {
    const b = s.boss;
    s.boss = null;
    if (!win) { feed(s, `🏃 <b>${esc(b.name)}</b> ушёл в оффлайн. Не дожали`, 'bad'); return; }
    const top = Object.entries(b.dmg).sort((x, y) => y[1] - x[1]);
    feed(s, `🏆 <b>${esc(b.name)}</b> повержен! Лут всем участникам`, 'boss');
    top.forEach(([id, d], i) => {
      const p = s.players[id];
      if (!p || d <= 0) return;
      const c = calc(p, s, now);
      const loot = Math.round(c.stable * 180 + c.click * 80);
      earn(s, p, loot);
      giveItem(s, p, rollItem(s, c.luck * (i === 0 ? 3 : 1.3), i === 0 ? 2 : 0), i === 0 ? 'Сундук MVP' : 'Лут с босса');
      pm(p.id, 'note', { txt: `Босс повержен: +${fmt(loot)}${i === 0 ? ' и сундук MVP' : ''}` });
      if (i === 0) { feed(s, `🥇 ${B(p)} — MVP рейда, ${fmt(d)} урона`, 'boss'); unlock(s, p, 'boss'); }
    });
  }

  /* ---------------- вирусы ---------------- */
  function virusResult(s, vid, ok) {
    const v = s.viruses[vid];
    if (!v) return;
    delete s.viruses[vid];
    const a = s.players[v.from], t = s.players[v.to];
    if (!a || !t) return;
    if (ok) { feed(s, `🧼 ${B(t)} вычистил вирус от ${B(a)}`, 'def'); return; }
    const c = calc(t, s);
    const amt = Math.floor(t.cr * (1 - c.prot) * 0.05 * (1 - c.proxy));
    transfer(s, a, t, amt);
    feed(s, `🦠 Вирус ${B(a)} съел у ${B(t)} ${fmt(amt)}`, 'atk');
    claimBounty(s, a, t);
  }

  function transfer(s, a, t, amt) {
    amt = Math.max(0, Math.floor(Math.min(amt, t.cr)));
    t.cr -= amt; t.score -= amt; t.st.lost += amt; t.st.robbed++;
    a.cr += amt; a.score += amt; a.st.stolen += amt; a.st.atkOk++;
    ctAdd(a, 'steal', 1);
    t.lastHit = Date.now();
    if (has(t, 'd2')) t.shield = Date.now() + 90e3;
    pm(t.id, 'hit', { txt: `${a.nick} утащил у тебя ${fmt(amt)}` });
    return amt;
  }

  function claimBounty(s, a, t) {
    const b = s.bounty[t.id];
    if (!b) return;
    delete s.bounty[t.id];
    a.cr += b.pool; a.score += b.pool;
    feed(s, `💀 ${B(a)} забрал bounty за ${B(t)}: ${fmt(b.pool)}`, 'atk');
    unlock(s, a, 'hunter');
  }

  /* ---------------- действия игроков ---------------- */
  const err = (p, txt) => { pm(p.id, 'err', { txt }); return false; };

  function act(s, pid, m, now = Date.now()) {
    if (s.over) return false;
    const p = s.players[pid];
    if (!p) return false;
    const c = calc(p, s, now);
    const r = ACTS[m.a] ? ACTS[m.a](s, p, m, c, now) : false;
    checkAch(s, p);
    return r !== false;
  }

  const ACTS = {
    click(s, p, m, c, now) {
      // антиспам: не больше ~22 кликов в секунду
      const sec = Math.floor(now / 1000);
      if (p.cw !== sec) { p.cw = sec; p.cwN = 0; }
      const n = clamp(Math.floor(m.n) || 0, 0, 25 - p.cwN);
      if (n <= 0 || now < p.down || now < p.ddos) return false;
      p.cwN += n;
      p.streak = now - p.lastClk < 1200 ? p.streak + n : n;
      p.lastClk = now;
      const mul = comboMul(p, c.comboCap);
      if (mul >= 10) unlock(s, p, 'combo10');
      p.st.clicks += n;
      ctAdd(p, 'clicks', n);
      const ev = c.ev && !(c.ev.bad && has(p, 'd4')) ? c.ev : {};
      p.heat += n * (mul >= 5 ? 0.55 : 0.3) * (ev.heat || 1);
      if (m.boss && s.boss) bossHit(s, p, c.click * c.bossMul * n * Math.sqrt(mul), false);
      else earn(s, p, c.click * mul * n);
      if (p.heat >= 100) overheat(s, p, now);
    },
    hw(s, p, m, c) {
      const h = HW.find((x) => x.id === m.id);
      if (!h || p.loc < h.loc) return false;
      let bought = 0;
      const want = m.n === 'max' ? 1e4 : clamp(m.n | 0, 1, 100);
      while (bought < want) {
        const cost = hwCost(p, h, c);
        if (!spend(p, cost)) break;
        p.hw[h.id] = (p.hw[h.id] || 0) + 1;
        bought++;
      }
      if (!bought) return err(p, 'Не хватает кредитов');
      ctAdd(p, 'hw', bought);
      if (h.id === 'qubit' && !s.firsts.qubit) { s.firsts.qubit = p.id; feed(s, `💎 ${B(p)} первым купил ${esc(h.name)}`, 'loot'); }
    },
    up(s, p, m) {
      const u = UPG.find((x) => x.id === m.id);
      if (!u || p.up.includes(u.id) || p.loc < u.loc) return false;
      if (u.need && (p.hw[u.hw] || 0) < u.need) return err(p, `Нужно ${u.need} шт.`);
      if (!spend(p, u.cost)) return err(p, 'Не хватает кредитов');
      p.up.push(u.id);
    },
    def(s, p, m) {
      const d = DEF.find((x) => x.id === m.id);
      if (!d || p.loc < 2 || (p.def[d.id] || 0) >= d.max) return false;
      if (!spend(p, defCost(p, d))) return err(p, 'Не хватает кредитов');
      p.def[d.id] = (p.def[d.id] || 0) + 1;
    },
    loc(s, p) {
      const L = LOCS[p.loc + 1];
      if (!L) return false;
      if (!spend(p, L.cost)) return err(p, 'Не хватает на переезд');
      p.loc++;
      feed(s, `${L.icon} ${B(p)} переехал: <b>${esc(L.name)}</b>`, 'loc');
      if (p.loc === LOCS.length - 1 && !s.firsts.quantum) { s.firsts.quantum = p.id; unlock(s, p, 'major'); }
    },
    oc(s, p, m) {
      if (p.loc < 3) return false;
      p.oc = clamp(m.lvl | 0, 0, OC.length - 1);
      if (p.oc === 3) feed(s, `🌡 ${B(p)} выкрутил разгон на «Безумие»`, 'bad');
    },
    atk(s, p, m, c, now) {
      const t = s.players[m.t];
      const kind = m.kind;
      if (!t || t.id === p.id || !D.ATK.some((x) => x.id === kind)) return false;
      if (p.loc < 2) return err(p, 'Атаки открываются в Серверной');
      if (t.loc < 2) return err(p, `${t.nick} ещё новичок — под защитой до Серверной`);
      if (now < (p.cd.atk || 0)) return err(p, 'Атака перезаряжается');
      if (c.ev && c.ev.noAtk) return err(p, 'Маски-шоу: сейчас атаковать нельзя');
      if (now < t.shield) return err(p, `${t.nick} под щитом`);
      if (now - t.lastHit < 45e3) return err(p, `${t.nick} только что ограбили — дай отдышаться`);
      if (kind !== 'hack' && !t.on) return err(p, 'DDoS и вирус — только по тем, кто в сети');
      const ct = calc(t, s, now);
      p.cd.atk = now + c.cd;
      p.st.attacks++;
      if (!p.targets.includes(t.id)) p.targets.push(t.id);
      const sure = c.ev && c.ev.sureHit;
      const chance = sure ? 1 : clamp(c.hit - ct.block, 0.1, 0.95);
      const blocked = Math.random() > chance || (kind === 'ddos' && has(t, 'd5'));
      if (blocked) {
        feed(s, `🛡 ${B(t)} отбил ${D.ATK.find((x) => x.id === kind).name.toLowerCase()} от ${B(p)}`, 'def');
        pm(p.id, 'err', { txt: `${t.nick} отбил атаку` });
        pm(t.id, 'note', { txt: `🛡 Ты отбил атаку ${p.nick}` });
        if (has(t, 'd3')) { const fine = Math.floor(p.cr * 0.02); p.cr -= fine; t.cr += fine; t.score += fine; p.score -= fine; }
        return;
      }
      if (kind === 'hack') {
        let pct = c.steal * (has(p, 'a5') ? 2 : 1) * (1 - (has(p, 'a5') ? 0 : ct.proxy));
        if (has(t, 'd5')) pct = Math.min(pct, 0.01);
        const amt = transfer(s, p, t, t.cr * (1 - ct.prot) * pct);
        feed(s, `🔓 ${B(p)} взломал ${B(t)} и украл ${fmt(amt)}`, 'atk');
        pm(p.id, 'note', { txt: `🔓 Украдено ${fmt(amt)} у ${t.nick}` });
        claimBounty(s, p, t);
      } else if (kind === 'ddos') {
        t.ddos = now + 25e3 * (1 - ct.ddosRed);
        p.st.atkOk++; ctAdd(p, 'steal', 1);
        feed(s, `🌊 ${B(p)} положил DDoS-ом сервер ${B(t)}`, 'atk');
        pm(t.id, 'hit', { txt: `${p.nick} заDDoSил тебя — клики не работают` });
      } else {
        const vid = String(s.idc++);
        const dur = Math.round(8000 * (1 - ct.ddosRed * 0.5));
        s.viruses[vid] = { from: p.id, to: t.id, until: now + dur + 5000 };
        p.st.atkOk++; ctAdd(p, 'steal', 1);
        feed(s, `🦠 ${B(p)} закинул вирус ${B(t)}`, 'atk');
        pm(t.id, 'virus', { vid, nick: p.nick, dur });
      }
    },
    vres(s, p, m) {
      const v = s.viruses[m.vid];
      if (!v || v.to !== p.id) return false;
      virusResult(s, m.vid, !!m.ok);
    },
    bounty(s, p, m) {
      const t = s.players[m.t];
      const amt = Math.floor(m.amt);
      if (!t || t.id === p.id || !(amt >= 1000)) return err(p, 'Минимум 1K');
      if (p.loc < 2) return err(p, 'Bounty открывается в Серверной');
      if (!spend(p, amt)) return err(p, 'Не хватает кредитов');
      const b = s.bounty[t.id] || (s.bounty[t.id] = { pool: 0, n: 0 });
      b.pool += amt; b.n++;
      feed(s, `🎯 ${B(p)} объявил bounty на ${B(t)}: ${fmt(amt)} (всего ${fmt(b.pool)})`, 'atk');
      pm(t.id, 'hit', { txt: `На тебя объявили bounty ${fmt(b.pool)}` });
    },
    case(s, p, m, c) {
      if (p.loc < 1) return err(p, 'Кейсы открываются в Гараже');
      if (!spend(p, c.casePrice)) return err(p, 'Не хватает кредитов');
      p.st.cases++;
      ctAdd(p, 'cases', 1);
      giveItem(s, p, rollItem(s, c.luck), 'Кейс');
    },
    eq(s, p, m, c) {
      if (!p.items.some((i) => i.u === m.u) || p.eq.includes(m.u)) return false;
      if (p.eq.length >= c.slots) return err(p, 'Все слоты заняты');
      p.eq.push(m.u);
    },
    uneq(s, p, m) { p.eq = p.eq.filter((u) => u !== m.u); },
    sell(s, p, m, c) {
      const it = p.items.find((i) => i.u === m.u);
      if (!it) return false;
      p.items = p.items.filter((i) => i !== it);
      p.eq = p.eq.filter((u) => u !== it.u);
      const v = Math.round(c.casePrice * R[ITEMS[it.k].r].mul * 0.35);
      earn(s, p, v);
      pm(p.id, 'note', { txt: `Продано за ${fmt(v)}` });
    },
    list(s, p, m) {
      const it = p.items.find((i) => i.u === m.u);
      const price = Math.floor(m.price);
      if (!it || !(price >= 100)) return err(p, 'Укажи цену от 100');
      if (s.market.filter((l) => l.seller === p.id).length >= 6) return err(p, 'Максимум 6 лотов');
      p.items = p.items.filter((i) => i !== it);
      p.eq = p.eq.filter((u) => u !== it.u);
      const to = m.to && s.players[m.to] ? m.to : null;
      s.market.unshift({ id: s.idc++, seller: p.id, item: it, price, to });
      const t = ITEMS[it.k];
      feed(s, to
        ? `🤝 ${B(p)} предлагает ${B(s.players[to])}: <i class="r-${t.r}">${esc(t.n)}</i> за ${fmt(price)}`
        : `🏷 ${B(p)} выставил <i class="r-${t.r}">${esc(t.n)}</i> за ${fmt(price)}`, 'mk');
      if (to) pm(to, 'note', { txt: `${p.nick} предлагает тебе сделку — загляни в Рынок` });
    },
    unlist(s, p, m) {
      const l = s.market.find((x) => x.id === m.id && x.seller === p.id);
      if (!l) return false;
      s.market = s.market.filter((x) => x !== l);
      p.items.push(l.item);
    },
    buylot(s, p, m) {
      const l = s.market.find((x) => x.id === m.id);
      if (!l || l.seller === p.id) return false;
      if (l.to && l.to !== p.id) return err(p, 'Это личное предложение не тебе');
      if (p.items.length >= 40) return err(p, 'Склад полон');
      if (!spend(p, l.price)) return err(p, 'Не хватает кредитов');
      s.market = s.market.filter((x) => x !== l);
      p.items.push(l.item);
      const sel = s.players[l.seller];
      if (sel) { const v = Math.floor(l.price * 0.95); sel.cr += v; sel.score += v; unlock(s, sel, 'trader'); pm(sel.id, 'note', { txt: `${p.nick} купил твой лот: +${fmt(v)}` }); }
      const t = ITEMS[l.item.k];
      feed(s, `💸 ${B(p)} купил <i class="r-${t.r}">${esc(t.n)}</i> у ${sel ? B(sel) : '?'} за ${fmt(l.price)}`, 'mk');
    },
    bm(s, p, m) {
      if (p.loc < 4) return err(p, 'Чёрный рынок — с Корпорации');
      const x = s.bm.items[m.i];
      if (!x || x.sold) return err(p, 'Уже купили');
      if (p.items.length >= 40) return err(p, 'Склад полон');
      if (!spend(p, x.price)) return err(p, 'Не хватает кредитов');
      x.sold = p.nick;
      const it = { ...x.item, u: s.idc++ };
      p.items.push(it);
      if (p.eq.length < calc(p, s).slots) p.eq.push(it.u);
      feed(s, `🕶 ${B(p)} купил на чёрном рынке <i class="r-${ITEMS[it.k].r}">${esc(ITEMS[it.k].n)}</i>`, 'loot');
    },
    tree(s, p, m) {
      for (const br of Object.values(TREE)) {
        const i = br.nodes.findIndex((n) => n.id === m.id);
        if (i < 0) continue;
        const n = br.nodes[i];
        if (has(p, n.id)) return false;
        if (i > 0 && !has(p, br.nodes[i - 1].id)) return err(p, 'Сначала прошлый узел ветки');
        if (i >= 3 && p.loc < 5) return err(p, 'Нужны исследования — Подземный ДЦ');
        if (p.cores < n.c) return err(p, 'Не хватает ядер');
        p.cores -= n.c;
        p.tree.push(n.id);
        feed(s, `🌳 ${B(p)} прокачал ${br.name}: «${esc(n.name)}»`, 'sys');
        return;
      }
      return false;
    },
    reboot(s, p, m, c, now) {
      const g = rebootGain(p);
      if (p.loc < 3 || g < 1) return err(p, 'Reboot доступен с Датацентра и 1 ядра');
      p.cores += g; p.coresAll += g; p.st.reboots++;
      Object.assign(p, { cr: 0, run: 0, hw: {}, up: [], def: {}, loc: 0, oc: 0, heat: 0, streak: 0, down: 0 });
      feed(s, `♻ ${B(p)} сделал Reboot и получил ${g} ядер`, 'loc');
      unlock(s, p, 'reboot');
      pm(p.id, 'reboot', { g });
    },
    orbit(s, p, m, c, now) {
      if (p.loc < 6) return false;
      if (now < (p.cd.orb || 0)) return err(p, 'Спутник ещё перезаряжается');
      p.cd.orb = now + 600e3;
      s.orbit = { until: now + 120e3, by: p.id, nick: p.nick };
      feed(s, `🛰 ${B(p)} включил орбитальный бафф: всем +25% на 2 минуты, себе ×2`, 'ev');
    },
    qc(s, p, m, c, now) {
      if (p.loc < 7) return false;
      if (now < (p.cd.qc || 0)) return err(p, 'Волновая функция ещё не восстановилась');
      p.cd.qc = now + 300e3;
      unlock(s, p, 'shrodi');
      const was = p.cr;
      if (Math.random() < 0.55) { earn(s, p, was); feed(s, `⚛ ${B(p)} схлопнул волновую функцию: кредиты ×2 (+${fmt(was)})`, 'loot'); pm(p.id, 'note', { txt: `⚛ ×2! +${fmt(was)}` }); }
      else { p.cr = was / 2; p.score -= was / 2; feed(s, `⚛ ${B(p)} схлопнул волновую функцию и потерял половину 💀`, 'bad'); pm(p.id, 'err', { txt: '⚛ Кот мёртв. −50%' }); }
    },
  };

  /* ---------------- финал ---------------- */
  function finish(s) {
    s.over = true;
    const ps = Object.values(s.players);
    s.awards = D.AWARDS.map((a) => {
      const best = ps.slice().sort((x, y) => a.key(y) - a.key(x))[0];
      return best && a.key(best) > 0 ? { id: a.id, pid: best.id, nick: best.nick, v: a.key(best) } : null;
    }).filter(Boolean);
    feed(s, '🌅 Утро. Сервер заморожен — итоги ночи', 'sys');
  }

  // догоняем время, пока в комнате никого не было: половина дохода, максимум за 30 минут
  function catchUp(s, now = Date.now()) {
    const gap = Math.min(1800, Math.max(0, (now - (s.now || now)) / 1000));
    if (gap > 5 && !s.over) Object.values(s.players).forEach((p) => earn(s, p, calc(p, s, now).inc * gap * 0.5));
    s.now = now;
  }

  window.DCEngine = { fmt, esc, newRoom, ensurePlayer, calc, comboMul, nextCombo, hwCost, defCost, rebootGain, tick, act, drain, catchUp, itemBonus };
})();
