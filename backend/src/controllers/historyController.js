/**
 * controllers/historyController.js
 * Read audit logs for a project or specific entity.
 */
const { pool } = require('../config/db');

/**
 * GET /api/projects/:projectId/history
 * Returns audit events related to a project and its sub-entities.
 */
async function projectHistory(req, res) {
  try {
    // Collect entity IDs related to project
    const projectId = req.params.projectId;

    // Get all checklists, tasks, documents, emails belonging to this project
    const [checklists] = await pool.execute(`SELECT id FROM checklists WHERE project_id = ?`, [projectId]);
    const [tasks] = checklists.length
      ? await pool.execute(`SELECT id FROM tasks WHERE checklist_id IN (${checklists.map(() => '?').join(',')})`, checklists.map(c => c.id))
      : [[]];
    const [emailRecs] = await pool.execute(`SELECT id FROM emails WHERE project_id = ?`, [projectId]);

    const checklistIds = checklists.map(c => c.id);
    const taskIds      = tasks.map(t => t.id);
    const emailIds     = emailRecs.map(e => e.id);

    // Build WHERE clause across all related entities
    const conditions = [];
    const params     = [];

    conditions.push(`(entity_type = 'project' AND entity_id = ?)`); params.push(projectId);

    if (checklistIds.length) {
      conditions.push(`(entity_type = 'checklist' AND entity_id IN (${checklistIds.map(() => '?').join(',')}))`);
      params.push(...checklistIds);
    }
    if (taskIds.length) {
      conditions.push(`(entity_type = 'task' AND entity_id IN (${taskIds.map(() => '?').join(',')}))`);
      params.push(...taskIds);
    }
    if (emailIds.length) {
      conditions.push(`(entity_type = 'email' AND entity_id IN (${emailIds.map(() => '?').join(',')}))`);
      params.push(...emailIds);
    }

    const [logs] = await pool.execute(
      `SELECT al.*, u.name AS user_name, u.email AS user_email
       FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
       WHERE ${conditions.join(' OR ')}
       ORDER BY al.created_at DESC LIMIT 200`,
      params
    );

    return res.json(logs);
  } catch (err) {
    console.error('[HISTORY] projectHistory error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/history/entity/:entityType/:entityId
 * Fine-grained audit trail for a specific entity.
 */
async function entityHistory(req, res) {
  try {
    const { entityType, entityId } = req.params;
    const [rows] = await pool.execute(
      `SELECT al.*, u.name AS user_name FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.entity_type = ? AND al.entity_id = ?
       ORDER BY al.created_at DESC`,
      [entityType, entityId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { projectHistory, entityHistory };