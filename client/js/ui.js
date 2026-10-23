// -----------------------------------------------------------------------------
//  ui.js — tiny shared UI helpers used by every screen.
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
//  Bilingual + theming helpers (single source of truth for the whole app).
//
//  The app is LANGUAGE-SWITCHABLE: a toggle picks EITHER English OR Arabic.
//  The active language is stored in localStorage ('app_lang': 'en' | 'ar',
//  default 'en'). Every label is authored as bi(en, ar) and returns ONLY the
//  string for the active language. Choosing Arabic also flips the whole layout
//  to RTL (dir="rtl"); English is LTR. The direction-sensitive bits use logical
//  CSS (inset-inline-start / margin-inline-end / padding-inline-start) so the
//  same markup mirrors automatically — no per-language layout branching.
//
//  A separate LIGHT/DARK theme is stored in localStorage and applied by
//  toggling a `dark` class on <html> (Tailwind `darkMode:'class'` + the CSS
//  overrides in styles.css). A tiny inline bootstrap in each page's <head>
//  restores theme + language before first paint to avoid a flash/wrong side.
//
//  Switching language reloads the page so every (re)rendered label and the
//  document direction update together; the bootstrap keeps the switch seamless.
// -----------------------------------------------------------------------------
// Supported languages: 'en' LTR, 'ar' RTL, 'fa' (Persian/Farsi) RTL.
const LANGS = [
  { code: 'en', native: 'English' },
  { code: 'ar', native: 'العربية' },
  { code: 'fa', native: 'فارسی' },
];
const isRtl = (code) => code === 'ar' || code === 'fa';
const langNative = (code) => (LANGS.find((l) => l.code === (code || getLang())) || LANGS[0]).native;

function getLang() {
  const l = localStorage.getItem('app_lang');
  return (l === 'ar' || l === 'fa') ? l : 'en';
}
function applyLang(lang) {
  const l = (lang === 'ar' || lang === 'fa') ? lang : 'en';
  document.documentElement.lang = l;
  document.documentElement.dir = isRtl(l) ? 'rtl' : 'ltr';
}
function setLang(lang) {
  const l = (lang === 'ar' || lang === 'fa') ? lang : 'en';
  localStorage.setItem('app_lang', l);
  applyLang(l);
}
// Switch to a specific language and reload so all labels + direction refresh together.
function switchLang(lang) {
  setLang(lang);
  location.reload();
}
// Legacy 2-way toggle kept for safety; cycles en -> ar -> fa -> en.
function toggleLang() {
  const order = ['en', 'ar', 'fa'];
  switchLang(order[(order.indexOf(getLang()) + 1) % order.length]);
}

// Return the string for the ACTIVE language from an English/Arabic/Persian set.
// Persian falls back to English when a translation is not authored (basic mode).
function bi(en, ar, fa) {
  const l = getLang();
  if (l === 'ar') return ar || en;
  if (l === 'fa') return fa || en;
  return en;
}

// Translate static markup (used by the login page): any element with
// data-en / data-ar gets its textContent set to the active language; elements
// with data-en-ph / data-ar-ph get their placeholder translated.
function applyStaticI18n(root) {
  const scope = root || document;
  const l = getLang();
  scope.querySelectorAll('[data-en]').forEach((el) => {
    if (l === 'ar') el.textContent = el.dataset.ar || el.dataset.en;
    else if (l === 'fa') el.textContent = el.dataset.fa || el.dataset.en;
    else el.textContent = el.dataset.en;
  });
  scope.querySelectorAll('[data-en-ph]').forEach((el) => {
    if (l === 'ar') el.placeholder = el.dataset.arPh || el.dataset.enPh;
    else if (l === 'fa') el.placeholder = el.dataset.faPh || el.dataset.enPh;
    else el.placeholder = el.dataset.enPh;
  });
}

// Wire a language dropdown menu: a [data-lang-toggle] button reveals a
// [data-lang-menu] panel whose [data-lang-opt] items switch the app language.
function wireLangMenu(root) {
  const scope = root || document;
  const btn = scope.querySelector('[data-lang-toggle]');
  const menu = scope.querySelector('[data-lang-menu]');
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); });
  menu.querySelectorAll('[data-lang-opt]').forEach((o) =>
    o.addEventListener('click', () => switchLang(o.dataset.langOpt)));
  document.addEventListener('click', () => menu.classList.add('hidden'));
}

