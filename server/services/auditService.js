// -----------------------------------------------------------------------------
//  Audit service — records important actions (requirement 25).
//  Kept as a tiny, reusable helper so any controller/service can log an action.
//  The write is best-effort: an audit failure must NOT break the main operation,
//  so we swallow (but log) any error here.
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');
const auditModel = require('../models/auditModel');

/**
 * @param {object} entry
 * @param {number|null} entry.userId      acting user id
 * @param {string}      entry.action      e.g. 'user.login'
 * @param {string}      entry.entity      e.g. 'users'
 * @param {number|string|null} entry.entityId
 * @param {string}      [entry.description]
 * @param {string}      [entry.ip]
 */
const log = async ({ userId = null, action, entity, entityId = null, description = null, ip = null }) => {
  try {
    const sql = `
      INSERT INTO audit_logs (user_id, action, entity, entity_id, description, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)`;
    await pool.query(sql, [userId, action, entity, entityId ? String(entityId) : null, description, ip]);
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
};

/** Read-only paginated trail for the admin viewer. */
const list = async ({ search = '', entity = '', page = 1, pageSize = 20 }) => {
  const offset = (page - 1) * pageSize;
  const { rows, total } = await auditModel.findAll({ search, entity, limit: pageSize, offset });
  return {
    items: rows,
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
};

/** Distinct entity names for the viewer's filter dropdown. */
const entities = async () => auditModel.distinctEntities();

module.exports = { log, list, entities };
