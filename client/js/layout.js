// -----------------------------------------------------------------------------
//  layout.js — the single app shell reused by every protected page.
//  A page provides <div id="app"></div> and calls renderLayout(activeKey, title);
//  this guards the route (redirects to login if no session), draws the sidebar +
//  top bar, wires logout, and returns the #content element for the page to fill.
//
//  TWO shell flavours render from the SAME NAV map:
//   * legacy pages            -> plain CSS shell (old markup, unchanged).
//   * body class="ds" pages   -> the Stitch design-system shell (RTL, Tailwind
//     tokens, Material Symbols). Only journal.html is ported so far; the rest
//     opt in later by adding class="ds" to their <body>.
// -----------------------------------------------------------------------------

// Navigation map. All screens are readable by any signed-in user; write actions
// are additionally gated per-role inside each screen (and enforced by the API).
// ar = Arabic, fa = Persian label; icon = Material Symbols name (used by "ds").
// adminOnly = shown only to admins (the matching API route is admin-only too).
const NAV = [
  { key: 'dashboard', label: 'Dashboard', ar: 'لوحة التحكم', fa: 'داشبورد', icon: 'dashboard', href: 'dashboard.html' },
  { key: 'accounts', label: 'Chart of Accounts', ar: 'دليل الحسابات', fa: 'جدول حساب‌ها', icon: 'account_tree', href: 'accounts.html' },
  { key: 'customers', label: 'Customers', ar: 'العملاء', fa: 'مشتریان', icon: 'group', href: 'customers.html' },
  { key: 'suppliers', label: 'Suppliers', ar: 'الموردون', fa: 'تأمین‌کنندگان', icon: 'local_shipping', href: 'suppliers.html' },
  { key: 'products', label: 'Products', ar: 'المنتجات', fa: 'محصولات', icon: 'inventory_2', href: 'products.html' },
  { key: 'purchases', label: 'Purchases', ar: 'المشتريات', fa: 'خريد', icon: 'add_shopping_cart', href: 'purchases.html' },
  { key: 'invoices', label: 'Invoices', ar: 'الفواتير والمبيعات', fa: 'فاکتورها', icon: 'description', href: 'invoices.html' },
  { key: 'payments', label: 'Payments', ar: 'الدفعات', fa: 'پرداخت‌ها', icon: 'payments', href: 'payments.html' },
  { key: 'journal', label: 'Journal', ar: 'قيود اليومية', fa: 'روزنامه', icon: 'receipt_long', href: 'journal.html' },
  { key: 'reports', label: 'Reports', ar: 'التقارير المالية', fa: 'گزارش‌های مالی', icon: 'analytics', href: 'reports.html' },
  { key: 'users', label: 'Users', ar: 'المستخدمون', fa: 'کاربران', icon: 'manage_accounts', href: 'users.html', adminOnly: true },
  { key: 'audit', label: 'Audit Log', ar: 'سجل التدقيق', fa: 'گزارش رسیدگی', icon: 'history', href: 'audit.html', adminOnly: true },
];

// The NAV entries this user is allowed to see (admin-only items hidden otherwise).
function visibleNav(user) {
  const role = (user && user.role) || '';
  return NAV.filter((n) => !n.adminOnly || role === 'admin');
}

// True when this page opts into the Stitch design-system shell (journal.html).
function usesDesignShell() {
  return document.body.classList.contains('ds');
}

function renderLayout(activeKey, title) {
  // Route guard: no token -> back to login. Returns null so the page stops here.
  if (!requireAuth()) return null;

  const user = getUser() || {};
  document.getElementById('app').innerHTML = usesDesignShell()
    ? designShell(activeKey, title, user)
    : legacyShell(activeKey, title, user);

  document.getElementById('logout-btn').addEventListener('click', logout);
  const themeBtn = document.getElementById('theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', () => { toggleTheme(); syncThemeIcon(); });
  wireLangMenu(document);
  syncThemeIcon();
  syncLangLabel();
  return document.getElementById('content');
}

// The language menu button shows the CURRENT language (a dropdown offers all three).
function syncLangLabel() {
  const label = document.getElementById('lang-label');
  if (label) label.textContent = langNative(getLang());
}

// Reflect the current theme on the toggle button (sun in dark, moon in light).
function syncThemeIcon() {
  const btn = document.getElementById('theme-btn');
  if (!btn) return;
  const dark = document.documentElement.classList.contains('dark');
  const icon = btn.querySelector('.material-symbols-outlined');
  if (icon) icon.textContent = dark ? 'light_mode' : 'dark_mode';
}

