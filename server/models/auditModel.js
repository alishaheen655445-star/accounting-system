// -----------------------------------------------------------------------------
//  Audit model — READ-ONLY access to the immutable audit trail (`audit_logs`).
//  The trail is written by auditService.log(); this model only lists it for the
//  admin viewer. All queries are parameterized. LEFT JOIN users so an entry
//  still shows even if the acting user was later removed.
// -----------------------------------------------------------------------------
const { pool } = require('../config/db');

const findAll = async ({ search = '', entity = '', limit = 20, offset = 0 }) => {
  const where = [];
  const params = [];
  if (search) {
    where.push('(al.action LIKE ? OR al.entity LIKE ? OR al.description LIKE ? OR u.username LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  if (entity) {
    where.push('al.entity = ?');
    params.push(entity);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id ${whereSql}`, params
  );

  const [rows] = await pool.query(
    `SELECT al.id, al.action, al.entity, al.entity_id, al.description,
            al.ip_address, al.created_at, al.user_id, u.username AS actor
     FROM audit_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereSql}
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, total: countRows[0].total };
};

/** Distinct entity names present in the trail (for the viewer's filter dropdown). */
const distinctEntities = async () => {
  const [rows] = await pool.query('SELECT DISTINCT entity FROM audit_logs ORDER BY entity ASC');
  return rows.map((r) => r.entity);
};

module.exports = { findAll, distinctEntities };
