// «Дача» — рисунки фермы: животные, продукты кухни, рыбы, пруд
(function () {
  const O = '#5a3d2b';
  const sw = `stroke="${O}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const shine = (x, y, rx, ry, r = -25) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".45" transform="rotate(${r} ${x} ${y})"/>`;
  const svg = (vb, body, cls = '') => `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  /* ---------------- животные (120×100) ---------------- */
  const ANIMAL = {
    cow: `<ellipse cx="60" cy="92" rx="40" ry="5" fill="#000" opacity=".12"/>
      <rect x="22" y="40" width="64" height="36" rx="18" fill="#fffaf0" ${sw}/><path d="M34 44c6 2 8 10 2 14-6 2-10-4-8-10zM62 60c6-2 12 2 10 8-4 4-12 2-12-4z" fill="#4a3426"/>
      <path d="M30 74v16M44 76v14M64 76v14M78 74v16" stroke="${O}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="92" cy="50" rx="16" ry="14" fill="#fffaf0" ${sw}/><ellipse cx="98" cy="58" rx="11" ry="8" fill="#f7b8c0" ${sw}/><circle cx="95" cy="57" r="1.4" fill="${O}"/><circle cx="101" cy="57" r="1.4" fill="${O}"/>
      <circle cx="88" cy="46" r="2" fill="${O}"/><path d="M80 38c-4-4-8-4-10-2M100 38c2-6 6-8 10-8" fill="none" stroke="#c9a24a" stroke-width="4" stroke-linecap="round"/>
      <path d="M22 50c-8 4-10 12-8 18" fill="none" ${sw}/><ellipse cx="52" cy="78" rx="8" ry="4" fill="#f7b8c0" ${sw}/>`,
    goat: `<ellipse cx="60" cy="92" rx="34" ry="5" fill="#000" opacity=".12"/>
      <rect x="28" y="42" width="54" height="30" rx="15" fill="#f1e7d2" ${sw}/><path d="M36 70v20M48 72v18M64 72v18M76 70v20" stroke="${O}" stroke-width="4.4" stroke-linecap="round"/>
      <ellipse cx="90" cy="46" rx="12" ry="14" fill="#f1e7d2" ${sw}/><path d="M86 34c-4-10-12-12-16-10M94 34c4-10 10-14 14-12" fill="none" stroke="#9a8f7a" stroke-width="3.6" stroke-linecap="round"/>
      <circle cx="87" cy="44" r="1.8" fill="${O}"/><path d="M92 60c0 6-2 10-4 12" fill="none" stroke="#c9b48a" stroke-width="4" stroke-linecap="round"/><path d="M28 48c-6-2-8-8-6-12" fill="none" ${sw}/>`,
    rabbit: `<ellipse cx="60" cy="92" rx="30" ry="5" fill="#000" opacity=".12"/>
      <ellipse cx="54" cy="72" rx="24" ry="18" fill="#f4f0ea" ${sw}/><circle cx="30" cy="74" r="7" fill="#fff" ${sw}/><circle cx="76" cy="58" r="14" fill="#f4f0ea" ${sw}/>
      <path d="M70 46c-6-16-4-30 2-30s6 16 4 30zM80 46c2-16 8-28 14-26 4 4-2 18-8 28z" fill="#f4f0ea" ${sw}/><path d="M72 40c-2-8-2-16 0-20M84 42c2-8 4-14 8-18" stroke="#f7b8c0" stroke-width="3" stroke-linecap="round"/>
      <circle cx="80" cy="56" r="1.8" fill="${O}"/><ellipse cx="88" cy="61" rx="2" ry="1.6" fill="#f7a0b0"/><path d="M44 88h10M62 88h10" stroke="${O}" stroke-width="4" stroke-linecap="round"/>`,
    duck: `<ellipse cx="60" cy="92" rx="30" ry="5" fill="#000" opacity=".12"/>
      <path d="M26 66c0-14 16-20 32-16l14 4c10 2 12 16 2 22-10 8-32 10-42 4-4-3-6-8-6-14z" fill="#fffaf0" ${sw}/><path d="M38 64c8 6 18 6 26 0" fill="none" stroke="#e2dccf" stroke-width="3" stroke-linecap="round"/>
      <circle cx="80" cy="44" r="12" fill="#6db450" ${sw}/><path d="M90 46l12 2-12 5z" fill="#f2a93b" ${sw}/><circle cx="83" cy="42" r="1.8" fill="${O}"/><path d="M70 56h14" stroke="#fffaf0" stroke-width="4"/>
      <path d="M48 82v8l-4 2M60 82v8l-4 2" stroke="#f2a93b" stroke-width="3" stroke-linecap="round" fill="none"/>`,
    cat: `<ellipse cx="60" cy="92" rx="28" ry="5" fill="#000" opacity=".12"/>
      <path d="M38 88c-4-20 4-36 22-36s26 16 22 36z" fill="#f2a24a" ${sw}/><path d="M48 64c4 2 8 2 12 0M52 74c4 2 8 2 12 0" stroke="#d27f2a" stroke-width="3" stroke-linecap="round"/>
      <circle cx="60" cy="40" r="17" fill="#f2a24a" ${sw}/><path d="M45 32l-2-16 12 8M75 32l2-16-12 8" fill="#f2a24a" ${sw}/>
      <path d="M52 38c2-2 4-2 6 0M62 38c2-2 4-2 6 0" fill="none" stroke="${O}" stroke-width="2" stroke-linecap="round"/><path d="M58 45l2 2 2-2" fill="#f7a0b0" stroke="${O}" stroke-width="1.4"/>
      <path d="M44 46h-10M44 50l-10 2M76 46h10M76 50l10 2" stroke="${O}" stroke-width="1.2"/><path class="tail" d="M82 84c12 0 16-10 12-18" fill="none" stroke="#f2a24a" stroke-width="7" stroke-linecap="round"/>`,
    pond: `<ellipse cx="60" cy="70" rx="54" ry="24" fill="#8fc46a" opacity=".6"/><ellipse cx="60" cy="68" rx="48" ry="20" fill="#6cc3ea" ${sw}/>
      <path d="M30 64c6-3 12 3 18 0s12 3 18 0M50 76c6-3 12 3 18 0" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
      <ellipse cx="90" cy="62" rx="8" ry="4" fill="#6db450" ${sw}/><path d="M16 56c-2-12 0-24 4-30M22 56c2-10 6-18 10-22" fill="none" stroke="#5f9e3f" stroke-width="3" stroke-linecap="round"/><ellipse cx="20" cy="26" rx="3" ry="7" fill="#8a5a3a"/>`,
  };
  const animal = (id, cls = '') => svg('0 0 120 100', ANIMAL[id] || '', 'dc-bld ' + cls);

  /* ---------------- продукты (64×64) ---------------- */
  const jar = (fill, lid = '#c98a52', inner = '') => `<rect x="20" y="10" width="24" height="9" rx="3" fill="${lid}" ${sw}/><path d="M18 22c0-2 2-4 4-4h20c2 0 4 2 4 4v28c0 4-3 6-6 6H24c-3 0-6-2-6-6z" fill="${fill}" ${sw}/>${inner}${shine(23, 30, 2, 7, 0)}`;
  const bottle = (fill, cap = '#5b8def') => `<rect x="26" y="6" width="12" height="8" rx="2" fill="${cap}" ${sw}/><path d="M26 14h12v6l6 8v26c0 3-2 5-5 5H25c-3 0-5-2-5-5V28l6-8z" fill="${fill}" ${sw}/>${shine(25, 36, 2, 9, 0)}`;
  const bowl = (fill, top = '') => `<path d="M10 32h44c0 14-10 24-22 24S10 46 10 32z" fill="#f2f2ee" ${sw}/><ellipse cx="32" cy="32" rx="22" ry="6" fill="${fill}" ${sw}/>${top}<path d="M14 40c4 6 10 10 18 10" stroke="#5b8def" stroke-width="2" fill="none" opacity=".5"/>`;
  const PROD = {
    milk: bottle('#fbfbf8'), goatmilk: bottle('#fbf3e0', '#9a8f3a'),
    fluff: `<path d="M14 40c-6-8 0-18 8-16 2-8 14-10 18-2 8-4 16 4 12 12 6 4 4 14-4 14H20c-6 0-8-4-6-8z" fill="#fbf7f2" ${sw}/>${shine(26, 30, 4, 3, 0)}`,
    duckegg: `<path d="M32 12c10 0 17 15 17 26 0 9-7 15-17 15s-17-6-17-15c0-11 7-26 17-26z" fill="#d8eef0" ${sw}/><g fill="#a9c8cc"><circle cx="26" cy="34" r="1.6"/><circle cx="36" cy="28" r="1.4"/><circle cx="38" cy="42" r="1.8"/></g>${shine(26, 26, 3, 7, 15)}`,
    pickles: jar('#9fc46a', '#c98a52', `<g fill="#5f9e3f"><ellipse cx="28" cy="36" rx="4" ry="10"/><ellipse cx="37" cy="38" rx="4" ry="10"/></g>`),
    sauerkraut: jar('#e8eec2', '#9aa1a8', `<path d="M22 32c4 2 8-2 12 0s8-2 10 0M22 40c4 2 8-2 12 0s8-2 10 0" stroke="#c4cf7a" stroke-width="2" fill="none"/>`),
    jamstraw: jar('#d83a52', '#ec6a8c'), jamrasp: jar('#b8285a', '#e8456a'),
    cider: bottle('#f2c14e', '#7d4a35'), compote: jar('#c25a8a', '#c98a52', `<g fill="#7a3f8f"><circle cx="28" cy="40" r="3"/><circle cx="36" cy="34" r="3"/><circle cx="34" cy="46" r="3"/></g>`),
    tvorog: bowl('#fffaf0', `<g fill="#fff" stroke="${O}" stroke-width="1.4"><circle cx="26" cy="30" r="3.4"/><circle cx="34" cy="28" r="3.4"/><circle cx="38" cy="32" r="3"/></g>`),
    cheese: `<path d="M8 44l42-22 8 14v16H8z" fill="#f6d06a" ${sw}/><path d="M8 44l42-22 8 14L8 44" fill="#f9dd84" ${sw}/><g fill="#e2b030"><circle cx="24" cy="48" r="3"/><circle cx="40" cy="46" r="2.4"/><circle cx="50" cy="50" r="2"/></g>`,
    pie: `<path d="M8 40c0-12 12-20 24-20s24 8 24 20z" fill="#e9b25a" ${sw}/><path d="M6 40h52v6c0 4-3 6-6 6H12c-3 0-6-2-6-6z" fill="#c98a52" ${sw}/><path d="M16 34l6-6M28 32l6-6M40 34l6-6" stroke="#b07a3a" stroke-width="2" stroke-linecap="round"/>`,
    ukha: bowl('#f2d48a', `<ellipse cx="26" cy="30" rx="6" ry="3" fill="#f39233"/><circle cx="38" cy="31" r="2.4" fill="#6db450"/>`),
    borscht: bowl('#c2334a', `<ellipse cx="34" cy="30" rx="6" ry="2.6" fill="#fff"/><circle cx="26" cy="31" r="2" fill="#6db450"/>`),
    porridge: bowl('#f7a94a', `<path d="M24 30c4-3 12-3 16 0" stroke="#fff" stroke-width="2" fill="none"/>`),
    pillow: `<path d="M10 20c8 4 36 4 44 0 4 8 4 24 0 32-8-4-36-4-44 0-4-8-4-24 0-32z" fill="#fbf7f2" ${sw}/><path d="M24 30c4 4 12 4 16 0" stroke="#e2dccf" stroke-width="2" fill="none"/>`,
    bait: `<rect x="14" y="20" width="36" height="32" rx="6" fill="#a5664a" ${sw}/><path d="M18 34c6-6 12 6 18 0s10-4 10-4" fill="none" stroke="#f2a0b0" stroke-width="4" stroke-linecap="round"/><path d="M14 26h36" stroke="${O}" stroke-width="2"/>`,
  };

  /* ---------------- рыбы ---------------- */
  // c — цвет, k — особенности: long (щука), whisk (сом), stripe (окунь), gold
  function fishBody(c, k = '') {
    const long = k.includes('long'), w = long ? 26 : 20, h = long ? 9 : 13;
    return `<path d="M${32 + w - 2} 32l14-10v20z" fill="${c}" ${sw}/><ellipse cx="32" cy="32" rx="${w}" ry="${h}" fill="${c}" ${sw}/>
      <path d="M${26} ${32 - h + 2}c4-6 10-8 14-6l-4 ${h - 4}" fill="${c}" ${sw}/><circle cx="${32 - w + 8}" cy="29" r="2.6" fill="#fff" stroke="${O}" stroke-width="1.4"/><circle cx="${32 - w + 8}" cy="29" r="1.2" fill="${O}"/>
      ${k.includes('stripe') ? `<path d="M26 22v20M34 21v22M42 23v18" stroke="#3d5a2a" stroke-width="3" opacity=".6"/>` : ''}
      ${k.includes('whisk') ? `<path d="M${32 - w + 2} 34c-6 2-10 6-12 10M${32 - w + 3} 36c-4 4-6 8-6 12" fill="none" stroke="${O}" stroke-width="1.6"/>` : ''}
      ${k.includes('gold') ? `<path d="M50 10l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5zM12 46l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1z" fill="#fff6c9" stroke="#e8b830" stroke-width="1"/>` : ''}
      ${shine(28, 27, 6, 2.4, -8)}`;
  }
  const FISH_LOOK = {
    ruff: ['#b7a36a', 'stripe'], roach: ['#c9d3dc', ''], carp_c: ['#e0b25a', ''], perch: ['#a9c46a', 'stripe'], bream: ['#d0c08a', ''],
    carp: ['#d8913a', ''], zander: ['#b9c4a8', 'stripe long'], pike: ['#8fae6a', 'long'], catfish: ['#6a6a5e', 'whisk long'], goldfish: ['#ffcf3a', 'gold'],
  };
  Object.entries(FISH_LOOK).forEach(([id, [c, k]]) => { PROD['fish_' + id] = fishBody(c, k); });

  window.DachaFarmArt = { animal, ANIMAL, PROD, svg };
})();
