// -----------------------------------------------------------------------------
//  payments.js — Customer payments screen (Stitch design-system, bilingual EN/AR).
//  * Lists recorded payments.
//  * "Record Payment" (admin/accountant) lets you settle a specific invoice
//    (its outstanding balance is shown and capped) OR take an on-account payment
//    against a customer with no invoice. Recording a payment makes the backend,
//    in ONE transaction, post Dr Cash/Bank / Cr AR and update the invoice's
//    amount_paid + status (partial / paid).
//  Every user-visible string is authored as bi(en, ar) and rendered in the
//  active language only (see ui.js bi()/getLang()).
// -----------------------------------------------------------------------------
const content = renderLayout('payments', bi('Payments', 'الدفعات'));

// Payment-method labels in BOTH languages (badge keeps neutral styling).
const payMethodLabel = (v) => ({
  cash: bi('Cash', 'نقدًا'),
  bank: bi('Bank', 'بنك'),
  cheque: bi('Cheque', 'شيك'),
  card: bi('Card', 'بطاقة'),
}[v] || v);

if (content) {
  const canWrite = hasAnyRole('admin', 'accountant');
  let page = 1;
  const pageSize = 15;

  const columns = [
    { key: 'payment_number', label: bi('Payment No.', 'رقم الدفعة'), render: (v) => `<span class="mono">${escapeHtml(v)}</span>` },
    { key: 'customer_name', label: bi('Customer', 'العميل') },
    { key: 'payment_date', label: bi('Date', 'التاريخ'), render: (v) => escapeHtml(String(v).slice(0, 10)) },
    { key: 'amount', label: bi('Amount', 'المبلغ'), numeric: true, render: (v) => formatMoney(v) },
    { key: 'method', label: bi('Method', 'الطريقة'), render: (v) => `<span class="badge">${escapeHtml(payMethodLabel(v))}</span>` },
  ];

  content.innerHTML = `
    <div class="bg-surface-container-low p-6 rounded-xl shadow-sm">
      <h1 class="font-headline-lg text-headline-lg text-primary" style="margin:0">${escapeHtml(bi('Received Payments', 'الدفعات المُستلمة'))}</h1>
      <p class="text-on-surface-variant font-body-md" style="margin:.25rem 0 0">${escapeHtml(bi('Amounts received from customers and invoice settlements.', 'المبالغ المستلمة من العملاء وتسويات الفواتير.'))}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3 bg-surface-container-lowest p-4 rounded-xl shadow-sm">
      <div class="flex-1"></div>
      ${canWrite ? `<button id="add-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg transition-all shadow-sm">
        <span class="material-symbols-outlined text-[18px]">payments</span>${escapeHtml(bi('Record Payment', 'تسجيل دفعة'))}</button>` : ''}
    </div>
    <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden">
      <div class="p-6" id="table"></div>
      <div class="px-6 pb-6" id="pager"></div>
    </div>`;

  const tableEl = content.querySelector('#table');
  const pagerEl = content.querySelector('#pager');

  async function load() {
    tableEl.innerHTML = `<p class="muted">${escapeHtml(bi('Loading…', 'جارٍ التحميل…'))}</p>`;
    try {
      const res = await api.get(`/payments?${new URLSearchParams({ page, pageSize })}`);
      renderTable(tableEl, { columns, rows: res.data });
      renderPagination(pagerEl, res.meta, (p) => { page = p; load(); });
    } catch (err) {
      tableEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  async function openCreate() {
    let invoices, customers;
    try {
      [invoices, customers] = await Promise.all([loadPayableInvoices(), loadCustomers()]);
    } catch (err) { alert(err.message); return; }

    const today = new Date().toISOString().slice(0, 10);
    // Balance = total - paid, used for the "pay in full" helper and cap.
    const balanceOf = (inv) => Math.round((Number(inv.total_amount) - Number(inv.amount_paid)) * 100) / 100;

    const invOptions = `<option value="">${escapeHtml(bi('— On account (no specific invoice) —', '— على الحساب (بدون فاتورة محددة) —'))}</option>` +
      optionsHtml(invoices, 'id', (i) => `${i.invoice_number} · ${i.customer_name} · ${escapeHtml(bi('Balance', 'الرصيد'))} ${formatMoney(balanceOf(i))}`);
    const custOptions = `<option value="">${escapeHtml(bi('— Select customer —', '— اختر العميل —'))}</option>` +
      optionsHtml(customers, 'id', (c) => `${c.customer_code} · ${c.name}`);

    const defaultHint = bi('Pick an invoice to settle it, or leave it on account and choose a customer.', 'اختر فاتورة لتسويتها، أو اتركها على الحساب واختر عميلًا.');

    openCustomModal(bi('Record Payment', 'تسجيل دفعة'), `
      <div id="modal-error" class="alert alert-error hidden"></div>
      <div class="detail-grid">
        <div class="form-group" style="grid-column:1 / -1"><label>${escapeHtml(bi('Apply to Invoice', 'تطبيق على فاتورة'))}</label>
          <select id="pay-invoice">${invOptions}</select></div>

        <div class="form-group" id="pay-customer-wrap" style="grid-column:1 / -1"><label>${escapeHtml(bi('Customer *', 'العميل *'))}</label>
          <select id="pay-customer">${custOptions}</select></div>

        <div class="form-group"><label>${escapeHtml(bi('Amount *', 'المبلغ *'))}</label>
          <input type="number" id="pay-amount" step="0.01" min="0.01" placeholder="0.00" /></div>
        <div class="form-group"><label>${escapeHtml(bi('Payment Date *', 'تاريخ الدفعة *'))}</label>
          <input type="date" id="pay-date" value="${today}" /></div>
        <div class="form-group"><label>${escapeHtml(bi('Method', 'طريقة الدفع'))}</label>
          <select id="pay-method">
            <option value="cash">${escapeHtml(bi('Cash', 'نقدًا'))}</option><option value="bank">${escapeHtml(bi('Bank', 'بنك'))}</option>
            <option value="cheque">${escapeHtml(bi('Cheque', 'شيك'))}</option><option value="card">${escapeHtml(bi('Card', 'بطاقة'))}</option>
          </select></div>
        <div class="form-group"><label>${escapeHtml(bi('Reference', 'المرجع'))}</label>
          <input type="text" id="pay-reference" placeholder="${escapeHtml(bi('Receipt / cheque no. (optional)', 'رقم الوصل / الشيك (اختياري)'))}" /></div>
      </div>
      <p class="muted" id="pay-hint">${escapeHtml(defaultHint)}</p>`,
      submitPayment
    );

    const invSel = document.getElementById('pay-invoice');
    const custWrap = document.getElementById('pay-customer-wrap');
    const custSel = document.getElementById('pay-customer');
    const amountInp = document.getElementById('pay-amount');
    const hint = document.getElementById('pay-hint');

    // Switching between invoice-linked and on-account modes.
    invSel.addEventListener('change', () => {
      const id = invSel.value;
      if (id) {
        const inv = invoices.find((i) => String(i.id) === String(id));
        const bal = balanceOf(inv);
        custWrap.classList.add('hidden');       // customer is implied by the invoice
        custSel.value = '';
        amountInp.value = bal;                   // prefill full balance
        hint.textContent = bi(`Outstanding balance on ${inv.invoice_number}: ${formatMoney(bal)}. The payment cannot exceed this amount.`, `الرصيد المتبقي على ${inv.invoice_number}: ${formatMoney(bal)}. لا يمكن أن تتجاوز الدفعة هذا المبلغ.`);
      } else {
        custWrap.classList.remove('hidden');
        amountInp.value = '';
        hint.textContent = defaultHint;
      }
    });

    async function submitPayment() {
      const errBox = document.getElementById('modal-error');
      errBox.classList.add('hidden');
      const fail = (msg) => { errBox.textContent = msg; errBox.classList.remove('hidden'); return false; };

      const invoiceId = invSel.value;
      const customerId = custSel.value;
      const amountRaw = amountInp.value;
      const paymentDate = document.getElementById('pay-date').value;
      const method = document.getElementById('pay-method').value;
      const reference = document.getElementById('pay-reference').value.trim();

      if (!invoiceId && !customerId) return fail(bi('Choose an invoice, or a customer for an on-account payment.', 'اختر فاتورة، أو عميلًا لدفعة على الحساب.'));
      if (!paymentDate) return fail(bi('Payment date is required.', 'تاريخ الدفعة مطلوب.'));
      const amount = Number(amountRaw);
      if (!Number.isFinite(amount) || amount <= 0) return fail(bi('Enter a payment amount greater than zero.', 'أدخل مبلغ دفع أكبر من صفر.'));
      if (Math.round(amount * 100) / 100 !== amount) return fail(bi('The amount accepts at most two decimals.', 'المبلغ يقبل رقمين عشريين كحد أقصى.'));

      // Cap against the invoice balance up-front for a friendly message.
      if (invoiceId) {
        const inv = invoices.find((i) => String(i.id) === String(invoiceId));
        if (amount > balanceOf(inv) + 1e-9) return fail(bi(`The amount exceeds the outstanding balance (${formatMoney(balanceOf(inv))}).`, `المبلغ يتجاوز الرصيد المتبقي (${formatMoney(balanceOf(inv))}).`));
      }

      const payload = { amount: amount.toFixed(2), paymentDate, method };
      if (invoiceId) payload.invoiceId = Number(invoiceId);
      else payload.customerId = Number(customerId);
      if (reference) payload.reference = reference;

      try {
        await api.post('/payments', payload);
        closeModal();
        page = 1;
        await load();
      } catch (err) {
        return fail(err.message || bi('Could not record the payment.', 'تعذّر تسجيل الدفعة.'));
      }
    }
  }

  content.querySelector('#add-btn')?.addEventListener('click', openCreate);
  load();
}
