// -----------------------------------------------------------------------------
//  supplier-payments.js — Accounts-Payable settlement screen (Stitch ds, tri-lang).
//  * Lists recorded supplier payments (money OUT).
//  * "Pay Supplier" (admin/accountant) settles a supplier: choose an open purchase
//    to apply the payment to (its outstanding balance is shown and capped) OR make
//    an on-account payment. The backend, in ONE transaction, posts Dr Supplier AP /
//    Cr Cash(Bank) and, when applied, bumps the purchase's amount_paid.
//  Strings use bi(en, ar, fa); the active language is rendered (see ui.js).
// -----------------------------------------------------------------------------
const content = renderLayout('supplier-payments', bi('Supplier Payments', 'الدفعات للموردين', 'پرداخت‌های تأمین‌کنندگان'));

const payMethodLabel = (v) => ({
  cash: bi('Cash', 'نقدًا', 'نقد'),
  bank: bi('Bank', 'بنك', 'بانك'),
  cheque: bi('Cheque', 'شيك', 'چك'),
  card: bi('Card', 'بطاقة', 'كارت'),
}[v] || v);

if (content) {
  const canWrite = hasAnyRole('admin', 'accountant');
  let page = 1;
  const pageSize = 15;

  const columns = [
    { key: 'payment_number', label: bi('Payment No.', 'رقم الدفعة', 'شماره پرداخت'), render: (v) => `<span class="mono">${escapeHtml(v)}</span>` },
    { key: 'supplier_name', label: bi('Supplier', 'المورد', 'تأمین‌کننده') },
    { key: 'purchase_number', label: bi('Applied to', 'مطبَّقة على', 'اعمال‌شده روی'), render: (v) => v ? `<span class="mono">${escapeHtml(v)}</span>` : `<span class="muted">${escapeHtml(bi('On account', 'على الحساب', 'على الحساب'))}</span>` },
    { key: 'payment_date', label: bi('Date', 'التاريخ', 'تاریخ'), render: (v) => escapeHtml(String(v).slice(0, 10)) },
    { key: 'amount', label: bi('Amount', 'المبلغ', 'مبلغ'), numeric: true, render: (v) => formatMoney(v) },
    { key: 'method', label: bi('Method', 'الطريقة', 'روش'), render: (v) => `<span class="badge">${escapeHtml(payMethodLabel(v))}</span>` },
  ];

  content.innerHTML = `
    <div class="bg-surface-container-low p-6 rounded-xl shadow-sm">
      <h1 class="font-headline-lg text-headline-lg text-primary" style="margin:0">${escapeHtml(bi('Payments to Suppliers', 'الدفعات للموردين', 'پرداخت‌ها به تأمین‌کنندگان'))}</h1>
      <p class="text-on-surface-variant font-body-md" style="margin:.25rem 0 0">${escapeHtml(bi('Settle what you owe suppliers — cash/bank out, Accounts Payable down.', 'سداد ما للموردين — يخرج نقد/بنك وتنخفض الذمم الدائنة.', 'تسویه بدهی به تأمین‌کنندگان — خروج نقد/بانك و كاهش حساب‌های پرداختنی.'))}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3 bg-surface-container-lowest p-4 rounded-xl shadow-sm">
      <div class="flex-1"></div>
      ${canWrite ? `<button id="add-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg transition-all shadow-sm">
        <span class="material-symbols-outlined text-[18px]">payments</span>${escapeHtml(bi('Pay Supplier', 'دفع للمورد', 'پرداخت به تأمین‌کننده'))}</button>` : ''}
    </div>
    <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
      <div class="p-6" id="table"></div>
      <div class="px-6 pb-6" id="pager"></div>
    </div>`;

  const tableEl = content.querySelector('#table');
  const pagerEl = content.querySelector('#pager');

  async function load() {
    tableEl.innerHTML = `<p class="muted">${escapeHtml(bi('Loading…', 'جارٍ التحميل…', 'در حال بارگذاری…'))}</p>`;
    try {
      const res = await api.get(`/supplier-payments?${new URLSearchParams({ page, pageSize })}`);
      renderTable(tableEl, { columns, rows: res.data });
      renderPagination(pagerEl, res.meta, (p) => { page = p; load(); });
    } catch (err) {
      tableEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  async function openCreate() {
    let suppliers, purchases;
    try {
      [suppliers, purchases] = await Promise.all([loadSuppliers(), api.get('/purchases?pageSize=100').then((r) => r.data || [])]);
    } catch (err) { alert(err.message); return; }

    const today = new Date().toISOString().slice(0, 10);
    // Outstanding = total - already paid (incl. any pay-at-purchase + earlier settlements).
    const balanceOf = (p) => Math.round((Number(p.total_amount) - Number(p.amount_paid)) * 100) / 100;

    const supOptions = `<option value="">${escapeHtml(bi('— Select supplier —', '— اختر المورد —', '— انتخاب تأمین‌کننده —'))}</option>` +
      optionsHtml(suppliers, 'id', (s) => `${s.supplier_code} · ${s.name}`);

    const defaultHint = bi('Choose a supplier, then optionally a purchase to settle (or pay on account).', 'اختر المورد، ثم فاتورة مشتريات لتسويتها (أو ادفع على الحساب).', 'یک تأمین‌کننده و سپس در صورت نیاز یک خرید را برای تسویه انتخاب کنید (یا روی حساب پرداخت کنید).');

    openCustomModal(bi('Pay Supplier', 'دفع للمورد', 'پرداخت به تأمین‌کننده'), `
      <div id="modal-error" class="alert alert-error hidden"></div>
      <div class="detail-grid">
        <div class="form-group" style="grid-column:1 / -1"><label>${escapeHtml(bi('Supplier *', 'المورد *', 'تأمین‌کننده *'))}</label>
          <select id="sp-supplier">${supOptions}</select></div>

        <div class="form-group" style="grid-column:1 / -1"><label>${escapeHtml(bi('Apply to Purchase', 'تطبيق على مشتريات', 'اعمال روی خرید'))}</label>
          <select id="sp-purchase"><option value="">${escapeHtml(bi('— On account (no specific purchase) —', '— على الحساب (بدون مشتريات محددة) —', '— روی حساب (بدون خرید مشخص) —'))}</option></select></div>

        <div class="form-group"><label>${escapeHtml(bi('Amount *', 'المبلغ *', 'مبلغ *'))}</label>
          <input type="number" id="sp-amount" step="0.01" min="0.01" placeholder="0.00" /></div>
        <div class="form-group"><label>${escapeHtml(bi('Payment Date *', 'تاريخ الدفعة *', 'تاریخ پرداخت *'))}</label>
          <input type="date" id="sp-date" value="${today}" /></div>
        <div class="form-group"><label>${escapeHtml(bi('Method', 'طريقة الدفع', 'روش پرداخت'))}</label>
          <select id="sp-method">
            <option value="cash">${escapeHtml(bi('Cash (Cash on Hand)', 'نقدًا (الصندوق)', 'نقد (صندوق)'))}</option>
            <option value="card">${escapeHtml(bi('Card (Bank)', 'بطاقة (البنك)', 'كارت (بانك)'))}</option>
          </select></div>
        <div class="form-group"><label>${escapeHtml(bi('Reference', 'المرجع', 'مرجع'))}</label>
          <input type="text" id="sp-reference" placeholder="${escapeHtml(bi('Receipt no. (optional)', 'رقم الوصل (اختياري)', 'شماره رسید (اختیاری)'))}" /></div>
      </div>
      <p class="muted" id="sp-hint">${escapeHtml(defaultHint)}</p>`,
      submitPayment
    );

    const supSel = document.getElementById('sp-supplier');
    const purSel = document.getElementById('sp-purchase');
    const amountInp = document.getElementById('sp-amount');
    const hint = document.getElementById('sp-hint');

    // Populate the purchase picker with only that supplier's still-open purchases.
    function refreshPurchases() {
      const sid = supSel.value;
      const open = sid ? purchases.filter((p) => String(p.supplier_id) === String(sid) && balanceOf(p) > 0) : [];
      const noneOpt = `<option value="">${escapeHtml(bi('— On account (no specific purchase) —', '— على الحساب (بدون مشتريات محددة) —', '— روی حساب (بدون خرید مشخص) —'))}</option>`;
      purSel.innerHTML = noneOpt + optionsHtml(open, 'id', (p) => `${p.purchase_number} · ${escapeHtml(bi('Balance', 'الرصيد', 'مانده'))} ${formatMoney(balanceOf(p))}`);
      amountInp.value = '';
      hint.textContent = defaultHint;
    }

    supSel.addEventListener('change', refreshPurchases);

    purSel.addEventListener('change', () => {
      const id = purSel.value;
      if (id) {
        const p = purchases.find((x) => String(x.id) === String(id));
        const bal = balanceOf(p);
        amountInp.value = bal; // prefill full outstanding
        hint.textContent = bi(`Outstanding on ${p.purchase_number}: ${formatMoney(bal)}. The payment cannot exceed this amount.`, `المتبقي على ${p.purchase_number}: ${formatMoney(bal)}. لا يمكن أن تتجاوز الدفعة هذا المبلغ.`, `مانده ${p.purchase_number}: ${formatMoney(bal)}. مبلغ پرداخت نمی‌تواند بیشتر از این باشد.`);
      } else {
        amountInp.value = '';
        hint.textContent = defaultHint;
      }
    });

    async function submitPayment() {
      const errBox = document.getElementById('modal-error');
      errBox.classList.add('hidden');
      const fail = (msg) => { errBox.textContent = msg; errBox.classList.remove('hidden'); return false; };

      const supplierId = supSel.value;
      const purchaseId = purSel.value;
      const paymentDate = document.getElementById('sp-date').value;
      const method = document.getElementById('sp-method').value;
      const reference = document.getElementById('sp-reference').value.trim();

      if (!supplierId) return fail(bi('Please select a supplier.', 'يرجى اختيار المورد.', 'لطفاً یک تأمین‌کننده انتخاب کنید.'));
      if (!paymentDate) return fail(bi('Payment date is required.', 'تاريخ الدفعة مطلوب.', 'تاریخ پرداخت الزامی است.'));
      const amount = Number(amountInp.value);
      if (!Number.isFinite(amount) || amount <= 0) return fail(bi('Enter a payment amount greater than zero.', 'أدخل مبلغ دفع أكبر من صفر.', 'مبلغ پرداخت باید بیشتر از صفر باشد.'));
      if (Math.round(amount * 100) / 100 !== amount) return fail(bi('The amount accepts at most two decimals.', 'المبلغ يقبل رقمين عشريين كحد أقصى.', 'حداکثر دو رقم اعشار مجاز است.'));

      if (purchaseId) {
        const p = purchases.find((x) => String(x.id) === String(purchaseId));
        if (amount > balanceOf(p) + 1e-9) return fail(bi(`The amount exceeds the outstanding balance (${formatMoney(balanceOf(p))}).`, `المبلغ يتجاوز الرصيد المتبقي (${formatMoney(balanceOf(p))}).`, `مبلغ بیشتر از مانده (${formatMoney(balanceOf(p))}) است.`));
      }

      const payload = { supplierId: Number(supplierId), amount: amount.toFixed(2), paymentDate, method };
      if (purchaseId) payload.purchaseId = Number(purchaseId);
      if (reference) payload.reference = reference;

      try {
        await api.post('/supplier-payments', payload);
        closeModal();
        page = 1;
        await load();
        flashOnce(bi('Payment recorded — Accounts Payable reduced.', 'تم تسجيل الدفعة — انخفضت الذمم الدائنة.', 'پرداخت ثبت شد — حساب‌های پرداختنی كاهش یافت.'));
      } catch (err) {
        return fail(err.message || bi('Could not record the payment.', 'تعذّر تسجيل الدفعة.', 'ثبت پرداخت ممکن نشد.'));
      }
    }
  }

  function flashOnce(message) {
    const el = document.createElement('div');
    el.className = 'alert alert-success';
    el.style.cssText = 'position:fixed;bottom:1rem;inset-inline-end:1rem;max-width:22rem;z-index:60;';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }

  content.querySelector('#add-btn')?.addEventListener('click', openCreate);
  load();
}
