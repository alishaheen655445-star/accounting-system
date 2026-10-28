-- =============================================================================
--  Migration 002 — Pay-at-purchase support.
--  Adds purchases.amount_paid so a supplier purchase can be settled (fully or
--  partially) in cash/bank at the moment it is recorded; the unpaid remainder
--  stays in the supplier's Accounts-Payable. Idempotent: safe to re-run.
-- =============================================================================
USE accounting_system;
SET NAMES utf8mb4;

SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = 'accounting_system'
    AND TABLE_NAME   = 'purchases'
    AND COLUMN_NAME  = 'amount_paid'
);
SET @sql := IF(@exists = 0,
  'ALTER TABLE purchases ADD COLUMN amount_paid DECIMAL(15,2) NOT NULL DEFAULT 0.00 AFTER total_amount',
  'SELECT ''purchases.amount_paid already exists'' AS info'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
