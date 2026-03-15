/**
 * controllers/templateController.js
 * CRUD pour les templates de checklist ET les templates d'email.
 *
 * Visibilité :
 *   is_global = 1 → visible par tous (créé/modifiable par admin uniquement)
 *   is_global = 0 → visible uniquement par le créateur
 */
const { pool }     = require('../config/db');
const { auditLog } = require('../middleware/audit');

// ══════════════════════════════════════════════════════════════
// CHECKLIST TEMPLATES
// ══════════════════════════════════════════════════════════════

/** GET /api/templates — liste les templates accessibles */
async function list(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT t.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM template_items ti WHERE ti.template_id = t.id) AS item_count
       FROM templates t
       JOIN users u ON u.id = t.created_by
       WHERE t.is_global = 1 OR t.created_by = ?
       ORDER BY t.is_global DESC, t.name ASC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[TEMPLATE] list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/templates/:id — template avec ses items */
async function getOne(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT t.*, u.name AS created_by_name
       FROM templates t JOIN users u ON u.id = t.created_by
       WHERE t.id = ? AND (t.is_global = 1 OR t.created_by = ?)`,
      [req.params.id, req.user.id]
    );
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

/** POST /api/templates */
async function create(req, res) {
  const { name, description, items = [], is_global = false } = req.body;
  if (!name) return res.status(400).json({ error: 'Template name is required' });

  // Seul un admin peut créer un template global
  const globalFlag = (is_global && req.user.role === 'admin') ? 1 : 0;

  try {
    const [result] = await pool.execute(
      `INSERT INTO templates (name, description, created_by, is_global) VALUES (?, ?, ?, ?)`,
      [name, description || null, req.user.id, globalFlag]
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

/** PUT /api/templates/:id */
async function update(req, res) {
  const { name, description, items, is_global } = req.body;
  try {
    const [rows] = await pool.execute(`SELECT * FROM templates WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const tmpl = rows[0];
    // Seul le créateur ou un admin peut modifier
    if (tmpl.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied — you can only edit your own templates' });
    }
    const globalFlag = (is_global !== undefined && req.user.role === 'admin')
      ? (is_global ? 1 : 0)
      : tmpl.is_global;

    await pool.execute(
      `UPDATE templates SET name=?, description=?, is_global=? WHERE id=?`,
      [name || tmpl.name, description ?? tmpl.description, globalFlag, req.params.id]
    );

    // Remplace les items si fournis
    if (Array.isArray(items)) {
      await pool.execute(`DELETE FROM template_items WHERE template_id = ?`, [req.params.id]);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        await pool.execute(
          `INSERT INTO template_items (template_id, title, description, task_type, priority, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [req.params.id, item.title, item.description || null, item.task_type || 'document', item.priority || 5, i]
        );
      }
    }

    await auditLog({ userId: req.user.id, action: 'template.updated', entityType: 'template', entityId: parseInt(req.params.id), ipAddress: req.ip });
    return res.json({ message: 'Template updated' });
  } catch (err) {
    console.error('[TEMPLATE] update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** DELETE /api/templates/:id */
async function remove(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM templates WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    if (rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    await pool.execute(`DELETE FROM templates WHERE id = ?`, [req.params.id]);
    await auditLog({ userId: req.user.id, action: 'template.deleted', entityType: 'template', entityId: parseInt(req.params.id), ipAddress: req.ip });
    return res.json({ message: 'Template deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ══════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ══════════════════════════════════════════════════════════════

/** GET /api/email-templates */
async function listEmail(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT et.*, u.name AS created_by_name
       FROM email_templates et
       JOIN users u ON u.id = et.created_by
       WHERE et.is_global = 1 OR et.created_by = ?
       ORDER BY et.is_global DESC, et.name ASC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[EMAIL_TEMPLATE] list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/email-templates/:id */
async function getOneEmail(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM email_templates WHERE id = ? AND (is_global = 1 OR created_by = ?)`,
      [req.params.id, req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Email template not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/email-templates */
async function createEmail(req, res) {
  const { name, description, subject, body, is_global = false } = req.body;
  if (!name || !subject || !body) {
    return res.status(400).json({ error: 'name, subject and body are required' });
  }
  const globalFlag = (is_global && req.user.role === 'admin') ? 1 : 0;

  try {
    const [result] = await pool.execute(
      `INSERT INTO email_templates (name, description, subject, body, is_global, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, description || null, subject, body, globalFlag, req.user.id]
    );
    await auditLog({ userId: req.user.id, action: 'email_template.created', entityType: 'email_template', entityId: result.insertId, ipAddress: req.ip });
    return res.status(201).json({ id: result.insertId, message: 'Email template created' });
  } catch (err) {
    console.error('[EMAIL_TEMPLATE] create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** PUT /api/email-templates/:id */
async function updateEmail(req, res) {
  const { name, description, subject, body, is_global } = req.body;
  try {
    const [rows] = await pool.execute(`SELECT * FROM email_templates WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Email template not found' });

    const et = rows[0];
    if (et.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const globalFlag = (is_global !== undefined && req.user.role === 'admin')
      ? (is_global ? 1 : 0) : et.is_global;

    await pool.execute(
      `UPDATE email_templates SET name=?, description=?, subject=?, body=?, is_global=? WHERE id=?`,
      [name || et.name, description ?? et.description, subject || et.subject, body || et.body, globalFlag, req.params.id]
    );
    await auditLog({ userId: req.user.id, action: 'email_template.updated', entityType: 'email_template', entityId: parseInt(req.params.id), ipAddress: req.ip });
    return res.json({ message: 'Email template updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** DELETE /api/email-templates/:id */
async function removeEmail(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM email_templates WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Email template not found' });

    if (rows[0].created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    await pool.execute(`DELETE FROM email_templates WHERE id = ?`, [req.params.id]);
    await auditLog({ userId: req.user.id, action: 'email_template.deleted', entityType: 'email_template', entityId: parseInt(req.params.id), ipAddress: req.ip });
    return res.json({ message: 'Email template deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  list, getOne, create, update, remove,
  listEmail, getOneEmail, createEmail, updateEmail, removeEmail,
};