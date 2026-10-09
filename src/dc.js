// «Ночной дата-центр» — сеть (Supabase Realtime) и интерфейс
(function () {
  const D = window.DCData, E = window.DCEngine, A = window.QBApp;
  if (!D || !E || !A) return;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const { fmt, esc } = E;
  const me = A.pid;
  const root = $('#dc');

  const sb = window.supabase && window.QB_ONLINE
    ? window.supabase.createClient(window.QB_ONLINE.url, window.QB_ONLINE.key, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 30 } } })
    : null;

  /* ================= сеть ================= */
  const net = { ch: null, code: null, host: false, hostId: null, members: [], joinedAt: 0, ready: false, mode: null, hours: 6 };
  let S = null; // текущее состояние комнаты (у хоста — источник правды)
  let skew = 0; // разница часов с хостом
  let dirty = false, lastSent = 0, lastSave = 0;
  const now = () => Date.now() + (net.host ? 0 : skew);
  const nick = () => (A.load('qb.dc.nick', '') || A.nick()).slice(0, 20);

  const snapKey = (code) => `qb.dc.snap.${code}`;
  const saveSnap = () => { if (S) { A.store(snapKey(S.code), S); lastSave = Date.now(); } };

  const send = (event, payload) => net.ch && net.ch.send({ type: 'broadcast', event, payload: { ...payload, from: me } });

  function publish() {
    if (!net.host || !S) return;
    S.ver++;
    S.now = Date.now();
    send('st', { s: S });
    dirty = false;
    lastSent = Date.now();
  }

  // личные сообщения от движка: свои показываем, чужие отправляем
  function flushPms() {
    E.drain().forEach((m) => {
      if (m.to === me || m.to === '*') onPm(m);
      if (m.to !== me) send('pm', { m });
    });
  }

  // намерение игрока: у хоста применяем сразу, иначе отправляем хосту
  function act(msg) {
    if (!S || S.over) return;
    if (net.host) {
      E.act(S, me, msg, Date.now());
      flushPms();
      dirty = true;
      render();
    } else send('in', { m: msg });
  }

  function recomputeHost() {
    const list = Object.values(net.ch.presenceState()).map((a) => a[0]).filter(Boolean)
      .sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
    net.members = list;
    const was = net.host;
    net.hostId = list.length ? list[0].id : me;
    net.host = net.hostId === me;
    if (net.ready && net.host && !was) becomeHost();
    if (net.host && S) markOnline();
  }

  function markOnline() {
    const ids = new Set(net.members.map((m) => m.id));
    ids.add(me);
    Object.values(S.players).forEach((p) => { p.on = ids.has(p.id); });
  }

  // стали ведущим: берём последнее известное состояние, свой снапшот или создаём комнату
  function becomeHost() {
    if (!S) {
      const snap = A.load(snapKey(net.code), null);
      if (snap && snap.code === net.code && !(snap.over && net.mode === 'create')) { S = snap; E.catchUp(S); }
      else if (net.mode === 'create') S = E.newRoom(net.code, net.hours);
      else { leave(); A.toast('Комната не найдена — её никто не держит'); return; }
    }
    E.ensurePlayer(S, me, nick());
    markOnline();
    flushPms();
    publish();
    showGame();
  }

  function join(code, mode, hours) {
    leave(true);
    net.code = code; net.mode = mode; net.hours = hours || 6;
    net.joinedAt = Date.now(); net.ready = false; net.host = false; S = null;
    rememberRoom(code);
    showWait(mode === 'create' ? 'Поднимаем сервер…' : 'Подключаемся к комнате…');
    if (!sb) { net.host = true; net.ready = true; becomeHost(); return; }
    const ch = net.ch = sb.channel(`qb-dc-${code}`, { config: { broadcast: { self: false, ack: false }, presence: { key: me } } });
    ch.on('presence', { event: 'sync' }, recomputeHost);
    ch.on('broadcast', { event: 'st' }, ({ payload }) => {
      if (net.host || payload.from !== net.hostId) return;
      const first = !S;
      S = payload.s;
      skew = S.now - Date.now();
      predicted = 0;
      if (first) { showGame(); send('hello', { nick: nick(), ver: (A.load(snapKey(code), null) || {}).ver || 0 }); }
      if (!S.players[me]) send('in', { m: { a: 'join', nick: nick() } });
      if (Date.now() - lastSave > 5000) saveSnap();
      render();
    });
    ch.on('broadcast', { event: 'in' }, ({ payload }) => {
      if (!net.host || !S) return;
      const m = payload.m || {};
      if (m.a === 'join' || !S.players[payload.from]) E.ensurePlayer(S, payload.from, m.nick || 'Игрок');
      if (m.a !== 'join') E.act(S, payload.from, m, Date.now());
      flushPms();
      dirty = true;
    });
    ch.on('broadcast', { event: 'pm' }, ({ payload }) => {
      if (payload.from !== net.hostId) return;
      const m = payload.m;
      if (m.to === me || m.to === '*') onPm(m);
    });
    // у новичка может быть более свежий снапшот комнаты (например, хост перезапустился с пустой)
    ch.on('broadcast', { event: 'hello' }, ({ payload }) => {
      if (!net.host || !S) return;
      E.ensurePlayer(S, payload.from, payload.nick);
      dirty = true;
      if (payload.ver > S.ver + 20) send('snapreq', { to: payload.from });
    });
    ch.on('broadcast', { event: 'snapreq' }, ({ payload }) => {
      const snap = A.load(snapKey(code), null);
      if (payload.to === me && snap) send('snap', { s: snap });
    });
    ch.on('broadcast', { event: 'snap' }, ({ payload }) => {
      if (!net.host || !S || payload.s.code !== code || payload.s.ver <= S.ver) return;
      S = payload.s;
      E.catchUp(S);
      E.ensurePlayer(S, me, nick());
      markOnline();
      publish();
    });
    ch.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      await ch.track({ id: me, t: net.joinedAt, nick: nick() });
      setTimeout(() => {
        if (net.ch !== ch) return;
        net.ready = true;
        recomputeHost();
        if (net.host && !S) becomeHost();
        else if (!S) send('in', { m: { a: 'join', nick: nick() } });
      }, 1600);
    });
    // никто не ответил и мы не хост — значит, связи нет
    setTimeout(() => { if (net.code === code && !S && net.ready && !net.host) { leave(); A.toast('Хост комнаты не отвечает'); } }, 9000);
  }

  function leave(silent) {
    if (S && net.host) saveSnap();
    if (net.ch) { try { net.ch.untrack(); sb.removeChannel(net.ch); } catch {} }
    net.ch = null; net.code = null; net.host = false; net.ready = false;
    S = null;
    if (!silent) showLobby();
  }

  // цикл ведущего
  setInterval(() => {
    if (!net.host || !S) return;
    E.tick(S, Date.now());
    flushPms();
    const t = Date.now();
    if (t - lastSent > 650 || (dirty && t - lastSent > 150)) publish();
    if (t - lastSave > 5000) saveSnap();
  }, 200);

  /* ================= клики ================= */
  let pendClicks = 0, pendBoss = 0, predicted = 0;
  setInterval(() => {
    if (pendClicks) { act({ a: 'click', n: pendClicks }); pendClicks = 0; }
    if (pendBoss) { act({ a: 'click', n: pendBoss, boss: 1 }); pendBoss = 0; }
  }, 200);

  /* ================= интерфейс: игра ================= */
  const view = { mode: '', tab: 'hw', hwN: 1, kind: 'hack', sel: null, cache: {} };
  const put = (id, html) => {
    const el = document.getElementById(id);
    if (el && view.cache[id] !== html) { el.innerHTML = html; view.cache[id] = html; }
  };
  const mmss = (ms) => {
    ms = Math.max(0, ms);
    const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3), s = Math.floor((ms % 60e3) / 1000);
    return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`;
  };
  const ini = (n) => esc((n || '?').trim().slice(0, 2).toUpperCase());
  const hue = (id) => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
  const ava = (p) => `<i class="dc-ava" style="--h:${hue(p.id)}">${ini(p.nick)}</i>`;
  const R = D.R;
  const itemName = (it) => { const t = D.ITEMS[it.k]; return `<i class="r-${t.r}">${esc(t.n)}</i>`; };
  const bonusTxt = (b) => Object.entries(b).map(([k, v]) => D.BONUS_TXT[k](v)).join(', ');
  const lockBox = (loc, what) => `<div class="dc-lock"><b>${D.LOCS[loc].icon}</b><div>${what} открывается в локации <b>${D.LOCS[loc].name}</b></div><small>Переезжай на карте слева</small></div>`;

  const TABS = [
    ['hw', '🖥', 'Железо'], ['up', '⬆', 'Апгрейды'], ['hack', '💀', 'Хакинг'], ['inv', '🎒', 'Предметы'],
    ['mk', '🏷', 'Рынок'], ['core', '🧬', 'Ядро'], ['tasks', '📋', 'Задания'], ['stats', '📊', 'Стата'],
  ];

  function buildGame() {
    view.mode = 'game';
    view.cache = {};
    root.innerHTML = `
      <div class="dc-game">
        <header class="dc-bar">
          <div class="dc-room"><span class="dc-led"></span><span>КОМНАТА</span><b id="dc-code"></b><button class="dc-mini" data-copy title="Скопировать код">⧉</button></div>
          <div class="dc-online" id="dc-online"></div>
          <div class="dc-clock" id="dc-clock"></div>
          <button class="dc-mini dc-leave" data-leave>Выйти</button>
        </header>
        <div class="dc-grid">
          <section class="dc-col dc-left">
            <div class="dc-node">
              <div class="dc-cr"><small>КРЕДИТЫ</small><b id="dc-cr">0</b><span id="dc-inc"></span></div>
              <button class="dc-rack" id="dc-rack" title="Клик или пробел">
                ${[0, 1, 2, 3, 4].map((i) => `<span class="dc-unit"><i></i><i></i><i></i><em style="--d:${i * 0.17}s"></em><em style="--d:${i * 0.31}s"></em><em style="--d:${i * 0.23}s"></em></span>`).join('')}
                <span class="dc-rack-glow"></span>
              </button>
              <div id="dc-status"></div>
              <div class="dc-meters" id="dc-meters"></div>
            </div>
            <div id="dc-oc"></div>
            <div class="dc-box" id="dc-map"></div>
          </section>
          <section class="dc-col dc-mid">
            <nav class="dc-tabs">${TABS.map(([id, ic, n]) => `<button data-tab="${id}"><span>${ic}</span>${n}</button>`).join('')}</nav>
            <div class="dc-panel" id="dc-panel"></div>
          </section>
          <section class="dc-col dc-right">
            <div id="dc-boss"></div>
            <div id="dc-event"></div>
            <div class="dc-box"><div class="dc-h">ЛИДЕРБОРД</div><div id="dc-lb"></div></div>
            <div class="dc-box dc-feed-box"><div class="dc-h">ЛЕНТА</div><div class="dc-feed" id="dc-feed"></div></div>
          </section>
        </div>
        <div class="dc-fx" id="dc-fx"></div>
        <div class="dc-ov" id="dc-ov" hidden></div>
      </div>`;
    setTab(view.tab);
  }

  function setTab(t) {
    view.tab = t;
    $$('.dc-tabs button', root).forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    view.cache['dc-panel'] = null;
    render();
  }

  function render() {
    if (view.mode !== 'game' || !S || !root.offsetParent) return;
    const p = S.players[me];
    if (!p) return;
    const t = now();
    const c = E.calc(p, S, t);
    const ps = Object.values(S.players);

    $('#dc-code').textContent = S.code;
    put('dc-online', ps.filter((x) => x.on).slice(0, 8).map((x) => `<span title="${esc(x.nick)}">${ava(x)}</span>`).join('') + `<small>${ps.filter((x) => x.on).length} онлайн${net.host ? ' · ты хост' : ''}</small>`);
    put('dc-clock', S.over ? '<span>🌅 УТРО</span>' : `<span>ДО УТРА</span><b>${mmss(S.end - t)}</b>`);

    // нода
    $('#dc-cr').textContent = fmt(p.cr + predicted);
    put('dc-inc', `+${fmt(c.inc)}/с · клик ${fmt(c.click)}`);
    const rack = $('#dc-rack');
    const mul = E.comboMul({ streak: localStreak() }, c.comboCap);
    rack.style.setProperty('--spd', `${Math.max(0.12, 1.2 / mul)}s`);
    rack.classList.toggle('hot', p.heat > 70);
    rack.classList.toggle('dead', t < p.down || t < p.ddos);
    let st = '';
    if (t < p.down) st = `<div class="dc-st bad">🔥 ПЕРЕГРЕВ · ${mmss(p.down - t)}</div>`;
    else if (t < p.ddos) st = `<div class="dc-st bad">🌊 DDoS · клики не работают · ${mmss(p.ddos - t)}</div>`;
    else if (t < p.shield) st = `<div class="dc-st good">🛡 Щит ${mmss(p.shield - t)}</div>`;
    put('dc-status', st);
    const nx = E.nextCombo({ streak: localStreak() }, c.comboCap);
    const prevN = [...D.COMBO].reverse().find(([n, x]) => x <= c.comboCap && localStreak() >= n)[0];
    const cmbPct = nx ? ((localStreak() - prevN) / (nx[0] - prevN)) * 100 : 100;
    put('dc-meters', `
      <div class="dc-meter"><span>КОМБО <b class="cmb x${mul}">×${mul}</b></span><div class="bar cmb"><i style="width:${cmbPct}%"></i></div><small>${nx ? `×${nx[1]} через ${nx[0] - localStreak()}` : (c.comboCap < 10 ? 'больше ×2 — с Гаража' : 'максимум')}</small></div>
      <div class="dc-meter"><span>НАГРЕВ <b class="${p.heat > 75 ? 'red' : ''}">${Math.floor(p.heat)}°</b></span><div class="bar heat"><i style="width:${Math.min(100, p.heat)}%"></i></div><small>охлаждение ${fmt(c.cool)}/с${c.heatGain ? ` · разгон +${c.heatGain}/с` : ''}</small></div>`);

    // разгон
    put('dc-oc', p.loc < 3 ? '' : `<div class="dc-box dc-ocb"><div class="dc-h">РАЗГОН <small>доход ×${D.OC[p.oc].mul}</small></div><div class="dc-seg">${D.OC.map((o, i) => `<button data-oc="${i}" class="${p.oc === i ? 'on' : ''} oc${i}">${o.name}</button>`).join('')}</div><small class="dc-note">${p.oc ? `Нагрев +${D.OC[p.oc].heat}/с, шанс спалить железо ${D.OC[p.oc].brk * 100}% каждые 10 с` : 'Больше дохода, но греется и может сгореть'}</small></div>`);

    // карта
    const L = D.LOCS[p.loc + 1];
    put('dc-map', `<div class="dc-h">КАРТА СЕРВЕРОВ</div>
      <div class="dc-path">${D.LOCS.map((l, i) => `<span class="${i < p.loc ? 'done' : i === p.loc ? 'cur' : ''}" title="${esc(l.name)} — ${esc(l.opens)}">${l.icon}</span>`).join('<i></i>')}</div>
      <div class="dc-loc"><b>${D.LOCS[p.loc].icon} ${D.LOCS[p.loc].name}</b>${L ? `<button class="dc-btn ${p.cr >= L.cost ? '' : 'off'}" data-loc>Переезд → ${L.name} · ${fmt(L.cost)}</button><small>Откроется: ${L.opens}</small>` : '<small>Ты на вершине. Дальше только Reboot.</small>'}</div>`);

    renderBoss(p, c, t);
    renderEvent(t);
    renderLb(ps, t);
    put('dc-feed', S.feed.map((f) => `<div class="fd ${f.k}"><time>${new Date(f.t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</time><span>${f.txt}</span></div>`).join(''));
    PANELS[view.tab](p, c, t, ps);
    if (S.over) showFinal();
  }

  function renderBoss(p, c, t) {
    const b = S.boss;
    if (!b) { put('dc-boss', `<div class="dc-box dc-boss-idle"><span>☠ Следующий босс через</span><b>${mmss(S.nextBoss - t)}</b></div>`); return; }
    const top = Object.entries(b.dmg).sort((x, y) => y[1] - x[1]).slice(0, 3);
    put('dc-boss', `<div class="dc-box dc-boss">
      <div class="dc-boss-head"><b>☠ ${esc(b.name)}</b><span>${mmss(b.until - t)}</span></div>
      <div class="bar hp"><i style="width:${Math.max(0, (b.hp / b.max) * 100)}%"></i><em>${fmt(Math.max(0, b.hp))} / ${fmt(b.max)}</em></div>
      <button class="dc-hit" id="dc-hit">⚔ БИТЬ <small>${fmt(c.click * c.bossMul)} за клик</small></button>
      <div class="dc-boss-top">${top.map(([id, d], i) => `<span>${['🥇', '🥈', '🥉'][i]} ${esc((S.players[id] || {}).nick || '?')} <b>${fmt(d)}</b></span>`).join('')}</div>
    </div>`);
  }

  function renderEvent(t) {
    const ev = S.event && t < S.event.until ? D.EVENTS.find((e) => e.id === S.event.id) : null;
    const orb = S.orbit && t < S.orbit.until ? S.orbit : null;
    put('dc-event', (ev ? `<div class="dc-ev ${ev.bad ? 'bad' : ''}"><b>${ev.icon}</b><div><strong>${esc(ev.name)}</strong><small>${esc(ev.d)}</small></div><time>${mmss(S.event.until - t)}</time></div>` : '')
      + (orb ? `<div class="dc-ev"><b>🛰</b><div><strong>Орбитальный бафф</strong><small>от ${esc(orb.nick)}: +25% всем</small></div><time>${mmss(orb.until - t)}</time></div>` : ''));
  }

  function renderLb(ps, t) {
    const list = ps.slice().sort((a, b) => b.score - a.score);
    put('dc-lb', list.map((x, i) => {
      const c = E.calc(x, S, t);
      const clicking = t - x.lastClk < 1500;
      const bty = S.bounty[x.id];
      return `<div class="lb ${x.id === me ? 'me' : ''} ${x.on ? '' : 'off'}">
        <span class="lb-n">${i + 1}</span>${ava(x)}
        <div class="lb-main"><b>${esc(x.nick)}${clicking ? '<i class="lb-click">⚡</i>' : ''}${bty ? `<i class="lb-bty">🎯${fmt(bty.pool)}</i>` : ''}</b><small>${D.LOCS[x.loc].icon} ${fmt(c.inc)}/с${x.coresAll ? ` · 🧬${x.coresAll}` : ''}</small></div>
        <span class="lb-s">${fmt(x.score)}</span></div>`;
    }).join(''));
  }

  /* ---------- вкладки ---------- */
  const can = (p, cost) => (p.cr >= cost ? '' : 'off');
  const PANELS = {
    hw(p, c) {
      const vis = D.HW.filter((h) => h.loc <= p.loc + 1);
      put('dc-panel', `<div class="dc-ph"><b>Железо</b><div class="dc-seg sm">${[1, 10, 'max'].map((n) => `<button data-hwn="${n}" class="${view.hwN === n ? 'on' : ''}">${n === 'max' ? 'MAX' : '×' + n}</button>`).join('')}</div></div>
        <div class="dc-list">${vis.map((h) => {
          const n = p.hw[h.id] || 0, locked = h.loc > p.loc;
          const x2 = p.up.includes('x2_' + h.id) ? 2 : 1;
          let cost = 0;
          const cnt = view.hwN === 'max' ? 1 : view.hwN;
          for (let k = 0; k < cnt; k++) cost += E.hwCost(p, h, c, k);
          return `<div class="dc-row ${locked ? 'locked' : ''}">
            <span class="dc-ic">${h.icon}</span>
            <div class="dc-rt"><b>${esc(h.name)} <em>${n}</em></b><small>${locked ? `🔒 ${D.LOCS[h.loc].name}` : `${esc(h.d)} · +${fmt(h.rate * x2)}/с за шт.`}</small></div>
            ${locked ? '' : `<button class="dc-buy ${can(p, cost)}" data-hw="${h.id}">${fmt(cost)}</button>`}
          </div>`;
        }).join('')}</div>`);
    },
    up(p) {
      const avail = D.UPG.filter((u) => !p.up.includes(u.id) && u.loc <= p.loc && (!u.need || (p.hw[u.hw] || 0) >= u.need / 2)).sort((a, b) => a.cost - b.cost);
      const done = D.UPG.filter((u) => p.up.includes(u.id));
      put('dc-panel', `<div class="dc-ph"><b>Апгрейды</b><small>куплено ${done.length}/${D.UPG.length}</small></div>
        <div class="dc-cards">${avail.map((u) => {
          const need = u.need && (p.hw[u.hw] || 0) < u.need;
          return `<button class="dc-card ${need ? 'locked' : can(p, u.cost)}" data-up="${u.id}"><span>${u.icon}</span><b>${esc(u.name)}</b><small>${esc(u.d)}${need ? ` · есть ${p.hw[u.hw] || 0}` : ''}</small><em>${fmt(u.cost)}</em></button>`;
        }).join('') || '<div class="dc-empty">Всё доступное куплено. Переезжай дальше.</div>'}</div>
        ${done.length ? `<div class="dc-done">${done.map((u) => `<span title="${esc(u.name)}: ${esc(u.d)}">${u.icon}</span>`).join('')}</div>` : ''}`);
    },
    hack(p, c, t, ps) {
      if (p.loc < 2) return put('dc-panel', lockBox(2, 'Хакинг, защита и bounty'));
      const cd = Math.max(0, (p.cd.atk || 0) - t);
      const others = ps.filter((x) => x.id !== me).sort((a, b) => b.score - a.score);
      put('dc-panel', `<div class="dc-ph"><b>Атака</b>${cd ? `<span class="dc-cd">⏳ ${mmss(cd)}</span>` : '<span class="dc-cd ok">● ГОТОВ</span>'}</div>
        <div class="dc-seg wide">${D.ATK.map((a) => `<button data-kind="${a.id}" class="${view.kind === a.id ? 'on' : ''}">${a.icon} ${a.name}</button>`).join('')}</div>
        <small class="dc-note">${esc(D.ATK.find((a) => a.id === view.kind).d)}</small>
        <div class="dc-list">${others.map((x) => {
          const cx = E.calc(x, S, t);
          const ch = Math.round(Math.max(0.1, Math.min(0.95, c.hit - cx.block)) * 100);
          let why = '';
          if (x.loc < 2) why = '🍼 новичок';
          else if (t < x.shield) why = '🛡 щит';
          else if (t - x.lastHit < 45e3) why = '💨 отдыхает';
          else if (view.kind !== 'hack' && !x.on) why = '⚫ не в сети';
          const bty = S.bounty[x.id];
          return `<div class="dc-row">${ava(x)}
            <div class="dc-rt"><b>${esc(x.nick)} ${bty ? `<i class="lb-bty">🎯 ${fmt(bty.pool)}</i>` : ''}</b><small>${fmt(x.cr)} кр · шанс ${ch}%${x.on ? '' : ' · оффлайн'}</small></div>
            <button class="dc-buy ghost" data-bty="${x.id}" title="Назначить награду">🎯</button>
            ${why ? `<span class="dc-why">${why}</span>` : `<button class="dc-buy red ${cd ? 'off' : ''}" data-atk="${x.id}">${D.ATK.find((a) => a.id === view.kind).icon} Атака</button>`}
          </div>`;
        }).join('') || '<div class="dc-empty">В комнате пока никого. Кинь кентам код комнаты.</div>'}</div>
        <div class="dc-ph"><b>Защита</b><small>отбить ${Math.round(c.block * 100)}% · защищено ${Math.round(c.prot * 100)}%</small></div>
        <div class="dc-list">${D.DEF.map((d) => {
          const l = p.def[d.id] || 0, cost = E.defCost(p, d), max = l >= d.max;
          return `<div class="dc-row"><span class="dc-ic">${d.icon}</span><div class="dc-rt"><b>${d.name} <em>${l}/${d.max}</em></b><small>${d.d(Math.min(d.max, l + (max ? 0 : 1)))}</small></div>
            ${max ? '<span class="dc-why">MAX</span>' : `<button class="dc-buy ${can(p, cost)}" data-def="${d.id}">${fmt(cost)}</button>`}</div>`;
        }).join('')}</div>`);
    },
    inv(p, c) {
      const slots = c.slots;
      const sel = p.items.find((i) => i.u === view.sel);
      const b = E.itemBonus(p);
      put('dc-panel', `<div class="dc-ph"><b>Предметы</b><small>${p.items.length}/40 · слотов ${p.eq.length}/${slots}</small></div>
        ${p.loc >= 1 ? `<button class="dc-case ${can(p, c.casePrice)}" data-case><span>📦</span><div><b>Открыть кейс</b><small>шанс прототипа 0.2% · удача ×${c.luck.toFixed(2)}</small></div><em>${fmt(c.casePrice)}</em></button>` : lockBox(1, 'Кейсы')}
        <small class="dc-note">Надето: ${bonusTxt(Object.fromEntries(Object.entries(b).filter(([, v]) => v))) || 'ничего'}</small>
        <div class="dc-inv">${p.items.slice().sort((x, y) => D.RAR.indexOf(D.ITEMS[y.k].r) - D.RAR.indexOf(D.ITEMS[x.k].r)).map((it) => {
          const t = D.ITEMS[it.k];
          return `<button class="dc-item r-${t.r} ${p.eq.includes(it.u) ? 'eq' : ''} ${view.sel === it.u ? 'sel' : ''}" data-item="${it.u}"><span>${D.TYPE_ICON[t.t]}</span><b>${esc(t.n)}</b><small>${R[t.r].name}</small></button>`;
        }).join('') || '<div class="dc-empty">Пусто. Кейсы, боссы и контракты дают предметы.</div>'}</div>
        ${sel ? (() => {
          const t = D.ITEMS[sel.k], on = p.eq.includes(sel.u);
          return `<div class="dc-itemcard r-${t.r}"><div><b>${esc(t.n)}</b><small>${R[t.r].name} · ${t.t} · ${bonusTxt(t.b)}</small></div>
            <div class="dc-acts"><button class="dc-buy" data-${on ? 'uneq' : 'eq'}="${sel.u}">${on ? 'Снять' : 'Надеть'}</button>
            <button class="dc-buy ghost" data-sell="${sel.u}">Продать · ${fmt(Math.round(c.casePrice * R[t.r].mul * 0.35))}</button>
            <button class="dc-buy ghost" data-list="${sel.u}">На рынок</button></div></div>`;
        })() : ''}`);
    },
    mk(p, c, t) {
      const lots = S.market.filter((l) => !l.to || l.to === me || l.seller === me);
      const bmLeft = 600e3 - ((t - S.created) % 600e3);
      put('dc-panel', `<div class="dc-ph"><b>Рынок игроков</b><small>комиссия 5%</small></div>
        <div class="dc-list">${lots.map((l) => {
          const t2 = D.ITEMS[l.item.k], sel = S.players[l.seller] || { nick: '?' };
          const mine = l.seller === me;
          return `<div class="dc-row ${l.to === me ? 'offer' : ''}"><span class="dc-ic">${D.TYPE_ICON[t2.t]}</span>
            <div class="dc-rt"><b>${itemName(l.item)}</b><small>${esc(sel.nick)}${l.to ? ` → ${esc((S.players[l.to] || {}).nick || '?')}` : ''} · ${bonusTxt(t2.b)}</small></div>
            ${mine ? `<button class="dc-buy ghost" data-unlist="${l.id}">Снять · ${fmt(l.price)}</button>` : `<button class="dc-buy ${can(p, l.price)}" data-buylot="${l.id}">${fmt(l.price)}</button>`}</div>`;
        }).join('') || '<div class="dc-empty">Лотов нет. Выставь предмет во вкладке «Предметы».</div>'}</div>
        <div class="dc-ph"><b>🕶 Чёрный рынок</b><small>новый товар через ${mmss(bmLeft)}</small></div>
        ${p.loc < 4 ? lockBox(4, 'Чёрный рынок') : `<div class="dc-bm">${S.bm.items.map((x, i) => {
          const t2 = D.ITEMS[x.item.k];
          return `<div class="dc-bmi r-${t2.r} ${x.sold ? 'sold' : ''}"><span>${D.TYPE_ICON[t2.t]}</span><b>${esc(t2.n)}</b><small>${R[t2.r].name}<br>${bonusTxt(t2.b)}</small>
            ${x.sold ? `<em>купил ${esc(x.sold)}</em>` : `<button class="dc-buy ${can(p, x.price)}" data-bm="${i}">${fmt(x.price)}</button>`}</div>`;
        }).join('')}</div>`}`);
    },
    core(p, c, t) {
      const g = E.rebootGain(p);
      put('dc-panel', `<div class="dc-ph"><b>Ядро</b><small>🧬 ${p.cores} свободно · всего ${p.coresAll} (+${p.coresAll * 4}% дохода)</small></div>
        <div class="dc-reboot"><div><b>♻ Reboot</b><small>Сбросит кредиты, железо, апгрейды, защиту и локацию. Предметы, ядра и дерево останутся.${p.loc < 3 ? ' Доступно с Датацентра.' : ''}</small></div>
          <button class="dc-buy red ${p.loc >= 3 && g >= 1 ? '' : 'off'}" data-reboot>+${g} 🧬</button></div>
        <small class="dc-note">Ядра = √(заработано за забег / 1M). Следующее ядро на ${fmt(Math.pow(g + 1, 2) * 1e6)}</small>
        <div class="dc-tree">${Object.entries(D.TREE).map(([k, br]) => `<div class="dc-br" style="--c:${br.color}"><div class="dc-br-h">${br.name}</div>${br.nodes.map((n, i) => {
          const got = p.tree.includes(n.id), prev = i === 0 || p.tree.includes(br.nodes[i - 1].id);
          const lockR = i >= 3 && p.loc < 5;
          return `<button class="dc-nd ${got ? 'got' : prev && !lockR && p.cores >= n.c ? 'can' : 'off'}" data-tree="${n.id}"><b>${esc(n.name)}</b><small>${esc(n.d)}</small><em>${got ? '✓' : lockR ? '⛏' : n.c + ' 🧬'}</em></button>`;
        }).join('')}</div>`).join('')}</div>
        ${p.loc >= 6 ? `<div class="dc-reboot"><div><b>🛰 Орбитальный бафф</b><small>Всем +25% дохода на 2 минуты, тебе ×2. Раз в 10 минут.</small></div><button class="dc-buy ${t < (p.cd.orb || 0) ? 'off' : ''}" data-orbit>${t < (p.cd.orb || 0) ? mmss(p.cd.orb - t) : 'Запуск'}</button></div>` : ''}
        ${p.loc >= 7 ? `<div class="dc-reboot q"><div><b>⚛ Коллапс волновой функции</b><small>55% — кредиты ×2. 45% — минус половина. Раз в 5 минут.</small></div><button class="dc-buy red ${t < (p.cd.qc || 0) ? 'off' : ''}" data-qc>${t < (p.cd.qc || 0) ? mmss(p.cd.qc - t) : 'Схлопнуть'}</button></div>` : ''}`);
    },
    tasks(p, c, t) {
      const ct = p.ct;
      put('dc-panel', `<div class="dc-ph"><b>Контракт</b></div>
        ${ct ? `<div class="dc-ct"><b>📋 ${esc(ct.txt)}</b><div class="bar cmb"><i style="width:${Math.min(100, (ct.prog / ct.goal) * 100)}%"></i></div><small>${fmt(Math.min(ct.prog, ct.goal))} / ${fmt(ct.goal)} · осталось ${mmss(ct.until - t)} · награда ${fmt(ct.rew)} + кейс</small></div>` : '<div class="dc-empty">Новый контракт скоро придёт…</div>'}
        <div class="dc-ph"><b>Ачивки</b><small>${p.ach.length}/${Object.keys(D.ACH).length} · каждая +1% дохода</small></div>
        <div class="dc-ach">${Object.entries(D.ACH).map(([id, [n, d]]) => `<div class="${p.ach.includes(id) ? 'got' : ''}"><b>${p.ach.includes(id) ? '🏆' : '🔒'} ${esc(n)}</b><small>${esc(d)}</small></div>`).join('')}</div>`);
    },
    stats(p, c, t, ps) {
      const rows = [['Очки', (x) => fmt(x.score)], ['Кликов', (x) => fmt(x.st.clicks)], ['Заработано', (x) => fmt(x.st.earned)], ['Украл', (x) => fmt(x.st.stolen)], ['Потерял', (x) => fmt(x.st.lost)],
        ['Атак', (x) => `${x.st.attacks} (${x.st.atkOk}✓)`], ['Урон боссам', (x) => fmt(x.st.boss)], ['Кейсов', (x) => x.st.cases], ['Потратил', (x) => fmt(x.st.spent)], ['Перегревов', (x) => x.st.overheats], ['Reboot', (x) => x.st.reboots], ['Ачивок', (x) => x.ach.length]];
      const list = ps.slice().sort((a, b) => b.score - a.score);
      put('dc-panel', `<div class="dc-ph"><b>Статистика ночи</b></div><div class="dc-tbl"><table><tr><th></th>${list.map((x) => `<th class="${x.id === me ? 'me' : ''}">${esc(x.nick)}</th>`).join('')}</tr>
        ${rows.map(([n, f]) => `<tr><td>${n}</td>${list.map((x) => `<td class="${x.id === me ? 'me' : ''}">${f(x)}</td>`).join('')}</tr>`).join('')}</table></div>`);
    },
  };

  /* ---------- клик по ноде ---------- */
  let ls = 0, lsAt = 0;
  const localStreak = () => (Date.now() - lsAt < 1200 ? ls : 0);

  function floatText(x, y, txt, cls = '') {
    const fx = $('#dc-fx');
    if (!fx) return;
    const base = fx.getBoundingClientRect();
    const el = document.createElement('span');
    el.className = 'dc-float ' + cls;
    el.textContent = txt;
    el.style.left = `${x - base.left + (Math.random() * 30 - 15)}px`;
    el.style.top = `${y - base.top - 10}px`;
    fx.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  function nodeClick(x, y, boss) {
    if (!S || S.over) return;
    const p = S.players[me];
    if (!p) return;
    const t = now();
    if (t < p.down || t < p.ddos) { floatText(x, y, t < p.down ? '🔥 перегрев' : '🌊 DDoS', 'bad'); return; }
    const c = E.calc(p, S, t);
    ls = Date.now() - lsAt < 1200 ? ls + 1 : 1;
    lsAt = Date.now();
    const mul = E.comboMul({ streak: ls }, c.comboCap);
    if (boss) {
      pendBoss++;
      floatText(x, y, `−${fmt(c.click * c.bossMul * Math.sqrt(mul))}`, 'boss');
    } else {
      pendClicks++;
      const g = c.click * mul;
      predicted += g;
      floatText(x, y, `+${fmt(g)}${mul > 1 ? ` ×${mul}` : ''}`, mul >= 10 ? 'x10' : mul >= 5 ? 'x5' : '');
    }
    const rack = $('#dc-rack');
    if (rack && !boss) { rack.classList.remove('tap'); void rack.offsetWidth; rack.classList.add('tap'); }
  }
  setInterval(() => { if (net.host) predicted = 0; }, 200);

  /* ---------- оверлеи ---------- */
  function overlay(html, cls = '') {
    const ov = $('#dc-ov');
    if (!ov) return null;
    ov.className = 'dc-ov ' + cls;
    ov.innerHTML = html;
    ov.hidden = false;
    return ov;
  }
  const closeOv = () => { const ov = $('#dc-ov'); if (ov) { ov.hidden = true; ov.innerHTML = ''; } };

  function showDrop(it, src) {
    const t = D.ITEMS[it.k];
    if (t.r === 'c' || t.r === 'r') { A.toast(`${src}: ${t.n} (${R[t.r].name})`); return; }
    const ov = overlay(`<div class="dc-drop r-${t.r}">
      ${t.r === 'p' ? '<div class="dc-scream">ЕБАТЬ МНЕ ВЫПАЛО</div>' : ''}
      <small>${esc(src)}</small><div class="dc-drop-ic">${D.TYPE_ICON[t.t]}</div>
      <b>${esc(t.n)}</b><em>${R[t.r].name}</em><span>${bonusTxt(t.b)}</span>
      <button class="dc-btn" data-close>Забрать</button></div>`, 'drop' + (t.r === 'p' ? ' proto' : ''));
    if (ov) setTimeout(() => { if (ov.classList.contains('drop')) closeOv(); }, t.r === 'p' ? 7000 : 3500);
  }

  function showVirus(vid, from, dur) {
    const N = 10;
    let left = N, done = false;
    const ov = overlay(`<div class="dc-virus"><div class="dc-virus-h"><b>🦠 ${esc(from)} закинул тебе вирус!</b><span>Убей всех за ${Math.round(dur / 1000)} с, иначе потеряешь 5%</span><div class="bar heat"><i id="dc-vbar"></i></div></div>
      <div class="dc-vfield">${Array.from({ length: N }, (_, i) => `<button class="dc-bug" data-bug style="left:${5 + Math.random() * 85}%;top:${5 + Math.random() * 80}%;animation-delay:${-Math.random() * 2}s">🦠</button>`).join('')}</div></div>`, 'virus');
    if (!ov) return;
    const bar = $('#dc-vbar');
    bar.style.transition = `width ${dur}ms linear`;
    requestAnimationFrame(() => { bar.style.width = '0%'; });
    const finish = (ok) => {
      if (done) return;
      done = true;
      act({ a: 'vres', vid, ok });
      closeOv();
      A.toast(ok ? '🧼 Вирус вычищен' : '🦠 Вирус сожрал 5% кредитов');
    };
    ov.onclick = (e) => {
      const b = e.target.closest('[data-bug]');
      if (!b) return;
      b.remove();
      if (--left <= 0) finish(true);
    };
    setTimeout(() => finish(false), dur);
  }

  function modal(html, onOk) {
    const ov = overlay(`<div class="dc-modal">${html}<div class="dc-acts"><button class="dc-buy ghost" data-close>Отмена</button><button class="dc-buy" data-ok>Готово</button></div></div>`, 'modal');
    if (!ov) return;
    const inp = $('input', ov);
    if (inp) setTimeout(() => inp.focus(), 50);
    $('[data-ok]', ov).onclick = () => { if (onOk(ov) !== false) closeOv(); };
    ov.onkeydown = (e) => { if (e.key === 'Enter') $('[data-ok]', ov).click(); if (e.key === 'Escape') closeOv(); };
  }
  const parseAmt = (v) => {
    const m = String(v).trim().toLowerCase().replace(',', '.').match(/^([\d.]+)\s*([kкmмbбt]?)/);
    if (!m) return NaN;
    return parseFloat(m[1]) * ({ k: 1e3, 'к': 1e3, m: 1e6, 'м': 1e6, b: 1e9, 'б': 1e9, t: 1e12 }[m[2]] || 1);
  };

  function bountyModal(tid) {
    const p = S.players[me], t = S.players[tid];
    modal(`<b>🎯 Bounty на ${esc(t.nick)}</b><small>Кто первым успешно его взломает — заберёт всю награду</small>
      <input class="dc-inp" id="dc-bamt" placeholder="Сумма, напр. 50k или 2m" autocomplete="off">
      <div class="dc-seg sm">${[0.05, 0.1, 0.25].map((k) => `<button data-q="${Math.floor(p.cr * k)}">${k * 100}% · ${fmt(p.cr * k)}</button>`).join('')}</div>`, (ov) => {
      const v = parseAmt($('#dc-bamt', ov).value);
      if (!(v >= 1000)) { A.toast('Минимум 1K'); return false; }
      act({ a: 'bounty', t: tid, amt: v });
    });
    $$('[data-q]', $('#dc-ov')).forEach((b) => { b.onclick = () => { $('#dc-bamt').value = b.dataset.q; }; });
  }

  function listModal(u) {
    const p = S.players[me];
    const it = p.items.find((i) => i.u === u);
    if (!it) return;
    const others = Object.values(S.players).filter((x) => x.id !== me);
    modal(`<b>🏷 Продать ${itemName(it)}</b><small>Всем — на открытый рынок. Или личная сделка конкретному кенту</small>
      <input class="dc-inp" id="dc-lprice" placeholder="Цена, напр. 50m" autocomplete="off">
      <select class="dc-inp" id="dc-lto"><option value="">Всем</option>${others.map((x) => `<option value="${esc(x.id)}">${esc(x.nick)}</option>`).join('')}</select>`, (ov) => {
      const v = parseAmt($('#dc-lprice', ov).value);
      if (!(v >= 100)) { A.toast('Укажи цену'); return false; }
      act({ a: 'list', u, price: v, to: $('#dc-lto', ov).value || null });
      view.sel = null;
    });
  }

  function showFinal() {
    if (view.finalShown) return;
    view.finalShown = true;
    const ps = Object.values(S.players).sort((a, b) => b.score - a.score);
    overlay(`<div class="dc-final">
      <small>🌅 НОЧЬ ОКОНЧЕНА · КОМНАТА ${esc(S.code)}</small>
      <h2>Итоги ночи</h2>
      <div class="dc-awards">${(S.awards || []).map((a) => {
        const d = D.AWARDS.find((x) => x.id === a.id);
        return `<div class="dc-award ${a.id === 'king' ? 'king' : ''} ${a.pid === me ? 'me' : ''}"><span>${d.icon}</span><b>${esc(d.name)}</b><em>${esc(a.nick)}</em><small>${fmt(a.v)} ${d.d}</small></div>`;
      }).join('')}</div>
      <div class="dc-podium">${ps.map((x, i) => `<div class="${x.id === me ? 'me' : ''}"><span>${i + 1}</span>${ava(x)}<b>${esc(x.nick)}</b><em>${fmt(x.score)}</em></div>`).join('')}</div>
      <div class="dc-acts"><button class="dc-buy ghost" data-close>Посмотреть стату</button><button class="dc-buy" data-leave>В лобби</button></div>
    </div>`, 'final');
  }

  /* ---------- личные сообщения ---------- */
  function onPm(m) {
    if (m.kind === 'note' || m.kind === 'err') A.toast(m.txt);
    else if (m.kind === 'hit') { A.toast('⚠ ' + m.txt); flash('hit'); }
    else if (m.kind === 'drop') showDrop(m.item, m.src);
    else if (m.kind === 'ach') A.toast(`🏆 Ачивка: ${D.ACH[m.id][0]}`);
    else if (m.kind === 'virus') showVirus(m.vid, m.nick, m.dur);
    else if (m.kind === 'boss') { A.toast('☠ Босс появился! Все на рейд'); if (!root.offsetParent && window.qb && window.qb.notify) window.qb.notify('Ночной дата-центр', 'Появился босс — все на рейд!', 'dc'); }
    else if (m.kind === 'overheat') { A.toast('🔥 Перегрев! Сервер остывает 15 с'); flash('hot'); }
    else if (m.kind === 'reboot') { A.toast(`♻ Reboot: +${m.g} ядер`); flash('reboot'); }
  }
  function flash(kind) {
    const g = $('.dc-game', root);
    if (!g) return;
    g.classList.remove('fl-hit', 'fl-hot', 'fl-reboot');
    void g.offsetWidth;
    g.classList.add('fl-' + kind);
  }

  /* ---------- лобби ---------- */
  const rooms = () => A.load('qb.dc.rooms', []);
  function rememberRoom(code) { A.store('qb.dc.rooms', [code, ...rooms().filter((c) => c !== code)].slice(0, 6)); }
  const cleanCode = (v) => String(v || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9а-яё-]/g, '').slice(0, 24);
  const randCode = () => 'night-' + Math.random().toString(36).slice(2, 6);
  let lobbyHours = 6;

  function showLobby() {
    view.mode = 'lobby';
    view.finalShown = false;
    root.innerHTML = `<div class="dc-lobby">
      <div class="dc-hero">
        <div class="dc-hero-txt">
          <small>МУЛЬТИПЛЕЕРНЫЙ КЛИКЕР НА ОДНУ НОЧЬ</small>
          <h2>Ночной<br><span>дата-центр</span></h2>
          <p>Все на одном сервере. Кликай, скупай железо, переезжай из домашнего ПК в квантовый сервер, ддось кентов, валите вместе боссов. Утром сервер замерзает — и выясняется, кто король ночи.</p>
          <div class="dc-feats">${['⚡ комбо до ×15', '💀 взломы и DDoS', '☠ общий босс', '🎁 кейсы и прототипы 0.2%', '🏷 рынок между игроками', '🎯 bounty', '♻ престиж', '🌅 финал утром'].map((f) => `<span>${f}</span>`).join('')}</div>
        </div>
        <div class="dc-hero-art">${[0, 1, 2].map((r) => `<div class="dc-tower">${Array.from({ length: 7 }, (_, i) => `<span class="dc-unit"><i></i><i></i><i></i><em style="--d:${(r * 7 + i) * 0.13}s"></em><em style="--d:${(r + i) * 0.29}s"></em><em style="--d:${i * 0.41}s"></em></span>`).join('')}</div>`).join('')}</div>
      </div>
      <div class="dc-forms">
        <div class="dc-box"><div class="dc-h">ТВОЙ НИК</div><input class="dc-inp" id="dc-nick" maxlength="20" placeholder="nezzuss" value="${esc(nick())}"><small class="dc-note">${sb ? 'Онлайн через realtime-сервер. Хостом становится тот, кто зашёл первым.' : 'Нет связи с сервером — играем соло.'}</small></div>
        <div class="dc-box"><div class="dc-h">СОЗДАТЬ КОМНАТУ</div>
          <input class="dc-inp" id="dc-new" placeholder="${randCode()}" autocomplete="off">
          <div class="dc-seg" id="dc-hours">${[1, 2, 4, 6, 8].map((h) => `<button data-h="${h}" class="${h === lobbyHours ? 'on' : ''}">${h} ч</button>`).join('')}</div>
          <button class="dc-btn big" data-create>Поднять сервер</button></div>
        <div class="dc-box"><div class="dc-h">ВОЙТИ ПО КОДУ</div>
          <input class="dc-inp" id="dc-code-in" placeholder="zalupa-night" autocomplete="off">
          <button class="dc-btn big ghost" data-join>Подключиться</button>
          ${rooms().length ? `<div class="dc-recent">${rooms().map((c) => `<button data-recent="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}</div>
      </div>
    </div>`;
  }

  function showWait(txt) {
    view.mode = 'wait';
    root.innerHTML = `<div class="dc-wait"><div class="dc-spin"></div><b>${esc(txt)}</b><button class="dc-buy ghost" data-leave>Отмена</button></div>`;
  }

  function showGame() {
    if (view.mode !== 'game') buildGame();
    render();
  }

  /* ---------- события интерфейса ---------- */
  root.addEventListener('click', (e) => {
    const el = e.target.closest('button, [data-close]');
    if (!el) return;
    const d = el.dataset;
    if ('close' in d) return closeOv();
    if ('leave' in d) return leave();
    if ('copy' in d) { A.copy(S ? S.code : ''); return; }
    if (d.h) { lobbyHours = +d.h; $$('#dc-hours button').forEach((b) => b.classList.toggle('on', b === el)); return; }
    if ('create' in d || 'join' in d || d.recent) {
      const n = $('#dc-nick').value.trim();
      if (n) A.store('qb.dc.nick', n.slice(0, 20));
      if ('create' in d) return join(cleanCode($('#dc-new').value) || cleanCode($('#dc-new').placeholder), 'create', lobbyHours);
      const code = d.recent || cleanCode($('#dc-code-in').value);
      if (!code) return A.toast('Введи код комнаты');
      return join(code, 'join');
    }
    if (!S) return;
    if (el.id === 'dc-rack') return nodeClick(e.clientX, e.clientY, false);
    if (el.id === 'dc-hit') return nodeClick(e.clientX, e.clientY, true);
    if (d.tab) return setTab(d.tab);
    if (d.hwn) { view.hwN = d.hwn === 'max' ? 'max' : +d.hwn; return render(); }
    if (d.kind) { view.kind = d.kind; return render(); }
    if (d.item) { view.sel = view.sel === +d.item ? null : +d.item; return render(); }
    if (d.bty) return bountyModal(d.bty);
    if (d.list) return listModal(+d.list);
    if (el.classList.contains('off')) return;
    const map = {
      hw: () => act({ a: 'hw', id: d.hw, n: view.hwN }), up: () => act({ a: 'up', id: d.up }), def: () => act({ a: 'def', id: d.def }),
      loc: () => act({ a: 'loc' }), oc: () => act({ a: 'oc', lvl: +d.oc }), atk: () => act({ a: 'atk', t: d.atk, kind: view.kind }),
      case: () => act({ a: 'case' }), eq: () => act({ a: 'eq', u: +d.eq }), uneq: () => act({ a: 'uneq', u: +d.uneq }),
      sell: () => { act({ a: 'sell', u: +d.sell }); view.sel = null; }, unlist: () => act({ a: 'unlist', id: +d.unlist }),
      buylot: () => act({ a: 'buylot', id: +d.buylot }), bm: () => act({ a: 'bm', i: +d.bm }), tree: () => act({ a: 'tree', id: d.tree }),
      reboot: () => { if (confirm('Reboot сбросит забег. Точно?')) act({ a: 'reboot' }); }, orbit: () => act({ a: 'orbit' }), qc: () => act({ a: 'qc' }),
    };
    const k = Object.keys(map).find((x) => x in d);
    if (k) map[k]();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || !root.offsetParent || view.mode !== 'game') return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || !$('#dc-ov').hidden) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const r = $('#dc-rack').getBoundingClientRect();
    nodeClick(r.left + r.width / 2, r.top + r.height / 3, false);
  }, true);

  setInterval(render, 250);
  window.addEventListener('qb:page', (e) => { if (e.detail === 'dc') { view.cache = {}; render(); } });
  window.addEventListener('beforeunload', () => { if (net.host) saveSnap(); });
  showLobby();
})();
