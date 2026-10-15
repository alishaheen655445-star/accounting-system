// -----------------------------------------------------------------------------
//  dashboard.js — Landing page (Stitch design-system, bilingual EN·AR, LTR).
//  Pulls REAL numbers from the API in parallel and renders an overview:
//    * header + live "books balanced" status pill
//    * quick-action shortcuts
//    * KPI stat cards (counts from list meta + money from the income statement)
//    * a recent-journal-entries table (latest postings)
//  No fake data and no client-side financial math — the backend is the source
//  of truth; every DB/user value is escaped before it reaches innerHTML.
// -----------------------------------------------------------------------------
const content = renderLayout('dashboard', bi('Dashboard', 'لوحة التحكم'));
if (content) loadStats();

const CURRENCY = bi('SAR', 'ر.س');
const fmtMoney = (v) => formatMoney(v);

async function loadStats() {
  content.innerHTML = `<p class="muted p-6">${escapeHtml(bi('Loading…', 'جارٍ التحميل…'))}</p>`;

  try {
    // One round-trip each, fired together for speed.
    const [cust, sup, prod, inv, inc, tb, recent] = await Promise.all([
      api.get('/customers?pageSize=1'),
      api.get('/suppliers?pageSize=1'),
      api.get('/products?pageSize=1'),
      api.get('/invoices?pageSize=1'),
      api.get('/reports/income-statement'),
      api.get('/reports/trial-balance'),
      api.get('/journal?pageSize=6'),
    ]);

    const balanced = tb.data.totals.balanced;

    // ---- Page header + balance status pill ----
    const statusPill = balanced
      ? `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary-fixed-dim/25 text-on-tertiary-fixed-variant font-label-md">
           <span class="material-symbols-outlined text-[18px]">check_circle</span>${escapeHtml(bi('Books balanced', 'الدفاتر متوازنة'))}</span>`
      : `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-error-container text-on-error-container font-label-md">
           <span class="material-symbols-outlined text-[18px]">error</span>${escapeHtml(bi('Warning: books not balanced', 'تنبيه: الدفاتر غير متوازنة'))}</span>`;

    // ---- KPI cards ----
    const kpi = (label, icon, value, tint, ink) => `
      <div class="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-on-surface-variant font-label-md">${escapeHtml(label)}</span>
          <div class="w-10 h-10 rounded-xl ${tint} flex items-center justify-center ${ink}">
            <span class="material-symbols-outlined">${icon}</span>
          </div>
        </div>
        <span class="font-headline-md text-headline-md text-primary mono">${escapeHtml(value)}</span>
      </div>`;

    const cards = [
      kpi(bi('Customers', 'العملاء'), 'group', String(cust.meta.total), 'bg-primary-fixed', 'text-primary'),
      kpi(bi('Suppliers', 'الموردون'), 'local_shipping', String(sup.meta.total), 'bg-secondary-container', 'text-on-secondary-container'),
      kpi(bi('Products', 'المنتجات'), 'inventory_2', String(prod.meta.total), 'bg-surface-container-high', 'text-primary'),
      kpi(bi('Invoices', 'الفواتير'), 'description', String(inv.meta.total), 'bg-primary-fixed', 'text-primary'),
      kpi(bi(`Total Revenue (${CURRENCY})`, `إجمالي الإيرادات (${CURRENCY})`), 'trending_up', fmtMoney(inc.data.totals.revenue), 'bg-tertiary-fixed-dim/30', 'text-tertiary-container'),
      kpi(bi(`Net Income (${CURRENCY})`, `صافي الربح (${CURRENCY})`), 'savings', fmtMoney(inc.data.totals.net_income), 'bg-tertiary-fixed-dim/30', 'text-tertiary-container'),
    ].join('');

    // ---- Quick actions (role-aware: viewer sees read-only shortcuts) ----
    const canWrite = hasAnyRole('admin', 'accountant');
    const action = (href, icon, title, sub) => `
      <a href="${href}" class="flex items-center gap-3 bg-surface-container-low p-4 rounded-xl hover:bg-surface-container-high transition-all no-underline">
        <div class="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined">${icon}</span>
        </div>
        <div class="min-w-0">
          <div class="font-label-lg text-on-surface">${escapeHtml(title)}</div>
          <div class="font-body-sm text-on-surface-variant truncate">${escapeHtml(sub)}</div>
        </div>
      </a>`;

    const actions = [
      canWrite ? action('invoices.html', 'add_circle', bi('New Sales Invoice', 'إنشاء فاتورة مبيعات'), bi('Issue an invoice to a customer with tax', 'إصدار فاتورة للعميل مع الضريبة')) : null,
      canWrite ? action('journal.html', 'bookmark_add', bi('Record Journal Entry', 'تسجيل قيد يومية'), bi('Add a new double-entry posting', 'إضافة قيد محاسبي مزدوج جديد')) : null,
      canWrite ? action('customers.html', 'person_add', bi('Add Customer or Supplier', 'إضافة عميل أو مورد'), bi('Update external party records', 'تحديث سجلّات الأطراف الخارجية')) : null,
      action('reports.html', 'analytics', bi('View Financial Reports', 'عرض التقارير المالية'), bi('Trial balance & income statement', 'ميزان المراجعة وقائمة الدخل')),
    ].filter(Boolean).join('');

    // ---- Recent journal entries table ----
    const recentColumns = [
      { key: 'entry_number', label: bi('Entry No.', 'رقم القيد'), render: (v) => `<span class="mono font-bold text-primary">${escapeHtml(v)}</span>` },
      { key: 'entry_date', label: bi('Date', 'التاريخ'), render: (v) => `<span class="text-on-surface-variant">${escapeHtml(String(v).slice(0, 10))}</span>` },
      { key: 'description', label: bi('Description', 'البيان'), render: (v) => `<span class="font-medium">${escapeHtml(v || '')}</span>` },
      { key: 'total_debit', label: `${bi('Debit', 'المدين')} (${CURRENCY})`, numeric: true, render: (v) => `<span class="mono font-semibold">${formatMoney(v)}</span>` },
      { key: 'total_credit', label: `${bi('Credit', 'الدائن')} (${CURRENCY})`, numeric: true, render: (v) => `<span class="mono font-semibold">${formatMoney(v)}</span>` },
    ];

    // ---- Assemble ----
    content.innerHTML = `
      <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-low p-6 rounded-xl shadow-sm">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-md">${escapeHtml(bi('Double-Entry Accounting', 'نظام المحاسبة المزدوجة'))}</span>
            <span class="text-on-surface-variant font-body-sm">/ ${escapeHtml(bi('Dashboard', 'لوحة التحكم'))}</span>
          </div>
          <h1 class="font-headline-lg text-headline-lg text-primary" style="margin:0">${escapeHtml(bi('Financial Dashboard', 'لوحة التحكم المالية'))}</h1>
          <p class="text-on-surface-variant font-body-md" style="margin:0">${escapeHtml(bi('An overview of the company’s financial performance and key indicators.', 'نظرة عامة على الأداء المالي والمؤشرات الرئيسية للشركة.'))}</p>
        </div>
        ${statusPill}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div class="md:col-span-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">${cards}</div>
      </div>

      <div class="bg-surface-container-lowest p-6 rounded-xl shadow-sm">
        <h3 class="font-headline-sm text-headline-sm text-primary mb-4" style="margin:0 0 1rem">${escapeHtml(bi('Quick Actions', 'إجراءات سريعة'))}</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">${actions}</div>
      </div>

      <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div class="flex items-center justify-between p-6 pb-4">
          <h3 class="font-headline-sm text-headline-sm text-primary" style="margin:0">${escapeHtml(bi('Recent Journal Entries', 'أحدث القيود المحاسبية'))}</h3>
          <a href="journal.html" class="text-primary font-label-md no-underline">${escapeHtml(bi('View all', 'عرض الكل'))}</a>
        </div>
        <div class="px-6 pb-6" id="recent-journal"></div>
      </div>`;

    renderTable(content.querySelector('#recent-journal'), { columns: recentColumns, rows: recent.data });
  } catch (err) {
    content.innerHTML = `<div class="alert alert-error m-6">${escapeHtml(err.message)}</div>`;
  }
}
