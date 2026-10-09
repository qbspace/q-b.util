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
      if (Date.now() - lastSave > 60000) saveSnap();
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
    if (t - lastSent > 1000 || (dirty && t - lastSent > 400)) publish();
    if (t - lastSave > 20000) saveSnap();
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
  const stars = (it) => (it.s ? `<i class="dc-stars">${'★'.repeat(it.s)}</i>` : '');
  const itemName = (it) => { const t = D.ITEMS[it.k]; return `<i class="r-${t.r}">${esc(t.n)}</i>${stars(it)}`; };
  const allyTag = (x) => { const a = x.ally && S.allies && S.allies[x.ally]; return a ? `<i class="dc-tag" style="--ah:${a.hue}">${esc(a.name)}</i>` : ''; };
  const bonusTxt = (b) => Object.entries(b).map(([k, v]) => D.BONUS_TXT[k](v)).join(', ');
  const hint = (txt) => `<div class="dc-hint">💡 ${txt}</div>`;
  const lockBox = (loc, what) => `<div class="dc-lock"><b>${D.LOCS[loc].icon}</b><div>${what} открывается в локации <b>${D.LOCS[loc].name}</b></div><small>Переезжай на карте слева</small></div>`;

  const TABS = [
    ['hw', '🖥', 'Железо'], ['up', '⬆', 'Апгрейды'], ['hack', '💀', 'Хакинг'], ['inv', '🎒', 'Предметы'],
    ['mk', '🏷', 'Рынок'], ['lab', '🧪', 'Лаба'], ['world', '🌐', 'Сервер'], ['core', '🧬', 'Ядро'], ['tasks', '📋', 'Задания'], ['stats', '📊', 'Стата'],
  ];

  /* ---------- железо стойки и зал ---------- */
  const rr = (a, b) => (a + Math.random() * (b - a)).toFixed(2);
  // один юнит: винты, 4 корзины дисков с лампочками активности, решётка, кулер, питание
  const rackUnit = () => `<span class="dc-srv"><i class="scr"></i>
    <span class="bays">${[0, 1, 2, 3].map(() => `<b><u style="--k:${rr(0.25, 1.4)};--d:-${rr(0, 2)}s"></u></b>`).join('')}</span>
    <span class="vent"></span><span class="fan"><i style="--d:-${rr(0, 1)}s"></i></span>
    <span class="pwr"></span><i class="scr"></i></span>`;

  // «твой зал»: чем больше железа, тем больше стоек; цвет — по локации
  const LOC_HUE = [70, 45, 150, 190, 210, 30, 265, 320, 220, 50, 290, 140];
  function renderHall(p) {
    const total = Object.values(p.hw).reduce((a, b) => a + b, 0);
    const n = Math.min(16, Math.max(1, Math.ceil(Math.sqrt(total))));
    put('dc-hall', `<div class="dc-hall-h"><span>ТВОЙ ЗАЛ · ${D.LOCS[p.loc].name.toUpperCase()}</span><b>${total} ед.</b></div>
      <div class="dc-hall-row" style="--hh:${LOC_HUE[p.loc]}">${Array.from({ length: n }, (_, i) => `<i style="--d:-${(i * 0.37) % 2}s">${'<em></em>'.repeat(5)}</i>`).join('')}</div>`);
  }

  // график дохода за последние ~2 минуты
  const spark = [];
  let sparkAt = 0;
  function drawSpark(inc) {
    if (Date.now() - sparkAt > 2000) { sparkAt = Date.now(); spark.push(inc); if (spark.length > 60) spark.shift(); }
    const cv = $('#dc-spark');
    if (!cv || !cv.clientWidth) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth * dpr, h = cv.clientHeight * dpr;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d');
    g.clearRect(0, 0, w, h);
    if (spark.length < 2) return;
    const max = Math.max(...spark) || 1, min = Math.min(...spark);
    const span = max - min || max;
    const pts = spark.map((v, i) => [(i / (spark.length - 1)) * w, h - 3 * dpr - ((v - min) / span) * (h - 8 * dpr)]);
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(228,240,126,.35)'); grad.addColorStop(1, 'rgba(228,240,126,0)');
    g.beginPath(); g.moveTo(pts[0][0], h);
    pts.forEach(([x, y]) => g.lineTo(x, y));
    g.lineTo(w, h); g.closePath(); g.fillStyle = grad; g.fill();
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = '#e4f07e'; g.lineWidth = 1.6 * dpr; g.stroke();
    const [lx, ly] = pts[pts.length - 1];
    g.beginPath(); g.arc(lx - 2 * dpr, ly, 2.5 * dpr, 0, 7); g.fillStyle = '#fff'; g.fill();
  }

  // плавный счётчик кредитов
  let shown = 0, target = 0;
  (function tween() {
    requestAnimationFrame(tween);
    const el = view.mode === 'game' && document.getElementById('dc-cr');
    if (!el) return;
    shown = Math.abs(target - shown) < 1 ? target : shown + (target - shown) * 0.22;
    el.textContent = fmt(shown);
  })();

  /* ---------- звук ---------- */
  const SND = window.DCSound;
  const sndPrefs = Object.assign({ vol: 0.7, muted: false }, A.load('qb.dc.snd', {}));
  if (SND) { SND.setVol(sndPrefs.vol); SND.setMuted(sndPrefs.muted); }
  const sfx = (...a) => SND && SND.play(...a);
  const soundCtl = () => SND ? `<div class="dc-snd"><button class="dc-mini" data-mute title="Звук серверной">${sndPrefs.muted ? '🔇' : '🔊'}</button><input type="range" id="dc-vol" min="0" max="100" value="${Math.round(sndPrefs.vol * 100)}" title="Громкость"></div>` : '';
  // фон серверной звучит, только пока открыта игра
  setInterval(() => {
    if (!SND) return;
    const on = view.mode === 'game' && !!root.offsetParent && !!S && !S.over;
    SND.ambient(on);
    const p = S && S.players[me];
    if (on && p) SND.update({ heat: p.heat, oc: p.oc, load: Object.values(p.hw).reduce((a, b) => a + b, 0), act: Date.now() - lsAt < 1500 ? 1 : 0 });
  }, 500);

  function buildGame() {
    view.mode = 'game';
    view.cache = {};
    view.tweened = false;
    view.evKey = undefined;
    view.lastMul = 1;
    setTimeout(() => sfx('boot'), 150);
    root.innerHTML = `
      <div class="dc-game">
        <header class="dc-bar">
          <div class="dc-room"><span class="dc-led"></span><span>КОМНАТА</span><b id="dc-code"></b><button class="dc-mini" data-copy title="Скопировать код">⧉</button></div>
          <div class="dc-online" id="dc-online"></div>
          <div class="dc-clock" id="dc-clock"></div>
          ${soundCtl()}
          <button class="dc-mini dc-leave" data-leave>Выйти</button>
        </header>
        <div class="dc-grid">
          <section class="dc-col dc-left">
            <div class="dc-node">
              <div class="dc-node-top">
                <div class="dc-cr"><small>КРЕДИТЫ</small><b id="dc-cr">0</b><span id="dc-inc"></span></div>
                <canvas class="dc-spark" id="dc-spark"></canvas>
              </div>
              <div class="dc-hall" id="dc-hall"></div>
              <button class="dc-rack" id="dc-rack" title="Клик или пробел">
                <span class="dc-lcd"><span id="dc-lcd-l">BOOT…</span><span id="dc-lcd-r"></span></span>
                ${[0, 1, 2, 3, 4].map(() => rackUnit()).join('')}
                <span class="dc-rack-glow"></span><span class="dc-rack-sheen"></span>
                <span class="dc-cpop" id="dc-cpop"></span>
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
        <div class="dc-vig"></div>
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
    target = p.cr + predicted;
    if (Math.abs(target - shown) > target * 0.5 + 1e3 && !view.tweened) shown = target;
    view.tweened = true;
    put('dc-inc', `+${fmt(c.inc)}/с · клик ${fmt(c.click)}`);
    drawSpark(c.inc);
    renderHall(p);
    const rack = $('#dc-rack');
    const mul = E.comboMul({ streak: localStreak() }, c.comboCap);
    const dead = t < p.down || t < p.ddos;
    const load = dead ? 0 : Math.min(99, Math.round(18 + Math.min(1, (t - p.lastClk < 1500 ? 0.5 : 0) + mul / 20 + p.oc / 5) * 81));
    rack.style.setProperty('--spd', `${Math.max(0.12, 1.2 / mul)}s`);
    rack.style.setProperty('--fan', `${Math.max(0.12, 0.9 - p.heat / 140 - p.oc * 0.12)}s`);
    rack.classList.toggle('hot', p.heat > 70);
    rack.classList.toggle('dead', dead);
    rack.classList.toggle('oc', p.oc >= 2);
    $('#dc-lcd-l').textContent = dead ? (t < p.down ? '!! THERMAL SHUTDOWN' : '!! LINK DOWN') : `LOAD ${load}%  ×${mul}`;
    $('#dc-lcd-r').textContent = `${Math.round(24 + p.heat * 0.7)}°C`;
    $('.dc-game', root).classList.toggle('boss-on', !!S.boss);
    // звуки глобальных событий
    const evKey = S.event && S.event.id + S.event.until;
    if (view.evKey !== undefined && evKey && evKey !== view.evKey) sfx('event');
    view.evKey = evKey || null;
    let st = '';
    if (t < p.down) st = `<div class="dc-st bad">🔥 ПЕРЕГРЕВ · ${mmss(p.down - t)}</div>`;
    else if (t < p.ddos) st = `<div class="dc-st bad">🌊 DDoS от ${esc((S.players[p.ddosBy] || {}).nick || '?')} · клики не работают, доход −60% · ${mmss(p.ddos - t)}</div>`;
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
        <div class="lb-main"><b>${allyTag(x)}${esc(x.nick)}${clicking ? '<i class="lb-click">⚡</i>' : ''}${bty ? `<i class="lb-bty">🎯${fmt(bty.pool)}</i>` : ''}</b><small>${D.LOCS[x.loc].icon} ${fmt(c.inc)}/с${x.coresAll ? ` · 🧬${x.coresAll}` : ''}</small></div>
        <span class="lb-s">${fmt(x.score)}</span></div>`;
    }).join(''));
  }

  /* ---------- вкладки ---------- */
  const can = (p, cost) => (p.cr >= cost ? '' : 'off');
  const PANELS = {
    hw(p, c) {
      const vis = D.HW.filter((h) => h.loc <= p.loc + 1);
      put('dc-panel', `<div class="dc-ph"><b>Железо</b><div class="dc-seg sm">${[1, 10, 'max'].map((n) => `<button data-hwn="${n}" class="${view.hwN === n ? 'on' : ''}">${n === 'max' ? 'MAX' : '×' + n}</button>`).join('')}</div></div>
        ${hint('Железо приносит кредиты каждую секунду, даже когда ты не кликаешь. Каждая следующая штука дороже на 15%. Новое железо открывается при переезде.')}
        <div class="dc-list">${vis.map((h) => {
          const n = p.hw[h.id] || 0, locked = h.loc > p.loc;
          const x2 = (c.hwM && c.hwM[h.id]) || 1;
          let cost = 0;
          const cnt = view.hwN === 'max' ? 1 : view.hwN;
          for (let k = 0; k < cnt; k++) cost += E.hwCost(p, h, c, k);
          return `<div class="dc-row ${locked ? 'locked' : ''}">
            <span class="dc-ic">${h.icon}</span>
            <div class="dc-rt"><b>${esc(h.name)} <em>${n}</em></b><small>${locked ? `🔒 ${D.LOCS[h.loc].name}` : `${esc(h.d)} · +${fmt(h.rate * x2)}/с за шт.${x2 > 1 ? ` <span class="nx">тюнинг ×${x2}</span>` : ''}`}</small></div>
            ${locked ? '' : `<button class="dc-buy ${can(p, cost)}" data-hw="${h.id}">${fmt(cost)}</button>`}
          </div>`;
        }).join('')}</div>`);
    },
    up(p) {
      const avail = D.UPG.filter((u) => !p.up.includes(u.id) && u.loc <= p.loc && (!u.need || (p.hw[u.hw] || 0) >= u.need / 2)).sort((a, b) => a.cost - b.cost);
      const done = D.UPG.filter((u) => p.up.includes(u.id));
      put('dc-panel', `<div class="dc-ph"><b>Апгрейды</b><small>куплено ${done.length}/${D.UPG.length}</small></div>
        ${hint('Разовые покупки навсегда (до Reboot): множители клика и дохода, охлаждение. «Тюнинг» удваивает доход железа, когда его 10+ штук.')}
        <div class="dc-cards">${avail.map((u) => {
          const need = u.need && (p.hw[u.hw] || 0) < u.need;
          return `<button class="dc-card ${need ? 'locked' : can(p, u.cost)}" data-up="${u.id}"><span>${u.icon}</span><b>${esc(u.name)}</b><small>${esc(u.d)}${need ? ` · есть ${p.hw[u.hw] || 0}` : ''}</small><em>${fmt(u.cost)}</em></button>`;
        }).join('') || '<div class="dc-empty">Всё доступное куплено. Переезжай дальше.</div>'}</div>
        ${done.length ? `<div class="dc-done">${done.map((u) => `<span title="${esc(u.name)}: ${esc(u.d)}">${u.icon}</span>`).join('')}</div>` : ''}`);
    },
    hack(p, c, t, ps) {
      if (p.loc < 2) return put('dc-panel', lockBox(2, 'Хакинг, защита и bounty'));
      const cd = Math.max(0, (p.cd.atk || 0) - t);
      const A = D.ATK.find((a) => a.id === view.kind);
      const others = ps.filter((x) => x.id !== me).sort((a, b) => b.score - a.score);
      const pc = (v) => `${Math.round(v * 100)}%`;
      const sec = (ms) => `${Math.round(ms / 1000)} с`;
      const noAtk = c.ev && c.ev.noAtk;
      put('dc-panel', `<div class="dc-ph"><b>Хакинг</b>${cd ? `<span class="dc-cdpill">⏳ перезарядка ${mmss(cd)}</span>` : '<span class="dc-cdpill ok">● ГОТОВ К АТАКЕ</span>'}</div>
        <div class="dc-atks">${D.ATK.map((a) => `<button data-kind="${a.id}" class="dc-atk ${view.kind === a.id ? 'on' : ''}"><span>${a.icon}</span><b>${a.name}</b><small>${a.short}</small></button>`).join('')}</div>
        <div class="dc-how"><b>${A.icon} ${A.name} — как работает</b><ul>${A.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
          <div class="dc-mystats"><span>Сила атаки <b>${pc(c.hit)}</b></span><span>Кража <b>${(c.steal * 100).toFixed(1)}%</b></span><span>Перезарядка <b>${mmss(c.cd)}</b></span></div>
          <small>Одна перезарядка на все атаки. Шанс = твоя сила атаки − защита цели (10–95%).</small></div>
        ${noAtk ? '<div class="dc-st bad">🚓 Маски-шоу в датацентре — атаки временно запрещены</div>' : ''}
        <div class="dc-ph"><b>Цели</b><small>прогноз для «${A.name}»</small></div>
        <div class="dc-list">${others.map((x) => {
          const f = E.forecast(S, p, x, t);
          let why = '';
          if (x.loc < 2) why = '🍼 новичок — защищён до Серверной';
          else if (t < x.shield) why = `🛡 под щитом ${mmss(x.shield - t)}`;
          else if (t - x.lastHit < 45e3) why = `💨 только что ограбили · ${mmss(45e3 - (t - x.lastHit))}`;
          else if (view.kind !== 'hack' && !x.on) why = '⚫ не в сети — только взлом';
          else if (view.kind === 'ddos' && f.ddos.immune) why = '🏰 Крепость — DDoS не берёт';
          if (f.ally) why = '🤝 союзник — атаковать нельзя';
          const bty = S.bounty[x.id];
          let gain = '';
          if (view.kind === 'hack') gain = `украдёшь ≈ <b>${fmt(f.hack.amt)}</b> <i>(${(f.hack.pct * 100).toFixed(1)}%)</i>`;
          else if (view.kind === 'ddos') gain = `ляжет на <b>${sec(f.ddos.dur)}</b> · тебе ≈ <b>${fmt(f.ddos.gain)}</b>`;
          else gain = `${sec(f.virus.dur)} на зачистку · провал = <b>+${fmt(f.virus.amt)}</b>`;
          const chCls = f.chance >= 0.6 ? 'hi' : f.chance >= 0.35 ? 'mid' : 'lo';
          const defs = [['🧱', f.block, 'отбивает'], ['🕶', f.proxy, 'Proxy режет кражу'], ['💾', f.prot, 'спрятано от кражи'], ['🛡', f.ddosRed, 'Анти-DDoS']]
            .map(([i, v, tip]) => `<span class="${v ? '' : 'z'}" title="${tip}">${i} ${pc(v)}</span>`).join('');
          return `<div class="dc-tgt ${why ? 'dis' : ''}">
            <div class="dc-tgt-top">${ava(x)}
              <div class="dc-rt"><b>${esc(x.nick)} ${bty ? `<i class="lb-bty">🎯 ${fmt(bty.pool)}</i>` : ''}${t < x.ddos ? '<i class="lb-bty">🌊 лежит</i>' : ''}</b><small>${fmt(x.cr)} кр · ${D.LOCS[x.loc].icon} ${D.LOCS[x.loc].name}${x.on ? '' : ' · оффлайн'}</small></div>
              <button class="dc-buy ghost" data-bty="${x.id}" title="Назначить награду за взлом">🎯 Bounty</button>
            </div>
            <div class="dc-defs">${defs}</div>
            ${why ? `<div class="dc-why">${why}</div>` : `<div class="dc-fc">
              <div class="dc-chance ${chCls}"><span>шанс <b>${f.sure ? '100% ☁' : pc(f.chance)}</b></span><i><u style="width:${f.chance * 100}%"></u></i></div>
              <span class="dc-gain">${gain}</span>
              <button class="dc-buy red ${cd || noAtk ? 'off' : ''}" data-atk="${x.id}">${A.icon} ${A.name}</button></div>`}
          </div>`;
        }).join('') || '<div class="dc-empty">В комнате пока никого. Кинь кентам код комнаты.</div>'}</div>
        <div class="dc-ph"><b>Твоя защита</b><small>отбиваешь ${pc(c.block)} · спрятано ${pc(c.prot)}</small></div>
        <div class="dc-list">${D.DEF.map((d) => {
          const l = p.def[d.id] || 0, cost = E.defCost(p, d), max = l >= d.max;
          return `<div class="dc-row"><span class="dc-ic">${d.icon}</span><div class="dc-rt"><b>${d.name} <em>${l}/${d.max}</em></b>
            <small>${l ? `Сейчас: ${d.d(l)}` : 'Нет защиты'}${max ? '' : ` → <span class="nx">${d.d(l + 1)}</span>`}</small></div>
            ${max ? '<span class="dc-why">MAX</span>' : `<button class="dc-buy ${can(p, cost)}" data-def="${d.id}">${fmt(cost)}</button>`}</div>`;
        }).join('')}</div>`);
    },
    inv(p, c) {
      const slots = c.slots;
      const sel = p.items.find((i) => i.u === view.sel);
      const b = E.itemBonus(p);
      put('dc-panel', `<div class="dc-ph"><b>Предметы</b><small>${p.items.length}/40 · слотов ${p.eq.length}/${slots}</small></div>
        ${hint('Бонусы дают только надетые предметы (метка ON). Нажми на предмет: надеть, продать, выставить на рынок или сплавить. ⚒ — есть 3 одинаковых, можно сплавить в ★.')}
        ${p.loc >= 1 ? `<button class="dc-case ${can(p, c.casePrice)}" data-case><span>📦</span><div><b>Открыть кейс</b><small>шанс прототипа 0.2% · удача ×${c.luck.toFixed(2)}</small></div><em>${fmt(c.casePrice)}</em></button>` : lockBox(1, 'Кейсы')}
        <small class="dc-note">Надето: ${bonusTxt(Object.fromEntries(Object.entries(b).filter(([, v]) => v))) || 'ничего'}</small>
        <div class="dc-inv">${p.items.slice().sort((x, y) => D.RAR.indexOf(D.ITEMS[y.k].r) - D.RAR.indexOf(D.ITEMS[x.k].r)).map((it) => {
          const t = D.ITEMS[it.k];
          const dup = p.items.filter((i) => i.k === it.k && (i.s || 0) === (it.s || 0)).length;
          return `<button class="dc-item r-${t.r} ${p.eq.includes(it.u) ? 'eq' : ''} ${view.sel === it.u ? 'sel' : ''}" data-item="${it.u}"><span>${D.TYPE_ICON[t.t]}</span><b>${esc(t.n)}</b><small>${R[t.r].name}${stars(it)}</small>${dup >= 3 && (it.s || 0) < D.STAR_MAX ? '<em class="dc-canmerge" title="Можно сплавить">⚒</em>' : ''}</button>`;
        }).join('') || '<div class="dc-empty">Пусто. Кейсы, боссы и контракты дают предметы.</div>'}</div>
        ${sel ? (() => {
          const t = D.ITEMS[sel.k], on = p.eq.includes(sel.u);
          const m = E.starMul(p, sel), sb = Object.fromEntries(Object.entries(t.b).map(([k, v]) => [k, v * m]));
          const dup = p.items.filter((i) => i !== sel && i.k === sel.k && (i.s || 0) === (sel.s || 0)).length;
          const canMerge = (sel.s || 0) < D.STAR_MAX;
          return `<div class="dc-itemcard r-${t.r}"><div><b>${esc(t.n)} ${stars(sel)}</b><small>${R[t.r].name} · ${t.t} · ${bonusTxt(sb)}</small></div>
            <div class="dc-acts"><button class="dc-buy" data-${on ? 'uneq' : 'eq'}="${sel.u}">${on ? 'Снять' : 'Надеть'}</button>
            ${canMerge ? `<button class="dc-buy ${dup >= 2 ? '' : 'off'}" data-merge="${sel.u}" title="3 одинаковых предмета одной звёздности → один на ★ выше (+${p.loc >= 10 ? 75 : 50}% к бонусам за звезду)">⚒ Сплавить ${dup + 1}/3</button>` : ''}
            <button class="dc-buy ghost" data-sell="${sel.u}">Продать · ${fmt(Math.round(c.casePrice * R[t.r].mul * c.sellMul * Math.pow(3, sel.s || 0)))}</button>
            <button class="dc-buy ghost" data-list="${sel.u}">На рынок</button></div></div>`;
        })() : ''}`);
    },
    mk(p, c, t) {
      const lots = S.market.filter((l) => !l.to || l.to === me || l.seller === me);
      const bmLeft = 600e3 - ((t - S.created) % 600e3);
      put('dc-panel', `<div class="dc-ph"><b>Рынок игроков</b><small>комиссия 5%</small></div>
        ${hint('Здесь лоты других игроков. Свой предмет выставляешь во вкладке «Предметы» — всем или лично одному кенту.')}
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
      const cb = E.coreBonus(p);
      put('dc-panel', `<div class="dc-ph"><b>Ядро</b><small>🧬 ${fmt(p.cores)} свободно · всего ${fmt(p.coresAll)} (доход ×${cb.toFixed(2)})${p.sing ? ` · 🕳 ×${p.sing + 1}` : ''}</small></div>
        ${hint('Reboot сбрасывает прогресс, но даёт ядра 🧬. Ядра навсегда множат доход и тратятся на дерево ниже. Ядра считаются от всего, что ты заработал за ночь, поэтому ребутаться выгодно, когда ядер прибавится заметно.')}
        <div class="dc-reboot"><div><b>♻ Reboot</b><small>Сбросит кредиты, железо, апгрейды, защиту и локацию. Предметы, ядра и дерево останутся.${p.loc < 3 ? ' Доступно с Датацентра.' : ''}</small></div>
          <button class="dc-buy red ${p.loc >= 3 && g >= 1 ? '' : 'off'}" data-reboot>+${g} 🧬</button></div>
        <small class="dc-note">Заработано за ночь ${fmt(p.life || 0)} · следующее ядро на ${fmt(E.nextCoreAt(p))}${g ? ` · после Reboot доход ×${Math.pow(1 + p.coresAll + g, 0.55).toFixed(2)}` : ''}</small>
        <div class="dc-tree">${Object.entries(D.TREE).map(([k, br]) => `<div class="dc-br" style="--c:${br.color}"><div class="dc-br-h">${br.name}</div>${br.nodes.map((n, i) => {
          const got = p.tree.includes(n.id), prev = i === 0 || p.tree.includes(br.nodes[i - 1].id);
          const lockR = (i >= 3 && p.loc < 5) || (i >= 5 && p.loc < 9);
          return `<button class="dc-nd ${got ? 'got' : prev && !lockR && p.cores >= n.c ? 'can' : 'off'}" data-tree="${n.id}" title="${lockR ? (i >= 5 ? 'Откроется на Сфере Дайсона' : 'Откроется в Подземном ДЦ') : ''}"><b>${esc(n.name)}</b><small>${esc(n.d)}</small><em>${got ? '✓' : lockR ? (i >= 5 ? '☀' : '⛏') : n.c + ' 🧬'}</em></button>`;
        }).join('')}</div>`).join('')}</div>
        ${p.loc >= 6 ? `<div class="dc-reboot"><div><b>🛰 Орбитальный бафф</b><small>Всем +25% дохода на 2 минуты, тебе ×2. Раз в 10 минут.</small></div><button class="dc-buy ${t < (p.cd.orb || 0) ? 'off' : ''}" data-orbit>${t < (p.cd.orb || 0) ? mmss(p.cd.orb - t) : 'Запуск'}</button></div>` : ''}
        ${p.loc >= 7 ? `<div class="dc-reboot q"><div><b>⚛ Коллапс волновой функции</b><small>55% — кредиты ×2 (максимум +30 минут дохода). 45% — минус половина. Раз в 5 минут.</small></div><button class="dc-buy red ${t < (p.cd.qc || 0) ? 'off' : ''}" data-qc>${t < (p.cd.qc || 0) ? mmss(p.cd.qc - t) : 'Схлопнуть'}</button></div>` : ''}
        ${p.loc >= 11 ? `<div class="dc-reboot q"><div><b>🕳 Сингулярность #${p.sing + 1}</b><small>Сбросит ВСЁ, включая ядра и дерево. Останутся предметы и исследования. Взамен доход ×${p.sing + 2} навсегда.</small></div><button class="dc-buy red" data-sing>Войти</button></div>` : ''}`);
    },
    lab(p, c, t) {
      if (c.labSlots < 1) return put('dc-panel', lockBox(5, 'Лаборатория'));
      const done = new Set(p.res);
      const evRes = c.ev && c.ev.resMul;
      put('dc-panel', `<div class="dc-ph"><b>Лаборатория</b><small>слотов ${p.lab.length}/${c.labSlots} · изучено ${p.res.length}/${D.RES.length}</small></div>
        ${hint('Исследования идут в реальном времени и остаются навсегда — даже после Reboot. Одновременно — столько, сколько слотов (2-й слот с Лунной базы).')}
        ${evRes ? '<div class="dc-st good">🏛 Госгрант: исследования идут ×3 быстрее</div>' : ''}
        ${p.lab.map((j) => {
          const r = D.RES.find((x) => x.id === j.id);
          return `<div class="dc-lab"><span>${r.icon}</span><div><b>${esc(r.name)}</b><small>${esc(r.d)}</small><div class="bar cmb"><i style="width:${(1 - j.left / j.total) * 100}%"></i></div></div><time>${mmss(j.left)}</time></div>`;
        }).join('')}
        <div class="dc-cards">${D.RES.map((r) => {
          const has = done.has(r.id), run = p.lab.some((j) => j.id === r.id);
          const cost = D.resCost(r, c.stable);
          return `<button class="dc-card ${has ? 'got' : run ? 'locked' : p.lab.length >= c.labSlots ? 'off' : can(p, cost)}" data-res="${r.id}"><span>${r.icon}</span><b>${esc(r.name)}</b><small>${esc(r.d)} · ${r.min} мин</small><em>${has ? '✓ изучено' : run ? 'идёт…' : fmt(cost)}</em></button>`;
        }).join('')}</div>`);
    },
    world(p, c, t, ps) {
      const allies = Object.values(S.allies || {});
      const mega = S.mega || { lvl: 0, prog: 0 };
      const maxed = mega.lvl >= D.MEGA_STAGES.length;
      const goal = maxed ? 1 : D.megaGoal(mega.lvl);
      const cap = Math.max(2, Math.ceil(ps.length / 2));
      const myA = p.ally && S.allies[p.ally];
      const top = ps.filter((x) => x.st.mega).sort((a, b) => b.st.mega - a.st.mega).slice(0, 5);
      put('dc-panel', `<div class="dc-ph"><b>🏗 Мега-ДЦ</b><small>общий проект комнаты · ур. ${mega.lvl}/${D.MEGA_STAGES.length} · всем +${mega.lvl * 10}% дохода</small></div>
        ${hint('Скидывайтесь всей комнатой: каждый построенный этап навсегда даёт ВСЕМ +10% дохода. Кто вложил больше всех — получит награду утром.')}
        <div class="dc-mega">
          <div class="dc-mega-stages">${D.MEGA_STAGES.map((n, i) => `<i class="${i < mega.lvl ? 'done' : i === mega.lvl ? 'cur' : ''}" title="${esc(n)}"></i>`).join('')}</div>
          ${maxed ? '<b>Мега-ДЦ достроен! 🎉</b>' : `<b>Этап ${mega.lvl + 1}: ${esc(D.MEGA_STAGES[mega.lvl])}</b>
          <div class="bar cmb"><i style="width:${Math.min(100, (mega.prog / goal) * 100)}%"></i></div>
          <small>${fmt(mega.prog)} / ${fmt(goal)}</small>
          <div class="dc-acts">${[0.1, 0.25, 0.5, 1].map((k) => `<button class="dc-buy ${p.cr >= 1000 ? '' : 'off'}" data-mega="${k}">${k === 1 ? 'ВСЁ' : k * 100 + '%'} · ${fmt(p.cr * k)}</button>`).join('')}</div>`}
          ${top.length ? `<div class="dc-boss-top">${top.map((x, i) => `<span>${i + 1}. ${esc(x.nick)} <b>${fmt(x.st.mega)}</b></span>`).join('')}</div>` : ''}
        </div>
        <div class="dc-ph"><b>🤝 Альянсы</b><small>до ${cap} человек · +5% дохода за союзника в сети</small></div>
        ${hint('Союзников нельзя атаковать. Каждый союзник в сети даёт +5% к доходу всем в альянсе. Утром — награда лучшему альянсу по сумме очков.')}
        ${myA ? `<div class="dc-ally me" style="--ah:${myA.hue}"><div><b>[${esc(myA.name)}]</b><small>${myA.members.map((id) => esc((S.players[id] || {}).nick || '?')).join(', ')} · бонус +${Math.round(c.ally * 100)}%</small></div><button class="dc-buy ghost" data-allyleave>Выйти</button></div>`
          : '<button class="dc-btn big ghost" data-allynew>🤝 Основать свой альянс</button>'}
        <div class="dc-list">${allies.filter((a) => a !== myA).map((a) => {
          const sum = a.members.reduce((x, id) => x + ((S.players[id] || {}).score || 0), 0);
          return `<div class="dc-ally" style="--ah:${a.hue}"><div><b>[${esc(a.name)}]</b><small>${a.members.map((id) => esc((S.players[id] || {}).nick || '?')).join(', ')} · ${fmt(sum)} очков</small></div>
            ${myA ? '' : `<button class="dc-buy ${a.members.length >= cap ? 'off' : ''}" data-allyjoin="${a.id}">${a.members.length >= cap ? 'Полный' : 'Вступить'}</button>`}</div>`;
        }).join('') || (myA ? '' : '<div class="dc-empty">Альянсов пока нет — основай первый.</div>')}</div>`);
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
        ['Атак', (x) => `${x.st.attacks} (${x.st.atkOk}✓)`], ['Урон боссам', (x) => fmt(x.st.boss)], ['Кейсов', (x) => x.st.cases], ['Потратил', (x) => fmt(x.st.spent)], ['Перегревов', (x) => x.st.overheats], ['Reboot', (x) => x.st.reboots], ['Сингулярность', (x) => x.sing || 0], ['Исследований', (x) => (x.res || []).length], ['В Мега-ДЦ', (x) => fmt(x.st.mega || 0)], ['Ачивок', (x) => x.ach.length]];
      const list = ps.slice().sort((a, b) => b.score - a.score);
      put('dc-panel', `<div class="dc-ph"><b>Статистика ночи</b></div><div class="dc-tbl"><table><tr><th></th>${list.map((x) => `<th class="${x.id === me ? 'me' : ''}">${esc(x.nick)}</th>`).join('')}</tr>
        ${rows.map(([n, f]) => `<tr><td>${n}</td>${list.map((x) => `<td class="${x.id === me ? 'me' : ''}">${f(x)}</td>`).join('')}</tr>`).join('')}</table></div>`);
    },
  };

  /* ---------- клик по ноде ---------- */
  let ls = 0, lsAt = 0;
  const localStreak = () => (Date.now() - lsAt < 1200 ? ls : 0);

  // эффекты кликов дешёвые и с ограничением частоты, чтобы автокликер не клал интерфейс
  let fxRect = null, fxRectAt = 0;
  const fxBase = () => {
    if (!fxRect || Date.now() - fxRectAt > 500) { const fx = $('#dc-fx'); fxRect = fx && fx.getBoundingClientRect(); fxRectAt = Date.now(); }
    return fxRect;
  };
  function floatText(x, y, txt, cls = '') {
    const fx = $('#dc-fx'), base = fxBase();
    if (!fx || !base || fx.childElementCount > 40) return;
    const el = document.createElement('span');
    el.className = 'dc-float ' + cls;
    el.textContent = txt;
    const z = view.z || 1;
    el.style.left = `${(x - base.left) / z + (Math.random() * 30 - 15)}px`;
    el.style.top = `${(y - base.top) / z - 10}px`;
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  // «пакеты данных» разлетаются от клика
  function packets(x, y, n, color) {
    const fx = $('#dc-fx'), base = fxBase();
    if (!fx || !base || fx.childElementCount > 40) return;
    const z = view.z || 1;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      el.className = 'dc-pkt';
      const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
      el.style.cssText = `left:${(x - base.left) / z}px;top:${(y - base.top) / z}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 30}px;--c:${color}`;
      fx.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }
  }

  const CLICK_CAP = 25; // столько кликов в секунду засчитывает хост
  const fxs = { sec: 0, n: 0, floatAt: 0, acc: 0, accMul: 1, sndAt: 0, tapAt: 0 };
  function nodeClick(x, y, boss) {
    if (!S || S.over) return;
    const p = S.players[me];
    if (!p) return;
    const t = now(), ms = Date.now();
    if (t < p.down || t < p.ddos) { if (ms - fxs.floatAt > 300) { fxs.floatAt = ms; floatText(x, y, t < p.down ? '🔥 перегрев' : '🌊 DDoS', 'bad'); } return; }
    const sec = Math.floor(ms / 1000);
    if (fxs.sec !== sec) { fxs.sec = sec; fxs.n = 0; }
    if (++fxs.n > CLICK_CAP) return; // лишние клики автокликера всё равно не засчитаются
    const c = E.calc(p, S, t);
    ls = ms - lsAt < 1200 ? ls + 1 : 1;
    lsAt = ms;
    const mul = E.comboMul({ streak: ls }, c.comboCap);
    const g = boss ? c.click * c.bossMul * Math.sqrt(mul) : c.click * mul;
    if (boss) pendBoss++;
    else { pendClicks++; predicted += g; }
    // цифры: не чаще ~12 в секунду, остальное копим в одну
    fxs.acc += g; fxs.accMul = mul;
    if (ms - fxs.floatAt > 80) {
      fxs.floatAt = ms;
      if (boss) floatText(x, y, `−${fmt(fxs.acc)}`, 'boss');
      else floatText(x, y, `+${fmt(fxs.acc)}${mul > 1 ? ` ×${mul}` : ''}`, mul >= 10 ? 'x10' : mul >= 5 ? 'x5' : '');
      packets(x, y, boss ? 2 : mul >= 10 ? 4 : 2, boss ? '#ff5f5f' : mul >= 10 ? '#ffb340' : mul >= 5 ? '#6bc9ff' : '#e4f07e');
      fxs.acc = 0;
    }
    if (ms - fxs.sndAt > 55) { fxs.sndAt = ms; sfx(boss ? 'bossHit' : 'click', mul); }
    if (mul > (view.lastMul || 1)) {
      const pop = $('#dc-cpop');
      if (pop) {
        pop.textContent = `COMBO ×${mul}`;
        pop.className = `dc-cpop x${mul}`;
        pop.animate([{ opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1.15, offset: 0.2 }, { opacity: 1, scale: 1, offset: 0.7 }, { opacity: 0, scale: 1.05, translate: '-50% -90%' }], { duration: 900, easing: 'cubic-bezier(.2,1.3,.4,1)' });
      }
      sfx('combo', mul);
    }
    view.lastMul = mul;
    const rack = !boss && ms - fxs.tapAt > 90 && $('#dc-rack');
    if (rack) { fxs.tapAt = ms; rack.animate([{ transform: 'scale(1)' }, { transform: 'scale(.975)' }, { transform: 'scale(1)' }], { duration: 110 }); }
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
      sfx('squash');
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
        const d = D.AWARDS.find((x) => x.id === a.id) || { icon: '🤝', name: 'Альянс ночи', d: 'очков на команду' };
        return `<div class="dc-award ${a.id === 'king' ? 'king' : ''} ${a.pid === me ? 'me' : ''}"><span>${d.icon}</span><b>${esc(d.name)}</b><em>${esc(a.nick)}</em><small>${fmt(a.v)} ${d.d}</small></div>`;
      }).join('')}</div>
      <div class="dc-podium">${ps.map((x, i) => `<div class="${x.id === me ? 'me' : ''}"><span>${i + 1}</span>${ava(x)}<b>${esc(x.nick)}</b><em>${fmt(x.score)}</em></div>`).join('')}</div>
      <div class="dc-acts"><button class="dc-buy ghost" data-close>Посмотреть стату</button><button class="dc-buy" data-leave>В лобби</button></div>
    </div>`, 'final');
  }

  /* ---------- личные сообщения ---------- */
  function onPm(m) {
    if (m.kind === 'note') { A.toast(m.txt); sfx('coin'); }
    else if (m.kind === 'err') { A.toast(m.txt); sfx('err'); }
    else if (m.kind === 'hit') { A.toast('⚠ ' + m.txt); flash('hit'); sfx('hit'); }
    else if (m.kind === 'drop') { showDrop(m.item, m.src); const r = D.ITEMS[m.item.k].r; sfx(r === 'c' || r === 'r' ? 'coin' : 'drop', r); }
    else if (m.kind === 'ach') { A.toast(`🏆 Ачивка: ${D.ACH[m.id][0]}`); sfx('event'); }
    else if (m.kind === 'virus') { showVirus(m.vid, m.nick, m.dur); sfx('virus'); }
    else if (m.kind === 'boss') { sfx('boss'); A.toast('☠ Босс появился! Все на рейд'); if (!root.offsetParent && window.qb && window.qb.notify) window.qb.notify('Ночной дата-центр', 'Появился босс — все на рейд!', 'dc'); }
    else if (m.kind === 'overheat') { A.toast('🔥 Перегрев! Сервер остывает 15 с'); flash('hot'); sfx('alarm'); }
    else if (m.kind === 'reboot') { A.toast(`♻ Reboot: +${m.g} ядер`); flash('reboot'); sfx('reboot'); }
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
  function rememberRoom(code) {
    const list = [code, ...rooms().filter((c) => c !== code)];
    // снапшоты старых комнат удаляем, чтобы файл данных не пух
    list.slice(6).forEach((c) => A.store(snapKey(c), undefined));
    A.store('qb.dc.rooms', list.slice(0, 6));
  }
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
          <div class="dc-feats">${['⚡ комбо до ×15', '💀 взломы и DDoS', '☠ боссы и рейды', '🎁 кейсы, прототипы и ★', '🏷 рынок между игроками', '🎯 bounty', '🤝 альянсы', '🧪 исследования', '🏗 общий Мега-ДЦ', '🗺 12 локаций', '♻ престиж и сингулярность', '🌅 финал утром'].map((f) => `<span>${f}</span>`).join('')}</div>
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
    if ('mute' in d) {
      sndPrefs.muted = !sndPrefs.muted;
      SND.unlock(); SND.setMuted(sndPrefs.muted); A.store('qb.dc.snd', sndPrefs);
      el.textContent = sndPrefs.muted ? '🔇' : '🔊';
      return;
    }
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
      merge: () => act({ a: 'merge', u: +d.merge }), res: () => act({ a: 'res', id: d.res }),
      mega: () => act({ a: 'mega', amt: Math.floor(S.players[me].cr * +d.mega) }),
      allynew: () => modal('<b>🤝 Новый альянс</b><small>Союзников нельзя атаковать, каждый в сети даёт +5% дохода</small><input class="dc-inp" id="dc-ally-name" maxlength="16" placeholder="Название, напр. Братва" autocomplete="off">', (ov) => {
        const n = $('#dc-ally-name', ov).value.trim();
        if (n.length < 2) { A.toast('Название от 2 символов'); return false; }
        act({ a: 'allyNew', name: n });
      }),
      allyjoin: () => act({ a: 'allyJoin', id: d.allyjoin }), allyleave: () => { if (confirm('Выйти из альянса? Вступить снова можно через 3 минуты.')) act({ a: 'allyLeave' }); },
      sing: () => { if (confirm('Сингулярность сбросит ВСЁ, включая ядра и дерево. Точно?')) act({ a: 'sing' }); },
    };
    const k = Object.keys(map).find((x) => x in d);
    if (!k) return;
    if (['hw', 'up', 'def', 'loc', 'case', 'eq', 'buylot', 'bm', 'tree', 'merge', 'res', 'mega', 'allyjoin', 'allynew'].includes(k)) sfx('buy');
    if (k === 'atk') sfx('hit');
    map[k]();
  });

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || !root.offsetParent || view.mode !== 'game') return;
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || !$('#dc-ov').hidden) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const r = $('#dc-rack').getBoundingClientRect();
    nodeClick(r.left + r.width / 2, r.top + r.height / 3, false);
  }, true);

  root.addEventListener('input', (e) => {
    if (e.target.id !== 'dc-vol') return;
    sndPrefs.vol = e.target.value / 100;
    SND.unlock(); SND.setVol(sndPrefs.vol); A.store('qb.dc.snd', sndPrefs);
  });

  // масштаб под размер окна: на широком мониторе всё крупнее
  new ResizeObserver(() => {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    view.z = Math.max(1, Math.min(1.9, w / 1060, h / 700));
    root.style.setProperty('--z', view.z.toFixed(3));
  }).observe(root);

  setInterval(render, 250);
  window.addEventListener('qb:page', (e) => { if (e.detail === 'dc') { view.cache = {}; render(); } });
  window.addEventListener('beforeunload', () => { if (net.host) saveSnap(); });
  showLobby();
})();
