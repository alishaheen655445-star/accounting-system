// -----------------------------------------------------------------------------
//  products.js — Products CRUD screen (Stitch design-system, bilingual EN·AR).
//  Same pattern as customers.js; shared chrome is bilingual via t(); labels via bi().
// -----------------------------------------------------------------------------
const content = renderLayout('products', bi('Products', 'المنتجات'));
if (content) {
  const canWrite = hasAnyRole('admin', 'accountant');
  let page = 1;
  let search = '';
  const pageSize = 10;

  const columns = [
    { key: 'sku', label: bi('SKU', 'رمز المنتج'), render: (v) => `<span class="mono">${escapeHtml(v)}</span>` },
    { key: 'name', label: bi('Name', 'الاسم') },
    { key: 'unit', label: bi('Unit', 'الوحدة', 'واحد'), render: (v) => escapeHtml(v || '—') },
    { key: 'stock_quantity', label: bi('In Stock', 'المتوفر', 'موجود'), numeric: true, render: (v) => `<span class="mono">${escapeHtml(String(Number(v)))}</span>` },
    { key: 'selling_price', label: bi('Selling Price', 'سعر البيع', 'قیمت فروش'), numeric: true, render: (v) => formatMoney(v) },
    { key: 'cost_price', label: bi('Cost Price', 'سعر التكلفة', 'قیمت تمام‌شده'), numeric: true, render: (v) => formatMoney(v) },
    { key: 'is_active', label: bi('Status', 'الحالة'), render: (v) => `<span class="status ${v ? 'active' : 'deactivated'}">${escapeHtml(v ? bi('Active', 'نشط') : bi('Inactive', 'غير نشط'))}</span>` },
  ];

  const fields = [
    { name: 'name', label: bi('Name', 'الاسم'), type: 'text', required: true },
    {
      name: 'type', label: bi('Product Type', 'نوع المنتج', 'نوع محصول'), type: 'select', required: true,
      options: [
        { value: 'goods', label: bi('Goods (tracked in stock)', 'بضاعة (مُتبَّعة في المخزون)', 'کالا (انباری)') },
        { value: 'service', label: bi('Service (no stock)', 'خدمة (بدون مخزون)', 'خدمت (غیر انباری)') },
      ],
    },
    { name: 'sku', label: bi('SKU', 'رمز المنتج'), type: 'text', placeholder: bi('Leave blank to auto-generate', 'اتركه فارغًا للتوليد التلقائي') },
    { name: 'unit', label: bi('Unit', 'الوحدة'), type: 'text', placeholder: bi('pcs, hour, kg…', 'قطعة، ساعة، كغ…') },
    { name: 'sellingPrice', label: bi('Selling Price', 'سعر البيع'), type: 'number', placeholder: '0.00' },
    { name: 'costPrice', label: bi('Cost Price', 'سعر التكلفة'), type: 'number', placeholder: '0.00' },
    { name: 'description', label: bi('Description', 'الوصف'), type: 'textarea' },
  ];

  const toForm = (row) => ({
    name: row.name, type: row.inventory_account_id ? 'goods' : 'service', sku: row.sku || '', unit: row.unit || '',
    sellingPrice: row.selling_price, costPrice: row.cost_price, description: row.description || '',
  });

  content.innerHTML = `
    <div class="bg-surface-container-low p-6 rounded-xl shadow-sm">
      <h1 class="font-headline-lg text-headline-lg text-primary" style="margin:0">${escapeHtml(bi('Product Management', 'إدارة المنتجات'))}</h1>
      <p class="text-on-surface-variant font-body-md" style="margin:.25rem 0 0">${escapeHtml(bi('Items, units, and selling / cost prices.', 'الأصناف والوحدات وأسعار البيع والتكلفة.'))}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3 bg-surface-container-lowest p-4 rounded-xl shadow-sm">
      <div class="relative">
        <input id="search" type="text" placeholder="${escapeHtml(bi('Search by name or SKU…', 'ابحث بالاسم أو رمز المنتج…'))}"
          class="py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface font-body-md w-72 focus:outline-none focus:border-primary" style="padding-inline-start:2.75rem;padding-inline-end:1rem" />
        <span class="absolute top-1/2 -translate-y-1/2 text-outline" style="inset-inline-start:.75rem"><span class="material-symbols-outlined text-[20px]">search</span></span>
      </div>
      <button id="search-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-lg transition-all">
        <span class="material-symbols-outlined text-[18px]">search</span>${escapeHtml(bi('Search', 'بحث'))}
      </button>
      <div class="flex-1"></div>
      ${canWrite ? `<button id="add-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg transition-all shadow-sm">
        <span class="material-symbols-outlined text-[18px]">inventory_2</span>${escapeHtml(bi('Add Product', 'إضافة منتج'))}</button>` : ''}
    </div>
    <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
      <div class="p-6" id="table"></div>
      <div class="px-6 pb-6" id="pager"></div>
    </div>`;

  const tableEl = content.querySelector('#table');
  const pagerEl = content.querySelector('#pager');
  const searchInput = content.querySelector('#search');

  async function load() {
    tableEl.innerHTML = `<p class="muted">${escapeHtml(bi('Loading…', 'جارٍ التحميل…'))}</p>`;
    try {
      const params = new URLSearchParams({ page, pageSize });
      if (search) params.set('search', search);
      const res = await api.get(`/products?${params}`);
      renderTable(tableEl, { columns, rows: res.data, actions: buildActions() });
      renderPagination(pagerEl, res.meta, (p) => { page = p; load(); });
    } catch (err) {
      tableEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

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

  function openCreate() {
    openFormModal({
      title: bi('Add Product', 'إضافة منتج'),
      fields,
      initialValues: { type: 'goods' },
      onSubmit: async (values) => { await api.post('/products', values); page = 1; await load(); },
    });
  }

  function openEdit(row) {
    openFormModal({
      title: `${bi('Edit Product', 'تعديل منتج')} — ${row.name}`,
      fields,
      initialValues: toForm(row),
      onSubmit: async (values) => { await api.put(`/products/${row.id}`, values); await load(); },
    });
  }

  async function toggleActive(row) {
    const activating = !row.is_active;
    if (!activating && !confirmDelete(row.name)) return;
    try { await api.put(`/products/${row.id}`, { isActive: activating }); await load(); }
    catch (err) { alert(err.message); }
  }

  content.querySelector('#add-btn')?.addEventListener('click', openCreate);
  const doSearch = () => { search = searchInput.value.trim(); page = 1; load(); };
  content.querySelector('#search-btn').addEventListener('click', doSearch);
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

  load();
}
