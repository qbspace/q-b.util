// «Дача» — свободная расстановка: двигай декор, ставь дорожки, заборчики, кусты, фонари
(function () {
  const D = window.DachaCore;
  if (!D) return;
  const { S, H, A, ART, esc, rub } = D;
  const O = '#5a3d2b';
  const sw = `stroke="${O}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
  const svg = (body) => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  if (!S.layout) S.layout = { pos: {}, items: [] };
  const L = S.layout;
  let edit = false, drag = null;

  const ITEMS = {
    path: { name: 'Дорожка', price: 1000, cozy: 0.3, art: `<ellipse cx="20" cy="40" rx="12" ry="7" fill="#cfc6b6" ${sw}/><ellipse cx="42" cy="34" rx="11" ry="6" fill="#d8d0c0" ${sw}/><ellipse cx="34" cy="50" rx="9" ry="5" fill="#c7bdac" ${sw}/>` },
    stone: { name: 'Валун', price: 2000, cozy: 0.3, art: `<path d="M12 50c-2-12 8-22 20-22s22 8 20 22z" fill="#a9b0b6" ${sw}/><path d="M22 36c4-3 10-4 14-2" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".5" fill="none"/>` },
    fence: { name: 'Заборчик', price: 1500, cozy: 0.3, art: `<path d="M6 30h52M6 44h52" stroke="#c98a52" stroke-width="4"/>${[10, 22, 34, 46, 58].map((x) => `<path d="M${x - 4} 54V22l4-6 4 6v32z" fill="#e2b77f" ${sw}/>`).join('')}` },
    bush: { name: 'Куст', price: 2500, cozy: 0.5, art: `<circle cx="22" cy="40" r="12" fill="#6db450" ${sw}/><circle cx="42" cy="40" r="12" fill="#7cc35a" ${sw}/><circle cx="32" cy="30" r="13" fill="#8fd06a" ${sw}/><g fill="#ec6a8c"><circle cx="26" cy="28" r="2"/><circle cx="40" cy="36" r="2"/><circle cx="30" cy="42" r="2"/></g>` },
    tulips: { name: 'Тюльпаны', price: 4000, cozy: 0.6, art: `${[18, 32, 46].map((x, i) => `<path d="M${x} 56V32" stroke="#5f9e3f" stroke-width="3"/><path d="M${x - 7} 26c0-8 4-10 7-6 3-4 7-2 7 6 0 6-3 9-7 9s-7-3-7-9z" fill="${['#ea5443', '#f7c63c', '#ec6a8c'][i]}" ${sw}/>`).join('')}` },
    lamp: { name: 'Фонарь', price: 6000, cozy: 0.8, art: `<path d="M32 60V24" stroke="#3d4a5a" stroke-width="4"/><path d="M22 58h20" stroke="#3d4a5a" stroke-width="4" stroke-linecap="round"/><path d="M22 24h20l-4-14H26z" fill="#3d4a5a" ${sw}/><rect class="glass" x="25" y="12" width="14" height="10" fill="#ffe58a"/>` },
    birdhouse: { name: 'Скворечник', price: 8000, cozy: 0.8, art: `<path d="M32 60V36" stroke="#8a5a3a" stroke-width="4"/><path d="M18 22 32 8l14 14z" fill="#d0624a" ${sw}/><rect x="21" y="20" width="22" height="18" fill="#e2b77f" ${sw}/><circle cx="32" cy="28" r="4" fill="#4a3022"/>` },
    birch: { name: 'Берёзка', price: 12000, cozy: 1, art: `<path d="M29 62V20h6v42z" fill="#f4f1ea" ${sw}/><path d="M29 30h3M32 40h3M29 50h3" stroke="#3d3d3d" stroke-width="2"/><circle cx="24" cy="18" r="10" fill="#9edb78" ${sw}/><circle cx="40" cy="16" r="10" fill="#8fd06a" ${sw}/><circle cx="32" cy="8" r="9" fill="#b2e68e" ${sw}/>` },
  };
  const designCozy = () => Math.min(15, L.items.reduce((s, it) => s + ((ITEMS[it.t] || {}).cozy || 0), 0));
  H.priceMul.push(() => 1 + designCozy() / 100);

  /* --- слой с вещами --- */
  const defPos = (i) => ({ x: 19 + (i % 8) * 6, y: 14 });
  function layerHTML() {
    const decos = S.deco.map((id, i) => {
      const p = L.pos['deco:' + id] || defPos(i);
      return `<span class="dc-li deco" data-li="deco:${id}" style="left:${p.x}%;top:${p.y}%" title="${esc(id)}">${ART.deco(id)}</span>`;
    });
    const items = L.items.map((it, i) => `<span class="dc-li item i-${it.t}" data-li="item:${i}" style="left:${it.x}%;top:${it.y}%">${svg(ITEMS[it.t].art)}${edit ? `<b class="dc-li-x" data-lidel="${i}">✕</b>` : ''}</span>`);
    return [...decos, ...items].join('');
  }
  function paintLayer(scene) {
    let layer = scene.querySelector('.dc-layout');
    if (!layer) { layer = document.createElement('div'); layer.className = 'dc-layout'; scene.appendChild(layer); }
    const h = layerHTML() + edit;
    if (layer._h !== h) { layer._h = h; layer.innerHTML = layerHTML(); }
    layer.classList.toggle('edit', edit);
    scene.classList.toggle('designing', edit);
    let bar = scene.querySelector('.dc-designbar');
    if (!bar) {
      scene.insertAdjacentHTML('beforeend', `<button class="dc-designbtn" data-design="1">✏️ Обустроить</button><div class="dc-designbar"></div>`);
      bar = scene.querySelector('.dc-designbar');
    }
    scene.querySelector('.dc-designbtn').textContent = edit ? '✓ Готово' : '✏️ Обустроить';
    scene.querySelector('.dc-designbtn').hidden = !!D.visit;
    const bh = edit ? `<span>Тащи вещи мышкой. Купить и поставить:</span>${Object.entries(ITEMS).map(([k, it]) => `<button data-place="${k}" title="${esc(it.name)} · +${it.cozy}% уюта">${svg(it.art)}<small>${rub(it.price)}</small></button>`).join('')}<em>уют от обустройства +${designCozy().toFixed(1)}% (макс. 15%)</em>` : '';
    if (bar._h !== bh) { bar._h = bh; bar.innerHTML = bh; }
    bar.hidden = !edit;
  }
  H.scene.push((scene) => { if (!D.visit) paintLayer(scene); else { const l = scene.querySelector('.dc-layout'); if (l) { l.innerHTML = ''; l._h = ''; } } });

  /* --- перетаскивание --- */
  const root = document.getElementById('dc');
  root.addEventListener('pointerdown', (e) => {
    if (!edit) return;
    const li = e.target.closest('.dc-li');
    if (!li || e.target.closest('[data-lidel]')) return;
    e.preventDefault();
    drag = { el: li, key: li.dataset.li };
    li.setPointerCapture(e.pointerId);
    li.classList.add('dragging');
  });
  root.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = root.querySelector('#dc-scene').getBoundingClientRect();
    const x = Math.max(0, Math.min(96, ((e.clientX - r.left) / r.width) * 100 - 2));
    const y = Math.max(0, Math.min(92, ((e.clientY - r.top) / r.height) * 100 - 4));
    drag.el.style.left = x + '%';
    drag.el.style.top = y + '%';
    drag.x = x; drag.y = y;
  });
  root.addEventListener('pointerup', () => {
    if (!drag) return;
    const { key, x, y } = drag;
    drag.el.classList.remove('dragging');
    drag = null;
    if (x == null) return;
    const [kind, id] = key.split(':');
    if (kind === 'deco') L.pos['deco:' + id] = { x: +x.toFixed(1), y: +y.toFixed(1) };
    else if (L.items[+id]) Object.assign(L.items[+id], { x: +x.toFixed(1), y: +y.toFixed(1) });
    D.save();
  });
  H.click.push((t) => {
    if (t.closest('[data-design]')) { edit = !edit; D.render(); return true; }
    const p = t.closest('[data-place]');
    if (p) {
      const it = ITEMS[p.dataset.place];
      if (L.items.length >= 60) { A.toast('Участок и так заставлен'); return true; }
      if (D.pay(it.price)) { L.items.push({ t: p.dataset.place, x: 40 + D.rnd() * 10, y: 50 + D.rnd() * 10 }); D.sfx.plant(); D.save(); D.render(); }
      return true;
    }
    const del = t.closest('[data-lidel]');
    if (del) {
      const it = L.items[+del.dataset.lidel];
      if (it) { S.rub += Math.round(ITEMS[it.t].price / 2); L.items.splice(+del.dataset.lidel, 1); A.toast('Убрано — половина цены вернулась'); D.save(); D.render(); }
      return true;
    }
    return false;
  });
  H.buffs.push(() => (designCozy() ? [`<span class="dc-buff">🌿 обустройство +${designCozy().toFixed(1)}%</span>`] : []));
})();
