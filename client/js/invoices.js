// -----------------------------------------------------------------------------
//  invoices.js — Sales invoices screen (Stitch design-system, bilingual EN/AR).
//  * Lists invoices (number, customer, date, total, paid, status).
//  * "View" opens the full invoice with its line items (read-only).
//  * "New Invoice" (admin/accountant) has DYNAMIC line items — pick a product
//    (price then comes from the backend catalog) or type a manual line. Totals
//    are previewed live but the SERVER recomputes the authoritative amounts.
//  * Choosing status "Issued" makes the backend auto-post the Dr AR / Cr Revenue
//    (+ Cr Tax) entry; "Draft" records the invoice without touching the ledger.
//  Every user-visible string is authored as bi(en, ar) and rendered in the
//  active language only (see ui.js bi()/getLang()).
// -----------------------------------------------------------------------------
const content = renderLayout('invoices', bi('Invoices', 'الفواتير'));

// Status labels in BOTH languages (the CSS class keeps the raw API value).
const invStatusLabel = (v) => ({
  draft: bi('Draft', 'مسودة'),
  issued: bi('Issued', 'مصدّرة'),
  partial: bi('Partially Paid', 'مدفوعة جزئيًا'),
  paid: bi('Paid', 'مدفوعة'),
}[v] || v);