// Format a numeric value (the API returns money as exact decimal STRINGS) for
// display with thousands separators and 2 decimals. Display-only: we never do
// financial math here — the backend is the single source of truth.
// The whole app is priced in US Dollars (one unified currency — no FX conversion).
const CURRENCY_SYMBOL = '$';
// Short currency label for table headers, localized (Persian falls back to USD).
const currencyCode = () => bi('USD', 'دولار', 'دلار');

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '');
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-${CURRENCY_SYMBOL}${abs}` : `${CURRENCY_SYMBOL}${abs}`;
}

// Escape untrusted text before injecting into innerHTML (prevents XSS).
// Every value that came from the DB/user goes through this when we build HTML.
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Show a transient message box inside a container element.
function flash(el, message, kind = 'success') {
  el.className = `alert alert-${kind}`;
  el.textContent = message;
  el.classList.remove('hidden');
  if (kind === 'success') setTimeout(() => el.classList.add('hidden'), 3500);
}

// -----------------------------------------------------------------------------
//  Shared UI dictionary (English + Arabic) for the chrome that crud.js and the
//  pages reuse (table header, empty state, modal buttons, pagination, confirms).
//  t() picks the active language via bi(). One source of truth so crud.js stays
//  generic and page-independent.
// -----------------------------------------------------------------------------
const UI_STRINGS = {
  en: {
    actions: 'Actions', noRecords: 'No records found.', cancel: 'Cancel',
    save: 'Save', prev: '‹ Prev', next: 'Next ›',
    select: '— Select —', saveFailed: 'Save failed.',
    pageOf: (p, t, n) => `Page ${p} of ${t} · ${n} record(s)`,
    deactivateConfirm: (name) => `Deactivate "${name}"?\nThis is a soft delete — the record is kept for history.`,
  },
  ar: {
    actions: 'الإجراءات', noRecords: 'لا توجد سجلات.', cancel: 'إلغاء',
    save: 'حفظ', prev: '› السابق', next: 'التالي ‹',
    select: '— اختر —', saveFailed: 'تعذّر الحفظ.',
    pageOf: (p, t, n) => `صفحة ${p} من ${t} · ${n} سجل`,
    deactivateConfirm: (name) => `إيقاف "${name}"؟\nهذا حذف ناعم — يبقى السجل محفوظًا للتاريخ.`,
  },
  fa: {
    actions: 'عملیات', noRecords: 'رکوردی یافت نشد.', cancel: 'لغو',
    save: 'ذخیره', prev: '› قبلی', next: 'بعدی ‹',
    select: '— انتخاب —', saveFailed: 'ذخیره ناموفق بود.',
    pageOf: (p, t, n) => `صفحه ${p} از ${t} · ${n} رکورد`,
    deactivateConfirm: (name) => `"${name}" غیرفعال شود؟\nاین حذف نرم است — رکورد برای تاریخچه نگه داشته می‌شود.`,
  },
};

function t(key, ...args) {
  // Chrome strings in the active language, from the same en/ar dictionary.
  const resolve = (dict) => {
    const v = dict[key];
    return typeof v === 'function' ? v(...args) : v;
  };
  const en = resolve(UI_STRINGS.en);
  const ar = resolve(UI_STRINGS.ar);
  const fa = resolve(UI_STRINGS.fa);
  return bi(en, ar, fa);
}

// ---- Theme (light / dark) — persisted, applied via a `dark` class on <html> ----
function getTheme() {
  return localStorage.getItem('app_theme') === 'dark' ? 'dark' : 'light';
}
function applyTheme(theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}
function setTheme(theme) {
  localStorage.setItem('app_theme', theme);
  applyTheme(theme);
}
function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
// Apply immediately when ui.js runs (the inline head bootstrap already did this
// before paint; these keep theme + language in sync if a page loads ui.js late).
applyTheme(getTheme());
applyLang(getLang());
// Translate any static markup present at load (e.g. the <title>, login page).
applyStaticI18n(document);
