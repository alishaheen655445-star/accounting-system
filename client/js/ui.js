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
function getLang() {
  return localStorage.getItem('app_lang') === 'ar' ? 'ar' : 'en';
}
function applyLang(lang) {
  const l = lang === 'ar' ? 'ar' : 'en';
  document.documentElement.lang = l;
  document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
}
function setLang(lang) {
  const l = lang === 'ar' ? 'ar' : 'en';
  localStorage.setItem('app_lang', l);
  applyLang(l);
}
// Toggle the language and reload so all labels + direction refresh together.
function toggleLang() {
  setLang(getLang() === 'ar' ? 'en' : 'ar');
  location.reload();
}

// Return the string for the ACTIVE language from an English/Arabic pair.
function bi(en, ar) {
  return getLang() === 'ar' ? (ar || en) : en;
}

// Translate static markup (used by the login page): any element with
// data-en / data-ar gets its textContent set to the active language; elements
// with data-en-ph / data-ar-ph get their placeholder translated.
function applyStaticI18n(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-en]').forEach((el) => {
    el.textContent = getLang() === 'ar' ? (el.dataset.ar || el.dataset.en) : el.dataset.en;
  });
  scope.querySelectorAll('[data-en-ph]').forEach((el) => {
    el.placeholder = getLang() === 'ar' ? (el.dataset.arPh || el.dataset.enPh) : el.dataset.enPh;
  });
}

// Format a numeric value (the API returns money as exact decimal STRINGS) for
// display with thousands separators and 2 decimals. Display-only: we never do
// financial math here — the backend is the single source of truth.
function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return String(value ?? '');
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
};

function t(key, ...args) {
  // Chrome strings in the active language, from the same en/ar dictionary.
  const resolve = (dict) => {
    const v = dict[key];
    return typeof v === 'function' ? v(...args) : v;
  };
  const en = resolve(UI_STRINGS.en);
  const ar = resolve(UI_STRINGS.ar);
  return bi(en, ar);
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
