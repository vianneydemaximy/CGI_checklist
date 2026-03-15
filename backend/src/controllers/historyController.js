/**
 * controllers/historyController.js
 */
const { pool } = require('../config/db');

async function projectHistory(req, res) {
  try {
    const projectId = req.params.projectId;
    const [checklists] = await pool.execute(`SELECT id FROM checklists WHERE project_id = ?`, [projectId]);
    const [emailRecs]  = await pool.execute(`SELECT id FROM emails WHERE project_id = ?`,    [projectId]);

    let tasks = [];
    if (checklists.length) {
      const ph = checklists.map(() => '?').join(',');
      [tasks] = await pool.execute(`SELECT id FROM tasks WHERE checklist_id IN (${ph})`, checklists.map(c => c.id));
    }

    const conditions = [`(entity_type = 'project' AND entity_id = ?)`];
    const params     = [projectId];

    if (checklists.length) {
      conditions.push(`(entity_type = 'checklist' AND entity_id IN (${checklists.map(() => '?').join(',')}))`);
      params.push(...checklists.map(c => c.id));
    }
    if (tasks.length) {
      conditions.push(`(entity_type = 'task' AND entity_id IN (${tasks.map(() => '?').join(',')}))`);
      params.push(...tasks.map(t => t.id));
    }
    if (emailRecs.length) {
      conditions.push(`(entity_type = 'email' AND entity_id IN (${emailRecs.map(() => '?').join(',')}))`);
      params.push(...emailRecs.map(e => e.id));
    }

    const [logs] = await pool.execute(
      `SELECT al.*, u.name AS user_name, u.email AS user_email
       FROM audit_logs al LEFT JOIN users u ON u.id = al.user_id
       WHERE ${conditions.join(' OR ')}
       ORDER BY al.created_at DESC LIMIT 300`,
      params
    );
    return res.json(logs);
  } catch (err) {
    console.error('[HISTORY] projectHistory:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

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