if (content) {
  const canWrite = hasAnyRole('admin', 'accountant');
  let page = 1;
  const pageSize = 15;

  const columns = [
    { key: 'invoice_number', label: bi('Invoice No.', 'رقم الفاتورة'), render: (v) => `<span class="mono">${escapeHtml(v)}</span>` },
    { key: 'customer_name', label: bi('Customer', 'العميل') },
    { key: 'invoice_date', label: bi('Date', 'التاريخ'), render: (v) => escapeHtml(String(v).slice(0, 10)) },
    { key: 'total_amount', label: bi('Total', 'الإجمالي'), numeric: true, render: (v) => formatMoney(v) },
    { key: 'amount_paid', label: bi('Paid', 'المدفوع'), numeric: true, render: (v) => formatMoney(v) },
    { key: 'status', label: bi('Status', 'الحالة'), render: (v) => `<span class="status ${escapeHtml(v)}">${escapeHtml(invStatusLabel(v))}</span>` },
  ];

  content.innerHTML = `
    <div class="bg-surface-container-low p-6 rounded-xl shadow-sm">
      <h1 class="font-headline-lg text-headline-lg text-primary" style="margin:0">${escapeHtml(bi('Sales Invoices', 'الفواتير والمبيعات'))}</h1>
      <p class="text-on-surface-variant font-body-md" style="margin:.25rem 0 0">${escapeHtml(bi('Customer sales invoices, newest first.', 'فواتير المبيعات للعملاء، الأحدث أولًا.'))}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3 bg-surface-container-lowest p-4 rounded-xl shadow-sm">
      <div class="flex-1"></div>
      ${canWrite ? `<button id="add-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg transition-all shadow-sm">
        <span class="material-symbols-outlined text-[18px]">add</span>${escapeHtml(bi('New Invoice', 'فاتورة جديدة'))}</button>` : ''}
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
      const res = await api.get(`/invoices?${new URLSearchParams({ page, pageSize })}`);
      renderTable(tableEl, {
        columns,
        rows: res.data,
        actions: [{ label: bi('View', 'عرض'), className: 'btn-secondary', onClick: openView }],
      });
      renderPagination(pagerEl, res.meta, (p) => { page = p; load(); });
    } catch (err) {
      tableEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ---- Read-only invoice detail ----
  async function openView(row) {
    let inv;
    try { inv = (await api.get(`/invoices/${row.id}`)).data.invoice; }
    catch (err) { alert(err.message); return; }

    const items = inv.items.map((it) => `
      <tr>
        <td>${escapeHtml(it.description || '')}</td>
        <td class="num">${escapeHtml(String(Number(it.quantity)))}</td>
        <td class="num">${formatMoney(it.unit_price)}</td>
        <td class="num">${formatMoney(it.line_total)}</td>
      </tr>`).join('');

    openCustomModal(`${bi('Invoice', 'فاتورة')} ${inv.invoice_number}`, `
      <div class="detail-grid">
        <div class="kv"><div class="k">${escapeHtml(bi('Customer', 'العميل'))}</div><div class="v">${escapeHtml(inv.customer_name)}</div></div>
        <div class="kv"><div class="k">${escapeHtml(bi('Date', 'التاريخ'))}</div><div class="v">${escapeHtml(String(inv.invoice_date).slice(0, 10))}</div></div>
        <div class="kv"><div class="k">${escapeHtml(bi('Due Date', 'تاريخ الاستحقاق'))}</div><div class="v">${escapeHtml(inv.due_date ? String(inv.due_date).slice(0, 10) : '—')}</div></div>
        <div class="kv"><div class="k">${escapeHtml(bi('Status', 'الحالة'))}</div><div class="v"><span class="status ${escapeHtml(inv.status)}">${escapeHtml(invStatusLabel(inv.status))}</span></div></div>
      </div>
      <div class="table-wrap">
        <table class="lines-table">
          <thead><tr><th>${escapeHtml(bi('Description', 'البيان'))}</th><th class="num">${escapeHtml(bi('Qty', 'الكمية'))}</th><th class="num">${escapeHtml(bi('Unit Price', 'سعر الوحدة'))}</th><th class="num">${escapeHtml(bi('Line Total', 'إجمالي السطر'))}</th></tr></thead>
          <tbody>${items}</tbody>
        </table>
      </div>
      <div class="totals-box">
        <div class="t-row"><span>${escapeHtml(bi('Subtotal', 'المجموع الفرعي'))}</span><span class="num">${formatMoney(inv.subtotal)}</span></div>
        <div class="t-row"><span>${escapeHtml(bi('Tax', 'الضريبة'))} (${escapeHtml(String(inv.tax_rate))}%)</span><span class="num">${formatMoney(inv.tax_amount)}</span></div>
        <div class="t-row grand"><span>${escapeHtml(bi('Total', 'الإجمالي'))}</span><span class="num">${formatMoney(inv.total_amount)}</span></div>
        <div class="t-row"><span>${escapeHtml(bi('Paid', 'المدفوع'))}</span><span class="num">${formatMoney(inv.amount_paid)}</span></div>
        <div class="t-row"><span>${escapeHtml(bi('Balance Due', 'الرصيد المتبقي'))}</span><span class="num">${formatMoney(Number(inv.total_amount) - Number(inv.amount_paid))}</span></div>
      </div>
      ${inv.notes ? `<p class="muted mt-1">${escapeHtml(inv.notes)}</p>` : ''}`);
  }

  // ---- Create invoice with dynamic line items ----
  async function openCreate() {
    let customers, products;
    try {
      [customers, products] = await Promise.all([loadCustomers(), loadProducts()]);
    } catch (err) { alert(err.message); return; }

    const today = new Date().toISOString().slice(0, 10);
    const custOptions = `<option value="">${escapeHtml(bi('— Select customer —', '— اختر العميل —'))}</option>` +
      optionsHtml(customers, 'id', (c) => `${c.customer_code} · ${c.name}`);
    const prodOptions = `<option value="">${escapeHtml(bi('— Manual line —', '— بند يدوي —'))}</option>` +
      optionsHtml(products, 'id', (p) => `${p.sku} · ${p.name} (${formatMoney(p.selling_price)})`);

    openCustomModal(bi('New Invoice', 'فاتورة جديدة'), `
      <div id="modal-error" class="alert alert-error hidden"></div>
      <div class="detail-grid">
        <div class="form-group" style="grid-column:1 / -1"><label>${escapeHtml(bi('Customer *', 'العميل *'))}</label>
          <select id="inv-customer">${custOptions}</select></div>
        <div class="form-group"><label>${escapeHtml(bi('Invoice Date *', 'تاريخ الفاتورة *'))}</label><input type="date" id="inv-date" value="${today}" /></div>
        <div class="form-group"><label>${escapeHtml(bi('Due Date', 'تاريخ الاستحقاق'))}</label><input type="date" id="inv-due" /></div>
        <div class="form-group"><label>${escapeHtml(bi('Tax Rate (%)', 'نسبة الضريبة (%)'))}</label><input type="number" id="inv-tax" step="0.01" min="0" max="100" placeholder="0" /></div>
        <div class="form-group"><label>${escapeHtml(bi('Status', 'الحالة'))}</label>
          <select id="inv-status"><option value="draft">${escapeHtml(bi('Draft', 'مسودة'))}</option><option value="issued">${escapeHtml(bi('Issued (posts to ledger)', 'مصدّرة (تُسجّل في دفتر الأستاذ)'))}</option></select></div>
        <div class="form-group" style="grid-column:1 / -1"><label>${escapeHtml(bi('Notes', 'ملاحظات'))}</label><input type="text" id="inv-notes" placeholder="${escapeHtml(bi('Optional', 'اختياري'))}" /></div>
      </div>

      <label>${escapeHtml(bi('Line Items *', 'بنود الفاتورة *'))}</label>
      <table class="lines-table">
        <thead><tr><th style="min-width:190px">${escapeHtml(bi('Product', 'المنتج'))}</th><th style="min-width:150px">${escapeHtml(bi('Description', 'البيان'))}</th>
          <th class="num" style="width:80px">${escapeHtml(bi('Qty', 'الكمية'))}</th><th class="num" style="width:110px">${escapeHtml(bi('Unit Price', 'سعر الوحدة'))}</th>
          <th class="num" style="width:100px">${escapeHtml(bi('Total', 'الإجمالي'))}</th><th style="width:30px"></th></tr></thead>
        <tbody id="inv-lines"></tbody>
      </table>
      <button type="button" class="btn btn-secondary btn-sm" id="inv-add">+ ${escapeHtml(bi('Add Line', 'إضافة سطر'))}</button>

      <div class="totals-box">
        <div class="t-row"><span>${escapeHtml(bi('Subtotal', 'المجموع الفرعي'))}</span><span class="num" id="inv-sub">0.00</span></div>
        <div class="t-row"><span>${escapeHtml(bi('Tax', 'الضريبة'))}</span><span class="num" id="inv-taxamt">0.00</span></div>
        <div class="t-row grand"><span>${escapeHtml(bi('Total', 'الإجمالي'))}</span><span class="num" id="inv-total">0.00</span></div>
      </div>`,
      submitInvoice
    );

    const linesBody = document.getElementById('inv-lines');
    const priceById = Object.fromEntries(products.map((p) => [String(p.id), Number(p.selling_price)]));
    const nameById = Object.fromEntries(products.map((p) => [String(p.id), p.name]));

    function addLine() {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><select class="li-prod">${prodOptions}</select></td>
        <td><input type="text" class="li-desc" placeholder="${escapeHtml(bi('Line description', 'وصف البند'))}" /></td>
        <td class="num"><input type="number" class="li-qty" step="0.01" min="0" value="1" /></td>
        <td class="num"><input type="number" class="li-price" step="0.01" min="0" placeholder="0.00" /></td>
        <td class="num li-total">0.00</td>
        <td><button type="button" class="row-del" title="${escapeHtml(bi('Remove line', 'حذف السطر'))}">&times;</button></td>`;
      const prodSel = tr.querySelector('.li-prod');
      const descInp = tr.querySelector('.li-desc');
      const priceInp = tr.querySelector('.li-price');

      // When a product is chosen, lock description/price to the catalog value.
      prodSel.addEventListener('change', () => {
        const pid = prodSel.value;
        if (pid) {
          priceInp.value = priceById[pid];
          priceInp.disabled = true;
          descInp.value = nameById[pid];
          descInp.disabled = true;
        } else {
          priceInp.disabled = false;
          descInp.disabled = false;
          if (descInp.value === nameById[pid]) descInp.value = '';
        }
        recompute();
      });
      tr.querySelector('.row-del').addEventListener('click', () => { tr.remove(); recompute(); });
      tr.querySelectorAll('input').forEach((i) => i.addEventListener('input', recompute));
      linesBody.appendChild(tr);
    }

    function recompute() {
      let sub = 0;
      linesBody.querySelectorAll('tr').forEach((tr) => {
        const line = (Number(tr.querySelector('.li-qty').value) || 0) * (Number(tr.querySelector('.li-price').value) || 0);
        tr.querySelector('.li-total').textContent = formatMoney(line);
        sub += line;
      });
      const rate = Number(document.getElementById('inv-tax').value) || 0;
      const tax = Math.round(sub * rate) / 100;
      document.getElementById('inv-sub').textContent = formatMoney(sub);
      document.getElementById('inv-taxamt').textContent = formatMoney(tax);
      document.getElementById('inv-total').textContent = formatMoney(sub + tax);
    }

    document.getElementById('inv-add').addEventListener('click', addLine);
    document.getElementById('inv-tax').addEventListener('input', recompute);
    addLine();

    async function submitInvoice() {
      const errBox = document.getElementById('modal-error');
      errBox.classList.add('hidden');
      const fail = (msg) => { errBox.textContent = msg; errBox.classList.remove('hidden'); return false; };

      const customerId = document.getElementById('inv-customer').value;
      const invoiceDate = document.getElementById('inv-date').value;
      if (!customerId) return fail(bi('Please select a customer.', 'يرجى اختيار العميل.'));
      if (!invoiceDate) return fail(bi('Invoice date is required.', 'تاريخ الفاتورة مطلوب.'));

      const items = [];
      for (const tr of [...linesBody.querySelectorAll('tr')]) {
        const pid = tr.querySelector('.li-prod').value;
        const description = tr.querySelector('.li-desc').value.trim();
        const quantity = Number(tr.querySelector('.li-qty').value);
        const unitPrice = tr.querySelector('.li-price').value;
        if (!pid && !description && !unitPrice && !quantity) continue; // blank row
        if (!Number.isFinite(quantity) || quantity <= 0) return fail(bi('Every line needs a quantity greater than zero.', 'كل سطر يحتاج كمية أكبر من صفر.'));
        if (pid) {
          items.push({ productId: Number(pid), quantity });
        } else {
          if (!description) return fail(bi('A manual line needs a description.', 'البند اليدوي يحتاج بيانًا.'));
          if (unitPrice === '' || Number(unitPrice) < 0) return fail(bi('A manual line needs a unit price.', 'البند اليدوي يحتاج سعر وحدة.'));
          items.push({ description, quantity, unitPrice });
        }
      }
      if (items.length === 0) return fail(bi('Add at least one line item.', 'أضف بندًا واحدًا على الأقل.'));

      const payload = {
        customerId: Number(customerId),
        invoiceDate,
        status: document.getElementById('inv-status').value,
        items,
      };
      const due = document.getElementById('inv-due').value;
      if (due) payload.dueDate = due;
      const tax = document.getElementById('inv-tax').value;
      if (tax !== '') payload.taxRate = Number(tax);
      const notes = document.getElementById('inv-notes').value.trim();
      if (notes) payload.notes = notes;

      try {
        const res = await api.post('/invoices', payload);
        closeModal();
        page = 1;
        await load();
        // Nudge the user if they saved a draft (no ledger effect yet).
        if (res.data.invoice.status === 'draft') {
          flashOnce(bi('Invoice saved as a draft — it will not post to the ledger until issued.', 'تم حفظ الفاتورة كمسودة — لن تُسجَّل في دفتر الأستاذ حتى إصدارها.'));
        }
      } catch (err) {
        return fail(err.message || bi('Could not create the invoice.', 'تعذّر إنشاء الفاتورة.'));
      }
    }
  }

  // Lightweight toast (reuses alert box pattern from ui.js flash, but self-contained).
  function flashOnce(message) {
    const el = document.createElement('div');
    el.className = 'alert alert-success';
    el.style.cssText = 'position:fixed;bottom:1rem;inset-inline-end:1rem;max-width:22rem;z-index:60;';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  content.querySelector('#add-btn')?.addEventListener('click', openCreate);
  load();
}
