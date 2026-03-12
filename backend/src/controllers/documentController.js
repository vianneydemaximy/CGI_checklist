/**
 * controllers/documentController.js
 * File uploads and versioned document storage.
 * All actions require consultant or admin — no client access.
 * Files are stored as BLOBs in MySQL for V1.
 */
const { pool }     = require('../config/db');
const { auditLog } = require('../middleware/audit');

/** GET /api/tasks/:taskId/documents — list all uploaded versions */
async function listByTask(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT d.id, d.task_id, d.filename, d.mime_type, d.file_size, d.created_at,
              u.name AS uploader_name, u.email AS uploader_email
       FROM documents d
       JOIN users u ON u.id = d.uploaded_by
       WHERE d.task_id = ?
       ORDER BY d.created_at DESC`,
      [req.params.taskId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[DOC] list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/tasks/:taskId/documents — upload file (multipart field: 'file') */
async function upload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'File is required (form field: file)' });

  try {
    const [result] = await pool.execute(
      `INSERT INTO documents (task_id, uploaded_by, filename, mime_type, file_data, file_size)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        req.params.taskId,
        req.user.id,
        req.file.originalname,
        req.file.mimetype,
        req.file.buffer,
        req.file.size,
      ]
    );

    // Auto-advance task status to 'received' if still pending or requested
    await pool.execute(
      `UPDATE tasks SET status = 'received'
       WHERE id = ? AND status IN ('pending', 'requested')`,
      [req.params.taskId]
    );

    await auditLog({
      userId: req.user.id, action: 'document.uploaded', entityType: 'document',
      entityId: result.insertId,
      details: { filename: req.file.originalname, file_size: req.file.size, task_id: req.params.taskId },
      ipAddress: req.ip,
    });

    return res.status(201).json({ id: result.insertId, message: 'Document uploaded successfully' });
  } catch (err) {
    console.error('[DOC] upload error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/documents/:id/download — stream file to browser */
async function download(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT filename, mime_type, file_data FROM documents WHERE id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const doc = rows[0];
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    return res.send(doc.file_data);
  } catch (err) {
    console.error('[DOC] download error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** DELETE /api/documents/:id */
async function remove(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT id FROM documents WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    await pool.execute(`DELETE FROM documents WHERE id = ?`, [req.params.id]);
    await auditLog({
      userId: req.user.id, action: 'document.deleted', entityType: 'document',
      entityId: parseInt(req.params.id), ipAddress: req.ip,
    });
    return res.json({ message: 'Document deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listByTask, upload, download, remove };