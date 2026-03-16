/**
 * controllers/documentController.js
 * Gestion des fichiers avec versioning.
 *
 * Endpoints :
 *   GET    /api/tasks/:taskId/documents     — liste toutes les versions
 *   POST   /api/tasks/:taskId/documents     — upload (incrémente la version)
 *   GET    /api/documents/:id/download      — télécharger
 *   DELETE /api/documents/:id              — supprimer une version
 *   POST   /api/documents/:id/replace      — remplacer (version | delete_original)
 */
const { pool }     = require('../config/db');
const { auditLog } = require('../middleware/audit');

/** Récupère le numéro de version max pour une tâche. */
async function getMaxVersion(taskId) {
  const [rows] = await pool.execute(
    `SELECT COALESCE(MAX(version_number), 0) AS max_v FROM documents WHERE task_id = ?`,
    [taskId]
  );
  return rows[0].max_v;
}

/** GET /api/tasks/:taskId/documents */
async function listByTask(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT d.id, d.task_id, d.filename, d.mime_type, d.file_size,
              d.created_at, d.is_current, d.version_number,
              u.name AS uploader_name, u.email AS uploader_email
       FROM documents d
       JOIN users u ON u.id = d.uploaded_by
       WHERE d.task_id = ?
       ORDER BY d.is_current DESC, d.version_number DESC`,
      [req.params.taskId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[DOC] listByTask:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/tasks/:taskId/documents — upload d'un nouveau document */
async function upload(req, res) {
  if (!req.file) return res.status(400).json({ error: 'File required (field: file)' });

  try {
    // Dé-currentiser les versions précédentes
    await pool.execute(
      `UPDATE documents SET is_current = 0 WHERE task_id = ? AND is_current = 1`,
      [req.params.taskId]
    );
    const maxV = await getMaxVersion(req.params.taskId);
    const newV = maxV + 1;

    const [result] = await pool.execute(
      `INSERT INTO documents (task_id, uploaded_by, filename, mime_type, file_data, file_size, is_current, version_number)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [req.params.taskId, req.user.id, req.file.originalname, req.file.mimetype,
       req.file.buffer, req.file.size, newV]
    );

    await pool.execute(
      `UPDATE tasks SET status = 'received' WHERE id = ? AND status IN ('pending','requested')`,
      [req.params.taskId]
    );

    await auditLog({
      userId: req.user.id, action: 'document.uploaded', entityType: 'document',
      entityId: result.insertId,
      details: { filename: req.file.originalname, version: newV, task_id: req.params.taskId },
      ipAddress: req.ip,
    });

    return res.status(201).json({ id: result.insertId, version_number: newV, message: 'Document uploaded' });
  } catch (err) {
    console.error('[DOC] upload:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/documents/:id/replace
 * Body multipart: file + action ('version' | 'delete_original')
 */
async function replace(req, res) {
  if (!req.file) return res.status(400).json({ error: 'File required (field: file)' });

  const action = req.body.action;
  if (!['version', 'delete_original'].includes(action)) {
    return res.status(400).json({ error: 'action must be "version" or "delete_original"' });
  }

  try {
    const [rows] = await pool.execute(`SELECT * FROM documents WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    const old    = rows[0];
    const taskId = old.task_id;

    if (action === 'version') {
      // Conserver l'original en historique
      await pool.execute(`UPDATE documents SET is_current = 0 WHERE id = ?`, [old.id]);
      const newV = (await getMaxVersion(taskId)) + 1;

      const [result] = await pool.execute(
        `INSERT INTO documents (task_id, uploaded_by, filename, mime_type, file_data, file_size, is_current, version_number)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [taskId, req.user.id, req.file.originalname, req.file.mimetype,
         req.file.buffer, req.file.size, newV]
      );

      await auditLog({
        userId: req.user.id, action: 'document.replaced_versioned', entityType: 'document',
        entityId: result.insertId,
        details: { filename: req.file.originalname, version: newV, replaced_id: old.id },
        ipAddress: req.ip,
      });

      return res.status(201).json({ id: result.insertId, version_number: newV, message: `Uploaded as v${newV}. Original kept in history.` });

    } else {
      // Supprimer l'original
      await pool.execute(`DELETE FROM documents WHERE id = ?`, [old.id]);
      const newV = (await getMaxVersion(taskId)) + 1;

      const [result] = await pool.execute(
        `INSERT INTO documents (task_id, uploaded_by, filename, mime_type, file_data, file_size, is_current, version_number)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [taskId, req.user.id, req.file.originalname, req.file.mimetype,
         req.file.buffer, req.file.size, newV]
      );

      await auditLog({
        userId: req.user.id, action: 'document.replaced_deleted', entityType: 'document',
        entityId: result.insertId,
        details: { filename: req.file.originalname, deleted_id: old.id },
        ipAddress: req.ip,
      });

      return res.status(201).json({ id: result.insertId, message: 'Document replaced (original deleted).' });
    }
  } catch (err) {
    console.error('[DOC] replace:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/documents/:id/download */
async function download(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT filename, mime_type, file_data FROM documents WHERE id = ?`, [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });
    const doc = rows[0];
    res.setHeader('Content-Disposition', `attachment; filename="${doc.filename}"`);
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    return res.send(doc.file_data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** DELETE /api/documents/:id — supprimer une version */
async function remove(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT id, task_id, is_current FROM documents WHERE id = ?`, [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Document not found' });

    await pool.execute(`DELETE FROM documents WHERE id = ?`, [req.params.id]);

    // Si on supprime la version courante, promouvoir la suivante
    if (rows[0].is_current) {
      await pool.execute(
        `UPDATE documents SET is_current = 1 WHERE task_id = ? ORDER BY version_number DESC LIMIT 1`,
        [rows[0].task_id]
      );
    }

    await auditLog({
      userId: req.user.id, action: 'document.deleted', entityType: 'document',
      entityId: parseInt(req.params.id), ipAddress: req.ip,
    });
    return res.json({ message: 'Document deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listByTask, upload, replace, download, remove };