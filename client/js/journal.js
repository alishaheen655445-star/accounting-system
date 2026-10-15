// -----------------------------------------------------------------------------
//  journal.js — Journal (general ledger entries) screen — Stitch design ("ds").
//  * Bilingual EN/AR UI (labels via bi(); direction flips through the shell).
//  * Lists posted entries with per-entry debit/credit totals + real KPI cards
//    computed from the API page/meta (no fake numbers).
//  * "View" opens the full entry (all lines) read-only; "Print" prints it.
//  * "New Entry" (admin/accountant) opens a manual journal form with DYNAMIC
//    lines and a LIVE balance indicator — the client only helps the user see the
//    Dr=Cr rule; the backend is still the authority that enforces it.
//  All API access stays in api.js; table/modal/pagination stay in crud.js;
//  every DB/user value is escaped with escapeHtml before innerHTML.
// -----------------------------------------------------------------------------
const content = renderLayout('journal', bi('Journal Entries', 'قيود اليومية'));
if (content) {
  const canWrite = hasAnyRole('admin', 'accountant');
  let page = 1;
  const pageSize = 15;
  let allRows = [];   // rows of the current page (search filters these client-side)
  let lastMeta = null;

  // Reference-source label in the active language (falls back to the raw value).
  const refLabel = (v) => ({
    manual: bi('Manual', 'يدوي'), invoice: bi('Invoice', 'فاتورة'),
    payment: bi('Payment', 'دفعة'), opening: bi('Opening', 'افتتاحي'),
  }[v] || v);
  const refIcons = { manual: 'edit_note', invoice: 'description', payment: 'payments', opening: 'flag' };

  // Status pill — every entry in this system is posted on save (is_posted=1),
  // so the list shows the "Posted" pill; the full-entry view uses the real flag.
  const postedPill = () => `
    <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-tertiary-fixed-dim/20 text-on-tertiary-fixed-variant">
      <span class="w-1.5 h-1.5 rounded-full bg-on-tertiary-fixed-variant" style="margin-inline-start:.375rem"></span>${escapeHtml(bi('Posted', 'مرحل'))}
    </span>`;

  const columns = [
    { key: 'entry_number', label: bi('Entry No.', 'رقم القيد'), render: (v) => `<span class="mono font-bold text-primary">${escapeHtml(v)}</span>` },
    { key: 'entry_date', label: bi('Date', 'التاريخ'), render: (v) => `<span class="text-on-surface-variant">${escapeHtml(String(v).slice(0, 10))}</span>` },
    { key: 'description', label: bi('Description', 'البيان / الوصف'), render: (v) => `<span class="font-medium">${escapeHtml(v || '')}</span>` },
    { key: 'reference_type', label: bi('Source', 'المصدر'), render: (v) => `
      <span class="inline-flex items-center gap-1 text-on-surface-variant">
        <span class="material-symbols-outlined text-[16px]">${refIcons[v] || 'link'}</span>${escapeHtml(refLabel(v) || '—')}
      </span>` },
    { key: 'total_debit', label: bi('Debit (SAR)', 'المدين (ر.س)'), numeric: true, render: (v) => `<span class="mono font-semibold">${formatMoney(v)}</span>` },
    { key: 'total_credit', label: bi('Credit (SAR)', 'الدائن (ر.س)'), numeric: true, render: (v) => `<span class="mono font-semibold">${formatMoney(v)}</span>` },
    { key: 'status', label: bi('Status', 'الحالة'), render: () => postedPill() },
  ];

  content.innerHTML = `
    <!-- Top Action & Overview Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface-container-low p-6 rounded-xl shadow-sm">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-md">${escapeHtml(bi('Double-Entry System', 'نظام المحاسبة المزدوجة'))}</span>
          <span class="text-on-surface-variant font-body-sm">/ ${escapeHtml(bi('General Journal', 'قيود اليومية العامة'))}</span>
        </div>
        <h1 class="font-headline-lg text-primary" style="margin:0">${escapeHtml(bi('Journal Entry Management', 'إدارة قيود اليومية'))}</h1>
        <p class="text-on-surface-variant font-body-md" style="margin:0">${escapeHtml(bi('Record and review accounting entries with automatic debit/credit balance checking.', 'تسجيل ومراجعة القيود المحاسبية مع التحقق التلقائي من توازن المدين والدائن.'))}</p>
      </div>
      <div class="flex items-center gap-3">
        ${canWrite ? `
        <button id="add-btn" class="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-on-primary font-label-lg hover:bg-primary/90 transition-all shadow-md cursor-pointer">
          <span class="material-symbols-outlined text-[20px]">add_circle</span>${escapeHtml(bi('New Entry', 'إنشاء قيد جديد'))}
        </button>` : ''}
        <button id="export-btn" class="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-container-high text-on-surface font-label-lg hover:bg-surface-container-highest transition-all cursor-pointer">
          <span class="material-symbols-outlined text-[20px]">download</span>${escapeHtml(bi('Export Report', 'تصدير التقرير'))}
        </button>
      </div>
    </div>

    <!-- KPI / Stats Summary Cards (real values from the API) -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-on-surface-variant font-label-md">${escapeHtml(bi('Total Journal Entries', 'إجمالي قيود اليومية'))}</span>
          <div class="w-10 h-10 rounded-xl bg-primary-fixed flex items-center justify-center text-primary">
            <span class="material-symbols-outlined">receipt_long</span>
          </div>
        </div>
        <span class="font-headline-md text-primary" id="kpi-total">…</span>
      </div>
      <div class="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-on-surface-variant font-label-md">${escapeHtml(bi('Posted Entries on This Page', 'القيود المرحّلة في هذه الصفحة'))}</span>
          <div class="w-10 h-10 rounded-xl bg-tertiary-fixed-dim/30 flex items-center justify-center text-tertiary-container">
            <span class="material-symbols-outlined">verified</span>
          </div>
        </div>
        <span class="font-headline-md text-primary" id="kpi-posted">…</span>
      </div>
      <div class="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-on-surface-variant font-label-md">${escapeHtml(bi('Latest Entry Date', 'أحدث تاريخ قيد'))}</span>
          <div class="w-10 h-10 rounded-xl bg-secondary-container flex items-center justify-center text-on-secondary-container">
            <span class="material-symbols-outlined">calendar_month</span>
          </div>
        </div>
        <span class="font-headline-md text-primary mono" id="kpi-lastdate">…</span>
      </div>
      <div class="bg-surface-container-lowest p-6 rounded-xl shadow-sm flex flex-col justify-between space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-on-surface-variant font-label-md">${escapeHtml(bi('Total Movements This Page (SAR)', 'إجمالي حركات هذه الصفحة (ر.س)'))}</span>
          <div class="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
            <span class="material-symbols-outlined">account_balance_wallet</span>
          </div>
        </div>
        <span class="font-headline-md text-primary" id="kpi-movement">…</span>
      </div>
    </div>

    <!-- Filters & Search Toolbar (filters the loaded page client-side) -->
    <div class="bg-surface-container-lowest p-4 rounded-xl shadow-sm flex flex-wrap items-center justify-between gap-4">
      <div class="relative flex-1 min-w-[280px]">
        <span class="absolute top-2.5 text-on-surface-variant" style="inset-inline-start:.75rem"><span class="material-symbols-outlined text-[20px]">search</span></span>
        <input id="je-search" class="w-full bg-surface-container-low text-on-surface text-sm rounded-xl py-2.5 outline-none focus:ring-2 focus:ring-primary/20"
          type="text" style="padding-inline-start:2.5rem;padding-inline-end:1rem"
          placeholder="${escapeHtml(bi('Search by entry no., description, or source…', 'بحث برقم القيد، البيان، أو المصدر...'))}" />
      </div>
      <span class="text-on-surface-variant font-body-sm">${escapeHtml(bi('Filters results on this page', 'يصفّي النتائج في هذه الصفحة'))}</span>
    </div>

    <!-- Journal Entries Main Table -->
    <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
      <div id="table"></div>
      <div id="pager"></div>
    </div>`;

  const tableEl = content.querySelector('#table');
  const pagerEl = content.querySelector('#pager');

  async function load() {
    tableEl.innerHTML = `<p class="muted p-6">${escapeHtml(bi('Loading…', 'جارٍ التحميل…'))}</p>`;
    try {
      const params = new URLSearchParams({ page, pageSize });
      const res = await api.get(`/journal?${params}`);
      allRows = res.data;
      lastMeta = res.meta;
      renderKpis();
      renderRows(allRows);
      renderPagination(pagerEl, lastMeta, (p) => { page = p; load(); });
    } catch (err) {
      tableEl.innerHTML = `<div class="alert alert-error m-6">${escapeHtml(err.message)}</div>`;
    }
  }

  function renderKpis() {
    content.querySelector('#kpi-total').textContent = String(lastMeta.total);
    content.querySelector('#kpi-posted').textContent = String(allRows.length);
    content.querySelector('#kpi-lastdate').textContent = allRows.length ? String(allRows[0].entry_date).slice(0, 10) : '—';
    // Display-only sum of this page (financial source of truth stays in the backend).
    const sum = allRows.reduce((s, r) => s + Math.round(Number(r.total_debit) * 100), 0) / 100;
    content.querySelector('#kpi-movement').textContent = formatMoney(sum);
  }

  function renderRows(rows) {
    renderTable(tableEl, {
      columns,
      rows,
      actions: [
        { label: bi('View', 'عرض'), className: 'btn-secondary', onClick: openView },
        { label: bi('Print', 'طباعة'), className: 'btn-secondary', onClick: (row) => openView(row, true) },
      ],
    });
  }

  // ---- Client-side search over the loaded page -->
  content.querySelector('#je-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) return renderRows(allRows);
    const filtered = allRows.filter((r) =>
      String(r.entry_number).toLowerCase().includes(q) ||
      String(r.description || '').toLowerCase().includes(q) ||
      String(refLabel(r.reference_type) || '').toLowerCase().includes(q)
    );
    renderRows(filtered);
  });

  // ---- Export the loaded page as CSV (UTF-8 BOM so Excel shows Arabic) ----
  content.querySelector('#export-btn').addEventListener('click', () => {
    const head = [bi('Entry No.', 'رقم القيد'), bi('Date', 'التاريخ'), bi('Description', 'البيان'), bi('Source', 'المصدر'), bi('Debit', 'المدين'), bi('Credit', 'الدائن')];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = allRows.map((r) => [
      esc(r.entry_number), esc(String(r.entry_date).slice(0, 10)), esc(r.description),
      esc(refLabel(r.reference_type)), esc(r.total_debit), esc(r.total_credit),
    ].join(','));
    const blob = new Blob(['\ufeff' + [head.map(esc).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `journal-entries-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  // ---- Read-only detail view (with real is_posted status) ----
  async function openView(row, autoPrint = false) {
    let full;
    try {
      const res = await api.get(`/journal/${row.id}`);
      full = res.data.entry;
    } catch (err) {
      alert(err.message);
      return;
    }
    const lines = full.lines.map((l) => `
      <tr>
        <td class="mono">${escapeHtml(l.account_code)}</td>
        <td>${escapeHtml(l.account_name)}</td>
        <td class="num">${Number(l.debit) > 0 ? formatMoney(l.debit) : ''}</td>
        <td class="num">${Number(l.credit) > 0 ? formatMoney(l.credit) : ''}</td>
        <td class="muted">${escapeHtml(l.memo || '')}</td>
      </tr>`).join('');
    // Cent-integer sums for display only (same rounding rule as the backend).
    const tDebit = full.lines.reduce((s, l) => s + Math.round(Number(l.debit) * 100), 0) / 100;
    const tCredit = full.lines.reduce((s, l) => s + Math.round(Number(l.credit) * 100), 0) / 100;
    const statusHtml = full.is_posted ? postedPill() : `
      <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-secondary-container text-on-secondary-container">
        <span class="w-1.5 h-1.5 rounded-full bg-on-secondary-container" style="margin-inline-start:.375rem"></span>${escapeHtml(bi('Draft', 'مسودة'))}
      </span>`;

    openCustomModal(`${bi('Entry', 'قيد')} ${full.entry_number}`, `
      <div class="detail-grid">
        <div class="kv"><div class="k">${escapeHtml(bi('Date', 'التاريخ'))}</div><div class="v">${escapeHtml(String(full.entry_date).slice(0, 10))}</div></div>
        <div class="kv"><div class="k">${escapeHtml(bi('Source', 'المصدر'))}</div><div class="v">${escapeHtml(refLabel(full.reference_type) || '—')}</div></div>
        <div class="kv"><div class="k">${escapeHtml(bi('Status', 'الحالة'))}</div><div class="v">${statusHtml}</div></div>
        <div class="kv"><div class="k">${escapeHtml(bi('Description', 'البيان'))}</div><div class="v">${escapeHtml(full.description || '')}</div></div>
      </div>
      <div class="table-wrap">
        <table class="lines-table">
          <thead><tr><th>${escapeHtml(bi('Account', 'الحساب'))}</th><th>${escapeHtml(bi('Account Name', 'اسم الحساب'))}</th><th class="num">${escapeHtml(bi('Debit', 'مدين'))}</th><th class="num">${escapeHtml(bi('Credit', 'دائن'))}</th><th>${escapeHtml(bi('Memo', 'ملاحظة'))}</th></tr></thead>
          <tbody>${lines}</tbody>
        </table>
      </div>
      <div class="bg-tertiary-fixed-dim/15 border border-on-tertiary-fixed-variant/30 p-4 rounded-xl flex items-center justify-between text-on-surface mt-1">
        <span class="font-label-lg text-on-tertiary-fixed-variant">${escapeHtml(bi('Total Debit / Credit', 'إجمالي المدين / الدائن'))}</span>
        <span class="mono font-bold text-sm">${formatMoney(tDebit)} / ${formatMoney(tCredit)} ${escapeHtml(bi('SAR', 'ر.س'))}</span>
      </div>`,
      autoPrint ? () => { window.print(); return true; } : null
    );
    if (autoPrint) setTimeout(() => window.print(), 150);
  }

  // ---- Manual entry with dynamic lines (Stitch modal body) ----
  async function openCreate() {
    let accounts;
    try { accounts = await loadAccounts(); }
    catch (err) { alert(err.message); return; }

    const today = new Date().toISOString().slice(0, 10);
    openCustomModal(bi('Create New Double-Entry Journal Entry', 'إنشاء قيد يومية مزدوج جديد'), `
      <div id="modal-error" class="alert alert-error hidden mb-4"></div>

      <!-- Metadata Fields -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="space-y-1.5">
          <label class="text-on-surface font-label-md">${escapeHtml(bi('Entry Date *', 'تاريخ القيد *'))}</label>
          <input type="date" id="je-date" value="${today}"
            class="w-full bg-surface-container-low text-on-surface text-sm rounded-xl px-4 py-2.5 outline-none" />
        </div>
        <div class="space-y-1.5">
          <label class="text-on-surface font-label-md">${escapeHtml(bi('Entry Description *', 'البيان العام للقيد *'))}</label>
          <input type="text" id="je-desc" placeholder="${escapeHtml(bi('Describe the reason and type of this entry…', 'اكتب وصفاً تفصيلياً لسبب ونوع القيد المحاسبي...'))}"
            class="w-full bg-surface-container-low text-on-surface text-sm rounded-xl px-4 py-2.5 outline-none" />
        </div>
      </div>

      <!-- Detailed Account Rows -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-headline-sm text-primary" style="margin:0">${escapeHtml(bi('Account Details (Debit & Credit)', 'تفاصيل الحسابات (المدين والدائن)'))}</h4>
          <button type="button" id="je-add"
            class="flex items-center gap-1.5 text-xs font-label-md text-primary hover:underline bg-primary-fixed/50 px-3 py-1.5 rounded-lg cursor-pointer">
            <span class="material-symbols-outlined text-[16px]">add</span>${escapeHtml(bi('Add Account Row', 'إضافة صف حساب'))}
          </button>
        </div>
        <div class="bg-surface-container-low rounded-xl p-2 overflow-x-auto">
          <table class="lines-table w-full">
            <thead>
              <tr class="text-on-surface-variant font-label-sm">
                <th style="min-width:240px">${escapeHtml(bi('Account *', 'الحساب المحاسبي *'))}</th>
                <th class="num" style="width:130px">${escapeHtml(bi('Debit (SAR)', 'المدين (ر.س)'))}</th>
                <th class="num" style="width:130px">${escapeHtml(bi('Credit (SAR)', 'الدائن (ر.س)'))}</th>
                <th style="width:200px">${escapeHtml(bi('Memo', 'ملاحظة'))}</th>
                <th class="num" style="width:40px"></th>
              </tr>
            </thead>
            <tbody id="je-lines"></tbody>
          </table>
        </div>

        <!-- Realtime Balance Verification Box -->
        <div id="balance-box" class="p-4 rounded-xl flex items-center justify-between text-on-surface transition-all bg-error-container/20 border border-error/30">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-error text-[24px]" id="balance-icon">error</span>
            <p class="font-label-lg" id="balance-text">${escapeHtml(bi('Enter debit and credit amounts to check balance', 'أدخل مبالغ المدين والدائن للتحقق من التوازن'))}</p>
          </div>
          <div class="flex items-center gap-6 mono font-bold text-sm">
            <div>${escapeHtml(bi('Debit', 'المدين'))}: <span class="text-primary" id="je-td">0.00</span></div>
            <div>${escapeHtml(bi('Credit', 'الدائن'))}: <span class="text-primary" id="je-tc">0.00</span></div>
          </div>
        </div>
      </div>`,
      () => submitEntry(accounts)
    );

    const linesBody = document.getElementById('je-lines');
    const fieldCls = 'w-full bg-surface-container-highest/60 text-on-surface text-xs rounded-lg p-2 outline-none';
    const acctOptions = `<option value="">${escapeHtml(bi('— Select account —', '— اختر الحساب —'))}</option>` +
      optionsHtml(accounts, 'id', (a) => `${a.code} - ${a.name}`);

    function addLine() {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><select class="je-acct ${fieldCls}">${acctOptions}</select></td>
        <td class="num"><input type="number" class="je-debit ${fieldCls} mono" step="0.01" min="0" placeholder="0.00" /></td>
        <td class="num"><input type="number" class="je-credit ${fieldCls} mono" step="0.01" min="0" placeholder="0.00" /></td>
        <td><input type="text" class="je-memo ${fieldCls}" placeholder="${escapeHtml(bi('Sub-memo', 'بيان فرعي'))}" /></td>
        <td class="num"><button type="button" class="row-del text-error p-1 hover:bg-error-container/20 rounded cursor-pointer" title="${escapeHtml(bi('Delete row', 'حذف الصف'))}">
          <span class="material-symbols-outlined text-[16px]">delete</span></button></td>`;
      tr.querySelector('.row-del').addEventListener('click', () => { tr.remove(); recompute(); });
      tr.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', recompute));
      linesBody.appendChild(tr);
    }

    // Recompute running totals + the live balance box (cent-integer comparison).
    function recompute() {
      let td = 0, tc = 0;
      linesBody.querySelectorAll('tr').forEach((tr) => {
        td += Math.round((Number(tr.querySelector('.je-debit').value) || 0) * 100);
        tc += Math.round((Number(tr.querySelector('.je-credit').value) || 0) * 100);
      });
      document.getElementById('je-td').textContent = formatMoney(td / 100);
      document.getElementById('je-tc').textContent = formatMoney(tc / 100);

      const balanced = td > 0 && td === tc;
      const box = document.getElementById('balance-box');
      const icon = document.getElementById('balance-icon');
      const text = document.getElementById('balance-text');
      if (balanced) {
        box.className = 'p-4 rounded-xl flex items-center justify-between text-on-surface transition-all bg-tertiary-fixed-dim/15 border border-on-tertiary-fixed-variant/30';
        icon.textContent = 'check_circle';
        icon.className = 'material-symbols-outlined text-on-tertiary-fixed-variant text-[24px]';
        text.textContent = bi('The entry is perfectly balanced (debit equals credit) — ready to save and post.', 'القيد متوازن تماماً (المدين يساوي الدائن) — يمكن الحفظ والترحيل.');
      } else {
        box.className = 'p-4 rounded-xl flex items-center justify-between text-on-surface transition-all bg-error-container/20 border border-error/30';
        icon.textContent = td === tc ? 'error' : 'balance';
        icon.className = 'material-symbols-outlined text-error text-[24px]';
        text.textContent = td === tc
          ? bi('Enter debit and credit amounts to check balance', 'أدخل مبالغ المدين والدائن للتحقق من التوازن')
          : bi(`Unbalanced entry! Difference ${formatMoney(Math.abs(td - tc) / 100)} SAR`, `القيد غير متوازن! الفرق ${formatMoney(Math.abs(td - tc) / 100)} ر.س`);
      }
    }

    document.getElementById('je-add').addEventListener('click', addLine);
    addLine();
    addLine(); // start with two lines (the minimum)

    async function submitEntry() {
      const errBox = document.getElementById('modal-error');
      errBox.classList.add('hidden');
      const fail = (msg) => { errBox.textContent = msg; errBox.classList.remove('hidden'); return false; };

      const entryDate = document.getElementById('je-date').value;
      const description = document.getElementById('je-desc').value.trim();
      if (!entryDate) return fail(bi('Entry date is required.', 'تاريخ القيد مطلوب.'));
      if (!description) return fail(bi('Description is required.', 'البيان مطلوب.'));

      const lines = [];
      const rows = [...linesBody.querySelectorAll('tr')];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const accountId = r.querySelector('.je-acct').value;
        const debit = r.querySelector('.je-debit').value;
        const credit = r.querySelector('.je-credit').value;
        const memo = r.querySelector('.je-memo').value.trim();
        if (!accountId) continue; // ignore fully blank lines
        if (Number(debit) > 0 && Number(credit) > 0) return fail(bi(`Line ${i + 1}: use debit OR credit, not both.`, `السطر ${i + 1}: استخدم مديناً أو دائناً، لا كليهما.`));
        if (!(Number(debit) > 0) && !(Number(credit) > 0)) return fail(bi(`Line ${i + 1}: enter an amount (debit or credit).`, `السطر ${i + 1}: أدخل مبلغاً (مدين أو دائن).`));
        lines.push({ accountId: Number(accountId), debit: debit || '0', credit: credit || '0', memo: memo || undefined });
      }
      if (lines.length < 2) return fail(bi('The entry needs at least two lines.', 'القيد يحتاج سطرين على الأقل.'));

      const td = lines.reduce((s, l) => s + Math.round(Number(l.debit) * 100), 0);
      const tc = lines.reduce((s, l) => s + Math.round(Number(l.credit) * 100), 0);
      if (td !== tc) return fail(bi('Total debit must equal total credit.', 'يجب أن يطابق إجمالي المدين إجمالي الدائن.'));

      try {
        await api.post('/journal', { entryDate, description, referenceType: 'manual', lines });
        closeModal();
        page = 1;
        await load();
      } catch (err) {
        return fail(err.message || bi('Failed to post the entry.', 'فشل ترحيل القيد.'));
      }
    }
  }

  content.querySelector('#add-btn')?.addEventListener('click', openCreate);
  load();
}
