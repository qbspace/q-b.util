// Все генераторы работают локально и используют криптостойкий ГСЧ.
(function () {
  const rnd = {
    int(min, max) {
      // равномерно в [min, max] без смещения по модулю
      const range = max - min + 1;
      const limit = Math.floor(0x100000000 / range) * range;
      const buf = new Uint32Array(1);
      do crypto.getRandomValues(buf); while (buf[0] >= limit);
      return min + (buf[0] % range);
    },
    pick(arr) { return arr[rnd.int(0, arr.length - 1)]; },
    bytes(n) { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = rnd.int(0, i);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
    digits(n) { let s = ''; for (let i = 0; i < n; i++) s += rnd.int(0, 9); return s; },
  };

  const toHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const toB64 = (b) => btoa(String.fromCharCode(...b));
  const toB64Url = (b) => toB64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  /* ---------------- Пароли ---------------- */
  const SETS = {
    upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lower: 'abcdefghijklmnopqrstuvwxyz',
    digits: '0123456789',
    symbols: '!@#$%^&*()-_=+[]{};:,.<>/?~',
  };
  const AMBIGUOUS = /[Il1O0o|`'"]/g;

  function password(opts) {
    const { length = 16, upper = true, lower = true, digits = true, symbols = true, noAmbiguous = false } = opts;
    const active = Object.entries({ upper, lower, digits, symbols })
      .filter(([, on]) => on)
      .map(([k]) => (noAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));
    if (!active.length) return '';
    const pool = active.join('');
    // по одному символу из каждого включённого набора, остальное — из общего пула
    const chars = active.slice(0, length).map((set) => rnd.pick(set));
    while (chars.length < length) chars.push(rnd.pick(pool));
    return rnd.shuffle(chars).join('');
  }

  const WORDS = ('amber anchor apple arrow atlas autumn badge bamboo banjo beacon berry blade blossom bolt bonus breeze brick bronze cabin cactus candle canyon carbon castle cedar cherry cider cliff cloud cobalt comet coral cosmos cotton crane crisp crown crystal cyber dawn delta desert diesel dingo dragon dune eagle echo ember falcon fern fiber flame flint forest fossil frost galaxy garnet gecko ginger glacier globe granite gravity harbor hazel helium hollow honey horizon husky iceberg indigo iron island ivory jade jaguar jasmine jelly jungle karma kayak kernel kiwi koala lagoon lantern laser lemon lilac lime lotus lunar magnet mango maple marble meadow meteor mint mirror monsoon mosaic nebula neon nickel noble nova oasis ocean olive onyx opal orbit orchid oxide panda panther papaya pebble pepper pixel planet plasma polar prism pulse quartz quasar radar raven reef ribbon river rocket ruby saber saffron salmon sapphire satin shadow signal silver sky solar sonic spark sphinx spruce storm summit sunset tango thunder tiger timber titan topaz tulip tundra turbo umber velvet vertex violet vortex walnut willow winter wolf xenon yonder zebra zenith zephyr').split(' ');

  function passphrase({ words = 4, sep = '-', capitalize = true, addNumber = true }) {
    const parts = Array.from({ length: words }, () => {
      const w = rnd.pick(WORDS);
      return capitalize ? w[0].toUpperCase() + w.slice(1) : w;
    });
    if (addNumber) parts.push(String(rnd.int(10, 99)));
    return parts.join(sep);
  }

  function entropy(pw) {
    let pool = 0;
    if (/[a-z]/.test(pw)) pool += 26;
    if (/[A-Z]/.test(pw)) pool += 26;
    if (/[0-9]/.test(pw)) pool += 10;
    if (/[^a-zA-Z0-9]/.test(pw)) pool += 27;
    return pool ? Math.round(pw.length * Math.log2(pool)) : 0;
  }

  function composition(pw) {
    const c = { upper: 0, lower: 0, digits: 0, symbols: 0 };
    for (const ch of pw) {
      if (/[A-Z]/.test(ch)) c.upper++;
      else if (/[a-z]/.test(ch)) c.lower++;
      else if (/[0-9]/.test(ch)) c.digits++;
      else c.symbols++;
    }
    return c;
  }

  /* ---------------- Ключи ---------------- */
  function uuid4() {
    const b = rnd.bytes(16);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = toHex(b);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  function uuid7() {
    const b = rnd.bytes(16);
    let ts = Date.now();
    for (let i = 5; i >= 0; i--) { b[i] = ts & 0xff; ts = Math.floor(ts / 256); }
    b[6] = (b[6] & 0x0f) | 0x70;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = toHex(b);
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  function ulid() {
    let ts = Date.now(), t = '';
    for (let i = 0; i < 10; i++) { t = CROCKFORD[ts % 32] + t; ts = Math.floor(ts / 32); }
    let r = '';
    for (let i = 0; i < 16; i++) r += rnd.pick(CROCKFORD);
    return t + r;
  }

  const URLSAFE = 'ModuleSymbhasOwnPr-0123456789ABCDEFGHNRVfgctiUvz_KqYTJkLxpZXIjQW';
  const nanoid = (n = 21) => Array.from({ length: n }, () => rnd.pick(URLSAFE)).join('');
  const ALNUM = SETS.upper + SETS.lower + SETS.digits;
  const alnum = (n) => Array.from({ length: n }, () => rnd.pick(ALNUM)).join('');

  function licenseKey(groups = 5, size = 5) {
    const set = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: groups }, () =>
      Array.from({ length: size }, () => rnd.pick(set)).join('')).join('-');
  }

  const KEY_TYPES = {
    uuid4: { label: 'UUID v4', gen: () => uuid4() },
    uuid7: { label: 'UUID v7', gen: () => uuid7() },
    ulid: { label: 'ULID', gen: () => ulid() },
    nanoid: { label: 'NanoID', gen: () => nanoid() },
    hex: { label: 'HEX', gen: (o) => toHex(rnd.bytes(o.bytes)) },
    base64: { label: 'Base64', gen: (o) => toB64(rnd.bytes(o.bytes)) },
    base64url: { label: 'Base64URL', gen: (o) => toB64Url(rnd.bytes(o.bytes)) },
    api: { label: 'API key', gen: (o) => `${o.prefix || 'sk_live'}_${alnum(Math.max(16, o.bytes))}` },
    jwt: { label: 'JWT secret', gen: () => toB64Url(rnd.bytes(64)) },
    license: { label: 'Лицензия', gen: () => licenseKey() },
    pin: { label: 'PIN', gen: (o) => rnd.digits(Math.min(12, Math.max(4, o.bytes))) },
  };

  async function hash(algo, text) {
    const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(text));
    return toHex(new Uint8Array(buf));
  }

  /* ---------------- Люди / почты ---------------- */
  const NAMES = {
    ru: {
      male: ['Александр', 'Дмитрий', 'Максим', 'Сергей', 'Андрей', 'Алексей', 'Артём', 'Илья', 'Кирилл', 'Михаил', 'Никита', 'Матвей', 'Роман', 'Егор', 'Арсений', 'Иван', 'Денис', 'Евгений', 'Тимофей', 'Владислав', 'Павел', 'Савелий', 'Глеб', 'Лев'],
      female: ['Анастасия', 'Мария', 'Анна', 'Виктория', 'Екатерина', 'Наталья', 'Марина', 'Полина', 'Дарья', 'Алиса', 'Ксения', 'Елена', 'Софья', 'Вероника', 'Ульяна', 'Алёна', 'Валерия', 'Милана', 'Ева', 'Варвара'],
      last: ['Иванов', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров', 'Соколов', 'Михайлов', 'Новиков', 'Фёдоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семёнов', 'Егоров', 'Павлов', 'Козлов', 'Степанов', 'Николаев', 'Орлов', 'Андреев', 'Макаров', 'Захаров', 'Зайцев', 'Соловьёв', 'Белов', 'Тихонов'],
      cities: ['Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань', 'Нижний Новгород', 'Самара', 'Краснодар', 'Воронеж', 'Пермь', 'Уфа', 'Ростов-на-Дону', 'Тюмень', 'Калининград'],
      streets: ['ул. Ленина', 'ул. Гагарина', 'пр. Мира', 'ул. Садовая', 'ул. Советская', 'ул. Пушкина', 'ул. Лесная', 'ул. Набережная', 'пр. Победы', 'ул. Молодёжная', 'ул. Центральная'],
    },
    en: {
      male: ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Daniel', 'Matthew', 'Ethan', 'Noah', 'Liam', 'Lucas', 'Oliver', 'Henry', 'Jack', 'Leo', 'Owen', 'Ryan', 'Nathan', 'Caleb'],
      female: ['Olivia', 'Emma', 'Ava', 'Sophia', 'Isabella', 'Mia', 'Amelia', 'Harper', 'Evelyn', 'Abigail', 'Emily', 'Ella', 'Chloe', 'Grace', 'Lily', 'Zoe', 'Nora', 'Hannah', 'Aria', 'Helen'],
      last: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Martin', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker', 'Young', 'Hall', 'Allen', 'King', 'Wright'],
      cities: ['Springfield', 'Riverside', 'Fairview', 'Franklin', 'Greenville', 'Madison', 'Georgetown', 'Salem', 'Clinton', 'Arlington', 'Oakland', 'Bristol'],
      streets: ['Main St', 'Oak Ave', 'Maple Dr', 'Cedar Ln', 'Pine St', 'Elm St', 'Washington Ave', 'Lake Rd', 'Hill St', 'Park Ave', 'Sunset Blvd'],
    },
  };

  const TRANSLIT = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  const translit = (s) => s.toLowerCase().split('').map((c) => (c in TRANSLIT ? TRANSLIT[c] : c)).join('').replace(/[^a-z0-9]/g, '');

  function person(locale = 'ru', gender) {
    const L = NAMES[locale];
    const g = gender || rnd.pick(['male', 'female']);
    const first = rnd.pick(L[g]);
    let last = rnd.pick(L.last);
    if (locale === 'ru' && g === 'female') last += 'а';
    return { first, last, gender: g, full: `${first} ${last}` };
  }

  const DOMAINS = {
    popular: ['gmail.com', 'outlook.com', 'yahoo.com', 'proton.me', 'icloud.com', 'mail.ru', 'yandex.ru', 'gmx.com'],
    safe: ['example.com', 'example.org', 'example.net', 'test.local', 'mail.test'],
  };

  function email({ locale = 'ru', domains = 'popular', custom = '', style = 'mixed', p } = {}) {
    p = p || person(locale);
    const f = translit(p.first), l = translit(p.last);
    const year = rnd.int(70, 99) + '';
    const styles = {
      dot: () => `${f}.${l}`,
      initial: () => `${f[0]}${l}`,
      under: () => `${f}_${l}`,
      num: () => `${f}${l}${rnd.int(1, 999)}`,
      year: () => `${l}.${f}${year}`,
      nick: () => `${rnd.pick(WORDS)}${rnd.pick(WORDS)}${rnd.int(1, 99)}`,
    };
    const key = style === 'mixed' ? rnd.pick(Object.keys(styles)) : style;
    const list = custom.trim()
      ? custom.split(',').map((d) => d.trim().replace(/^@/, '')).filter(Boolean)
      : DOMAINS[domains];
    return `${styles[key]()}@${rnd.pick(list)}`;
  }

  function username() {
    const forms = [
      () => `${rnd.pick(WORDS)}_${rnd.pick(WORDS)}`,
      () => `${rnd.pick(WORDS)}${rnd.int(10, 9999)}`,
      () => `x${rnd.pick(WORDS)}x`,
      () => `${rnd.pick(WORDS)}.${rnd.pick(WORDS)}${rnd.int(1, 99)}`,
    ];
    return rnd.pick(forms)();
  }

  /* ---------------- Телефоны ---------------- */
  // '#' — любая цифра, '@' — 2–9. Где есть официальные «фиктивные» диапазоны — используем их.
  const COUNTRIES = [
    { code: 'RU', name: 'Россия', dial: '+7', masks: ['9## ###-##-##'] },
    { code: 'UA', name: 'Украина', dial: '+380', masks: ['50 ### ## ##', '63 ### ## ##', '67 ### ## ##', '93 ### ## ##', '97 ### ## ##', '99 ### ## ##'] },
    { code: 'BY', name: 'Беларусь', dial: '+375', masks: ['25 ###-##-##', '29 ###-##-##', '33 ###-##-##', '44 ###-##-##'] },
    { code: 'KZ', name: 'Казахстан', dial: '+7', masks: ['70# ### ## ##', '747 ### ## ##', '77# ### ## ##'] },
    { code: 'UZ', name: 'Узбекистан', dial: '+998', masks: ['9# ### ## ##'] },
    { code: 'US', name: 'США', dial: '+1', masks: ['(@##) 555-01##'], note: 'фиктивный диапазон 555-01xx' },
    { code: 'CA', name: 'Канада', dial: '+1', masks: ['(@##) 555-01##'], note: 'фиктивный диапазон 555-01xx' },
    { code: 'GB', name: 'Великобритания', dial: '+44', masks: ['7700 900###'], note: 'диапазон Ofcom для фильмов' },
    { code: 'DE', name: 'Германия', dial: '+49', masks: ['151 ########', '160 ########', '176 ########'] },
    { code: 'FR', name: 'Франция', dial: '+33', masks: ['6 ## ## ## ##', '7 ## ## ## ##'] },
    { code: 'IT', name: 'Италия', dial: '+39', masks: ['3## ### ####'] },
    { code: 'ES', name: 'Испания', dial: '+34', masks: ['6## ### ###'] },
    { code: 'PL', name: 'Польша', dial: '+48', masks: ['5## ### ###', '6## ### ###'] },
    { code: 'NL', name: 'Нидерланды', dial: '+31', masks: ['6 ########'] },
    { code: 'TR', name: 'Турция', dial: '+90', masks: ['5## ### ## ##'] },
    { code: 'AE', name: 'ОАЭ', dial: '+971', masks: ['5# ### ####'] },
    { code: 'IN', name: 'Индия', dial: '+91', masks: ['9#### #####', '8#### #####'] },
    { code: 'CN', name: 'Китай', dial: '+86', masks: ['13# #### ####', '15# #### ####'] },
    { code: 'JP', name: 'Япония', dial: '+81', masks: ['90-####-####', '80-####-####'] },
    { code: 'KR', name: 'Корея', dial: '+82', masks: ['10-####-####'] },
    { code: 'BR', name: 'Бразилия', dial: '+55', masks: ['11 9####-####', '21 9####-####'] },
    { code: 'AU', name: 'Австралия', dial: '+61', masks: ['491 570 ###'], note: 'диапазон ACMA для фильмов' },
  ];

  function fillMask(mask) {
    return mask.replace(/[#@]/g, (c) => (c === '@' ? rnd.int(2, 9) : rnd.int(0, 9)));
  }

  function phone(code, { format = 'intl' } = {}) {
    const c = COUNTRIES.find((x) => x.code === code) || COUNTRIES[0];
    const local = fillMask(rnd.pick(c.masks));
    const intl = `${c.dial} ${local}`;
    if (format === 'e164') return intl.replace(/[^\d+]/g, '');
    if (format === 'digits') return intl.replace(/\D/g, '');
    return intl;
  }

  /* ---------------- Разное ---------------- */
  function luhnComplete(partial) {
    let sum = 0;
    const digits = partial.split('').reverse().map(Number);
    digits.forEach((d, i) => {
      if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; }
      sum += d;
    });
    return partial + ((10 - (sum % 10)) % 10);
  }

  function testCard(brand = rnd.pick(['visa', 'mc', 'mir'])) {
    const prefix = { visa: '4', mc: '5' + rnd.int(1, 5), mir: '220' + rnd.int(0, 4) }[brand];
    const num = luhnComplete(prefix + rnd.digits(15 - prefix.length));
    const mm = String(rnd.int(1, 12)).padStart(2, '0');
    const yy = String((new Date().getFullYear() + rnd.int(1, 5)) % 100).padStart(2, '0');
    return {
      brand: { visa: 'Visa', mc: 'Mastercard', mir: 'Мир' }[brand],
      number: num.replace(/(\d{4})(?=\d)/g, '$1 '),
      exp: `${mm}/${yy}`,
      cvc: rnd.digits(3),
    };
  }

  function birthdate(minAge = 18, maxAge = 65) {
    const now = new Date();
    const age = rnd.int(minAge, maxAge);
    const d = new Date(now.getFullYear() - age, rnd.int(0, 11), rnd.int(1, 28));
    return { date: d.toLocaleDateString('ru-RU'), age };
  }

  function identity(locale = 'ru', country) {
    const p = person(locale);
    const L = NAMES[locale];
    const bd = birthdate();
    const cc = country || (locale === 'ru' ? 'RU' : 'US');
    return {
      ...p,
      birth: bd.date,
      age: bd.age,
      email: email({ locale, p }),
      phone: phone(cc),
      city: rnd.pick(L.cities),
      address: locale === 'ru'
        ? `${rnd.pick(L.streets)}, д. ${rnd.int(1, 150)}, кв. ${rnd.int(1, 300)}`
        : `${rnd.int(10, 9999)} ${rnd.pick(L.streets)}, Apt ${rnd.int(1, 40)}`,
      zip: locale === 'ru' ? rnd.digits(6) : rnd.digits(5),
      username: username(),
      password: password({ length: 14 }),
      card: testCard(),
    };
  }

  const ipv4 = () => [rnd.int(1, 223), rnd.int(0, 255), rnd.int(0, 255), rnd.int(1, 254)].join('.');
  const ipv6 = () => Array.from({ length: 8 }, () => rnd.int(0, 0xffff).toString(16)).join(':');
  const mac = () => {
    const b = rnd.bytes(6);
    b[0] = (b[0] & 0xfe) | 0x02; // локально администрируемый, unicast
    return toHex(b).match(/../g).join(':').toUpperCase();
  };
  const color = () => '#' + toHex(rnd.bytes(3)).toUpperCase();
  const date = () => {
    const d = new Date(Date.now() - rnd.int(0, 3650) * 864e5 + rnd.int(0, 3650) * 864e5);
    return d.toISOString().slice(0, 10);
  };

  const LOREM = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure in reprehenderit voluptate velit esse cillum fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum'.split(' ');
  function lorem(words = 24) {
    const out = Array.from({ length: words }, () => rnd.pick(LOREM)).join(' ');
    return out[0].toUpperCase() + out.slice(1) + '.';
  }

  const UAS = [
    () => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${rnd.int(120, 131)}.0.${rnd.int(1000, 6999)}.${rnd.int(10, 199)} Safari/537.36`,
    () => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${rnd.int(16, 18)}.${rnd.int(0, 6)} Safari/605.1.15`,
    () => `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${rnd.int(120, 132)}.0) Gecko/20100101 Firefox/${rnd.int(120, 132)}.0`,
    () => `Mozilla/5.0 (iPhone; CPU iPhone OS 17_${rnd.int(0, 6)} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.${rnd.int(0, 6)} Mobile/15E148 Safari/604.1`,
    () => `Mozilla/5.0 (Linux; Android ${rnd.int(11, 15)}; Pixel ${rnd.int(5, 9)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${rnd.int(120, 131)}.0.0.0 Mobile Safari/537.36`,
  ];

  const MISC_TYPES = {
    username: { label: 'Никнейм', gen: () => username() },
    ipv4: { label: 'IPv4', gen: () => ipv4() },
    ipv6: { label: 'IPv6', gen: () => ipv6() },
    mac: { label: 'MAC', gen: () => mac() },
    color: { label: 'HEX цвет', gen: () => color() },
    date: { label: 'Дата', gen: () => date() },
    number: { label: 'Число', gen: (o) => String(rnd.int(Math.min(o.min, o.max), Math.max(o.min, o.max))) },
    card: { label: 'Тест-карта', gen: () => { const c = testCard(); return `${c.number}  ${c.exp}  ${c.cvc}`; } },
    ua: { label: 'User-Agent', gen: () => rnd.pick(UAS)() },
    lorem: { label: 'Lorem', gen: () => lorem() },
    coords: {
      label: 'Координаты',
      gen: () => `${(rnd.int(-90000000, 90000000) / 1e6).toFixed(6)}, ${(rnd.int(-180000000, 180000000) / 1e6).toFixed(6)}`,
    },
    unix: { label: 'Unix-время', gen: () => String(Math.floor(Date.now() / 1000) - rnd.int(0, 5 * 365 * 86400)) },
  };

  /* ---------------- Проверка пароля ---------------- */
  const COMMON = new Set(('123456 123456789 12345678 password qwerty 111111 12345 1234567 1234567890 123123 000000 abc123 password1 iloveyou qwerty123 1q2w3e4r 1q2w3e 654321 666666 777777 987654321 qwertyuiop 123321 dragon monkey letmein football admin welcome login master sunshine princess shadow superman michael baseball zaq12wsx qazwsx 1qaz2wsx passw0rd trustno1 starwars hello 121212 112233 696969 ' +
    'йцукен пароль привет любовь солнышко').split(' '));
  const SEQS = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'];

  function hasSequence(pw) {
    const low = pw.toLowerCase();
    for (const seq of SEQS) {
      const both = seq + ' ' + [...seq].reverse().join('');
      for (let i = 0; i + 4 <= low.length; i++) if (both.includes(low.slice(i, i + 4))) return true;
    }
    return false;
  }

  // Человеческое время для числа секунд
  function humanTime(sec) {
    if (sec < 1) return 'мгновенно';
    const units = [['лет', 31536000], ['дней', 86400], ['часов', 3600], ['минут', 60], ['секунд', 1]];
    if (sec > 31536000 * 1e9) return 'дольше возраста Вселенной';
    for (const [name, size] of units) {
      if (sec >= size) {
        const n = sec / size;
        if (name === 'лет' && n >= 1e6) return `${(n / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} млн лет`;
        if (name === 'лет' && n >= 1e3) return `${(n / 1e3).toLocaleString('ru-RU', { maximumFractionDigits: 0 })} тыс. лет`;
        return `${Math.round(n).toLocaleString('ru-RU')} ${name}`;
      }
    }
    return 'мгновенно';
  }

  function analyze(pw) {
    const c = composition(pw);
    const common = COMMON.has(pw.toLowerCase());
    const repeats = /(.)\1{2,}/.test(pw);
    const seq = hasSequence(pw);
    let bits = entropy(pw);
    // штрафы за предсказуемость
    if (repeats) bits = Math.round(bits * 0.75);
    if (seq) bits = Math.round(bits * 0.7);
    if (common) bits = Math.min(bits, 8);
    const offline = Math.pow(2, bits) / 2 / 1e10; // GPU-перебор быстрого хеша
    const online = Math.pow(2, bits) / 2 / 100;   // перебор через форму входа
    const score = bits < 28 ? 0 : bits < 45 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
    const checks = [
      { ok: pw.length >= 12, text: 'Длина от 12 символов', hint: `сейчас ${pw.length}` },
      { ok: c.upper > 0, text: 'Есть заглавные буквы' },
      { ok: c.lower > 0, text: 'Есть строчные буквы' },
      { ok: c.digits > 0, text: 'Есть цифры' },
      { ok: c.symbols > 0, text: 'Есть спецсимволы' },
      { ok: !repeats, text: 'Нет повторов вроде «aaa»' },
      { ok: !seq, text: 'Нет последовательностей вроде «1234», «qwer»' },
      { ok: !common, text: 'Не из списка популярных паролей' },
    ];
    return {
      bits, score,
      label: ['Очень слабый', 'Слабый', 'Средний', 'Надёжный', 'Очень надёжный'][score],
      offline: humanTime(offline), online: humanTime(online),
      checks,
    };
  }

  /* ---------------- Тестовые таблицы ---------------- */
  const TABLE_COLUMNS = {
    id: { label: 'ID (UUID)', get: () => uuid4() },
    full_name: { label: 'Полное имя', get: (p) => p.full },
    first_name: { label: 'Имя', get: (p) => p.first },
    last_name: { label: 'Фамилия', get: (p) => p.last },
    gender: { label: 'Пол', get: (p) => (p.gender === 'male' ? 'M' : 'F') },
    email: { label: 'Почта', get: (p) => p.email },
    phone: { label: 'Телефон', get: (p) => p.phone },
    birth_date: { label: 'Дата рождения', get: (p) => p.birth.split('.').reverse().join('-') },
    age: { label: 'Возраст', get: (p) => p.age },
    city: { label: 'Город', get: (p) => p.city },
    address: { label: 'Адрес', get: (p) => p.address },
    zip: { label: 'Индекс', get: (p) => p.zip },
    username: { label: 'Логин', get: (p) => p.username },
    password: { label: 'Пароль', get: (p) => p.password },
    ip: { label: 'IPv4', get: () => ipv4() },
    created_at: { label: 'Создан', get: () => new Date(Date.now() - rnd.int(0, 730) * 864e5 - rnd.int(0, 86399) * 1e3).toISOString().slice(0, 19).replace('T', ' ') },
  };

  function tableRows(cols, n, locale) {
    return Array.from({ length: n }, () => {
      const p = identity(locale);
      const row = {};
      cols.forEach((k) => { row[k] = TABLE_COLUMNS[k].get(p); });
      return row;
    });
  }

  function formatTable(rows, cols, format, table = 'users') {
    if (format === 'json') return JSON.stringify(rows, null, 2);
    if (format === 'csv') {
      const cell = (v) => (/[",;\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
      return [cols.join(','), ...rows.map((r) => cols.map((k) => cell(r[k])).join(','))].join('\n');
    }
    const name = (table.replace(/[^\w]/g, '') || 'users');
    const val = (v) => (typeof v === 'number' ? v : `'${String(v).replace(/'/g, "''")}'`);
    const head = `INSERT INTO ${name} (${cols.join(', ')}) VALUES`;
    return `${head}\n${rows.map((r) => `  (${cols.map((k) => val(r[k])).join(', ')})`).join(',\n')};`;
  }

  window.Gen = {
    rnd, password, passphrase, entropy, composition,
    KEY_TYPES, hash, uuid4,
    person, email, username, DOMAINS,
    COUNTRIES, phone,
    identity, testCard,
    MISC_TYPES,
    analyze, TABLE_COLUMNS, tableRows, formatTable,
  };
})();
