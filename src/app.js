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

  const settings = Object.assign({ autocopy: false, history: true, mask: false, theme: 'light', tray: true, hotkey: true, autostart: true }, load('qb.settings', {}));
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
            <button class="qr-btn" title="QR-код"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/></svg></button>
            <button class="copy-dot" title="Копировать"></button>
          </div>`).join('')}
      </div>`;
    box.onclick = (e) => {
      const a = e.target.closest('[data-a]');
      if (a?.dataset.a === 'all') return copy(items.map((x) => x.v).join('\n'));
      if (a?.dataset.a === 'save') return save(exportName || 'q-b.util.txt', items.map((x) => x.v).join('\n'));
      const qrb = e.target.closest('.qr-btn');
      if (qrb) return showQR(items[qrb.closest('.row').dataset.i].v);
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
    tables: ['Тестовые таблицы', 'НАЗАД НА ДАШБОРД'],
    plates: ['Номера РФ', 'НАЗАД НА ДАШБОРД'],
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
    $('#pw-count-f').hidden = $('#pw-gen').hidden = v === 'check';
    if (v === 'check') { renderCheck(); $('#chk-in').focus(); } else renderResults($('#pw-results'), { items: [] });
  });

  function renderCheck() {
    const box = $('#pw-results');
    const pw = $('#chk-in').value;
    box.onclick = null;
    if (!pw) {
      box.innerHTML = `<div class="empty"><div class="sparkle">✦</div><p>ВСТАВЬ ПАРОЛЬ СЛЕВА — ОЦЕНКА ПОЯВИТСЯ ТУТ</p></div>`;
      return;
    }
    const a = G.analyze(pw);
    const col = ['#e5484d', '#f0b35a', '#e6d36a', '#c9df6f', '#5fc2ae'][a.score];
    box.innerHTML = `
      <div class="chk">
        <div class="chk-top">
          <div>
            <span class="cap">НАДЁЖНОСТЬ</span>
            <div class="chk-label" style="--c:${col}">${a.label}</div>
          </div>
          <div class="chk-bits"><b>${a.bits}</b><span>БИТ</span></div>
        </div>
        <div class="chk-meter">${[0, 1, 2, 3, 4].map((i) => `<i style="${i <= a.score ? `background:${col}` : ''}"></i>`).join('')}</div>
        <div class="chk-times">
          <div class="chk-time"><span>ПЕРЕБОР НА ВИДЕОКАРТЕ</span><b>${a.offline}</b><small>10 млрд попыток в секунду</small></div>
          <div class="chk-time"><span>ПЕРЕБОР ЧЕРЕЗ ФОРМУ ВХОДА</span><b>${a.online}</b><small>100 попыток в секунду</small></div>
        </div>
        <div class="chk-list">
          ${a.checks.map((c) => `<div class="chk-item ${c.ok ? 'ok' : ''}"><i></i>${c.text}${!c.ok && c.hint ? ` <small>· ${c.hint}</small>` : ''}</div>`).join('')}
        </div>
      </div>`;
  }
  $('#chk-in').addEventListener('input', renderCheck);
  $('#chk-eye').onclick = () => {
    const i = $('#chk-in');
    i.type = i.type === 'password' ? 'text' : 'password';
    $('#chk-eye').classList.toggle('on', i.type === 'text');
  };
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
          <button class="qr-btn" title="QR-код"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/></svg></button>
          <button class="copy-dot" title="Копировать"></button>
        </div>`).join('')}</div>`
        : `<div class="empty"><div class="sparkle">✦</div><p>ПОКА ПУСТО</p></div>`}`;
    box.onclick = (e) => {
      const f = e.target.closest('[data-f]');
      if (f) { histFilter = f.dataset.f; return renderHistory(); }
      const a = e.target.closest('[data-a]');
      if (a?.dataset.a === 'save') return exportHistory();
      if (a?.dataset.a === 'clear') return clearHistory();
      const qrb = e.target.closest('.qr-btn');
      if (qrb) return showQR(list[qrb.closest('.row').dataset.i].v);
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

  /* ---------------- what's new ---------------- */
  const CHANGELOG = {
    '3.0.0': [
      '📅 Задания дня и недели + 🏁 сезонный пропуск на 30 уровней с наградами',
      '🚘 Автосалон: 9 тачек с твоим номером, каждая даёт свой буст',
      '👤 Профиль игрока: тачка, номер, статистика, значки — его видят кенты в онлайне',
      '🔁 Обмен с кентами: монеты, кристаллы, брелки, скины и номера из автопарка',
    ],
    '2.5.0': [
      '🎲 Новые ставки ×250, ×500, ×1000 и ×2500 — дорогие уровни «Высоких ставок»',
      '⚡ Автокрутка ×20, ×40 и ×100 — новые уровни улучшения',
    ],
    '2.4.1': [
      '🔊 Тихий звук рулетки: щелчки ленты, мягкий «тук» на остановке и аккорд по редкости',
      'Звук выключается кнопкой 🔊 рядом с QR',
    ],
    '2.4.0': [
      '🔨 Аукцион стал общим: один лот на всех, перебивай кентов и ботов-перекупов',
      'В окне аукциона видно, сколько людей в зале и кто лидирует',
    ],
    '2.3.0': [
      '💎 Кристаллы — новая редкая валюта: за эпики, легендарки, мифики, задания, уровни и колесо',
      '💎 Лавка кристаллов на чёрном рынке: слоты под брелки, легендарные брелки, эксклюзивные скины, наборы',
      '🔨 Аукцион номеров: раз в 10 минут легендарка или мифик, торгуйся с перекупами',
      '🚗 Автопарк: выигранные номера приносят аренду, даже когда приложение закрыто',
      'Перезапуск чёрного рынка дороже — или за 3 кристалла',
    ],
    '2.2.0': [
      '🔧 Тюнинг номера: рамки, подсветка, наклейки, болты и ауры — с бесплатной примеркой',
      'Стиль обвесов даёт бонус к выплатам — до +19% на полном топе',
      'Обвесы от 5 тысяч до 100 миллионов — есть на что копить',
      'Скины «Военный», «СССР» и «Лёд» перерисованы',
    ],
    '2.1.1': [
      'Ставки у Ашота и в онлайне до миллиона и любая своя сумма',
      'У Ашота кнопка «Ва-банк» — поставить всё',
    ],
    '2.1.0': [
      '🕶 Чёрный рынок: завоз каждые 2 часа, редкие вещи появляются редко',
      '🔑 Брелки с бустами — носи до трёх сразу',
      '🎒 Расходники: энергетик, инкассация, билет в счастливый час, талон удачи, купон ×3',
      '🎨 12 новых скинов + 5 эксклюзивов только с рынка',
      '⭐ Престиж: +25% к выплатам навсегда за каждый круг',
    ],
    '2.0.1': [
      'Отсчёт до следующего счастливого часа — плашка 🔥 в «Номерах» видна всегда',
    ],
    '2.0.0': [
      'Новая экономика: выплаты выросли, крутить номера выгодно — баланс растёт',
      'Ставки ×25, ×50 и ×100 через «Высокие ставки»',
      '🔥 Счастливый час: раз в 20–40 минут все выплаты ×2',
      'Гараж до 40 монет в минуту, работа платит в 4 раза больше',
      'Колесо до 2 500, заказы, уровни и задания щедрее, задания на 100 000 и миллион',
      'Кейсы убраны — инвентарь продан, всем подарок +1 000',
    ],
    '1.9.0': [
      'Онлайн-батл до 4 игроков: банк = ставка × игроки, забирает самый блатной номер',
      '3D-наклон номера за курсором с бликом и северное сияние цвета редкости',
    ],
    '1.8.0': [
      'Онлайн-батл с кентами: создай комнату, скинь код — и рубитесь номерами',
      'Честный результат: номера считаются из случайных чисел обоих игроков',
      'Ники, авы и звания соперников, эмодзи-реакции и счёт против каждого кента',
    ],
    '1.7.0': [
      'Работа: три мини-игры за монеты — оператор камеры, проверка номеров и мойка',
      'Силы восстанавливаются сами, даже когда приложение закрыто',
      'Без денег кнопка «Крутить» сразу ведёт на работу',
    ],
    '1.6.0': [
      'Заказы клиентов: выбей нужный номер — получи награду сверху',
      'Уровни и звания от «Пешехода» до «Смотрящего за ГИБДД»',
      'Прогрессивный джекпот — забирает тот, кто выбьет мифик',
      'Риск ×2 после выигрыша: орёл или решка, до 5 раз подряд',
      'Батл с Ашотом: у кого номер блатнее — забирает ставку',
      'Колесо фортуны вместо ежедневного бонуса и график баланса',
    ],
    '1.5.0': [
      'Рулетка номеров стала игрой: монеты, ставки и выплаты за редкость',
      'Магазин улучшений: связи в ГИБДД, московская прописка, перекупщик, гараж с пассивным доходом, автокрутка ×10',
      'Скины номера: Ночь, Золото, Неон, Голограмма',
      '15 заданий с наградами, ежедневный бонус с серией дней и батя, который выручит, если всё проиграл',
    ],
    '1.4.0': [
      'Рулетка номеров РФ: крути барабаны и выбивай блатные номера — от «Обычного» до «Мифического»',
      'QR-код для любого результата: кнопка в каждой строке, можно сохранить PNG',
      'Автозапуск вместе с Windows — сразу в трей, Ctrl+Shift+Q работает с самого старта',
    ],
    '1.3.0': [
      'Трей: иконка у часов с быстрым меню — пароль, UUID, почта, телефон в один клик',
      'Ctrl+Shift+Q — свежий пароль в буфер из любой программы',
      'Новый раздел «Таблицы»: тестовые данные до 1000 строк в CSV, JSON и SQL',
      'Проверка своего пароля: энтропия, время взлома и подсказки',
      'Тёмная тема — переключается в настройках',
    ],
    '1.2.0': [
      'Окно «Что нового» — теперь после каждого обновления видно, что поменялось',
      'В «Разном» появились генераторы координат и Unix-времени',
      'Проверено автообновление через GitHub-релизы',
    ],
  };

  function showWhatsNew(version) {
    const seen = load('qb.seenVersion', null);
    if (seen === version) return;
    store('qb.seenVersion', version);
    if (!CHANGELOG[version]) return;
    $('#wn-ver').textContent = 'v' + version;
    $('#wn-list').innerHTML = CHANGELOG[version].map((x) => `<li>${esc(x)}</li>`).join('');
    $('#whatsnew').hidden = false;
  }
  $('#wn-ok').onclick = () => { $('#whatsnew').hidden = true; };
  $('#whatsnew').onclick = (e) => { if (e.target.id === 'whatsnew') $('#whatsnew').hidden = true; };

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
    window.qb.updGet().then((u) => { renderUpdate(u); showWhatsNew(u.current); });
    window.qb.onUpdate(renderUpdate);
    $('#upd-check').onclick = () => window.qb.updCheck().then((u) => { if (u.state === 'dev') renderUpdate(u); });
    $('#upd-releases').onclick = () => window.qb.updReleases();
    $('#upd-card-btn').onclick = () => window.qb.updInstall();
  } else {
    renderUpdate({ state: 'dev', current: '1.0.0' });
    $('#upd-check').onclick = () => toast('Обновления работают только в установленном приложении');
  }

  /* ---------------- tables ---------------- */
  const tbCols = new Set(['id', 'full_name', 'email', 'phone', 'city', 'created_at']);
  $('#tb-cols').innerHTML = Object.entries(G.TABLE_COLUMNS)
    .map(([k, c]) => `<button data-v="${k}" class="${tbCols.has(k) ? 'on' : ''}">${c.label}</button>`).join('');
  const syncTbCount = () => ($('#tb-cols-c').textContent = `· ${tbCols.size} ИЗ ${Object.keys(G.TABLE_COLUMNS).length}`);
  syncTbCount();
  $('#tb-cols').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (tbCols.has(b.dataset.v)) tbCols.delete(b.dataset.v);
    else tbCols.add(b.dataset.v);
    b.classList.toggle('on', tbCols.has(b.dataset.v));
    syncTbCount();
  };
  const tbFormat = seg($('#tb-format'), (v) => ($('#tb-table-f').hidden = v !== 'sql'));
  const tbLocale = seg($('#tb-locale'));
  const tbRows = range('tb-rows');

  function genTable() {
    // порядок колонок — как на экране, а не как кликали
    const cols = Object.keys(G.TABLE_COLUMNS).filter((k) => tbCols.has(k));
    if (!cols.length) return toast('Выбери хотя бы одну колонку');
    const fmt = tbFormat(), n = tbRows();
    const rows = G.tableRows(cols, n, tbLocale());
    const text = G.formatTable(rows, cols, fmt, $('#tb-table').value);
    const preview = rows.slice(0, 30);
    const box = $('#tb-results');
    box.innerHTML = `
      <div class="res-head">
        <h3>${n} строк · ${fmt.toUpperCase()}</h3>
        <span class="count">${(new Blob([text]).size / 1024).toFixed(1)} КБ</span>
        <button class="pill pill-white" data-a="copy">Копировать</button>
        <button class="pill pill-dark" data-a="save">Сохранить файл</button>
      </div>
      <div class="tb-wrap">
        <table class="tb">
          <thead><tr><th>#</th>${cols.map((k) => `<th>${k}</th>`).join('')}</tr></thead>
          <tbody>${preview.map((r, i) => `<tr><td>${i + 1}</td>${cols.map((k) => `<td>${esc(r[k])}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
      </div>
      ${n > preview.length ? `<div class="tb-more">+ ещё ${n - preview.length} строк в файле</div>` : ''}`;
    box.onclick = (e) => {
      const a = e.target.closest('[data-a]');
      if (a?.dataset.a === 'copy') copy(text);
      if (a?.dataset.a === 'save') save(`${$('#tb-table').value.replace(/[^\w-]/g, '') || 'data'}.${fmt}`, text);
    };
    stats.gen += n;
    session += n;
    persist();
    renderStats();
  }
  $('#tb-gen').onclick = genTable;

  /* ---------------- theme ---------------- */
  const sysDark = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const t = settings.theme === 'system' ? (sysDark.matches ? 'dark' : 'light') : settings.theme;
    document.documentElement.dataset.theme = t;
  }
  const themeSeg = $('#set-theme');
  $$('button', themeSeg).forEach((b) => b.classList.toggle('on', b.dataset.v === settings.theme));
  seg(themeSeg, (v) => { settings.theme = v; persist(); applyTheme(); });
  sysDark.addEventListener('change', applyTheme);
  applyTheme();

  /* ---------------- tray / hotkey ---------------- */
  // Main-процесс просит сгенерировать что-то из трея или по горячей клавише
  const QUICK_GEN = {
    password: () => ['pw', 'Символы', G.password({ length: 20 }), 'Пароль'],
    uuid: () => ['key', 'UUID v4', G.uuid4(), 'UUID'],
    email: () => ['em', 'Почта', G.email(), 'Почта'],
    phone: () => ['ph', 'Россия', G.phone('RU'), 'Телефон'],
  };
  if (window.qb && window.qb.onQuickGen) {
    window.qb.onQuickGen((kind) => {
      const q = QUICK_GEN[kind];
      if (!q) return;
      const [type, sub, value, title] = q();
      copy(value, true);
      record(type, sub, [value]);
      const shown = type === 'pw' && settings.mask ? '•'.repeat(12) : value;
      window.qb.notify(`${title} в буфере обмена`, shown);
    });
  }

  /* ---------------- QR ---------------- */
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  let qrValue = '';

  function qrMatrix(text) {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q;
  }

  function showQR(text) {
    let q;
    try {
      q = qrMatrix(text);
    } catch {
      return toast('Слишком длинно для QR-кода');
    }
    qrValue = text;
    const n = q.getModuleCount(), pad = 2, size = n + pad * 2;
    let cells = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (q.isDark(r, c)) cells += `<rect x="${c + pad}" y="${r + pad}" width="1.02" height="1.02" rx=".28"/>`;
      }
    }
    $('#qr-box').innerHTML = `<svg viewBox="0 0 ${size} ${size}" shape-rendering="geometricPrecision"><rect width="${size}" height="${size}" fill="#fff" rx="2"/><g fill="#111">${cells}</g></svg>`;
    $('#qr-text').textContent = text.length > 160 ? text.slice(0, 160) + '…' : text;
    $('#qr-modal').hidden = false;
  }

  function qrPng(text, px = 768) {
    const q = qrMatrix(text);
    const n = q.getModuleCount(), pad = 3, cell = Math.floor(px / (n + pad * 2));
    const c = document.createElement('canvas');
    c.width = c.height = cell * (n + pad * 2);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) {
      if (q.isDark(r, col)) g.fillRect((col + pad) * cell, (r + pad) * cell, cell, cell);
    }
    return c.toDataURL('image/png');
  }

  const closeQR = () => { $('#qr-modal').hidden = true; };
  $('#qr-close').onclick = closeQR;
  $('#qr-modal').onclick = (e) => { if (e.target.id === 'qr-modal') closeQR(); };
  $('#qr-copy').onclick = () => copy(qrValue);
  $('#qr-save').onclick = async () => {
    const url = qrPng(qrValue);
    if (window.qb && window.qb.savePng) {
      if (await window.qb.savePng('qr-code.png', url)) toast('QR сохранён');
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.download = 'qr-code.png';
      a.click();
    }
  };
  $('#q-out').parentElement.addEventListener('dblclick', () => { if (qVal) showQR(qVal); });

  /* ---------------- plates ---------------- */
  const P = window.Plates;
  const PL_DEFAULT = {
    spins: 0, best: [], coins: 500, upgrades: {}, skins: ['classic'], skin: 'classic', quests: {},
    tiers: {}, flags: {}, bestWin: 0, won: 0, spent: 0, daily: { last: '', streak: 0 },
    garageTs: Date.now(), batyaTs: 0, bet: 1,
    xp: 0, level: 1, orders: [], jackpot: P.JACKPOT_SEED, hist: [], duels: { w: 0, l: 0 },
    happyUntil: 0, happyNext: 0,
    tuning: { owned: [], eq: {} }, styleNow: 0, gems: 0, extraSlots: 0, fleet: [],
    keys: [], keyEq: [], items: {}, prestige: 0, market: { w: 0, bought: {}, rerolls: 0 }, talonActive: false, x3Left: 0,
  };
  const plSaved = load('qb.plates', null);
  const plState = Object.assign({}, PL_DEFAULT, plSaved || {});
  if (!plSaved) plState.econ2 = true; // новым игрокам подарок за переход не нужен
  // Переход на новую экономику: кейсы убраны — инвентарь продаём, плюс подарок
  if (!plState.econ2) {
    const inv = (plState.inv || []).reduce((sum, x) => sum + (x.value || 0), 0);
    plState.coins += inv + 1000;
    plState.inv = [];
    plState.econ2 = true;
    if (plState.jackpot < P.JACKPOT_SEED) plState.jackpot = P.JACKPOT_SEED;
    store('qb.plates', plState);
    setTimeout(() => toast(`Экономика обновлена: подарок +1 000${inv ? ` и инвентарь продан за ${inv.toLocaleString('ru-RU')}` : ''}`), 1500);
  }
  let plCurrent = null, plSpinning = false, plAuto = false, riskPot = 0, riskStep = 0;

  const lvl = (id) => plState.upgrades[id] || 0;
  const upg = (id) => P.UPGRADES.find((u) => u.id === id);
  // суммарный буст надетых брелков по типу
  const keySlots = () => P.KEY_SLOTS + (plState.extraSlots || 0);
  const kb = (type) => plState.keyEq.reduce((sum, id) => sum + (((P.KEYCHAINS.find((k) => k.id === id) || {}).boost || {})[type] || 0), 0)
    + (((P.CARS.find((c) => c.id === plState.car) || {}).boost || {})[type] || 0)
    + (type === 'pay' ? (plState.cars || []).length * P.CAR_COLLECTION_BONUS : 0);
  // стиль надетых обвесов тюнинга: каждые 5 очков = +1% к выплатам
  const styleNow = () => Object.values(plState.tuning.eq).reduce((sum, id) => {
    const t = P.TUNING.find((x) => x.id === id);
    return sum + (t ? P.tuningStyle(t) : 0);
  }, 0);
  const luckChance = () => (lvl('luck') * upg('luck').per + kb('luck')) / 100;
  const moscowChance = () => (lvl('moscow') * upg('moscow').per + kb('moscow')) / 100;
  const payMult = () => 1 + (lvl('collector') * upg('collector').per + kb('pay') + plState.prestige * P.PRESTIGE_BONUS + styleNow() / P.STYLE_DIV) / 100;
  const spinCost = () => P.SPIN_COST * plState.bet;
  // Оценка отдачи по результатам симуляций (на 1 млн круток)
  // оценка отдачи по симуляциям: база 123%, удача и Москва поднимают шанс редких номеров
  const rtp = () => Math.round(123 * payMult() * (1 + luckChance() * 1.07) * (1 + moscowChance() * 1.75));
  // значение улучшения на уровне l: таблица values или шаг per
  const upVal = (u, l) => (u.values ? u.values[l - 1] : +(l * u.per).toFixed(1));

  /* --- счастливый час: раз в 20–40 минут на 3 минуты выплаты ×2 --- */
  const HAPPY_LEN = 3 * 60000;
  const happyLen = () => HAPPY_LEN + kb('happy') * 60000;
  const happyActive = () => Date.now() < plState.happyUntil;
  function checkHappy() {
    const now = Date.now();
    if (!plState.happyNext) plState.happyNext = now + G.rnd.int(5, 15) * 60000;
    if (!happyActive() && now >= plState.happyNext) {
      plState.happyUntil = now + happyLen();
      plState.happyNext = plState.happyUntil + G.rnd.int(20, 40) * 60000;
      savePl();
      toast('🔥 СЧАСТЛИВЫЙ ЧАС: 3 минуты все выплаты ×2!');
    }
    const b = $('#pl-happy');
    if (!b) return;
    // плашка видна всегда: идёт ×2 или отсчёт до следующего
    const on = happyActive();
    const left = (on ? plState.happyUntil : plState.happyNext) - now;
    const mm = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
    b.classList.toggle('wait', !on);
    b.title = on ? 'Счастливый час: все выплаты ×2' : 'До следующего счастливого часа';
    $('#pl-happy-l').textContent = on ? '🔥 ×2 ·' : '🔥 через';
    $('#pl-happy-t').textContent = mm;
  }
  setInterval(checkHappy, 1000);

  // Короткая запись больших сумм: 1,25 млн
  function fmtShort(n) {
    if (n >= 1e9) return (n / 1e9).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' млрд';
    if (n >= 1e6) return (n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' млн';
    return Math.floor(n).toLocaleString('ru-RU');
  }
  const fmt = (n) => Math.floor(n).toLocaleString('ru-RU');
  const savePl = () => store('qb.plates', plState);

  function setCoins(delta) {
    plState.coins = Math.max(0, plState.coins + delta);
    savePl();
    renderWallet();
  }

  const garageRate = () => (lvl('garage') ? upVal(upg('garage'), lvl('garage')) * (1 + kb('garage') / 100) : 0);

  // аренда: номера автопарка + понемногу лучшие номера коллекции
  const rentRate = () => plState.fleet.reduce((sum, f) => sum + P.fleetRent(f.total), 0)
    + plState.best.reduce((sum, b) => sum + P.collectionRent(b.total), 0);

  /* --- гараж и аренда: пассивный доход, в том числе пока приложение закрыто --- */
  function tickGarage(silent) {
    const rate = garageRate() + rentRate();
    const now = Date.now();
    if (!rate) { plState.garageTs = now; return 0; }
    const minutes = Math.min((now - plState.garageTs) / 60000, 720);
    const whole = Math.floor(minutes);
    if (whole < 1) return 0;
    const gain = Math.round(whole * rate);
    plState.garageTs = now - (minutes - whole) * 60000;
    plState.coins += gain;
    savePl();
    renderWallet();
    if (!silent && gain >= 10) toast(`Гараж и аренда принесли +${fmt(gain)} монет`);
    return gain;
  }

  /* --- ежедневный бонус --- */
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  function dailyInfo() {
    const today = dayKey();
    if (plState.daily.last === today) return null;
    const y = new Date(); y.setDate(y.getDate() - 1);
    const streak = plState.daily.last === dayKey(y) ? plState.daily.streak + 1 : 1;
    return { streak, reward: 50 + 10 * Math.min(streak - 1, 10) };
  }
  /* --- колесо фортуны раз в день --- */
  const WHEEL_COLORS = ['#e4f07e', '#8ed3c6', '#e2a6c6', '#b6b0e6', '#f0d77a', '#e8b48c', '#8ed3c6', '#ff4d6d'];
  let wheelAngle = 0, wheelBusy = false;
  function drawWheel() {
    const n = P.WHEEL.length, R = 100, seg = (2 * Math.PI) / n;
    const parts = P.WHEEL.map((v, i) => {
      const a0 = i * seg - Math.PI / 2, a1 = a0 + seg;
      const x0 = 110 + R * Math.cos(a0), y0 = 110 + R * Math.sin(a0);
      const x1 = 110 + R * Math.cos(a1), y1 = 110 + R * Math.sin(a1);
      const am = a0 + seg / 2, tx = 110 + R * 0.66 * Math.cos(am), ty = 110 + R * 0.66 * Math.sin(am);
      return `<path d="M110 110 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z" fill="${WHEEL_COLORS[i]}" stroke="#111" stroke-width="1.5"/>
        <text x="${tx}" y="${ty}" transform="rotate(${(am * 180) / Math.PI + 90} ${tx} ${ty})">${v}</text>`;
    }).join('');
    $('#wheel-svg').innerHTML = `<g id="wheel-rot">${parts}<circle cx="110" cy="110" r="16" fill="#111"/></g>`;
  }
  $('#pl-daily').onclick = () => {
    const d = dailyInfo();
    if (!d) return;
    drawWheel();
    $('#wheel-streak').textContent = `Серия: ${d.streak} дн. · множитель ×${(1 + 0.1 * Math.min(d.streak - 1, 10)).toFixed(1)}`;
    $('#wheel-res').textContent = '';
    $('#wheel-go').hidden = false;
    $('#wheel-modal').hidden = false;
  };
  $('#wheel-go').onclick = () => {
    const d = dailyInfo();
    if (!d || wheelBusy) return;
    wheelBusy = true;
    $('#wheel-go').hidden = true;
    const n = P.WHEEL.length, i = G.rnd.int(0, n - 1), seg = 360 / n;
    // крутим так, чтобы под стрелкой (сверху) оказался сектор i
    wheelAngle += 360 * 6 + (360 - (wheelAngle % 360)) - (i * seg + seg / 2) + G.rnd.int(-12, 12);
    const rot = $('#wheel-rot');
    rot.style.transition = 'transform 4.2s cubic-bezier(.12, .7, .1, 1)';
    rot.style.transform = `rotate(${wheelAngle}deg)`;
    setTimeout(() => {
      const reward = Math.round(P.WHEEL[i] * (1 + 0.1 * Math.min(d.streak - 1, 10)));
      plState.daily = { last: dayKey(), streak: d.streak };
      const wg = d.streak % 7 === 0 ? 5 : 1;
      plState.gems = (plState.gems || 0) + wg;
      setCoins(reward);
      $('#wheel-res').innerHTML = `Выпало <b>${P.WHEEL[i]}</b> → <b><i class="coin"></i>${reward}</b> · <b><i class="gem"></i>+${wg}</b>`;
      floatWin(`+${reward}`, '#f0b35a');
      wheelBusy = false;
      renderWallet();
    }, 4300);
  };
  $('#wheel-close').onclick = () => { if (!wheelBusy) $('#wheel-modal').hidden = true; };

  /* --- батя выручит, если всё проиграл --- */
  $('#pl-batya').onclick = () => {
    if (Date.now() - plState.batyaTs < 10 * 60000) {
      const left = Math.ceil((10 * 60000 - (Date.now() - plState.batyaTs)) / 60000);
      return toast(`Батя сказал: «Через ${left} мин приходи»`);
    }
    plState.batyaTs = Date.now();
    setCoins(30);
    toast('Батя дал 30 монет. Не проиграй всё сразу');
  };

  function renderSpark() {
    const h = plState.hist;
    if (h.length < 2) { $('#pl-spark').innerHTML = ''; return; }
    const min = Math.min(...h), max = Math.max(...h), span = max - min || 1;
    const pts = h.map((v, i) => `${(i / (h.length - 1)) * 120},${28 - ((v - min) / span) * 26}`).join(' ');
    const up = h[h.length - 1] >= h[0];
    $('#pl-spark').innerHTML = `<polyline points="${pts}" fill="none" stroke="${up ? '#5fc2ae' : '#e5484d'}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`;
  }

  function renderLevel() {
    const need = P.xpNeed(plState.level);
    $('#pl-lvl').textContent = plState.level;
    $('#pl-title').textContent = (plState.prestige ? `★${plState.prestige} ` : '') + P.titleFor(plState.level);
    $('#pl-xp').style.width = Math.min(100, (plState.xp / need) * 100) + '%';
    $('#pl-xp-t').textContent = `${plState.xp} / ${need} XP`;
  }

  function addXp(n) {
    plState.xp += n;
    while (plState.xp >= P.xpNeed(plState.level)) {
      plState.xp -= P.xpNeed(plState.level);
      plState.level++;
      const r = P.levelReward(plState.level), g = plState.level % 10 === 0 ? 5 : 1;
      plState.coins += r;
      plState.gems = (plState.gems || 0) + g;
      toast(`Уровень ${plState.level}: «${P.titleFor(plState.level)}» · +${r} и 💎 +${g}`);
    }
  }

  function renderWallet() {
    $('#pl-coins').textContent = fmtShort(plState.coins);
    $('#pl-coins').title = fmt(plState.coins);
    $('#pl-jp').textContent = fmt(plState.jackpot);
    $('#pl-gems').textContent = fmt(plState.gems || 0);
    renderLevel();
    renderSpark();
    $('#pl-spins').textContent = fmt(plState.spins);
    $('#pl-rtp').textContent = rtp() + '%';
    const d = dailyInfo();
    $('#pl-daily').hidden = !d;
    if (d) $('#pl-daily-t').textContent = `Бонус дня +${d.reward}`;
    $('#pl-cost').innerHTML = `<i class="coin"></i>${fmt(spinCost())}`;
    const broke = plState.coins < spinCost();
    $('#pl-spin').classList.toggle('broke', broke);
    $('#pl-spin span').textContent = broke ? '💼 РАБОТАТЬ' : 'КРУТИТЬ';
    $('#pl-cost').hidden = broke;
    $('#pl-batya').hidden = !(plState.coins < P.SPIN_COST);
    $('#pl-auto').hidden = !lvl('auto');
    if (lvl('auto')) $('#pl-auto').textContent = `×${upVal(upg('auto'), lvl('auto'))}`;
    renderBets();
  }

  function renderBets() {
    const bets = P.BETS.filter((b) => b <= P.BET_UNLOCK[lvl('highroller')]);
    if (!bets.includes(plState.bet)) plState.bet = 1;
    const cost = (v) => (v >= 1000 ? `${v / 1000}к` : v);
    // компактный переключатель: ‹ ×100 · 1к › и MAX — влезает при любом числе ставок
    const i = bets.indexOf(plState.bet);
    $('#pl-bet').innerHTML = `
      <button data-d="-1" ${i <= 0 ? 'disabled' : ''}>‹</button>
      <span class="bet-cur">×${plState.bet} <small>· ${cost(plState.bet * P.SPIN_COST)}</small></span>
      <button data-d="1" ${i >= bets.length - 1 ? 'disabled' : ''}>›</button>
      <button data-max="1" class="bet-max" ${i >= bets.length - 1 ? 'disabled' : ''}>MAX</button>
      <button data-min="1" class="bet-max" ${i <= 0 ? 'disabled' : ''}>MIN</button>`;
  }
  $('#pl-bet').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled || plSpinning) return;
    const bets = P.BETS.filter((x) => x <= P.BET_UNLOCK[lvl('highroller')]);
    const i = bets.indexOf(plState.bet);
    plState.bet = b.dataset.max ? bets[bets.length - 1] : b.dataset.min ? bets[0] : bets[Math.max(0, Math.min(bets.length - 1, i + +b.dataset.d))];
    savePl();
    renderWallet();
    renderOdds();
  };

  /* --- шансы --- */
  function fmtOdds(pr) {
    if (pr >= 0.1) return `${Math.round(pr * 100)}%`;
    return `1 из ${Math.round(1 / pr).toLocaleString('ru-RU')}`;
  }
  function renderOdds() {
    $('#pl-odds').innerHTML = [...P.TIERS].reverse().map((t) => `
      <div class="pl-odd" style="--t:${t.color}">
        <i></i><span>${t.name}</span><small>${fmtOdds(P.ODDS[t.id])}</small>
        <b><i class="coin"></i>${fmtShort(Math.round(P.PAYOUT[t.id] * plState.bet * payMult()))}</b>
      </div>`).join('');
  }

  /* --- магазин --- */
  function renderShop() {
    const ups = P.UPGRADES.map((u) => {
      const l = lvl(u.id), max = u.prices.length, price = u.prices[l];
      const now = upVal(u, l), next = upVal(u, l + 1);
      const text = max === 1 ? u.desc() : l ? `${u.desc(now)}${l < max ? ` → ${next}` : ''}` : u.desc(next);
      return `
        <div class="shop-item ${l >= max ? 'maxed' : ''}">
          <div class="shop-ico">${u.icon}</div>
          <div class="shop-body">
            <div class="shop-name">${u.name}${max > 1 ? `<span class="pips">${Array.from({ length: max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</span>` : ''}</div>
            <div class="shop-desc">${text}</div>
          </div>
          ${l >= max
            ? `<span class="shop-max">${max === 1 ? 'КУПЛЕНО' : 'МАКС'}</span>`
            : `<button class="shop-buy" data-up="${u.id}" ${plState.coins < price ? 'disabled' : ''}><i class="coin"></i>${fmt(price)}</button>`}
        </div>`;
    }).join('');
    const skins = P.SKINS.filter((sk) => (!sk.market && !sk.gems) || plState.skins.includes(sk.id)).map((sk) => {
      const owned = plState.skins.includes(sk.id), active = plState.skin === sk.id;
      return `
        <button class="skin-card ${active ? 'on' : ''}" data-skin="${sk.id}" ${!owned && plState.coins < sk.price ? 'disabled' : ''}>
          <span class="mini-plate skin-${sk.id}"><b>А777МР</b><em>77</em></span>
          <span class="skin-name">${sk.name}</span>
          <span class="skin-price">${active ? 'ВЫБРАН' : owned ? 'НАДЕТЬ' : `<i class="coin"></i>${fmt(sk.price)}`}</span>
        </button>`;
    }).join('');
    const need = P.prestigeNeed(plState.prestige);
    const prestigeHTML = `
      <div class="prestige">
        <div class="prestige-top"><b>⭐ Престиж ${plState.prestige}</b><span>+${plState.prestige * P.PRESTIGE_BONUS}% к выплатам навсегда</span></div>
        <div class="quest-bar"><i style="width:${Math.min(100, (plState.coins / need) * 100)}%"></i></div>
        <small>Нужно ${fmtShort(need)} · обнулит баланс и улучшения, скины, брелки и уровень останутся. Следующий: +${(plState.prestige + 1) * P.PRESTIGE_BONUS}%</small>
        <button class="shop-buy" id="pl-prestige" ${plState.coins < need ? 'disabled' : ''}>Уйти в престиж</button>
      </div>`;
    $('#pl-shop').innerHTML = prestigeHTML + `
      <span class="cap">УЛУЧШЕНИЯ</span>
      <div class="shop-list">${ups}</div>
      <span class="cap">СКИНЫ НОМЕРА <span class="dim-cap">· ТОЛЬКО КРАСОТА</span></span>
      <div class="skins">${skins}</div>`;
  }
  let prestigeArm = 0;
  $('#pl-shop').onclick = (e) => {
    const pb = e.target.closest('#pl-prestige');
    if (pb) {
      if (plState.coins < P.prestigeNeed(plState.prestige)) return;
      if (Date.now() - prestigeArm > 3000) {
        prestigeArm = Date.now();
        pb.textContent = 'Точно? Нажми ещё раз';
        return;
      }
      plState.prestige++;
      plState.gems = (plState.gems || 0) + 50;
      Object.assign(plState, { coins: 500, upgrades: {}, bet: 1, orders: [], hist: [500] });
      savePl();
      toast(`⭐ Престиж ${plState.prestige}! Теперь +${plState.prestige * P.PRESTIGE_BONUS}% ко всем выплатам`);
      burst('#f0c552', 80);
      return refreshPlates();
    }
    const b = e.target.closest('[data-up]');
    if (b) {
      const u = upg(b.dataset.up), l = lvl(u.id), price = u.prices[l];
      if (price == null || plState.coins < price) return;
      plState.upgrades[u.id] = l + 1;
      if (u.id === 'garage' && !l) plState.garageTs = Date.now();
      setCoins(-price);
      toast(`${u.name}: уровень ${l + 1}`);
      return refreshPlates();
    }
    const s = e.target.closest('[data-skin]');
    if (s) {
      const sk = P.SKINS.find((x) => x.id === s.dataset.skin);
      if (!plState.skins.includes(sk.id)) {
        if (plState.coins < sk.price) return;
        plState.skins.push(sk.id);
        setCoins(-sk.price);
        toast(`Скин «${sk.name}» куплен`);
      }
      plState.skin = sk.id;
      savePl();
      refreshPlates();
    }
  };

  /* --- заказы клиентов --- */
  function ensureOrders() {
    const now = Date.now();
    plState.orders = plState.orders.filter((o) => o.expires > now);
    while (plState.orders.length < 2) plState.orders.push(P.makeOrder());
  }
  const ORDER_REROLL = 15;
  function renderOrders() {
    ensureOrders();
    const now = Date.now();
    $('#pl-orders').innerHTML = plState.orders.map((o, i) => {
      const left = Math.max(0, o.expires - now), m = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
      return `
        <div class="order">
          <div class="order-top"><span class="order-client">${o.client}</span><span class="order-time">⏱ ${m}:${String(sec).padStart(2, '0')}</span></div>
          <div class="order-text">${o.text}</div>
          <div class="order-bottom">
            <b><i class="coin"></i>${fmt(o.reward)}</b>
            <button class="order-reroll" data-o="${i}" ${plState.coins < ORDER_REROLL ? 'disabled' : ''} title="Другой заказ">↻ <i class="coin"></i>${ORDER_REROLL}</button>
          </div>
        </div>`;
    }).join('') + '<div class="note">Выбей подходящий номер — получишь награду сверху выигрыша. Заказ сгорает через 20 минут.</div>';
    $('#pl-ostrip').innerHTML = plState.orders.map((o) => `<span class="ostrip" title="${o.client}"><em>📦</em>${o.text}<b><i class="coin"></i>${fmt(o.reward)}</b></span>`).join('');
  }
  $('#pl-orders').onclick = (e) => {
    const b = e.target.closest('[data-o]');
    if (!b || plState.coins < ORDER_REROLL) return;
    plState.orders[+b.dataset.o] = P.makeOrder();
    setCoins(-ORDER_REROLL);
    renderOrders();
  };
  setInterval(() => { if (current === 'plates') renderOrders(); }, 1000);

  /* --- задания --- */
  function claimable() {
    return P.QUESTS.filter((q) => q.done(plState) && !plState.quests[q.id]).length;
  }
  function renderQuests() {
    const list = [...P.QUESTS].sort((a, b) => {
      const st = (q) => (plState.quests[q.id] ? 2 : q.done(plState) ? 0 : 1);
      return st(a) - st(b);
    });
    $('#pl-quests').innerHTML = periodicHTML() + list.map((q) => {
      const done = q.done(plState), got = plState.quests[q.id];
      const pr = !done && q.progress ? q.progress(plState) : null;
      return `
        <div class="quest ${got ? 'got' : done ? 'ready' : ''}">
          <div class="quest-body">
            <div class="quest-name">${q.name}</div>
            ${pr ? `<div class="quest-bar"><i style="width:${Math.min(100, (pr[0] / pr[1]) * 100)}%"></i></div><small>${fmt(pr[0])} / ${fmt(pr[1])}</small>` : ''}
          </div>
          ${got ? '<span class="quest-done">✓</span>'
            : done ? `<button class="shop-buy claim" data-q="${q.id}">Забрать <i class="coin"></i>${fmt(q.reward)} <i class="gem"></i>${P.questGems(q)}</button>`
              : `<span class="quest-reward"><i class="coin"></i>${fmtShort(q.reward)} · <i class="gem"></i>${P.questGems(q)}</span>`}
        </div>`;
    }).join('');
    const n = claimable() + [...plState.dq.list, ...plState.wq.list].filter((q) => !q.claimed && q.progress >= q.target).length;
    $('#pl-qbadge').hidden = !n;
    $('#pl-qbadge').textContent = n;
  }
  $('#pl-quests').onclick = (e) => {
    const dq = e.target.closest('[data-dq]'), wq = e.target.closest('[data-wq]');
    if (dq) return claimPeriodic(false, +dq.dataset.dq);
    if (wq) return claimPeriodic(true, +wq.dataset.wq);
    if (e.target.closest('#pl-season-open')) { renderSeasonModal(); $('#season-modal').hidden = false; return; }
    const b = e.target.closest('[data-q]');
    if (!b) return;
    const q = P.QUESTS.find((x) => x.id === b.dataset.q);
    if (!q.done(plState) || plState.quests[q.id]) return;
    plState.quests[q.id] = Date.now();
    plState.gems = (plState.gems || 0) + P.questGems(q);
    setCoins(q.reward);
    floatWin(`+${fmt(q.reward)}`, '#5fc2ae');
    toast(`Задание «${q.name}»: +${fmt(q.reward)}`);
    refreshPlates();
  };

  /* --- коллекция --- */
  const plateHTML = (p) => `<span class="mini-plate"><b>${p.l1}${p.digits}${p.l2}</b><em>${p.region}</em></span>`;
  function renderBest() {
    const fleetSum = plState.fleet.reduce((sum, f) => sum + P.fleetRent(f.total), 0);
    const colSum = plState.best.reduce((sum, b) => sum + P.collectionRent(b.total), 0);
    const fleet = `
      <div class="fleet-head"><b>🚗 Автопарк</b><span>аренда +${fmt(fleetSum)}/мин</span></div>
      ${plState.fleet.length ? plState.fleet.map((f) => {
        const t = P.TIERS.find((x) => x.id === f.tier);
        return `<div class="pl-best-row fleet" style="--t:${t.color}">${plateHTML(f.p)}<span class="pl-best-tier">${t.name}</span><b>+${P.fleetRent(f.total)}/мин</b></div>`;
      }).join('') : '<div class="note">Выигрывай номера на 🔨 аукционе — они приносят аренду</div>'}
      <div class="fleet-head"><b>🏆 Коллекция</b><span>аренда +${colSum.toFixed(1)}/мин</span></div>`;
    if (!plState.best.length) {
      $('#pl-best').innerHTML = fleet + `<div class="feed-empty"><div class="sparkle">✦</div><br>ЛУЧШИЕ НОМЕРА БУДУТ ТУТ</div>`;
      return;
    }
    $('#pl-best').innerHTML = fleet + plState.best.map((b, i) => {
      const t = P.TIERS.find((x) => x.id === b.tier);
      return `<div class="pl-best-row" data-i="${i}" style="--t:${t.color}" title="Нажми, чтобы скопировать">
        ${plateHTML(b.p)}<span class="pl-best-tier">${t.name}</span><b>${b.total}</b></div>`;
    }).join('');
  }
  $('#pl-best').onclick = (e) => {
    const r = e.target.closest('.pl-best-row');
    if (r) copy(P.format(plState.best[r.dataset.i].p));
  };
  $('#pl-reset').onclick = () => {
    plState.best = [];
    savePl();
    renderBest();
    toast('Коллекция очищена');
  };

  const plTab = seg($('#pl-tabs'), (v) => {
    $$('.pl-panel').forEach((p) => (p.hidden = p.dataset.tab !== v));
  });

  function refreshPlates() {
    $('#plate').className = `plate skin-${plState.skin}`;
    applyTuning($('#pl-tilt'), plState.tuning.eq);
    renderWallet();
    renderOrders();
    renderShop();
    renderQuests();
    renderBest();
    renderOdds();
  }

  /* --- анимация --- */
  function spinReel(reel, finalSym, pool, steps, dur) {
    const strip = $('.strip', reel);
    const h = reel.clientHeight;
    const cur = strip.lastElementChild ? strip.lastElementChild.textContent : finalSym;
    const syms = [cur];
    for (let i = 0; i < steps; i++) syms.push(pool());
    syms.push(finalSym);
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0)';
    strip.innerHTML = syms.map((x) => `<b>${x}</b>`).join('');
    void strip.offsetHeight; // перезапуск анимации
    reel.classList.add('moving');
    strip.style.transition = `transform ${dur}ms cubic-bezier(.12, .78, .18, 1.04)`;
    strip.style.transform = `translateY(-${(syms.length - 1) * h}px)`;
    return new Promise((res) => setTimeout(() => {
      reel.classList.remove('moving');
      // оставляем в ленте только итоговый символ, чтобы DOM не рос
      strip.style.transition = 'none';
      strip.style.transform = 'translateY(0)';
      strip.innerHTML = `<b>${finalSym}</b>`;
      reel.classList.add('landed');
      setTimeout(() => reel.classList.remove('landed'), 250);
      res();
    }, dur + 30));
  }

  function burst(color, count) {
    const stage = $('#pl-card');
    const rect = $('#plate').getBoundingClientRect(), base = stage.getBoundingClientRect();
    const cx = rect.left - base.left + rect.width / 2, cy = rect.top - base.top + rect.height / 2;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('i');
      el.className = 'spark';
      const ang = Math.random() * Math.PI * 2, dist = 120 + Math.random() * 260;
      el.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.cos(ang) * dist}px;--dy:${Math.sin(ang) * dist * .7}px;--c:${Math.random() < .5 ? color : '#fff'};--s:${4 + Math.random() * 7}px;animation-delay:${Math.random() * 120}ms`;
      stage.appendChild(el);
      setTimeout(() => el.remove(), 1400);
    }
  }

  function floatWin(text, color) {
    const w = $('#pl-win');
    w.textContent = text;
    w.style.setProperty('--c', color);
    w.classList.remove('go');
    void w.offsetWidth;
    w.classList.add('go');
  }

  /* --- риск ×2: честные 50/50 --- */
  function showRiskBtn() {
    const b = $('#pl-risk-btn');
    b.hidden = !(riskPot >= 10 && riskStep < 5);
    b.innerHTML = `🪙 Риск ×2 <em>→ ${fmtShort(riskPot * 2)}</em>`;
  }
  $('#pl-risk-btn').onclick = () => {
    if (riskPot < 10 || plSpinning) return;
    $('#pl-risk').hidden = false;
    $('#risk-title').innerHTML = `На кону <b><i class="coin"></i>${fmt(riskPot)}</b> — угадаешь, станет ${fmt(riskPot * 2)}`;
    $('#risk-coin').className = 'risk-coin';
    $('#risk-pick').hidden = false;
    $('#risk-after').hidden = true;
  };
  $('#risk-pick').onclick = (e) => {
    const b = e.target.closest('[data-side]');
    if (!b || riskPot < 10) return;
    $('#risk-pick').hidden = true;
    const side = b.dataset.side, res = G.rnd.int(0, 1) ? 'heads' : 'tails';
    const stake = riskPot;
    setCoins(-stake);
    const coin = $('#risk-coin');
    coin.className = 'risk-coin';
    void coin.offsetWidth;
    coin.classList.add('flip-' + res);
    setTimeout(() => {
      riskStep++;
      if (res === side) {
        qev('risk');
        riskPot = stake * 2;
        setCoins(riskPot);
        plState.won += stake;
        plState.bestWin = Math.max(plState.bestWin, riskPot);
        floatWin(`×2 = ${fmt(riskPot)}`, '#5fc2ae');
        $('#risk-title').innerHTML = `Угадал! Теперь <b><i class="coin"></i>${fmt(riskPot)}</b>`;
        $('#risk-again').hidden = riskStep >= 5;
      } else {
        floatWin(`−${fmt(stake)}`, '#e5484d');
        $('#risk-title').innerHTML = 'Не повезло — всё сгорело';
        riskPot = 0;
        $('#risk-again').hidden = true;
      }
      $('#risk-after').hidden = false;
      savePl();
      showRiskBtn();
      refreshPlates();
    }, 1600);
  };
  $('#risk-again').onclick = () => $('#pl-risk-btn').onclick();
  $('#risk-take').onclick = () => { $('#pl-risk').hidden = true; riskPot = 0; showRiskBtn(); };

  /* --- звук рулетки: тихие щелчки ленты, мягкий «тук» на остановке, аккорд по редкости --- */
  if (plState.sound == null) plState.sound = true;
  let actx = null, master = null;
  function audio() {
    if (!plState.sound) return null;
    try {
      if (!actx) {
        actx = new AudioContext();
        master = actx.createGain();
        master.gain.value = 0.55;
        const lp = actx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2600; // срезаем верха, чтобы звук был мягким
        master.connect(lp).connect(actx.destination);
      }
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch { return null; }
  }
  function tone(freq, start, dur, vol, type = 'sine') {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + start;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  const reelTick = (at) => tone(1750 + Math.random() * 250, at, 0.035, 0.022, 'triangle');
  const reelThunk = (at) => { tone(165, at, 0.16, 0.06); tone(330, at, 0.07, 0.018, 'triangle'); };
  // моменты, когда лента проезжает очередной символ — по той же кривой, что у CSS-анимации
  function reelTimes(steps, dur) {
    const [x1, y1, x2, y2] = [0.12, 0.78, 0.18, 1.04];
    const bz = (u, a, b) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
    const out = [];
    let k = 1;
    for (let i = 1; i <= 600 && k <= steps; i++) {
      const u = i / 600;
      if (bz(u, y1, y2) >= k / (steps + 1)) {
        const at = (bz(u, x1, x2) * dur) / 1000;
        if (!out.length || at - out[out.length - 1] >= 0.045) out.push(at); // без «жужжания» в начале
        k++;
      }
    }
    return out;
  }
  // пентатоника: обычный — одна тихая нота, мифик — шесть с переливом сверху
  function resultChime(order) {
    const notes = [523.25, 659.25, 783.99, 880, 1046.5, 1318.5];
    const n = Math.max(1, Math.min(6, order + 1));
    for (let i = 0; i < n; i++) tone(notes[i], i * 0.08, 0.7, order ? 0.035 : 0.02);
    if (order >= 4) for (let i = 0; i < 6; i++) tone(2093 + i * 120, 0.5 + i * 0.05, 0.25, 0.012, 'triangle');
  }
  function renderSoundBtn() {
    const b = $('#pl-sound');
    if (b) { b.textContent = plState.sound ? '🔊' : '🔇'; b.title = plState.sound ? 'Выключить звук' : 'Включить звук'; }
  }

  async function spinPlate(fast) {
    if (plSpinning) return false;
    $('#pl-risk').hidden = true;
    riskPot = 0;
    showRiskBtn();
    const cost = spinCost();
    if (plState.coins < cost) {
      toast(plState.coins < P.SPIN_COST ? 'Монеты кончились — сходи на работу 💼' : 'Не хватает на эту ставку — снизь ставку или поработай');
      return false;
    }
    plSpinning = true;
    $('#pl-spin').disabled = true;
    setCoins(-cost);
    plState.spent += cost;
    plState.jackpot += cost * P.JACKPOT_RATE;

    const card = $('#pl-card');
    card.className = 'card plate-card spinning';
    $('#pl-tier').hidden = true;
    $('#pl-result').classList.remove('show');

    // «Связи в ГИБДД»: иногда крутим дважды и берём лучший
    let p = P.random(moscowChance()), sc = P.score(p), second = false, talon = false;
    if (plState.talonActive) {
      for (let i = 0; i < 5000 && P.TIERS.indexOf(sc.tier) < 2; i++) { p = P.random(moscowChance()); sc = P.score(p); }
      plState.talonActive = false;
      talon = true;
    }
    if (luckChance() && G.rnd.int(0, 9999) < luckChance() * 10000) {
      const p2 = P.random(moscowChance()), sc2 = P.score(p2);
      second = true;
      if (sc2.total > sc.total) { p = p2; sc = sc2; }
    }

    const k = fast ? 0.45 : 1;
    const reels = $$('#plate .reel');
    const finals = [p.l1, p.digits[0], p.digits[1], p.digits[2], p.l2[0], p.l2[1], p.region];
    const pools = reels.map((r) => (r.classList.contains('l') ? () => G.rnd.pick(P.LETTERS)
      : r.classList.contains('d') ? () => G.rnd.pick(P.DIGITS)
        : () => G.rnd.pick(P.REGION_CODES)));
    const reelSteps = reels.map((_, i) => Math.round((14 + i * 4) * k)), reelDur = reels.map((_, i) => Math.round((900 + i * 210) * k));
    // щелчки — по средней цифре, «тук» — на каждой остановке
    if (plState.sound) {
      reelTimes(reelSteps[2], reelDur[2]).forEach(reelTick);
      reelDur.forEach((d) => reelThunk(d / 1000));
    }
    await Promise.all(reels.map((r, i) => spinReel(r, finals[i], pools[i], reelSteps[i], reelDur[i])));

    const t = sc.tier;
    const x3 = plState.x3Left > 0;
    if (x3) plState.x3Left--;
    let win = Math.round(P.PAYOUT[t.id] * plState.bet * payMult() * (happyActive() ? 2 : 1) * (x3 ? 3 : 1));
    const extras = [];
    const gemsWon = P.GEMS_FOR_TIER[t.id] || 0;
    if (gemsWon) {
      plState.gems = (plState.gems || 0) + gemsWon;
      extras.push(`<span class="pl-reason gemchip"><b>💎</b>кристаллы <em>+${gemsWon}</em></span>`);
    }
    if (talon) extras.push('<span class="pl-reason happy"><b>🧿</b>талон удачи</span>');
    if (x3) extras.push(`<span class="pl-reason happy"><b>🔥</b>купон ×3 <em>ещё ${plState.x3Left}</em></span>`);
    if (happyActive()) extras.push('<span class="pl-reason happy"><b>🔥</b>счастливый час <em>×2</em></span>');
    // джекпот уходит мифику
    if (t.id === 'mythic') {
      const jp = Math.floor(plState.jackpot);
      win += jp;
      extras.push(`<span class="pl-reason jp"><b>💎</b>ДЖЕКПОТ <em>+${fmt(jp)}</em></span>`);
      plState.jackpot = P.JACKPOT_SEED;
    }
    // заказы клиентов
    ensureOrders();
    plState.orders = plState.orders.filter((o) => {
      if (!P.orderTest(o, p, sc)) return true;
      win += o.reward;
      qev('order');
      extras.push(`<span class="pl-reason order-done"><b>📦</b>${o.client}: заказ выполнен <em>+${fmt(o.reward)}</em></span>`);
      toast(`Заказ «${o.text}» выполнен: +${fmt(o.reward)}`);
      return false;
    });
    addXp(Math.round((1 + P.TIERS.indexOf(t) * 2) * (1 + kb('xp') / 100)));
    plCurrent = p;
    plState.spins++;
    plState.won += win;
    plState.bestWin = Math.max(plState.bestWin, win);
    plState.tiers[t.id] = (plState.tiers[t.id] || 0) + 1;
    sc.reasons.forEach((r) => { if (r.key) plState.flags[r.key] = true; });
    if (sc.total > 0) {
      plState.best.push({ p, total: sc.total, tier: t.id, ts: Date.now() });
      plState.best.sort((a, b) => b.total - a.total || b.ts - a.ts);
      plState.best = plState.best.slice(0, 15);
    }
    setCoins(win);
    plState.hist.push(plState.coins);
    plState.hist = plState.hist.slice(-60);
    savePl();
    record('misc', 'Номер авто', [P.format(p)]);

    card.className = `card plate-card tier-${t.id}`;
    card.style.setProperty('--tier', t.color);
    $('#pl-tier').hidden = false;
    $('#pl-tier-name').textContent = t.name;
    $('#pl-score').textContent = sc.total;
    $('#pl-region').textContent = `Регион ${p.region} — ${P.REGIONS[p.region]}`;
    const chips = sc.reasons.length
      ? sc.reasons.map((r) => `<span class="pl-reason"><b>${r.label}</b>${r.text}${r.pts ? ` <em>+${r.pts}</em>` : ''}</span>`)
      : ['<span class="pl-reason muted">Ничего особенного — обычный номер</span>'];
    if (second) chips.push('<span class="pl-reason"><b>🤝</b>связи сработали — крутка ×2</span>');
    chips.push(...extras);
    $('#pl-reasons').innerHTML = chips.join('');
    void $('#pl-result').offsetWidth;
    $('#pl-result').classList.add('show');

    const order = P.TIERS.findIndex((x) => x.id === t.id);
    resultChime(order);
    qev('spin');
    qev('bet', cost);
    if (order >= 2) qev('rare');
    if (order >= 3) qev('epic');
    addSP(1);
    floatWin(`+${fmt(win)}`, t.color);
    if (order >= 2) burst(t.color, [0, 0, 18, 34, 60, 90][order]);
    if (order >= 4) toast(`${t.name.toUpperCase()}: ${P.format(p)} · +${fmt(win)}`);
    refreshPlates();
    plSpinning = false;
    $('#pl-spin').disabled = false;
    riskPot = win;
    riskStep = 0;
    showRiskBtn();
    return order;
  }

  async function autoSpin() {
    if (plAuto || plSpinning) return;
    plAuto = true;
    $('#pl-auto').classList.add('running');
    const count = upVal(upg('auto'), lvl('auto'));
    for (let i = 0; i < count && plAuto; i++) {
      const order = await spinPlate(true);
      if (order === false || order >= 4) break; // нет денег или выпала легендарка
      await new Promise((r) => setTimeout(r, 350));
    }
    plAuto = false;
    $('#pl-auto').classList.remove('running');
  }

  /* --- батл: кто выбьет номер блатнее --- */
  const TAUNTS_WIN = ['Ашот: «Слышь, это нечестно!»', 'Ашот: «Ладно, сегодня твой день»', 'Ашот: «Я просто разминался»', 'Ашот: «Реванш, брат, реванш!»'];
  const TAUNTS_LOSE = ['Ашот: «Учись, пока я жив»', 'Ашот: «Номера — это искусство»', 'Ашот: «Приходи ещё, монетки нужны»', 'Ашот: «Хе-хе, гараж мой»'];
  let duelStake = 10, duelBusy = false;
  const STAKE_PRESETS = [10, 100, 1000, 10000, 100000, 1000000];
  // компактная подпись ставки: 10к, 1М
  const stakeLabel = (v) => (v >= 1e6 ? `${+(v / 1e6).toFixed(2)}М` : v >= 1e3 ? `${+(v / 1e3).toFixed(1)}к` : String(v));
  const parseStake = (str) => {
    const m = String(str).toLowerCase().replace(/\s/g, '').replace(',', '.').match(/^(\d+(?:\.\d+)?)(к|k|м|m)?$/);
    if (!m) return 0;
    return Math.floor(+m[1] * (m[2] === 'к' || m[2] === 'k' ? 1e3 : m[2] === 'м' || m[2] === 'm' ? 1e6 : 1));
  };

  function renderDuelStakes() {
    $('#duel-stakes').innerHTML = STAKE_PRESETS.map((v) => `<button data-v="${v}" class="${v === duelStake ? 'on' : ''}" ${plState.coins < v ? 'disabled' : ''}>${stakeLabel(v)}</button>`).join('');
    $('#duel-go').innerHTML = `В бой · <i class="coin"></i>${fmt(duelStake)} <i>›</i>`;
    $('#duel-rec').textContent = `Счёт: ты ${plState.duels.w} — ${plState.duels.l} Ашот · в банке у тебя ${fmtShort(plState.coins)}`;
  }
  function setDuelStake(v) {
    if (duelBusy) return;
    if (!(v >= 1)) return toast('Введи сумму, например 25000 или 25к');
    if (v > plState.coins) return toast('Столько монет нет');
    duelStake = v;
    $('#duel-custom').value = '';
    renderDuelStakes();
  }
  $('#duel-stakes').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    setDuelStake(+b.dataset.v);
  };
  $('#duel-custom-ok').onclick = () => setDuelStake(parseStake($('#duel-custom').value));
  $('#duel-custom').onkeydown = (e) => { if (e.key === 'Enter') $('#duel-custom-ok').click(); };
  $('#duel-allin').onclick = () => setDuelStake(Math.floor(plState.coins));
  $('#pl-duel').onclick = () => {
    if (duelStake > plState.coins) duelStake = 10;
    renderDuelStakes();
    $('#duel-res').textContent = 'Ставь монеты — и погнали';
    $('#duel-res').className = 'duel-res';
    ['me', 'bot'].forEach((w) => { $(`#duel-${w}`).innerHTML = '<span class="duel-q">?</span>'; $(`#duel-${w}-sc`).textContent = ''; });
    $('#duel-modal').hidden = false;
  };
  $('#duel-close').onclick = () => { if (!duelBusy) $('#duel-modal').hidden = true; };

  function shuffleInto(el, final, ms) {
    return new Promise((res) => {
      const t0 = Date.now();
      const iv = setInterval(() => {
        if (Date.now() - t0 >= ms) {
          clearInterval(iv);
          el.innerHTML = plateHTML(final);
          el.classList.add('landed');
          setTimeout(() => el.classList.remove('landed'), 300);
          return res();
        }
        el.innerHTML = plateHTML(P.random());
      }, 55);
    });
  }

  // Ничья по очкам решается цифрами, потом регионом — получаются честные 50/50
  const duelCmp = (a, b) => a.sc.total - b.sc.total || +a.p.digits - +b.p.digits || +a.p.region - +b.p.region;

  $('#duel-go').onclick = async () => {
    if (duelBusy) return;
    if (plState.coins < duelStake) return toast('Не хватает монет');
    duelBusy = true;
    $('#duel-go').disabled = true;
    setCoins(-duelStake);
    $('#duel-res').textContent = 'Крутим…';
    $('#duel-res').className = 'duel-res';
    const me = { p: P.random() }, bot = { p: P.random() };
    me.sc = P.score(me.p);
    bot.sc = P.score(bot.p);
    await shuffleInto($('#duel-me'), me.p, 1100);
    $('#duel-me-sc').innerHTML = `<b style="color:${me.sc.tier.color}">${me.sc.tier.name}</b> · ${me.sc.total} очк.`;
    await shuffleInto($('#duel-bot'), bot.p, 900);
    $('#duel-bot-sc').innerHTML = `<b style="color:${bot.sc.tier.color}">${bot.sc.tier.name}</b> · ${bot.sc.total} очк.`;
    const c = duelCmp(me, bot);
    if (c > 0) {
      setCoins(duelStake * 2);
      plState.duels.w++;
      qev('duel');
      $('#duel-res').innerHTML = `Победа! +${fmt(duelStake * 2)} · ${G.rnd.pick(TAUNTS_WIN)}`;
      $('#duel-res').className = 'duel-res win';
    } else if (c < 0) {
      plState.duels.l++;
      $('#duel-res').innerHTML = `Ашот забрал ${fmt(duelStake)} · ${G.rnd.pick(TAUNTS_LOSE)}`;
      $('#duel-res').className = 'duel-res lose';
    } else {
      setCoins(duelStake);
      $('#duel-res').textContent = 'Один в один! Ставка возвращена';
    }
    savePl();
    duelBusy = false;
    $('#duel-go').disabled = false;
    renderDuelStakes();
    refreshPlates();
  };

  /* --- работа: мини-игры за монеты, ограничены силами --- */
  const ENERGY_MAX = 15, ENERGY_REGEN = 60000;
  if (plState.energy == null) { plState.energy = ENERGY_MAX; plState.energyTs = Date.now(); plState.jobs = 0; }
  const workMult = () => Math.min(2, 1 + 0.03 * (plState.level - 1)) * (1 + kb('work') / 100);
  let workTimer = null, workKey = null;

  function regenEnergy() {
    const now = Date.now();
    if (plState.energy >= ENERGY_MAX) { plState.energyTs = now; return; }
    const gained = Math.floor((now - plState.energyTs) / ENERGY_REGEN);
    if (gained > 0) {
      plState.energy = Math.min(ENERGY_MAX, plState.energy + gained);
      plState.energyTs = plState.energy >= ENERGY_MAX ? now : plState.energyTs + gained * ENERGY_REGEN;
      savePl();
    }
  }

  function renderEnergy() {
    regenEnergy();
    $('#work-energy-bar').style.width = (plState.energy / ENERGY_MAX) * 100 + '%';
    let t = `${plState.energy} / ${ENERGY_MAX}`;
    if (plState.energy < ENERGY_MAX) {
      const left = ENERGY_REGEN - ((Date.now() - plState.energyTs) % ENERGY_REGEN);
      t += ` · +1 через ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;
    }
    $('#work-energy-t').textContent = t;
    $$('#work-menu [data-job]').forEach((b) => { b.disabled = plState.energy < 1; });
  }

  function openWork() {
    stopJob();
    $('#work-menu').hidden = false;
    $('#work-game').hidden = true;
    $('#work-mult').textContent = `×${workMult().toFixed(2)} за уровень`;
    renderEnergy();
    $('#work-modal').hidden = false;
  }
  function stopJob() {
    clearInterval(workTimer);
    workTimer = null;
    if (workKey) document.removeEventListener('keydown', workKey);
    workKey = null;
  }
  $('#pl-work').onclick = openWork;
  $('#work-close').onclick = () => { stopJob(); $('#work-modal').hidden = true; };
  setInterval(() => { if (!$('#work-modal').hidden) renderEnergy(); }, 1000);

  function payJob(base, label) {
    const pay = Math.round(base * workMult());
    plState.jobs = (plState.jobs || 0) + 1;
    qev('job');
    if (G.rnd.int(0, 99) < 8) { plState.gems = (plState.gems || 0) + 1; toast('💎 +1 — премия от начальства'); }
    if (pay > 0) {
      setCoins(pay);
      floatWin(`+${pay}`, '#5fc2ae');
    }
    savePl();
    refreshPlates();
    return pay > 0 ? `${label} <b class="work-pay"><i class="coin"></i>+${pay}</b>` : label;
  }

  function jobEnd(html) {
    stopJob();
    $('#work-game').innerHTML = `
      <div class="work-result">${html}</div>
      <div class="btn-row">
        <button class="pill pill-dark" data-again>Ещё раз <i>›</i></button>
        <button class="pill pill-white" data-back>Другая работа</button>
      </div>`;
  }
  $('#work-game').addEventListener('click', (e) => {
    if (e.target.closest('[data-back]')) openWork();
    if (e.target.closest('[data-again]')) startJob($('#work-game').dataset.job);
  });

  function startJob(job) {
    regenEnergy();
    if (plState.energy < 1) { toast('Нет сил — отдохни немного'); return openWork(); }
    plState.energy--;
    if (plState.energy === ENERGY_MAX - 1) plState.energyTs = Date.now();
    savePl();
    stopJob();
    $('#work-menu').hidden = true;
    const g = $('#work-game');
    g.onclick = null;
    g.hidden = false;
    g.dataset.job = job;
    ({ camera: jobCamera, check: jobCheck, wash: jobWash })[job](g);
  }
  $('#work-menu').onclick = (e) => {
    const b = e.target.closest('[data-job]');
    if (b && !b.disabled) startJob(b.dataset.job);
  };

  function timerBar(g, ms, onEnd) {
    const t0 = Date.now(), bar = $('.work-timer i', g);
    workTimer = setInterval(() => {
      const left = Math.max(0, 1 - (Date.now() - t0) / ms);
      bar.style.width = left * 100 + '%';
      if (left <= 0) { clearInterval(workTimer); workTimer = null; onEnd(); }
    }, 50);
    return () => Math.max(0, 1 - (Date.now() - t0) / ms);
  }

  const bigPlate = (p, cls = '') => `<span class="mini-plate work-plate ${cls}"><b>${p.l1}${p.digits}${p.l2}</b><em>${p.region}</em></span>`;

  // 1. Оператор камеры: перепечатать номер с «камеры»
  const LAT = { A: 'А', B: 'В', E: 'Е', K: 'К', M: 'М', H: 'Н', O: 'О', P: 'Р', C: 'С', T: 'Т', Y: 'У', X: 'Х' };
  const normPlate = (s) => s.toUpperCase().replace(/[A-Z]/g, (c) => LAT[c] || c).replace(/[^А-ЯЁ0-9]/g, '');
  function jobCamera(g) {
    const p = P.random();
    const tilt = G.rnd.int(-7, 7), skew = G.rnd.int(-12, 12);
    g.innerHTML = `
      <div class="work-task">📷 Перепечатай номер с камеры</div>
      <div class="work-cam"><div class="cam-noise"></div>${bigPlate(p, 'cam')}<span class="cam-rec">● REC</span></div>
      <div class="work-timer"><i></i></div>
      <input class="inp work-input" id="cam-in" placeholder="Например: А777МР77" autocomplete="off" spellcheck="false">
      <div class="note">Enter — отправить. Можно латиницей: A, B, E, K, M, H, O, P, C, T, Y, X.</div>`;
    $('.work-plate', g).style.transform = `rotate(${tilt}deg) skewX(${skew}deg)`;
    const inp = $('#cam-in');
    inp.focus();
    const left = timerBar(g, 8000, () => jobEnd(`⏱ Не успел. Это был <b>${P.format(p)}</b> ${payJob(0, '')}`));
    inp.onkeydown = (e) => {
      if (e.key !== 'Enter') return;
      const ok = normPlate(inp.value) === P.format(p);
      const l = left();
      stopJob();
      if (ok) jobEnd(payJob(24 + 24 * l, `✅ Верно${l > 0.6 ? ', и быстро!' : '!'}`));
      else jobEnd(`❌ Мимо. Было <b>${P.format(p)}</b>, ты ввёл <b>${esc(inp.value || '—')}</b> ${payJob(0, '')}`);
    };
  }

  // 2. Проверка: настоящий номер или фейк
  const BAD_LETTERS = 'БГДЖЗИЛПФЦЧШЩЭЮЯ'.split('');
  const BAD_REGIONS = ['00', '840', '999', '555', '20', '80'];
  function makeCheckPlate() {
    const p = P.random();
    if (G.rnd.int(0, 1)) return { p, real: true };
    const kind = G.rnd.int(0, 2);
    if (kind === 0) {
      const i = G.rnd.int(0, 2), bad = G.rnd.pick(BAD_LETTERS);
      if (i === 0) p.l1 = bad; else p.l2 = i === 1 ? bad + p.l2[1] : p.l2[0] + bad;
    } else if (kind === 1) p.digits = '000';
    else p.region = G.rnd.pick(BAD_REGIONS);
    return { p, real: false };
  }
  function jobCheck(g) {
    const items = Array.from({ length: 8 }, makeCheckPlate);
    let i = 0, correct = 0;
    const show = () => {
      if (i >= items.length) return jobEnd(payJob(correct * 6.4, `Проверено: <b>${correct} из 8</b> верно`));
      g.innerHTML = `
        <div class="work-task">🔍 Настоящий номер или фейк? <span class="work-count">${i + 1} / 8 · верно ${correct}</span></div>
        <div class="work-check">${bigPlate(items[i].p)}</div>
        <div class="work-timer"><i></i></div>
        <div class="btn-row check-btns">
          <button class="pill pill-white" data-ans="fake">← Фейк</button>
          <button class="pill pill-dark" data-ans="real">Настоящий →</button>
        </div>
        <div class="note">Фейки: буквы не из А В Е К М Н О Р С Т У Х, цифры 000 или несуществующий регион.</div>`;
      timerBar(g, 3500, () => answer(null));
    };
    const answer = (ans) => {
      clearInterval(workTimer);
      workTimer = null;
      const ok = ans === (items[i].real ? 'real' : 'fake');
      if (ok) correct++;
      const plate = $('.work-plate', g);
      if (plate) plate.classList.add(ok ? 'good' : 'bad');
      i++;
      setTimeout(show, 380);
    };
    g.onclick = (e) => {
      const b = e.target.closest('[data-ans]');
      if (b && workTimer) answer(b.dataset.ans);
    };
    workKey = (e) => {
      if (!workTimer) return;
      if (e.key === 'ArrowLeft') answer('fake');
      if (e.key === 'ArrowRight') answer('real');
    };
    document.addEventListener('keydown', workKey);
    show();
  }

  // 3. Мойка: кликай по грязи
  function jobWash(g) {
    const p = P.random();
    const N = 10;
    const spots = Array.from({ length: N }, () => `<i class="mud" style="left:${G.rnd.int(4, 88)}%;top:${G.rnd.int(8, 70)}%;--s:${G.rnd.int(26, 44)}px;--r:${G.rnd.int(0, 360)}deg"></i>`).join('');
    g.innerHTML = `
      <div class="work-task">🧽 Отмой номер — кликай по грязи <span class="work-count" id="wash-c">0 / ${N}</span></div>
      <div class="work-wash">${bigPlate(p)}${spots}</div>
      <div class="work-timer"><i></i></div>`;
    let cleaned = 0;
    const finish = () => jobEnd(payJob((cleaned / N) * 32 + (cleaned === N ? 8 : 0), cleaned === N ? '✨ Как новенький!' : `Отмыто ${cleaned} из ${N}`));
    timerBar(g, 6000, finish);
    $('.work-wash', g).onclick = (e) => {
      const m = e.target.closest('.mud');
      if (!m || m.classList.contains('gone') || !workTimer) return;
      m.classList.add('gone');
      cleaned++;
      $('#wash-c').textContent = `${cleaned} / ${N}`;
      if (cleaned === N) { stopJob(); setTimeout(finish, 250); }
    };
  }

  $('#pl-sound').onclick = () => {
    plState.sound = !plState.sound;
    savePl();
    renderSoundBtn();
    if (plState.sound) tone(880, 0, 0.25, 0.03);
  };
  renderSoundBtn();
  $('#pl-spin').onclick = () => (plState.coins < spinCost() ? openWork() : spinPlate());
  $('#pl-auto').onclick = () => (plAuto ? (plAuto = false) : autoSpin());
  $('#pl-copy').onclick = () => (plCurrent ? copy(P.format(plCurrent)) : toast('Сначала крутани'));
  $('#pl-qr').onclick = () => (plCurrent ? showQR(P.format(plCurrent)) : toast('Сначала крутани'));

  /* --- чёрный рынок: брелки, эксклюзивные скины, расходники --- */
  const MR = P.MARKET_RARITY;
  const marketWindow = () => Math.floor(Date.now() / P.MARKET_PERIOD);
  const saltOf = (id) => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
  function currentStock() {
    const w = marketWindow();
    if (plState.market.w !== w) plState.market = { w, bought: {}, rerolls: 0, seen: plState.market.seen };
    return P.marketStock(w, (saltOf(load('qb.pid', 'x')) + plState.market.rerolls * 7919) >>> 0);
  }
  const itemDef = (s) => (s.kind === 'key' ? P.KEYCHAINS : s.kind === 'skin' ? P.SKINS : P.CONSUMABLES).find((x) => x.id === s.id);
  const boostLine = (b) => Object.entries(b).map(([k, v]) => P.BOOST_TEXT[k](v)).join(', ');
  const owns = (s) => (s.kind === 'key' ? plState.keys.includes(s.id) : s.kind === 'skin' ? plState.skins.includes(s.id) : false);

  function renderMarket() {
    const stock = currentStock();
    $('#mk-stock').innerHTML = stock.map((s, i) => {
      const d = itemDef(s), r = MR[s.rarity];
      const left = s.qty - (plState.market.bought[i] || 0);
      const visual = s.kind === 'skin'
        ? `<span class="mini-plate skin-${s.id}"><b>А777МР</b><em>77</em></span>`
        : `<span class="mk-ico">${d.icon}</span>`;
      const desc = s.kind === 'key' ? `🔑 ${boostLine(d.boost)}` : s.kind === 'skin' ? '🎨 Эксклюзивный скин номера' : `🎒 ${d.desc}`;
      const state = owns(s) ? '<span class="mk-owned">УЖЕ ЕСТЬ</span>'
        : left <= 0 ? '<span class="mk-owned">РАЗОБРАЛИ</span>'
          : `<button class="mk-buy" data-buy="${i}" ${plState.coins < s.price ? 'disabled' : ''}><i class="coin"></i>${fmtShort(s.price)}</button>`;
      return `
        <div class="mk-card ${left <= 0 || owns(s) ? 'gone' : ''}" style="--mc:${r.color}">
          ${s.sale ? '<span class="mk-sale">−30%</span>' : ''}
          <span class="mk-rar">${r.name}</span>
          <div class="mk-visual">${visual}</div>
          <b class="mk-name">${esc(d.name)}</b>
          <span class="mk-desc">${desc}</span>
          <div class="mk-bottom">${s.kind === 'item' && left > 0 ? `<small>осталось ${left}</small>` : '<small></small>'}${state}</div>
        </div>`;
    }).join('');
    const rp = P.rerollPrice(plState.market.rerolls);
    $('#mk-reroll').disabled = plState.coins < rp;
    $('#mk-reroll').innerHTML = `🤝 Подкупить продавца · <i class="coin"></i>${fmtShort(rp)}`;
    $('#mk-reroll-gem').disabled = (plState.gems || 0) < P.MARKET_REROLL_GEMS;
    $('#mk-reroll-gem').innerHTML = `🤝 За кристаллы · <i class="gem"></i>${P.MARKET_REROLL_GEMS}`;
    renderGemShop();

    // брелки
    $('#mk-eqc').textContent = `${plState.keyEq.length} / ${keySlots()}`;
    $('#mk-keys').innerHTML = plState.keys.length ? plState.keys.map((id) => {
      const k = P.KEYCHAINS.find((x) => x.id === id), on = plState.keyEq.includes(id);
      return `<button class="mk-key ${on ? 'on' : ''}" data-key="${id}" style="--mc:${MR[k.rarity].color}" title="${esc(boostLine(k.boost))}">
        <span>${k.icon}</span><b>${esc(k.name)}</b><small>${on ? 'НАДЕТ' : 'СНЯТ'}</small></button>`;
    }).join('') : '<div class="note">Пока пусто — брелки появляются в завозе</div>';
    const total = ['pay', 'luck', 'moscow', 'garage', 'work', 'xp', 'happy'].filter((t) => kb(t)).map((t) => P.BOOST_TEXT[t](kb(t)));
    $('#mk-boosts').textContent = total.length ? `Сейчас действует: ${total.join(' · ')}` : 'Надень брелки, чтобы получить бусты';

    // рюкзак
    $('#mk-bag').innerHTML = P.CONSUMABLES.map((c) => {
      const n = plState.items[c.id] || 0;
      return `<div class="mk-item ${n ? '' : 'none'}" style="--mc:${MR[c.rarity].color}" title="${esc(c.desc)}">
        <span>${c.icon}</span><b>${esc(c.name)}</b><small>×${n}</small>
        <button data-use="${c.id}" ${n ? '' : 'disabled'}>Юзнуть</button></div>`;
    }).join('');
    const status = [];
    if (plState.talonActive) status.push('🧿 талон удачи заряжен');
    if (plState.x3Left) status.push(`🔥 купон ×3: ещё ${plState.x3Left} круток`);
    $('#mk-active').textContent = status.join(' · ');
  }

  function marketTimer() {
    const left = P.MARKET_PERIOD - (Date.now() % P.MARKET_PERIOD);
    const h = Math.floor(left / 3600000), m = Math.floor((left % 3600000) / 60000), s = Math.floor((left % 60000) / 1000);
    $('#mk-timer').textContent = `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    if (plState.market.w !== marketWindow() && !$('#market-modal').hidden) renderMarket();
    $('#pl-market').classList.toggle('fresh', plState.market.seen !== marketWindow());
  }
  setInterval(marketTimer, 1000);

  $('#pl-market').onclick = () => {
    plState.market.seen = marketWindow();
    savePl();
    renderMarket();
    marketTimer();
    $('#market-modal').hidden = false;
  };
  $('#mk-close').onclick = () => { $('#market-modal').hidden = true; };
  function rerollMarket() {
    plState.market.rerolls++;
    plState.market.bought = {};
  }
  $('#mk-reroll-gem').onclick = () => {
    if ((plState.gems || 0) < P.MARKET_REROLL_GEMS) return;
    plState.gems -= P.MARKET_REROLL_GEMS;
    rerollMarket();
    savePl();
    toast('Продавец взял кристаллы: новый завоз');
    renderMarket();
  };
  $('#mk-reroll').onclick = () => {
    const rp = P.rerollPrice(plState.market.rerolls);
    if (plState.coins < rp) return;
    rerollMarket();
    setCoins(-rp);
    toast('Продавец порылся в багажнике: новый завоз');
    renderMarket();
  };

  $('#mk-stock').onclick = (e) => {
    const b = e.target.closest('[data-buy]');
    if (!b) return;
    const i = +b.dataset.buy, s = currentStock()[i], d = itemDef(s);
    if (plState.coins < s.price || owns(s) || (plState.market.bought[i] || 0) >= s.qty) return;
    plState.market.bought[i] = (plState.market.bought[i] || 0) + 1;
    qev('market');
    if (s.kind === 'key') {
      plState.keys.push(s.id);
      if (plState.keyEq.length < keySlots()) plState.keyEq.push(s.id);
    } else if (s.kind === 'skin') plState.skins.push(s.id);
    else plState.items[s.id] = (plState.items[s.id] || 0) + 1;
    setCoins(-s.price);
    toast(`Куплено: ${d.name}`);
    if (MR[s.rarity] && s.rarity === 'legendary') burst('#f0b35a', 40);
    renderMarket();
    refreshPlates();
  };

  $('#mk-keys').onclick = (e) => {
    const b = e.target.closest('[data-key]');
    if (!b) return;
    const id = b.dataset.key, i = plState.keyEq.indexOf(id);
    if (i >= 0) plState.keyEq.splice(i, 1);
    else if (plState.keyEq.length >= keySlots()) return toast(`Можно носить только ${keySlots()} брелка — сними какой-нибудь или купи слот за 💎`);
    else plState.keyEq.push(id);
    savePl();
    renderMarket();
    refreshPlates();
  };

  $('#mk-bag').onclick = (e) => {
    const b = e.target.closest('[data-use]');
    if (!b || !(plState.items[b.dataset.use] > 0)) return;
    const id = b.dataset.use;
    const use = {
      energy: () => { plState.energy = ENERGY_MAX; plState.energyTs = Date.now(); return 'Силы восстановлены ⚡'; },
      cash: () => {
        const rate = garageRate();
        if (!rate) return null;
        const gain = Math.round(rate * 120);
        plState.coins += gain;
        return `Инкассация: +${fmt(gain)}`;
      },
      ticket: () => {
        if (happyActive()) return null;
        plState.happyUntil = Date.now() + happyLen();
        plState.happyNext = plState.happyUntil + G.rnd.int(20, 40) * 60000;
        return '🔥 Счастливый час запущен!';
      },
      talon: () => { if (plState.talonActive) return null; plState.talonActive = true; return 'Талон заряжен: следующая крутка минимум «Редкий»'; },
      x3: () => { plState.x3Left += 10; return 'Купон ×3 активен на 10 круток'; },
    }[id];
    const msg = use();
    if (!msg) {
      return toast({ cash: 'Сначала купи гараж в магазине', ticket: 'Счастливый час уже идёт', talon: 'Талон уже заряжен' }[id]);
    }
    plState.items[id]--;
    savePl();
    toast(msg);
    renderMarket();
    refreshPlates();
    checkHappy();
  };

  /* --- тюнинг: рамки, подсветка, наклейки, болты, аура --- */
  const tDef = (id) => P.TUNING.find((t) => t.id === id);
  let tnCat = 'frame', tnTry = null;
  // цвет плитки в списке обвесов
  const SW = {
    'f-chrome': 'linear-gradient(135deg,#9ea3a8,#f6f7f8,#7d8287)', 'f-carbon': 'repeating-linear-gradient(45deg,#1b1b1b 0 4px,#333 4px 8px)',
    'f-gold': 'linear-gradient(135deg,#fbeab6,#d9ab4f,#b98a31)', 'f-neon': 'linear-gradient(135deg,#2bf0ff,#ff2bd6)',
    'f-diamond': 'conic-gradient(#e9f6ff,#c9e7ff,#fff,#d7c9ff,#e9f6ff)', 'f-rainbow': 'linear-gradient(90deg,#ff6b6b,#ffd36b,#8ef08e,#6bd3ff,#b48cff)',
    'g-blue': 'radial-gradient(#3d8bff,#0b1a3a)', 'g-red': 'radial-gradient(#ff3d3d,#3a0b0b)', 'g-green': 'radial-gradient(#7dff3d,#123a0b)',
    'g-rgb': 'conic-gradient(#ff3d3d,#ffd33d,#3dff7d,#3dd3ff,#b03dff,#ff3d3d)', 'g-void': 'radial-gradient(#000 30%,#6b2bff 70%,#000)',
    'b-gold': 'radial-gradient(circle at 35% 35%,#fff6c9,#f0c552 55%,#8a6414)', 'b-black': 'radial-gradient(circle at 35% 35%,#888,#111 60%)',
    'b-ruby': 'radial-gradient(circle at 35% 35%,#ffb3b3,#d3142c 55%,#5a0010)', 'b-diamond': 'radial-gradient(circle at 35% 35%,#fff,#bfe6ff 50%,#6aa8d6)',
    'a-sparks': 'radial-gradient(#ffd36b 10%,#3a2a0b 70%)', 'a-smoke': 'radial-gradient(#bbb,#333)', 'a-lightning': 'linear-gradient(135deg,#0b1a3a,#7df9ff,#0b1a3a)',
    'a-fire': 'linear-gradient(0deg,#ff3d00,#ffb300,#fff3b0)', 'a-stars': 'radial-gradient(#fff 5%,#1a1240 40%)', 'a-gold': 'linear-gradient(180deg,#fff2b0,#f0c552,#8a6414)',
  };

  // надеваем обвесы на любую обёртку номера (основную или превью в окне)
  function applyTuning(wrap, eq) {
    P.TUNING_CATS.forEach((c) => {
      const id = eq[c.id];
      if (id) wrap.dataset[c.id] = id;
      else delete wrap.dataset[c.id];
    });
    const st = wrap.querySelector('.plate-sticker');
    if (st) st.textContent = eq.sticker ? P.TUNING.find((t) => t.id === eq.sticker).icon : '';
  }

  function renderTuneStage() {
    const eq = { ...plState.tuning.eq };
    if (tnTry) eq[tDef(tnTry).cat] = tnTry; // примерка
    const clone = $('#pl-tilt').cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
    clone.style.removeProperty('--rx');
    clone.style.removeProperty('--ry');
    applyTuning(clone, eq);
    const stage = $('#tn-stage');
    stage.innerHTML = '';
    stage.appendChild(clone);
    stage.classList.toggle('trying', !!tnTry);
  }

  function renderTune() {
    const style = styleNow();
    $('#tn-style').textContent = style;
    $('#tn-style-bar').style.width = Math.min(100, (style / 96) * 100) + '%';
    $('#tn-bonus').textContent = `+${(style / P.STYLE_DIV).toFixed(1)}% к выплатам`;
    $('#tn-cats').innerHTML = P.TUNING_CATS.map((c) => `<button data-v="${c.id}" class="${c.id === tnCat ? 'on' : ''}">${c.icon} ${c.name}</button>`).join('');
    $('#tn-grid').innerHTML = P.TUNING.filter((t) => t.cat === tnCat).map((t) => {
      const owned = plState.tuning.owned.includes(t.id), on = plState.tuning.eq[t.cat] === t.id;
      const btn = on ? `<button class="tn-btn off" data-off="${t.cat}">Снять</button>`
        : owned ? `<button class="tn-btn" data-eq="${t.id}">Надеть</button>`
          : `<button class="tn-btn buy" data-buyt="${t.id}" ${plState.coins < t.price ? 'disabled' : ''}><i class="coin"></i>${fmtShort(t.price)}</button>`;
      return `
        <div class="tn-item ${on ? 'on' : ''} ${owned ? 'owned' : ''}" data-try="${t.id}">
          <div class="tn-swatch" style="--sw:${SW[t.id] || '#444'}">${t.icon ? `<span>${t.icon}</span>` : '<i></i>'}</div>
          <b>${esc(t.name)}</b>
          <small>+${P.tuningStyle(t)} стиля</small>
          ${btn}
        </div>`;
    }).join('');
    renderTuneStage();
  }

  $('#pl-tune').onclick = () => {
    tnTry = null;
    renderTune();
    $('#tune-modal').hidden = false;
  };
  $('#tn-close').onclick = () => { tnTry = null; $('#tune-modal').hidden = true; };
  $('#tn-cats').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    tnCat = b.dataset.v;
    tnTry = null;
    renderTune();
  };
  // примерка при наведении
  $('#tn-grid').addEventListener('mouseover', (e) => {
    const it = e.target.closest('[data-try]');
    if (!it || tnTry === it.dataset.try) return;
    tnTry = it.dataset.try;
    renderTuneStage();
  });
  $('#tn-grid').addEventListener('mouseleave', () => { tnTry = null; renderTuneStage(); });
  $('#tn-grid').onclick = (e) => {
    const buy = e.target.closest('[data-buyt]'), eqB = e.target.closest('[data-eq]'), off = e.target.closest('[data-off]');
    if (buy) {
      const t = tDef(buy.dataset.buyt);
      if (plState.coins < t.price || plState.tuning.owned.includes(t.id)) return;
      plState.tuning.owned.push(t.id);
      plState.tuning.eq[t.cat] = t.id;
      setCoins(-t.price);
      toast(`Поставлено: ${t.name} · +${P.tuningStyle(t)} стиля`);
      if (t.price >= 1000000) burst('#f0c552', 50);
    } else if (eqB) {
      const t = tDef(eqB.dataset.eq);
      plState.tuning.eq[t.cat] = t.id;
    } else if (off) {
      delete plState.tuning.eq[off.dataset.off];
    } else return;
    plState.styleNow = styleNow();
    savePl();
    renderTune();
    refreshPlates();
  };

  /* --- лавка кристаллов --- */
  const gemItem = (g) => {
    if (g.kind === 'key') { const k = P.KEYCHAINS.find((x) => x.id === g.id); return { ...g, name: k.name, icon: k.icon, desc: boostLine(k.boost), rarity: k.rarity }; }
    if (g.kind === 'skin') { const s = P.SKINS.find((x) => x.id === g.id); return { ...g, name: s.name, desc: 'Эксклюзивный скин только за кристаллы', rarity: 'legendary' }; }
    if (g.kind === 'slot') return { ...g, desc: 'Можно носить на один брелок больше', rarity: 'epic' };
    return { ...g, desc: 'Набор расходников в рюкзак', rarity: 'rare' };
  };
  const gemOwned = (g) => (g.kind === 'slot' ? (plState.extraSlots || 0) > g.need
    : g.kind === 'key' ? plState.keys.includes(g.id)
      : g.kind === 'skin' ? plState.skins.includes(g.id) : false);
  const gemLocked = (g) => g.kind === 'slot' && (plState.extraSlots || 0) < g.need;

  function renderGemShop() {
    $('#mk-gems').textContent = fmt(plState.gems || 0);
    $('#mk-gemshop').innerHTML = P.GEM_SHOP.map((raw) => {
      const g = gemItem(raw), owned = gemOwned(g), locked = gemLocked(g);
      const visual = g.kind === 'skin' ? `<span class="mini-plate skin-${g.id}"><b>А777МР</b><em>77</em></span>` : `<span class="mk-ico">${g.icon}</span>`;
      const btn = owned ? '<span class="mk-owned">УЖЕ ЕСТЬ</span>'
        : locked ? '<span class="mk-owned">СНАЧАЛА 4-Й СЛОТ</span>'
          : `<button class="gem-buy" data-gem="${g.id}" ${(plState.gems || 0) < g.gems ? 'disabled' : ''}><i class="gem"></i>${g.gems}</button>`;
      return `<div class="gem-card ${owned ? 'gone' : ''}" style="--mc:${MR[g.rarity].color}">
        <div class="mk-visual">${visual}</div><b class="mk-name">${esc(g.name)}</b><span class="mk-desc">${esc(g.desc)}</span>${btn}</div>`;
    }).join('');
    $('#mk-buygem').disabled = plState.coins < P.GEM_RATE;
    $('#mk-buygem10').disabled = plState.coins < P.GEM_RATE * 10;
  }
  $('#mk-gemshop').onclick = (e) => {
    const b = e.target.closest('[data-gem]');
    if (!b) return;
    const g = gemItem(P.GEM_SHOP.find((x) => x.id === b.dataset.gem));
    if ((plState.gems || 0) < g.gems || gemOwned(g) || gemLocked(g)) return;
    plState.gems -= g.gems;
    if (g.kind === 'slot') plState.extraSlots = (plState.extraSlots || 0) + 1;
    else if (g.kind === 'key') { plState.keys.push(g.id); if (plState.keyEq.length < keySlots()) plState.keyEq.push(g.id); }
    else if (g.kind === 'skin') plState.skins.push(g.id);
    else plState.items[g.item] = (plState.items[g.item] || 0) + g.n;
    savePl();
    toast(`💎 Куплено: ${g.name}`);
    burst('#b07bff', 30);
    renderMarket();
    refreshPlates();
  };
  function buyGems(n) {
    const cost = P.GEM_RATE * n;
    if (plState.coins < cost) return;
    plState.gems = (plState.gems || 0) + n;
    setCoins(-cost);
    toast(`Обменник: +${n} 💎 за ${fmtShort(cost)}`);
    renderMarket();
  }
  $('#mk-buygem').onclick = () => buyGems(1);
  $('#mk-buygem10').onclick = () => buyGems(10);

  /* --- аукцион номеров: общий для всех онлайн, против ботов и кентов --- */
  // Лот каждого 10-минутного окна одинаков у всех: номер и бюджеты ботов считаются из номера окна.
  // Ведущий (первый по времени входа в зал) принимает ставки, крутит ботов и рассылает состояние.
  if (!plState.fleet) plState.fleet = [];
  if (!plState.auction || !('esc' in plState.auction)) {
    // переход со старого локального аукциона: незавершённая ставка возвращается
    const old = plState.auction && plState.auction.lot;
    if (old && old.leader === 'me' && old.myBid) plState.coins += old.myBid;
    plState.auction = { esc: null };
  }
  let aucId = load('qb.pid', null);
  if (!aucId) { aucId = G.uuid4(); store('qb.pid', aucId); }
  const aucSb = window.supabase && window.QB_ONLINE
    ? window.supabase.createClient(window.QB_ONLINE.url, window.QB_ONLINE.key, { auth: { persistSession: false } })
    : null;
  const aucHex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  const aucSha = async (str) => aucHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)));
  const aucWindow = () => Math.floor(Date.now() / P.AUCTION_EVERY);
  const myNick = () => profile.nick.trim() || `Игрок ${aucId.slice(0, 4).toUpperCase()}`;

  let aucCh = null, aucJoinedAt = Date.now(), aucHall = [], aucHost = false;
  let lot = null; // текущее состояние лота (у ведущего — источник правды)
  const lotCache = {};

  // одинаковый у всех лот для окна w
  async function lotFor(w) {
    if (lotCache[w]) return lotCache[w];
    const rng = seededRnd(await aucSha(`qb-auction-${w}`));
    let p, sc;
    for (let i = 0; i < 400000; i++) { p = P.random(0, rng); sc = P.score(p); if (P.TIERS.indexOf(sc.tier) >= 4) break; }
    const start = Math.round((P.PAYOUT[sc.tier.id] * 80) / 100) * 100;
    const names = [...P.AUCTION_BOTS];
    const bots = [0, 1, 2].map(() => {
      const name = names.splice(rng.int(0, names.length - 1), 1)[0];
      return { name, max: Math.round(start * (1.3 + rng.int(0, 220) / 100) * (sc.tier.id === 'mythic' ? 1.25 : 1)) };
    });
    lotCache[w] = { w, p, total: sc.total, tier: sc.tier.id, start, bots, startAt: w * P.AUCTION_EVERY };
    return lotCache[w];
  }

  const nextBid = (l, k = 1.1) => (l.leader ? Math.ceil((l.price * k) / 100) * 100 : l.price);
  const lotOpen = (l) => l && !l.ended && Date.now() < l.ends;

  async function freshLot(w) {
    const base = await lotFor(w);
    return { ...base, price: base.start, leader: null, leaderNick: '', ends: base.startAt + P.AUCTION_LEN, log: [], ended: false, ver: 0 };
  }

  const aucSend = (event, payload) => aucCh && aucCh.send({ type: 'broadcast', event, payload: { ...payload, from: aucId } });
  const pubState = () => lot && aucSend('au-state', { lot: { ...lot, p: undefined, bots: undefined } });

  // применяем ставку (вызывает только ведущий)
  function applyBid(who, nick, amount) {
    if (!lotOpen(lot) || amount < nextBid(lot)) return false;
    lot.price = amount;
    lot.leader = who;
    lot.leaderNick = nick;
    lot.log.unshift({ who, nick, amount });
    lot.log = lot.log.slice(0, 10);
    if (lot.ends - Date.now() < P.AUCTION_EXTEND) lot.ends = Date.now() + P.AUCTION_EXTEND;
    lot.ver++;
    return true;
  }

  // эскроу: ставка списана, пока не перебили или не выиграли
  function settleEscrow() {
    const e = plState.auction.esc;
    if (!e || !lot || lot.w !== e.w) return;
    if (lot.ended) {
      if (lot.leader === aucId) {
        plState.fleet.push({ p: lot.p, total: lot.total, tier: lot.tier, paid: e.amount, ts: Date.now() });
        toast(`🏆 Лот твой: ${P.format(lot.p)} · аренда +${P.fleetRent(lot.total)}/мин`);
        burst('#f0c552', 70);
      } else {
        setCoins(e.amount);
        toast(`🔨 Лот ушёл к ${lot.leaderNick || 'перекупу'} за ${fmtShort(lot.price)} — ставка вернулась`);
      }
      plState.auction.esc = null;
    } else if (e.acked && lot.leader !== aucId) {
      setCoins(e.amount);
      toast(`🔨 ${lot.leaderNick} перебил тебя: ${fmtShort(lot.price)}`);
      plState.auction.esc = null;
    }
    savePl();
    refreshPlates();
  }

  async function hostTick() {
    const w = aucWindow();
    if (!lot || (lot.ended && lot.w < w)) {
      if (lot && lot.w === w) return;
      lot = await freshLot(w);
      if (Date.now() >= lot.ends) { lot.ended = true; return; } // окно уже прошло
      toast(`🔨 Новый лот на аукционе: ${P.format(lot.p)}`);
    }
    if (lot.ended) return;
    const now = Date.now();
    if (now >= lot.ends) {
      lot.ended = true;
      lot.ver++;
      pubState();
      settleEscrow();
      return;
    }
    const closing = lot.ends - now < 20000;
    const human = lot.leader && !lot.bots.some((b) => b.name === lot.leader);
    lot.bots.forEach((b) => {
      if (lot.leader === b.name) return;
      const chance = human ? (closing ? 45 : 22) : (closing ? 25 : 10);
      if (b.max >= nextBid(lot) && G.rnd.int(0, 99) < chance) applyBid(b.name, b.name, nextBid(lot));
    });
    pubState();
    settleEscrow();
  }

  function joinAuctionHall() {
    if (!aucSb) return;
    aucCh = aucSb.channel('qb-auction-hall', { config: { broadcast: { self: false, ack: false }, presence: { key: aucId } } });
    aucCh.on('presence', { event: 'sync' }, () => {
      aucHall = Object.values(aucCh.presenceState()).map((a) => a[0]).filter(Boolean).sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
      const wasHost = aucHost;
      aucHost = aucHall.length > 0 && aucHall[0].id === aucId;
      if (aucHost && !wasHost) pubState();
    });
    aucCh.on('broadcast', { event: 'au-state' }, async ({ payload }) => {
      if (aucHost) return;
      const s = payload.lot;
      if (lot && lot.w === s.w && lot.ver > s.ver) return;
      const base = await lotFor(s.w);
      lot = { ...base, ...s };
      settleEscrow();
    });
    aucCh.on('broadcast', { event: 'au-sync' }, () => { if (aucHost) pubState(); });
    aucCh.on('broadcast', { event: 'au-bid' }, ({ payload }) => {
      if (!aucHost) return;
      const ok = lot && lot.w === payload.w && applyBid(payload.from, payload.nick, payload.amount);
      aucSend('au-ack', { to: payload.from, nonce: payload.nonce, ok });
      if (ok) pubState();
    });
    aucCh.on('broadcast', { event: 'au-ack' }, ({ payload }) => {
      const e = plState.auction.esc;
      if (payload.to !== aucId || !e || e.nonce !== payload.nonce) return;
      if (payload.ok) { e.acked = true; savePl(); return; }
      setCoins(e.amount);
      plState.auction.esc = null;
      savePl();
      toast('Ставка не прошла — кто-то успел раньше');
    });
    aucCh.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      await aucCh.track({ id: aucId, t: aucJoinedAt, nick: myNick() });
      aucSend('au-sync', {});
    });
  }

  async function aucTick() {
    // без сети — аукцион идёт локально, ведущий — ты сам
    if (!aucCh || aucHost || !aucHall.length) await hostTick();
    // зависшая ставка: окно давно прошло, итога не узнали — возвращаем
    const e = plState.auction.esc;
    if (e && e.w < aucWindow() - 1) {
      setCoins(e.amount);
      plState.auction.esc = null;
      savePl();
      toast('Итог прошлого аукциона не дошёл — ставка вернулась');
    }
    renderAuctionBtn();
    if (!$('#auction-modal').hidden) renderAuction();
  }
  setInterval(aucTick, 1000);
  joinAuctionHall();

  const mmss = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
  const nextLotIn = () => (aucWindow() + 1) * P.AUCTION_EVERY - Date.now();

  function renderAuctionBtn() {
    const b = $('#pl-auction'), live = lotOpen(lot);
    b.classList.toggle('live', live);
    b.innerHTML = live ? '🔨 Аукцион <em>LIVE</em>' : `🔨 Аукцион · ${mmss(Math.max(0, nextLotIn()))}`;
  }

  function renderAuction() {
    const body = $('#au-body');
    const hall = aucCh ? `👥 В зале: ${Math.max(1, aucHall.length)}${aucHost ? ' · ты ведущий' : ''}` : '📴 Офлайн-режим: торгуешься только с ботами';
    const fleetRentNow = plState.fleet.reduce((sum, f) => sum + P.fleetRent(f.total), 0);
    if (!lotOpen(lot)) {
      const last = lot && lot.ended && lot.leader ? `<small>Прошлый лот ${plateHTML(lot.p)} ушёл к <b>${esc(lot.leaderNick)}</b> за ${fmtShort(lot.price)}</small>` : '';
      body.innerHTML = `<div class="au-hall">${hall}</div><div class="au-wait"><div class="sparkle">🔨</div><b>Следующий лот через ${mmss(Math.max(0, nextLotIn()))}</b>
        <span>Лот один на всех: торгуешься с кентами и ботами-перекупами. Выиграешь — номер встанет в автопарк и будет приносить аренду.</span>
        ${last}<small>Твой автопарк: ${plState.fleet.length} номеров · +${fmt(fleetRentNow)}/мин</small></div>`;
      return;
    }
    const t = P.TIERS.find((x) => x.id === lot.tier), left = Math.max(0, lot.ends - Date.now());
    const mine = lot.leader === aucId, pending = plState.auction.esc && !plState.auction.esc.acked;
    const b10 = nextBid(lot), b25 = nextBid(lot, 1.25);
    body.innerHTML = `
      <div class="au-hall">${hall}</div>
      <div class="au-lot" style="--t:${t.color}">
        <div class="au-plate">${plateHTML(lot.p)}</div>
        <div class="au-meta"><span class="au-tier">${t.name}</span> · ${lot.total} очков · аренда <b>+${P.fleetRent(lot.total)}/мин</b></div>
      </div>
      <div class="au-price">
        <div><span>ТЕКУЩАЯ СТАВКА</span><b><i class="coin"></i>${fmt(lot.price)}</b></div>
        <div><span>ЛИДЕР</span><b class="${mine ? 'me' : ''}">${lot.leader ? (mine ? 'Ты 😎' : esc(lot.leaderNick)) : '—'}</b></div>
        <div><span>ДО КОНЦА</span><b class="${left < 15000 ? 'hot' : ''}">${mmss(left)}</b></div>
      </div>
      <div class="au-bar"><i style="width:${Math.min(100, (left / P.AUCTION_LEN) * 100)}%"></i></div>
      <div class="au-actions">
        ${mine ? '<div class="au-lead">Ты лидируешь — не выходи до конца торгов</div>' : pending ? '<div class="au-lead">Ставка отправлена…</div>' : `
        <button class="pill pill-dark" data-bid="${b10}" ${plState.coins < b10 ? 'disabled' : ''}>${lot.leader ? '+10%' : 'Старт'} · ${fmtShort(b10)}</button>
        ${lot.leader ? `<button class="pill pill-white" data-bid="${b25}" ${plState.coins < b25 ? 'disabled' : ''}>+25% · ${fmtShort(b25)}</button>` : ''}`}
      </div>
      <div class="au-log">${lot.log.map((l) => `<div class="${l.who === aucId ? 'me' : ''}"><span>${l.who === aucId ? 'Ты' : esc(l.nick)}${lot.bots.some((b) => b.name === l.who) ? ' 🤖' : l.who === aucId ? '' : ' 👤'}</span><b>${fmt(l.amount)}</b></div>`).join('') || '<div class="note">Ставок пока нет — будь первым</div>'}</div>`;
  }

  $('#au-body').onclick = (e) => {
    const b = e.target.closest('[data-bid]');
    if (!b || !lotOpen(lot) || lot.leader === aucId || plState.auction.esc) return;
    const amount = +b.dataset.bid;
    if (plState.coins < amount) return toast('Не хватает монет');
    setCoins(-amount);
    const nonce = G.uuid4();
    plState.auction.esc = { w: lot.w, amount, nonce, acked: false };
    qev('auction');
    savePl();
    if (!aucCh || aucHost || !aucHall.length) {
      // ведущий — ты: ставка применяется сразу
      if (applyBid(aucId, myNick(), amount)) { plState.auction.esc.acked = true; pubState(); }
      else { setCoins(amount); plState.auction.esc = null; toast('Ставка не прошла — кто-то успел раньше'); }
      savePl();
    } else {
      aucSend('au-bid', { w: lot.w, amount, nonce, nick: myNick() });
      // ведущий не ответил — ставку возвращаем
      setTimeout(() => {
        const esc0 = plState.auction.esc;
        if (esc0 && esc0.nonce === nonce && !esc0.acked) {
          setCoins(amount);
          plState.auction.esc = null;
          savePl();
          toast('Ведущий аукциона не ответил — ставка вернулась');
        }
      }, 6000);
    }
    renderAuction();
  };
  $('#pl-auction').onclick = () => { renderAuction(); $('#auction-modal').hidden = false; };
  $('#au-close').onclick = () => { $('#auction-modal').hidden = true; };

  /* ======================= 3.0: задания дня/недели, сезон, автосалон, профиль, обмен ======================= */

  /* --- ежедневные и недельные задания --- */
  const pad2 = (n) => String(n).padStart(2, '0');
  const dayId = () => { const d = new Date(); return `d-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const weekId = () => {
    const d = new Date();
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return `w-${t.getUTCFullYear()}-${Math.ceil(((t - y0) / 864e5 + 1) / 7)}`;
  };
  const seasonId = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };
  const prestigeK = () => 1 + (plState.prestige || 0);

  function ensurePeriodic() {
    const make = (id, weekly) => ({
      id,
      list: P.pickQuests(id, 3).map((q) => ({ type: q.type, target: weekly ? q.w : q.d, progress: 0, claimed: false })),
    });
    if (!plState.dq || plState.dq.id !== dayId()) plState.dq = make(dayId(), false);
    if (!plState.wq || plState.wq.id !== weekId()) plState.wq = make(weekId(), true);
    if (!plState.season || plState.season.id !== seasonId()) {
      plState.season = { id: seasonId(), sp: 0, level: 0, best: (plState.season && plState.season.best) || 0 };
    }
  }
  ensurePeriodic();

  // событие игры двигает прогресс заданий дня и недели
  function qev(type, n = 1) {
    ensurePeriodic();
    let changed = false;
    [plState.dq, plState.wq].forEach((g) => g.list.forEach((q) => {
      if (q.type === type && !q.claimed && q.progress < q.target) {
        q.progress = Math.min(q.target, q.progress + n);
        changed = true;
        if (q.progress >= q.target) toast(`📅 Задание готово: ${P.DAILY_POOL.find((x) => x.type === type).name(q.target)}`);
      }
    }));
    if (changed) { savePl(); if (!$('#pl-quests').hidden) renderQuests(); }
  }

  // очки сезона и награды уровней
  function addSP(n) {
    ensurePeriodic();
    const s = plState.season;
    s.sp += n;
    while (s.level < P.SEASON_LEVELS && s.sp >= (s.level + 1) * P.SP_PER_LEVEL) {
      s.level++;
      s.best = Math.max(s.best || 0, s.level);
      const r = P.seasonReward(s.level);
      if (r.coins) plState.coins += r.coins;
      if (r.gems) plState.gems = (plState.gems || 0) + r.gems;
      if (r.item) plState.items[r.item] = (plState.items[r.item] || 0) + r.n;
      if (r.skin && !plState.skins.includes(r.skin)) plState.skins.push(r.skin);
      if (r.tuning && !plState.tuning.owned.includes(r.tuning)) plState.tuning.owned.push(r.tuning);
      toast(`🏁 Сезон: уровень ${s.level} · ${r.label}`);
      if (s.level % 10 === 0) burst('#f0c552', 50);
    }
    savePl();
  }

  function periodicHTML() {
    ensurePeriodic();
    const s = plState.season, lvlSp = s.sp - s.level * P.SP_PER_LEVEL;
    const group = (g, weekly) => g.list.map((q, i) => {
      const done = q.progress >= q.target, name = P.DAILY_POOL.find((x) => x.type === q.type).name(q.target);
      const r = weekly ? P.WEEKLY_REWARD : P.DAILY_REWARD;
      const reward = `<i class="coin"></i>${fmtShort(r.coins * prestigeK())}${r.gems ? ` · <i class="gem"></i>${r.gems}` : ''} · ${r.sp} SP`;
      return `
        <div class="quest ${q.claimed ? 'got' : done ? 'ready' : ''}">
          <div class="quest-body">
            <div class="quest-name">${name}</div>
            ${!q.claimed ? `<div class="quest-bar"><i style="width:${(q.progress / q.target) * 100}%"></i></div><small>${fmt(q.progress)} / ${fmt(q.target)}</small>` : ''}
          </div>
          ${q.claimed ? '<span class="quest-done">✓</span>' : done ? `<button class="shop-buy claim" data-${weekly ? 'wq' : 'dq'}="${i}">Забрать</button>` : `<span class="quest-reward">${reward}</span>`}
        </div>`;
    }).join('');
    const msLeft = (() => { const d = new Date(); d.setHours(24, 0, 0, 0); return d - Date.now(); })();
    return `
      <div class="season-box">
        <div class="season-top"><b>🏁 Сезон ${s.id}</b><span>уровень <b>${s.level}</b> / ${P.SEASON_LEVELS}</span></div>
        <div class="quest-bar"><i style="width:${s.level >= P.SEASON_LEVELS ? 100 : (lvlSp / P.SP_PER_LEVEL) * 100}%"></i></div>
        <small>${s.level >= P.SEASON_LEVELS ? 'Пропуск пройден! 🏆' : `${lvlSp} / ${P.SP_PER_LEVEL} SP до уровня ${s.level + 1} · награда: ${P.seasonReward(s.level + 1).label}`}</small>
        <button class="shop-buy" id="pl-season-open">Все награды сезона</button>
      </div>
      <div class="q-head"><b>📅 Задания дня</b><span>обновятся через ${Math.floor(msLeft / 3600000)} ч ${Math.floor((msLeft % 3600000) / 60000)} мин</span></div>
      ${group(plState.dq, false)}
      <div class="q-head"><b>🗓 Задания недели</b><span>с понедельника — новые</span></div>
      ${group(plState.wq, true)}
      <div class="q-head"><b>🏅 Достижения</b><span>навсегда</span></div>`;
  }

  function claimPeriodic(weekly, i) {
    const g = weekly ? plState.wq : plState.dq, q = g.list[i];
    if (!q || q.claimed || q.progress < q.target) return;
    q.claimed = true;
    const r = weekly ? P.WEEKLY_REWARD : P.DAILY_REWARD;
    if (r.gems) plState.gems = (plState.gems || 0) + r.gems;
    setCoins(r.coins * prestigeK());
    addSP(r.sp);
    floatWin(`+${fmtShort(r.coins * prestigeK())}`, '#5fc2ae');
    renderQuests();
  }

  function renderSeasonModal() {
    const s = plState.season;
    $('#season-grid').innerHTML = Array.from({ length: P.SEASON_LEVELS }, (_, k) => {
      const l = k + 1, r = P.seasonReward(l), got = s.level >= l, special = r.skin || r.tuning || l % 10 === 0;
      return `<div class="season-cell ${got ? 'got' : ''} ${special ? 'special' : ''}"><span>${l}</span><b>${r.label}</b>${got ? '<i>✓</i>' : ''}</div>`;
    }).join('');
    $('#season-info').textContent = `Уровень ${s.level} / ${P.SEASON_LEVELS} · ${s.sp} SP · очки: 1 за крутку, 100 за задание дня, 400 за задание недели`;
  }

  /* --- автосалон --- */
  const carDef = (id) => P.CARS.find((c) => c.id === id);
  if (!plState.cars) plState.cars = [];
  if (plState.trades == null) plState.trades = 0;

  // кузов рисуем SVG: седан, спорткар, внедорожник, лимузин
  function carSVG(body, color) {
    const shapes = {
      sedan: 'M14 78 Q12 62 36 58 L74 38 Q84 32 104 32 L156 32 Q170 32 182 42 L204 56 Q230 58 234 70 L234 80 Q234 86 226 86 L20 86 Q14 86 14 80 Z',
      sport: 'M12 80 Q12 66 34 62 L84 42 Q96 36 116 36 L150 36 Q168 38 186 50 L212 62 Q234 64 236 74 L236 82 Q236 86 228 86 L18 86 Q12 86 12 80 Z',
      suv: 'M16 84 L16 50 Q16 42 26 40 L62 38 L82 18 Q86 14 94 14 L186 14 Q196 14 200 24 L208 40 L224 42 Q232 44 232 54 L232 84 Z',
      limo: 'M8 78 Q8 62 30 58 L68 40 Q78 34 98 34 L182 34 Q196 34 208 44 L226 56 Q246 58 248 70 L248 80 Q248 86 240 86 L14 86 Q8 86 8 78 Z',
    };
    const win = {
      sedan: 'M82 42 L104 37 L130 37 L130 56 L76 56 Z M136 37 L156 37 Q166 37 176 46 L184 56 L136 56 Z',
      sport: 'M92 46 L116 41 L138 41 L138 58 L84 58 Z M144 41 L152 41 Q166 43 178 52 L182 58 L144 58 Z',
      suv: 'M88 22 L134 22 L134 40 L72 40 Z M140 22 L184 22 Q190 22 193 30 L198 40 L140 40 Z',
      limo: 'M76 44 L98 39 L130 39 L130 58 L70 58 Z M136 39 L176 39 L176 58 L136 58 Z M182 39 Q194 40 204 48 L210 58 L182 58 Z',
    };
    const wheelsX = body === 'limo' ? [50, 206] : body === 'suv' ? [60, 196] : [56, 194];
    return `<svg viewBox="0 0 250 100" class="car-svg">
      <ellipse cx="125" cy="92" rx="112" ry="6" fill="rgba(0,0,0,.35)"/>
      <path d="${shapes[body]}" fill="${color}" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>
      <path d="${shapes[body]}" fill="url(#shine)" opacity=".35"/>
      <path d="${win[body]}" fill="#1b2633" opacity=".9"/>
      <defs><linearGradient id="shine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      ${wheelsX.map((x) => `<circle cx="${x}" cy="84" r="15" fill="#121212"/><circle cx="${x}" cy="84" r="8" fill="#9aa0a6"/><circle cx="${x}" cy="84" r="3" fill="#333"/>`).join('')}
      <rect x="${body === 'suv' ? 222 : 226}" y="62" width="8" height="5" rx="2" fill="#ffe9a8"/>
    </svg>`;
  }
  const carBoostLine = (c) => Object.entries(c.boost).map(([k, v]) => P.BOOST_TEXT[k](v)).join(', ');
  // номер на тачке: лучший из автопарка или коллекции
  const showPlate = () => {
    const all = [...plState.fleet, ...plState.best].sort((a, b) => b.total - a.total);
    return all[0] ? all[0].p : { l1: 'А', digits: '001', l2: 'АА', region: '77' };
  };
  const carHTML = (c, plate, skin) => `<div class="car-wrap">${carSVG(c.body, c.color)}<span class="mini-plate car-plate skin-${skin}"><b>${plate.l1}${plate.digits}${plate.l2}</b><em>${plate.region}</em></span></div>`;

  function renderSalon() {
    $('#salon-bonus').textContent = `Тачек: ${plState.cars.length} · бонус гаража +${(plState.cars.length * P.CAR_COLLECTION_BONUS).toFixed(1)}% к выплатам${plState.car ? ` · выбрана: ${carDef(plState.car).name}` : ''}`;
    $('#salon-grid').innerHTML = P.CARS.map((c) => {
      const owned = plState.cars.includes(c.id), on = plState.car === c.id;
      return `<div class="salon-card ${on ? 'on' : ''}">
        ${carHTML(c, showPlate(), plState.skin)}
        <b>${esc(c.name)}</b><small>${carBoostLine(c)}</small>
        ${on ? '<span class="mk-owned">ВЫБРАНА</span>' : owned ? `<button class="tn-btn" data-car-sel="${c.id}">Сесть за руль</button>`
          : `<button class="tn-btn buy" data-car-buy="${c.id}" ${plState.coins < c.price ? 'disabled' : ''}><i class="coin"></i>${fmtShort(c.price)}</button>`}
      </div>`;
    }).join('');
  }
  $('#salon-grid').onclick = (e) => {
    const buy = e.target.closest('[data-car-buy]'), sel = e.target.closest('[data-car-sel]');
    if (buy) {
      const c = carDef(buy.dataset.carBuy);
      if (plState.coins < c.price || plState.cars.includes(c.id)) return;
      plState.cars.push(c.id);
      plState.car = c.id;
      setCoins(-c.price);
      toast(`🚘 Новая тачка: ${c.name}!`);
      burst('#f0c552', 40);
    } else if (sel) plState.car = sel.dataset.carSel;
    else return;
    savePl();
    renderSalon();
    refreshPlates();
  };

  /* --- профиль игрока --- */
  const BADGES = {
    spin1: '🎰', spin100: '💯', spin1000: '🏭', rare: '🔷', epic: '🟣', legendary: '🟠', mythic: '🔴', s777: '7️⃣', elite: '🏛',
    word: '🔤', r77: '🏙', upgrade: '⬆️', skin: '🎨', bigwin: '💸', work: '💼', online1: '🌐', key1: '🔑', prestige1: '⭐',
    tune1: '🔧', style50: '✨', auction1: '🔨', gems100: '💎', rich: '💰', rich2: '🏦', million: '🤑', car1: '🚘', trade1: '🤝', season10: '🏁',
  };
  // краткая карточка — её же видят соперники в онлайне
  function myCard() {
    return {
      nick: profile.nick.trim() || 'Игрок', grad: profile.grad,
      title: P.titleFor(plState.level), prestige: plState.prestige || 0, level: plState.level,
      skin: plState.skin, car: plState.car || null, plate: showPlate(),
      style: styleNow(), season: (plState.season || {}).level || 0,
      stats: {
        spins: plState.spins, bestWin: plState.bestWin || 0, mythic: (plState.tiers || {}).mythic || 0,
        duels: plState.duels.w, online: (plState.pvpStats || {}).wins || 0, fleet: plState.fleet.length, cars: plState.cars.length,
      },
      badges: Object.keys(plState.quests || {}).filter((id) => BADGES[id]),
    };
  }

  function profileHTML(c, photo) {
    const ava = photo ? `url("${photo}")` : GRADS[c.grad] || GRADS[0];
    const car = c.car && carDef(c.car);
    const st = c.stats || {};
    const stat = (v, l) => `<div><b>${v}</b><span>${l}</span></div>`;
    return `
      <div class="pf-head">
        <div class="on-ava ${photo ? 'photo-on' : ''}" style="--ava:${esc(ava)}">${esc(initials(c.nick))}</div>
        <div><div class="pf-nick">${esc(c.nick)}</div><div class="pf-title">${c.prestige ? `★${c.prestige} ` : ''}${esc(c.title)} · ур. ${c.level} · сезон ${c.season}/${P.SEASON_LEVELS}</div></div>
      </div>
      <div class="pf-garage">${car ? carHTML(car, c.plate, c.skin) : `<div class="pf-nocar"><span class="mini-plate skin-${c.skin}"><b>${c.plate.l1}${c.plate.digits}${c.plate.l2}</b><em>${c.plate.region}</em></span><small>Пешком — тачки пока нет</small></div>`}
        ${car ? `<div class="pf-carname">${esc(car.name)}</div>` : ''}</div>
      <div class="pf-stats">
        ${stat(fmtShort(st.spins || 0), 'круток')}${stat(fmtShort(st.bestWin || 0), 'лучший выигрыш')}${stat(st.mythic || 0, 'мификов')}
        ${stat(st.duels || 0, 'побед над Ашотом')}${stat(st.online || 0, 'побед онлайн')}${stat(c.style || 0, 'стиля')}
        ${stat(st.fleet || 0, 'в автопарке')}${stat(st.cars || 0, 'тачек')}
      </div>
      <div class="pf-badges">${(c.badges || []).map((b) => `<span title="${esc((P.QUESTS.find((q) => q.id === b) || {}).name || '')}">${BADGES[b]}</span>`).join('') || '<small>Значков пока нет — выполняй достижения</small>'}</div>`;
  }
  function openProfile(card, photo) {
    $('#pf-body').innerHTML = profileHTML(card, photo);
    $('#profile-modal').hidden = false;
  }

  /* --- обмен с кентами --- */
  const TR = { ch: null, code: '', opp: null, mine: { coins: 0, gems: 0, items: [] }, theirs: null, myOk: false, theirOk: false, done: false };
  const itemKey = (it) => `${it.kind}:${it.id || P.format(it.p)}`;
  const itemLabel = (it) => (it.kind === 'key' ? `🔑 ${P.KEYCHAINS.find((k) => k.id === it.id).name}`
    : it.kind === 'skin' ? `🎨 Скин «${P.SKINS.find((s) => s.id === it.id).name}»` : `🚗 ${P.format(it.p)} (${P.TIERS.find((t) => t.id === it.tier).name})`);
  function myTradeables() {
    return [
      ...plState.keys.map((id) => ({ kind: 'key', id })),
      ...plState.skins.filter((id) => id !== 'classic').map((id) => ({ kind: 'skin', id })),
      ...plState.fleet.map((f) => ({ kind: 'fleet', p: f.p, total: f.total, tier: f.tier })),
    ];
  }
  const trSig = (a, b) => JSON.stringify([a.coins, a.gems, a.items.map(itemKey).sort(), b.coins, b.gems, b.items.map(itemKey).sort()]);
  const trSend = (event, payload = {}) => TR.ch && TR.ch.send({ type: 'broadcast', event, payload: { ...payload, from: aucId } });

  function renderTrade() {
    $('#tr-code-v').textContent = TR.code;
    $('#tr-opp-name').textContent = TR.opp ? TR.opp.nick : 'ждём кента…';
    const list = (o) => (o && (o.coins || o.gems || o.items.length)
      ? [o.coins ? `<div><i class="coin"></i>${fmt(o.coins)}</div>` : '', o.gems ? `<div><i class="gem"></i>${fmt(o.gems)}</div>` : '', ...o.items.map((it) => `<div>${esc(itemLabel(it))}</div>`)].join('')
      : '<div class="note">Пусто</div>');
    $('#tr-mine-list').innerHTML = list(TR.mine);
    $('#tr-their-list').innerHTML = list(TR.theirs);
    const sel = $('#tr-item');
    const chosen = new Set(TR.mine.items.map(itemKey));
    sel.innerHTML = '<option value="">+ добавить вещь…</option>' + myTradeables().filter((it) => !chosen.has(itemKey(it))).map((it, i) => `<option value="${i}">${esc(itemLabel(it))}</option>`).join('');
    $('#tr-ok').disabled = !TR.opp || !TR.theirs || TR.myOk || TR.done;
    $('#tr-ok').textContent = TR.done ? 'Обмен выполнен ✓' : TR.myOk ? 'Ждём подтверждения кента…' : 'Подтверждаю обмен';
    $('#tr-status').textContent = TR.done ? '🤝 Готово! Вещи и монеты переехали.' : TR.theirOk ? `${TR.opp.nick} подтвердил — твоя очередь` : TR.myOk ? 'Ты подтвердил' : 'Соберите предложения и подтвердите оба';
  }
  function trOfferChanged() {
    TR.myOk = false;
    TR.theirOk = false;
    trSend('offer', { offer: TR.mine });
    renderTrade();
  }
  $('#tr-coins').onchange = () => { TR.mine.coins = Math.max(0, Math.min(Math.floor(+$('#tr-coins').value || 0), Math.floor(plState.coins))); $('#tr-coins').value = TR.mine.coins; trOfferChanged(); };
  $('#tr-gems').onchange = () => { TR.mine.gems = Math.max(0, Math.min(Math.floor(+$('#tr-gems').value || 0), plState.gems || 0)); $('#tr-gems').value = TR.mine.gems; trOfferChanged(); };
  $('#tr-item').onchange = () => {
    const v = $('#tr-item').value;
    if (v === '') return;
    if (TR.mine.items.length >= 3) { toast('Не больше 3 вещей за раз'); return renderTrade(); }
    const chosen = new Set(TR.mine.items.map(itemKey));
    TR.mine.items.push(myTradeables().filter((it) => !chosen.has(itemKey(it)))[+v]);
    trOfferChanged();
  };
  $('#tr-clear').onclick = () => { TR.mine = { coins: 0, gems: 0, items: [] }; $('#tr-coins').value = ''; $('#tr-gems').value = ''; trOfferChanged(); };

  function trExecute() {
    if (TR.done) return;
    const m = TR.mine, t = TR.theirs;
    // проверяем, что всё своё ещё на месте
    const have = myTradeables().map(itemKey);
    if (plState.coins < m.coins || (plState.gems || 0) < m.gems || !m.items.every((it) => have.includes(itemKey(it)))) {
      toast('Обмен отменён: у тебя уже нет части предложенного');
      trSend('fail', {});
      return trOfferChanged();
    }
    plState.coins += t.coins - m.coins;
    plState.gems = (plState.gems || 0) + t.gems - m.gems;
    m.items.forEach((it) => {
      if (it.kind === 'key') { plState.keys = plState.keys.filter((x) => x !== it.id); plState.keyEq = plState.keyEq.filter((x) => x !== it.id); }
      if (it.kind === 'skin') { plState.skins = plState.skins.filter((x) => x !== it.id); if (plState.skin === it.id) plState.skin = 'classic'; }
      if (it.kind === 'fleet') { const i = plState.fleet.findIndex((f) => P.format(f.p) === P.format(it.p)); if (i >= 0) plState.fleet.splice(i, 1); }
    });
    t.items.forEach((it) => {
      if (it.kind === 'key' && !plState.keys.includes(it.id)) plState.keys.push(it.id);
      if (it.kind === 'skin' && !plState.skins.includes(it.id)) plState.skins.push(it.id);
      if (it.kind === 'fleet') plState.fleet.push({ p: it.p, total: it.total, tier: it.tier, ts: Date.now() });
    });
    plState.trades = (plState.trades || 0) + 1;
    TR.done = true;
    savePl();
    refreshPlates();
    toast('🤝 Обмен выполнен!');
    renderTrade();
  }

  async function trJoin(code) {
    if (!aucSb) return toast('Обмен работает только онлайн');
    await trLeave(true);
    Object.assign(TR, { code, opp: null, mine: { coins: 0, gems: 0, items: [] }, theirs: null, myOk: false, theirOk: false, done: false });
    $('#tr-coins').value = '';
    $('#tr-gems').value = '';
    const ch = aucSb.channel(`qb-trade-${code}`, { config: { broadcast: { self: false }, presence: { key: aucId } } });
    TR.ch = ch;
    ch.on('presence', { event: 'sync' }, () => {
      const others = Object.keys(ch.presenceState()).filter((k) => k !== aucId);
      if (others.length > 1) { toast('В этой комнате уже идёт обмен'); return trLeave(); }
      if (!others.length && TR.opp) { toast(`${TR.opp.nick} вышел из обмена`); TR.opp = null; TR.theirs = null; TR.myOk = TR.theirOk = false; }
      if (others.length && !TR.opp) trSend('hello', { nick: myNick(), offer: TR.mine });
      renderTrade();
    });
    ch.on('broadcast', { event: 'hello' }, ({ payload }) => {
      const first = !TR.opp;
      TR.opp = { id: payload.from, nick: payload.nick };
      TR.theirs = payload.offer;
      if (first) trSend('hello', { nick: myNick(), offer: TR.mine });
      renderTrade();
    });
    ch.on('broadcast', { event: 'offer' }, ({ payload }) => { TR.theirs = payload.offer; TR.myOk = false; TR.theirOk = false; TR.done = false; renderTrade(); });
    ch.on('broadcast', { event: 'ok' }, ({ payload }) => {
      if (payload.sig !== trSig(TR.theirs, TR.mine)) return;
      TR.theirOk = true;
      renderTrade();
      if (TR.myOk) trExecute();
    });
    ch.on('broadcast', { event: 'fail' }, () => { toast('Кент не смог отдать предложенное — обмен отменён'); TR.myOk = TR.theirOk = false; renderTrade(); });
    ch.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      await ch.track({ id: aucId });
      $('#tr-menu').hidden = true;
      $('#tr-room').hidden = false;
      renderTrade();
    });
  }
  async function trLeave(silent) {
    if (TR.ch) { const ch = TR.ch; TR.ch = null; try { await ch.untrack(); await aucSb.removeChannel(ch); } catch {} }
    if (!silent) { $('#tr-menu').hidden = false; $('#tr-room').hidden = true; }
  }
  $('#tr-ok').onclick = () => {
    if (!TR.opp || !TR.theirs || TR.myOk) return;
    TR.myOk = true;
    trSend('ok', { sig: trSig(TR.mine, TR.theirs) });
    renderTrade();
    if (TR.theirOk) trExecute();
  };
  $('#tr-create').onclick = () => { let c = 'TR-'; for (let i = 0; i < 4; i++) c += G.rnd.pick('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split('')); trJoin(c); };
  $('#tr-join').onclick = () => {
    let c = $('#tr-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.startsWith('TR')) c = c.slice(2);
    if (c.length !== 4) return toast('Код — 4 символа, например TR-7K2M');
    trJoin('TR-' + c);
  };
  $('#tr-copy').onclick = () => copy(TR.code);
  $('#tr-leave').onclick = () => trLeave();

  /* --- панель кнопок над номером --- */
  $('#pl-salon').onclick = () => { renderSalon(); $('#salon-modal').hidden = false; };
  $('#pl-profile').onclick = () => openProfile(myCard(), profile.photo);
  $('#pl-trade').onclick = () => { if (!TR.ch) { $('#tr-menu').hidden = false; $('#tr-room').hidden = true; } else renderTrade(); $('#trade-modal').hidden = false; };
  ['salon', 'profile', 'trade', 'season'].forEach((m) => { $(`#${m}-close`).onclick = () => { $(`#${m}-modal`).hidden = true; }; });

  tickGarage();
  setInterval(() => tickGarage(true), 15000);
  if (!plState.hist.length) plState.hist.push(plState.coins);
  refreshPlates();

  /* ---------------- онлайн-батл ---------------- */
  // Комнаты — realtime-каналы Supabase (broadcast + presence), до 4 игроков.
  // Честность: каждый шлёт хеш своего зерна, потом само зерно; номера всех игроков
  // считаются из всех зёрен вместе, поэтому подкрутить результат нельзя.
  const sb = window.supabase && window.QB_ONLINE
    ? window.supabase.createClient(window.QB_ONLINE.url, window.QB_ONLINE.key, { auth: { persistSession: false } })
    : null;
  let myId = load('qb.pid', null);
  if (!myId) { myId = G.uuid4(); store('qb.pid', myId); }
  if (!plState.pvp) plState.pvp = {};
  if (!plState.pvpStats) plState.pvpStats = { games: 0, wins: 0 };

  const MAX_PLAYERS = 4;
  const ON_STAKES = [10, 100, 1000, 10000, 100000, 1000000];
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const room = { ch: null, code: '', joinedAt: 0, host: false, players: [], infos: {}, stake: 10, round: null };
  let smallPhoto = '', revealTimer = null;

  const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  const sha = async (s) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

  // Детерминированный ГСЧ из общего хеша (xoshiro128**) — одинаковый у всех игроков
  function seededRnd(hashHex) {
    const s = [0, 8, 16, 24].map((i) => parseInt(hashHex.slice(i, i + 8), 16) >>> 0);
    const rotl = (x, k) => (x << k) | (x >>> (32 - k));
    const next = () => {
      const r = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
      const t = s[1] << 9;
      s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11);
      return r;
    };
    const int = (min, max) => min + Math.floor((next() / 4294967296) * (max - min + 1));
    return { int, pick: (arr) => arr[int(0, arr.length - 1)] };
  }

  function makeSmallPhoto() {
    if (!profile.photo) { smallPhoto = ''; return Promise.resolve(); }
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        c.getContext('2d').drawImage(img, 0, 0, 64, 64);
        smallPhoto = c.toDataURL('image/webp', 0.8);
        res();
      };
      img.onerror = () => res();
      img.src = profile.photo;
    });
  }

  const meInfo = () => ({
    id: myId,
    nick: profile.nick.trim() || `Игрок ${myId.slice(0, 4).toUpperCase()}`,
    level: plState.level, title: P.titleFor(plState.level),
    grad: profile.grad, photo: smallPhoto, card: myCard(),
  });
  const infoOf = (id) => (id === myId ? meInfo() : room.infos[id]);
  const nickOf = (id) => (infoOf(id) || {}).nick || 'Игрок';

  function slotHTML(id) {
    if (!id) return `<div class="on-slot empty"><div class="on-wait"><span class="on-spinner"></span>Свободно<small>Скинь код кенту</small></div></div>`;
    const pl = infoOf(id) || { nick: '…', title: '', level: '?', grad: 0 };
    const ava = pl.photo ? `url("${pl.photo}")` : GRADS[pl.grad] || GRADS[0];
    const ready = room.round && room.round.commits[id];
    return `
      <div class="on-slot ${id === myId ? 'me' : ''}" data-id="${id}">
        <div class="on-player">
          ${room.players[0] && room.players[0].id === id ? '<span class="on-host" title="Создатель комнаты">👑</span>' : ''}
          <div class="on-ava ${pl.photo ? 'photo-on' : ''}" style="--ava:${esc(ava)}">${esc(initials(pl.nick))}</div>
          <div class="on-nick">${esc(pl.nick)}${id === myId ? ' <small>(ты)</small>' : ''}</div>
          <div class="on-title">${esc(pl.title || '')} · ур. ${pl.level}</div>
          <div class="on-status ${ready ? 'ok' : ''}">${ready ? 'Готов' : 'Думает'}</div>
        </div>
        <div class="duel-plate on-plate" id="on-plate-${id}"><span class="duel-q">?</span></div>
      </div>`;
  }

  function renderRoom() {
    $('#on-code-v').textContent = room.code;
    const ids = room.players.map((p) => p.id);
    const slots = [...ids];
    while (slots.length < Math.max(2, Math.min(MAX_PLAYERS, ids.length + 1))) slots.push(null);
    // не перерисовываем номера во время раскрутки
    if (!(room.round && room.round.resolving)) {
      $('#on-grid').innerHTML = slots.map(slotHTML).join('');
      $('#on-grid').dataset.n = slots.length;
    } else {
      $$('#on-grid .on-slot[data-id]').forEach((el) => {
        const st = $('.on-status', el);
        if (st) { st.textContent = 'Готов'; st.classList.add('ok'); }
      });
    }
    const busy = !!room.round;
    $('#on-stakes').innerHTML = ON_STAKES.map((v) => `<button data-v="${v}" class="${v === room.stake ? 'on' : ''}" ${!room.host || busy ? 'disabled' : ''}>${stakeLabel(v)}</button>`).join('');
    $('#on-custom-row').hidden = !room.host;
    $('#on-custom').disabled = $('#on-custom-ok').disabled = busy;
    $('#on-stake-hint').textContent = room.host ? '· ВЫБИРАЕШЬ ТЫ' : '· ВЫБИРАЕТ СОЗДАТЕЛЬ 👑';
    const ready = $('#on-ready');
    const mine = room.round && room.round.commits[myId];
    ready.disabled = ids.length < 2 || !!mine || (room.round && room.round.resolving);
    ready.innerHTML = mine ? 'Ждём остальных…' : `Готов · ставка <i class="coin"></i>${room.stake} · банк ${room.stake * Math.max(2, ids.length)}`;
    const st = plState.pvpStats;
    $('#on-score').textContent = `Онлайн: побед ${st.wins} из ${st.games}`;
    $('#on-emojis').hidden = ids.length < 2;
  }

  function onMenu() {
    $('#on-menu').hidden = false;
    $('#on-room').hidden = true;
    $('#on-status').textContent = sb ? '' : 'Онлайн недоступен: не загрузилась библиотека';
  }

  $('#pl-online').onclick = () => {
    $('#online-modal').hidden = false;
    if (!room.ch) onMenu();
    else renderRoom();
  };
  $('#on-close').onclick = () => { $('#online-modal').hidden = true; };

  const send = (event, payload = {}) => room.ch && room.ch.send({ type: 'broadcast', event, payload: { ...payload, from: myId } });

  // Отмена раунда: своя ставка возвращается
  function abortRound(reason) {
    clearTimeout(revealTimer);
    if (room.round && room.round.mySeed && !room.round.settled) {
      setCoins(room.stake);
      if (reason) toast(reason);
    }
    room.round = null;
  }

  const newRound = () => ({ commits: {}, seeds: {}, mySeed: null, revealed: false, settled: false, resolving: false });

  async function joinRoom(code, creating) {
    if (!sb) return toast('Онлайн недоступен');
    await leaveRoom(true);
    await makeSmallPhoto();
    Object.assign(room, { code, joinedAt: Date.now(), players: [], infos: {}, stake: 10, round: null, host: false });
    $('#on-status').textContent = 'Подключаюсь…';
    const ch = sb.channel(`qb-room-${code}`, { config: { broadcast: { self: false, ack: false }, presence: { key: myId } } });
    room.ch = ch;

    ch.on('presence', { event: 'sync' }, () => {
      const list = Object.values(ch.presenceState()).map((a) => a[0]).filter(Boolean)
        .sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
      if (list.findIndex((x) => x.id === myId) >= MAX_PLAYERS) {
        toast('Комната заполнена — там уже 4 игрока');
        leaveRoom();
        return;
      }
      const prev = room.players.map((p) => p.id).join();
      room.players = list.slice(0, MAX_PLAYERS);
      room.host = room.players[0] && room.players[0].id === myId;
      const now = room.players.map((p) => p.id).join();
      if (prev && prev !== now && room.round && !room.round.resolving) {
        abortRound('Состав комнаты изменился — ставка возвращена, жмите «Готов» заново');
      }
      const unknown = room.players.some((p) => p.id !== myId && !room.infos[p.id]);
      if (unknown) send('hello', { player: meInfo() });
      if (room.players.length < 2) $('#on-res').textContent = 'Ждём кентов… Скинь им код';
      renderRoom();
    });
    ch.on('broadcast', { event: 'hello' }, ({ payload }) => {
      const p = payload.player, isNew = !room.infos[p.id];
      room.infos[p.id] = p;
      if (isNew) {
        send('hello', { player: meInfo() });
        if (room.host) send('stake', { stake: room.stake });
        toast(`${p.nick} в комнате`);
        $('#on-res').textContent = 'Все в сборе? Жмите «Готов»';
        $('#on-res').className = 'duel-res';
      }
      renderRoom();
    });
    ch.on('broadcast', { event: 'stake' }, ({ payload }) => {
      if (room.host || room.round) return;
      room.stake = payload.stake;
      renderRoom();
    });
    ch.on('broadcast', { event: 'ready' }, ({ payload }) => {
      if (payload.stake !== room.stake) {
        if (room.host) send('reject', { stake: room.stake, to: payload.from });
        return;
      }
      if (!room.round) room.round = newRound();
      room.round.commits[payload.from] = payload.commit;
      $('#on-res').textContent = `${nickOf(payload.from)} готов`;
      renderRoom();
      maybeReveal();
    });
    ch.on('broadcast', { event: 'reject' }, ({ payload }) => {
      if (payload.to !== myId) return;
      abortRound('Ставка изменилась — жми «Готов» ещё раз');
      room.stake = payload.stake;
      renderRoom();
    });
    ch.on('broadcast', { event: 'reveal' }, async ({ payload }) => {
      const r = room.round;
      if (!r || !r.commits[payload.from]) return;
      if ((await sha(payload.seed)) !== r.commits[payload.from]) {
        abortRound(`${nickOf(payload.from)} прислал неверные данные — ставка возвращена`);
        return renderRoom();
      }
      r.seeds[payload.from] = payload.seed;
      maybeResolve();
    });
    ch.on('broadcast', { event: 'emoji' }, ({ payload }) => {
      const el = $(`#on-grid .on-slot[data-id="${payload.from}"] .on-player`);
      if (el) flyEmoji(el, payload.e);
    });

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ id: myId, t: room.joinedAt, nick: meInfo().nick });
        $('#on-menu').hidden = true;
        $('#on-room').hidden = false;
        $('#on-res').textContent = creating ? 'Комната создана. Скинь код кентам (до 3 человек)' : 'Подключился…';
        $('#on-res').className = 'duel-res';
        renderRoom();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        $('#on-status').textContent = 'Не получилось подключиться. Проверь интернет';
      }
    });
  }

  async function leaveRoom(silent) {
    if (!room.ch) { if (!silent) onMenu(); return; }
    abortRound('Ставка возвращена');
    const ch = room.ch;
    room.ch = null;
    room.players = [];
    try { await ch.untrack(); await sb.removeChannel(ch); } catch {}
    if (!silent) onMenu();
  }

  $('#on-create').onclick = () => {
    let code = 'QB-';
    for (let i = 0; i < 4; i++) code += G.rnd.pick(CODE_CHARS.split(''));
    joinRoom(code, true);
  };
  $('#on-join').onclick = () => {
    let c = $('#on-code').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.startsWith('QB')) c = c.slice(2);
    if (c.length !== 4) return toast('Код — 4 символа, например QB-7K2M');
    joinRoom('QB-' + c, false);
  };
  $('#on-code').onkeydown = (e) => { if (e.key === 'Enter') $('#on-join').click(); };
  $('#on-copy').onclick = () => copy(room.code);
  $('#on-leave').onclick = () => leaveRoom();

  function setRoomStake(v) {
    if (!room.host || room.round) return;
    if (!(v >= 1)) return toast('Введи сумму, например 50000 или 50к');
    room.stake = v;
    $('#on-custom').value = '';
    send('stake', { stake: room.stake });
    renderRoom();
  }
  $('#on-stakes').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    setRoomStake(+b.dataset.v);
  };
  $('#on-custom-ok').onclick = () => setRoomStake(parseStake($('#on-custom').value));
  $('#on-custom').onkeydown = (e) => { if (e.key === 'Enter') $('#on-custom-ok').click(); };

  $('#on-ready').onclick = async () => {
    if (room.players.length < 2) return;
    if (room.round && (room.round.commits[myId] || room.round.resolving)) return;
    if (plState.coins < room.stake) return toast('Не хватает монет на эту ставку');
    if (!room.round) room.round = newRound();
    const seed = hex(crypto.getRandomValues(new Uint8Array(16)));
    const commit = await sha(seed);
    room.round.mySeed = seed;
    room.round.commits[myId] = commit;
    setCoins(-room.stake); // ставка «в банке» до конца раунда
    send('ready', { commit, stake: room.stake });
    $('#on-res').textContent = 'Ты готов. Ждём остальных…';
    $('#on-res').className = 'duel-res';
    renderRoom();
    maybeReveal();
  };

  const allCommitted = () => room.round && room.players.length >= 2 && room.players.every((p) => room.round.commits[p.id]);

  function maybeReveal() {
    const r = room.round;
    if (!r || r.revealed || !r.mySeed || !allCommitted()) return;
    r.revealed = true;
    r.resolving = true;
    r.order = room.players.map((p) => p.id);
    r.seeds[myId] = r.mySeed;
    send('reveal', { seed: r.mySeed });
    $('#on-res').textContent = 'Все готовы — крутим!';
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      if (room.round === r && !r.settled) {
        r.resolving = false;
        abortRound('Кто-то не ответил — ставка возвращена');
        renderRoom();
      }
    }, 12000);
    renderRoom();
    maybeResolve();
  }

  async function maybeResolve() {
    const r = room.round;
    if (!r || !r.revealed || r.settled || !r.order.every((id) => r.seeds[id])) return;
    r.settled = true;
    clearTimeout(revealTimer);
    const combined = await sha(r.order.map((id) => r.seeds[id]).join(':'));
    const rng = seededRnd(combined);
    const res = r.order.map((id) => { const p = P.random(0, rng); return { id, p, sc: P.score(p) }; });

    // лучшие по очкам, при равенстве — по цифрам и региону; полная ничья делит банк
    const best = res.reduce((a, b) => (duelCmp(b, a) > 0 ? b : a));
    const winners = res.filter((x) => duelCmp(x, best) === 0);
    const pot = room.stake * res.length;
    const share = Math.floor(pot / winners.length);
    const iWon = winners.some((w) => w.id === myId);
    // деньги начисляем сразу, анимация — только показ
    if (iWon) setCoins(share);

    plState.pvpStats.games++;
    res.forEach((x) => {
      if (x.id === myId) return;
      const rec = plState.pvp[x.id] || (plState.pvp[x.id] = { nick: nickOf(x.id), w: 0, l: 0 });
      rec.nick = nickOf(x.id);
      if (iWon && !winners.some((w) => w.id === x.id)) rec.w++;
      if (!iWon && winners.some((w) => w.id === x.id)) rec.l++;
    });
    if (iWon) { plState.pvpStats.wins++; plState.gems = (plState.gems || 0) + 2; }
    savePl();
    room.round = null;

    await Promise.all(res.map((x, i) => shuffleInto($(`#on-plate-${x.id}`), x.p, 1100 + i * 250)));
    res.forEach((x) => {
      $(`#on-plate-${x.id}`).insertAdjacentHTML('beforeend', `<div class="duel-sc"><b style="color:${x.sc.tier.color}">${x.sc.tier.name}</b> · ${x.sc.total}</div>`);
    });
    winners.forEach((w) => $(`#on-grid .on-slot[data-id="${w.id}"]`)?.classList.add('winner'));
    const out = $('#on-res');
    if (iWon) {
      out.innerHTML = winners.length > 1 ? `🤝 Ничья наверху — делите банк: +${fmt(share)}` : `🏆 Ты забрал банк: +${fmt(share)}`;
      out.className = 'duel-res win';
    } else {
      out.innerHTML = `${winners.map((w) => esc(nickOf(w.id))).join(' и ')} ${winners.length > 1 ? 'делят' : 'забирает'} банк ${fmt(pot)}`;
      out.className = 'duel-res lose';
    }
    renderRoomAfterRound();
    refreshPlates();
  }

  // После раунда показываем номера, но разблокируем кнопки
  function renderRoomAfterRound() {
    const ready = $('#on-ready');
    ready.disabled = room.players.length < 2;
    ready.innerHTML = `Ещё раунд · ставка <i class="coin"></i>${room.stake}`;
    $$('#on-grid .on-status').forEach((s) => { s.textContent = 'Думает'; s.classList.remove('ok'); });
    $$('#on-stakes button').forEach((b) => { b.disabled = !room.host; });
    const st = plState.pvpStats;
    $('#on-score').textContent = `Онлайн: побед ${st.wins} из ${st.games}`;
  }

  function flyEmoji(target, e) {
    const el = document.createElement('span');
    el.className = 'on-emoji-fly';
    el.textContent = e;
    el.style.left = 30 + Math.random() * 40 + '%';
    target.appendChild(el);
    setTimeout(() => el.remove(), 1600);
  }
  // клик по игроку — его профиль
  $('#on-grid').addEventListener('click', (e) => {
    const slot = e.target.closest('.on-slot[data-id]');
    if (!slot) return;
    const info = infoOf(slot.dataset.id);
    if (info && info.card) openProfile(info.card, info.photo);
  });
  $('#on-emojis').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || room.players.length < 2) return;
    send('emoji', { e: b.textContent });
    const el = $(`#on-grid .on-slot[data-id="${myId}"] .on-player`);
    if (el) flyEmoji(el, b.textContent);
  };
  window.addEventListener('beforeunload', () => { if (room.ch) leaveRoom(true); });

  /* ---------------- визуал: 3D-наклон и блик ---------------- */
  function tilt(area, target, max = 10) {
    area.addEventListener('mousemove', (e) => {
      const r = area.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      target.style.setProperty('--ry', `${x * max}deg`);
      target.style.setProperty('--rx', `${-y * max}deg`);
      target.style.setProperty('--gx', `${(x + 0.5) * 100}%`);
      target.style.setProperty('--gy', `${(y + 0.5) * 100}%`);
    });
    area.addEventListener('mouseleave', () => {
      ['--rx', '--ry'].forEach((v) => target.style.setProperty(v, '0deg'));
    });
  }
  tilt($('#pl-stage'), $('#pl-tilt'), 14);

  /* ---------------- settings ---------------- */
  [['set-autocopy', 'autocopy'], ['set-history', 'history'], ['set-mask', 'mask'], ['set-tray', 'tray'], ['set-hotkey', 'hotkey'], ['set-autostart', 'autostart']].forEach(([id, key]) => {
    const el = $('#' + id);
    el.checked = settings[key];
    el.onchange = () => {
      settings[key] = el.checked;
      persist();
      renderDash();
      if (['tray', 'hotkey', 'autostart'].includes(key) && window.qb && window.qb.applySettings) window.qb.applySettings();
    };
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

  const GENS = { plates: () => spinPlate(), tables: () => genTable(), passwords: () => pwMode() !== 'check' && genPasswords(), keys: genKeys, emails: genEmails, phones: genPhones, identity: () => genIdentity(), misc: genMisc };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement.tagName) && GENS[current]) {
      e.preventDefault();
      GENS[current]();
    }
    if (e.code === 'Space' && current === 'plates' && !['TEXTAREA', 'INPUT', 'SELECT', 'BUTTON'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      spinPlate();
    }
    if (e.key === 'Escape') {
      ['#qr-modal', '#whatsnew', '#duel-modal', '#work-modal', '#online-modal', '#market-modal', '#tune-modal', '#auction-modal', '#salon-modal', '#profile-modal', '#trade-modal', '#season-modal'].forEach((m) => { $(m).hidden = true; });
      stopJob();
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
