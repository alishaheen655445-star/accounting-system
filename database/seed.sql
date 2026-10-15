-- =============================================================================
--  Accounting System — Seed Data (Phase 1)
--  Run AFTER schema.sql.  Everything lives inside `accounting_system`.
--  Explicit primary keys are used so foreign-key wiring is deterministic.
--
--  DEMO LOGIN CREDENTIALS  (documented in README too)
--    admin       / Admin@123        role: admin
--    accountant  / Accountant@123   role: accountant
--    viewer      / Viewer@123       role: viewer
--  password_hash values are real bcrypt (cost 12) hashes of those passwords.
--
--  NOTE: account names/descriptions and ledger narrations are bilingual — the
--  Arabic text lives in the primary column (name/description/memo/notes) and the
--  English text in the *_en column. The backend returns the right one per the
--  active UI language (X-App-Lang header). Codes and IDs are kept unchanged (all
--  backend logic references ids, never names). Brand names of
--  customers/suppliers/products are left in Latin as proper nouns.
-- =============================================================================

USE accounting_system;

-- Ensure the client connection stores Arabic (utf8mb4) correctly.
SET NAMES utf8mb4;

SET FOREIGN_KEY_CHECKS = 0;   -- allow inserting in a convenient order
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE payments;
TRUNCATE TABLE journal_lines;
TRUNCATE TABLE journal_entries;
TRUNCATE TABLE invoice_items;
TRUNCATE TABLE invoices;
TRUNCATE TABLE products;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE customers;
TRUNCATE TABLE chart_of_accounts;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- -----------------------------------------------------------------------------
-- 1. Chart of Accounts
--    Groups (is_group=1) first, then postable leaf accounts (is_group=0).
-- -----------------------------------------------------------------------------
INSERT INTO chart_of_accounts (id, code, name, name_en, account_type, is_group, parent_id, description, description_en) VALUES
-- groups
(1,  '1000',  'الأصول',                       'Assets',                  'asset',     1, NULL, 'موارد تملكها المنشأة',                        'Resources owned by the entity'),
(2,  '2000',  'الخصوم',                       'Liabilities',             'liability', 1, NULL, 'التزامات مستحقة للغير',                       'Obligations owed to third parties'),
(3,  '3000',  'حقوق الملكية',                 'Equity',                  'equity',    1, NULL, 'حصة المالك المتبقية في المنشأة',              "Owner's residual interest in the entity"),
(4,  '4000',  'الإيرادات',                    'Revenue',                 'revenue',   1, NULL, 'الدخل من المبيعات والخدمات',                  'Income from sales and services'),
(5,  '5000',  'المصروفات',                    'Expenses',                'expense',   1, NULL, 'تكاليف تشغيل النشاط',                         'Costs of operating the business'),
-- asset leaves
(6,  '1100',  'النقدية بالصندوق',             'Cash on Hand',            'asset',     0, 1, 'النقدية المتوفرة في الصندوق',                   'Cash available in the till'),
(7,  '1200',  'الحساب المصرفي',               'Bank Account',            'asset',     0, 1, 'الحساب المصرفي الرئيسي للعمليات',               'Main bank account for operations'),
(8,  '1300',  'الذمم المدينة',                'Accounts Receivable',     'asset',     0, 1, 'حساب الرقابة للمبالغ المستحقة على العملاء',      'Control account for amounts owed by customers'),
(9,  '1400',  'المخزون',                      'Inventory',               'asset',     0, 1, 'البضاعة المعدّة للبيع',                          'Goods held for sale'),
-- liability leaves
(10, '2100',  'الذمم الدائنة',                'Accounts Payable',        'liability', 0, 2, 'حساب الرقابة للمبالغ المستحقة للموردين',        'Control account for amounts owed to suppliers'),
(11, '2200',  'ضريبة المبيعات المستحقة',      'Sales Tax Payable',       'liability', 0, 2, 'ضريبة المبيعات المحصّلة، تُدفع للهيئة',          'Sales tax collected, payable to the authority'),
-- equity leaves
(12, '3100',  'رأس مال المالك',               "Owner's Capital",         'equity',    0, 3, 'مساهمات المالك',                                'Owner contributions'),
(13, '3200',  'الأرباح المحتجزة',             'Retained Earnings',       'equity',    0, 3, 'الأرباح المتراكمة',                             'Accumulated profits'),
-- revenue leaves
(14, '4100',  'إيرادات المبيعات',             'Sales Revenue',           'revenue',   0, 4, 'دخل بيع البضائع',                               'Income from goods sales'),
(15, '4200',  'إيرادات الخدمات',              'Service Revenue',         'revenue',   0, 4, 'دخل تقديم الخدمات',                             'Income from services rendered'),
-- expense leaves
(16, '5100',  'تكلفة البضاعة المباعة',        'Cost of Goods Sold',      'expense',   0, 5, 'التكلفة المباشرة للبضاعة المباعة',              'Direct cost of goods sold'),
(17, '5200',  'مصروف الإيجار',                'Rent Expense',            'expense',   0, 5, 'إيجار المقر',                                   'Premises rent'),
(18, '5300',  'مصروف الرواتب',                'Salaries Expense',        'expense',   0, 5, 'رواتب الموظفين',                               'Employee salaries'),
(19, '5400',  'مصروفات الخدمات',              'Utilities Expense',       'expense',   0, 5, 'كهرباء وماء وإنترنت',                          'Electricity, water and internet'),
(20, '5500',  'مصروفات لوازم المكتب',         'Office Supplies Expense', 'expense',   0, 5, 'مستلزمات مكتبية مستهلَكة',                     'Consumed office supplies'),
-- customer receivable sub-accounts (one leaf per customer -> balance derivable)
(21, '1301',  'ذمم مدينة - Al Noor Trading',  'Receivable - Al Noor Trading',  'asset',     0, 1, 'حساب مدين فرعي لعميل',              'Customer receivable sub-account'),
(22, '1302',  'ذمم مدينة - Desert Star Co',   'Receivable - Desert Star Co',   'asset',     0, 1, 'حساب مدين فرعي لعميل',              'Customer receivable sub-account'),
(23, '1303',  'ذمم مدينة - Green Valley LLC', 'Receivable - Green Valley LLC', 'asset',     0, 1, 'حساب مدين فرعي لعميل',              'Customer receivable sub-account'),
-- supplier payable sub-accounts
(24, '2101',  'ذمم دائنة - Cairo Wholesale',  'Payable - Cairo Wholesale',  'liability', 0, 2, 'حساب دائن فرعي لمورد',              'Supplier payable sub-account'),
(25, '2102',  'ذمم دائنة - Beirut Supplies',  'Payable - Beirut Supplies',  'liability', 0, 2, 'حساب دائن فرعي لمورد',              'Supplier payable sub-account');

