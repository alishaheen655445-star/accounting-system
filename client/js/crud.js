// -----------------------------------------------------------------------------
//  crud.js — reusable building blocks shared by every list/CRUD screen.
//  Keeping them here means each entity page only describes its COLUMNS and
//  FORM FIELDS — the table, pagination, modal and delete flow are all generic.
//  All rendered values are escaped (XSS-safe) unless a column supplies `render`.
// -----------------------------------------------------------------------------

/**
 * renderTable(container, { columns, rows, actions })
 *  columns : [{ key, label, render?(value, row) -> html }]
 *  rows    : array of objects
 *  actions : [{ label, className, onClick(row) }] shown as a button per row
 */
function renderTable(container, { columns, rows, actions = [] }) {
  if (!rows.length) {
    container.innerHTML = `<p class="muted">${t('noRecords')}</p>`;
    return;
  }

  // Numeric columns right-align BOTH the header and the cells so headings sit
  // above their figures (the .num class also applies tabular-nums via styles.css).
  const head = columns.map((c) => `<th${c.numeric ? ' class="num"' : ''}>${escapeHtml(c.label)}</th>`).join('')
    + (actions.length ? `<th class="right">${t('actions')}</th>` : '');

  const body = rows.map((row, i) => {
    const cells = columns.map((c) => {
      const raw = row[c.key];
      const html = c.render ? c.render(raw, row) : escapeHtml(raw ?? '');
      const cls = c.numeric ? ' class="num"' : '';
      return `<td${cls}>${html}</td>`;
    }).join('');

    const actionBtns = actions.map((a, ai) => {
      const label = typeof a.label === 'function' ? a.label(row) : a.label;
      const cls = typeof a.className === 'function' ? a.className(row) : (a.className || 'btn-secondary');
      return `<button class="btn btn-sm ${cls}" data-row="${i}" data-action="${ai}">${escapeHtml(label)}</button>`;
    }).join(' ');
    const actionCell = actions.length ? `<td class="right">${actionBtns}</td>` : '';

    return `<tr>${cells}${actionCell}</tr>`;
  }).join('');

  container.innerHTML = `
    <div class="table-wrap">
      <table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </div>`;

  // Wire action buttons via event delegation on the table.
  container.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = rows[Number(btn.dataset.row)];
      const action = actions[Number(btn.dataset.action)];
      action.onClick(row);
    });
  });
}

/**
 * renderPagination(container, meta, onPageChange)
 *  meta : { page, pageSize, total, totalPages }
 */
function renderPagination(container, meta, onPageChange) {
  const { page, total, totalPages } = meta;
  container.innerHTML = `
    <div class="toolbar mt-1">
      <span class="muted">${t('pageOf', page, totalPages, total)}</span>
      <span class="spacer"></span>
      <button class="btn btn-secondary btn-sm" id="pg-prev" ${page <= 1 ? 'disabled' : ''}>${t('prev')}</button>
      <button class="btn btn-secondary btn-sm" id="pg-next" ${page >= totalPages ? 'disabled' : ''}>${t('next')}</button>
    </div>`;
  const prev = container.querySelector('#pg-prev');
  const next = container.querySelector('#pg-next');
  if (prev) prev.addEventListener('click', () => onPageChange(page - 1));
  if (next) next.addEventListener('click', () => onPageChange(page + 1));
}

/**
 * openFormModal({ title, fields, initialValues, onSubmit })
 *  fields : [{ name, label, type, required, options?, placeholder? }]
 *           type in: text | email | tel | number | textarea | select
 *  initialValues : object keyed by field.name (for edit) or null (for create)
 *  onSubmit(values) : async; throw to keep the modal open and show the error
 */
function openFormModal({ title, fields, initialValues = null, onSubmit }) {
  document.getElementById('form-modal-overlay')?.remove();

  const control = (f) => {
    const val = initialValues ? (initialValues[f.name] ?? '') : '';
    if (f.type === 'select') {
      const opts = (f.options || [])
        .map((o) => `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${escapeHtml(o.label)}</option>`)
        .join('');
      return `<select name="${f.name}"><option value="">${escapeHtml(t('select'))}</option>${opts}</select>`;
    }
    if (f.type === 'textarea') {
      return `<textarea name="${f.name}" rows="3" placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(val)}</textarea>`;
    }
    return `<input type="${f.type || 'text'}" name="${f.name}" value="${escapeHtml(val)}"
      placeholder="${escapeHtml(f.placeholder || '')}" ${f.required ? 'required' : ''} />`;
  };

  const formHtml = fields.map((f) => `
    <div class="form-group">
      <label>${escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
      ${control(f)}
    </div>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'form-modal-overlay';
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h3>${escapeHtml(title)}</h3><button type="button" class="x" data-close>&times;</button></div>
      <form id="modal-form">
        <div class="modal-body">
          <div id="modal-error" class="alert alert-error hidden"></div>
          ${formHtml}
        </div>
        <div class="modal-foot">
          <button type="button" class="btn btn-secondary" data-close>${t('cancel')}</button>
          <button type="submit" class="btn">${t('save')}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const errBox = overlay.querySelector('#modal-error');

  overlay.querySelector('#modal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.classList.add('hidden');
    const values = Object.fromEntries(new FormData(e.target).entries());
    // Drop empty optional fields so the backend applies defaults / skips them.
    Object.keys(values).forEach((k) => { if (values[k] === '') delete values[k]; });
    try {
      await onSubmit(values);
      close();
    } catch (err) {
      errBox.textContent = err.message || t('saveFailed');
      errBox.classList.remove('hidden');
    }
  });
}

/** Simple confirm for soft-delete (Arabic on ds pages via t()). */
function confirmDelete(name) {
  return window.confirm(t('deactivateConfirm', name));
}

/**
 * openCustomModal(title, bodyHtml, onSubmit)
 * A wide modal for complex forms (dynamic line items) that need more control
 * than openFormModal's flat field list. bodyHtml is authored by the screen and
 * is inserted as-is; onSubmit is wired to the Save button (may be omitted for
 * read-only views). All dynamic values embedded by the caller must be escaped.
 */
function openCustomModal(title, bodyHtml, onSubmit) {
  document.getElementById('custom-modal-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'custom-modal-overlay';
  overlay.className = 'modal-overlay open';
  overlay.innerHTML = `
    <div class="modal modal-wide">
      <div class="modal-head"><h3>${escapeHtml(title)}</h3><button type="button" class="x" data-close>&times;</button></div>
      <div class="modal-body">${bodyHtml}</div>
      <div class="modal-foot">
        <button type="button" class="btn btn-secondary" data-close>${t('cancel')}</button>
        ${onSubmit ? `<button type="button" class="btn" id="custom-save">${t('save')}</button>` : ''}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeModal));
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  if (onSubmit) overlay.querySelector('#custom-save').addEventListener('click', onSubmit);
}

function closeModal() {
  document.getElementById('custom-modal-overlay')?.remove();
}
