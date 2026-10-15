// -----------------------------------------------------------------------------
//  lookups.js — small cached loaders for dropdown data shared across screens.
//  Each list is fetched at most once per page load (the entity pickers, product
//  catalog, account tree, open invoices). Screens opt into only what they need.
// -----------------------------------------------------------------------------

const _lookupCache = {};

/** Postable leaf accounts: [{ id, code, name, account_type }]. */
async function loadAccounts() {
  if (_lookupCache.accounts) return _lookupCache.accounts;
  const res = await api.get('/journal/accounts');
  _lookupCache.accounts = res.data.accounts || [];
  return _lookupCache.accounts;
}

/** Active customers as { id, name } for pickers (fetch a large page). */
async function loadCustomers() {
  if (_lookupCache.customers) return _lookupCache.customers;
  const res = await api.get('/customers?pageSize=100');
  _lookupCache.customers = (res.data || []).filter((c) => c.is_active);
  return _lookupCache.customers;
}

/** Active products as { id, sku, name, selling_price } for invoice lines. */
async function loadProducts() {
  if (_lookupCache.products) return _lookupCache.products;
  const res = await api.get('/products?pageSize=100');
  _lookupCache.products = (res.data || []).filter((p) => p.is_active);
  return _lookupCache.products;
}

/** Invoices that can still receive a payment (issued / partial). */
async function loadPayableInvoices() {
  if (_lookupCache.payInvoices) return _lookupCache.payInvoices;
  const res = await api.get('/invoices?pageSize=100');
  _lookupCache.payInvoices = (res.data || []).filter(
    (i) => ['issued', 'partial'].includes(i.status) &&
           Number(i.amount_paid) < Number(i.total_amount)
  );
  return _lookupCache.payInvoices;
}

/** Build a <option> list from objects, with an explicit value/label key. */
function optionsHtml(items, valueKey, labelFn, selected) {
  return items
    .map((it) => `<option value="${escapeHtml(it[valueKey])}" ${String(it[valueKey]) === String(selected) ? 'selected' : ''}>${escapeHtml(labelFn(it))}</option>`)
    .join('');
}
