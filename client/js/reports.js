// -----------------------------------------------------------------------------
//  reports.js — Read-only financial reports in a single tabbed screen
//  (Stitch design-system, bilingual EN/AR).
//  Four reports (all available to any signed-in user, matching the API):
//    1) Trial Balance     — every postable account's net Dr/Cr + balance check
//    2) Income Statement  — Revenue − Expense = Net Income
//    3) General Ledger    — pick an account → chronological lines + running bal
//    4) Customer Statement— pick a customer → invoices + payments + outstanding
//  Reports are pure views over the ledger; the numbers come straight from the
//  backend (integer-cents math), the UI only formats and lays them out.
//  Every user-visible string is authored as bi(en, ar) (see ui.js).
// -----------------------------------------------------------------------------
const content = renderLayout('reports', bi('Financial Reports', 'التقارير المالية'));

// Labels for the raw API enum values in the active language (CSS keeps raw value).
const accTypeLabel = (v) => ({ asset: bi('Asset', 'أصول'), liability: bi('Liability', 'خصوم'), equity: bi('Equity', 'حقوق ملكية'), revenue: bi('Revenue', 'إيرادات'), expense: bi('Expense', 'مصروفات') }[String(v).toLowerCase()] || v);
const invStatusLabel = (v) => ({ draft: bi('Draft', 'مسودة'), issued: bi('Issued', 'مصدّرة'), partial: bi('Partially Paid', 'مدفوعة جزئيًا'), paid: bi('Paid', 'مدفوعة') }[v] || v);
const payMethodLabel = (v) => ({ cash: bi('Cash', 'نقدًا'), bank: bi('Bank', 'بنك'), cheque: bi('Cheque', 'شيك'), card: bi('Card', 'بطاقة') }[v] || v);

