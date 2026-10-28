// -----------------------------------------------------------------------------
//  purchases.js — Supplier purchases / stock-in screen (Stitch ds, tri-lang).
//  * Lists purchases (number, supplier, date, total).
//  * "View" opens the full purchase with its line items (read-only).
//  * "New Purchase" (admin/accountant) has DYNAMIC product lines — pick a product
//    (cost prefills from the catalog, editable to the actual price paid). Creating
//    a purchase INCREASES each product's stock and posts Dr Inventory / Cr AP.
//  Purchases post immediately, so they cannot be edited/deleted here (a wrong
//  entry should be corrected with a reversing journal entry — kept out of scope).
// -----------------------------------------------------------------------------
const content = renderLayout('purchases', bi('Purchases', 'المشتريات', 'خريد'));

if (content) {
  const canWrite = hasAnyRole('admin', 'accountant');
  let page = 1;
  const pageSize = 15;

  const columns = [
    { key: 'purchase_number', label: bi('Purchase No.', 'رقم الشرائي', 'شماره خرید'), render: (v) => `<span class="mono">${escapeHtml(v)}</span>` },
    { key: 'supplier_name', label: bi('Supplier', 'المورد', 'تأمین‌کننده') },
    { key: 'purchase_date', label: bi('Date', 'التاريخ', 'تاریخ'), render: (v) => escapeHtml(String(v).slice(0, 10)) },
    { key: 'total_amount', label: bi('Total', 'الإجمالي', 'مجموع'), numeric: true, render: (v) => formatMoney(v) },
    { key: 'status', label: bi('Status', 'الحالة', 'وضعیت'), render: (v) => `<span class="status ${escapeHtml(v)}">${escapeHtml(v === 'issued' ? bi('Posted', 'مسجّل', 'ثبت‌شده') : v)}</span>` },
  ];

  content.innerHTML = `
    <div class="bg-surface-container-low p-6 rounded-xl shadow-sm">
      <h1 class="font-headline-lg text-headline-lg text-primary" style="margin:0">${escapeHtml(bi('Purchases / Stock In', 'المشتريات والإدخال للمخزون', 'خرید و ورود به انبار'))}</h1>
      <p class="text-on-surface-variant font-body-md" style="margin:.25rem 0 0">${escapeHtml(bi('Buy from suppliers — stock increases and the ledger is posted.', 'الشراء من الموردين — تزيد الكمية ويُقيَّد في دفتر الأستاذ.', 'خرید از تأمین‌کنندگان — موجودی افزایش می‌یابد و در روزنامه ثبت می‌شود.'))}</p>
    </div>
    <div class="flex flex-wrap items-center gap-3 bg-surface-container-lowest p-4 rounded-xl shadow-sm">
      <div class="flex-1"></div>
      ${canWrite ? `<button id="add-btn" class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container font-label-lg transition-all shadow-sm">
        <span class="material-symbols-outlined text-[18px]">add</span>${escapeHtml(bi('New Purchase', 'شرائي جديد', 'خرید جدید'))}</button>` : ''}
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
      const res = await api.get(`/purchases?${new URLSearchParams({ page, pageSize })}`);
      renderTable(tableEl, { columns, rows: res.data, actions: [{ label: bi('View', 'عرض', 'نمایش'), className: 'btn-secondary', onClick: openView }] });
      renderPagination(pagerEl, res.meta, (p) => { page = p; load(); });
    } catch (err) {
      tableEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
    }
  }

  // ---- Read-only purchase detail ----
  async function openView(row) {
    let pur;
    try { pur = (await api.get(`/purchases/${row.id}`)).data.purchase; }
    catch (err) { alert(err.message); return; }

    const items = pur.items.map((it) => `
      <tr>
        <td>${escapeHtml(it.description || '')}</td>
        <td class="num">${escapeHtml(String(Number(it.quantity)))}</td>
        <td class="num">${formatMoney(it.unit_cost)}</td>
        <td class="num">${formatMoney(it.line_total)}</td>
      </tr>`).join('');

    openCustomModal(`${bi('Purchase', 'شرائي', 'خرید')} ${pur.purchase_number}`, `
      <div class="detail-grid">
        <div class="kv"><div class="k">${escapeHtml(bi('Supplier', 'المورد', 'تأمین‌کننده'))}</div><div class="v">${escapeHtml(pur.supplier_name)}</div></div>
        <div class="kv"><div class="k">${escapeHtml(bi('Date', 'التاريخ', 'تاریخ'))}</div><div class="v">${escapeHtml(String(pur.purchase_date).slice(0, 10))}</div></div>
      </div>
      <div class="table-wrap">
        <table class="lines-table">
          <thead><tr><th>${escapeHtml(bi('Description', 'البيان', 'شرح'))}</th><th class="num">${escapeHtml(bi('Qty', 'الكمية', 'تعداد'))}</th><th class="num">${escapeHtml(bi('Unit Cost', 'سعر الوحدة', 'باید واحد'))}</th><th class="num">${escapeHtml(bi('Line Total', 'إجمالي السطر', 'جمع خط'))}</th></tr></thead>
          <tbody>${items}</tbody>
        </table>
      </div>
      <div class="totals-box">
        <div class="t-row"><span>${escapeHtml(bi('Total', 'الإجمالي', 'مجموع'))}</span><span class="num">${formatMoney(pur.total_amount)}</span></div>
        <div class="t-row"><span>${escapeHtml(bi('Paid', 'المدفوع', 'پرداخت‌شده'))}</span><span class="num">${formatMoney(pur.amount_paid)}</span></div>
        <div class="t-row grand"><span>${escapeHtml(bi('Remaining (credit)', 'المتبقي (آجل)', 'مانده (نسیه)'))}</span><span class="num">${formatMoney(Number(pur.total_amount) - Number(pur.amount_paid))}</span></div>
      </div>
      ${pur.notes ? `<p class="muted mt-1">${escapeHtml(pur.notes)}</p>` : ''}`);
  }

  // ---- Create purchase with dynamic product lines ----
  async function openCreate() {
    let suppliers, products;
    try {
      [suppliers, products] = await Promise.all([loadSuppliers(), loadProducts()]);
    } catch (err) { alert(err.message); return; }

    const today = new Date().toISOString().slice(0, 10);
    const supOptions = `<option value="">${escapeHtml(bi('— Select supplier —', '— اختر المورد —', '— انتخاب تأمین‌کننده —'))}</option>` +
      optionsHtml(suppliers, 'id', (s) => `${s.supplier_code} · ${s.name}`);
    const prodOptions = `<option value="">${escapeHtml(bi('— Select product —', '— اختر المنتج —', '— انتخاب محصول —'))}</option>` +
      optionsHtml(products, 'id', (p) => `${p.sku} · ${p.name} (${formatMoney(p.cost_price)})`);

    openCustomModal(bi('New Purchase', 'شرائي جديد', 'خرید جدید'), `
      <div id="modal-error" class="alert alert-error hidden"></div>
      <div class="detail-grid">
        <div class="form-group" style="grid-column:1 / -1"><label>${escapeHtml(bi('Supplier *', 'المورد *', 'تأمین‌کننده *'))}</label>
          <select id="pur-supplier">${supOptions}</select></div>
        <div class="form-group"><label>${escapeHtml(bi('Purchase Date *', 'تاريخ الشرائي *', 'تاریخ خرید *'))}</label><input type="date" id="pur-date" value="${today}" /></div>
        <div class="form-group" style="grid-column:1 / -1"><label>${escapeHtml(bi('Notes', 'ملاحظات', 'یادداشت'))}</label><input type="text" id="pur-notes" placeholder="${escapeHtml(bi('Optional', 'اختياري', 'اختیاری'))}" /></div>
      </div>

      <label>${escapeHtml(bi('Items *', 'الأصناف *', 'اقلام *'))}</label>
      <table class="lines-table">
        <thead><tr><th style="min-width:200px">${escapeHtml(bi('Product', 'المنتج', 'محصول'))}</th><th style="min-width:150px">${escapeHtml(bi('Description', 'البيان', 'شرح'))}</th>
          <th class="num" style="width:80px">${escapeHtml(bi('Qty', 'الكمية', 'تعداد'))}</th><th class="num" style="width:110px">${escapeHtml(bi('Unit Cost', 'سعر الوحدة', 'باید واحد'))}</th>
          <th class="num" style="width:100px">${escapeHtml(bi('Total', 'الإجمالي', 'مجموع'))}</th><th style="width:30px"></th></tr></thead>
        <tbody id="pur-lines"></tbody>
      </table>
      <button type="button" class="btn btn-secondary btn-sm" id="pur-add">+ ${escapeHtml(bi('Add Line', 'إضافة سطر', 'افزودن خط'))}</button>

      <div class="detail-grid" style="margin-top:.75rem">
        <div class="form-group"><label>${escapeHtml(bi('Paid now', 'المدفوع الآن', 'پرداخت فعلی'))}</label>
          <input type="number" id="pur-paid" step="0.01" min="0" value="0" placeholder="0.00" /></div>
        <div class="form-group"><label>${escapeHtml(bi('Payment Method', 'وسيلة الدفع', 'روش پرداخت'))}</label>
          <select id="pur-method">
            <option value="cash">${escapeHtml(bi('Cash (Cash on Hand)', 'نقدًا (الصندوق)', 'نقد (صندوق)'))}</option>
            <option value="card">${escapeHtml(bi('Card (Bank)', 'بطاقة (البنك)', 'کارت (بانک)'))}</option>
          </select></div>
      </div>

      <div class="totals-box">
        <div class="t-row"><span>${escapeHtml(bi('Total', 'الإجمالي', 'مجموع'))}</span><span class="num" id="pur-total">0.00</span></div>
        <div class="t-row"><span>${escapeHtml(bi('Paid now', 'المدفوع الآن', 'پرداخت فعلی'))}</span><span class="num" id="pur-paidshow">0.00</span></div>
        <div class="t-row grand"><span>${escapeHtml(bi('Remaining (credit)', 'المتبقي (آجل)', 'مانده (نسیه)'))}</span><span class="num" id="pur-due">0.00</span></div>
      </div>`,
      submitPurchase
    );

    const linesBody = document.getElementById('pur-lines');
    const costById = Object.fromEntries(products.map((p) => [String(p.id), Number(p.cost_price)]));
    const nameById = Object.fromEntries(products.map((p) => [String(p.id), p.name]));

    function addLine() {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><select class="li-prod">${prodOptions}</select></td>
        <td><input type="text" class="li-desc" placeholder="${escapeHtml(bi('Line description', 'وصف البند', 'شرح کالا'))}" /></td>
        <td class="num"><input type="number" class="li-qty" step="0.01" min="0" value="1" /></td>
        <td class="num"><input type="number" class="li-cost" step="0.01" min="0" placeholder="0.00" /></td>
        <td class="num li-total">0.00</td>
        <td><button type="button" class="row-del" title="${escapeHtml(bi('Remove line', 'حذف السطر', 'حذف خط'))}">&times;</button></td>`;
      const prodSel = tr.querySelector('.li-prod');
      const descInp = tr.querySelector('.li-desc');
      const costInp = tr.querySelector('.li-cost');

      // Choose a product: prefill description + cost (cost stays editable —
      // the price actually paid may differ from the catalog cost).
      prodSel.addEventListener('change', () => {
        const pid = prodSel.value;
        if (pid) {
          costInp.value = costById[pid];
          if (!descInp.value || Object.values(nameById).includes(descInp.value)) descInp.value = nameById[pid];
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
        const line = (Number(tr.querySelector('.li-qty').value) || 0) * (Number(tr.querySelector('.li-cost').value) || 0);
        tr.querySelector('.li-total').textContent = formatMoney(line);
        sub += line;
      });
      const paid = Math.max(0, Number(document.getElementById('pur-paid').value) || 0);
      const capped = Math.min(paid, sub);
      document.getElementById('pur-total').textContent = formatMoney(sub);
      document.getElementById('pur-paidshow').textContent = formatMoney(capped);
      document.getElementById('pur-due').textContent = formatMoney(sub - capped);
    }

    document.getElementById('pur-paid').addEventListener('input', recompute);

    document.getElementById('pur-add').addEventListener('click', addLine);
    addLine();

    async function submitPurchase() {
      const errBox = document.getElementById('modal-error');
      errBox.classList.add('hidden');
      const fail = (msg) => { errBox.textContent = msg; errBox.classList.remove('hidden'); return false; };

      const supplierId = document.getElementById('pur-supplier').value;
      const purchaseDate = document.getElementById('pur-date').value;
      if (!supplierId) return fail(bi('Please select a supplier.', 'يرجى اختيار المورد.', 'لطفاً یک تأمین‌کننده انتخاب کنید.'));
      if (!purchaseDate) return fail(bi('Purchase date is required.', 'تاريخ الشرائي مطلوب.', 'تاریخ خرید الزامی است.'));

      const items = [];
      for (const tr of [...linesBody.querySelectorAll('tr')]) {
        const pid = tr.querySelector('.li-prod').value;
        const quantity = Number(tr.querySelector('.li-qty').value);
        const unitCost = tr.querySelector('.li-cost').value;
        const description = tr.querySelector('.li-desc').value.trim();
        if (!pid && !quantity && !unitCost) continue; // blank row
        if (!pid) return fail(bi('Every line must reference a product.', 'كل سطر يجب أن يشير إلى منتج.', 'هر خط باید به یک محصول اشاره کند.'));
        if (!Number.isFinite(quantity) || quantity <= 0) return fail(bi('Every line needs a quantity greater than zero.', 'كل سطر يحتاج كمية أكبر من صفر.', 'هر خط به تعدادی بیشتر از صفر نیاز دارد.'));
        const item = { productId: Number(pid), quantity };
        if (unitCost !== '' && Number(unitCost) >= 0) item.unitCost = Number(unitCost);
        if (description) item.description = description;
        items.push(item);
      }
      if (items.length === 0) return fail(bi('Add at least one line.', 'أضف سطرًا واحدًا على الأقل.', 'حداقل یک خط اضافه کنید.'));

      const payload = { supplierId: Number(supplierId), purchaseDate, items };
      const notes = document.getElementById('pur-notes').value.trim();
      if (notes) payload.notes = notes;

      // Optional pay-at-purchase settlement (validate against the live total).
      const total = items.reduce((s, it) => {
        const unit = (it.unitCost !== undefined) ? it.unitCost : (costById[String(it.productId)] || 0);
        return s + it.quantity * unit;
      }, 0);
      const paidVal = Math.max(0, Number(document.getElementById('pur-paid').value) || 0);
      if (paidVal > total + 0.001) {
        return fail(bi('Paid amount cannot exceed the purchase total.', 'مبلغ الدفع لا يمكن أن يتجاوز إجمالي الشرائي.', 'مبلغ پرداخت نمی‌تواند بیشتر از مجموع خرید باشد.'));
      }
      if (paidVal > 0) {
        payload.amountPaid = paidVal.toFixed(2);
        payload.paymentMethod = document.getElementById('pur-method').value || 'cash';
      }

      try {
        await api.post('/purchases', payload);
        closeModal();
        page = 1;
        await load();
        flashOnce(bi('Purchase recorded — stock increased and posted to the ledger.', 'تم تسجيل الشرائي — زادت الكمية وأُقيّد في دفتر الأستاذ.', 'خرید ثبت شد — موجودی افزایش یافت و در روزنامه ثبت شد.'));
      } catch (err) {
        return fail(err.message || bi('Could not record the purchase.', 'تعذّر تسجيل الشرائي.', 'ثبت خرید ممکن نشد.'));
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
