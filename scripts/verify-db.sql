-- Quick verification that schema + seed loaded correctly
USE accounting_system;

SELECT 'TABLES' AS section;
SHOW TABLES;

SELECT 'ROW COUNTS' AS section;
SELECT 'users' AS tbl, COUNT(*) AS rows_count FROM users
UNION ALL SELECT 'chart_of_accounts', COUNT(*) FROM chart_of_accounts
UNION ALL SELECT 'customers',        COUNT(*) FROM customers
UNION ALL SELECT 'suppliers',        COUNT(*) FROM suppliers
UNION ALL SELECT 'products',         COUNT(*) FROM products
UNION ALL SELECT 'invoices',         COUNT(*) FROM invoices
UNION ALL SELECT 'invoice_items',    COUNT(*) FROM invoice_items
UNION ALL SELECT 'journal_entries',  COUNT(*) FROM journal_entries
UNION ALL SELECT 'journal_lines',    COUNT(*) FROM journal_lines
UNION ALL SELECT 'payments',         COUNT(*) FROM payments
UNION ALL SELECT 'audit_logs',       COUNT(*) FROM audit_logs;

SELECT 'DOUBLE-ENTRY BALANCE CHECK (every entry must balance)' AS section;
SELECT je.entry_number,
       SUM(jl.debit)  AS total_debit,
       SUM(jl.credit) AS total_credit,
       IF(SUM(jl.debit) = SUM(jl.credit), 'BALANCED ✔', 'OUT OF BALANCE ✘') AS status
FROM journal_entries je
JOIN journal_lines jl ON jl.entry_id = je.id
GROUP BY je.id, je.entry_number;
