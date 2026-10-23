// -----------------------------------------------------------------------------
//  accounts.js — Chart of Accounts screen (Stitch design-system, bilingual EN·AR).
//  Read-only hierarchical view of the whole CoA: group headings (rolled-up
//  balances) and postable leaf accounts (indented under their parent). Balances
//  come straight from the backend (integer-cents roll-up); debit-positive, so
//  credit balances show as negative. This is a pure ledger view — no writes.
//  NOTE: account names are shown as stored in the DB (Arabic seed names).
// -----------------------------------------------------------------------------
const content = renderLayout('accounts', bi('Chart of Accounts', 'دليل الحسابات'));

const ACC_TYPE = {
  asset: bi('Asset', 'أصول'), liability: bi('Liability', 'خصوم'), equity: bi('Equity', 'حقوق ملكية'),
  revenue: bi('Revenue', 'إيرادات'), expense: bi('Expense', 'مصروفات'),
};
const accTypeLabel = (v) => ACC_TYPE[String(v).toLowerCase()] || v;
const CURRENCY = currencyCode();

if (content) {
  let all = [];

  content.innerHTML = `
    <div class="bg-surface-container-low p-6 rounded-xl shadow-sm">
      <h1 class="font-headline-lg text-headline-lg text-primary" style="margin:0">${escapeHtml(bi('Chart of Accounts', 'دليل الحسابات'))}</h1>
      <p class="text-on-surface-variant font-body-md" style="margin:.25rem 0 0">
        ${escapeHtml(bi('The account tree with rolled-up balances. Debit-positive: credit balances show as negative.', `شجرة الحسابات مع الأرصدة التجميعية. الأرصدة موجبة للجانب المدين، والدائنة تظهر بالسالب (${CURRENCY}).`))}
      </p>
    </div>
    <div class="flex flex-wrap items-center gap-3 bg-surface-container-lowest p-4 rounded-xl shadow-sm">
      <div class="relative">
        <input id="search" type="text" placeholder="${escapeHtml(bi('Search by code or name…', 'ابحث بالرمز أو اسم الحساب…'))}"
          class="py-2.5 rounded-xl border border-outline-variant bg-surface text-on-surface font-body-md w-72 focus:outline-none focus:border-primary" style="padding-inline-start:2.75rem;padding-inline-end:1rem" />
        <span class="absolute top-1/2 -translate-y-1/2 text-outline" style="inset-inline-start:.75rem"><span class="material-symbols-outlined text-[20px]">search</span></span>
      </div>
      <span class="muted font-body-sm" id="coa-count"></span>
    </div>
    <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
      <div class="p-6" id="coa-body"><p class="muted">${escapeHtml(bi('Loading…', 'جارٍ التحميل…'))}</p></div>
    </div>`;

  const body = content.querySelector('#coa-body');
  const searchInput = content.querySelector('#search');
  const countEl = content.querySelector('#coa-count');

  // Format a signed balance: parentheses + red when negative (credit side).
  function balanceCell(balance) {
    const n = Number(balance);
    if (n < 0) return `<span class="num mono text-error">(${formatMoney(Math.abs(n))})</span>`;
    return `<span class="num mono">${formatMoney(n)}</span>`;
  }

  function render() {
    const q = searchInput.value.trim().toLowerCase();
    const rows = q
      ? all.filter((a) => String(a.code).toLowerCase().includes(q) || String(a.name).toLowerCase().includes(q))
      : all;

    if (!rows.length) {
      body.innerHTML = `<p class="muted">${escapeHtml(bi('No accounts match the search.', 'لا توجد حسابات مطابقة للبحث.'))}</p>`;
      countEl.textContent = '';
      return;
    }

    const trs = rows.map((a) => {
      const indent = a.level * 1.5; // rem, from the inline-start edge
      const groupCls = a.is_group ? 'background:var(--surface-container-low);font-weight:700;' : '';
      const nameCell = `<td style="padding-inline-start:${indent}rem;${groupCls}">
          ${a.is_group ? `<span class="material-symbols-outlined text-[18px] align-middle text-primary">folder</span> ` : ''}
          ${escapeHtml(a.name)}</td>`;
      return `<tr>
        <td class="mono" style="${groupCls}">${escapeHtml(a.code)}</td>
        ${nameCell}
        <td style="${groupCls}">${escapeHtml(accTypeLabel(a.account_type))}</td>
        <td class="num" style="${groupCls}">${balanceCell(a.balance)}</td>
      </tr>`;
    }).join('');

    body.innerHTML = `
      <div class="table-wrap">
        <table class="data">
          <thead><tr>
            <th>${escapeHtml(bi('Code', 'الرمز'))}</th>
            <th>${escapeHtml(bi('Account', 'الحساب'))}</th>
            <th>${escapeHtml(bi('Type', 'النوع'))}</th>
            <th class="num">${escapeHtml(`${bi('Balance', 'الرصيد')} (${CURRENCY})`)}</th>
          </tr></thead>
          <tbody>${trs}</tbody>
        </table>
      </div>`;
    countEl.textContent = bi(`${rows.length} account(s)`, `${rows.length} حساب`);
  }

  async function load() {
    try {
      const { data } = await api.get('/reports/chart-of-accounts');
      all = data.accounts;
      render();
    } catch (err) {
      body.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  searchInput.addEventListener('input', render);
  load();
}
