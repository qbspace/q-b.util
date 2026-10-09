// «Казик» — Блэкджек за общим столом: до 5 игроков против дилера
(function () {
  const C = window.CZ, Z = window.CZApp;
  if (!C || !Z) return;
  // ищем только внутри казика: в «Номерах РФ» есть элементы с такими же id
  const $ = (s, r = document.getElementById('cz')) => r.querySelector(s);
  const { fmt, esc, cardHtml, bjValue } = C;
  const M = Z.money;
  // перерисовываем, только если html поменялся — иначе анимации карт стартуют заново
  const put = (el, html) => { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } };
  const SEATS = 5, BET_LEN = 10000, TURN_LEN = 20000, DONE_LEN = 5500;
  const isBJ = (cards) => cards.length === 2 && bjValue(cards).v === 21;

  const draw = (pv) => {
    if (!pv.shoe || pv.shoe.length < 60) pv.shoe = C.deck(6);
    return pv.shoe.pop();
  };
  // следующий, кто ещё ходит
  function nextTurn(t, now) {
    const i = t.seats.findIndex((s) => s.st === 'play');
    if (i >= 0) { t.turn = i; t.until = now + TURN_LEN; return; }
    t.turn = -1; t.phase = 'dealer'; t.until = now + 700;
  }
  function settle(t, now) {
    const d = bjValue(t.dealer).v, dBJ = isBJ(t.dealer);
    t.seats.forEach((s) => {
      const p = bjValue(s.hand).v, stake = s.bet * (s.dbl ? 2 : 1);
      let pay = 0, res = 'lose';
      if (s.st === 'bust') res = 'bust';
      else if (s.st === 'bj') { if (dBJ) { pay = stake; res = 'push'; } else { pay = Math.floor(stake * 2.5); res = 'bj'; } }
      else if (dBJ) res = 'lose';
      else if (d > 21 || p > d) { pay = stake * 2; res = 'win'; }
      else if (p === d) { pay = stake; res = 'push'; }
      s.pay = pay; s.res = res;
    });
    t.phase = 'done'; t.until = now + DONE_LEN;
  }

  Z.register({
    id: 'bj', name: 'Блэкджек', icon: '🃏', kind: 'table',
    hostInit: () => ({ phase: 'bet', until: 0, rid: 1, seats: [], dealer: [], turn: -1 }),
    hostAdopt(t) { /* состояние стола открытое — просто продолжаем с новым башмаком */ },
    hostTick(t, now, pv) {
      if (t.phase === 'bet' && t.until && now >= t.until) {
        t.dealer = [draw(pv)];
        t.seats.forEach((s) => { s.hand = [draw(pv), draw(pv)]; s.st = isBJ(s.hand) ? 'bj' : 'play'; });
        t.phase = 'play';
        nextTurn(t, now);
      } else if (t.phase === 'play' && now >= t.until) {
        const s = t.seats[t.turn];
        if (s) s.st = 'stand';
        nextTurn(t, now);
      } else if (t.phase === 'dealer' && now >= t.until) {
        // дилер добирает до 17, на мягких 17 стоит; если все перебрали — открывает одну карту
        const alive = t.seats.some((s) => s.st === 'stand' || s.st === 'bj');
        const v = bjValue(t.dealer).v;
        if (t.dealer.length < 2 || (alive && v < 17)) { t.dealer.push(draw(pv)); t.until = now + 750; }
        else settle(t, now);
      } else if (t.phase === 'done' && now >= t.until) {
        Object.assign(t, { phase: 'bet', until: 0, rid: t.rid + 1, seats: [], dealer: [], turn: -1 });
      }
    },
    hostAct(t, pid, nk, m, now, pv, pm) {
      if (m.rid !== t.rid) { if (m.a === 'double') pm(pid, 'refund', { g: 'bj', amt: m.amt }); return; }
      if (m.a === 'bet') {
        if (t.phase !== 'bet' || t.seats.length >= SEATS || t.seats.some((s) => s.pid === pid)) return pm(pid, 'refund', { g: 'bj', amt: m.amt, why: 'Мест нет или раздача уже идёт', bet: true });
        t.seats.push({ pid, nick: nk, bet: Math.floor(m.amt), hand: [], st: 'wait', dbl: false });
        if (!t.until) t.until = now + BET_LEN;
        return;
      }
      const s = t.seats[t.turn];
      if (t.phase !== 'play' || !s || s.pid !== pid) { if (m.a === 'double') pm(pid, 'refund', { g: 'bj', amt: m.amt }); return; }
      if (m.a === 'hit') {
        s.hand.push(draw(pv));
        const v = bjValue(s.hand).v;
        if (v > 21) { s.st = 'bust'; nextTurn(t, now); } else if (v === 21) { s.st = 'stand'; nextTurn(t, now); } else t.until = now + TURN_LEN;
      } else if (m.a === 'stand') { s.st = 'stand'; nextTurn(t, now); }
      else if (m.a === 'double') {
        if (s.hand.length !== 2 || s.dbl || m.amt !== s.bet) return pm(pid, 'refund', { g: 'bj', amt: m.amt });
        s.dbl = true; s.hand.push(draw(pv));
        s.st = bjValue(s.hand).v > 21 ? 'bust' : 'stand';
        nextTurn(t, now);
      }
    },
    onPm(m) {
      if (m.kind !== 'refund') return;
      if (m.bet) { if (my.settled) return; my.settled = true; } // ставку за стол возвращаем один раз
      M.credit(m.amt, 'bj', { refund: true });
      if (m.why) window.QBApp.toast(m.why);
    },
    onState(t) {
      if (!t || my.settled) return;
      const s = t.rid === my.rid && t.seats.find((x) => x.pid === Z.me);
      if (s && t.phase === 'done' && s.pay != null) {
        my.settled = true;
        if (s.pay > 0) {
          M.credit(s.pay, 'bj', { mult: s.pay / (s.bet * (s.dbl ? 2 : 1)), profit: s.pay - s.bet * (s.dbl ? 2 : 1), refund: s.res === 'push' });
          C.sound.play(s.res === 'push' ? 'chip' : 'win');
        } else C.sound.play('lose');
        return;
      }
      // ставку не посадили за стол — возвращаем
      if (!s && (t.rid > my.rid || t.phase !== 'bet')) { my.settled = true; M.credit(my.amt, 'bj', { refund: true }); }
    },
    onLeave() { if (!my.settled) { my.settled = true; M.credit(my.amt, 'bj', { refund: true }); } },
    mount(el) {
      el.innerHTML = `<div class="cz-felt cz-bj">
        <div class="cz-bj-dealer"><small>ДИЛЕР</small><div class="cz-hand" id="zbj-d"></div><b id="zbj-dv"></b></div>
        <div class="cz-bj-msg" id="zbj-msg"></div>
        <div class="cz-bj-seats" id="zbj-seats"></div>
        <div class="cz-row" id="zbj-ctl"></div>
        <small class="cz-note">Блэкджек платит 3:2. Дилер добирает до 17. Удвоение — на первых двух картах.</small></div>`;
      el.addEventListener('click', onClick);
    },
    update(t, now) {
      if (!t || !$('#zbj-d')) return;
      put($('#zbj-d'), t.dealer.map((c) => cardHtml(c)).join('') + (t.phase === 'play' ? cardHtml(-1) : ''));
      $('#zbj-dv').textContent = t.dealer.length ? bjValue(t.dealer).v : '';
      const msg = t.phase === 'bet' ? (t.until ? `Раздача через ${Math.ceil((t.until - now) / 1000)} с — садись` : 'Делай ставку — раздача начнётся через 10 с после первой')
        : t.phase === 'play' ? `Ходит ${esc((t.seats[t.turn] || {}).nick || '')} · ${Math.ceil((t.until - now) / 1000)} с`
        : t.phase === 'dealer' ? 'Дилер добирает…' : 'Расчёт';
      put($('#zbj-msg'), msg);
      put($('#zbj-seats'), Array.from({ length: SEATS }, (_, i) => {
        const s = t.seats[i];
        if (!s) return '<div class="cz-bj-seat empty"><span>свободно</span></div>';
        const v = s.hand.length ? bjValue(s.hand).v : '';
        const RES = { win: 'ВЫИГРЫШ', bj: 'БЛЭКДЖЕК!', push: 'НИЧЬЯ', lose: 'ПРОИГРЫШ', bust: 'ПЕРЕБОР' };
        return `<div class="cz-bj-seat ${s.pid === Z.me ? 'me' : ''} ${t.turn === i && t.phase === 'play' ? 'turn' : ''} ${s.res || ''}">
          <div class="cz-hand">${s.hand.map((c) => cardHtml(c)).join('')}</div>
          <b>${v}${s.st === 'bust' ? ' · перебор' : s.st === 'bj' ? ' · BJ' : ''}</b>
          <div class="cz-seat-n"><span>${esc(s.nick)}</span><em>${fmt(s.bet * (s.dbl ? 2 : 1))}${s.dbl ? ' ×2' : ''}</em></div>
          ${s.res ? `<i class="cz-res">${RES[s.res]}${s.pay ? ` +${fmt(s.pay)}` : ''}</i>` : ''}</div>`;
      }).join(''));
      const seat = t.seats.find((x) => x.pid === Z.me);
      const myTurn = t.phase === 'play' && t.seats[t.turn] && t.seats[t.turn].pid === Z.me;
      const ctl = $('#zbj-ctl');
      const key = `${t.phase}|${!!seat}|${myTurn}|${seat && seat.hand.length}`;
      if (ctl.dataset.k !== key) {
        ctl.dataset.k = key;
        ctl.innerHTML = t.phase === 'bet' && !seat
          ? `${Z.betCtl('zbj-bet', 100)}<button class="cz-btn big" data-bj="bet">Сесть со ставкой</button>`
          : myTurn ? `<button class="cz-btn big" data-bj="hit">Ещё</button><button class="cz-btn big ghost" data-bj="stand">Хватит</button>${seat.hand.length === 2 && !seat.dbl ? `<button class="cz-btn big gold" data-bj="double">Удвоить · ${fmt(seat.bet)}</button>` : ''}`
          : `<span class="cz-note">${seat ? 'Ты за столом — жди свой ход' : 'Раздача идёт — сядешь в следующую'}</span>`;
        if (myTurn && !view.turnBeep) { C.sound.play('turn'); }
        view.turnBeep = myTurn;
      }
      // звук раздачи карт
      const n = t.dealer.length + t.seats.reduce((a, s) => a + s.hand.length, 0);
      if (n > (view.cards || 0)) C.sound.play('card');
      view.cards = n;
    },
  });
  const my = { rid: 0, amt: 0, settled: true };
  const view = {};

  function onClick(e) {
    const b = e.target.closest('[data-bj]');
    if (!b) return;
    const t = Z.S && Z.S.t.bj;
    if (!t) return;
    const a = b.dataset.bj;
    if (a === 'bet') {
      const amt = Z.readBet('zbj-bet');
      if (!M.pay(amt, 'bj')) return;
      Object.assign(my, { rid: t.rid, amt, settled: false });
      Z.act('bj', { a: 'bet', amt, rid: t.rid });
      C.sound.play('chips');
    } else if (a === 'double') {
      const seat = t.seats.find((x) => x.pid === Z.me);
      if (!seat || !M.pay(seat.bet, 'bj')) return;
      Z.act('bj', { a: 'double', amt: seat.bet, rid: t.rid });
    } else Z.act('bj', { a, rid: t.rid });
  }
})();
