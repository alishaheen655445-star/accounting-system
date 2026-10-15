// -----------------------------------------------------------------------------
//  users.js — User management screen (ADMIN ONLY, bilingual EN·AR).
//  Same TEMPLATE pattern as customers.js: describe COLUMNS + FORM FIELDS, then
//  let crud.js + api.js do the work. Password is required on create and optional
//  on edit (blank = keep the existing hash). The API also enforces admin-only.
// -----------------------------------------------------------------------------
const content = renderLayout('users', bi('Users', 'المستخدمون'));
if (content) {
  const isAdmin = hasAnyRole('admin');

  if (!isAdmin) {
    // Defense-in-depth: the API rejects non-admins, but hide the UI too.
    content.innerHTML = `<div class="alert alert-error">${escapeHtml(bi(
      'You do not have permission to access this page.',
      'ليس لديك صلاحية للدخول إلى هذه الصفحة.'))}</div>`;
  } else {
    let page = 1;
    let search = '';
    const pageSize = 10;

    const roleLabels = { admin: bi('Admin', 'مدير'), accountant: bi('Accountant', 'محاسب'), viewer: bi('Viewer', 'مشاهد') };
    const fmtDate = (v) => {
      if (!v) return '—';
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? escapeHtml(String(v)) : escapeHtml(d.toLocaleString());
    };

    const columns = [
      { key: 'username', label: bi('Username', 'اسم المستخدم'), render: (v) => `<span class="mono">${escapeHtml(v)}</span>` },
      { key: 'full_name', label: bi('Full Name', 'الاسم الكامل'), render: (v) => escapeHtml(v || '—') },
      { key: 'email', label: bi('Email', 'البريد الإلكتروني'), render: (v) => escapeHtml(v || '—') },
      { key: 'role', label: bi('Role', 'الدور'), render: (v) => `<span class="status issued">${escapeHtml(roleLabels[v] || v)}</span>` },
      { key: 'is_active', label: bi('Status', 'الحالة'), render: (v) => `<span class="status ${v ? 'active' : 'deactivated'}">${escapeHtml(v ? bi('Active', 'نشط') : bi('Inactive', 'غير نشط'))}</span>` },
      { key: 'created_at', label: bi('Created', 'تاريخ الإنشاء'), render: fmtDate },
    ];

    // Base fields; the password field differs between create (required) and edit.
    const baseFields = [
      { name: 'fullName', label: bi('Full Name', 'الاسم الكامل'), type: 'text', required: true },
      { name: 'username', label: bi('Username', 'اسم المستخدم'), type: 'text', required: true },
      { name: 'email', label: bi('Email', 'البريد الإلكتروني'), type: 'email', required: true, placeholder: 'name@example.com' },
      { name: 'role', label: bi('Role', 'الدور'), type: 'select', required: true, options: [
        { value: 'admin', label: roleLabels.admin },
        { value: 'accountant', label: roleLabels.accountant },
        { value: 'viewer', label: roleLabels.viewer },
      ] },
    ];
    const createFields = [...baseFields, { name: 'password', label: bi('Password', 'كلمة المرور'), type: 'password', required: true, placeholder: bi('At least 6 characters', '٦ أحرف على الأقل') }];
    const editFields = [...baseFields, { name: 'password', label: bi('New Password', 'كلمة المرور الجديدة'), type: 'password', placeholder: bi('Leave blank to keep current', 'اتركها فارغة للإبقاء على الحالية') }];

    const toForm = (row) => ({
      fullName: row.full_name, username: row.username, email: row.email || '', role: row.role,
    });

    content.innerHTML = `
      <div class="bg-surface-container-low p-6 rounded-xl shadow-sm">
        <h1 class="font-headline-lg text-headline-lg text-primary" style="margin:0">${escapeHtml(bi('User Management', 'إدارة المستخدمين'))}</h1>
        <p class="text-on-surface-variant font-body-md" style="margin:.25rem 0 0">${escapeHtml(bi('Create accounts and assign roles (administrators only).', 'إنشاء الحسابات وتعيين الأدوار (للمدراء فقط).'))}</p>
      </div>
      <div class="flex flex-wrap items-center gap-3 bg-surface-container-lowest p-4 rounded-xl shadow-sm">
        <div class="relative">
          <input id="search" type="text" placeholder="${escapeHtml(bi('Search by name, username or email…', 'ابحث بالاسم أو اسم المستخدم أو البريد…'))}"
            class="py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface font-body-md w-72 focus:outline-none focus:border-primary" style="padding-inline-start:2.75rem;padding-inline-end:1rem" />
          <span class="absolute top-1/2 -translate-y-1/2 text-outline" style="inset-inline-start:.75rem"><span class="material-symbols-outlined text-[20px]">search</span></span>
        </div>
        <button id="search-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-lg transition-all">
          <span class="material-symbols-outlined text-[18px]">search</span>${escapeHtml(bi('Search', 'بحث'))}
        </button>
        <div class="flex-1"></div>
        <button id="add-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg transition-all shadow-sm">
          <span class="material-symbols-outlined text-[18px]">person_add</span>${escapeHtml(bi('Add User', 'إضافة مستخدم'))}</button>
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
        const res = await api.get(`/users?${params}`);
        renderTable(tableEl, { columns, rows: res.data, actions: buildActions() });
        renderPagination(pagerEl, res.meta, (p) => { page = p; load(); });
      } catch (err) {
        tableEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      }
    }

    function buildActions() {
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
        title: bi('Add User', 'إضافة مستخدم'),
        fields: createFields,
        onSubmit: async (values) => { await api.post('/users', values); page = 1; await load(); },
      });
    }

    function openEdit(row) {
      openFormModal({
        title: `${bi('Edit User', 'تعديل مستخدم')} — ${row.username}`,
        fields: editFields,
        initialValues: toForm(row),
        onSubmit: async (values) => { await api.put(`/users/${row.id}`, values); await load(); },
      });
    }

    async function toggleActive(row) {
      const activating = !row.is_active;
      if (!activating && !confirmDelete(row.username)) return;
      try {
        await api.put(`/users/${row.id}`, { isActive: activating });
        await load();
      } catch (err) {
        alert(err.message);
      }
    }

    content.querySelector('#add-btn')?.addEventListener('click', openCreate);
    const doSearch = () => { search = searchInput.value.trim(); page = 1; load(); };
    content.querySelector('#search-btn').addEventListener('click', doSearch);
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

    load();
  }
}
