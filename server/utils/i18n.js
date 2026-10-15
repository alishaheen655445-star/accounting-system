// -----------------------------------------------------------------------------
//  i18n.js — server-side localization of stored DATA (account names, ledger
//  narrations, invoice notes). The UI chrome is translated on the client; this
//  only picks the right language for text that lives in the database.
//
//  Convention: every localizable column has an Arabic primary column (name,
//  description, memo, notes) and an optional English twin (name_en, ...). The
//  frontend sends its active language via the `X-App-Lang` header; we return the
//  matching value in the SAME field name the client already reads, so no display
//  code has to change. English falls back to Arabic when a *_en value is absent
//  (e.g. manual entries typed by a user in one language).
// -----------------------------------------------------------------------------

/** Resolve the request language from the X-App-Lang header ('ar' | 'en'). */
const langOf = (req) => (req && req.headers && req.headers['x-app-lang'] === 'ar' ? 'ar' : 'en');

/**
 * Pick the localized value from a DB row.
 * @param {object} row    the row, carrying both `field` and `field_en`
 * @param {string} field  the Arabic/primary column name (e.g. 'name')
 * @param {string} lang   'ar' or 'en'
 * @returns the string for the active language (English falls back to Arabic).
 */
const pick = (row, field, lang) => {
  if (row == null) return row;
  if (lang === 'ar') return row[field];
  const en = row[`${field}_en`];
  return en != null && en !== '' ? en : row[field];
};

module.exports = { langOf, pick };
