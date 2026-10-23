-- =============================================================================
--  Accounting System — Database Schema (Phase 1)
--  Engine : MySQL / MariaDB  (InnoDB, utf8mb4)
--  Design : Normalized relational schema with enforced referential integrity
-- =============================================================================
--  Run order:  1) schema.sql   2) seed.sql
--  Notes:
--    * All monetary columns use DECIMAL(15,2) — never FLOAT/DOUBLE — so that
--      accounting totals are exact (no binary floating-point rounding errors).
--    * Foreign keys are declared inline; see the README/ER explanation for the
--      "why" behind each relationship.
--    * ON DELETE rules:
--        - RESTRICT  : block deleting a row that active records still reference
--                      (protects financial history).
--        - CASCADE   : child rows are meaningless without their parent
--                      (e.g. invoice_items without an invoice).
-- =============================================================================

DROP DATABASE IF EXISTS accounting_system;
CREATE DATABASE accounting_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE accounting_system;

-- Force the session to reject invalid values instead of silently coercing them
SET SESSION SQL_MODE = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- =============================================================================
-- 1. users  — authentication + role-based authorization
-- =============================================================================
CREATE TABLE users (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    username       VARCHAR(50)  NOT NULL,
    email          VARCHAR(120) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,               -- bcrypt output (60 chars); never plaintext
    full_name      VARCHAR(120) NOT NULL,
    role           ENUM('admin','accountant','viewer') NOT NULL DEFAULT 'viewer',
    is_active      TINYINT(1)   NOT NULL DEFAULT 1,      -- soft disable without deleting history
    created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_username (username),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- =============================================================================
-- 2. chart_of_accounts  — the backbone of double-entry accounting
--    Self-referencing (parent_id) so accounts form a hierarchy of group + leaf.
--    Only leaf accounts (is_group = 0) may receive journal lines.
-- =============================================================================
CREATE TABLE chart_of_accounts (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    code          VARCHAR(20)  NOT NULL,                 -- e.g. '1000', '1101'
    name          VARCHAR(120) NOT NULL,                 -- Arabic (primary) display name
    name_en       VARCHAR(120) NULL,                     -- English name (falls back to name when NULL)
    account_type  ENUM('asset','liability','equity','revenue','expense') NOT NULL,
    is_group      TINYINT(1)   NOT NULL DEFAULT 0,       -- 1 = heading/group, 0 = postable leaf
    parent_id     INT UNSIGNED NULL,                     -- FK -> chart_of_accounts.id (self)
    description   VARCHAR(255) NULL,
    description_en VARCHAR(255) NULL,                    -- English description
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_coa_code (code),
    KEY idx_coa_parent (parent_id),
    CONSTRAINT fk_coa_parent
        FOREIGN KEY (parent_id) REFERENCES chart_of_accounts (id)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =============================================================================
-- 3. customers  — who we sell to
--    account_id -> a dedicated Accounts-Receivable leaf per customer, so the
--    customer balance is always derivable from the ledger.
-- =============================================================================
CREATE TABLE customers (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_code    VARCHAR(20)  NOT NULL,
    name             VARCHAR(150) NOT NULL,
    email            VARCHAR(120) NULL,
    phone            VARCHAR(30)  NULL,
    address          VARCHAR(255) NULL,
    credit_limit     DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    opening_balance  DECIMAL(15,2) NOT NULL DEFAULT 0.00,   -- balance carried in (debit positive)
    account_id       INT UNSIGNED NULL,                      -- FK -> chart_of_accounts (AR sub-account)
    is_active        TINYINT(1)   NOT NULL DEFAULT 1,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_customer_code (customer_code),
    KEY idx_customers_account (account_id),
    CONSTRAINT fk_customers_account
        FOREIGN KEY (account_id) REFERENCES chart_of_accounts (id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- 4. suppliers  — who we buy from (mirror of customers, AP side)
-- =============================================================================
CREATE TABLE suppliers (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    supplier_code    VARCHAR(20)  NOT NULL,
    name             VARCHAR(150) NOT NULL,
    email            VARCHAR(120) NULL,
    phone            VARCHAR(30)  NULL,
    address          VARCHAR(255) NULL,
    opening_balance  DECIMAL(15,2) NOT NULL DEFAULT 0.00,   -- balance carried in (credit positive)
    account_id       INT UNSIGNED NULL,                      -- FK -> chart_of_accounts (AP sub-account)
    is_active        TINYINT(1)   NOT NULL DEFAULT 1,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_supplier_code (supplier_code),
    KEY idx_suppliers_account (account_id),
    CONSTRAINT fk_suppliers_account
        FOREIGN KEY (account_id) REFERENCES chart_of_accounts (id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- 5. products  — sellable / purchasable inventory items
--    Two FKs point at the accounts a product posts to when sold / stocked.
-- =============================================================================
CREATE TABLE products (
    id                     INT UNSIGNED NOT NULL AUTO_INCREMENT,
    sku                    VARCHAR(30)  NOT NULL,
    name                   VARCHAR(150) NOT NULL,
    description            VARCHAR(255) NULL,
    unit                   VARCHAR(20)  NOT NULL DEFAULT 'pcs',
    selling_price          DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    cost_price             DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    stock_quantity         DECIMAL(12,2) NOT NULL DEFAULT 0.00,   -- on-hand qty; + on purchase, - on sale
    revenue_account_id     INT UNSIGNED NULL,              -- FK -> chart_of_accounts (sales revenue)
    inventory_account_id   INT UNSIGNED NULL,              -- FK -> chart_of_accounts (stock asset)
    is_active              TINYINT(1)   NOT NULL DEFAULT 1,
    created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_products_sku (sku),
    CONSTRAINT fk_products_revenue_account
        FOREIGN KEY (revenue_account_id) REFERENCES chart_of_accounts (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_products_inventory_account
        FOREIGN KEY (inventory_account_id) REFERENCES chart_of_accounts (id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- 6. invoices  — sales invoice header (parent)
--    Money totals are stored for read performance but always recomputed
--    server-side from invoice_items (source of truth = backend, per req. 24).
-- =============================================================================
CREATE TABLE invoices (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_number  VARCHAR(30)  NOT NULL,
    customer_id     INT UNSIGNED NOT NULL,                 -- FK -> customers
    invoice_date    DATE         NOT NULL,
    due_date        DATE         NULL,
    subtotal        DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    tax_rate        DECIMAL(5,2)  NOT NULL DEFAULT 0.00,   -- percentage, e.g. 15.00
    tax_amount      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    total_amount    DECIMAL(15,2) NOT NULL DEFAULT 0.00,   -- subtotal + tax_amount
    amount_paid     DECIMAL(15,2) NOT NULL DEFAULT 0.00,   -- maintained by payments
    status          ENUM('draft','issued','partial','paid','void') NOT NULL DEFAULT 'draft',
    notes           VARCHAR(255) NULL,
    notes_en        VARCHAR(255) NULL,                    -- English notes
    created_by      INT UNSIGNED NULL,                     -- FK -> users (who raised it)
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_invoice_number (invoice_number),
    KEY idx_invoices_customer (customer_id),
    KEY idx_invoices_status (status),
    CONSTRAINT fk_invoices_customer
        FOREIGN KEY (customer_id) REFERENCES customers (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_invoices_created_by
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- 7. invoice_items  — invoice lines (child of invoices)
--    Classic one-to-many: an invoice has many line items.
-- =============================================================================
CREATE TABLE invoice_items (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    invoice_id    INT UNSIGNED  NOT NULL,                  -- FK -> invoices (CASCADE)
    product_id    INT UNSIGNED  NULL,                      -- FK -> products (NULL = ad-hoc line)
    description   VARCHAR(255)  NOT NULL,
    quantity      DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    unit_price    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    line_total    DECIMAL(15,2) NOT NULL DEFAULT 0.00,     -- quantity * unit_price (backend computes)
    sort_order    INT UNSIGNED  NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_items_invoice (invoice_id),
    KEY idx_items_product (product_id),
    CONSTRAINT fk_items_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_items_product
        FOREIGN KEY (product_id) REFERENCES products (id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- 7b. purchases  — supplier purchase / stock-in header (parent)
--     Mirrors invoices. Creating a purchase posts Dr Inventory / Cr Supplier AP
--     and increases each product's stock_quantity, all in one transaction.
-- =============================================================================
CREATE TABLE purchases (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    purchase_number VARCHAR(30)  NOT NULL,
    supplier_id     INT UNSIGNED NOT NULL,                 -- FK -> suppliers
    purchase_date   DATE         NOT NULL,
    subtotal        DECIMAL(15,2) NOT NULL DEFAULT 0.00,   -- SUM(line_total) = SUM(qty * unit_cost)
    total_amount    DECIMAL(15,2) NOT NULL DEFAULT 0.00,   -- = subtotal (no tax on purchases here)
    status          ENUM('issued','void') NOT NULL DEFAULT 'issued',
    notes           VARCHAR(255) NULL,
    created_by      INT UNSIGNED NULL,                     -- FK -> users
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_purchase_number (purchase_number),
    KEY idx_purchases_supplier (supplier_id),
    CONSTRAINT fk_purchases_supplier
        FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_purchases_created_by
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- 7c. purchase_items  — purchase lines (child of purchases)
-- =============================================================================
CREATE TABLE purchase_items (
    id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    purchase_id   INT UNSIGNED  NOT NULL,                  -- FK -> purchases (CASCADE)
    product_id    INT UNSIGNED  NOT NULL,                  -- FK -> products (a purchase always stocks a product)
    description   VARCHAR(255)  NOT NULL,
    quantity      DECIMAL(12,2) NOT NULL DEFAULT 1.00,
    unit_cost     DECIMAL(15,2) NOT NULL DEFAULT 0.00,     -- cost paid per unit
    line_total    DECIMAL(15,2) NOT NULL DEFAULT 0.00,     -- quantity * unit_cost (backend computes)
    sort_order    INT UNSIGNED  NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_pitems_purchase (purchase_id),
    KEY idx_pitems_product (product_id),
    CONSTRAINT fk_pitems_purchase
        FOREIGN KEY (purchase_id) REFERENCES purchases (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pitems_product
        FOREIGN KEY (product_id) REFERENCES products (id)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =============================================================================
-- 8. journal_entries  — double-entry header (one accounting event)
--    The balance rule (SUM(debit) == SUM(credit)) is enforced in the backend
--    inside a DB transaction, because it spans multiple journal_lines rows.
-- =============================================================================
CREATE TABLE journal_entries (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    entry_number    VARCHAR(30)  NOT NULL,
    entry_date      DATE         NOT NULL,
    description     VARCHAR(255) NOT NULL,                -- Arabic (primary) narration
    description_en  VARCHAR(255) NULL,                    -- English narration (system-generated entries)
    reference_type  ENUM('manual','invoice','payment','purchase','opening') NOT NULL DEFAULT 'manual',
    reference_id    INT UNSIGNED NULL,                     -- id in the originating table (non-FK, polymorphic)
    created_by      INT UNSIGNED NULL,                     -- FK -> users
    is_posted       TINYINT(1)   NOT NULL DEFAULT 1,       -- draft vs posted to ledger
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_entry_number (entry_number),
    KEY idx_je_ref (reference_type, reference_id),
    CONSTRAINT fk_je_created_by
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- 9. journal_lines  — the debit/credit detail rows of an entry (child)
--    Each line targets ONE account and holds EITHER a debit OR a credit.
-- =============================================================================
CREATE TABLE journal_lines (
    id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    entry_id    INT UNSIGNED  NOT NULL,                    -- FK -> journal_entries (CASCADE)
    account_id  INT UNSIGNED  NOT NULL,                    -- FK -> chart_of_accounts
    debit       DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    credit      DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    memo        VARCHAR(255)  NULL,                       -- Arabic (primary) line memo
    memo_en     VARCHAR(255)  NULL,                       -- English line memo (system-generated entries)
    PRIMARY KEY (id),
    KEY idx_jl_entry (entry_id),
    KEY idx_jl_account (account_id),
    -- A line may not be both debit and credit, and must not be empty:
    CONSTRAINT chk_jl_side CHECK (NOT (debit > 0 AND credit > 0)),
    CONSTRAINT chk_jl_nonzero CHECK (debit > 0 OR credit > 0),
    CONSTRAINT fk_jl_entry
        FOREIGN KEY (entry_id) REFERENCES journal_entries (id)
        ON DELETE CASCADE,
    CONSTRAINT fk_jl_account
        FOREIGN KEY (account_id) REFERENCES chart_of_accounts (id)
        ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =============================================================================
-- 10. payments  — money in/out, usually settling an invoice
--     journal_entry_id links the payment to the double-entry it generated.
-- =============================================================================
CREATE TABLE payments (
    id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
    payment_number     VARCHAR(30)  NOT NULL,
    customer_id        INT UNSIGNED NOT NULL,              -- FK -> customers
    invoice_id         INT UNSIGNED NULL,                  -- FK -> invoices (NULL = on-account payment)
    amount             DECIMAL(15,2) NOT NULL,
    payment_date       DATE         NOT NULL,
    method             ENUM('cash','bank','cheque','card') NOT NULL DEFAULT 'cash',
    reference          VARCHAR(80)  NULL,                  -- cheque no. / bank ref
    journal_entry_id   INT UNSIGNED NULL,                  -- FK -> journal_entries created for this
    created_by         INT UNSIGNED NULL,                  -- FK -> users
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_number (payment_number),
    KEY idx_payments_customer (customer_id),
    KEY idx_payments_invoice (invoice_id),
    CONSTRAINT fk_payments_customer
        FOREIGN KEY (customer_id) REFERENCES customers (id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_payments_invoice
        FOREIGN KEY (invoice_id) REFERENCES invoices (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_payments_journal
        FOREIGN KEY (journal_entry_id) REFERENCES journal_entries (id)
        ON DELETE SET NULL,
    CONSTRAINT fk_payments_created_by
        FOREIGN KEY (created_by) REFERENCES users (id)
        ON DELETE SET NULL
) ENGINE=InnoDB;

-- =============================================================================
-- 11. audit_logs  — immutable trail of important actions (req. 25)
--     FK is ON DELETE SET NULL so removing a user never erases the audit trail.
-- =============================================================================
CREATE TABLE audit_logs (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      INT UNSIGNED NULL,                        -- FK -> users (actor)
    action       VARCHAR(80)  NOT NULL,                     -- e.g. 'customer.create'
    entity       VARCHAR(50)  NOT NULL,                     -- e.g. 'customers'
    entity_id    VARCHAR(50)  NULL,                         -- id of affected row (string for flexibility)
    description  VARCHAR(500) NULL,                         -- human-readable detail
    ip_address   VARCHAR(45)  NULL,                         -- supports IPv6
    created_at   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_audit_user (user_id),
    KEY idx_audit_entity (entity, entity_id),
    KEY idx_audit_time (created_at),
    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE SET NULL
) ENGINE=InnoDB;
