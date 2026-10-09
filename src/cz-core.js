// «Казик» — общие утилиты: деньги, случайность, карты, покерные комбинации, звук
(function () {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function fmt(n) {
    n = Math.floor(Number(n) || 0);
    const neg = n < 0; n = Math.abs(n);
    let s;
    if (n >= 1e12) s = (n / 1e12).toFixed(n >= 1e13 ? 1 : 2) + 'T';
    else if (n >= 1e9) s = (n / 1e9).toFixed(n >= 1e10 ? 1 : 2) + 'B';
    else if (n >= 1e6) s = (n / 1e6).toFixed(n >= 1e7 ? 1 : 2) + 'M';
    else if (n >= 1e4) s = (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + 'K';
    else s = n.toLocaleString('ru-RU');
    return (neg ? '−' : '') + s.replace('.00', '').replace(/\.0([KMBT])$/, '$1');
  }
  const full = (n) => Math.floor(n).toLocaleString('ru-RU');

  // криптостойкий генератор: [0, 1)
  const buf = new Uint32Array(1);
  const rand = () => { crypto.getRandomValues(buf); return buf[0] / 4294967296; };
  const rint = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ---------------- карты: число 0..51 → ранг 2..14, масть 0..3 ---------------- */
  const rank = (c) => (c % 13) + 2;
  const suit = (c) => Math.floor(c / 13);
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };
  const rankTxt = (r) => RANKS[r] || String(r);
  const deck = (n = 1) => shuffle(Array.from({ length: 52 * n }, (_, i) => i % 52));
  const cardHtml = (c, cls = '') => {
    if (c == null || c < 0) return `<i class="cz-card back ${cls}"></i>`;
    const r = rank(c), s = suit(c);
    return `<i class="cz-card ${s === 1 || s === 2 ? 'red' : ''} ${cls}"><b>${rankTxt(r)}</b><u>${SUITS[s]}</u><em>${SUITS[s]}</em></i>`;
  };

  /* ---------------- покер: сила лучшей пятёрки из 7 карт ---------------- */
  const HANDS = ['Старшая карта', 'Пара', 'Две пары', 'Сет', 'Стрит', 'Флеш', 'Фулл-хаус', 'Каре', 'Стрит-флеш', 'Роял-флеш'];
  function score5(cs) {
    const rs = cs.map(rank).sort((a, b) => b - a);
    const flush = cs.every((c) => suit(c) === suit(cs[0]));
    const uniq = [...new Set(rs)];
    let straight = 0;
    if (uniq.length === 5) {
      if (rs[0] - rs[4] === 4) straight = rs[0];
      else if (rs[0] === 14 && rs[1] === 5) straight = 5; // A-2-3-4-5
    }
    const cnt = {};
    rs.forEach((r) => { cnt[r] = (cnt[r] || 0) + 1; });
    const groups = Object.entries(cnt).map(([r, n]) => [n, +r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
    const kick = groups.map((g) => g[1]);
    let cat;
    if (straight && flush) cat = straight === 14 ? 9 : 8;
    else if (groups[0][0] === 4) cat = 7;
    else if (groups[0][0] === 3 && groups[1][0] === 2) cat = 6;
    else if (flush) cat = 5;
    else if (straight) cat = 4;
    else if (groups[0][0] === 3) cat = 3;
    else if (groups[0][0] === 2 && groups[1][0] === 2) cat = 2;
    else if (groups[0][0] === 2) cat = 1;
    else cat = 0;
    const ks = straight ? [straight] : kick;
    let v = cat;
    for (let i = 0; i < 5; i++) v = v * 15 + (ks[i] || 0);
    return { v, cat };
  }
  // лучшая пятёрка из 5–7 карт: перебираем, какие карты выкинуть
  function bestAny(cards) {
    const n = cards.length;
    let top = null, hand = null;
    const tryFive = (five) => { const sc = score5(five); if (!top || sc.v > top.v) { top = sc; hand = five; } };
    if (n <= 5) tryFive(cards);
    else if (n === 6) for (let a = 0; a < 6; a++) tryFive(cards.filter((_, i) => i !== a));
    else for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) tryFive(cards.filter((_, i) => i !== a && i !== b));
    return { ...top, name: HANDS[top.cat], cards: hand };
  }

  /* ---------------- блэкджек ---------------- */
  function bjValue(cards) {
    let v = 0, aces = 0;
    cards.forEach((c) => { const r = rank(c); if (r === 14) { aces++; v += 11; } else v += Math.min(10, r); });
    while (v > 21 && aces) { v -= 10; aces--; }
    return { v, soft: aces > 0 };
  }

  /* ---------------- звук: синтез через Web Audio ---------------- */
  let ctx = null, master = null, vol = 0.6, muted = false;
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : vol;
    master.connect(comp).connect(ctx.destination);
    return true;
  }
  let noise = null;
  const getNoise = () => {
    if (noise) return noise;
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noise;
  };
  function burst({ t = 0, len = 0.02, f = 3000, q = 1, type = 'bandpass', g = 0.2 } = {}) {
    const at = ctx.currentTime + t;
    const src = ctx.createBufferSource(); src.buffer = getNoise();
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const gn = ctx.createGain(); gn.gain.setValueAtTime(g, at); gn.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(fl).connect(gn).connect(master);
    src.start(at, Math.random() * 0.5, len + 0.05);
  }
  function tone({ t = 0, f = 880, f2 = null, len = 0.12, type = 'sine', g = 0.1 } = {}) {
    const at = ctx.currentTime + t;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + len);
    const gn = ctx.createGain(); gn.gain.setValueAtTime(0.0001, at); gn.gain.exponentialRampToValueAtTime(g, at + 0.005); gn.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(gn).connect(master); o.start(at); o.stop(at + len + 0.05);
  }
  const notes = (arr, step, opt = {}) => arr.forEach((s, i) => tone({ t: i * step, f: 523.25 * Math.pow(2, s / 12), len: opt.len || 0.2, type: opt.type || 'triangle', g: opt.g || 0.08 }));
  const FX = {
    chip() { burst({ len: 0.03, f: 4200, q: 3, g: 0.25 }); burst({ t: 0.035, len: 0.025, f: 5200, q: 4, g: 0.15 }); },
    chips() { for (let i = 0; i < 6; i++) burst({ t: i * 0.045 + Math.random() * 0.02, len: 0.03, f: 3800 + Math.random() * 1800, q: 3, g: 0.18 }); },
    card() { burst({ len: 0.08, f: 2500, q: 0.6, type: 'highpass', g: 0.12 }); burst({ t: 0.03, len: 0.03, f: 900, q: 2, g: 0.1 }); },
    tick() { burst({ len: 0.012, f: 3500, q: 5, g: 0.12 }); },
    reel() { burst({ len: 0.06, f: 180, q: 1, type: 'lowpass', g: 0.5 }); tone({ f: 220, f2: 110, len: 0.08, type: 'square', g: 0.03 }); },
    spin() { for (let i = 0; i < 10; i++) burst({ t: i * 0.04, len: 0.015, f: 2000 + i * 100, q: 4, g: 0.06 }); },
    win() { notes([0, 4, 7, 12], 0.07); },
    big() { notes([0, 4, 7, 12, 16, 19, 24], 0.08, { len: 0.3, g: 0.09 }); tone({ t: 0.55, f: 2093, len: 0.8, g: 0.05 }); },
    lose() { tone({ f: 300, f2: 120, len: 0.35, type: 'sawtooth', g: 0.05 }); },
    boom() { burst({ len: 0.6, f: 300, q: 0.5, type: 'lowpass', g: 0.9 }); tone({ f: 120, f2: 30, len: 0.6, type: 'sine', g: 0.4 }); },
    gem() { tone({ f: 1568, len: 0.12, g: 0.08 }); tone({ t: 0.05, f: 2349, len: 0.18, g: 0.06 }); },
    peg(i = 0) { tone({ f: 900 + i * 60, len: 0.05, type: 'triangle', g: 0.05 }); },
    cash() { for (let i = 0; i < 8; i++) tone({ t: i * 0.045, f: 1500 + Math.random() * 1200, len: 0.08, type: 'square', g: 0.025 }); },
    turn() { tone({ f: 880, len: 0.1, g: 0.08 }); tone({ t: 0.12, f: 1320, len: 0.16, g: 0.08 }); },
    msg() { tone({ f: 1200, len: 0.06, g: 0.04 }); },
    err() { tone({ f: 200, len: 0.15, type: 'square', g: 0.04 }); },
    dice() { for (let i = 0; i < 5; i++) burst({ t: i * 0.06 + Math.random() * 0.03, len: 0.03, f: 1200 + Math.random() * 800, q: 2, g: 0.25 }); },
  };
  // мяч рулетки: щелчки, которые замедляются
  function ballTicks(dur) {
    if (muted || !ensure()) return;
    let t = 0, gap = 0.04;
    while (t < dur) { burst({ t, len: 0.012, f: 3000 + Math.random() * 800, q: 5, g: 0.1 }); t += gap; gap *= 1.07; }
  }

  const sound = {
    get muted() { return muted; },
    setVol(v) { vol = v; if (master) master.gain.value = muted ? 0 : vol; },
    setMuted(m) { muted = m; if (master) master.gain.value = muted ? 0 : vol; },
    play(name, ...a) { if (muted || !ensure() || !FX[name]) return; FX[name](...a); },
    ballTicks,
  };

  window.CZ = { esc, fmt, full, rand, rint, pick, shuffle, rank, suit, SUITS, rankTxt, deck, cardHtml, best: bestAny, HANDS, bjValue, sound };
})();