if (content) {
  const TABS = [
    { key: 'trial', label: bi('Trial Balance', 'ميزان المراجعة') },
    { key: 'income', label: bi('Income Statement', 'قائمة الدخل') },
    { key: 'ledger', label: bi('General Ledger', 'دفتر الأستاذ العام') },
    { key: 'customer', label: bi('Customer Statement', 'كشف حساب عميل') },
  ];
  let active = 'trial';

  const TAB_ON = 'px-4 py-2.5 rounded-lg bg-primary text-on-primary font-label-lg transition-all';
  const TAB_OFF = 'px-4 py-2.5 rounded-lg text-on-surface-variant hover:bg-surface-container-high font-label-lg transition-all';

  content.innerHTML = `
    <div class="bg-surface-container-low p-6 rounded-xl shadow-sm">
      <h1 class="font-headline-lg text-headline-lg text-primary" style="margin:0">${escapeHtml(bi('Financial Reports', 'التقارير المالية'))}</h1>
      <p class="text-on-surface-variant font-body-md" style="margin:.25rem 0 0">${escapeHtml(bi('Live financial readings built directly on the ledger — not editable here.', 'قراءات مالية لحظية مبنية مباشرة على دفتر الأستاذ — لا تُعدَّل هنا.'))}</p>
    </div>
    <div class="flex flex-wrap gap-2 bg-surface-container-lowest p-2 rounded-xl shadow-sm" id="tabs">
      ${TABS.map((tb) => `<button data-tab="${tb.key}" class="${tb.key === active ? TAB_ON : TAB_OFF}">${escapeHtml(tb.label)}</button>`).join('')}
    </div>
    <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
      <div class="p-6" id="report-body"><p class="muted">${escapeHtml(bi('Loading…', 'جارٍ التحميل…'))}</p></div>
    </div>`;

  const body = content.querySelector('#report-body');

  function refreshTabs() {
    content.querySelectorAll('#tabs button').forEach((b) => {
      b.className = b.dataset.tab === active ? TAB_ON : TAB_OFF;
    });
  }

  content.querySelector('#tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    active = btn.dataset.tab;
    refreshTabs();
    render().catch(setError);
  });

  function setLoading() { body.innerHTML = `<p class="muted">${escapeHtml(bi('Loading…', 'جارٍ التحميل…'))}</p>`; }
  function setError(err) { body.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || bi('Could not load the report.', 'تعذّر تحميل التقرير.'))}</div>`; }

  function render() {
    setLoading();
    if (active === 'trial') return trialBalance();
    if (active === 'income') return incomeStatement();
    if (active === 'ledger') return generalLedger();
    if (active === 'customer') return customerStatement();
  }

  // ---- 1) Trial Balance ----
  async function trialBalance() {
    const { data } = await api.get('/reports/trial-balance');
    const rows = data.accounts.map((a) => `
      <tr>
        <td class="mono">${escapeHtml(a.code)}</td>
        <td>${escapeHtml(a.name)}</td>
        <td>${escapeHtml(accTypeLabel(a.account_type))}</td>
        <td class="num">${Number(a.debit_balance) ? formatMoney(a.debit_balance) : ''}</td>
        <td class="num">${Number(a.credit_balance) ? formatMoney(a.credit_balance) : ''}</td>
      </tr>`).join('');

    const ok = data.totals.balanced;
    body.innerHTML = `
      <div class="alert alert-${ok ? 'success' : 'error'}">
        ${ok ? escapeHtml(bi('✓ Books are balanced — total debits equal total credits.', '✓ الدفاتر متوازنة — إجمالي البنود المدينة يساوي الدائنة.')) : escapeHtml(bi('✗ Warning: debits and credits do not match.', '✗ تحذير: الطرفان المدين والدائن غير متطابقين.'))}
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>${escapeHtml(bi('Code', 'الرمز'))}</th><th>${escapeHtml(bi('Account', 'الحساب'))}</th><th>${escapeHtml(bi('Type', 'النوع'))}</th><th class="num">${escapeHtml(bi('Debit', 'مدين'))}</th><th class="num">${escapeHtml(bi('Credit', 'دائن'))}</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <td></td><td></td><td><strong>${escapeHtml(bi('Totals', 'الإجماليات'))}</strong></td>
            <td class="num"><strong>${formatMoney(data.totals.debit)}</strong></td>
            <td class="num"><strong>${formatMoney(data.totals.credit)}</strong></td>
          </tr></tfoot>
        </table>
      </div>
      <div class="totals-box">
        <div class="t-row grand"><span>${escapeHtml(bi('Total Debit', 'إجمالي المدين'))}</span><span class="num">${formatMoney(data.totals.debit)}</span></div>
        <div class="t-row grand"><span>${escapeHtml(bi('Total Credit', 'إجمالي الدائن'))}</span><span class="num">${formatMoney(data.totals.credit)}</span></div>
      </div>`;
  }

  // ---- 2) Income Statement ----
  async function incomeStatement() {
    const { data } = await api.get('/reports/income-statement');
    const line = (r) => `<tr><td class="mono">${escapeHtml(r.code)}</td><td>${escapeHtml(r.name)}</td><td class="num">${formatMoney(r.amount)}</td></tr>`;
    const revenueRows = data.revenue.map(line).join('') || `<tr><td colspan="3" class="muted">${escapeHtml(bi('No revenue entries.', 'لا توجد قيود إيرادات.'))}</td></tr>`;
    const expenseRows = data.expense.map(line).join('') || `<tr><td colspan="3" class="muted">${escapeHtml(bi('No expense entries.', 'لا توجد قيود مصروفات.'))}</td></tr>`;
    const net = Number(data.totals.net_income);

    body.innerHTML = `
      <div class="report-section">
        <h3>${escapeHtml(bi('Revenue', 'الإيرادات'))}</h3>
        <table class="data"><thead><tr><th>${escapeHtml(bi('Code', 'الرمز'))}</th><th>${escapeHtml(bi('Account', 'الحساب'))}</th><th class="num">${escapeHtml(bi('Amount', 'المبلغ'))}</th></tr></thead>
          <tbody>${revenueRows}</tbody>
          <tfoot><tr><td colspan="2">${escapeHtml(bi('Total Revenue', 'إجمالي الإيرادات'))}</td><td class="num">${formatMoney(data.totals.revenue)}</td></tr></tfoot></table>
      </div>
      <div class="report-section">
        <h3>${escapeHtml(bi('Expenses', 'المصروفات'))}</h3>
        <table class="data"><thead><tr><th>${escapeHtml(bi('Code', 'الرمز'))}</th><th>${escapeHtml(bi('Account', 'الحساب'))}</th><th class="num">${escapeHtml(bi('Amount', 'المبلغ'))}</th></tr></thead>
          <tbody>${expenseRows}</tbody>
          <tfoot><tr><td colspan="2">${escapeHtml(bi('Total Expenses', 'إجمالي المصروفات'))}</td><td class="num">${formatMoney(data.totals.expense)}</td></tr></tfoot></table>
      </div>
      <div class="net-income">
        <span>${escapeHtml(bi('Net Income', 'صافي الربح'))}</span>
        <span class="${net < 0 ? 'neg' : ''}">${net < 0 ? '(' + formatMoney(Math.abs(net)) + ')' : formatMoney(net)}</span>
      </div>`;
  }

  // ---- 3) General Ledger (account picker) ----
  async function generalLedger() {
    const accounts = await loadAccounts();
    body.innerHTML = `
      <div class="report-select">
        <label style="margin:0">${escapeHtml(bi('Account:', 'الحساب:'))}</label>
        <select id="gl-account">${optionsHtml(accounts, 'id', (a) => `${a.code} · ${a.name}`)}</select>
      </div>
      <div id="gl-out"><p class="muted">${escapeHtml(bi('Select an account to view its ledger.', 'اختر حسابًا لعرض دفتر أستاذه.'))}</p></div>`;
    const sel = body.querySelector('#gl-account');
    sel.addEventListener('change', () => drawLedger(sel.value));
    if (accounts.length) drawLedger(accounts[0].id); // show the first by default

    async function drawLedger(accountId) {
      if (!accountId) return;
      const out = body.querySelector('#gl-out');
      out.innerHTML = `<p class="muted">${escapeHtml(bi('Loading…', 'جارٍ التحميل…'))}</p>`;
      try {
        const { data } = await api.get(`/reports/general-ledger/${accountId}`);
        if (!data.lines.length) {
          out.innerHTML = `<p class="muted">${escapeHtml(bi('No entries for account', 'لا توجد قيود للحساب'))} ${escapeHtml(data.account.code)} · ${escapeHtml(data.account.name)}.</p>`;
          return;
        }
        const rows = data.lines.map((l) => `
          <tr>
            <td class="mono">${escapeHtml(l.entry_number)}</td>
            <td>${escapeHtml(String(l.entry_date).slice(0, 10))}</td>
            <td>${escapeHtml(l.description || '')}</td>
            <td class="num">${Number(l.debit) ? formatMoney(l.debit) : ''}</td>
            <td class="num">${Number(l.credit) ? formatMoney(l.credit) : ''}</td>
            <td class="num">${formatMoney(l.balance)}</td>
          </tr>`).join('');
        out.innerHTML = `
          <div class="detail-grid">
            <div class="kv"><div class="k">${escapeHtml(bi('Account', 'الحساب'))}</div><div class="v">${escapeHtml(data.account.code)} · ${escapeHtml(data.account.name)}</div></div>
            <div class="kv"><div class="k">${escapeHtml(bi('Type', 'النوع'))}</div><div class="v">${escapeHtml(accTypeLabel(data.account.account_type))}</div></div>
            <div class="kv"><div class="k">${escapeHtml(bi('Closing Balance', 'الرصيد الختامي'))}</div><div class="v">${formatMoney(data.closing_balance)}</div></div>
          </div>
          <div class="table-wrap">
            <table class="data">
              <thead><tr><th>${escapeHtml(bi('Entry No.', 'رقم القيد'))}</th><th>${escapeHtml(bi('Date', 'التاريخ'))}</th><th>${escapeHtml(bi('Description', 'البيان'))}</th><th class="num">${escapeHtml(bi('Debit', 'مدين'))}</th><th class="num">${escapeHtml(bi('Credit', 'دائن'))}</th><th class="num">${escapeHtml(bi('Balance', 'الرصيد'))}</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      } catch (err) {
        out.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      }
    }
  }

  // ---- 4) Customer Statement (customer picker) ----
  async function customerStatement() {
    const customers = await loadCustomers();
    body.innerHTML = `
      <div class="report-select">
        <label style="margin:0">${escapeHtml(bi('Customer:', 'العميل:'))}</label>
        <select id="cs-customer">${optionsHtml(customers, 'id', (c) => `${c.customer_code} · ${c.name}`)}</select>
      </div>
      <div id="cs-out"><p class="muted">${escapeHtml(bi('Select a customer to view their statement.', 'اختر عميلًا لعرض كشف حسابه.'))}</p></div>`;
    const sel = body.querySelector('#cs-customer');
    sel.addEventListener('change', () => drawStatement(sel.value));
    if (customers.length) drawStatement(customers[0].id);

    async function drawStatement(customerId) {
      if (!customerId) return;
      const out = body.querySelector('#cs-out');
      out.innerHTML = `<p class="muted">${escapeHtml(bi('Loading…', 'جارٍ التحميل…'))}</p>`;
      try {
        const { data } = await api.get(`/reports/customer-statement/${customerId}`);
        const s = data.summary;

        const invRows = data.invoices.map((i) => `
          <tr>
            <td class="mono">${escapeHtml(i.invoice_number)}</td>
            <td>${escapeHtml(String(i.invoice_date).slice(0, 10))}</td>
            <td><span class="status ${escapeHtml(i.status)}">${escapeHtml(invStatusLabel(i.status))}</span></td>
            <td class="num">${formatMoney(i.total_amount)}</td>
            <td class="num">${formatMoney(i.amount_paid)}</td>
            <td class="num">${formatMoney(Number(i.total_amount) - Number(i.amount_paid))}</td>
          </tr>`).join('') || `<tr><td colspan="6" class="muted">${escapeHtml(bi('No invoices.', 'لا توجد فواتير.'))}</td></tr>`;

        const payRows = data.payments.map((p) => `
          <tr>
            <td class="mono">${escapeHtml(p.payment_number)}</td>
            <td>${escapeHtml(String(p.payment_date).slice(0, 10))}</td>
            <td>${escapeHtml(payMethodLabel(p.method))}</td>
            <td class="num">${formatMoney(p.amount)}</td>
          </tr>`).join('') || `<tr><td colspan="4" class="muted">${escapeHtml(bi('No recorded payments.', 'لا توجد دفعات مسجّلة.'))}</td></tr>`;

        out.innerHTML = `
          <div class="stats">
            <div class="stat"><div class="label">${escapeHtml(bi('Total Invoiced', 'إجمالي الفواتير'))}</div><div class="value">${formatMoney(s.total_invoiced)}</div></div>
            <div class="stat"><div class="label">${escapeHtml(bi('Payments Recorded', 'الدفعات المسجّلة'))}</div><div class="value">${formatMoney(s.total_payments_recorded)}</div></div>
            <div class="stat"><div class="label">${escapeHtml(bi('Outstanding', 'المستحق'))}</div><div class="value">${formatMoney(s.outstanding)}</div></div>
          </div>
          <div class="report-section">
            <h3>${escapeHtml(bi('Invoices', 'الفواتير'))}</h3>
            <div class="table-wrap"><table class="data">
              <thead><tr><th>${escapeHtml(bi('Invoice No.', 'رقم الفاتورة'))}</th><th>${escapeHtml(bi('Date', 'التاريخ'))}</th><th>${escapeHtml(bi('Status', 'الحالة'))}</th><th class="num">${escapeHtml(bi('Total', 'الإجمالي'))}</th><th class="num">${escapeHtml(bi('Paid', 'المدفوع'))}</th><th class="num">${escapeHtml(bi('Balance', 'الرصيد'))}</th></tr></thead>
              <tbody>${invRows}</tbody></table></div>
          </div>
          <div class="report-section">
            <h3>${escapeHtml(bi('Payments', 'الدفعات'))}</h3>
            <div class="table-wrap"><table class="data">
              <thead><tr><th>${escapeHtml(bi('Payment No.', 'رقم الدفعة'))}</th><th>${escapeHtml(bi('Date', 'التاريخ'))}</th><th>${escapeHtml(bi('Method', 'الطريقة'))}</th><th class="num">${escapeHtml(bi('Amount', 'المبلغ'))}</th></tr></thead>
              <tbody>${payRows}</tbody></table></div>
          </div>`;
      } catch (err) {
        out.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
      }
    }
  }

  render().catch(setError);
}
