-- Confirm the audit trail captured supplier/product CRUD from the test run.
USE accounting_system;
SELECT id, user_id, action, entity, entity_id, description, created_at
FROM audit_logs
WHERE entity IN ('suppliers', 'products')
ORDER BY id DESC
LIMIT 15;
