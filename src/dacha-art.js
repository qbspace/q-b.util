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
  /* ---------------- новые культуры ---------------- */
  Object.assign(ITEM, {
    onion: `<path d="M30 20c-2-6 0-11 2-14M34 20c2-6 6-9 9-10" fill="none" stroke="#6db450" stroke-width="3" stroke-linecap="round"/>
      <path d="M32 18c10 6 16 14 16 22 0 9-7 15-16 15s-16-6-16-15c0-8 6-16 16-22z" fill="#e9b25a" ${sw}/><path d="M32 22c-5 8-6 20-2 32M32 22c5 8 6 20 2 32" fill="none" stroke="#c48a35" stroke-width="1.6"/>${shine(25, 36, 3, 6)}`,
    beet: `<path d="M28 22c-4-8-4-14 0-18M36 22c4-8 8-12 12-12" fill="none" stroke="#c23b6a" stroke-width="3" stroke-linecap="round"/>${leaf(28, 12, -20, '#6db450')}${leaf(46, 12, 40, '#7cc35a')}
      <path d="M32 20c10 0 16 8 16 17 0 9-8 15-16 15s-16-6-16-15c0-9 6-17 16-17z" fill="#9b2457" ${sw}/><path d="M32 52c0 4 1 7 2 9" fill="none" ${sw}/>${shine(25, 30, 3, 6)}`,
    garlic: `<path d="M32 8c1 6 1 10 0 14" ${sw}/><path d="M32 20c12 2 18 12 18 21 0 9-8 15-18 15s-18-6-18-15c0-9 6-19 18-21z" fill="#f7f2e7" ${sw}/>
      <path d="M32 22c-6 6-8 20-4 33M32 22c6 6 8 20 4 33M22 30c-3 8-3 16 2 23M42 30c3 8 3 16-2 23" fill="none" stroke="#d8cdb7" stroke-width="1.6"/>`,
    peas: `<path d="M10 40c4-14 18-24 34-26 6 0 10 2 10 6-2 14-18 26-36 26-6 0-9-2-8-6z" fill="#7cc35a" ${sw}/>
      <g fill="#b9ec8e" stroke="${O}" stroke-width="1.4">${[[20, 38], [28, 33], [36, 28], [44, 23]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.6"/>`).join('')}</g><path d="M54 18c3-2 5-6 4-10" fill="none" ${sw}/>`,
    zucchini: `<path d="M10 46c-3-5 2-10 9-14l22-14c7-4 13-4 15 0s-1 9-8 13L26 46c-7 4-13 5-16 0z" fill="#a7d36f" ${sw}/>
      <path d="M17 41l24-15M20 46l26-17" stroke="#7ab24a" stroke-width="2" stroke-linecap="round"/><path d="M52 14l6-4" ${sw}/>`,
    pepper: `<path d="M30 16c-1-4 1-8 5-9" fill="none" ${sw}/><path d="M18 26c0-6 6-10 14-10s14 4 14 10c0 12-4 26-14 30-10-4-14-18-14-30z" fill="#e8443a" ${sw}/>
      <path d="M22 20c4 2 16 2 20 0" fill="#6db450" ${sw}/><path d="M32 22v30" stroke="#b8332a" stroke-width="1.6"/>${shine(24, 32, 3, 8, 5)}`,
    eggplant: `<path d="M38 10c4 0 7 3 8 6" fill="none" ${sw}/><path d="M40 16c8 4 10 14 6 22-6 12-16 20-26 18-8-2-8-10-2-18 6-8 12-14 14-22z" fill="#7b4aa8" ${sw}/>
      <path d="M32 18c4-4 10-4 14 0-2 4-8 6-14 0z" fill="#6db450" ${sw}/>${shine(26, 40, 3, 7, 40)}`,
    corn: `<path d="M20 30c-6 12-4 26 12 30M44 30c6 12 4 26-12 30" fill="#7cc35a" ${sw}/>
      <path d="M32 6c8 0 12 10 12 24s-4 26-12 26-12-12-12-26S24 6 32 6z" fill="#f7cf4a" ${sw}/>
      <g fill="#e2b030">${[14, 22, 30, 38, 46].map((y) => [27, 32, 37].map((x) => `<circle cx="${x}" cy="${y}" r="1.8"/>`).join('')).join('')}</g>`,
    raspberry: `<g fill="#e8456a" stroke="${O}" stroke-width="1.4">${[[26, 28], [34, 26], [42, 30], [22, 36], [30, 35], [38, 35], [44, 40], [26, 44], [34, 44], [40, 48], [30, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5"/>`).join('')}</g>
      <path d="M24 22c4 2 10 2 14-2 4 4 8 4 12 2-2-6-10-8-14-6-4-4-10-2-12 6z" fill="#6db450" ${sw}/>`,
    melon: `<ellipse cx="32" cy="36" rx="21" ry="17" fill="#f2d16b" ${sw}/><path d="M14 30c8 6 28 6 36 0M12 38c10 6 30 6 40 0M18 46c8 4 20 4 28 0M24 20c-4 10-4 22 0 32M40 20c4 10 4 22 0 32" fill="none" stroke="#c9a23e" stroke-width="1.4"/>${shine(23, 28, 5, 3)}`,
    lavender: `${[22, 32, 42].map((x, i) => `<path d="M${x} 60V${22 + i * 2}" stroke="#6db450" stroke-width="2.4" stroke-linecap="round"/>${[0, 1, 2, 3, 4].map((k) => `<ellipse cx="${x + (k % 2 ? 2.5 : -2.5)}" cy="${16 + i * 2 + k * 5}" rx="3" ry="3.6" fill="#a37be0" stroke="${O}" stroke-width="1.2"/>`).join('')}`).join('')}`,
    rose: `<path d="M32 40v22" stroke="#5f9e3f" stroke-width="3" stroke-linecap="round"/>${leaf(32, 54, -60, '#7cc35a', 0.8)}
      <circle cx="32" cy="26" r="15" fill="#e63950" ${sw}/><path d="M32 18c6 0 9 4 8 8s-6 6-9 4-2-6 1-6M24 24c0 8 6 12 12 11M40 32c-4 6-12 6-16 0" fill="none" stroke="#a81f35" stroke-width="2" stroke-linecap="round"/>`,
    blueberry: `${[[24, 36], [40, 34], [32, 46]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="#4b6fd1" ${sw}/><path d="M${x - 3} ${y - 6}l3 2 3-2" fill="none" stroke="#2c4597" stroke-width="1.6"/>${shine(x - 3, y + 1, 2, 3, 0)}`).join('')}${leaf(32, 24, 10, '#6db450', 0.8)}`,
    goldpumpkin: `<path d="M34 16c1-4 4-6 7-6" fill="none" ${sw}/><ellipse cx="22" cy="38" rx="12" ry="15" fill="#e8b830" ${sw}/><ellipse cx="42" cy="38" rx="12" ry="15" fill="#e8b830" ${sw}/>
      <ellipse cx="32" cy="38" rx="11" ry="16" fill="#ffd95e" ${sw}/><path d="M30 22c0-3 2-6 4-7" fill="none" ${sw}/>${shine(28, 30, 3, 6, 10)}
      <path d="M50 10l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM12 14l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff6c9" stroke="#e8b830" stroke-width="1"/>`,
    /* фрукты */
    apple: `<path d="M32 16c-1-5 1-9 4-10" fill="none" ${sw}/>${leaf(36, 12, 60, '#6db450', 0.7)}<path d="M32 20c-4-3-16-4-18 8-2 14 8 26 18 24 10 2 20-10 18-24-2-12-14-11-18-8z" fill="#e8513f" ${sw}/>${shine(23, 30, 3, 7, 15)}`,
    cherry: `<path d="M22 40c4-14 10-24 20-30M42 40c-2-12 0-22 0-30" fill="none" stroke="#5f9e3f" stroke-width="2.4" stroke-linecap="round"/>${leaf(42, 12, 50, '#7cc35a', 0.7)}
      <circle cx="21" cy="46" r="10" fill="#c8213a" ${sw}/><circle cx="43" cy="46" r="10" fill="#d82c46" ${sw}/>${shine(17, 43, 2, 4, 0)}${shine(39, 43, 2, 4, 0)}`,
    pear: `<path d="M32 12c0-3 2-6 4-6" fill="none" ${sw}/><path d="M32 14c6 0 8 6 8 12 6 4 10 10 10 16 0 9-8 14-18 14s-18-5-18-14c0-6 4-12 10-16 0-6 2-12 8-12z" fill="#c8d65a" ${sw}/>${shine(25, 38, 3, 7, 10)}`,
    plum: `<path d="M32 14c0-4 2-7 5-8" fill="none" ${sw}/><ellipse cx="32" cy="36" rx="16" ry="19" fill="#7a3f8f" ${sw}/><path d="M32 18c-3 10-3 26 0 36" fill="none" stroke="#5a2a6c" stroke-width="1.6"/>${shine(25, 30, 3, 7, 10)}`,
    apricot: `<path d="M32 16c0-4 2-6 4-7" fill="none" ${sw}/><circle cx="32" cy="36" r="17" fill="#f6a23e" ${sw}/><path d="M32 20c-4 8-4 24 0 32" fill="none" stroke="#d47d1d" stroke-width="1.6"/>${shine(24, 31, 3, 6, 15)}`,
    peach: `${leaf(36, 18, 50, '#6db450', 0.8)}<path d="M32 20c-4-2-17-1-17 15 0 11 8 19 17 19s17-8 17-19c0-16-13-17-17-15z" fill="#f7a08a" ${sw}/><path d="M32 20c-3 10-3 22 0 34" fill="none" stroke="#e0705c" stroke-width="1.6"/>${shine(23, 33, 3, 6, 15)}`,
    walnut: `<ellipse cx="32" cy="34" rx="18" ry="16" fill="#b98a55" ${sw}/><path d="M32 18v32M20 26c4 2 6 6 4 10-2 4 0 8 4 10M44 26c-4 2-6 6-4 10 2 4 0 8-4 10" fill="none" stroke="#8a5f35" stroke-width="1.8" stroke-linecap="round"/>`,
    orange: `${leaf(34, 16, 40, '#5f9e3f', 0.8)}<circle cx="32" cy="36" r="17" fill="#f7942c" ${sw}/><g fill="#e07b16">${[[26, 30], [36, 28], [40, 38], [28, 42], [34, 46], [22, 38]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1"/>`).join('')}</g>${shine(25, 30, 3, 6, 15)}`,
    /* сельпо */
    fert: `<path d="M18 16h28l4 40H14z" fill="#7cc35a" ${sw}/><path d="M18 16l4-6h20l4 6" fill="#5aa040" ${sw}/><circle cx="32" cy="36" r="8" fill="#fff8e6" ${sw}/><path d="M32 32v8M28 36h8" stroke="#5aa040" stroke-width="2.4" stroke-linecap="round"/>`,
    compost: `<path d="M14 26h36l-4 30H18z" fill="#8a5a3a" ${sw}/><path d="M14 26c4-8 10-10 18-10s14 2 18 10" fill="#5a3d2b" ${sw}/>${leaf(26, 20, -30, '#8fd06a', 0.6)}${leaf(38, 20, 30, '#7cc35a', 0.6)}`,
    grow: `<path d="M14 30h26v20c0 4-3 6-6 6H20c-3 0-6-2-6-6z" fill="#f2c14e" ${sw}/><path d="M40 34l14-10 3 4-15 12" fill="#f2c14e" ${sw}/><path d="M18 30c0-6 4-10 9-10s9 4 9 10" fill="none" ${sw}/>
      <path d="M56 18l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff6c9" stroke="#e8b830" stroke-width="1"/>`,
    treefert: `<path d="M20 14h24l2 42H18z" fill="#c98a52" ${sw}/><circle cx="32" cy="34" r="9" fill="#fff8e6" ${sw}/><path d="M32 40v-8" stroke="#8a5a3a" stroke-width="2.4"/><circle cx="32" cy="30" r="5" fill="#6db450"/>`,
    goldseed: `<path d="M16 12h32v44H16z" fill="#fff8e6" ${sw}/><path d="M16 12h32v10H16z" fill="#e8b830" ${sw}/><g transform="translate(16 24) scale(.5)">${'' /* место под тыкву */}</g><circle cx="32" cy="40" r="10" fill="#ffd95e" ${sw}/><path d="M32 30c0-3 2-5 4-5" fill="none" ${sw}/>`,
    scarecrow: `<path d="M32 22v36M14 32h36" stroke="#a5664a" stroke-width="3.5" stroke-linecap="round"/><circle cx="32" cy="20" r="8" fill="#f2d48a" ${sw}/><path d="M20 14h24l-4-6H24z" fill="#8a5a3a" ${sw}/>
      <path d="M22 32h20l-2 14H24z" fill="#5b8def" ${sw}/><path d="M14 32l-4 6M50 32l4 6" stroke="#f2c14e" stroke-width="2.4" stroke-linecap="round"/><circle cx="29" cy="20" r="1.2" fill="${O}"/><circle cx="35" cy="20" r="1.2" fill="${O}"/>`,
    trap: `<ellipse cx="32" cy="44" rx="22" ry="8" fill="#9aa1a8" ${sw}/><path d="M12 42c4-14 36-14 40 0" fill="none" stroke="#6c737a" stroke-width="3"/>
      <path d="M14 42l4-8 4 6 4-8 4 6 4-8 4 6 4-8 4 6 4-6" fill="none" stroke="#cfd4d8" stroke-width="2" stroke-linejoin="round"/><circle cx="32" cy="44" r="4" fill="#ea5443" ${sw}/>`,
    camera: `<rect x="12" y="20" width="32" height="20" rx="4" fill="#e9e6e1" ${sw}/><path d="M44 26l10-6v20l-10-6" fill="#cfd4d8" ${sw}/><circle cx="24" cy="30" r="6" fill="#3d4a5a" ${sw}/><circle cx="38" cy="25" r="2" fill="#ea5443"/><path d="M28 40v14M20 54h16" ${sw}/>`,
    alarm: `<path d="M18 44c0-14 6-24 14-24s14 10 14 24z" fill="#ea5443" ${sw}/><rect x="14" y="44" width="36" height="8" rx="3" fill="#9aa1a8" ${sw}/>${shine(26, 32, 3, 6, 0)}
      <path d="M10 22l-4-4M54 22l4-4M32 12V6" stroke="#f2c14e" stroke-width="3" stroke-linecap="round"/>`,
    watch: `<rect x="24" y="4" width="16" height="14" rx="3" fill="#c9a24a" ${sw}/><rect x="24" y="46" width="16" height="14" rx="3" fill="#c9a24a" ${sw}/><circle cx="32" cy="32" r="16" fill="#f2c14e" ${sw}/><circle cx="32" cy="32" r="11" fill="#fffaf0" ${sw}/>
      <path d="M32 25v7l5 3" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round"/><path d="M49 16l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z" fill="#fff6c9" stroke="#e8b830" stroke-width="1"/>`,
    guard: `<circle cx="32" cy="22" r="10" fill="#f6d2b0" ${sw}/><path d="M20 18c2-8 22-8 24 0l-2 2H22z" fill="#3d4a5a" ${sw}/><path d="M24 26c4 4 12 4 16 0" fill="#9aa1a8" ${sw}/>
      <path d="M14 58c0-14 8-22 18-22s18 8 18 22z" fill="#5f6f4e" ${sw}/><path d="M48 30l8 26" stroke="#7d4a35" stroke-width="3.5" stroke-linecap="round"/>`,
  });

  // дерево: стадии 0 — саженец, 1 — подрастает, 2 — взрослое, 3 — с плодами
  const TREE_LOOK = {
    apple: ['#7cc35a', '#e8513f'], cherry: ['#6db450', '#c8213a'], pear: ['#8fd06a', '#c8d65a'], plum: ['#5aa040', '#7a3f8f'],
    apricot: ['#8fd06a', '#f6a23e'], peach: ['#7cc35a', '#f7a08a'], walnut: ['#5f9e3f', '#b98a55'], orange: ['#4f9a3f', '#f7942c'],
  };
  function tree(id, stage) {
    const [leafC, fruitC] = TREE_LOOK[id] || TREE_LOOK.apple;
    if (stage === 0) return svg('0 0 120 140', `<ellipse cx="60" cy="128" rx="22" ry="6" fill="#000" opacity=".12"/><path d="M60 128V96" stroke="#8a5a3a" stroke-width="4" stroke-linecap="round"/>${leaf(60, 100, -45, leafC, 1)}${leaf(60, 100, 45, '#8fd06a', 1)}${leaf(60, 98, 0, leafC, 0.9)}`, 'dc-tree s0');
    const big = stage >= 2, s = big ? 1 : 0.68;
    const crown = `<g transform="translate(60 ${big ? 58 : 80}) scale(${s})">
      <circle cx="-26" cy="8" r="24" fill="${leafC}" ${sw}/><circle cx="26" cy="8" r="24" fill="${leafC}" ${sw}/><circle cx="0" cy="-14" r="30" fill="${leafC}" ${sw}/><circle cx="0" cy="14" r="26" fill="${leafC}" ${sw}/>
      <path d="M-14-24c6-8 18-10 26-4" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".35"/>
      ${stage === 3 ? [[-26, 6], [22, 0], [-6, -22], [10, 18], [-14, 20], [30, 18], [6, -4]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6.5" fill="${fruitC}" stroke="${O}" stroke-width="1.8"/>`).join('') : ''}</g>`;
    return svg('0 0 120 140', `<ellipse cx="60" cy="130" rx="${big ? 40 : 28}" ry="7" fill="#000" opacity=".13"/>
      <path d="M54 130c2-14 2-30 0-${big ? 48 : 30}h12c-2 18-2 34 0 ${big ? 48 : 30}z" fill="#9b6b47" ${sw}/>${crown}`, 'dc-tree s' + stage);
  }

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

  window.DachaArt = { item, plant, weed, building, B, deco, sun, moon, cloud, tree };
})();
