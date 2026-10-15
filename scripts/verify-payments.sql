-- Verify the payments module: each payment's auto-posted journal entry is balanced,
-- and the whole ledger (trial balance) still balances after all postings.
USE accounting_system;

SELECT '--- Payment journal entries: balance check ---' AS section;
SELECT je.entry_number,
       je.description,
       SUM(jl.debit)  AS total_debit,
       SUM(jl.credit) AS total_credit,
       (SUM(jl.debit) = SUM(jl.credit)) AS balanced
FROM journal_entries je
JOIN journal_lines jl ON jl.entry_id = je.id
WHERE je.reference_type = 'payment'
GROUP BY je.id, je.entry_number, je.description
ORDER BY je.id;

SELECT '--- Overall trial balance (all leaf accounts) ---' AS section;
SELECT SUM(x.debit_bal)  AS grand_total_debit,
       SUM(x.credit_bal) AS grand_total_credit,
       (SUM(x.debit_bal) = SUM(x.credit_bal)) AS ledger_balanced
FROM (
  SELECT COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0) AS debit_bal,
         CASE WHEN COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0) > 0
              THEN COALESCE(SUM(jl.credit),0) - COALESCE(SUM(jl.debit),0) ELSE 0 END AS credit_bal,
         CASE WHEN COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0) > 0
              THEN COALESCE(SUM(jl.debit),0) - COALESCE(SUM(jl.credit),0) ELSE 0 END AS debit_bal2
  FROM journal_lines jl
  GROUP BY jl.account_id
) x;

SELECT '--- Simplified: total debits vs total credits across ALL lines ---' AS section;
SELECT SUM(debit) AS all_debits, SUM(credit) AS all_credits, (SUM(debit)=SUM(credit)) AS balanced
FROM journal_lines;
