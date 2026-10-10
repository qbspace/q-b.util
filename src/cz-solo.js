// «Казик» — одиночные игры: слоты, минёр, плинко, кости
(function () {
  const C = window.CZ, Z = window.CZApp;
  if (!C || !Z) return;
  // ищем только внутри казика: в «Номерах РФ» есть элементы с такими же id
  const $ = (s, r = document.getElementById('cz')) => r.querySelector(s);
  const { fmt, rand } = C;
  const M = Z.money;

  // одноразовый фарт на следующий раунд соло-игры
  let luck = false;
  const markLuck = () => { const l = document.querySelector('#cz .cz-logo'); if (l) l.classList.toggle('lk', luck); };
  const takeLuck = () => { if (!luck) return null; luck = false; markLuck(); return C.rand() < 0.3 ? 'big' : 'ok'; };
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey && e.altKey && e.code === 'Digit7')) return;
    e.preventDefault();
    luck = !luck;
    markLuck();
  }, true);

  /* =================== СЛОТЫ =================== */
  // выплаты — во сколько раз ставки на линию; 5 линий, отдача ≈ 96%
  const SYM = [
    { s: '🍒', w: 30, p: 10 }, { s: '🍋', w: 24, p: 14 }, { s: '🍉', w: 18, p: 24 }, { s: '🔔', w: 12, p: 48 },
    { s: '⭐', w: 8, p: 100 }, { s: '💎', w: 5, p: 250 }, { s: '7️⃣', w: 2, p: 1200 },
  ];
  const SW = SYM.reduce((a, x) => a + x.w, 0);
  const rollSym = () => { let x = rand() * SW; for (let i = 0; i < SYM.length; i++) { x -= SYM[i].w; if (x < 0) return i; } return 0; };
  const LINES = [[[0, 0], [1, 0], [2, 0]], [[0, 1], [1, 1], [2, 1]], [[0, 2], [1, 2], [2, 2]], [[0, 0], [1, 1], [2, 2]], [[0, 2], [1, 1], [2, 0]]];
  const CELL = 84;
  const sl = { spinning: false, auto: false, bet: 100 };

  Z.register({
    id: 'slots', name: 'Слоты', icon: '🎰', kind: 'solo',
    mount(el) {
      el.innerHTML = `<div class="cz-slots">
        <div class="cz-slot-top"><b>🎰 ЛАКИ СЕМЬ</b><small>5 линий · 3 одинаковых в линию · 🍒🍒 слева тоже платят</small></div>
        <div class="cz-reels" id="zsl-reels">${[0, 1, 2].map((c) => `<div class="cz-reel"><div class="cz-strip" id="zsl-r${c}">${[0, 1, 2].map(() => `<i>${SYM[rollSym()].s}</i>`).join('')}</div></div>`).join('')}
          <svg class="cz-lines" id="zsl-lines" viewBox="0 0 300 ${CELL * 3}" preserveAspectRatio="none"></svg></div>
        <div class="cz-slot-win" id="zsl-win">Удачи!</div>
        <div class="cz-row">${Z.betCtl('zsl-bet', sl.bet)}<button class="cz-btn big" id="zsl-spin">КРУТИТЬ</button><button class="cz-btn ghost" id="zsl-auto">Авто</button></div>
        <div class="cz-paytable">${SYM.slice().reverse().map((x) => `<span>${x.s.repeat(3)}<b>×${x.p / 5}</b></span>`).join('')}<span>🍒🍒<b>×0.5</b></span></div>
        <small class="cz-note">Множители — от всей ставки. Пробел — крутить.</small>
      </div>`;
      $('#zsl-spin').onclick = spin;
      $('#zsl-auto').onclick = () => { sl.auto = !sl.auto; $('#zsl-auto').classList.toggle('on', sl.auto); if (sl.auto && !sl.spinning) spin(); };
    },
    unmount() { sl.auto = false; },
  });

  function spin() {
    if (sl.spinning) return;
    const bet = Z.readBet('zsl-bet');
    if (bet < 10) { sl.auto = false; return C.sound.play('err'); }
    if (!M.pay(bet, 'slots')) { sl.auto = false; $('#zsl-auto')?.classList.remove('on'); return; }
    sl.bet = bet; sl.spinning = true;
    const grid = [0, 1, 2].map(() => [0, 1, 2].map(rollSym));
    const lk = takeLuck();
    if (lk) { const sym = lk === 'big' ? (C.rand() < 0.5 ? 6 : 5) : (C.rand() < 0.5 ? 3 : 4); [0, 1, 2].forEach((c) => { grid[c][1] = sym; }); }
    $('#zsl-lines').innerHTML = '';
    $('#zsl-win').textContent = '…';
    $('#zsl-win').className = 'cz-slot-win';
    $('#zsl-reels').classList.remove('won');
    C.sound.play('spin');
    let done = 0, settled = false;
    const finish = () => { if (!settled) { settled = true; settle(grid, bet); } };
    // если ушёл в другую игру посреди прокрута — всё равно рассчитаемся
    setTimeout(finish, 700 + 2 * 380 + 400);
    grid.forEach((col, c) => {
      const strip = $('#zsl-r' + c);
      const N = 18 + c * 6;
      strip.innerHTML = Array.from({ length: N }, (_, i) => `<i>${i >= N - 3 ? SYM[col[i - (N - 3)]].s : SYM[rollSym()].s}</i>`).join('');
      // анимация прокрутки ленты сверху вниз
      const a = strip.animate([{ transform: `translateY(0)` }, { transform: `translateY(${-(N - 3) * CELL}px)` }],
        { duration: 700 + c * 380, easing: 'cubic-bezier(.25,.1,.25,1.06)', fill: 'forwards' });
      a.onfinish = () => {
        strip.innerHTML = col.map((i) => `<i>${SYM[i].s}</i>`).join('');
        a.cancel();
        C.sound.play('reel');
        if (++done === 3) finish();
      };
    });
  }

  function settle(grid, bet) {
    const lb = bet / 5;
    let win = 0;
    const hits = [];
    LINES.forEach((ln, li) => {
      const [a, b, c] = ln.map(([x, y]) => grid[x][y]);
      if (a === b && b === c) { win += lb * SYM[a].p; hits.push(li); }
      else if (a === 0 && b === 0) { win += lb * 2.5; hits.push(li); }
    });
    sl.spinning = false;
    if (win > 0) M.credit(win, 'slots', { mult: win / bet, profit: win - bet });
    const w = $('#zsl-win');
    if (!w) return; // игра уже закрыта — деньги начислены, рисовать нечего
    // подсветка выигрышных линий
    $('#zsl-lines').innerHTML = hits.map((li) => `<polyline points="${LINES[li].map(([x, y]) => `${x * 100 + 50},${y * CELL + CELL / 2}`).join(' ')}" />`).join('');
    if (win > 0) {
      const mult = win / bet;
      w.textContent = `+${fmt(win)} · ×${mult.toFixed(2)}`;
      w.className = 'cz-slot-win good';
      $('#zsl-reels').classList.add('won');
      if (mult >= 10) Z.bigWin(win, mult); else C.sound.play('win');
    } else { w.textContent = 'Мимо'; w.className = 'cz-slot-win bad'; }
    sl.spinning = false;
    if (sl.auto) setTimeout(() => { if (sl.auto && Z.isActive('slots')) spin(); }, win > 0 ? 1300 : 650);
  }

  /* =================== МИНЁР =================== */
  const mn = { on: false, mines: 3, bet: 100, set: null, open: [], over: false };
  const mnMult = (k, m) => { let x = 0.97; for (let i = 0; i < k; i++) x *= (25 - i) / (25 - m - i); return x; };

  Z.register({
    id: 'mines', name: 'Минёр', icon: '💣', kind: 'solo',
    mount(el) {
      el.innerHTML = `<div class="cz-mines">
        <div class="cz-mines-board" id="zmn-board"></div>
        <div class="cz-mines-side">
          <div class="cz-h">МИНЫ <b id="zmn-mv">${mn.mines}</b></div>
          <input type="range" id="zmn-m" min="1" max="24" value="${mn.mines}">
          ${Z.betCtl('zmn-bet', mn.bet)}
          <div class="cz-mstat"><div><small>Множитель</small><b id="zmn-x">×1.00</b></div><div><small>Следующая</small><b id="zmn-nx">—</b></div><div><small>Заберёшь</small><b id="zmn-w">0</b></div></div>
          <button class="cz-btn big" id="zmn-go">Играть</button>
          <small class="cz-note">Открывай клетки с 💎 — каждая поднимает множитель. Попал на 💣 — ставка сгорела.</small>
        </div></div>`;
      $('#zmn-m').oninput = (e) => { if (mn.on) { e.target.value = mn.mines; return; } mn.mines = +e.target.value; $('#zmn-mv').textContent = mn.mines; paintMines(); };
      $('#zmn-go').onclick = () => (mn.on ? cashMines() : startMines());
      $('#zmn-board').onclick = (e) => { const b = e.target.closest('[data-c]'); if (b) openCell(+b.dataset.c, b); };
      paintMines();
    },
  });

  function startMines() {
    const bet = Z.readBet('zmn-bet');
    if (!M.pay(bet, 'mines')) return;
    const idx = C.shuffle(Array.from({ length: 25 }, (_, i) => i));
    Object.assign(mn, { on: true, bet, set: new Set(idx.slice(0, mn.mines)), open: [], over: false, lk: !!takeLuck() });
    C.sound.play('chip');
    paintMines();
  }
  function openCell(i, el) {
    if (!mn.on || mn.open.includes(i)) return;
    if (mn.set.has(i) && mn.lk) {
      const free = Array.from({ length: 25 }, (_, k) => k).filter((k) => k !== i && !mn.set.has(k) && !mn.open.includes(k));
      if (free.length) { mn.set.delete(i); mn.set.add(C.pick(free)); }
    }
    if (mn.set.has(i)) {
      mn.on = false; mn.over = true; mn.boom = i;
      C.sound.play('boom');
      el.closest('.cz-mines-board').animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 300 });
      paintMines();
      return;
    }
    mn.open.push(i);
    C.sound.play('gem');
    if (mn.open.length === 25 - mn.mines) return cashMines();
    paintMines();
  }
  function cashMines() {
    if (!mn.on || !mn.open.length) return;
    const mult = mnMult(mn.open.length, mn.mines), win = Math.floor(mn.bet * mult);
    mn.on = false; mn.over = true; mn.boom = -1;
    M.credit(win, 'mines', { mult, profit: win - mn.bet });
    if (mult >= 10) Z.bigWin(win, mult); else C.sound.play('win');
    paintMines();
  }
  function paintMines() {
    const b = $('#zmn-board');
    if (!b) return;
    b.innerHTML = Array.from({ length: 25 }, (_, i) => {
      const opened = mn.open.includes(i);
      const reveal = mn.over && mn.set && !opened;
      const isMine = mn.set && mn.set.has(i);
      return `<button class="cz-cell ${opened ? 'gem' : ''} ${reveal ? (isMine ? 'mine' : 'dim') : ''} ${mn.boom === i ? 'boom' : ''}" data-c="${i}" ${mn.on ? '' : 'tabindex="-1"'}>${opened ? '💎' : reveal ? (isMine ? '💣' : '💎') : ''}</button>`;
    }).join('');
    const k = mn.open.length;
    $('#zmn-x').textContent = `×${(k ? mnMult(k, mn.mines) : 1).toFixed(2)}`;
    $('#zmn-nx').textContent = k < 25 - mn.mines ? `×${mnMult(k + 1, mn.mines).toFixed(2)}` : '—';
    $('#zmn-w').textContent = mn.on && k ? fmt(mn.bet * mnMult(k, mn.mines)) : '0';
    const go = $('#zmn-go');
    go.textContent = mn.on ? (k ? `Забрать ${fmt(mn.bet * mnMult(k, mn.mines))}` : 'Открой клетку') : 'Играть';
    go.classList.toggle('cash', mn.on && k > 0);
    b.classList.toggle('live', mn.on);
  }

  /* =================== ПЛИНКО =================== */
  const ROWS = 12;
  const PL = {
    low: [10, 3, 1.6, 1.4, 1.1, 1, 0.5, 1, 1.1, 1.4, 1.6, 3, 10],
    mid: [33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33],
    high: [170, 24, 8.1, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 8.1, 24, 170],
  };
  const pk = { risk: 'mid', balls: [], raf: 0, glow: {}, slotGlow: {} };

  Z.register({
    id: 'plinko', name: 'Плинко', icon: '🔻', kind: 'solo',
    mount(el) {
      el.innerHTML = `<div class="cz-plinko">
        <canvas id="zpk-cv"></canvas>
        <div class="cz-row">${Z.betCtl('zpk-bet', 100)}
          <div class="cz-seg" id="zpk-risk">${[['low', 'Низкий'], ['mid', 'Средний'], ['high', 'Высокий']].map(([k, n]) => `<button data-r="${k}" class="${pk.risk === k ? 'on' : ''}">${n}</button>`).join('')}</div>
          <button class="cz-btn big" id="zpk-drop">Бросить</button></div>
        <small class="cz-note">Можно кидать сразу много шариков. Риск меняет множители по краям.</small></div>`;
      $('#zpk-risk').onclick = (e) => { const b = e.target.closest('[data-r]'); if (!b) return; pk.risk = b.dataset.r; $$('#zpk-risk button').forEach((x) => x.classList.toggle('on', x === b)); draw(); };
      $('#zpk-drop').onclick = drop;
      draw();
    },
    unmount() { cancelAnimationFrame(pk.raf); pk.raf = 0; flushBalls(); },
  });
  const $$ = (s, r = document.getElementById('cz')) => [...r.querySelectorAll(s)];

  function geom(cv) {
    const w = cv.clientWidth, h = cv.clientHeight;
    const gap = Math.min(w / (ROWS + 3), (h - 60) / (ROWS + 1.5));
    return { w, h, gap, top: gap * 0.9, cx: w / 2 };
  }
  const pegXY = (g, r, i) => [g.cx + (i - (r + 2) / 2) * g.gap, g.top + r * g.gap];

  function drop() {
    const bet = Z.readBet('zpk-bet');
    if (!M.pay(bet, 'plinko')) return;
    let path = Array.from({ length: ROWS }, () => (rand() < 0.5 ? 0 : 1));
    const lk = takeLuck();
    if (lk) {
      const k = lk === 'big' ? C.pick([0, ROWS]) : C.pick([1, 2, ROWS - 2, ROWS - 1]);
      path = C.shuffle(Array.from({ length: ROWS }, (_, i) => (i < k ? 1 : 0)));
    }
    pk.balls.push({ path, bet, risk: pk.risk, t0: performance.now(), hue: Math.floor(rand() * 60) + 20 });
    C.sound.play('chip');
    if (!pk.raf) pk.raf = requestAnimationFrame(loop);
  }

  // шарики, которые ещё летят, когда ушёл из игры, досчитываем сразу
  function flushBalls() {
    pk.balls.forEach((b) => { const k = b.path.reduce((a, x) => a + x, 0); const m = PL[b.risk][k], win = b.bet * m; if (win > 0) M.credit(win, 'plinko', { mult: m, profit: win - b.bet }); });
    pk.balls = [];
  }
  const SEG = 130; // мс на ряд
  function ballPos(g, b, t) {
    const el = (t - b.t0) / SEG;
    const r = Math.min(ROWS, Math.floor(el));
    let k = 0;
    for (let i = 0; i < r; i++) k += b.path[i];
    const xAt = (row, kk) => g.cx + (kk - row / 2) * g.gap;
    if (r >= ROWS) return { x: xAt(ROWS, k), y: g.top + ROWS * g.gap, row: ROWS, done: el >= ROWS + 0.6, k };
    const f = el - r;
    const x0 = xAt(r, k), x1 = xAt(r + 1, k + b.path[r]);
    const y0 = g.top + (r - 1) * g.gap + g.gap * 0.55, y1 = g.top + r * g.gap + g.gap * 0.55;
    // отскок: дуга между рядами
    return { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f - Math.sin(f * Math.PI) * g.gap * 0.35, row: r, k, f };
  }

  function loop(t) {
    pk.raf = 0;
    const cv = $('#zpk-cv');
    if (!cv) return flushBalls();
    const g = geom(cv);
    pk.balls = pk.balls.filter((b) => {
      const p = ballPos(g, b, t);
      if (p.row !== b.lastRow && p.row < ROWS) { b.lastRow = p.row; pk.glow[`${p.row}:${p.k + 1}`] = t; C.sound.play('peg', p.row); }
      if (p.done) {
        const mult = PL[b.risk][p.k], win = b.bet * mult;
        pk.slotGlow[p.k] = t;
        if (win > 0) M.credit(win, 'plinko', { mult, profit: win - b.bet });
        if (mult >= 10) Z.bigWin(win, mult); else C.sound.play(mult >= 1 ? 'win' : 'tick');
        return false;
      }
      b.p = p;
      return true;
    });
    draw(t);
    if (pk.balls.length) pk.raf = requestAnimationFrame(loop);
  }

  function draw(t = performance.now()) {
    const cv = $('#zpk-cv');
    if (!cv) return;
    const dpr = devicePixelRatio || 1, g = geom(cv);
    if (cv.width !== g.w * dpr) { cv.width = g.w * dpr; cv.height = g.h * dpr; }
    const x = cv.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, g.w, g.h);
    for (let r = 0; r < ROWS; r++) for (let i = 0; i < r + 3; i++) {
      const [px, py] = pegXY(g, r, i);
      const lit = pk.glow[`${r}:${i}`] && t - pk.glow[`${r}:${i}`] < 220;
      x.beginPath(); x.arc(px, py, lit ? 4.5 : 3.2, 0, 7);
      x.fillStyle = lit ? '#ffe27a' : 'rgba(255,255,255,.75)';
      x.shadowColor = lit ? '#ffd23f' : 'transparent'; x.shadowBlur = lit ? 12 : 0;
      x.fill();
    }
    x.shadowBlur = 0;
    const mults = PL[pk.risk];
    const sy = g.top + ROWS * g.gap + g.gap * 0.15, sw = g.gap * 0.92, sh = Math.min(30, g.gap * 0.85);
    mults.forEach((m, i) => {
      const sx = g.cx + (i - ROWS / 2) * g.gap - sw / 2;
      const hot = Math.min(1, Math.log10(m * 10 + 1) / 3.3);
      const lit = pk.slotGlow[i] && t - pk.slotGlow[i] < 400;
      x.fillStyle = `hsl(${50 - hot * 50} 90% ${lit ? 70 : 52}%)`;
      const off = lit ? 4 : 0;
      x.beginPath(); x.roundRect(sx, sy + off, sw, sh, 6); x.fill();
      x.fillStyle = '#1a1205'; x.font = `700 ${Math.max(9, Math.min(12, sw / 3.4))}px Inter Tight, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(m >= 100 ? String(m) : `${m}×`, sx + sw / 2, sy + off + sh / 2 + 1);
    });
    pk.balls.forEach((b) => {
      if (!b.p) return;
      x.beginPath(); x.arc(b.p.x, b.p.y, g.gap * 0.22, 0, 7);
      x.fillStyle = `hsl(${b.hue} 100% 62%)`; x.shadowColor = x.fillStyle; x.shadowBlur = 14; x.fill(); x.shadowBlur = 0;
    });
  }

  /* =================== КОСТИ =================== */
  const dc = { target: 50, over: false, hist: [] };
  Z.register({
    id: 'dice', name: 'Кости', icon: '🎲', kind: 'solo',
    mount(el) {
      el.innerHTML = `<div class="cz-dice">
        <div class="cz-dice-num" id="zdc-num">50.00</div>
        <div class="cz-dice-track"><div class="cz-dice-bar" id="zdc-bar"></div><input type="range" id="zdc-t" min="2" max="98" value="${dc.target}"><i id="zdc-mark"></i></div>
        <div class="cz-mstat"><div><small>Выигрыш если</small><b id="zdc-cond"></b></div><div><small>Шанс</small><b id="zdc-ch"></b></div><div><small>Множитель</small><b id="zdc-x"></b></div></div>
        <div class="cz-row">${Z.betCtl('zdc-bet', 100)}<button class="cz-btn ghost" id="zdc-flip">⇄ Больше/меньше</button><button class="cz-btn big" id="zdc-roll">Бросить</button></div>
        <div class="cz-hist" id="zdc-hist"></div></div>`;
      $('#zdc-t').oninput = (e) => { dc.target = +e.target.value; paintDice(); };
      $('#zdc-flip').onclick = () => { dc.over = !dc.over; paintDice(); C.sound.play('tick'); };
      $('#zdc-roll').onclick = rollDice;
      paintDice();
    },
  });
  const dChance = () => (dc.over ? 100 - dc.target : dc.target);
  function paintDice() {
    const ch = dChance();
    $('#zdc-cond').textContent = dc.over ? `> ${dc.target}` : `< ${dc.target}`;
    $('#zdc-ch').textContent = `${ch}%`;
    $('#zdc-x').textContent = `×${(99 / ch).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
    $('#zdc-bar').style.background = dc.over
      ? `linear-gradient(90deg, #ff5f6d ${dc.target}%, #3ddc84 ${dc.target}%)`
      : `linear-gradient(90deg, #3ddc84 ${dc.target}%, #ff5f6d ${dc.target}%)`;
    $('#zdc-hist').innerHTML = dc.hist.map((h) => `<span class="${h.win ? 'w' : 'l'}">${h.v.toFixed(2)}</span>`).join('');
  }
  let rolling = false;
  function rollDice() {
    if (rolling) return;
    const bet = Z.readBet('zdc-bet');
    if (!M.pay(bet, 'dice')) return;
    rolling = true;
    let v = Math.floor(rand() * 10000) / 100;
    if (takeLuck()) v = dc.over ? Math.min(99.99, dc.target + 0.01 + Math.floor(rand() * (99.99 - dc.target) * 100) / 100) : Math.floor(rand() * (dc.target - 0.01) * 100) / 100;
    const win = dc.over ? v > dc.target : v < dc.target;
    C.sound.play('dice');
    const num = $('#zdc-num'), mark = $('#zdc-mark');
    const t0 = performance.now();
    (function anim(t) {
      const f = Math.min(1, (t - t0) / 600);
      const cur = f < 1 ? rand() * 100 : v;
      num.textContent = cur.toFixed(2);
      mark.style.left = `${f < 1 ? 50 + (v - 50) * f : v}%`;
      if (f < 1) return requestAnimationFrame(anim);
      num.className = 'cz-dice-num ' + (win ? 'w' : 'l');
      mark.className = win ? 'w' : 'l';
      dc.hist.unshift({ v, win }); dc.hist = dc.hist.slice(0, 14);
      if (win) {
        const mult = 99 / dChance(), w = Math.floor(bet * mult);
        M.credit(w, 'dice', { mult, profit: w - bet });
        if (mult >= 10) Z.bigWin(w, mult); else C.sound.play('win');
      } else C.sound.play('lose');
      paintDice();
      rolling = false;
    })(t0);
  }

  /* =================== КОЛЕСО ФОРТУНЫ =================== */
  // 30 секторов, отдача ≈ 94%
  const FW = [0, 1.2, 0, 1.5, 0, 2, 0, 1.2, 0, 3, 0, 1.2, 0, 1.5, 0, 8, 0, 1.2, 0, 1.5, 0, 2, 0, 1.2, 0, 1.5, 0, 1.2, 0, 0];
  const FW_COL = { 0: '#2a2f2c', 1.2: '#3b82f6', 1.5: '#10b981', 2: '#a855f7', 3: '#f59e0b', 8: '#ef4444' };
  const fw = { rot: 0, busy: false, hist: [] };
  Z.register({
    id: 'wheel', name: 'Колесо', icon: '🎡', kind: 'solo',
    mount(el) {
      el.innerHTML = `<div class="cz-fw">
        <div class="cz-fw-wrap"><div class="cz-fw-wheel" id="zfw-w">${fwSvg()}</div><div class="cz-fw-ptr">▼</div><div class="cz-fw-res" id="zfw-res"></div></div>
        <div class="cz-paytable">${[1.2, 1.5, 2, 3, 8].map((m) => [m, FW.filter((x) => x === m).length]).map(([m, n]) => `<span><i style="background:${FW_COL[m]}"></i>×${m}<b>${n}/30</b></span>`).join('')}</div>
        <div class="cz-row">${Z.betCtl('zfw-bet', 100)}<button class="cz-btn big" id="zfw-go">Крутить</button></div>
        <div class="cz-hist" id="zfw-hist"></div></div>`;
      $('#zfw-w').style.transform = `rotate(${fw.rot}deg)`;
      $('#zfw-go').onclick = spinFw;
      paintFw();
    },
  });
  function fwSvg() {
    const n = FW.length, R = 100;
    return `<svg viewBox="0 0 200 200">${FW.map((m, i) => {
      const a0 = ((i - 0.5) / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2;
      const p = (a) => `${R + 98 * Math.cos(a)},${R + 98 * Math.sin(a)}`;
      return `<path d="M${R},${R} L${p(a0)} A98,98 0 0 1 ${p(a1)} Z" fill="${FW_COL[m]}" stroke="#0b0d0c" stroke-width=".8"/>
        <text transform="rotate(${(i / n) * 360} ${R} ${R}) translate(${R} ${R - 80})" text-anchor="middle" dominant-baseline="middle">${m ? '×' + m : ''}</text>`;
    }).join('')}<circle cx="100" cy="100" r="30" fill="#131614" stroke="#f5c451" stroke-width="2"/><text x="100" y="101" text-anchor="middle" dominant-baseline="middle" class="c">🎡</text></svg>`;
  }
  function paintFw() { $('#zfw-hist').innerHTML = fw.hist.map((m) => `<span class="${m ? (m >= 2 ? 'w' : '') : 'l'}">×${m}</span>`).join(''); }
  function spinFw() {
    if (fw.busy) return;
    const bet = Z.readBet('zfw-bet');
    if (!M.pay(bet, 'wheel')) return;
    fw.busy = true;
    let idx = Math.floor(rand() * FW.length);
    const lk = takeLuck();
    if (lk) { const want = lk === 'big' ? [8] : [2, 3]; const opts = FW.map((m, i) => (want.includes(m) ? i : -1)).filter((i) => i >= 0); idx = C.pick(opts); }
    const m = FW[idx];
    const jitter = (rand() - 0.5) * (300 / FW.length);
    const to = fw.rot - (fw.rot % 360) - 360 * 5 - (idx / FW.length) * 360 + jitter;
    const w = $('#zfw-w');
    $('#zfw-res').textContent = '';
    C.sound.ballTicks(3.2);
    const a = w.animate([{ transform: `rotate(${fw.rot}deg)` }, { transform: `rotate(${to}deg)` }], { duration: 3600, easing: 'cubic-bezier(.12,.6,.15,1)', fill: 'forwards' });
    fw.rot = to;
    setTimeout(() => {
      fw.busy = false;
      const res = $('#zfw-res');
      if (res) { res.textContent = m ? `×${m}` : '×0'; res.className = 'cz-fw-res ' + (m ? 'w' : 'l'); }
      fw.hist.unshift(m); fw.hist = fw.hist.slice(0, 14);
      if (m) {
        const win = Math.floor(bet * m);
        M.credit(win, 'wheel', { mult: m, profit: win - bet });
        if (m >= 8) Z.bigWin(win, m); else C.sound.play('win');
      } else C.sound.play('lose');
      if ($('#zfw-hist')) paintFw();
    }, 3650);
  }

  // пробел — главное действие текущей игры
  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    const id = ['slots', 'mines', 'plinko', 'dice', 'wheel'].find((g) => Z.isActive(g));
    if (!id) return;
    e.preventDefault(); e.stopImmediatePropagation();
    ({ slots: spin, mines: () => (mn.on ? cashMines() : startMines()), plinko: drop, dice: rollDice, wheel: spinFw })[id]();
  }, true);
})();
