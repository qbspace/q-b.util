// «Дача» — рисованные иллюстрации: один стиль, мягкие цвета, тёплый контур
(function () {
  const O = '#5a3d2b'; // контур
  const sw = 'stroke="' + O + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"';
  const svg = (vb, body, cls = '') => `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  const shine = (x, y, rx, ry, r = -25) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".45" transform="rotate(${r} ${x} ${y})"/>`;
  const leaf = (x, y, r, c = '#7cc35a', s = 1) => `<path d="M${x} ${y}c${-6 * s} ${-4 * s} ${-8 * s} ${-12 * s} ${-3 * s} ${-18 * s}c${6 * s} ${4 * s} ${7 * s} ${12 * s} ${3 * s} ${18 * s}z" fill="${c}" ${sw} transform="rotate(${r} ${x} ${y})"/>`;

  /* ---------------- продукты (64×64) ---------------- */
  const ITEM = {
    radish: `${leaf(30, 24, -25)}${leaf(34, 24, 25, '#8fd06a')}
      <path d="M32 22c10 0 15 7 15 15 0 9-7 15-15 15s-15-6-15-15c0-8 5-15 15-15z" fill="#ec6a8c" ${sw}/>
      <path d="M32 52c0 4 1 7 3 9" fill="none" ${sw}/>${shine(26, 32, 4, 6)}`,
    carrot: `${leaf(29, 20, -30)}${leaf(32, 19, 0, '#8fd06a')}${leaf(35, 20, 30)}
      <path d="M22 20c6-2 14-2 20 0l-7 36c-1 4-5 4-6 0z" fill="#f39233" ${sw}/>
      <path d="M26 29h5M30 37h5M28 45h4" fill="none" stroke="#c96a1c" stroke-width="2" stroke-linecap="round"/>`,
    dill: `<g fill="none" stroke="#5f9e3f" stroke-width="2.2" stroke-linecap="round">
      <path d="M32 60V20M32 34l-10-8M32 30l10-9M32 44l-12-6M32 42l12-7M32 24l-6-8M32 22l6-8"/></g>
      <g fill="#8fd06a">${[[22, 26], [42, 21], [20, 38], [44, 35], [26, 16], [38, 14], [32, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2"/>`).join('')}</g>
      <circle cx="32" cy="14" r="5" fill="#f6d55c" ${sw}/>`,
    potato: `<path d="M14 36c0-11 10-17 19-16 11 1 18 7 17 16-1 10-10 15-19 15-10 0-17-6-17-15z" fill="#d6a868" ${sw}/>
      <g fill="#a87a43"><circle cx="24" cy="33" r="1.8"/><circle cx="36" cy="29" r="1.6"/><circle cx="40" cy="40" r="1.8"/><circle cx="28" cy="43" r="1.5"/></g>${shine(24, 28, 5, 3)}`,
    cucumber: `<path d="M12 44c-3-5 1-10 7-14l20-14c6-4 12-4 14 0s-1 9-7 13L26 43c-6 4-11 5-14 1z" fill="#6db450" ${sw}/>
      <g fill="#c8ec9a"><circle cx="22" cy="37" r="1.6"/><circle cx="30" cy="31" r="1.6"/><circle cx="38" cy="25" r="1.6"/><circle cx="45" cy="21" r="1.4"/><circle cx="27" cy="38" r="1.4"/></g>
      <circle cx="52" cy="16" r="4" fill="#f6d55c" ${sw}/>`,
    tomato: `<circle cx="32" cy="36" r="17" fill="#ea5443" ${sw}/>
      <path d="M32 20l3 5 6-2-3 5 5 3-6 1 1 6-6-4-6 4 1-6-6-1 5-3-3-5 6 2z" fill="#6db450" ${sw}/>${shine(23, 33, 4, 7, 20)}`,
    strawberry: `<path d="M16 26c6-6 26-6 32 0 3 3 1 12-5 20-5 7-8 11-11 11s-6-4-11-11c-6-8-8-17-5-20z" fill="#ec4d5f" ${sw}/>
      <g fill="#ffe08a">${[[24, 32], [32, 30], [40, 32], [27, 40], [36, 40], [32, 48], [22, 25], [42, 25]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.3" ry="2"/>`).join('')}</g>
      <path d="M20 22c4 0 8-2 12-6 4 4 8 6 12 6-4 4-8 5-12 3-4 2-8 1-12-3z" fill="#6db450" ${sw}/>`,
    cabbage: `<circle cx="32" cy="35" r="19" fill="#9fd477" ${sw}/>
      <path d="M32 18c-8 6-10 22 0 34M32 18c8 6 10 22 0 34M15 32c8 2 14 8 17 20M49 32c-8 2-14 8-17 20" fill="none" stroke="#5f9e3f" stroke-width="2" stroke-linecap="round"/>${shine(24, 27, 5, 3)}`,
    pumpkin: `<path d="M34 16c1-4 4-6 7-6" fill="none" ${sw}/><path d="M38 14c5-3 10-1 11 3-4 2-8 1-11-3z" fill="#6db450" ${sw}/>
      <ellipse cx="22" cy="38" rx="12" ry="15" fill="#f0943a" ${sw}/><ellipse cx="42" cy="38" rx="12" ry="15" fill="#f0943a" ${sw}/>
      <ellipse cx="32" cy="38" rx="11" ry="16" fill="#f7a94a" ${sw}/><path d="M30 22c0-3 2-6 4-7" fill="none" ${sw}/>${shine(28, 30, 3, 6, 10)}`,
    sunflower: `<path d="M32 46v16" ${sw}/>${Array.from({ length: 12 }, (_, i) => `<ellipse cx="32" cy="14" rx="5" ry="10" fill="#f7c63c" ${sw} transform="rotate(${i * 30} 32 30)"/>`).join('')}
      <circle cx="32" cy="30" r="10" fill="#7a4a26" ${sw}/><g fill="#a46a3c">${[[29, 27], [35, 27], [32, 32], [28, 33], [36, 33]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4"/>`).join('')}</g>`,
    watermelon: `<ellipse cx="32" cy="36" rx="22" ry="17" fill="#4f9a3f" ${sw}/>
      <path d="M18 24c4 8 4 16 0 24M27 20c3 10 3 22 0 32M37 20c-3 10-3 22 0 32M46 24c-4 8-4 16 0 24" fill="none" stroke="#2f6d29" stroke-width="3" stroke-linecap="round"/>${shine(22, 28, 5, 3)}`,
    egg: `<path d="M32 12c10 0 17 15 17 26 0 9-7 15-17 15s-17-6-17-15c0-11 7-26 17-26z" fill="#fbefd8" ${sw}/>${shine(26, 26, 3, 7, 15)}`,
    honey: `<rect x="20" y="10" width="24" height="9" rx="3" fill="#c98a52" ${sw}/><path d="M18 22c0-2 2-4 4-4h20c2 0 4 2 4 4v28c0 4-3 6-6 6H24c-3 0-6-2-6-6z" fill="#f2a93b" ${sw}/>
      <rect x="23" y="30" width="18" height="13" rx="3" fill="#fbefd8" ${sw}/><path d="M32 33l3 2v3l-3 2-3-2v-3z" fill="#f2a93b" stroke="${O}" stroke-width="1.4"/>${shine(22, 28, 2, 6, 0)}`,
  };
  const item = (id, cls = '') => svg('0 0 64 64', ITEM[id] || '', 'dc-ico ' + cls);

  /* ---------------- грядка: всходы по стадиям ---------------- */
  // stage: 0 — семена, 1 — росток, 2 — кустик, 3 — созрело
  function plant(id, stage) {
    if (stage === 0) return svg('0 0 64 64', `<g fill="#5a3d2b" opacity=".75"><ellipse cx="22" cy="40" rx="2.2" ry="1.6"/><ellipse cx="32" cy="36" rx="2.2" ry="1.6"/><ellipse cx="42" cy="41" rx="2.2" ry="1.6"/><ellipse cx="28" cy="46" rx="2" ry="1.5"/><ellipse cx="38" cy="47" rx="2" ry="1.5"/></g>`, 'dc-plant s0');
    if (stage === 1) return svg('0 0 64 64', `<path d="M32 50V38" ${sw}/>${leaf(32, 40, -50, '#8fd06a', 0.8)}${leaf(32, 40, 50, '#7cc35a', 0.8)}`, 'dc-plant s1');
    if (stage === 2) return svg('0 0 64 64', `<path d="M32 54V30" ${sw}/>${leaf(32, 46, -60)}${leaf(32, 46, 60, '#8fd06a')}${leaf(32, 36, -35, '#8fd06a', 0.9)}${leaf(32, 36, 35, '#7cc35a', 0.9)}${leaf(32, 32, 0, '#9edb78', 0.8)}`, 'dc-plant s2');
    return svg('0 0 64 64', `${leaf(32, 56, -70, '#7cc35a', 0.9)}${leaf(32, 56, 70, '#8fd06a', 0.9)}<g transform="translate(6 2) scale(.82)">${ITEM[id]}</g>`, 'dc-plant s3');
  }
  const weed = () => svg('0 0 64 64', `<g fill="#9a8f3a" ${sw}><path d="M24 54c-2-8-6-12-10-14 6 0 10 4 12 9 0-9 2-17 6-22-1 8 0 15 2 22 2-6 6-10 12-12-4 4-7 10-8 17z"/></g><circle cx="31" cy="30" r="3" fill="#f2e27a" ${sw}/>`, 'dc-plant weed');

  /* ---------------- постройки (120×100) ---------------- */
  const B = {
    house: `<rect x="18" y="44" width="84" height="50" rx="4" fill="#f6e2bf" ${sw}/>
      <path d="M22 56h76M22 68h76M22 80h76" stroke="#e2c99c" stroke-width="2"/>
      <path d="M10 48 60 10l50 38z" fill="#d0624a" ${sw}/><path d="M28 36h64" stroke="#b44c37" stroke-width="2"/>
      <rect x="78" y="14" width="10" height="18" fill="#a5664a" ${sw}/>
      <rect class="win" x="30" y="56" width="22" height="20" rx="3" fill="#bfe3f2" ${sw}/><path d="M41 56v20M30 66h22" stroke="${O}" stroke-width="2"/>
      <rect x="28" y="76" width="26" height="6" rx="2" fill="#a5664a" ${sw}/><g fill="#ec6a8c"><circle cx="34" cy="75" r="2.6"/><circle cx="41" cy="74" r="2.6"/><circle cx="48" cy="75" r="2.6"/></g>
      <rect x="66" y="60" width="20" height="34" rx="3" fill="#a5664a" ${sw}/><circle cx="81" cy="78" r="1.8" fill="${O}"/>
      <circle cx="60" cy="32" r="5" fill="#bfe3f2" ${sw}/>`,
    coop: `<rect x="22" y="40" width="70" height="44" rx="4" fill="#e07454" ${sw}/><path d="M14 44 57 14l43 30z" fill="#7d4a35" ${sw}/>
      <path d="M44 84V64a13 13 0 0 1 26 0v20z" fill="#5a3d2b"/><path d="M30 52h10M76 52h8" stroke="#c45a3e" stroke-width="2"/>
      <path d="M96 84l14-14" ${sw}/><g class="hens"></g>`,
    hen: (x) => `<g transform="translate(${x} 0)"><ellipse cx="0" cy="84" rx="9" ry="8" fill="#fffaf0" ${sw}/><circle cx="6" cy="76" r="5" fill="#fffaf0" ${sw}/><path d="M5 71c1-3 3-3 4 0" fill="#ea5443" stroke="#ea5443" stroke-width="2"/><path d="M11 77l3 1-3 1" fill="#f2a93b" ${sw}/><circle cx="7" cy="75.5" r="1" fill="${O}"/></g>`,
    well: `<ellipse cx="60" cy="82" rx="34" ry="10" fill="#9aa1a8" ${sw}/><path d="M26 82V64h68v18" fill="#b8bec4" ${sw}/><ellipse cx="60" cy="64" rx="34" ry="9" fill="#cfd4d8" ${sw}/>
      <ellipse cx="60" cy="64" rx="26" ry="6" fill="#3d6f8f"/><path d="M34 64V24M86 64V24" ${sw}/><path d="M26 28 60 8l34 20z" fill="#d0624a" ${sw}/>
      <path d="M38 34h44" ${sw}/><path d="M60 34v14" stroke="${O}" stroke-width="1.6"/><path d="M53 48h14l-2 10h-10z" fill="#a5664a" ${sw}/>`,
    hive: `<rect x="34" y="60" width="52" height="28" rx="3" fill="#f2c14e" ${sw}/><rect x="36" y="38" width="48" height="24" rx="3" fill="#f6d06a" ${sw}/>
      <path d="M30 40h60l-6-10H36z" fill="#c98a52" ${sw}/><rect x="52" y="74" width="16" height="5" rx="2" fill="${O}"/><path d="M40 50h40M40 72h40" stroke="#d9a63a" stroke-width="2"/>
      <g class="bees">${[[24, 30], [92, 24], [98, 50]].map(([x, y]) => `<g transform="translate(${x} ${y})"><ellipse rx="5" ry="3.6" fill="#f6d55c" stroke="${O}" stroke-width="1.5"/><path d="M-1-3v6M2-3v6" stroke="${O}" stroke-width="1.4"/><ellipse cx="-1" cy="-5" rx="3" ry="2" fill="#fff" opacity=".8"/></g>`).join('')}</g>`,
    dog: `<path d="M14 88V50l28-22 28 22v38z" fill="#b97a4f" ${sw}/><path d="M8 54 42 24l34 30" fill="none" stroke="#7d4a35" stroke-width="7" stroke-linecap="round"/>
      <path d="M30 88V68a12 12 0 0 1 24 0v20z" fill="#4a3022"/>
      <ellipse cx="86" cy="80" rx="15" ry="11" fill="#f1d3a6" ${sw}/><circle cx="92" cy="62" r="11" fill="#f1d3a6" ${sw}/>
      <path d="M83 56c-6 0-9 8-6 14 3-2 6-7 6-14z" fill="#b97a4f" ${sw}/><circle cx="95" cy="60" r="1.6" fill="${O}"/><ellipse cx="101" cy="64" rx="3" ry="2.2" fill="${O}"/>
      <path d="M93 69c2 2 5 2 7 0" fill="none" stroke="${O}" stroke-width="1.6" stroke-linecap="round"/><path class="tail" d="M71 76c-6-2-8-8-6-12" fill="none" ${sw}/>`,
    greenhouse: `<path d="M12 90V52a48 40 0 0 1 96 0v38z" fill="#d8f0f4" opacity=".85" ${sw}/><path d="M60 12v78M36 18v72M84 18v72M12 60h96" stroke="${O}" stroke-width="1.6" opacity=".6"/>
      <g>${[24, 48, 72, 96].map((x) => `<path d="M${x} 88v-12" stroke="#5f9e3f" stroke-width="2"/><ellipse cx="${x - 4}" cy="78" rx="5" ry="3" fill="#8fd06a"/><ellipse cx="${x + 4}" cy="75" rx="5" ry="3" fill="#7cc35a"/><circle cx="${x}" cy="72" r="3.4" fill="#ea5443"/>`).join('')}</g>
      <path d="M22 40c8-12 22-20 36-22" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7" fill="none"/>`,
    banya: `<rect x="16" y="46" width="88" height="44" rx="3" fill="#b97a4f" ${sw}/>${[54, 62, 70, 78, 86].map((y) => `<path d="M16 ${y}h88" stroke="#8f5a39" stroke-width="2"/>`).join('')}
      <path d="M8 50 60 18l52 32z" fill="#7d4a35" ${sw}/><rect x="80" y="20" width="10" height="16" fill="#9aa1a8" ${sw}/>
      <rect x="28" y="56" width="18" height="14" rx="2" fill="#ffd27a" ${sw}/><rect x="62" y="58" width="22" height="32" rx="2" fill="#7d4a35" ${sw}/>
      <g class="smoke" fill="#e9e6e1"><circle cx="85" cy="14" r="5"/><circle cx="90" cy="6" r="6"/><circle cx="84" cy="-2" r="5"/></g>`,
  };
  const building = (id, extra = '') => svg('0 -8 120 108', (B[id] || '') + extra, 'dc-bld');

  /* ---------------- декор (64×64) ---------------- */
  const D = {
    gnome: `<path d="M22 58c0-12 4-20 10-20s10 8 10 20z" fill="#5b8def" ${sw}/><circle cx="32" cy="34" r="8" fill="#f6d2b0" ${sw}/><path d="M24 34c4 12 12 12 16 0-2 8-14 8-16 0z" fill="#fff" ${sw}/><path d="M23 30 32 6l9 24z" fill="#ea5443" ${sw}/>`,
    flowers: `<ellipse cx="32" cy="52" rx="24" ry="8" fill="#a5664a" ${sw}/>${[[18, 42, '#ec6a8c'], [30, 38, '#f6d55c'], [42, 42, '#b48cff'], [24, 48, '#fff'], [38, 48, '#ec6a8c']].map(([x, y, c]) => `<g transform="translate(${x} ${y})">${[0, 72, 144, 216, 288].map((r) => `<ellipse cx="0" cy="-4" rx="3" ry="4" fill="${c}" stroke="${O}" stroke-width="1.2" transform="rotate(${r})"/>`).join('')}<circle r="2.2" fill="#f2a93b"/></g>`).join('')}`,
    bench: `<rect x="8" y="30" width="48" height="6" rx="2" fill="#c98a52" ${sw}/><rect x="8" y="40" width="48" height="6" rx="2" fill="#c98a52" ${sw}/><path d="M14 46v12M50 46v12M14 30v-8M50 30v-8" ${sw}/><rect x="8" y="18" width="48" height="6" rx="2" fill="#c98a52" ${sw}/>`,
    grill: `<path d="M12 30h40a20 16 0 0 1-40 0z" fill="#3b3b3b" ${sw}/><path d="M18 46l-6 14M46 46l6 14" ${sw}/><path d="M14 30h36" stroke="#9aa1a8" stroke-width="3"/>
      <g class="smoke" fill="#e9e6e1" opacity=".9"><circle cx="26" cy="20" r="4"/><circle cx="34" cy="12" r="5"/><circle cx="40" cy="20" r="3.5"/></g>`,
    swing: `<path d="M10 60 20 6h24l10 54M20 6h24" fill="none" stroke="#a5664a" stroke-width="3.5" stroke-linecap="round"/><path d="M26 8v34M38 8v34" stroke="${O}" stroke-width="1.6"/><rect x="22" y="42" width="20" height="5" rx="2" fill="#ea5443" ${sw}/>`,
    fountain: `<ellipse cx="32" cy="52" rx="26" ry="8" fill="#cfd4d8" ${sw}/><ellipse cx="32" cy="50" rx="20" ry="5" fill="#7cc6e8"/><rect x="28" y="28" width="8" height="22" fill="#cfd4d8" ${sw}/><ellipse cx="32" cy="28" rx="12" ry="4" fill="#cfd4d8" ${sw}/>
      <path class="jet" d="M32 26c-2-8-8-12-12-10M32 26c2-8 8-12 12-10M32 26V12" fill="none" stroke="#7cc6e8" stroke-width="2.5" stroke-linecap="round"/>`,
    gazebo: `<path d="M10 26 32 6l22 20z" fill="#5f9e3f" ${sw}/><path d="M14 26v32M50 26v32M32 26v32" stroke="#c98a52" stroke-width="3.5"/><rect x="10" y="40" width="44" height="4" rx="2" fill="#c98a52" ${sw}/><path d="M10 58h44" ${sw}/>`,
    pool: `<rect x="4" y="22" width="56" height="34" rx="12" fill="#e9e6e1" ${sw}/><rect x="10" y="28" width="44" height="22" rx="8" fill="#6cc3ea"/><path d="M16 36c4-3 8 3 12 0s8 3 12 0 8 3 10 0" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".8"/><circle cx="46" cy="34" r="5" fill="#ec6a8c" ${sw}/>`,
  };
  const deco = (id) => svg('0 0 64 64', D[id] || '', 'dc-deco-ico');

  // соседи: пухлые кружки-аватарки
  const sun = () => svg('0 0 80 80', `<g class="rays">${Array.from({ length: 10 }, (_, i) => `<path d="M40 6v8" stroke="#f7c63c" stroke-width="4" stroke-linecap="round" transform="rotate(${i * 36} 40 40)"/>`).join('')}</g><circle cx="40" cy="40" r="17" fill="#ffd95e"/>`, 'dc-sun');
  const moon = () => svg('0 0 80 80', `<path d="M48 14a26 26 0 1 0 18 40A22 22 0 0 1 48 14z" fill="#fff6d6"/>`, 'dc-sun');
  const cloud = () => svg('0 0 120 50', `<path d="M20 44c-10 0-14-12-6-17 0-11 14-15 21-8 5-12 26-12 30 1 12-4 22 6 18 15 8 2 8 9 0 9z" fill="#fff"/>`, 'dc-cloud');

  window.DachaArt = { item, plant, weed, building, B, deco, sun, moon, cloud };
})();
