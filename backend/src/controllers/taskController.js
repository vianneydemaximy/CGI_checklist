/**
 * controllers/taskController.js
 * Full CRUD for tasks. All actions require consultant or admin — no client access.
 */
const { pool }     = require('../config/db');
const { auditLog } = require('../middleware/audit');

/** GET /api/checklists/:checklistId/tasks */
async function listByChecklist(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT t.*,
        (SELECT COUNT(*) FROM documents d WHERE d.task_id = t.id) AS document_count
       FROM tasks t
       WHERE t.checklist_id = ?
       ORDER BY t.priority ASC, t.sort_order ASC`,
      [req.params.checklistId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[TASK] list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/tasks/:id */
async function getOne(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM tasks WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/checklists/:checklistId/tasks */
async function create(req, res) {
  const { title, description, task_type = 'document', priority = 5, assigned_to_email } = req.body;
  if (!title) return res.status(400).json({ error: 'Task title is required' });

  try {
    const [result] = await pool.execute(
      `INSERT INTO tasks (checklist_id, title, description, task_type, priority, assigned_to_email)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.checklistId, title, description || null, task_type, priority, assigned_to_email || null]
    );
    const taskId = result.insertId;
    await auditLog({
      userId: req.user.id, action: 'task.created', entityType: 'task',
      entityId: taskId, details: { title, task_type }, ipAddress: req.ip,
    });
    return res.status(201).json({ id: taskId, message: 'Task created' });
  } catch (err) {
    console.error('[TASK] create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** PUT /api/tasks/:id */
async function update(req, res) {
  const { title, description, task_type, priority, status, assigned_to_email } = req.body;

  try {
    const [rows] = await pool.execute(`SELECT * FROM tasks WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    const t = rows[0];

    const newStatus = status || t.status;
    await pool.execute(
      `UPDATE tasks SET title=?, description=?, task_type=?, priority=?, status=?, assigned_to_email=? WHERE id=?`,
      [
        title            || t.title,
        description      ?? t.description,
        task_type        || t.task_type,
        priority         ?? t.priority,
        newStatus,
        assigned_to_email ?? t.assigned_to_email,
        req.params.id,
      ]
    );
    await auditLog({
      userId: req.user.id, action: 'task.updated', entityType: 'task',
      entityId: parseInt(req.params.id),
      details: { previous_status: t.status, new_status: newStatus },
      ipAddress: req.ip,
    });
    return res.json({ message: 'Task updated' });
  } catch (err) {
    console.error('[TASK] update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** DELETE /api/tasks/:id */
async function remove(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM tasks WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    await pool.execute(`DELETE FROM tasks WHERE id = ?`, [req.params.id]);
    await auditLog({
      userId: req.user.id, action: 'task.deleted', entityType: 'task',
      entityId: parseInt(req.params.id), ipAddress: req.ip,
    });
    return res.json({ message: 'Task deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** PATCH /api/tasks/:id/status — quick status change */
async function updateStatus(req, res) {
  const { status } = req.body;
  const validStatuses = ['pending', 'requested', 'received', 'validated'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
  }

  try {
    const [rows] = await pool.execute(`SELECT status FROM tasks WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });

    await pool.execute(`UPDATE tasks SET status = ? WHERE id = ?`, [status, req.params.id]);
    await auditLog({
      userId: req.user.id, action: 'task.status_changed', entityType: 'task',
      entityId: parseInt(req.params.id),
      details: { from: rows[0].status, to: status },
      ipAddress: req.ip,
    });
    return res.json({ message: 'Task status updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listByChecklist, getOne, create, update, remove, updateStatus };