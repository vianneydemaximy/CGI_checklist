/**
 * controllers/projectController.js
 * CRUD for consulting projects.
 * All routes require consultant or admin role — no client access.
 */
const { pool }     = require('../config/db');
const { auditLog } = require('../middleware/audit');

/** GET /api/projects — list all projects for the authenticated consultant */
async function list(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, u.name AS client_name
       FROM projects p
       LEFT JOIN users u ON u.id = p.client_id
       WHERE p.consultant_id = ?
       ORDER BY p.created_at DESC`,
      [req.user.id]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[PROJECT] list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/projects/:id */
async function getOne(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*,
              uc.name   AS client_name,   uc.email   AS client_email,
              ucons.name AS consultant_name
       FROM projects p
       LEFT JOIN users uc    ON uc.id    = p.client_id
       LEFT JOIN users ucons ON ucons.id = p.consultant_id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const proj = rows[0];
    // Admins see all projects; consultants only see their own
    if (req.user.role !== 'admin' && proj.consultant_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    return res.json(proj);
  } catch (err) {
    console.error('[PROJECT] getOne error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/projects */
async function create(req, res) {
  const { name, description, client_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });

  try {
    const [result] = await pool.execute(
      `INSERT INTO projects (consultant_id, client_id, name, description) VALUES (?, ?, ?, ?)`,
      [req.user.id, client_id || null, name, description || null]
    );
    const projectId = result.insertId;
    await auditLog({
      userId: req.user.id, action: 'project.created', entityType: 'project',
      entityId: projectId, ipAddress: req.ip,
    });
    return res.status(201).json({ id: projectId, message: 'Project created' });
  } catch (err) {
    console.error('[PROJECT] create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** PUT /api/projects/:id */
async function update(req, res) {
  const { name, description, client_id, status } = req.body;
  try {
    const [rows] = await pool.execute(`SELECT * FROM projects WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    const proj = rows[0];
    if (proj.consultant_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    await pool.execute(
      `UPDATE projects SET name=?, description=?, client_id=?, status=? WHERE id=?`,
      [
        name        || proj.name,
        description ?? proj.description,
        client_id   ?? proj.client_id,
        status      || proj.status,
        req.params.id,
      ]
    );
    await auditLog({
      userId: req.user.id, action: 'project.updated', entityType: 'project',
      entityId: parseInt(req.params.id), details: req.body, ipAddress: req.ip,
    });
    return res.json({ message: 'Project updated' });
  } catch (err) {
    console.error('[PROJECT] update error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** DELETE /api/projects/:id */
async function remove(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM projects WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Project not found' });

    if (rows[0].consultant_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    await pool.execute(`DELETE FROM projects WHERE id = ?`, [req.params.id]);
    await auditLog({
      userId: req.user.id, action: 'project.deleted', entityType: 'project',
      entityId: parseInt(req.params.id), ipAddress: req.ip,
    });
    return res.json({ message: 'Project deleted' });
  } catch (err) {
    console.error('[PROJECT] delete error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { list, getOne, create, update, remove };