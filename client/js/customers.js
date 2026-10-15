// -----------------------------------------------------------------------------
//  customers.js — Customers CRUD screen (Stitch design-system, bilingual EN·AR).
//  TEMPLATE screen: describe COLUMNS and FORM FIELDS, then let crud.js + api.js
//  do the heavy lifting. The shared chrome (table/pagination/modal/confirm) is
//  bilingual automatically via t(); page labels use bi(en, ar).
// -----------------------------------------------------------------------------
const content = renderLayout('customers', bi('Customers', 'العملاء'));
if (content) {
  const canWrite = hasAnyRole('admin', 'accountant');
  let page = 1;
  let search = '';
  const pageSize = 10;

  // Columns (keys match the API's snake_case response).
  const columns = [
    { key: 'customer_code', label: bi('Code', 'الرمز'), render: (v) => `<span class="mono">${escapeHtml(v)}</span>` },
    { key: 'name', label: bi('Name', 'الاسم') },
    { key: 'email', label: bi('Email', 'البريد الإلكتروني'), render: (v) => escapeHtml(v || '—') },
    { key: 'phone', label: bi('Phone', 'الهاتف'), render: (v) => escapeHtml(v || '—') },
    { key: 'credit_limit', label: bi('Credit Limit', 'حد الائتمان'), numeric: true, render: (v) => formatMoney(v) },
    { key: 'is_active', label: bi('Status', 'الحالة'), render: (v) => `<span class="status ${v ? 'active' : 'deactivated'}">${escapeHtml(v ? bi('Active', 'نشط') : bi('Inactive', 'غير نشط'))}</span>` },
  ];

  // Fields in the create/edit form (names match what the API expects: camelCase).
  const fields = [
    { name: 'name', label: bi('Name', 'الاسم'), type: 'text', required: true },
    { name: 'email', label: bi('Email', 'البريد الإلكتروني'), type: 'email', placeholder: 'name@example.com' },
    { name: 'phone', label: bi('Phone', 'الهاتف'), type: 'tel' },
    { name: 'address', label: bi('Address', 'العنوان'), type: 'textarea' },
    { name: 'creditLimit', label: bi('Credit Limit', 'حد الائتمان'), type: 'number', placeholder: '0.00' },
    { name: 'openingBalance', label: bi('Opening Balance', 'الرصيد الافتتاحي'), type: 'number', placeholder: '0.00' },
  ];

  // Map an API row (snake_case) to form initial values (camelCase).
  const toForm = (row) => ({
    name: row.name, email: row.email || '', phone: row.phone || '',
    address: row.address || '', creditLimit: row.credit_limit, openingBalance: row.opening_balance,
  });

  // ---- Static page skeleton (header + toolbar + table + pagination) ----
  content.innerHTML = `
    <div class="bg-surface-container-low p-6 rounded-xl shadow-sm">
      <h1 class="font-headline-lg text-headline-lg text-primary" style="margin:0">${escapeHtml(bi('Customer Management', 'إدارة العملاء'))}</h1>
      <p class="text-on-surface-variant font-body-md" style="margin:.25rem 0 0">${escapeHtml(bi('Customer records, contact details and credit limits.', 'سجلّات العملاء وبيانات الاتصال وحدود الائتمان.'))}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3 bg-surface-container-lowest p-4 rounded-xl shadow-sm">
      <div class="relative">
        <input id="search" type="text" placeholder="${escapeHtml(bi('Search by name, code or email…', 'ابحث بالاسم أو الرمز أو البريد…'))}"
          class="py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface font-body-md w-72 focus:outline-none focus:border-primary" style="padding-inline-start:2.75rem;padding-inline-end:1rem" />
        <span class="absolute top-1/2 -translate-y-1/2 text-outline" style="inset-inline-start:.75rem"><span class="material-symbols-outlined text-[20px]">search</span></span>
      </div>
      <button id="search-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-lg transition-all">
        <span class="material-symbols-outlined text-[18px]">search</span>${escapeHtml(bi('Search', 'بحث'))}
      </button>
      <div class="flex-1"></div>
      ${canWrite ? `<button id="add-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg transition-all shadow-sm">
        <span class="material-symbols-outlined text-[18px]">person_add</span>${escapeHtml(bi('Add Customer', 'إضافة عميل'))}</button>` : ''}
    </div>
    <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
      <div class="p-6" id="table"></div>
      <div class="px-6 pb-6" id="pager"></div>
    </div>`;

  const tableEl = content.querySelector('#table');
  const pagerEl = content.querySelector('#pager');
  const searchInput = content.querySelector('#search');

  // ---- Data loading ----
  async function load() {
    tableEl.innerHTML = `<p class="muted">${escapeHtml(bi('Loading…', 'جارٍ التحميل…'))}</p>`;
    try {
      const params = new URLSearchParams({ page, pageSize });
      if (search) params.set('search', search);
      const res = await api.get(`/customers?${params}`);
      renderTable(tableEl, { columns, rows: res.data, actions: buildActions() });
      renderPagination(pagerEl, res.meta, (p) => { page = p; load(); });
    } catch (err) {
      tableEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ---- Row actions (only present when the user may write) ----
  function buildActions() {
    if (!canWrite) return [];
    return [
      { label: bi('Edit', 'تعديل'), className: 'btn-secondary', onClick: openEdit },
      {
        label: (row) => (row.is_active ? bi('Deactivate', 'إيقاف') : bi('Activate', 'تفعيل')),
        className: (row) => (row.is_active ? 'btn-danger' : 'btn-secondary'),
        onClick: toggleActive,
      },
    ];
  }

  // ---- Create ----
  function openCreate() {
    openFormModal({
      title: bi('Add Customer', 'إضافة عميل'),
      fields,
      onSubmit: async (values) => {
        await api.post('/customers', values);
        page = 1;
        await load();
      },
    });
  }

  // ---- Edit ----
  function openEdit(row) {
    openFormModal({
      title: `${bi('Edit Customer', 'تعديل عميل')} — ${row.name}`,
      fields,
      initialValues: toForm(row),
      onSubmit: async (values) => {
        await api.put(`/customers/${row.id}`, values);
        await load();
      },
    });
  }

  // ---- Soft delete / restore (toggle is_active) ----
  async function toggleActive(row) {
    const activating = !row.is_active;
    if (!activating && !confirmDelete(row.name)) return;
    try {
      await api.put(`/customers/${row.id}`, { isActive: activating });
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  // ---- Wire toolbar ----
  content.querySelector('#add-btn')?.addEventListener('click', openCreate);
  const doSearch = () => { search = searchInput.value.trim(); page = 1; load(); };
  content.querySelector('#search-btn').addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  load();
}
