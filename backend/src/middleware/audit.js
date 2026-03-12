/**
 * middleware/audit.js
 * Writes audit log entries to the database.
 * Call auditLog() inside controllers after state-changing operations.
 */
const { pool } = require('../config/db');

/**
 * auditLog — records an action in audit_logs.
 * @param {Object} params
 * @param {number|null} params.userId   - performing user
 * @param {string}      params.action   - e.g. 'task.status_changed'
 * @param {string}      params.entityType
 * @param {number|null} params.entityId
 * @param {Object}      params.details  - arbitrary JSON context
 * @param {string}      params.ipAddress
 */
async function auditLog({ userId, action, entityType, entityId, details = {}, ipAddress }) {
  try {
    await pool.execute(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId || null, action, entityType, entityId || null, JSON.stringify(details), ipAddress || null]
    );
  } catch (err) {
    // Audit failure must NOT break the main request — log to console only
    console.error('[AUDIT] Failed to write audit log:', err.message);
  }
}

/**
 * Middleware factory — automatically audits HTTP requests on specified routes.
 * Typically used for simple GET logging; prefer explicit auditLog() calls for writes.
 */
function auditMiddleware(action, entityType) {
  return async (req, res, next) => {
    await auditLog({
      userId:     req.user?.id,
      action,
      entityType,
      entityId:   req.params.id ? parseInt(req.params.id, 10) : null,
      details:    { method: req.method, path: req.path },
      ipAddress:  req.ip,
    });
    next();
  };
}

module.exports = { auditLog, auditMiddleware };