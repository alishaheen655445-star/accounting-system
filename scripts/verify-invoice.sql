-- Verify the issued invoice's server-computed totals + its auto-posted journal entry
USE accounting_system;

SELECT '--- Invoice INV-2026-0004 (issued) totals ---' AS info;
SELECT id, invoice_number, subtotal, tax_rate, tax_amount, total_amount, status
FROM invoices WHERE id = 4;

SELECT '--- Its journal lines (must balance) ---' AS info;
SELECT je.entry_number, ca.code, ca.name, jl.debit, jl.credit
FROM journal_entries je
JOIN journal_lines jl ON jl.entry_id = je.id
JOIN chart_of_accounts ca ON ca.id = jl.account_id
WHERE je.reference_type = 'invoice' AND je.reference_id = 4
ORDER BY jl.id;

SELECT '--- Balance check ---' AS info;
SELECT
  (SELECT SUM(debit)  FROM journal_lines jl JOIN journal_entries je ON je.id=jl.entry_id
     WHERE je.reference_type='invoice' AND je.reference_id=4) AS total_debit,
  (SELECT SUM(credit) FROM journal_lines jl JOIN journal_entries je ON je.id=jl.entry_id
     WHERE je.reference_type='invoice' AND je.reference_id=4) AS total_credit;
