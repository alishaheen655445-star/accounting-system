SELECT user_id, action, entity, entity_id, description
FROM accounting_system.audit_logs
WHERE entity = 'customers'
ORDER BY id DESC
LIMIT 5;
