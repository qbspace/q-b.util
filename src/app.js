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
  const kb = (type) => plState.keyEq.reduce((sum, id) => sum + (((P.KEYCHAINS.find((k) => k.id === id) || {}).boost || {})[type] || 0), 0);
  const luckChance = () => (lvl('luck') * upg('luck').per + kb('luck')) / 100;
  const moscowChance = () => (lvl('moscow') * upg('moscow').per + kb('moscow')) / 100;
  const payMult = () => 1 + (lvl('collector') * upg('collector').per + kb('pay') + plState.prestige * P.PRESTIGE_BONUS) / 100;
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

  /* --- гараж: пассивный доход, в том числе пока приложение закрыто --- */
  function tickGarage(silent) {
    const rate = garageRate();
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
      setCoins(reward);
      $('#wheel-res').innerHTML = `Выпало <b>${P.WHEEL[i]}</b> → <b><i class="coin"></i>${reward}</b>`;
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
      const r = P.levelReward(plState.level);
      plState.coins += r;
      toast(`Уровень ${plState.level}: «${P.titleFor(plState.level)}» · +${r}`);
    }
  }

  function renderWallet() {
    $('#pl-coins').textContent = fmtShort(plState.coins);
    $('#pl-coins').title = fmt(plState.coins);
    $('#pl-jp').textContent = fmt(plState.jackpot);
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
    renderBets();
  }

  function renderBets() {
    const bets = P.BETS.filter((b) => b <= P.BET_UNLOCK[lvl('highroller')]);
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
    const skins = P.SKINS.filter((sk) => !sk.market || plState.skins.includes(sk.id)).map((sk) => {
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
    await Promise.all(reels.map((r, i) => spinReel(r, finals[i], pools[i], Math.round((14 + i * 4) * k), Math.round((900 + i * 210) * k))));

    const t = sc.tier;
    const x3 = plState.x3Left > 0;
    if (x3) plState.x3Left--;
    let win = Math.round(P.PAYOUT[t.id] * plState.bet * payMult() * (happyActive() ? 2 : 1) * (x3 ? 3 : 1));
    const extras = [];
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
    for (let i = 0; i < 10 && plAuto; i++) {
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
    $('#mk-reroll').disabled = plState.coins < P.MARKET_REROLL;
    $('#mk-reroll').innerHTML = `🤝 Подкупить продавца — новый завоз · <i class="coin"></i>${fmt(P.MARKET_REROLL)}`;

    // брелки
    $('#mk-eqc').textContent = `${plState.keyEq.length} / ${P.KEY_SLOTS}`;
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
  $('#mk-reroll').onclick = () => {
    if (plState.coins < P.MARKET_REROLL) return;
    plState.market.rerolls++;
    plState.market.bought = {};
    setCoins(-P.MARKET_REROLL);
    toast('Продавец порылся в багажнике: новый завоз');
    renderMarket();
  };

  $('#mk-stock').onclick = (e) => {
    const b = e.target.closest('[data-buy]');
    if (!b) return;
    const i = +b.dataset.buy, s = currentStock()[i], d = itemDef(s);
    if (plState.coins < s.price || owns(s) || (plState.market.bought[i] || 0) >= s.qty) return;
    plState.market.bought[i] = (plState.market.bought[i] || 0) + 1;
    if (s.kind === 'key') {
      plState.keys.push(s.id);
      if (plState.keyEq.length < P.KEY_SLOTS) plState.keyEq.push(s.id);
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
    else if (plState.keyEq.length >= P.KEY_SLOTS) return toast(`Можно носить только ${P.KEY_SLOTS} брелка — сними какой-нибудь`);
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
    grad: profile.grad, photo: smallPhoto,
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
    if (iWon) plState.pvpStats.wins++;
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
      ['#qr-modal', '#whatsnew', '#duel-modal', '#work-modal', '#online-modal', '#market-modal'].forEach((m) => { $(m).hidden = true; });
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