// ---- Legacy shell (all original pages, unchanged) ----
function legacyShell(activeKey, title, user) {
  const links = visibleNav(user)
    .map((n) => `<a href="${n.href}" class="${n.key === activeKey ? 'active' : ''}">${escapeHtml(bi(n.label, n.ar, n.fa))}</a>`)
    .join('');

  return `
    <div class="app">
      <aside class="sidebar">
        <div class="brand">${escapeHtml(bi('Accounting', 'المحاسبة'))}</div>
        <nav>${links}</nav>
      </aside>
      <div class="main">
        <header class="topbar">
          <h3 style="margin:0">${escapeHtml(title || '')}</h3>
          <div class="user">
            <span>${escapeHtml(user.full_name || user.username || '')}</span>
            <span class="badge">${escapeHtml(user.role || '')}</span>
            <span style="position:relative;display:inline-block">
              <button class="btn btn-secondary btn-sm" data-lang-toggle>${escapeHtml(langNative(getLang()))} ▾</button>
              <span data-lang-menu class="hidden" style="position:absolute;top:120%;inset-inline-start:0;background:#fff;border:1px solid #ccc;border-radius:6px;min-width:8rem;z-index:60">
                <button class="btn btn-sm" style="display:block;width:100%" data-lang-opt="en">English</button>
                <button class="btn btn-sm" style="display:block;width:100%" data-lang-opt="ar">العربية</button>
                <button class="btn btn-sm" style="display:block;width:100%" data-lang-opt="fa">فارسی</button>
              </span>
            </span>
            <button class="btn btn-secondary btn-sm" id="theme-btn">${escapeHtml(bi('Theme', 'المظهر'))}</button>
            <button class="btn btn-secondary btn-sm" id="logout-btn">${escapeHtml(bi('Logout', 'خروج'))}</button>
          </div>
        </header>
        <section class="content" id="content"></section>
      </div>
    </div>`;
}

// ---- Stitch design-system shell (direction-aware: sidebar sits at the START
// edge — left in LTR / right in RTL — via logical CSS, no per-language branch) ----
// Labels come from bi() so the whole shell follows the active language.
function designShell(activeKey, title, user) {
  const links = visibleNav(user)
    .map((n) => {
      const active = n.key === activeKey;
      const cls = active
        ? 'flex items-center gap-3 px-4 py-3 transition-all bg-primary-container text-on-primary-container font-bold rounded-xl'
        : 'flex items-center gap-3 px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-all';
      return `<a href="${n.href}" class="${cls}" ${active ? 'aria-current="page"' : ''}>
          <span class="material-symbols-outlined">${n.icon}</span>${escapeHtml(bi(n.label, n.ar, n.fa))}</a>`;
    })
    .join('');

  const roleLabels = { admin: bi('Admin', 'مدير', 'مدیر'), accountant: bi('Accountant', 'محاسب', 'حسابدار'), viewer: bi('Viewer', 'مشاهد', 'بیننده') };

  return `
    <aside class="fixed top-0 h-full w-72 bg-surface-container-low z-50 flex flex-col pt-6 pb-8 shadow-[0_1px_8px_rgba(0,0,0,0.04)]" style="inset-inline-start:0">
      <div class="px-8 mb-8 flex items-center gap-3">
        <span class="material-symbols-outlined text-primary text-[28px]">account_balance</span>
        <span class="text-lg font-headline font-bold tracking-tight text-primary">${escapeHtml(bi('Accounting ERP', 'نظام المحاسبة', 'سیستم حسابداری'))}</span>
      </div>
      <nav class="flex-1 px-4 space-y-1">${links}</nav>
    </aside>
    <div style="padding-inline-start:18rem">
      <header class="fixed top-0 h-16 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-8" style="inset-inline-start:18rem;inset-inline-end:0">
        <h3 class="font-headline-sm text-headline-sm text-primary">${escapeHtml(title || '')}</h3>
        <div class="flex items-center gap-4">
          <span class="text-on-surface-variant font-label-lg">${escapeHtml(user.full_name || user.username || '')}</span>
          <span class="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md">${escapeHtml(roleLabels[user.role] || user.role || '')}</span>
          <div class="relative">
            <button class="flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-md" data-lang-toggle title="${escapeHtml(bi('Switch language', 'بدّل اللغة', 'تغییر زبان'))}">
              <span class="material-symbols-outlined text-[18px]">translate</span><span id="lang-label"></span>
              <span class="material-symbols-outlined text-[18px]">expand_more</span>
            </button>
            <div data-lang-menu class="hidden absolute mt-2 min-w-[10rem] rounded-xl bg-surface-container-lowest shadow-lg border border-outline-variant py-1 z-50" style="inset-inline-end:0">
              <button class="w-full text-start px-4 py-2 hover:bg-surface-container-high font-label-md" data-lang-opt="en">English</button>
              <button class="w-full text-start px-4 py-2 hover:bg-surface-container-high font-label-md" data-lang-opt="ar">العربية</button>
              <button class="w-full text-start px-4 py-2 hover:bg-surface-container-high font-label-md" data-lang-opt="fa">فارسی</button>
            </div>
          </div>
          <button class="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest" id="theme-btn" title="${escapeHtml(bi('Theme', 'المظهر', 'پوسته'))}">
            <span class="material-symbols-outlined text-[18px]">dark_mode</span>
          </button>
          <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-md" id="logout-btn">
            <span class="material-symbols-outlined text-[18px]">logout</span>
            ${escapeHtml(bi('Logout', 'خروج', 'خروج'))}
          </button>
          <div class="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span class="material-symbols-outlined text-on-primary text-[18px]">person</span>
          </div>
        </div>
      </header>
      <main class="relative pt-16 bg-surface min-h-screen">
        <section class="p-8 space-y-8" id="content"></section>
      </main>
    </div>`;
}
