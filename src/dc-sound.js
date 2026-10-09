// «Ночной дата-центр» — звук серверной. Всё синтезируется через Web Audio, без файлов
(function () {
  let ctx = null, master = null, amb = null, hddTimer = 0;
  let vol = 0.7, muted = false, ambOn = false;
  const st = { heat: 0, oc: 0, load: 0, act: 0 };

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : vol;
    master.connect(comp).connect(ctx.destination);
    return true;
  }

  function noiseBuf(sec = 2, brown = false) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w;
    }
    return b;
  }
  let white = null;
  const getWhite = () => white || (white = noiseBuf(1));

  // короткий шумовой щелчок через фильтр
  function burst({ t = 0, len = 0.012, f = 3000, q = 1.2, type = 'bandpass', g = 0.2 } = {}) {
    const at = ctx.currentTime + t;
    const src = ctx.createBufferSource();
    src.buffer = getWhite();
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const flt = ctx.createBiquadFilter();
    flt.type = type; flt.frequency.value = f; flt.Q.value = q;
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(g, at);
    gn.gain.exponentialRampToValueAtTime(0.0001, at + len);
    src.connect(flt).connect(gn).connect(master);
    src.start(at, Math.random() * 0.5, len + 0.02);
  }

  function tone({ t = 0, f = 880, f2 = null, len = 0.1, type = 'sine', g = 0.12, att = 0.004 } = {}) {
    const at = ctx.currentTime + t;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, at);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + len);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, at);
    gn.gain.exponentialRampToValueAtTime(g, at + att);
    gn.gain.exponentialRampToValueAtTime(0.0001, at + len);
    o.connect(gn).connect(master);
    o.start(at);
    o.stop(at + len + 0.05);
  }

  /* ---------- фон серверной: вентиляторы, гул, воздух, жёсткие диски ---------- */
  function startAmbient() {
    if (amb || !ensure()) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5);
    out.connect(master);

    // низкий гул вентиляторов — коричневый шум
    const fanSrc = ctx.createBufferSource();
    fanSrc.buffer = noiseBuf(4, true); fanSrc.loop = true;
    const fanLp = ctx.createBiquadFilter();
    fanLp.type = 'lowpass'; fanLp.frequency.value = 380;
    const fanG = ctx.createGain(); fanG.gain.value = 0.32;
    fanSrc.connect(fanLp).connect(fanG).connect(out);

    // свист воздуха из решёток
    const airSrc = ctx.createBufferSource();
    airSrc.buffer = noiseBuf(3); airSrc.loop = true;
    const airBp = ctx.createBiquadFilter();
    airBp.type = 'bandpass'; airBp.frequency.value = 2200; airBp.Q.value = 0.7;
    const airG = ctx.createGain(); airG.gain.value = 0.025;
    airSrc.connect(airBp).connect(airG).connect(out);

    // тон лопастей с лёгким «биением» двух кулеров
    const blade1 = ctx.createOscillator(), blade2 = ctx.createOscillator();
    blade1.type = 'triangle'; blade2.type = 'triangle';
    blade1.frequency.value = 118; blade2.frequency.value = 121.5;
    const bladeLp = ctx.createBiquadFilter();
    bladeLp.type = 'lowpass'; bladeLp.frequency.value = 600;
    const bladeG = ctx.createGain(); bladeG.gain.value = 0.018;
    blade1.connect(bladeLp); blade2.connect(bladeLp);
    bladeLp.connect(bladeG).connect(out);

    // сетевой гул трансформаторов 50 Гц
    const hum = ctx.createOscillator(), hum2 = ctx.createOscillator();
    hum.frequency.value = 50; hum2.frequency.value = 100;
    const humG = ctx.createGain(); humG.gain.value = 0.03;
    const hum2G = ctx.createGain(); hum2G.gain.value = 0.012;
    hum.connect(humG).connect(out); hum2.connect(hum2G).connect(out);

    // писк катушек под нагрузкой
    const coil = ctx.createOscillator();
    coil.frequency.value = 9800;
    const coilG = ctx.createGain(); coilG.gain.value = 0;
    coil.connect(coilG).connect(out);

    [fanSrc, airSrc, blade1, blade2, hum, hum2, coil].forEach((n) => n.start());
    amb = { out, fanLp, fanG, airBp, airG, blade1, blade2, bladeG, coilG, nodes: [fanSrc, airSrc, blade1, blade2, hum, hum2, coil] };
    apply();
    hddLoop();
  }

  function stopAmbient() {
    if (!amb) return;
    const a = amb;
    amb = null;
    clearTimeout(hddTimer);
    a.out.gain.cancelScheduledValues(ctx.currentTime);
    a.out.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
    setTimeout(() => a.nodes.forEach((n) => { try { n.stop(); } catch {} }), 1500);
  }

  // параметры фона плавно следуют за нагревом, разгоном и количеством железа
  function apply() {
    if (!amb) return;
    const t = ctx.currentTime;
    const spin = 1 + st.heat / 100 * 0.9 + st.oc * 0.25 + Math.min(1, st.load / 400) * 0.3;
    amb.fanLp.frequency.setTargetAtTime(300 + spin * 160, t, 0.8);
    amb.fanG.gain.setTargetAtTime(0.26 + spin * 0.08, t, 0.8);
    amb.airBp.frequency.setTargetAtTime(1600 + spin * 700, t, 0.8);
    amb.airG.gain.setTargetAtTime(0.018 + spin * 0.012, t, 0.8);
    amb.blade1.frequency.setTargetAtTime(105 * spin, t, 1.2);
    amb.blade2.frequency.setTargetAtTime(108.5 * spin, t, 1.2);
    amb.bladeG.gain.setTargetAtTime(0.012 + spin * 0.008, t, 0.8);
    amb.coilG.gain.setTargetAtTime(st.oc >= 2 ? 0.0025 * st.oc : 0, t, 0.5);
  }

  // жёсткие диски: позиционирование головок — серии сухих щелчков
  function hddLoop() {
    if (!amb) return;
    const busy = Math.min(1, st.load / 200) * 0.6 + st.act * 0.4;
    const n = 1 + Math.floor(Math.random() * (2 + busy * 5));
    for (let i = 0; i < n; i++) burst({ t: i * (0.018 + Math.random() * 0.03), len: 0.006 + Math.random() * 0.006, f: 2400 + Math.random() * 2600, q: 3, g: 0.05 + busy * 0.05 });
    hddTimer = setTimeout(hddLoop, (900 - busy * 650) * (0.3 + Math.random()));
  }

  /* ---------- эффекты ---------- */
  const fx = {
    // клик — механическая клава + реле, выше тон на большом комбо
    click(mul = 1) {
      burst({ len: 0.018, f: 4200, q: 0.8, type: 'highpass', g: 0.22 });
      burst({ t: 0.004, len: 0.03, f: 900 + mul * 40, q: 4, g: 0.12 });
      if (mul >= 5) tone({ f: 600 + mul * 60, f2: 300 + mul * 30, len: 0.05, type: 'square', g: 0.02 });
    },
    combo(mul) {
      [0, 4, 7, 12].forEach((s, i) => tone({ t: i * 0.05, f: 440 * Math.pow(2, (s + Math.min(mul, 15)) / 12), len: 0.14, type: 'square', g: 0.035 }));
    },
    buy() { tone({ f: 1320, len: 0.06, type: 'square', g: 0.04 }); tone({ t: 0.06, f: 1980, len: 0.09, type: 'square', g: 0.035 }); burst({ len: 0.03, f: 5000, type: 'highpass', g: 0.05 }); },
    err() { tone({ f: 180, len: 0.16, type: 'sawtooth', g: 0.06 }); tone({ t: 0.17, f: 150, len: 0.2, type: 'sawtooth', g: 0.06 }); },
    // POST-писк при загрузке сервера
    boot() { tone({ f: 1000, len: 0.18, type: 'square', g: 0.05 }); [0, 1, 2, 3, 4, 5].forEach((i) => burst({ t: 0.3 + i * 0.07, len: 0.01, f: 3000 + i * 300, q: 3, g: 0.08 })); },
    alarm() { [0, 1, 2].forEach((i) => { tone({ t: i * 0.36, f: 880, len: 0.17, type: 'square', g: 0.06 }); tone({ t: i * 0.36 + 0.18, f: 660, len: 0.17, type: 'square', g: 0.06 }); }); },
    boss() { tone({ f: 220, f2: 880, len: 0.9, type: 'sawtooth', g: 0.05 }); tone({ t: 0.9, f: 880, f2: 220, len: 0.9, type: 'sawtooth', g: 0.05 }); tone({ f: 55, len: 1.6, type: 'sine', g: 0.2 }); },
    hit() { for (let i = 0; i < 6; i++) burst({ t: i * 0.035, len: 0.03, f: 300 + Math.random() * 3000, q: 6, g: 0.18 }); tone({ f: 140, f2: 40, len: 0.35, type: 'sine', g: 0.25 }); },
    bossHit() { burst({ len: 0.04, f: 160, q: 1, type: 'lowpass', g: 0.5 }); burst({ len: 0.02, f: 3000, type: 'highpass', g: 0.08 }); },
    event() { tone({ f: 784, len: 0.12, g: 0.07 }); tone({ t: 0.12, f: 1175, len: 0.2, g: 0.07 }); },
    drop(r) {
      const notes = r === 'p' ? [0, 4, 7, 12, 16, 19, 24, 28] : r === 'l' ? [0, 4, 7, 12, 16, 19] : [0, 4, 7, 12];
      notes.forEach((s, i) => tone({ t: i * 0.07, f: 523 * Math.pow(2, s / 12), len: 0.25, type: 'triangle', g: 0.08 }));
      if (r === 'p') tone({ t: 0.6, f: 2093, len: 1.2, type: 'sine', g: 0.06 });
    },
    coin() { tone({ f: 1568, len: 0.05, type: 'square', g: 0.03 }); tone({ t: 0.05, f: 2093, len: 0.12, type: 'square', g: 0.03 }); },
    virus() { for (let i = 0; i < 10; i++) tone({ t: i * 0.06, f: 200 + Math.random() * 1600, len: 0.05, type: 'square', g: 0.04 }); },
    squash() { burst({ len: 0.05, f: 700, q: 2, g: 0.25 }); tone({ f: 900, f2: 200, len: 0.08, type: 'square', g: 0.03 }); },
    reboot() { tone({ f: 120, f2: 30, len: 0.8, type: 'sawtooth', g: 0.08 }); setTimeout(() => fx.boot(), 900); },
  };

  window.DCSound = {
    get muted() { return muted; },
    get vol() { return vol; },
    unlock() { ensure(); },
    setVol(v) { vol = Math.max(0, Math.min(1, v)); if (master) master.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, 0.05); },
    setMuted(m) { muted = !!m; if (master) master.gain.setTargetAtTime(muted ? 0 : vol, ctx.currentTime, 0.05); },
    ambient(on) {
      if (on === ambOn && (!on || amb)) return;
      ambOn = on;
      if (on) { if (ctx || navigator.userActivation?.hasBeenActive) startAmbient(); } else stopAmbient();
    },
    update(p) { Object.assign(st, p); apply(); },
    play(name, ...args) { if (muted || !ensure() || !fx[name]) return; fx[name](...args); if (ambOn && !amb) startAmbient(); },
  };
})();
