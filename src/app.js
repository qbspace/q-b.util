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
    spins: 0, best: [], coins: 100, upgrades: {}, skins: ['classic'], skin: 'classic', quests: {},
    tiers: {}, flags: {}, bestWin: 0, won: 0, spent: 0, daily: { last: '', streak: 0 },
    garageTs: Date.now(), batyaTs: 0, bet: 1,
  };
  const plState = Object.assign({}, PL_DEFAULT, load('qb.plates', {}));
  let plCurrent = null, plSpinning = false, plAuto = false;

  const lvl = (id) => plState.upgrades[id] || 0;
  const upg = (id) => P.UPGRADES.find((u) => u.id === id);
  const luckChance = () => lvl('luck') * upg('luck').per / 100;
  const moscowChance = () => lvl('moscow') * upg('moscow').per / 100;
  const payMult = () => 1 + lvl('collector') * upg('collector').per / 100;
  const spinCost = () => P.SPIN_COST * plState.bet;
  // Оценка отдачи по результатам симуляций (на 1 млн круток)
  const rtp = () => Math.round(93 + lvl('luck') * 1.4 + lvl('moscow') * 2.7 + lvl('collector') * 2);
  const fmt = (n) => Math.floor(n).toLocaleString('ru-RU');
  const savePl = () => store('qb.plates', plState);

  function setCoins(delta) {
    plState.coins = Math.max(0, plState.coins + delta);
    savePl();
    renderWallet();
  }

  /* --- гараж: пассивный доход, в том числе пока приложение закрыто --- */
  function tickGarage(silent) {
    const rate = lvl('garage') * upg('garage').per;
    const now = Date.now();
    if (!rate) { plState.garageTs = now; return 0; }
    const minutes = Math.min((now - plState.garageTs) / 60000, 360);
    const whole = Math.floor(minutes);
    if (whole < 1) return 0;
    const gain = whole * rate;
    plState.garageTs = now - (minutes - whole) * 60000;
    plState.coins += gain;
    savePl();
    renderWallet();
    if (!silent && gain >= 10) toast(`Гараж принёс +${fmt(gain)} монет`);
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
  $('#pl-daily').onclick = () => {
    const d = dailyInfo();
    if (!d) return;
    plState.daily = { last: dayKey(), streak: d.streak };
    setCoins(d.reward);
    floatWin(`+${d.reward}`, '#f0b35a');
    toast(`Бонус дня: +${d.reward} · серия ${d.streak} дн.`);
    renderWallet();
  };

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

  function renderWallet() {
    $('#pl-coins').textContent = fmt(plState.coins);
    $('#pl-spins').textContent = fmt(plState.spins);
    $('#pl-rtp').textContent = rtp() + '%';
    const d = dailyInfo();
    $('#pl-daily').hidden = !d;
    if (d) $('#pl-daily-t').textContent = `Бонус дня +${d.reward}`;
    $('#pl-cost').innerHTML = `<i class="coin"></i>${fmt(spinCost())}`;
    const broke = plState.coins < spinCost();
    $('#pl-spin').classList.toggle('broke', broke);
    $('#pl-batya').hidden = !(plState.coins < P.SPIN_COST);
    $('#pl-auto').hidden = !lvl('auto');
    renderBets();
  }

  function renderBets() {
    const bets = P.BETS.filter((b) => b <= 2 || lvl('highroller'));
    if (!bets.includes(plState.bet)) plState.bet = 1;
    $('#pl-bet').innerHTML = bets.map((b) => `<button data-v="${b}" class="${b === plState.bet ? 'on' : ''}">×${b} · ${b * P.SPIN_COST}</button>`).join('');
  }
  $('#pl-bet').onclick = (e) => {
    const b = e.target.closest('button');
    if (!b || plSpinning) return;
    plState.bet = +b.dataset.v;
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
        <b><i class="coin"></i>${fmt(Math.round(P.PAYOUT[t.id] * plState.bet * payMult()))}</b>
      </div>`).join('');
  }

  /* --- магазин --- */
  function renderShop() {
    const ups = P.UPGRADES.map((u) => {
      const l = lvl(u.id), max = u.prices.length, price = u.prices[l];
      const now = +(l * u.per).toFixed(1), next = +((l + 1) * u.per).toFixed(1);
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
    const skins = P.SKINS.map((sk) => {
      const owned = plState.skins.includes(sk.id), active = plState.skin === sk.id;
      return `
        <button class="skin-card ${active ? 'on' : ''}" data-skin="${sk.id}" ${!owned && plState.coins < sk.price ? 'disabled' : ''}>
          <span class="mini-plate skin-${sk.id}"><b>А777МР</b><em>77</em></span>
          <span class="skin-name">${sk.name}</span>
          <span class="skin-price">${active ? 'ВЫБРАН' : owned ? 'НАДЕТЬ' : `<i class="coin"></i>${fmt(sk.price)}`}</span>
        </button>`;
    }).join('');
    $('#pl-shop').innerHTML = `
      <span class="cap">УЛУЧШЕНИЯ</span>
      <div class="shop-list">${ups}</div>
      <span class="cap">СКИНЫ НОМЕРА <span class="dim-cap">· ТОЛЬКО КРАСОТА</span></span>
      <div class="skins">${skins}</div>`;
  }
  $('#pl-shop').onclick = (e) => {
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

  /* --- задания --- */
  function claimable() {
    return P.QUESTS.filter((q) => q.done(plState) && !plState.quests[q.id]).length;
  }
  function renderQuests() {
    const list = [...P.QUESTS].sort((a, b) => {
      const st = (q) => (plState.quests[q.id] ? 2 : q.done(plState) ? 0 : 1);
      return st(a) - st(b);
    });
    $('#pl-quests').innerHTML = list.map((q) => {
      const done = q.done(plState), got = plState.quests[q.id];
      const pr = !done && q.progress ? q.progress(plState) : null;
      return `
        <div class="quest ${got ? 'got' : done ? 'ready' : ''}">
          <div class="quest-body">
            <div class="quest-name">${q.name}</div>
            ${pr ? `<div class="quest-bar"><i style="width:${Math.min(100, (pr[0] / pr[1]) * 100)}%"></i></div><small>${fmt(pr[0])} / ${fmt(pr[1])}</small>` : ''}
          </div>
          ${got ? '<span class="quest-done">✓</span>'
            : done ? `<button class="shop-buy claim" data-q="${q.id}">Забрать <i class="coin"></i>${fmt(q.reward)}</button>`
              : `<span class="quest-reward"><i class="coin"></i>${fmt(q.reward)}</span>`}
        </div>`;
    }).join('');
    const n = claimable();
    $('#pl-qbadge').hidden = !n;
    $('#pl-qbadge').textContent = n;
  }
  $('#pl-quests').onclick = (e) => {
    const b = e.target.closest('[data-q]');
    if (!b) return;
    const q = P.QUESTS.find((x) => x.id === b.dataset.q);
    if (!q.done(plState) || plState.quests[q.id]) return;
    plState.quests[q.id] = Date.now();
    setCoins(q.reward);
    floatWin(`+${fmt(q.reward)}`, '#5fc2ae');
    toast(`Задание «${q.name}»: +${fmt(q.reward)}`);
    refreshPlates();
  };

  /* --- коллекция --- */
  const plateHTML = (p) => `<span class="mini-plate"><b>${p.l1}${p.digits}${p.l2}</b><em>${p.region}</em></span>`;
  function renderBest() {
    if (!plState.best.length) {
      $('#pl-best').innerHTML = `<div class="feed-empty"><div class="sparkle">✦</div><br>ЛУЧШИЕ НОМЕРА БУДУТ ТУТ</div>`;
      return;
    }
    $('#pl-best').innerHTML = plState.best.map((b, i) => {
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
    renderWallet();
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

  async function spinPlate(fast) {
    if (plSpinning) return false;
    const cost = spinCost();
    if (plState.coins < cost) {
      toast(plState.coins < P.SPIN_COST ? 'Монеты кончились — займи у бати или подожди гараж' : 'Не хватает на эту ставку');
      return false;
    }
    plSpinning = true;
    $('#pl-spin').disabled = true;
    setCoins(-cost);
    plState.spent += cost;

    const card = $('#pl-card');
    card.className = 'card plate-card spinning';
    $('#pl-tier').hidden = true;
    $('#pl-result').classList.remove('show');

    // «Связи в ГИБДД»: иногда крутим дважды и берём лучший
    let p = P.random(moscowChance()), sc = P.score(p), second = false;
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
    await Promise.all(reels.map((r, i) => spinReel(r, finals[i], pools[i], Math.round((14 + i * 4) * k), Math.round((900 + i * 210) * k))));

    const t = sc.tier;
    const win = Math.round(P.PAYOUT[t.id] * plState.bet * payMult());
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
    $('#pl-reasons').innerHTML = chips.join('');
    void $('#pl-result').offsetWidth;
    $('#pl-result').classList.add('show');

    const order = P.TIERS.findIndex((x) => x.id === t.id);
    floatWin(`+${fmt(win)}`, t.color);
    if (order >= 2) burst(t.color, [0, 0, 18, 34, 60, 90][order]);
    if (order >= 4) toast(`${t.name.toUpperCase()}: ${P.format(p)} · +${fmt(win)}`);
    refreshPlates();
    plSpinning = false;
    $('#pl-spin').disabled = false;
    return order;
  }

  async function autoSpin() {
    if (plAuto || plSpinning) return;
    plAuto = true;
    $('#pl-auto').classList.add('running');
    for (let i = 0; i < 10 && plAuto; i++) {
      const order = await spinPlate(true);
      if (order === false || order >= 4) break; // нет денег или выпала легендарка
      await new Promise((r) => setTimeout(r, 350));
    }
    plAuto = false;
    $('#pl-auto').classList.remove('running');
  }

  $('#pl-spin').onclick = () => spinPlate();
  $('#pl-auto').onclick = () => (plAuto ? (plAuto = false) : autoSpin());
  $('#pl-copy').onclick = () => (plCurrent ? copy(P.format(plCurrent)) : toast('Сначала крутани'));
  $('#pl-qr').onclick = () => (plCurrent ? showQR(P.format(plCurrent)) : toast('Сначала крутани'));

  tickGarage();
  setInterval(() => tickGarage(true), 15000);
  refreshPlates();

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
    if (e.key === 'Escape') { $('#qr-modal').hidden = true; $('#whatsnew').hidden = true; }
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
