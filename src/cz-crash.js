// «Казик» — общие столы: Краш и Рулетка. Раунды ведёт хост комнаты, деньги считает каждый у себя
(function () {
  const C = window.CZ, Z = window.CZApp;
  if (!C || !Z) return;
  // ищем только внутри казика: в «Номерах РФ» есть элементы с такими же id
  const $ = (s, r = document.getElementById('cz')) => r.querySelector(s);
  const $$ = (s, r = document.getElementById('cz')) => [...r.querySelectorAll(s)];
  const { fmt, esc, rand } = C;
  const M = Z.money;
  // перерисовываем, только если html поменялся — иначе анимации карт стартуют заново
  const put = (el, html) => { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } };
  const secs = (ms) => Math.max(0, Math.ceil(ms / 1000));

  /* =================== КРАШ =================== */
  const BET_LEN = 8000, BOOM_LEN = 4000;
  const growth = (ms) => Math.floor(Math.exp(0.00006 * ms) * 100) / 100;
  // точка взрыва: 3% — сразу на 1.00, дальше распределение 0.97 / (1 − u)
  const crashPoint = () => Math.max(1, Math.floor((97 / (1 - rand())) ) / 100);
  const my = { rid: 0, amt: 0, auto: 0, settled: true, seen: false };

  Z.register({
    id: 'crash', name: 'Краш', icon: '🚀', kind: 'table',
    hostInit: () => ({ phase: 'bet', until: Date.now() + BET_LEN, rid: 1, m: 1, start: 0, bets: {}, cash: {}, hist: [] }),
    hostTick(t, now, pv) {
      if (t.phase === 'bet' && now >= t.until) {
        t.phase = 'fly'; t.start = now; t.m = 1; pv.cp = crashPoint();
      } else if (t.phase === 'fly') {
        if (!pv.cp) pv.cp = Math.max(t.m + 0.01, crashPoint());
        t.m = growth(now - t.start);
        Object.entries(t.bets).forEach(([pid, b]) => {
          if (b.auto && !t.cash[pid] && b.auto <= Math.min(t.m, pv.cp)) t.cash[pid] = { m: b.auto, win: Math.floor(b.amt * b.auto) };
        });
        if (t.m >= pv.cp) {
          t.m = pv.cp; t.phase = 'boom'; t.until = now + BOOM_LEN;
          t.hist.unshift(pv.cp); t.hist = t.hist.slice(0, 16);
        }
      } else if (t.phase === 'boom' && now >= t.until) {
        Object.assign(t, { phase: 'bet', until: now + BET_LEN, rid: t.rid + 1, m: 1, bets: {}, cash: {} });
        pv.cp = 0;
      }
    },
    hostAct(t, pid, nk, m, now) {
      if (m.a === 'bet' && t.phase === 'bet' && m.rid === t.rid && !t.bets[pid] && m.amt > 0) t.bets[pid] = { nick: nk, amt: Math.floor(m.amt), auto: m.auto > 1 ? +m.auto : 0 };
      if (m.a === 'cash' && t.phase === 'fly' && t.bets[pid] && !t.cash[pid]) {
        const x = growth(now - t.start);
        t.cash[pid] = { m: x, win: Math.floor(t.bets[pid].amt * x) };
      }
    },
    onState(t) {
      if (my.settled || !t) return;
      if (t.rid === my.rid && t.bets[me()]) my.seen = true;
      const c = t.rid === my.rid && t.cash[me()];
      if (c) {
        my.settled = true;
        M.credit(c.win, 'crash', { mult: c.m, profit: c.win - my.amt });
        if (c.m >= 10) Z.bigWin(c.win, c.m); else C.sound.play('cash');
        return;
      }
      const ended = t.rid > my.rid || (t.rid === my.rid && t.phase === 'boom');
      if (!ended) return;
      my.settled = true;
      if (!my.seen) { M.credit(my.amt, 'crash', { refund: true }); A_toast('Ставка не дошла до хоста — вернули'); }
    },
    onLeave() { if (!my.settled) { my.settled = true; M.credit(my.amt, 'crash', { refund: true }); } },
    mount(el) {
      el.innerHTML = `<div class="cz-crash">
        <div class="cz-hist" id="zcr-hist"></div>
        <div class="cz-crash-stage"><canvas id="zcr-cv"></canvas><div class="cz-crash-m" id="zcr-m"></div><div class="cz-crash-sub" id="zcr-sub"></div></div>
        <div class="cz-row">${Z.betCtl('zcr-bet', 100)}<input class="cz-inp cz-auto" id="zcr-auto" placeholder="Автовывод ×2.0" autocomplete="off"><button class="cz-btn big" id="zcr-btn">Поставить</button></div>
        <div class="cz-bets" id="zcr-bets"></div></div>`;
      $('#zcr-btn').onclick = crashBtn;
    },
    update(t, now) {
      if (!t) return;
      const m = $('#zcr-m'), sub = $('#zcr-sub');
      if (!m) return;
      const live = t.phase === 'fly' ? growth(now - t.start) : t.m;
      m.textContent = t.phase === 'bet' ? `${secs(t.until - now)}` : `×${live.toFixed(2)}`;
      m.className = 'cz-crash-m ' + t.phase;
      sub.textContent = t.phase === 'bet' ? 'Приём ставок' : t.phase === 'boom' ? '💥 Ракета взорвалась' : 'Летим!';
      put($('#zcr-hist'), t.hist.map((x) => `<span class="${x >= 2 ? 'w' : x < 1.2 ? 'l' : ''}">${x.toFixed(2)}×</span>`).join(''));
      const btn = $('#zcr-btn');
      const mine = t.rid === my.rid && !my.settled;
      const cashed = t.cash[me()];
      if (t.phase === 'bet') { btn.textContent = mine ? 'Ставка принята' : 'Поставить'; btn.disabled = mine; btn.className = 'cz-btn big'; }
      else if (t.phase === 'fly' && mine && !cashed) { btn.textContent = `Забрать ${fmt(my.amt * live)}`; btn.disabled = false; btn.className = 'cz-btn big cash'; }
      else { btn.textContent = cashed ? `Забрал ×${cashed.m.toFixed(2)}` : 'Ждём раунд'; btn.disabled = true; btn.className = 'cz-btn big'; }
      put($('#zcr-bets'), Object.entries(t.bets).map(([pid, b]) => {
        const c = t.cash[pid];
        return `<div class="${c ? 'w' : t.phase === 'boom' ? 'l' : ''}"><b>${esc(b.nick)}</b><span>${fmt(b.amt)}</span><em>${c ? `×${c.m.toFixed(2)} · +${fmt(c.win)}` : t.phase === 'boom' ? '💥' : '…'}</em></div>`;
      }).join('') || '<small class="cz-note">Ставок пока нет</small>');
      drawCrash(t, now, live);
      if (t.phase !== view.lastPhase) { if (t.phase === 'boom') C.sound.play('boom'); if (t.phase === 'fly') C.sound.play('spin'); view.lastPhase = t.phase; }
    },
  });
  const view = {};
  const me = () => Z.me;
  const A_toast = (t) => window.QBApp.toast(t);

  function crashBtn() {
    const t = Z.S && Z.S.t.crash;
    if (!t) return;
    if (t.phase === 'bet' && (my.settled || my.rid !== t.rid)) {
      const amt = Z.readBet('zcr-bet');
      const auto = parseFloat(String($('#zcr-auto').value).replace(',', '.')) || 0;
      if (!M.pay(amt, 'crash')) return;
      Object.assign(my, { rid: t.rid, amt, auto, settled: false, seen: false });
      Z.act('crash', { a: 'bet', amt, auto, rid: t.rid });
      C.sound.play('chip');
    } else if (t.phase === 'fly' && !my.settled && my.rid === t.rid) Z.act('crash', { a: 'cash' });
  }

  function drawCrash(t, now, live) {
    const cv = $('#zcr-cv');
    if (!cv) return;
    const dpr = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== w * dpr) { cv.width = w * dpr; cv.height = h * dpr; }
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, w, h);
    if (t.phase === 'bet') return;
    const T = t.phase === 'fly' ? now - t.start : Math.log(t.m) / 0.00006;
    const maxT = Math.max(8000, T * 1.15), maxM = Math.max(2, live * 1.2);
    const px = (ms) => 30 + (ms / maxT) * (w - 50), py = (mm) => h - 26 - ((mm - 1) / (maxM - 1)) * (h - 50);
    x.strokeStyle = 'rgba(255,255,255,.06)'; x.lineWidth = 1;
    for (let i = 1; i <= 4; i++) { const yy = h - 26 - (i / 4) * (h - 50); x.beginPath(); x.moveTo(30, yy); x.lineTo(w - 10, yy); x.stroke(); }
    x.beginPath();
    for (let s = 0; s <= 60; s++) { const ms = (T * s) / 60; const yy = py(Math.exp(0.00006 * ms)); s ? x.lineTo(px(ms), yy) : x.moveTo(px(ms), yy); }
    const boom = t.phase === 'boom';
    const col = boom ? '#ff4d5e' : '#f5c451';
    x.strokeStyle = col; x.lineWidth = 3; x.shadowColor = col; x.shadowBlur = 16; x.stroke(); x.shadowBlur = 0;
    x.lineTo(px(T), h - 26); x.lineTo(30, h - 26); x.closePath();
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, boom ? 'rgba(255,77,94,.25)' : 'rgba(245,196,81,.25)'); g.addColorStop(1, 'transparent');
    x.fillStyle = g; x.fill();
    x.font = '22px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(boom ? '💥' : '🚀', px(T), py(live) - 6);
  }

  /* =================== РУЛЕТКА =================== */
  const R_BET = 15000, R_SPIN = 6500, R_RES = 4500;
  const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
  const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  const color = (n) => (n === 0 ? 'g' : RED.has(n) ? 'r' : 'b');
  // во сколько раз вернётся ставка на поле
  function payout(spot, n) {
    if (spot.startsWith('n:')) return +spot.slice(2) === n ? 36 : 0;
    if (n === 0) return 0;
    const map = {
      red: RED.has(n), black: !RED.has(n), even: n % 2 === 0, odd: n % 2 === 1, low: n <= 18, high: n >= 19,
      d1: n <= 12, d2: n > 12 && n <= 24, d3: n > 24, c1: n % 3 === 1, c2: n % 3 === 2, c3: n % 3 === 0,
    };
    if (!map[spot]) return 0;
    return spot[0] === 'd' || spot[0] === 'c' ? 3 : 2;
  }
  const rl = { rid: 0, spots: {}, settled: true, chip: 100, rot: 0, spunRid: 0 };

  Z.register({
    id: 'roulette', name: 'Рулетка', icon: '🎡', kind: 'table',
    hostInit: () => ({ phase: 'bet', until: Date.now() + R_BET, rid: 1, bets: {}, res: null, hist: [] }),
    hostTick(t, now, pv) {
      if (t.phase === 'bet' && now >= t.until) {
        if (!Object.keys(t.bets).length) { t.until = now + R_BET; return; }
        t.phase = 'spin'; t.res = Math.floor(rand() * 37); t.until = now + R_SPIN;
      } else if (t.phase === 'spin' && now >= t.until) {
        t.phase = 'res'; t.until = now + R_RES;
        t.hist.unshift(t.res); t.hist = t.hist.slice(0, 18);
      } else if (t.phase === 'res' && now >= t.until) {
        Object.assign(t, { phase: 'bet', until: now + R_BET, rid: t.rid + 1, bets: {}, res: null });
      }
    },
    hostAct(t, pid, nk, m) {
      if (t.phase !== 'bet' || m.rid !== t.rid) return;
      if (m.a === 'rbet' && m.amt > 0) { const b = t.bets[pid] || (t.bets[pid] = { nick: nk, total: 0 }); b.total += Math.floor(m.amt); }
      if (m.a === 'rclear') delete t.bets[pid];
    },
    onState(t) {
      if (!t) return;
      if (t.phase === 'spin' && rl.spunRid !== t.rid && Z.isActive('roulette')) { rl.spunRid = t.rid; spinWheel(t.res); }
      if (rl.settled) return;
      const done = (t.rid === rl.rid && t.phase === 'res') || t.rid > rl.rid;
      if (!done) return;
      rl.settled = true;
      const n = t.rid === rl.rid ? t.res : null;
      if (n == null) { const tot = Object.values(rl.spots).reduce((a, b) => a + b, 0); M.credit(tot, 'roulette', { refund: true }); return; }
      const total = Object.values(rl.spots).reduce((a, b) => a + b, 0);
      const win = Object.entries(rl.spots).reduce((a, [s, v]) => a + v * payout(s, n), 0);
      if (win > 0) { M.credit(win, 'roulette', { mult: win / total, profit: win - total }); if (win / total >= 10) Z.bigWin(win, win / total); else C.sound.play('win'); }
      else C.sound.play('lose');
    },
    onLeave() { if (!rl.settled) { rl.settled = true; M.credit(Object.values(rl.spots).reduce((a, b) => a + b, 0), 'roulette', { refund: true }); } },
    mount(el) {
      const num = (n) => `<button class="rn ${color(n)}" data-s="n:${n}"><span>${n}</span><i></i></button>`;
      const rows = [3, 2, 1].map((r) => Array.from({ length: 12 }, (_, i) => num(i * 3 + r)).join('') + `<button class="rs" data-s="c${r}"><span>2:1</span><i></i></button>`).join('');
      el.innerHTML = `<div class="cz-roul">
        <div class="cz-roul-top">
          <div class="cz-wheel-wrap"><div class="cz-wheel" id="zrl-wheel">${wheelSvg()}</div><div class="cz-wheel-ptr">▼</div><div class="cz-wheel-res" id="zrl-res"></div></div>
          <div class="cz-roul-info"><div class="cz-crash-sub" id="zrl-ph"></div><div class="cz-hist" id="zrl-hist"></div><div class="cz-bets" id="zrl-bets"></div></div>
        </div>
        <div class="cz-board">
          <button class="rn g zero" data-s="n:0"><span>0</span><i></i></button>
          <div class="cz-nums">${rows}</div>
          <div class="cz-outs"><button class="rs" data-s="d1"><span>1–12</span><i></i></button><button class="rs" data-s="d2"><span>13–24</span><i></i></button><button class="rs" data-s="d3"><span>25–36</span><i></i></button>
            <button class="rs" data-s="low"><span>1–18</span><i></i></button><button class="rs" data-s="even"><span>Чёт</span><i></i></button><button class="rs r" data-s="red"><span>♦</span><i></i></button><button class="rs b" data-s="black"><span>♦</span><i></i></button><button class="rs" data-s="odd"><span>Нечет</span><i></i></button><button class="rs" data-s="high"><span>19–36</span><i></i></button></div>
        </div>
        <div class="cz-row"><div class="cz-chips" id="zrl-chips">${[10, 100, 1000, 10000, 100000].map((v) => `<button class="cz-chipb ${rl.chip === v ? 'on' : ''}" data-chip="${v}">${fmt(v)}</button>`).join('')}</div>
          <span class="cz-note" id="zrl-my"></span><button class="cz-btn ghost" id="zrl-clear">Снять ставки</button></div></div>`;
      el.querySelector('.cz-board').onclick = (e) => { const b = e.target.closest('[data-s]'); if (b) placeR(b.dataset.s); };
      $('#zrl-chips').onclick = (e) => { const b = e.target.closest('[data-chip]'); if (!b) return; rl.chip = +b.dataset.chip; $$('#zrl-chips button').forEach((x) => x.classList.toggle('on', x === b)); C.sound.play('chip'); };
      $('#zrl-clear').onclick = clearR;
      $('#zrl-wheel').style.transform = `rotate(${rl.rot}deg)`;
    },
    update(t, now) {
      if (!t || !$('#zrl-ph')) return;
      $('#zrl-ph').textContent = t.phase === 'bet' ? `Ставки — ${secs(t.until - now)} с` : t.phase === 'spin' ? 'Шарик крутится…' : `Выпало ${t.res}`;
      put($('#zrl-hist'), t.hist.map((n) => `<span class="rc ${color(n)}">${n}</span>`).join(''));
      const res = $('#zrl-res');
      res.textContent = t.phase === 'res' ? t.res : '';
      res.className = 'cz-wheel-res ' + (t.phase === 'res' ? color(t.res) : '');
      const mine = t.rid === rl.rid && !rl.settled ? rl.spots : {};
      $$('.cz-board [data-s]').forEach((b) => {
        const v = mine[b.dataset.s];
        const i = b.querySelector('i');
        i.textContent = v ? fmt(v) : '';
        b.classList.toggle('has', !!v);
        b.classList.toggle('hit', t.phase === 'res' && payout(b.dataset.s, t.res) > 0);
      });
      const tot = Object.values(mine).reduce((a, b) => a + b, 0);
      $('#zrl-my').textContent = tot ? `Твои ставки: ${fmt(tot)}` : '';
      put($('#zrl-bets'), Object.values(t.bets).map((b) => `<div><b>${esc(b.nick)}</b><span>${fmt(b.total)}</span></div>`).join(''));
      $('.cz-board').classList.toggle('closed', t.phase !== 'bet');
    },
  });

  function placeR(spot) {
    const t = Z.S && Z.S.t.roulette;
    if (!t || t.phase !== 'bet') return C.sound.play('err');
    if (rl.settled || rl.rid !== t.rid) Object.assign(rl, { rid: t.rid, spots: {}, settled: false });
    if (!M.pay(rl.chip, 'roulette')) return;
    rl.spots[spot] = (rl.spots[spot] || 0) + rl.chip;
    Z.act('roulette', { a: 'rbet', rid: t.rid, amt: rl.chip });
    C.sound.play('chip');
  }
  function clearR() {
    const t = Z.S && Z.S.t.roulette;
    if (!t || t.phase !== 'bet' || rl.settled || rl.rid !== t.rid) return;
    const tot = Object.values(rl.spots).reduce((a, b) => a + b, 0);
    rl.spots = {}; rl.settled = true;
    M.credit(tot, 'roulette', { refund: true });
    Z.act('roulette', { a: 'rclear', rid: t.rid });
  }

  function wheelSvg() {
    const n = ORDER.length, R = 100;
    const seg = (i) => {
      const a0 = ((i - 0.5) / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
      const p = (a, r) => `${R + r * Math.cos(a)},${R + r * Math.sin(a)}`;
      const c = color(ORDER[i]);
      const am = (i / n) * 360;
      return `<path d="M${R},${R} L${p(a0, 98)} A98,98 0 0 1 ${p(a1, 98)} Z" class="ws ${c}"/>
        <text transform="rotate(${am} ${R} ${R}) translate(${R} ${R - 84})" text-anchor="middle" dominant-baseline="middle">${ORDER[i]}</text>`;
    };
    return `<svg viewBox="0 0 200 200">${ORDER.map((_, i) => seg(i)).join('')}<circle cx="100" cy="100" r="58" class="wc"/><circle cx="100" cy="100" r="10" class="wd"/></svg>`;
  }
  function spinWheel(res) {
    const w = $('#zrl-wheel');
    if (!w) return;
    const idx = ORDER.indexOf(res);
    const target = -(idx / ORDER.length) * 360;
    const base = rl.rot - (rl.rot % 360) - 360 * 6;
    const to = base + target;
    w.animate([{ transform: `rotate(${rl.rot}deg)` }, { transform: `rotate(${to}deg)` }], { duration: R_SPIN - 400, easing: 'cubic-bezier(.12,.6,.15,1)', fill: 'forwards' });
    rl.rot = to;
    C.sound.ballTicks((R_SPIN - 600) / 1000);
  }
})();
