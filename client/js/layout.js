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
// ar = Arabic label + icon = Material Symbols name, both used by the "ds" shell.
// adminOnly = shown only to admins (the matching API route is admin-only too).
const NAV = [
  { key: 'dashboard', label: 'Dashboard', ar: 'لوحة التحكم', icon: 'dashboard', href: 'dashboard.html' },
  { key: 'accounts', label: 'Chart of Accounts', ar: 'دليل الحسابات', icon: 'account_tree', href: 'accounts.html' },
  { key: 'customers', label: 'Customers', ar: 'العملاء', icon: 'group', href: 'customers.html' },
  { key: 'suppliers', label: 'Suppliers', ar: 'الموردون', icon: 'local_shipping', href: 'suppliers.html' },
  { key: 'products', label: 'Products', ar: 'المنتجات', icon: 'inventory_2', href: 'products.html' },
  { key: 'invoices', label: 'Invoices', ar: 'الفواتير والمبيعات', icon: 'description', href: 'invoices.html' },
  { key: 'payments', label: 'Payments', ar: 'الدفعات', icon: 'payments', href: 'payments.html' },
  { key: 'journal', label: 'Journal', ar: 'قيود اليومية', icon: 'receipt_long', href: 'journal.html' },
  { key: 'reports', label: 'Reports', ar: 'التقارير المالية', icon: 'analytics', href: 'reports.html' },
  { key: 'users', label: 'Users', ar: 'المستخدمون', icon: 'manage_accounts', href: 'users.html', adminOnly: true },
  { key: 'audit', label: 'Audit Log', ar: 'سجل التدقيق', icon: 'history', href: 'audit.html', adminOnly: true },
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
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) langBtn.addEventListener('click', toggleLang);
  syncThemeIcon();
  syncLangLabel();
  return document.getElementById('content');
}

// The language button always shows the language you'd SWITCH TO (e.g. shows
// "العربية" while viewing English).
function syncLangLabel() {
  const label = document.getElementById('lang-label');
  if (label) label.textContent = getLang() === 'ar' ? 'English' : 'العربية';
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
    .map((n) => `<a href="${n.href}" class="${n.key === activeKey ? 'active' : ''}">${escapeHtml(bi(n.label, n.ar))}</a>`)
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
            <button class="btn btn-secondary btn-sm" id="lang-btn">${escapeHtml(getLang() === 'ar' ? 'English' : 'العربية')}</button>
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
          <span class="material-symbols-outlined">${n.icon}</span>${escapeHtml(bi(n.label, n.ar))}</a>`;
    })
    .join('');

  const roleLabels = { admin: bi('Admin', 'مدير'), accountant: bi('Accountant', 'محاسب'), viewer: bi('Viewer', 'مشاهد') };

  return `
    <aside class="fixed top-0 h-full w-72 bg-surface-container-low z-50 flex flex-col pt-6 pb-8 shadow-[0_1px_8px_rgba(0,0,0,0.04)]" style="inset-inline-start:0">
      <div class="px-8 mb-8 flex items-center gap-3">
        <span class="material-symbols-outlined text-primary text-[28px]">account_balance</span>
        <span class="text-lg font-headline font-bold tracking-tight text-primary">${escapeHtml(bi('Accounting ERP', 'نظام المحاسبة'))}</span>
      </div>
      <nav class="flex-1 px-4 space-y-1">${links}</nav>
    </aside>
    <div style="padding-inline-start:18rem">
      <header class="fixed top-0 h-16 bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex items-center justify-between px-8" style="inset-inline-start:18rem;inset-inline-end:0">
        <h3 class="font-headline-sm text-headline-sm text-primary">${escapeHtml(title || '')}</h3>
        <div class="flex items-center gap-4">
          <span class="text-on-surface-variant font-label-lg">${escapeHtml(user.full_name || user.username || '')}</span>
          <span class="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-md">${escapeHtml(roleLabels[user.role] || user.role || '')}</span>
          <button class="flex items-center justify-center gap-1.5 h-9 px-3 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-md" id="lang-btn" title="${escapeHtml(bi('Switch language', 'بدّل اللغة'))}">
            <span class="material-symbols-outlined text-[18px]">translate</span><span id="lang-label"></span>
          </button>
          <button class="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest" id="theme-btn" title="${escapeHtml(bi('Theme', 'المظهر'))}">
            <span class="material-symbols-outlined text-[18px]">dark_mode</span>
          </button>
          <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-md" id="logout-btn">
            <span class="material-symbols-outlined text-[18px]">logout</span>
            ${escapeHtml(bi('Logout', 'خروج'))}
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
