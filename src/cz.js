// «Казик» — оболочка: баланс, комнаты с кентами (Supabase Realtime), чат, меню игр
(function () {
  const C = window.CZ, A = window.QBApp;
  if (!C || !A) return;
  // ищем только внутри казика: в «Номерах РФ» есть элементы с такими же id
  const $ = (s, r = document.getElementById('cz')) => r.querySelector(s);
  const $$ = (s, r = document.getElementById('cz')) => [...r.querySelectorAll(s)];
  const { esc, fmt } = C;
  const root = document.getElementById('cz');
  const me = A.pid;

  /* ================= баланс ================= */
  const START = 10000, BONUS = 2500, BONUS_EVERY = 30 * 60e3, BROKE = 1000, BROKE_EVERY = 3 * 60e3;
  const W = Object.assign({ bal: START, bonusAt: 0, brokeAt: 0, stats: { wag: 0, won: 0, best: 0, bestG: '' }, nick: '' }, A.load('qb.cz', {}));
  let saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => A.store('qb.cz', W), 400); };
  const nick = () => (W.nick || A.nick()).slice(0, 20);

  const money = {
    get bal() { return W.bal; },
    can: (x) => x > 0 && W.bal >= x,
    // списать ставку
    pay(x, game) {
      x = Math.floor(x);
      if (!(x > 0) || W.bal < x) { C.sound.play('err'); A.toast('Не хватает фишек'); return false; }
      W.bal -= x; W.stats.wag += x;
      save(); paintBal(-x); presenceSoon();
      return true;
    },
    // начислить выигрыш (или вернуть ставку)
    credit(x, game, opt = {}) {
      x = Math.floor(x);
      if (!(x > 0)) return;
      W.bal += x;
      if (!opt.refund) {
        W.stats.won += x;
        const profit = opt.profit ?? x;
        if (profit > W.stats.best) { W.stats.best = profit; W.stats.bestG = game; }
        // крупные выигрыши — в общую ленту
        if (opt.mult >= 10 || profit >= 50000) announce(`💰 <b>${esc(nick())}</b> выиграл <b>${fmt(x)}</b>${opt.mult ? ` (×${opt.mult.toFixed(2)})` : ''} в ${esc(GAMES[game]?.name || game)}`, 'win');
      }
      save(); paintBal(x); presenceSoon();
    },
  };

  /* ================= сеть ================= */
  const sb = window.supabase && window.QB_ONLINE
    ? window.supabase.createClient(window.QB_ONLINE.url, window.QB_ONLINE.key, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 30 } } })
    : null;
  const net = { ch: null, code: null, host: true, hostId: me, members: [], joinedAt: 0, ready: true };
  let S = null, priv = {}, lastSent = 0, dirty = false, skew = 0;
  const now = () => Date.now() + (net.host ? 0 : skew);

  const send = (event, payload) => net.ch && net.ch.send({ type: 'broadcast', event, payload: { ...payload, from: me } });

  function freshState() {
    const s = { ver: 0, now: Date.now(), t: {} };
    priv = {};
    Object.values(GAMES).forEach((g) => { if (g.hostInit) { s.t[g.id] = g.hostInit(); priv[g.id] = {}; } });
    return s;
  }

  function publish() {
    if (!net.host || !S) return;
    S.ver++; S.now = Date.now();
    send('st', { s: S });
    lastSent = Date.now(); dirty = false;
  }

  // личные сообщения от логики столов
  const pms = [];
  const pm = (to, kind, data = {}) => pms.push({ to, kind, ...data });
  function flushPms() {
    while (pms.length) {
      const m = pms.shift();
      if (m.to === me || m.to === '*') onPm(m);
      if (m.to !== me) send('pm', { m });
    }
  }
  function onPm(m) {
    const g = GAMES[m.g];
    if (g && g.onPm) g.onPm(m);
    else if (m.kind === 'toast') A.toast(m.txt);
  }

  // действие игрока за столом: хост применяет сразу, остальные шлют хосту
  function act(g, msg) {
    const m = { ...msg, g };
    if (net.host) { hostAct(me, nick(), m); render(); }
    else send('in', { m, nick: nick() });
  }
  // игры узнают о новом состоянии стола (у хоста — сразу, у остальных — из рассылки)
  const notify = () => { if (S) Object.values(GAMES).forEach((g) => { if (g.onState) g.onState(S.t[g.id], now()); }); };

  function hostAct(pid, nk, m) {
    const g = GAMES[m.g];
    if (!S || !g || !g.hostAct) return;
    g.hostAct(S.t[g.id], pid, nk, m, Date.now(), priv[g.id], pm);
    flushPms();
    notify();
    dirty = true;
  }

  setInterval(() => {
    if (!net.host || !S) return;
    const t = Date.now();
    Object.values(GAMES).forEach((g) => { if (g.hostTick) g.hostTick(S.t[g.id], t, priv[g.id], pm, onlineIds()); });
    flushPms();
    notify();
    if (net.ch && (t - lastSent > 900 || (dirty && t - lastSent > 150))) publish();
  }, 200);

  const onlineIds = () => new Set(net.ch ? net.members.map((m) => m.id) : [me]);

  function recomputeHost() {
    const list = Object.values(net.ch.presenceState()).map((a) => a[0]).filter(Boolean).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
    net.members = list;
    const was = net.host;
    net.hostId = list.length ? list[0].id : me;
    net.host = net.hostId === me;
    if (net.ready && net.host && !was) {
      // новый хост: продолжаем с последнего состояния, незавершённые раунды отменяются с возвратом
      if (!S) S = freshState();
      Object.values(GAMES).forEach((g) => { if (g.hostAdopt) g.hostAdopt(S.t[g.id], Date.now(), (priv[g.id] = {}), pm); });
      flushPms();
      publish();
    }
    renderSide();
  }

  function joinRoom(code) {
    leaveRoom(true);
    if (!sb) { A.toast('Нет связи с сервером'); return; }
    net.code = code; net.joinedAt = Date.now(); net.ready = false; net.host = false;
    S = null;
    rememberRoom(code);
    const ch = net.ch = sb.channel(`qb-cz-${code}`, { config: { broadcast: { self: false, ack: false }, presence: { key: me } } });
    ch.on('presence', { event: 'sync' }, recomputeHost);
    ch.on('broadcast', { event: 'st' }, ({ payload }) => {
      if (net.host || payload.from !== net.hostId) return;
      S = payload.s;
      skew = S.now - Date.now();
      notify();
      render();
    });
    ch.on('broadcast', { event: 'in' }, ({ payload }) => { if (net.host && S) hostAct(payload.from, payload.nick, payload.m); });
    ch.on('broadcast', { event: 'pm' }, ({ payload }) => {
      if (payload.from !== net.hostId) return;
      const m = payload.m;
      if (m.to === me || m.to === '*') onPm(m);
    });
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => { pushMsg({ kind: 'chat', nick: payload.nick, pid: payload.from, txt: payload.txt }); C.sound.play('msg'); });
    ch.on('broadcast', { event: 'feed' }, ({ payload }) => pushMsg({ kind: payload.k || 'feed', txt: payload.txt }));
    ch.on('broadcast', { event: 'give' }, ({ payload }) => {
      if (payload.to !== me) return;
      money.credit(payload.amt, 'transfer', { refund: true });
      A.toast(`💸 ${payload.nick} перевёл тебе ${fmt(payload.amt)}`);
      C.sound.play('cash');
    });
    ch.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      await ch.track(presence());
      setTimeout(() => {
        if (net.ch !== ch) return;
        net.ready = true;
        recomputeHost();
        if (net.host && !S) { S = freshState(); publish(); }
        announce(`👋 <b>${esc(nick())}</b> зашёл в казик`, 'sys');
        render();
      }, 1500);
    });
    pushMsg({ kind: 'sys', txt: `Подключаемся к комнате <b>${esc(code)}</b>…` });
    renderTop();
  }

  function leaveRoom(silent) {
    if (net.ch) {
      Object.values(GAMES).forEach((g) => { if (g.onLeave) g.onLeave(); });
      try { net.ch.untrack(); sb.removeChannel(net.ch); } catch {}
    }
    net.ch = null; net.code = null; net.host = true; net.hostId = me; net.members = []; net.ready = true;
    S = freshState();
    if (!silent) { pushMsg({ kind: 'sys', txt: 'Ты вышел из комнаты — играешь один' }); render(); renderTop(); renderSide(); }
  }

  const presence = () => ({ id: me, t: net.joinedAt, nick: nick(), bal: W.bal, g: view.game });
  let presT = 0;
  function presenceSoon() {
    if (!net.ch || presT) return;
    presT = setTimeout(() => { presT = 0; if (net.ch) net.ch.track(presence()); }, 1500);
  }

  function announce(txt, k = 'feed') {
    pushMsg({ kind: k, txt });
    send('feed', { txt, k });
  }

  /* ================= чат и лента ================= */
  const msgs = [];
  function pushMsg(m) {
    m.ts = Date.now();
    msgs.push(m);
    if (msgs.length > 120) msgs.shift();
    renderChat();
  }

  /* ================= интерфейс ================= */
  const GAMES = {};
  const view = { game: 'slots', z: 1 };

  function shell() {
    root.innerHTML = `<div class="cz-app">
      <header class="cz-top">
        <div class="cz-logo"><span>🎰</span><b>КАЗИК</b></div>
        <div class="cz-bal"><small>БАЛАНС</small><b id="cz-bal">0</b><i id="cz-bal-d"></i></div>
        <button class="cz-bonus" id="cz-bonus" data-bonus></button>
        <div class="cz-room" id="cz-room"></div>
        <div class="cz-snd"><button class="cz-mini" data-mute>${C.sound.muted ? '🔇' : '🔊'}</button><input type="range" id="cz-vol" min="0" max="100" value="${Math.round((W.vol ?? 0.6) * 100)}"></div>
      </header>
      <div class="cz-body">
        <nav class="cz-menu" id="cz-menu"></nav>
        <main class="cz-stage" id="cz-stage"></main>
        <aside class="cz-side">
          <div class="cz-box"><div class="cz-h">ЗА СТОЛАМИ</div><div id="cz-players"></div></div>
          <div class="cz-box cz-chatbox"><div class="cz-h">ЧАТ И ЛЕНТА</div><div class="cz-chat" id="cz-chat"></div>
            <form class="cz-say" id="cz-say"><input class="cz-inp" id="cz-say-in" maxlength="200" placeholder="${sb ? 'Написать кентам…' : 'Чат работает в комнате'}" autocomplete="off"><button class="cz-mini">➤</button></form></div>
        </aside>
      </div>
      <div class="cz-fx" id="cz-fx"></div>
      <div class="cz-ov" id="cz-ov" hidden></div>
    </div>`;
    renderMenu(); renderTop(); renderSide(); renderChat(); paintBal(0, true);
    openGame(view.game);
  }

  function renderMenu() {
    const at = (id) => net.members.filter((m) => m.g === id && m.id !== me).length;
    const item = (g) => `<button class="cz-mi ${view.game === g.id ? 'on' : ''}" data-game="${g.id}"><span>${g.icon}</span><b>${g.name}</b>${g.kind === 'table' && at(g.id) ? `<i>${at(g.id)}</i>` : ''}</button>`;
    const list = Object.values(GAMES);
    $('#cz-menu').innerHTML = `<div class="cz-mh">СОЛО</div>${list.filter((g) => g.kind === 'solo').map(item).join('')}
      <div class="cz-mh">СТОЛЫ С КЕНТАМИ</div>${list.filter((g) => g.kind === 'table').map(item).join('')}
      <div class="cz-stats"><small>Поставлено</small><b>${fmt(W.stats.wag)}</b><small>Лучший выигрыш</small><b>${fmt(W.stats.best)}</b></div>`;
  }

  function renderTop() {
    const room = $('#cz-room');
    if (!room) return;
    room.innerHTML = net.code
      ? `<span class="cz-led ${net.ready ? '' : 'wait'}"></span><span>КОМНАТА</span><b>${esc(net.code)}</b><button class="cz-mini" data-copy title="Скопировать код">⧉</button><button class="cz-mini" data-leave>Выйти</button>`
      : `<span>Играешь один</span><button class="cz-mini acc" data-create>＋ Комната</button><button class="cz-mini" data-join>Войти по коду</button>`;
    paintBonus();
  }

  function paintBonus() {
    const b = $('#cz-bonus');
    if (!b) return;
    const t = Date.now();
    const broke = W.bal < 100;
    const left = broke ? W.brokeAt + BROKE_EVERY - t : W.bonusAt + BONUS_EVERY - t;
    const ready = left <= 0;
    b.className = `cz-bonus ${ready ? 'ready' : ''}`;
    b.innerHTML = ready ? `🎁 <b>${broke ? 'Бомж-бонус' : 'Бонус'} +${fmt(broke ? BROKE : BONUS)}</b>` : `🎁 <small>${broke ? 'бомж-бонус' : 'бонус'} через ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}</small>`;
  }
  setInterval(paintBonus, 1000);

  function renderSide() {
    const el = $('#cz-players');
    if (!el) return;
    const list = net.ch ? net.members : [{ id: me, nick: nick(), bal: W.bal, g: view.game }];
    el.innerHTML = list.slice().sort((a, b) => (b.id === me ? W.bal : b.bal) - (a.id === me ? W.bal : a.bal)).map((m, i) => {
      const g = GAMES[m.id === me ? view.game : m.g];
      return `<div class="cz-pl ${m.id === me ? 'me' : ''}"><span class="cz-n">${i + 1}</span><i class="cz-ava" style="--h:${hue(m.id)}">${esc((m.nick || '?').slice(0, 2).toUpperCase())}</i>
        <div><b>${esc(m.nick)}${m.id === net.hostId && net.ch ? ' <u title="хост комнаты">★</u>' : ''}</b><small>${g ? `${g.icon} ${g.name}` : '—'}</small></div>
        <em>${fmt(m.id === me ? W.bal : m.bal)}</em>${m.id !== me && net.ch ? `<button class="cz-mini" data-give="${esc(m.id)}" title="Перевести фишки">💸</button>` : ''}</div>`;
    }).join('');
    renderMenu();
  }
  const hue = (id) => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);

  function renderChat() {
    const el = $('#cz-chat');
    if (!el) return;
    const stick = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
    el.innerHTML = msgs.map((m) => m.kind === 'chat'
      ? `<div class="cz-msg ${m.pid === me ? 'me' : ''}"><b style="color:hsl(${hue(m.pid)} 70% 70%)">${esc(m.nick)}</b><span>${esc(m.txt)}</span></div>`
      : `<div class="cz-msg ${m.kind}"><span>${m.txt}</span></div>`).join('');
    if (stick) el.scrollTop = el.scrollHeight;
  }

  // баланс с плавной докруткой и всплывающей разницей
  let shown = W.bal;
  function paintBal(delta, instant) {
    const d = $('#cz-bal-d');
    if (d && delta) {
      d.textContent = (delta > 0 ? '+' : '−') + fmt(Math.abs(delta));
      d.className = delta > 0 ? 'up' : 'down';
      d.getAnimations().forEach((a) => a.cancel());
      d.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-14px)' }], { duration: 1200, easing: 'ease-out', fill: 'forwards' });
    }
    if (instant) shown = W.bal;
    clearTimeout(paintBal.t);
    paintBal.t = setTimeout(renderMenu, 300);
  }
  (function tween() {
    requestAnimationFrame(tween);
    const el = document.getElementById('cz-bal');
    if (!el) return;
    if (shown === W.bal) return;
    shown = Math.abs(W.bal - shown) < 1 ? W.bal : shown + (W.bal - shown) * 0.2;
    el.textContent = C.full(shown);
  })();

  function openGame(id) {
    const g = GAMES[id];
    if (!g) return;
    const cur = GAMES[view.game];
    if (cur && cur.unmount && view.mounted) cur.unmount();
    view.game = id;
    const st = $('#cz-stage');
    st.innerHTML = `<div class="cz-game cz-g-${id}" id="cz-g"></div>`;
    g.mount($('#cz-g'));
    view.mounted = true;
    renderMenu();
    presenceSoon();
    render();
  }

  // перерисовка активного стола
  function render() {
    const g = GAMES[view.game];
    if (!g || !g.update || !root.offsetParent) return;
    g.update(S ? S.t[g.id] : null, now());
  }
  setInterval(render, 200);

  /* ================= модалки ================= */
  function modal(html, onOk) {
    const ov = $('#cz-ov');
    ov.innerHTML = `<div class="cz-modal">${html}<div class="cz-acts"><button class="cz-btn ghost" data-close>Отмена</button><button class="cz-btn" data-ok>Готово</button></div></div>`;
    ov.hidden = false;
    const inp = $('input', ov);
    if (inp) setTimeout(() => inp.focus(), 50);
    $('[data-ok]', ov).onclick = () => { if (onOk(ov) !== false) closeOv(); };
    ov.onkeydown = (e) => { if (e.key === 'Enter') $('[data-ok]', ov).click(); if (e.key === 'Escape') closeOv(); };
  }
  const closeOv = () => { const ov = $('#cz-ov'); ov.hidden = true; ov.innerHTML = ''; };
  const parseAmt = (v) => {
    const m = String(v).trim().toLowerCase().replace(',', '.').match(/^([\d.]+)\s*([kкmмbб]?)/);
    return m ? Math.floor(parseFloat(m[1]) * ({ k: 1e3, 'к': 1e3, m: 1e6, 'м': 1e6, b: 1e9, 'б': 1e9 }[m[2]] || 1)) : NaN;
  };
  const cleanCode = (v) => String(v || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9а-яё-]/g, '').slice(0, 24);
  const rooms = () => A.load('qb.cz.rooms', []);
  const rememberRoom = (c) => A.store('qb.cz.rooms', [c, ...rooms().filter((x) => x !== c)].slice(0, 6));

  function createModal() {
    modal(`<b>＋ Новая комната</b><small>Кинь код кентам — они зайдут через «Войти по коду». Ник: ${esc(nick())}</small>
      <input class="cz-inp" id="cz-new-code" placeholder="${'kazik-' + Math.random().toString(36).slice(2, 6)}" autocomplete="off">
      <input class="cz-inp" id="cz-nick" maxlength="20" placeholder="Твой ник" value="${esc(nick())}">`, (ov) => {
      const n = $('#cz-nick', ov).value.trim(); if (n) { W.nick = n.slice(0, 20); save(); }
      joinRoom(cleanCode($('#cz-new-code', ov).value) || cleanCode($('#cz-new-code', ov).placeholder));
    });
  }
  function joinModal() {
    modal(`<b>Войти по коду</b><small>Код комнаты скажет тот, кто её создал</small>
      <input class="cz-inp" id="cz-code" placeholder="kazik-xxxx" autocomplete="off">
      <input class="cz-inp" id="cz-nick" maxlength="20" placeholder="Твой ник" value="${esc(nick())}">
      ${rooms().length ? `<div class="cz-recent">${rooms().map((c) => `<button class="cz-chip" data-rc="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}`, (ov) => {
      const code = cleanCode($('#cz-code', ov).value);
      if (!code) { A.toast('Введи код'); return false; }
      const n = $('#cz-nick', ov).value.trim(); if (n) { W.nick = n.slice(0, 20); save(); }
      joinRoom(code);
    });
    $$('[data-rc]', $('#cz-ov')).forEach((b) => { b.onclick = () => { $('#cz-code').value = b.dataset.rc; }; });
  }
  function giveModal(pid) {
    const m = net.members.find((x) => x.id === pid);
    if (!m) return;
    modal(`<b>💸 Перевести ${esc(m.nick)}</b><small>У тебя ${fmt(W.bal)}</small><input class="cz-inp" id="cz-give" placeholder="Сумма, напр. 5k">`, (ov) => {
      const v = parseAmt($('#cz-give', ov).value);
      if (!(v > 0)) { A.toast('Укажи сумму'); return false; }
      if (!money.pay(v, 'transfer')) return false;
      W.stats.wag -= v;
      send('give', { to: pid, amt: v, nick: nick() });
      announce(`💸 <b>${esc(nick())}</b> перевёл <b>${esc(m.nick)}</b> ${fmt(v)}`, 'sys');
      C.sound.play('cash');
    });
  }

  /* ================= события ================= */
  root.addEventListener('click', (e) => {
    const el = e.target.closest('button, [data-close]');
    if (!el) return;
    const d = el.dataset;
    if ('close' in d) return closeOv();
    if (d.game) return openGame(d.game);
    if ('create' in d) return createModal();
    if ('join' in d) return joinModal();
    if ('leave' in d) return leaveRoom();
    if ('copy' in d) return A.copy(net.code || '');
    if (d.give) return giveModal(d.give);
    if ('mute' in d) { C.sound.setMuted(!C.sound.muted); W.muted = C.sound.muted; save(); el.textContent = C.sound.muted ? '🔇' : '🔊'; return; }
    if ('bonus' in d) {
      const t = Date.now(), broke = W.bal < 100;
      if (broke && t >= W.brokeAt + BROKE_EVERY) { W.brokeAt = t; money.credit(BROKE, 'bonus', { refund: true }); A.toast(`🎁 Бомж-бонус +${fmt(BROKE)}`); C.sound.play('cash'); }
      else if (!broke && t >= W.bonusAt + BONUS_EVERY) { W.bonusAt = t; money.credit(BONUS, 'bonus', { refund: true }); A.toast(`🎁 Бонус +${fmt(BONUS)}`); C.sound.play('cash'); }
      else A.toast('Бонус ещё не готов');
      save(); paintBonus();
    }
  });
  root.addEventListener('input', (e) => {
    if (e.target.id === 'cz-vol') { W.vol = e.target.value / 100; C.sound.setVol(W.vol); save(); }
  });
  root.addEventListener('submit', (e) => {
    if (e.target.id !== 'cz-say') return;
    e.preventDefault();
    const inp = $('#cz-say-in');
    const txt = inp.value.trim().slice(0, 200);
    if (!txt) return;
    inp.value = '';
    if (!net.ch) { A.toast('Чат работает в комнате с кентами'); return; }
    pushMsg({ kind: 'chat', nick: nick(), pid: me, txt });
    send('chat', { txt, nick: nick() });
  });

  // масштаб под размер окна
  new ResizeObserver(() => {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return;
    view.z = Math.max(1, Math.min(1.9, w / 1060, h / 700));
    root.style.setProperty('--z', view.z.toFixed(3));
  }).observe(root);

  window.addEventListener('qb:page', (e) => { if (e.detail === 'cz') { renderSide(); render(); } });

  /* ================= API для игр ================= */
  // общие контролы ставки
  function betCtl(id, val) {
    return `<div class="cz-betctl" data-betfor="${id}"><span>Ставка</span><input class="cz-inp" id="${id}" value="${val}" inputmode="numeric" autocomplete="off">
      <button data-bo="half">½</button><button data-bo="x2">×2</button><button data-bo="min">MIN</button><button data-bo="max">MAX</button></div>`;
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bo]');
    if (!b) return;
    const inp = $('input', b.closest('[data-betfor]'));
    const v = parseAmt(inp.value) || 0;
    inp.value = Math.max(10, Math.min(W.bal, { half: Math.floor(v / 2), x2: v * 2, min: 10, max: W.bal }[b.dataset.bo]));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    C.sound.play('chip');
  });
  const readBet = (id) => { const v = parseAmt(($('#' + id) || {}).value); return v > 0 ? v : 0; };

  function fxText(x, y, txt, cls = '') {
    const fx = $('#cz-fx');
    if (!fx) return;
    const base = fx.getBoundingClientRect(), z = view.z || 1;
    const el = document.createElement('span');
    el.className = 'cz-float ' + cls;
    el.textContent = txt;
    el.style.left = `${(x - base.left) / z}px`; el.style.top = `${(y - base.top) / z}px`;
    fx.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
  function bigWin(amount, mult) {
    const ov = document.createElement('div');
    ov.className = 'cz-bigwin';
    ov.innerHTML = `<small>${mult >= 50 ? 'МЕГА ВЫИГРЫШ' : 'БОЛЬШОЙ ВЫИГРЫШ'}</small><b>+${fmt(amount)}</b>${mult ? `<em>×${mult.toFixed(2)}</em>` : ''}`;
    $('.cz-app', root).appendChild(ov);
    C.sound.play('big');
    setTimeout(() => ov.remove(), 2600);
  }

  window.CZApp = {
    me, nick, money, act, pm, announce, betCtl, readBet, fxText, bigWin, modal, closeOv, parseAmt,
    register(g) { GAMES[g.id] = g; },
    get S() { return S; }, get net() { return net; }, get z() { return view.z; }, now,
    isActive: (id) => view.game === id && !!root.offsetParent,
  };

  // игры регистрируются следующими скриптами, потом строим интерфейс
  // чистим сохранения удалённой игры «Ночной дата-центр»
  const oldRooms = A.load('qb.dc.rooms', null);
  if (oldRooms) { oldRooms.forEach((c) => A.store(`qb.dc.snap.${c}`, undefined)); ['qb.dc.rooms', 'qb.dc.nick', 'qb.dc.snd'].forEach((k) => A.store(k, undefined)); }

  window.addEventListener('DOMContentLoaded', () => {
    if (W.muted) C.sound.setMuted(true);
    C.sound.setVol(W.vol ?? 0.6);
    S = freshState();
    shell();
  });
})();
