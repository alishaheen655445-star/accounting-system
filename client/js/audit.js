// -----------------------------------------------------------------------------
//  audit.js — Audit trail viewer (ADMIN ONLY, READ-ONLY, bilingual EN·AR).
//  Same TEMPLATE pattern as users.js but with no create/edit/delete: the trail
//  is immutable. Search across action/entity/description/actor + an entity
//  filter dropdown fed by /api/audit/entities. The API also enforces admin-only.
// -----------------------------------------------------------------------------
const content = renderLayout('audit', bi('Audit Log', 'سجل التدقيق'));
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
    let entity = '';
    const pageSize = 20;

    const fmtDate = (v) => {
      if (!v) return '—';
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? escapeHtml(String(v)) : escapeHtml(d.toLocaleString());
    };

    const columns = [
      { key: 'created_at', label: bi('When', 'الوقت'), render: fmtDate },
      { key: 'actor', label: bi('Actor', 'المستخدم'), render: (v) => `<span class="mono">${escapeHtml(v || '—')}</span>` },
      { key: 'action', label: bi('Action', 'الإجراء'), render: (v) => `<span class="mono">${escapeHtml(v || '')}</span>` },
      { key: 'entity', label: bi('Entity', 'الكيان'), render: (v) => escapeHtml(v || '—') },
      { key: 'entity_id', label: bi('Ref', 'المرجع'), render: (v) => escapeHtml(v == null || v === '' ? '—' : String(v)) },
      { key: 'description', label: bi('Description', 'الوصف'), render: (v) => escapeHtml(v || '—') },
      { key: 'ip_address', label: bi('IP', 'العنوان'), render: (v) => `<span class="mono">${escapeHtml(v || '—')}</span>` },
    ];

    content.innerHTML = `
      <div class="bg-surface-container-low p-6 rounded-xl shadow-sm">
        <h1 class="font-headline-lg text-headline-lg text-primary" style="margin:0">${escapeHtml(bi('Audit Trail', 'سجل التدقيق'))}</h1>
        <p class="text-on-surface-variant font-body-md" style="margin:.25rem 0 0">${escapeHtml(bi('Immutable record of every important action (administrators only).', 'سجل غير قابل للتعديل لكل إجراء مهم (للمدراء فقط).'))}</p>
      </div>
      <div class="flex flex-wrap items-center gap-3 bg-surface-container-lowest p-4 rounded-xl shadow-sm">
        <div class="relative">
          <input id="search" type="text" placeholder="${escapeHtml(bi('Search action, entity, description or actor…', 'ابحث بالإجراء أو الكيان أو الوصف أو المستخدم…'))}"
            class="py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface font-body-md w-72 focus:outline-none focus:border-primary" style="padding-inline-start:2.75rem;padding-inline-end:1rem" />
          <span class="absolute top-1/2 -translate-y-1/2 text-outline" style="inset-inline-start:.75rem"><span class="material-symbols-outlined text-[20px]">search</span></span>
        </div>
        <select id="entity" class="py-2.5 px-3 rounded-xl border border-outline-variant bg-surface text-on-surface font-body-md focus:outline-none focus:border-primary">
          <option value="">${escapeHtml(bi('All entities', 'كل الكيانات'))}</option>
        </select>
        <button id="search-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-lg transition-all">
          <span class="material-symbols-outlined text-[18px]">search</span>${escapeHtml(bi('Search', 'بحث'))}
        </button>
        <div class="flex-1"></div>
        <button id="refresh-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-container-high text-on-surface hover:bg-surface-container-highest font-label-lg transition-all">
          <span class="material-symbols-outlined text-[18px]">refresh</span>${escapeHtml(bi('Refresh', 'تحديث'))}
        </button>
      </div>
      <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
        <div class="p-6" id="table"></div>
        <div class="px-6 pb-6" id="pager"></div>
      </div>`;

    const tableEl = content.querySelector('#table');
    const pagerEl = content.querySelector('#pager');
    const searchInput = content.querySelector('#search');
    const entitySelect = content.querySelector('#entity');

    async function load() {
      tableEl.innerHTML = `<p class="muted">${escapeHtml(bi('Loading…', 'جارٍ التحميل…'))}</p>`;
      try {
        const params = new URLSearchParams({ page, pageSize });
        if (search) params.set('search', search);
        if (entity) params.set('entity', entity);
        const res = await api.get(`/audit?${params}`);
        renderTable(tableEl, { columns, rows: res.data });
        renderPagination(pagerEl, res.meta, (p) => { page = p; load(); });
      } catch (err) {
        tableEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      }
    }

    // Populate the entity filter dropdown once (best-effort; failure is silent).
    async function loadEntities() {
      try {
        const res = await api.get('/audit/entities');
        const list = (res.data && res.data.entities) || [];
        entitySelect.innerHTML = `<option value="">${escapeHtml(bi('All entities', 'كل الكيانات'))}</option>`
          + list.map((e) => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join('');
      } catch (_) { /* leave the default single option */ }
    }

    const doSearch = () => { search = searchInput.value.trim(); entity = entitySelect.value; page = 1; load(); };
    content.querySelector('#search-btn').addEventListener('click', doSearch);
    content.querySelector('#refresh-btn').addEventListener('click', () => { page = 1; load(); });
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    entitySelect.addEventListener('change', doSearch);

    loadEntities();
    load();
  }
}
