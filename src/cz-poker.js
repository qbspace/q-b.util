// «Казик» — Техасский холдем на 6 мест. Ведёт хост, карты на руках приходят каждому лично
(function () {
  const C = window.CZ, Z = window.CZApp;
  if (!C || !Z) return;
  // ищем только внутри казика: в «Номерах РФ» есть элементы с такими же id
  const $ = (s, r = document.getElementById('cz')) => r.querySelector(s);
  const { fmt, esc, cardHtml } = C;
  const M = Z.money;
  // перерисовываем, только если html поменялся — иначе анимации карт стартуют заново
  const put = (el, html) => { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } };
  const N = 6, SB = 50, BB = 100, TURN = 25000, AWAY_TURN = 1500, SHOW_LEN = 6500, WIN_LEN = 3500, START_DELAY = 3500, OFFLINE_KICK = 90e3;
  const BUY_MIN = BB * 20, BUY_MAX = BB * 200;
  const BET_PHASES = ['pre', 'flop', 'turn', 'river'];

  /* ---------------- логика хоста ---------------- */
  const live = (s) => s && (s.st === 'in' || s.st === 'allin');
  const canAct = (s) => s && s.st === 'in';
  function next(t, from, pred) {
    for (let k = 1; k <= N; k++) { const i = (from + k + N) % N; if (pred(t.seats[i], i)) return i; }
    return -1;
  }
  function move(s, amt) {
    amt = Math.max(0, Math.min(s.stack, Math.floor(amt)));
    s.stack -= amt; s.bet += amt; s.tot += amt;
    if (s.stack === 0) s.st = 'allin';
    return amt;
  }
  const pot = (t) => t.seats.reduce((a, s) => a + (s ? s.tot : 0), 0);
  const log = (t, txt) => { t.log.unshift(txt); t.log = t.log.slice(0, 8); };

  function setTurn(t, i, now) {
    t.turn = i;
    const s = t.seats[i];
    t.until = now + (s && (s.away || s.leave) ? AWAY_TURN : TURN);
  }

  function startHand(t, now, pv, pm) {
    t.seats.forEach((s) => { if (s) Object.assign(s, { bet: 0, tot: 0, show: null, last: '', st: s.stack > 0 && !s.leave ? 'in' : 'out' }); });
    if (t.seats.filter(canAct).length < 2) { t.phase = 'wait'; t.until = 0; return; }
    t.hid++; t.board = []; t.win = null; t.runout = false;
    t.btn = next(t, t.btn, canAct);
    const heads = t.seats.filter(canAct).length === 2;
    const sbI = heads ? t.btn : next(t, t.btn, canAct);
    const bbI = next(t, sbI, canAct);
    move(t.seats[sbI], SB); t.seats[sbI].last = 'SB';
    move(t.seats[bbI], BB); t.seats[bbI].last = 'BB';
    t.sbI = sbI; t.bbI = bbI;
    t.cur = BB; t.minR = BB; t.acted = [];
    pv.deck = C.deck(); pv.hole = {};
    t.seats.forEach((s, i) => { if (live(s)) { pv.hole[i] = [pv.deck.pop(), pv.deck.pop()]; pm(s.pid, 'hole', { g: 'poker', hid: t.hid, cards: pv.hole[i] }); } });
    t.phase = 'pre';
    const first = next(t, bbI, canAct);
    if (first < 0) { t.runout = true; t.turn = -1; t.until = now + 1200; } else setTurn(t, first, now);
  }

  function roundDone(t) {
    return t.seats.every((s, i) => !canAct(s) || (t.acted.includes(i) && s.bet === t.cur));
  }

  function dealStreet(t, pv) {
    t.seats.forEach((s) => { if (s) { s.bet = 0; if (s.st === 'in') s.last = ''; } });
    t.cur = 0; t.minR = BB; t.acted = [];
    if (t.phase === 'pre') { pv.deck.pop(); t.board.push(pv.deck.pop(), pv.deck.pop(), pv.deck.pop()); t.phase = 'flop'; }
    else if (t.phase === 'flop') { pv.deck.pop(); t.board.push(pv.deck.pop()); t.phase = 'turn'; }
    else if (t.phase === 'turn') { pv.deck.pop(); t.board.push(pv.deck.pop()); t.phase = 'river'; }
  }

  function afterAction(t, now, pv, pm) {
    const alive = t.seats.map((s, i) => (live(s) ? i : -1)).filter((i) => i >= 0);
    if (alive.length === 1) return winUncontested(t, alive[0], now);
    if (!roundDone(t)) {
      const i = next(t, t.turn, (s, j) => canAct(s) && (!t.acted.includes(j) || s.bet < t.cur));
      if (i >= 0) return setTurn(t, i, now);
    }
    if (t.phase === 'river') return showdown(t, now, pv, pm);
    dealStreet(t, pv);
    if (t.seats.filter(canAct).length <= 1) { t.runout = true; t.turn = -1; t.until = now + 1400; return; }
    setTurn(t, next(t, t.btn, canAct), now);
  }

  function winUncontested(t, i, now) {
    const s = t.seats[i], amt = pot(t);
    s.stack += amt;
    t.win = [{ seat: i, nick: s.nick, amt, name: '' }];
    log(t, `${s.nick} забрал ${fmt(amt)}`);
    t.phase = 'show'; t.turn = -1; t.until = now + WIN_LEN;
    t.seats.forEach((x) => { if (x) x.bet = 0; });
  }

  function showdown(t, now, pv, pm) {
    while (t.board.length < 5) t.board.push(pv.deck.pop());
    const sc = {};
    t.seats.forEach((s, i) => { if (live(s) && pv.hole[i]) { sc[i] = C.best(pv.hole[i].concat(t.board)); s.show = pv.hole[i]; } });
    // сайд-поты: делим банк по уровням вложений
    const levels = [...new Set(t.seats.filter(Boolean).map((s) => s.tot).filter((v) => v > 0))].sort((a, b) => a - b);
    const won = {};
    let prev = 0;
    levels.forEach((lvl) => {
      const part = t.seats.reduce((a, s) => a + (s ? Math.max(0, Math.min(s.tot, lvl) - prev) : 0), 0);
      let el = Object.keys(sc).map(Number).filter((i) => t.seats[i].tot >= lvl);
      if (!el.length) el = Object.keys(sc).map(Number);
      const top = Math.max(...el.map((i) => sc[i].v));
      const ws = el.filter((i) => sc[i].v === top);
      const share = Math.floor(part / ws.length);
      ws.forEach((i) => { won[i] = (won[i] || 0) + share; });
      const rest = part - share * ws.length;
      if (rest) { const first = next(t, t.btn, (s, j) => ws.includes(j)); won[first] += rest; }
      prev = lvl;
    });
    t.win = Object.entries(won).map(([i, amt]) => { const s = t.seats[i]; s.stack += amt; return { seat: +i, nick: s.nick, amt, name: sc[i].name }; });
    t.win.forEach((w) => log(t, `${w.nick} выиграл ${fmt(w.amt)} — ${w.name}`));
    t.seats.forEach((s, i) => { if (s && sc[i]) s.hand = sc[i].name; });
    t.phase = 'show'; t.turn = -1; t.until = now + SHOW_LEN;
    t.seats.forEach((x) => { if (x) x.bet = 0; });
  }

  // встать из-за стола: фишки вернутся игроку (или запишутся в долг, если он офлайн)
  function standUp(t, i, pm, online) {
    const s = t.seats[i];
    if (!s) return;
    if (s.stack > 0) {
      if (online.has(s.pid)) pm(s.pid, 'cashout', { g: 'poker', amt: s.stack });
      else t.owed[s.pid] = (t.owed[s.pid] || 0) + s.stack;
    }
    log(t, `${s.nick} встал из-за стола`);
    t.seats[i] = null;
  }

  function endHand(t, pm, online) {
    t.seats.forEach((s, i) => {
      if (!s) return;
      s.show = null; s.hand = ''; s.bet = 0; s.tot = 0; s.last = '';
      if (s.leave || s.stack <= 0) standUp(t, i, pm, online);
      else s.st = 'wait';
    });
    t.board = []; t.phase = 'wait'; t.until = 0; t.turn = -1; t.runout = false;
  }

  Z.register({
    id: 'poker', name: 'Покер', icon: '♠', kind: 'table',
    hostInit: () => ({ seats: Array(N).fill(null), phase: 'wait', board: [], btn: -1, turn: -1, until: 0, cur: 0, minR: BB, hid: 0, acted: [], win: null, owed: {}, log: [] }),
    hostAdopt(t) {
      // карт на руках у нового хоста нет — раздачу отменяем и возвращаем ставки
      if (!BET_PHASES.includes(t.phase)) return;
      t.seats.forEach((s) => { if (s) { s.stack += s.tot; Object.assign(s, { bet: 0, tot: 0, st: 'wait', show: null, last: '' }); } });
      Object.assign(t, { phase: 'wait', board: [], turn: -1, until: 0, runout: false });
      log(t, 'Хост сменился — раздача отменена, ставки вернули');
    },
    hostTick(t, now, pv, pm, online) {
      t.seats.forEach((s, i) => {
        if (!s) return;
        if (online.has(s.pid)) { s.offAt = 0; return; }
        if (!s.offAt) s.offAt = now;
        else if (now - s.offAt > OFFLINE_KICK) { s.leave = true; s.away = true; if (!BET_PHASES.includes(t.phase) && t.phase !== 'show') standUp(t, i, pm, online); }
      });
      if (t.phase === 'wait') {
        const ready = t.seats.filter((s) => s && s.stack > 0 && !s.leave).length >= 2;
        if (!ready) { t.until = 0; return; }
        if (!t.until) t.until = now + START_DELAY;
        else if (now >= t.until) startHand(t, now, pv, pm);
        return;
      }
      if (t.phase === 'show') { if (now >= t.until) endHand(t, pm, online); return; }
      if (!pv.deck) { this.hostAdopt(t); return; }
      if (t.runout) {
        if (now < t.until) return;
        if (t.phase === 'river') return showdown(t, now, pv, pm);
        dealStreet(t, pv); t.until = now + 1400;
        return;
      }
      if (t.turn >= 0 && now >= t.until) {
        const s = t.seats[t.turn];
        if (!s) return afterAction(t, now, pv, pm);
        s.away = true;
        if (s.bet === t.cur) { s.last = 'Чек'; t.acted.push(t.turn); } else { s.st = 'fold'; s.last = 'Фолд'; }
        afterAction(t, now, pv, pm);
      }
    },
    hostAct(t, pid, nk, m, now, pv, pm) {
      const i = t.seats.findIndex((s) => s && s.pid === pid);
      const s = t.seats[i];
      if (m.a === 'sit') {
        const buy = Math.floor(m.buy);
        if (i >= 0 || t.seats[m.seat] !== null || !(buy >= BUY_MIN && buy <= BUY_MAX) || m.seat < 0 || m.seat >= N) return pm(pid, 'sitfail', { g: 'poker', amt: buy });
        t.seats[m.seat] = { pid, nick: nk, stack: buy, bet: 0, tot: 0, st: 'wait', away: false, leave: false, show: null, last: '' };
        log(t, `${nk} сел за стол с ${fmt(buy)}`);
        return pm(pid, 'sat', { g: 'poker', amt: buy });
      }
      if (m.a === 'claim' && t.owed[pid]) { pm(pid, 'cashout', { g: 'poker', amt: t.owed[pid] }); delete t.owed[pid]; return; }
      if (!s) return;
      if (m.a === 'hole' && pv.hole && pv.hole[i] && m.hid === t.hid) return pm(pid, 'hole', { g: 'poker', hid: t.hid, cards: pv.hole[i] });
      if (m.a === 'back') { s.away = false; return; }
      if (m.a === 'stand') {
        if (!BET_PHASES.includes(t.phase) || !live(s)) { if (t.phase === 'show') { s.leave = true; return; } return standUp(t, i, pm, new Set([pid])); }
        s.leave = true;
        if (s.st === 'in') { s.st = 'fold'; s.last = 'Встал'; if (t.turn === i) return afterAction(t, now, pv, pm); const alive = t.seats.filter(live); if (alive.length === 1) afterAction(t, now, pv, pm); }
        return;
      }
      if (!BET_PHASES.includes(t.phase) || t.turn !== i || t.runout) return;
      s.away = false;
      if (m.a === 'fold') { s.st = 'fold'; s.last = 'Фолд'; }
      else if (m.a === 'check') { if (s.bet !== t.cur) return; s.last = 'Чек'; }
      else if (m.a === 'call') { const a = move(s, t.cur - s.bet); s.last = s.st === 'allin' ? `Олл-ин ${fmt(s.bet)}` : `Колл ${fmt(a)}`; }
      else if (m.a === 'raise' || m.a === 'allin') {
        const maxTo = s.bet + s.stack;
        let to = m.a === 'allin' ? maxTo : Math.floor(m.to);
        if (to >= maxTo) to = maxTo;
        else if (to < t.cur + t.minR) return pm(pid, 'toast', { txt: `Минимальный рейз до ${fmt(t.cur + t.minR)}` });
        if (to <= t.cur) { const a = move(s, t.cur - s.bet); s.last = s.st === 'allin' ? 'Олл-ин' : `Колл ${fmt(a)}`; }
        else {
          if (to - t.cur >= t.minR) t.minR = to - t.cur;
          t.cur = to; move(s, to - s.bet); t.acted = [];
          s.last = s.st === 'allin' ? `Олл-ин ${fmt(to)}` : `Рейз до ${fmt(to)}`;
        }
      } else return;
      if (!t.acted.includes(i)) t.acted.push(i);
      afterAction(t, now, pv, pm);
    },
    onPm(m) {
      if (m.kind === 'hole') { my.hole = { hid: m.hid, cards: m.cards }; C.sound.play('card'); }
      else if (m.kind === 'sat') { my.buy = m.amt; C.sound.play('chips'); }
      else if (m.kind === 'sitfail') { M.credit(m.amt, 'poker', { refund: true }); window.QBApp.toast('Место уже заняли — фишки вернули'); }
      else if (m.kind === 'cashout') {
        M.credit(m.amt, 'poker', { refund: true });
        const net = m.amt - (my.buy || 0);
        window.QBApp.toast(`Встал из-за стола: ${fmt(m.amt)}${my.buy ? ` (${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))})` : ''}`);
        if (net >= 50000) Z.announce(`♠ <b>${esc(Z.nick())}</b> встал из-за покерного стола в плюсе на ${fmt(net)}`, 'win');
        my.buy = 0;
        C.sound.play('cash');
      } else if (m.kind === 'toast') window.QBApp.toast(m.txt);
    },
    onState(t) {
      if (!t) return;
      const s = t.seats.find((x) => x && x.pid === Z.me);
      if (s && BET_PHASES.includes(t.phase) && live(s) && (!my.hole || my.hole.hid !== t.hid) && my.asked !== t.hid) { my.asked = t.hid; Z.act('poker', { a: 'hole', hid: t.hid }); }
      if (t.owed && t.owed[Z.me] && Date.now() - (my.claimAt || 0) > 4000) { my.claimAt = Date.now(); Z.act('poker', { a: 'claim' }); }
      if (t.win && t.hid !== my.wonHid && t.phase === 'show') {
        my.wonHid = t.hid;
        const w = t.win.find((x) => t.seats[x.seat] && t.seats[x.seat].pid === Z.me);
        if (w) C.sound.play('chips');
      }
    },
    mount(el) {
      el.innerHTML = `<div class="cz-felt cz-poker">
        <div class="cz-ptable" id="zpk-table">
          <div class="cz-pcenter"><div class="cz-board" id="zpk-board"></div><div class="cz-pot" id="zpk-pot"></div><div class="cz-plog" id="zpk-msg"></div></div>
          ${Array.from({ length: N }, (_, i) => `<div class="cz-pseat p${i}" id="zpk-s${i}"></div>`).join('')}
        </div>
        <div class="cz-row cz-pact" id="zpk-ctl"></div>
        <small class="cz-note">Блайнды ${SB}/${BB} · бай-ин ${fmt(BUY_MIN)}–${fmt(BUY_MAX)} · свои карты видишь только ты</small></div>`;
      el.addEventListener('click', onClick);
      el.addEventListener('input', (e) => { if (e.target.id === 'zpk-r') $('#zpk-rv').value = e.target.value; });
    },
    update(t, now) {
      if (!t || !$('#zpk-board')) return;
      const meI = t.seats.findIndex((s) => s && s.pid === Z.me);
      put($('#zpk-board'), Array.from({ length: 5 }, (_, i) => (t.board[i] != null ? cardHtml(t.board[i]) : '<i class="cz-card slot"></i>')).join(''));
      const p = pot(t);
      put($('#zpk-pot'), p ? `Банк <b>${fmt(p)}</b>` : '');
      const msg = t.phase === 'wait' ? (t.until ? `Раздача через ${Math.ceil((t.until - now) / 1000)} с` : 'Ждём хотя бы двух игроков — садитесь')
        : t.phase === 'show' && t.win ? t.win.map((w) => `🏆 <b>${esc(w.nick)}</b> +${fmt(w.amt)}${w.name ? ` · ${w.name}` : ''}`).join('<br>') : '';
      put($('#zpk-msg'), msg);
      t.seats.forEach((s, i) => {
        const el = $('#zpk-s' + i);
        if (!s) { el.className = `cz-pseat p${i} empty`; put(el, meI < 0 ? `<button class="cz-btn ghost" data-sit="${i}">Сесть</button>` : ''); return; }
        const mine = s.pid === Z.me;
        const cards = live(s) || s.st === 'fold'
          ? (s.show ? s.show.map((c) => cardHtml(c)).join('') : mine && my.hole && my.hole.hid === t.hid ? my.hole.cards.map((c) => cardHtml(c, s.st === 'fold' ? 'dim' : '')).join('') : s.st === 'fold' ? '' : cardHtml(-1) + cardHtml(-1))
          : '';
        const turn = t.turn === i && BET_PHASES.includes(t.phase);
        const left = turn ? Math.max(0, (t.until - now) / (s.away ? AWAY_TURN : TURN)) : 0;
        const won = t.win && t.win.find((w) => w.seat === i);
        el.className = `cz-pseat p${i} ${mine ? 'me' : ''} ${turn ? 'turn' : ''} ${s.st} ${won ? 'won' : ''}`;
        put(el, `<div class="cz-pcards">${cards}</div>
          <div class="cz-pinfo"><i class="cz-ava">${esc(s.nick.slice(0, 2).toUpperCase())}</i><div><b>${esc(s.nick)}${s.away ? ' 💤' : ''}</b><em>${fmt(s.stack)}</em></div>${t.btn === i && t.phase !== 'wait' ? '<u class="cz-dealer">D</u>' : ''}</div>
          ${s.last || s.hand ? `<small class="cz-plast">${esc(s.hand || s.last)}</small>` : ''}
          ${s.bet ? `<span class="cz-pbet">${fmt(s.bet)}</span>` : ''}
          ${won ? `<span class="cz-pwon">+${fmt(won.amt)}</span>` : ''}`);
        el.querySelector('.cz-pinfo').style.setProperty('--p', left);
      });
      // панель действий: пересобираем только при смене ситуации, чтобы не сбивать ползунок
      const s = t.seats[meI];
      const myTurn = s && t.turn === meI && BET_PHASES.includes(t.phase) && !t.runout;
      const key = `${meI}|${myTurn}|${t.cur}|${s && s.bet}|${s && s.stack}|${s && s.away}|${t.phase}`;
      const ctl = $('#zpk-ctl');
      if (ctl.dataset.k === key) return;
      ctl.dataset.k = key;
      if (meI < 0) { ctl.innerHTML = '<span class="cz-note">Нажми «Сесть» на свободном месте</span>'; return; }
      if (!myTurn) {
        ctl.innerHTML = `${s.away ? '<button class="cz-btn gold" data-pk="back">Я тут!</button>' : ''}<span class="cz-note">${BET_PHASES.includes(t.phase) ? (live(s) ? 'Жди свой ход' : 'Пропускаешь раздачу') : 'Ждём раздачу'}</span><button class="cz-btn ghost" data-pk="stand">Встать${s.leave ? ' (после раздачи)' : ''}</button>`;
        return;
      }
      C.sound.play('turn');
      const toCall = t.cur - s.bet, maxTo = s.bet + s.stack;
      const minTo = Math.min(maxTo, t.cur + t.minR);
      const potNow = pot(t);
      const presets = [['½ банка', Math.floor(t.cur + (potNow + toCall) / 2)], ['Банк', Math.floor(t.cur + potNow + toCall)]].filter(([, v]) => v > minTo && v < maxTo);
      ctl.innerHTML = `<button class="cz-btn red" data-pk="fold">Фолд</button>
        ${toCall > 0 ? `<button class="cz-btn" data-pk="call">${toCall >= s.stack ? `Олл-ин ${fmt(s.stack)}` : `Колл ${fmt(toCall)}`}</button>` : '<button class="cz-btn" data-pk="check">Чек</button>'}
        ${maxTo > t.cur ? `<div class="cz-raise"><input type="range" id="zpk-r" min="${minTo}" max="${maxTo}" step="${BB / 2}" value="${minTo}"><input class="cz-inp" id="zpk-rv" value="${minTo}">
          ${presets.map(([n, v]) => `<button class="cz-mini" data-to="${v}">${n}</button>`).join('')}<button class="cz-mini" data-to="${maxTo}">Олл-ин</button>
          <button class="cz-btn gold" data-pk="raise">${t.cur ? 'Рейз' : 'Бет'}</button></div>` : ''}`;
    },
  });
  const my = { hole: null, buy: 0 };

  function onClick(e) {
    const b = e.target.closest('[data-sit], [data-pk], [data-to]');
    if (!b) return;
    const t = Z.S && Z.S.t.poker;
    if (!t) return;
    if (b.dataset.to) { $('#zpk-rv').value = b.dataset.to; $('#zpk-r').value = b.dataset.to; return; }
    if (b.dataset.sit != null) {
      const seat = +b.dataset.sit;
      Z.modal(`<b>♠ Сесть за стол</b><small>Бай-ин от ${fmt(BUY_MIN)} до ${fmt(BUY_MAX)} (блайнды ${SB}/${BB}). У тебя ${fmt(M.bal)}</small>
        <input class="cz-inp" id="zpk-buy" value="${Math.min(BB * 100, Math.max(BUY_MIN, Math.floor(M.bal / 2)), BUY_MAX)}">`, (ov) => {
        const buy = Z.parseAmt($('#zpk-buy', ov).value);
        if (!(buy >= BUY_MIN && buy <= BUY_MAX)) { window.QBApp.toast(`От ${fmt(BUY_MIN)} до ${fmt(BUY_MAX)}`); return false; }
        if (!M.pay(buy, 'poker')) return false;
        Z.act('poker', { a: 'sit', seat, buy });
      });
      return;
    }
    const a = b.dataset.pk;
    if (a === 'stand' && !confirm('Встать из-за стола? Фишки вернутся на баланс.')) return;
    if (a === 'raise') return Z.act('poker', { a: 'raise', to: Z.parseAmt($('#zpk-rv').value) });
    Z.act('poker', { a });
    if (a !== 'stand' && a !== 'back') C.sound.play(a === 'fold' ? 'card' : 'chip');
  }
})();
