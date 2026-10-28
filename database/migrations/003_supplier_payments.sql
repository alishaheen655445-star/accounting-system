-- =============================================================================
--  Migration 003 — Supplier payments (Accounts-Payable settlement).
--  Adds `supplier_payments`: money OUT that reduces a supplier's AP balance,
--  optionally applied to a specific purchase (updates purchases.amount_paid).
--  Idempotent: CREATE TABLE IF NOT EXISTS, safe to re-run.
-- =============================================================================
USE accounting_system;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS supplier_payments (
    id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
    payment_number     VARCHAR(30)  NOT NULL,
    supplier_id        INT UNSIGNED NOT NULL,
    purchase_id        INT UNSIGNED NULL,
    amount             DECIMAL(15,2) NOT NULL,
    payment_date       DATE         NOT NULL,
    method             ENUM('cash','bank','cheque','card') NOT NULL DEFAULT 'cash',
    reference          VARCHAR(80)  NULL,
    journal_entry_id   INT UNSIGNED NULL,
    created_by         INT UNSIGNED NULL,
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_supplier_payment_number (payment_number),
    KEY idx_sp_supplier (supplier_id),
    KEY idx_sp_purchase (purchase_id),
    CONSTRAINT fk_sp_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_sp_purchase
        FOREIGN KEY (purchase_id) REFERENCES purchases (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_sp_journal
        FOREIGN KEY (journal_entry_id) REFERENCES journal_entries (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_sp_created_by
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- Widen journal_entries.reference_type to allow the AP-settlement kind.
-- Idempotent: MODIFY with the full enum list (safe to re-run).
ALTER TABLE journal_entries
    MODIFY reference_type ENUM('manual','invoice','payment','purchase','supplier_payment','opening')
    NOT NULL DEFAULT 'manual';