-- -----------------------------------------------------------------------------
-- 2. Users (bcrypt password_hash — NEVER plaintext)
-- -----------------------------------------------------------------------------
INSERT INTO users (id, username, email, password_hash, full_name, role, is_active) VALUES
(1, 'admin',      'admin@example.com',      '$2b$12$s1y1KDSdn90AQs5TUgw9Nu9G6rDwHPP2RdCcxF6E082iPHA26QCky', 'System Administrator', 'admin',      1),
(2, 'accountant', 'accountant@example.com', '$2b$12$KW9p0qB3wGJoNv4tKDF2luJlgEBBH8DVFh3.tpb/6UDUcPoewahUi', 'Rana the Accountant',  'accountant', 1),
(3, 'viewer',     'viewer@example.com',     '$2b$12$c8c7hiDw0GP40gWwdHhLyuO6j4/JqalJ8Ip7s1hX4rrLkt7qNf4wu', 'Omar the Viewer',      'viewer',     1);

-- -----------------------------------------------------------------------------
-- 3. Customers & Suppliers  (each linked to its own AR/AP leaf account)
-- -----------------------------------------------------------------------------
INSERT INTO customers (id, customer_code, name, email, phone, address, credit_limit, opening_balance, account_id) VALUES
(1, 'CUS-001', 'Al Noor Trading',   'sales@alnoor.example',   '+962-790000111', 'Amman, Jordan',        15000.00, 0.00, 21),
(2, 'CUS-002', 'Desert Star Co',    'info@desertstar.example', '+962-790000222', 'Zarqa, Jordan',        10000.00, 0.00, 22),
(3, 'CUS-003', 'Green Valley LLC',  'contact@greenvalley.example', '+962-790000333', 'Irbid, Jordan',   5000.00,  0.00, 23);

INSERT INTO suppliers (id, supplier_code, name, email, phone, address, opening_balance, account_id) VALUES
(1, 'SUP-001', 'Cairo Wholesale',  'orders@cairowholesale.example', '+20-100-555-0101', 'Cairo, Egypt',   0.00, 24),
(2, 'SUP-002', 'Beirut Supplies',  'hello@beirutsupplies.example',  '+961-3-555-0202', 'Beirut, Lebanon', 0.00, 25);

-- -----------------------------------------------------------------------------
-- 4. Products  (posts to Sales Revenue + Inventory)
-- -----------------------------------------------------------------------------
INSERT INTO products (id, sku, name, description, unit, selling_price, cost_price, revenue_account_id, inventory_account_id) VALUES
(1, 'P-001',   'Laptop Dell Latitude',    'Business laptop, 16GB RAM',      'pcs', 800.00, 620.00, 14, 9),
(2, 'P-002',   'Office Chair Ergonomic',  'Adjustable mesh office chair',   'pcs', 120.00,  75.00, 14, 9),
(3, 'SVC-01',  'Installation Service',    'On-site setup and configuration','hr',   50.00,   0.00, 15, NULL);

