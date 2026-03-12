/**
 * controllers/templateController.js
 * CRUD for checklist templates.
 */
const { pool }     = require('../config/db');
const { auditLog } = require('../middleware/audit');

/** GET /api/templates */
async function list(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT t.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM template_items ti WHERE ti.template_id = t.id) AS item_count
       FROM templates t JOIN users u ON u.id = t.created_by ORDER BY t.name`
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/templates/:id — with items */
async function getOne(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM templates WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const [items] = await pool.execute(
      `SELECT * FROM template_items WHERE template_id = ? ORDER BY sort_order`,
      [req.params.id]
    );
    return res.json({ ...rows[0], items });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/templates — consultant/admin only */
async function create(req, res) {
  const { name, description, items = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Template name is required' });

  try {
    const [result] = await pool.execute(
      `INSERT INTO templates (name, description, created_by) VALUES (?, ?, ?)`,
      [name, description || null, req.user.id]
    );
    const templateId = result.insertId;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await pool.execute(
        `INSERT INTO template_items (template_id, title, description, task_type, priority, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [templateId, item.title, item.description || null, item.task_type || 'document', item.priority || 5, i]
      );
    }

    await auditLog({ userId: req.user.id, action: 'template.created', entityType: 'template', entityId: templateId, ipAddress: req.ip });
    return res.status(201).json({ id: templateId, message: 'Template created' });
  } catch (err) {
    console.error('[TEMPLATE] create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { list, getOne, create };