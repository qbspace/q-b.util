(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const G = window.Gen;

  const TYPES = {
    pw: { label: 'Пароль', cls: 't-pw', abbr: 'PW' },
    key: { label: 'Ключ', cls: 't-key', abbr: 'KEY' },
    em: { label: 'Почта', cls: 't-em', abbr: '@' },
    ph: { label: 'Телефон', cls: 't-ph', abbr: 'TEL' },
    id: { label: 'Личность', cls: 't-id', abbr: 'ID' },
    misc: { label: 'Разное', cls: 't-misc', abbr: '•••' },
  };

  /* ---------------- state ---------------- */
  // В приложении данные лежат в JSON-файле через main-процесс; в браузере — в localStorage
  const fileStore = window.qb && window.qb.storeAll ? window.qb.storeAll() || {} : null;
  const fromLocal = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const load = (k, d) => {
    if (!fileStore) return fromLocal(k) ?? d;
    if (k in fileStore) return fileStore[k] ?? d;
    // перенос данных из старой версии, хранившей всё в localStorage
    const old = fromLocal(k);
    if (old != null) window.qb.storeSet(k, old);
    return old ?? d;
  };
  const store = (k, v) => {
    if (fileStore) return window.qb.storeSet(k, v);
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
  };

  const settings = Object.assign({ autocopy: false, history: true, mask: false }, load('qb.settings', {}));
  const stats = Object.assign({ gen: 0, copied: 0 }, load('qb.stats', {}));
  let history = settings.history ? load('qb.history', []) : [];
  let session = 0;
  let lastPassword = '';

  function persist() {
    store('qb.stats', stats);
    store('qb.settings', settings);
    store('qb.history', settings.history ? history.slice(0, 300) : []);
  }

  function record(type, sub, values) {
    const ts = Date.now();
    values.forEach((v) => history.unshift({ type, sub, v, ts }));
    history = history.slice(0, 300);
    stats.gen += values.length;
    session += values.length;
    if (type === 'pw' && sub === 'Символы') lastPassword = values[0];
    persist();
    renderDash();
    if (settings.autocopy && values.length === 1) copy(values[0], true);
  }

  /* ---------------- copy / toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
  }

  async function copy(text, silent) {
    try {
      if (window.qb) await window.qb.copy(text);
      else await navigator.clipboard.writeText(text);
      stats.copied++;
      persist();
      $('#st-copy').textContent = stats.copied;
      if (!silent) toast('Скопировано');
      else toast('Скопировано автоматически');
    } catch {
      toast('Не удалось скопировать');
    }
  }

  async function save(name, content) {
    if (window.qb) {
      if (await window.qb.save(name, content)) toast('Файл сохранён');
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([content], { type: 'text/plain' }));
      a.download = name;
      a.click();
    }
  }

  const mask = (h) => (settings.mask && h.type === 'pw' ? '•'.repeat(Math.min(16, h.v.length)) : h.v);

  /* ---------------- UI helpers ---------------- */
  function seg(el, onChange) {
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b)) return;
      $$('button', el).forEach((x) => x.classList.toggle('on', x === b));
      onChange && onChange(b.dataset.v);
    });
    return () => $('button.on', el)?.dataset.v;
  }

  function range(id) {
    const el = $('#' + id), out = $('#' + id + '-v');
    const sync = () => {
      el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
      if (out) out.textContent = el.value;
    };
    el.addEventListener('input', sync);
    sync();
    return () => +el.value;
  }

  function strengthColor(bits) {
    if (bits < 40) return '#e5484d';
    if (bits < 60) return '#f0b35a';
    if (bits < 90) return '#c9df6f';
    return '#5fc2ae';
  }

  // Универсальный список результатов
  function renderResults(box, { title, type, items, exportName }) {
    if (!items.length) {
      box.innerHTML = `<div class="empty"><div class="sparkle">✦</div><p>НАСТРОЙ И ЖМИ «СГЕНЕРИРОВАТЬ»</p></div>`;
      return;
    }
    box.innerHTML = `
      <div class="res-head">
        <h3>${esc(title)}</h3>
        <span class="count">${items.length} ШТ.</span>
        <button class="pill pill-white" data-a="all">Копировать всё</button>
        <button class="pill pill-white" data-a="save">Экспорт</button>
      </div>
      <div class="res-list">
        ${items.map((it, i) => `
          <div class="row" data-i="${i}" style="animation-delay:${Math.min(i, 20) * 18}ms">
            <span class="idx">${String(i + 1).padStart(2, '0')}</span>
            <div class="row-body"><div class="row-val">${esc(it.v)}</div></div>
            ${it.bits != null ? `<span class="meta">${it.bits} БИТ</span><span class="strength"><i style="width:${Math.min(100, it.bits / 1.28)}%;background:${strengthColor(it.bits)}"></i></span>` : ''}
            ${it.meta ? `<span class="meta">${esc(it.meta)}</span>` : ''}
            <button class="copy-dot" title="Копировать"></button>
          </div>`).join('')}
      </div>`;
    box.onclick = (e) => {
      const a = e.target.closest('[data-a]');
      if (a?.dataset.a === 'all') return copy(items.map((x) => x.v).join('\n'));
      if (a?.dataset.a === 'save') return save(exportName || 'q-b.util.txt', items.map((x) => x.v).join('\n'));
      const row = e.target.closest('.row');
      if (!row || window.getSelection().toString()) return;
      copy(items[row.dataset.i].v);
      $('.copy-dot', row).classList.add('done');
    };
  }

  /* ---------------- navigation ---------------- */
  const PAGES = {
    dashboard: ['Привет 👋', 'ЛОКАЛЬНЫЙ ГЕНЕРАТОР ФЕЙКОВЫХ ДАННЫХ'],
    passwords: ['Пароли', 'НАЗАД НА ДАШБОРД'],
    keys: ['Ключи и токены', 'НАЗАД НА ДАШБОРД'],
    emails: ['Почты', 'НАЗАД НА ДАШБОРД'],
    phones: ['Телефоны', 'НАЗАД НА ДАШБОРД'],
    identity: ['Личности', 'НАЗАД НА ДАШБОРД'],
    misc: ['Разное', 'НАЗАД НА ДАШБОРД'],
    history: ['История', 'НАЗАД НА ДАШБОРД'],
    settings: ['Настройки', 'НАЗАД НА ДАШБОРД'],
  };
  let current = 'dashboard';

  function go(page) {
    if (!PAGES[page]) return;
    current = page;
    $$('.page').forEach((p) => p.classList.toggle('active', p.dataset.page === page));
    $$('.nav-item').forEach((n) => n.classList.toggle('active', n.dataset.go === page));
    $('#page-title').textContent = page === 'dashboard' ? greeting() : PAGES[page][0];
    $('#page-crumb').innerHTML = `${PAGES[page][1]} <i>›</i>`;
    if (page === 'history') renderHistory();
    if (page === 'dashboard') renderDash();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-go]');
    if (!el) return;
    go(el.dataset.go);
    if (el.dataset.action === 'quick-identity') genIdentity();
    if (el.dataset.action === 'export') exportHistory();
  });

  /* ---------------- passwords ---------------- */
  const pwMode = seg($('#pw-mode'), (v) => {
    $$('[data-mode]', $('[data-page=passwords]')).forEach((el) => (el.hidden = el.dataset.mode !== v));
  });
  const pwLen = range('pw-len'), pwCount = range('pw-count'), ppWords = range('pp-words');
  const ppSep = seg($('#pp-sep'));

  function genPasswords() {
    const n = pwCount(), mode = pwMode();
    const opts = {
      length: pwLen(),
      upper: $('#pw-upper').checked, lower: $('#pw-lower').checked,
      digits: $('#pw-digits').checked, symbols: $('#pw-symbols').checked,
      noAmbiguous: $('#pw-amb').checked,
    };
    if (mode === 'chars' && !opts.upper && !opts.lower && !opts.digits && !opts.symbols) {
      return toast('Включи хотя бы один набор символов');
    }
    const vals = Array.from({ length: n }, () => mode === 'chars'
      ? G.password(opts)
      : G.passphrase({ words: ppWords(), sep: ppSep(), capitalize: $('#pp-cap').checked, addNumber: $('#pp-num').checked }));
    renderResults($('#pw-results'), {
      title: mode === 'chars' ? 'Пароли' : 'Парольные фразы', type: 'pw', exportName: 'passwords.txt',
      items: vals.map((v) => ({ v, bits: mode === 'chars' ? G.entropy(v) : Math.round(ppWords() * Math.log2(220) + ($('#pp-num').checked ? 6.5 : 0)) })),
    });
    record('pw', mode === 'chars' ? 'Символы' : 'Фраза', vals);
  }
  $('#pw-gen').onclick = genPasswords;

  /* ---------------- keys ---------------- */
  $('#key-type').innerHTML = Object.entries(G.KEY_TYPES)
    .map(([k, t], i) => `<button data-v="${k}" class="${i ? '' : 'on'}">${t.label}</button>`).join('');
  const keyBytes = range('key-bytes'), keyCount = range('key-count');
  const syncKeyFields = (v) => {
    $('#key-bytes-f').hidden = !['hex', 'base64', 'base64url', 'api', 'pin'].includes(v);
    $('#key-prefix-f').hidden = v !== 'api';
    $('#key-bytes-f > span').firstChild.textContent = v === 'pin' ? 'ЦИФР ' : v === 'api' ? 'СИМВОЛОВ ' : 'БАЙТ ЭНТРОПИИ ';
  };
  const keyType = seg($('#key-type'), syncKeyFields);
  syncKeyFields('uuid4');

  function genKeys() {
    const t = G.KEY_TYPES[keyType()];
    const o = { bytes: keyBytes(), prefix: $('#key-prefix').value.trim() };
    const vals = Array.from({ length: keyCount() }, () => t.gen(o));
    renderResults($('#key-results'), { title: t.label, type: 'key', items: vals.map((v) => ({ v, meta: `${v.length} СИМВ.` })), exportName: 'keys.txt' });
    record('key', t.label, vals);
  }
  $('#key-gen').onclick = genKeys;

  const hashAlgo = seg($('#hash-algo'), () => doHash());
  async function doHash() {
    const txt = $('#hash-in').value;
    $('#hash-out').textContent = txt ? await G.hash(hashAlgo(), txt) : '—';
  }
  $('#hash-in').addEventListener('input', doHash);
  $('#hash-out').onclick = () => { const v = $('#hash-out').textContent; if (v !== '—') copy(v); };

  /* ---------------- emails ---------------- */
  const emDomains = seg($('#em-domains'), (v) => ($('#em-custom-f').hidden = v !== 'custom'));
  const emStyle = seg($('#em-style'));
  const emLocale = seg($('#em-locale'));
  const emCount = range('em-count');

  function genEmails() {
    const d = emDomains();
    const custom = d === 'custom' ? $('#em-custom').value : '';
    if (d === 'custom' && !custom.trim()) return toast('Впиши хотя бы один домен');
    const vals = Array.from({ length: emCount() }, () =>
      G.email({ locale: emLocale(), domains: d === 'custom' ? 'popular' : d, custom, style: emStyle() }));
    renderResults($('#em-results'), { title: 'Почты', type: 'em', items: vals.map((v) => ({ v })), exportName: 'emails.txt' });
    record('em', 'Почта', vals);
  }
  $('#em-gen').onclick = genEmails;

  /* ---------------- phones ---------------- */
  $('#ph-country').innerHTML = G.COUNTRIES
    .map((c, i) => `<button data-v="${c.code}" class="${i ? '' : 'on'}"><b>${c.code}</b>${c.name}<small>${c.dial}</small></button>`).join('');
  const syncPhoneNote = (code) => {
    const c = G.COUNTRIES.find((x) => x.code === code);
    $('#ph-note').textContent = c.note
      ? `✦ ${c.name}: используется ${c.note} — такие номера гарантированно не принадлежат реальным людям.`
      : `Номера соответствуют формату ${c.name} и генерируются случайно — не звони по ним 🙂`;
    $('#ph-format button[data-v=intl]').textContent = G.phone(code);
  };
  const phCountry = seg($('#ph-country'), syncPhoneNote);
  const phFormat = seg($('#ph-format'));
  const phCount = range('ph-count');
  syncPhoneNote('RU');

  function genPhones() {
    const code = phCountry();
    const vals = Array.from({ length: phCount() }, () => G.phone(code, { format: phFormat() }));
    const c = G.COUNTRIES.find((x) => x.code === code);
    renderResults($('#ph-results'), { title: `Телефоны · ${c.name}`, type: 'ph', items: vals.map((v) => ({ v, meta: code })), exportName: `phones-${code}.txt` });
    record('ph', c.name, vals);
  }
  $('#ph-gen').onclick = genPhones;

  /* ---------------- identity ---------------- */
  $('#id-country').innerHTML = G.COUNTRIES.map((c) => `<option value="${c.code}">${c.code} · ${c.name} (${c.dial})</option>`).join('');
  const idLocale = seg($('#id-locale'), (v) => { $('#id-country').value = v === 'ru' ? 'RU' : 'US'; genIdentity(); });
  let currentId = null;

  function idText(p) {
    return [
      `Имя: ${p.full}`, `Пол: ${p.gender === 'male' ? 'мужской' : 'женский'}`, `Дата рождения: ${p.birth} (${p.age})`,
      `Email: ${p.email}`, `Телефон: ${p.phone}`, `Город: ${p.city}`, `Адрес: ${p.address}`, `Индекс: ${p.zip}`,
      `Логин: ${p.username}`, `Пароль: ${p.password}`, `Карта (тест): ${p.card.number} ${p.card.exp} CVC ${p.card.cvc}`,
    ].join('\n');
  }

  function genIdentity(silent) {
    const p = G.identity(idLocale(), $('#id-country').value);
    currentId = p;
    const f = (label, v, cls = '') => `<div class="id-f ${cls}" data-c="${esc(v)}"><span>${label}</span><div>${esc(v)}</div></div>`;
    $('#id-card').innerHTML = `
      <div class="id-visual">
        <div class="hero-bg"><span>${esc(p.first[0] + p.last[0])}</span></div>
        <div class="hero-plate glass" data-c="${esc(p.full)}" style="cursor:pointer">
          <div class="hero-name">${esc(p.full)}</div>
          <div class="hero-sub">${p.age} ЛЕТ · ${esc(p.city)}</div>
        </div>
      </div>
      <div class="id-fields">
        ${f('ИМЯ', p.first)}${f('ФАМИЛИЯ', p.last)}
        ${f('ДАТА РОЖДЕНИЯ', p.birth)}${f('ПОЛ', p.gender === 'male' ? 'Мужской' : 'Женский')}
        ${f('EMAIL', p.email, 'wide mono')}
        ${f('ТЕЛЕФОН', p.phone, 'mono')}${f('ИНДЕКС', p.zip, 'mono')}
        ${f('АДРЕС', `${p.city}, ${p.address}`, 'wide')}
        ${f('ЛОГИН', p.username, 'mono')}${f('ПАРОЛЬ', p.password, 'mono')}
        <div class="id-cardviz" data-c="${esc(p.card.number.replace(/ /g, ''))}">
          <div><small>ТЕСТОВАЯ КАРТА</small><span class="brand">${p.card.brand}</span></div>
          <div style="text-align:right"><small>EXP / CVC</small>${p.card.exp} · ${p.card.cvc}</div>
          <div class="num">${p.card.number}</div>
        </div>
      </div>`;
    if (silent !== true) record('id', 'Личность', [`${p.full} · ${p.email} · ${p.phone}`]);
  }
  $('#id-card').addEventListener('click', (e) => {
    const el = e.target.closest('[data-c]');
    if (el) copy(el.dataset.c);
  });
  $('#id-gen').onclick = () => genIdentity();
  $('#id-copy-all').onclick = () => currentId && copy(idText(currentId));
  $('#id-copy-json').onclick = () => currentId && copy(JSON.stringify(currentId, null, 2));

  /* ---------------- misc ---------------- */
  $('#misc-type').innerHTML = Object.entries(G.MISC_TYPES)
    .map(([k, t], i) => `<button data-v="${k}" class="${i ? '' : 'on'}">${t.label}</button>`).join('');
  const miscType = seg($('#misc-type'), (v) => ($('#misc-range').hidden = v !== 'number'));
  const miscCount = range('misc-count');

  function genMisc() {
    const t = G.MISC_TYPES[miscType()];
    const o = { min: Math.round(+$('#misc-min').value || 0), max: Math.round(+$('#misc-max').value || 0) };
    const vals = Array.from({ length: miscCount() }, () => t.gen(o));
    renderResults($('#misc-results'), {
      title: t.label, type: 'misc', exportName: `${miscType()}.txt`,
      items: vals.map((v) => ({ v })),
    });
    if (miscType() === 'color') {
      $$('#misc-results .row').forEach((r, i) => {
        r.querySelector('.idx').outerHTML = `<span class="thumb" style="width:26px;height:26px;border-radius:8px;background:${vals[i]}"></span>`;
      });
    }
    record('misc', t.label, vals);
  }
  $('#misc-gen').onclick = genMisc;

  /* ---------------- history ---------------- */
  let histFilter = 'all';
  function renderHistory() {
    const box = $('#hist-results');
    const list = history.filter((h) => histFilter === 'all' || h.type === histFilter);
    const chips = `<div class="filter chips">${[['all', 'Все'], ...Object.entries(TYPES).map(([k, t]) => [k, t.label])]
      .map(([k, l]) => `<button data-f="${k}" class="${histFilter === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    box.innerHTML = `
      <div class="res-head">
        <h3>История</h3>
        <span class="count">${list.length} ЗАПИСЕЙ</span>
        <button class="pill pill-white" data-a="save">Экспорт</button>
        <button class="pill pill-white" data-a="clear">Очистить</button>
      </div>
      ${chips}
      ${list.length ? `<div class="res-list">${list.map((h, i) => `
        <div class="row" data-i="${i}" style="animation-delay:${Math.min(i, 20) * 15}ms">
          <span class="thumb ${TYPES[h.type].cls}">${TYPES[h.type].abbr}</span>
          <div class="row-body">
            <div class="row-type">${esc(h.sub)} · ${new Date(h.ts).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            <div class="row-val">${esc(mask(h))}</div>
          </div>
          <button class="copy-dot" title="Копировать"></button>
        </div>`).join('')}</div>`
        : `<div class="empty"><div class="sparkle">✦</div><p>ПОКА ПУСТО</p></div>`}`;
    box.onclick = (e) => {
      const f = e.target.closest('[data-f]');
      if (f) { histFilter = f.dataset.f; return renderHistory(); }
      const a = e.target.closest('[data-a]');
      if (a?.dataset.a === 'save') return exportHistory();
      if (a?.dataset.a === 'clear') return clearHistory();
      const row = e.target.closest('.row');
      if (!row) return;
      copy(list[row.dataset.i].v);
      $('.copy-dot', row).classList.add('done');
    };
  }

  function exportHistory() {
    if (!history.length) return toast('История пуста');
    const csv = 'type;subtype;value;time\n' + history
      .map((h) => [TYPES[h.type].label, h.sub, `"${h.v.replace(/"/g, '""')}"`, new Date(h.ts).toISOString()].join(';')).join('\n');
    save('q-b.util-history.csv', csv);
  }

  function clearHistory() {
    history = [];
    persist();
    renderHistory();
    renderDash();
    toast('История очищена');
  }

  /* ---------------- profile ---------------- */
  const GRADS = [
    'linear-gradient(135deg, #e4f07e, #8ed3c6 60%, #e2a6c6)',
    'linear-gradient(135deg, #f6dbe9, #e2a6c6 55%, #b6b0e6)',
    'linear-gradient(135deg, #cdeee6, #8ed3c6 50%, #5b9e94)',
    'linear-gradient(135deg, #fbe2cc, #e8b48c 55%, #c47a5a)',
    'linear-gradient(135deg, #e9e4ff, #b6b0e6 55%, #6f68b8)',
    'linear-gradient(135deg, #f3f2ee, #bdbab3 55%, #6d6b66)',
    'linear-gradient(135deg, #2a2a28, #111 60%, #000)',
  ];
  const PROFILE_DEFAULT = { nick: '', role: '', photo: '', grad: 0, greet: true };
  const profile = Object.assign({}, PROFILE_DEFAULT, load('qb.profile', {}));

  const initials = (nick) => {
    const parts = nick.trim().split(/[\s._-]+/).filter(Boolean);
    if (!parts.length) return 'QB';
    return (parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2)).toUpperCase();
  };

  function greeting() {
    return profile.greet && profile.nick.trim() ? `Привет, ${profile.nick.trim()} 👋` : 'Привет 👋';
  }

  function paintAva(el) {
    el.textContent = initials(profile.nick);
    el.style.setProperty('--ava', profile.photo ? `url("${profile.photo}")` : GRADS[profile.grad] || GRADS[0]);
    el.classList.toggle('photo-on', !!profile.photo);
    // тёмный градиент — светлые инициалы
    el.style.color = profile.photo ? '' : profile.grad === GRADS.length - 1 ? '#f3f3ef' : '';
  }

  function renderProfile() {
    const name = profile.nick.trim() || 'LOCAL MODE';
    const role = profile.role.trim() || 'OFFLINE · CRYPTO RNG';
    paintAva($('#me-ava'));
    paintAva($('#pf-ava'));
    $('#me-name').textContent = name;
    $('#me-role').textContent = role;
    $('#pf-preview-name').textContent = profile.nick.trim() || 'Без ника';
    $('#pf-preview-role').textContent = role;
    $('#pf-nick-c').textContent = `${profile.nick.length}/20`;
    $('#pf-role-c').textContent = `${profile.role.length}/28`;
    $$('#pf-grad button').forEach((b, i) => b.classList.toggle('on', !profile.photo && i === profile.grad));
    $('#pf-remove').hidden = !profile.photo;
    if (current === 'dashboard') $('#page-title').textContent = greeting();
  }

  function saveProfile() {
    if (!store('qb.profile', profile)) toast('Не удалось сохранить профиль');
    renderProfile();
  }

  // Ужимаем фото до квадрата 192×192, чтобы файл данных оставался маленьким
  function loadPhoto(file) {
    if (!file || !file.type.startsWith('image/')) return toast('Нужна картинка');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const S = 192, side = Math.min(img.width, img.height);
      const c = document.createElement('canvas');
      c.width = c.height = S;
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
      URL.revokeObjectURL(url);
      profile.photo = c.toDataURL('image/webp', 0.9);
      saveProfile();
      toast('Ава обновлена');
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('Не получилось открыть картинку'); };
    img.src = url;
  }

  $('#pf-grad').innerHTML = GRADS.map((g, i) => `<button data-i="${i}" style="background:${g}"></button>`).join('');
  $('#pf-grad').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    profile.grad = +b.dataset.i;
    profile.photo = '';
    saveProfile();
  };
  $('#pf-upload').onclick = $('#pf-upload-2').onclick = () => $('#pf-file').click();
  $('#pf-file').onchange = (e) => { loadPhoto(e.target.files[0]); e.target.value = ''; };
  $('#pf-remove').onclick = () => { profile.photo = ''; saveProfile(); };
  $('#pf-nick').value = profile.nick;
  $('#pf-role').value = profile.role;
  $('#pf-greet').checked = profile.greet;
  $('#pf-nick').oninput = (e) => { profile.nick = e.target.value; saveProfile(); };
  $('#pf-role').oninput = (e) => { profile.role = e.target.value; saveProfile(); };
  $('#pf-greet').onchange = (e) => { profile.greet = e.target.checked; saveProfile(); };
  $('#pf-reset').onclick = () => {
    Object.assign(profile, PROFILE_DEFAULT);
    $('#pf-nick').value = $('#pf-role').value = '';
    $('#pf-greet').checked = true;
    saveProfile();
    toast('Профиль сброшен');
  };

  // Перетаскивание картинки прямо на аватар
  const avaWrap = $('.profile-ava-wrap');
  avaWrap.addEventListener('dragover', (e) => e.preventDefault());
  avaWrap.addEventListener('drop', (e) => { e.preventDefault(); loadPhoto(e.dataTransfer.files[0]); });

  // чтобы брошенный мимо аватара файл не открывался вместо приложения
  ['dragover', 'drop'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault()));

  renderProfile();

  /* ---------------- updates ---------------- */
  let updPrev = '';
  function renderUpdate(u) {
    $('#upd-cur').textContent = u.current;
    $('#about-ver').textContent = 'v' + u.current;
    const status = {
      dev: 'В режиме разработки обновления не проверяются',
      idle: 'Проверка при запуске и каждые 4 часа',
      checking: 'Ищу обновления…',
      latest: 'У тебя последняя версия ✓',
      downloading: `Скачиваю v${u.version}… ${u.percent || 0}%`,
      ready: `v${u.version} скачана — перезапусти, чтобы установить`,
      error: 'Не удалось проверить обновления',
    }[u.state];
    $('#upd-status').textContent = status;
    $('#upd-dot').className = 'upd-dot ' + ({ latest: 'ok', checking: 'busy', downloading: 'busy', ready: 'new' }[u.state] || '');
    $('#upd-check').hidden = u.state === 'ready';

    const show = u.state === 'downloading' || u.state === 'ready';
    $('#upd-card').hidden = !show;
    $('#bell').classList.toggle('has', show);
    if (show) {
      $('#upd-card-title').textContent = u.state === 'ready' ? 'ОБНОВЛЕНИЕ ГОТОВО' : 'ДОСТУПНО ОБНОВЛЕНИЕ';
      $('#upd-card-ver').textContent = 'v' + u.version;
      $('#upd-card-bar').style.width = (u.percent || 0) + '%';
      $('#upd-card-sub').textContent = u.state === 'ready' ? 'Пора обновиться — займёт пару секунд' : `Скачивается… ${u.percent || 0}%`;
      $('#upd-card-btn').hidden = u.state !== 'ready';
    }
    // тост только при смене состояния, а не на каждый процент
    if (u.state !== updPrev) {
      if (u.state === 'downloading') toast(`Вышла версия ${u.version} — качаю`);
      if (u.state === 'ready') toast(`Версия ${u.version} готова к установке`);
      updPrev = u.state;
    }
  }

  if (window.qb && window.qb.updGet) {
    window.qb.updGet().then(renderUpdate);
    window.qb.onUpdate(renderUpdate);
    $('#upd-check').onclick = () => window.qb.updCheck().then((u) => { if (u.state === 'dev') renderUpdate(u); });
    $('#upd-releases').onclick = () => window.qb.updReleases();
    $('#upd-card-btn').onclick = () => window.qb.updInstall();
  } else {
    renderUpdate({ state: 'dev', current: '1.0.0' });
    $('#upd-check').onclick = () => toast('Обновления работают только в установленном приложении');
  }

  /* ---------------- settings ---------------- */
  [['set-autocopy', 'autocopy'], ['set-history', 'history'], ['set-mask', 'mask']].forEach(([id, key]) => {
    const el = $('#' + id);
    el.checked = settings[key];
    el.onchange = () => { settings[key] = el.checked; persist(); renderDash(); };
  });
  $('#set-clear').onclick = clearHistory;

  /* ---------------- dashboard ---------------- */
  function renderHero() {
    const p = G.identity('ru');
    $('#hero-mono').textContent = p.first[0] + p.last[0];
    $('#hero-name').textContent = p.full;
    $('#hero-sub').textContent = `${p.age} лет · ${p.city} · ${p.phone}`;
    $('#hero').dataset.copy = idText(p);
  }
  $('#hero-refresh').onclick = (e) => { e.stopPropagation(); renderHero(); };
  $('#hero').querySelector('.hero-plate').onclick = () => copy($('#hero').dataset.copy);

  function renderRings(pw) {
    const c = G.composition(pw), len = pw.length || 1;
    const parts = [
      { k: 'БУКВЫ', v: (c.upper + c.lower) / len, col: 'var(--teal)', r: 52 },
      { k: 'ЦИФРЫ', v: c.digits / len, col: 'var(--lime)', r: 43 },
      { k: 'СИМВОЛЫ', v: c.symbols / len, col: 'var(--pink)', r: 34 },
    ];
    $('#rings').innerHTML = parts.map((p) => {
      const C = 2 * Math.PI * p.r;
      return `<circle cx="60" cy="60" r="${p.r}" stroke="${p.col}" opacity=".18"/>
              <circle cx="60" cy="60" r="${p.r}" stroke="${p.col}" stroke-dasharray="${Math.max(0.001, p.v) * C} ${C}"/>`;
    }).join('');
    $('#ring-legend').innerHTML = parts.map((p) =>
      `<div><i style="background:${p.col}"></i><span>${Math.round(p.v * 100)}%<br>${p.k}</span></div>`).join('');
    const bits = G.entropy(pw);
    $('#ring-bits').textContent = bits;
    const pct = Math.min(100, Math.round((bits / 128) * 100));
    $('#strength-pct').textContent = pct + '%';
    $('#strength-fill').style.width = pct + '%';
    $('#strength-mark').style.left = pct + '%';
  }

  function renderFeed() {
    const feed = $('#feed');
    const items = history.slice(0, 8);
    if (!items.length) {
      feed.innerHTML = `<div class="feed-empty"><div class="sparkle">✦</div><br>ЗДЕСЬ ПОЯВИТСЯ ИСТОРИЯ</div>`;
      return;
    }
    feed.innerHTML = items.map((h, i) => `
      <div class="row" data-i="${i}" style="animation-delay:${i * 30}ms">
        <span class="thumb ${TYPES[h.type].cls}">${TYPES[h.type].abbr}</span>
        <div class="row-body">
          <div class="row-type">${esc(h.sub)}</div>
          <div class="row-type" style="color:var(--ink-2);margin-top:3px">${new Date(h.ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()}</div>
          <div class="row-val">${esc(mask(h))}</div>
        </div>
        <button class="copy-dot" title="Копировать"></button>
      </div>`).join('');
    feed.onclick = (e) => {
      const row = e.target.closest('.row');
      if (!row) return;
      copy(items[row.dataset.i].v);
      $('.copy-dot', row).classList.add('done');
    };
  }

  function renderStats() {
    $('#st-gen').textContent = stats.gen;
    $('#st-gen-session').textContent = `+${session} ЗА СЕССИЮ`;
    $('#st-copy').textContent = stats.copied;
    const max = Math.max(100, Math.ceil((stats.gen + 1) / 100) * 100);
    $('#st-max').textContent = max;
    $('#st-mid').textContent = max / 2;
    $('#st-mark').style.left = (stats.gen / max) * 100 + '%';
  }

  function renderDash() {
    if (!lastPassword) lastPassword = (history.find((h) => h.type === 'pw' && h.sub === 'Символы') || {}).v || G.password({ length: 20 });
    renderRings(lastPassword);
    renderFeed();
    renderStats();
  }

  // Быстрая генерация
  const QUICK = [
    { k: 'Пароль', type: 'pw', sub: 'Символы', gen: () => G.password({ length: 20 }) },
    { k: 'UUID', type: 'key', sub: 'UUID v4', gen: () => G.uuid4() },
    { k: 'Почта', type: 'em', sub: 'Почта', gen: () => G.email() },
    { k: 'Телефон RU', type: 'ph', sub: 'Россия', gen: () => G.phone('RU') },
    { k: 'Телефон US', type: 'ph', sub: 'США', gen: () => G.phone('US') },
    { k: 'Никнейм', type: 'misc', sub: 'Никнейм', gen: () => G.MISC_TYPES.username.gen() },
    { k: 'IPv4', type: 'misc', sub: 'IPv4', gen: () => G.MISC_TYPES.ipv4.gen() },
    { k: 'PIN', type: 'key', sub: 'PIN', gen: () => G.KEY_TYPES.pin.gen({ bytes: 4 }) },
    { k: 'API key', type: 'key', sub: 'API key', gen: () => G.KEY_TYPES.api.gen({ bytes: 32 }) },
    { k: 'Тест-карта', type: 'misc', sub: 'Тест-карта', gen: () => G.MISC_TYPES.card.gen() },
  ];
  const DOT_COLORS = [['#f3e9b9', '#cfe07a'], ['#cdeee6', '#8ed3c6'], ['#f6dbe9', '#e2a6c6'], ['#e9e4ff', '#b6b0e6'], ['#fbe2cc', '#e8b48c']];
  let qi = -1, qVal = '';
  $('#quick-grid').innerHTML = QUICK.map((q, i) => {
    const [a, b] = DOT_COLORS[i % DOT_COLORS.length];
    return `<button class="qbtn" data-q="${i}">${q.k}<span class="dots3"><i style="background:${a}"></i><i style="background:${b}"></i></span></button>`;
  }).join('');

  function quick(i) {
    qi = (i + QUICK.length) % QUICK.length;
    const q = QUICK[qi];
    qVal = q.gen();
    $('#q-out').textContent = qVal;
    $('#q-title').textContent = q.k;
    $('#q-prev-l').textContent = QUICK[(qi - 1 + QUICK.length) % QUICK.length].k;
    $('#q-next-l').textContent = QUICK[(qi + 1) % QUICK.length].k;
    $('#q-copy').classList.remove('done');
    record(q.type, q.sub, [qVal]);
    if (q.type === 'pw') renderRings(qVal);
  }
  $('#quick-grid').onclick = (e) => { const b = e.target.closest('[data-q]'); if (b) quick(+b.dataset.q); };
  $('#q-prev').onclick = () => quick(qi < 0 ? QUICK.length - 1 : qi - 1);
  $('#q-next').onclick = () => quick(qi + 1);
  $('#q-copy').onclick = () => { if (qVal) { copy(qVal); $('#q-copy').classList.add('done'); } };

  function newUuid() {
    const u = G.uuid4();
    $('#st-uuid').textContent = u;
    return u;
  }
  $('#st-uuid').parentElement.onclick = () => {
    const u = $('#st-uuid').textContent;
    copy(u);
    record('key', 'UUID v4', [u]);
    newUuid();
  };

  /* ---------------- window controls / keys ---------------- */
  if (window.qb) {
    $('#w-min').onclick = () => window.qb.minimize();
    $('#w-max').onclick = () => window.qb.maximize();
    $('#w-close').onclick = () => window.qb.close();
  } else {
    $('.winctl').hidden = true;
  }

  const GENS = { passwords: genPasswords, keys: genKeys, emails: genEmails, phones: genPhones, identity: () => genIdentity(), misc: genMisc };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement.tagName) && GENS[current]) {
      e.preventDefault();
      GENS[current]();
    }
    if (e.ctrlKey && /^[1-9]$/.test(e.key)) go(Object.keys(PAGES)[+e.key - 1]);
  });

  /* ---------------- init ---------------- */
  ['#pw-results', '#key-results', '#em-results', '#ph-results', '#misc-results']
    .forEach((s) => renderResults($(s), { items: [] }));
  renderHero();
  newUuid();
  renderDash();
  genIdentity(true); // стартовая личность без записи в историю
})();