-- -----------------------------------------------------------------------------
-- 5. Invoices (header) — totals computed exactly like the backend would
-- -----------------------------------------------------------------------------
INSERT INTO invoices (id, invoice_number, customer_id, invoice_date, due_date, subtotal, tax_rate, tax_amount, total_amount, amount_paid, status, notes, notes_en, created_by) VALUES
(1, 'INV-2026-0001', 1, '2026-01-15', '2026-02-14', 2080.00, 15.00, 312.00, 2392.00, 0.00,    'issued', 'طلب فصلي اعتيادي',   'Regular quarterly order',    2),
(2, 'INV-2026-0002', 2, '2026-02-01', '2026-03-03',  950.00, 15.00, 142.50, 1092.50, 500.00,  'partial','تم استلام دفعة جزئية', 'Partial payment received',  2),
(3, 'INV-2026-0003', 3, '2026-02-20', '2026-03-22', 1200.00,  0.00,   0.00, 1200.00, 0.00,    'draft',  'مسودة - بانتظار الاعتماد', 'Draft - pending approval', 2);

-- -----------------------------------------------------------------------------
-- 6. Invoice Items (lines) — line_total = quantity * unit_price
-- -----------------------------------------------------------------------------
INSERT INTO invoice_items (id, invoice_id, product_id, description, quantity, unit_price, line_total, sort_order) VALUES
(1, 1, 1,  'Laptop Dell Latitude',   2.00,  800.00, 1600.00, 1),
(2, 1, 2,  'Office Chair Ergonomic',  4.00,  120.00,  480.00, 2),
(3, 2, 1,  'Laptop Dell Latitude',    1.00,  800.00,  800.00, 1),
(4, 2, 3,  'Installation Service',    3.00,   50.00,  150.00, 2),
(5, 3, 2,  'Office Chair Ergonomic', 10.00,  120.00, 1200.00, 1);

-- -----------------------------------------------------------------------------
-- 7. Journal Entries (double-entry headers)
-- -----------------------------------------------------------------------------
INSERT INTO journal_entries (id, entry_number, entry_date, description, description_en, reference_type, reference_id, created_by, is_posted) VALUES
(1, 'JE-0001', '2026-01-01', 'مساهمة رأس المال الافتتاحي',   'Opening capital contribution',  'opening',  NULL, 1, 1),
(2, 'JE-0002', '2026-01-15', 'بيع آجل - INV-2026-0001',       'Credit sale - INV-2026-0001',   'invoice',  1,    2, 1),
(3, 'JE-0003', '2026-02-10', 'دفعة مستلمة - INV-2026-0002',   'Payment received - INV-2026-0002', 'payment',  1,    2, 1);

-- -----------------------------------------------------------------------------
-- 8. Journal Lines — every entry above balances: SUM(debit) == SUM(credit)
-- -----------------------------------------------------------------------------
INSERT INTO journal_lines (id, entry_id, account_id, debit, credit, memo, memo_en) VALUES
-- Entry 1: Capital in  (Dr Cash 20000 / Cr Capital 20000)
(1, 1, 6,  20000.00,     0.00, 'نقدية أدخلها المالك', 'Cash introduced by owner'),
(2, 1, 12,     0.00, 20000.00, 'رأس مال المالك', 'Owner''s capital'),
-- Entry 2: Invoice 1 issued (Dr AR-customer1 2392 / Cr Revenue 2080 + Cr Tax 312)
(3, 2, 21,  2392.00,     0.00, 'ذمم مدينة - Al Noor Trading', 'Receivable - Al Noor Trading'),
(4, 2, 14,     0.00, 2080.00, 'إيرادات المبيعات', 'Sales revenue'),
(5, 2, 11,     0.00,  312.00, 'ضريبة مبيعات مفروضة', 'Sales tax charged'),
-- Entry 3: Payment on invoice 2 (Dr Cash 500 / Cr AR-customer2 500)
(6, 3, 6,   500.00,      0.00, 'إيداع نقدي', 'Cash deposit'),
(7, 3, 22,     0.00,   500.00, 'تحصيل من Desert Star (خفض الذمم المدينة)', 'Collection from Desert Star (reduce receivables)');

-- -----------------------------------------------------------------------------
-- 9. Payments
-- -----------------------------------------------------------------------------
INSERT INTO payments (id, payment_number, customer_id, invoice_id, amount, payment_date, method, reference, journal_entry_id, created_by) VALUES
(1, 'PMT-2026-0001', 2, 2, 500.00, '2026-02-10', 'cash', 'سند قبض #A-101', 3, 2);

-- -----------------------------------------------------------------------------
-- 10. Audit Logs (sample trail) — internal audit trail (not shown in the
--     ledger/reports UI), kept in English.
-- -----------------------------------------------------------------------------
INSERT INTO audit_logs (user_id, action, entity, entity_id, description, ip_address) VALUES
(1, 'user.login',           'users',        '1', 'Admin logged in',                          '127.0.0.1'),
(2, 'customer.create',      'customers',    '1', 'Created customer Al Noor Trading',         '127.0.0.1'),
(2, 'invoice.create',       'invoices',     '1', 'Created invoice INV-2026-0001 (2392.00)',  '127.0.0.1'),
(2, 'payment.create',       'payments',     '1', 'Recorded payment PMT-2026-0001 (500.00)',  '127.0.0.1'),
(2, 'journal_entry.create', 'journal_entries','2','Posted journal entry JE-0002',            '127.0.0.1');
