-- -----------------------------------------------------------------------------
--  Migration 001 — Inventory tracking (stock quantities + purchases).
--  Idempotent: safe to run repeatedly. Applies the same changes already folded
--  into schema.sql / seed.sql to an EXISTING database without dropping data.
--    * products.stock_quantity        (on-hand qty; + on purchase, - on sale)
--    * purchases / purchase_items     (supplier stock-in documents)
--    * journal_entries.reference_type gains 'purchase'
--  Run with:  mysql -u root accounting_system < database/migrations/001_inventory.sql
-- -----------------------------------------------------------------------------

-- 1) products.stock_quantity (add only if missing).
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'stock_quantity');
SET @sql := IF(@c = 0,
  'ALTER TABLE products ADD COLUMN stock_quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER cost_price',
  'SELECT ''products.stock_quantity already exists''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) journal_entries.reference_type: add 'purchase' (only if not already present).
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'journal_entries'
             AND COLUMN_NAME = 'reference_type'
             AND COLUMN_TYPE LIKE '%purchase%');
SET @sql := IF(@c = 0,
  'ALTER TABLE journal_entries MODIFY COLUMN reference_type ENUM(''manual'',''invoice'',''payment'',''purchase'',''opening'') NOT NULL DEFAULT ''manual''',
  'SELECT ''journal_entries.reference_type already has purchase''');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) purchases + purchase_items (created only if missing).
CREATE TABLE IF NOT EXISTS purchases (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    purchase_number VARCHAR(30)  NOT NULL,
    supplier_id     INT UNSIGNED NOT NULL,
    purchase_date   DATE         NOT NULL,
    subtotal        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_amount    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    status          ENUM('issued','void') NOT NULL DEFAULT 'issued',
    notes           VARCHAR(255) NULL,
    created_by      INT UNSIGNED NULL,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_number (purchase_number),
    KEY idx_purchases_supplier (supplier_id),
    CONSTRAINT fk_purchases_supplier   FOREIGN KEY (supplier_id) REFERENCES suppliers (id) ON DELETE RESTRICT,
    CONSTRAINT fk_purchases_created_by FOREIGN KEY (created_by)  REFERENCES users (id)     ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_items (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    purchase_id   INT UNSIGNED  NOT NULL,
    product_id    INT UNSIGNED  NOT NULL,
    description   VARCHAR(255)  NOT NULL,
    quantity      DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    unit_cost     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    line_total    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    sort_order    INT UNSIGNED  NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_pitems_purchase (purchase_id),
    KEY idx_pitems_product (product_id),
    CONSTRAINT fk_pitems_purchase FOREIGN KEY (purchase_id) REFERENCES purchases (id) ON DELETE CASCADE,
    CONSTRAINT fk_pitems_product  FOREIGN KEY (product_id)  REFERENCES products (id)  ON DELETE RESTRICT
) ENGINE=InnoDB;
