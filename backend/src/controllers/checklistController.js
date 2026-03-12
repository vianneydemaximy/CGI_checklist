/**
 * controllers/checklistController.js
 * Manages checklist creation (manual, template, AI) and retrieval.
 */
const axios     = require('axios');
const { pool }  = require('../config/db');
const { auditLog } = require('../middleware/audit');

/** GET /api/projects/:projectId/checklists */
async function listByProject(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.checklist_id = c.id) AS total_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.checklist_id = c.id AND t.status IN ('received','validated')) AS completed_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.checklist_id = c.id AND t.task_type = 'document' AND t.status IN ('received','validated')) AS received_docs,
        (SELECT COUNT(*) FROM tasks t WHERE t.checklist_id = c.id AND t.task_type = 'access' AND t.status IN ('received','validated')) AS granted_rights
       FROM checklists c WHERE c.project_id = ?`,
      [req.params.projectId]
    );
    return res.json(rows);
  } catch (err) {
    console.error('[CHECKLIST] listByProject error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/checklists/:id */
async function getOne(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*,
        (SELECT COUNT(*) FROM tasks t WHERE t.checklist_id = c.id) AS total_tasks,
        (SELECT COUNT(*) FROM tasks t WHERE t.checklist_id = c.id AND t.status IN ('received','validated')) AS completed_tasks
       FROM checklists c WHERE c.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Checklist not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[CHECKLIST] getOne error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/projects/:projectId/checklists — create from manual or template */
async function create(req, res) {
  const { title, source = 'manual', template_id } = req.body;
  const projectId = req.params.projectId;

  if (!title) return res.status(400).json({ error: 'Checklist title is required' });

  try {
    const [result] = await pool.execute(
      `INSERT INTO checklists (project_id, title, source) VALUES (?, ?, ?)`,
      [projectId, title, source]
    );
    const checklistId = result.insertId;

    // If created from template — clone template items as tasks
    if (source === 'template' && template_id) {
      const [items] = await pool.execute(
        `SELECT * FROM template_items WHERE template_id = ? ORDER BY sort_order`,
        [template_id]
      );
      for (const item of items) {
        await pool.execute(
          `INSERT INTO tasks (checklist_id, title, description, task_type, priority, sort_order)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [checklistId, item.title, item.description, item.task_type, item.priority, item.sort_order]
        );
      }
    }

    await auditLog({ userId: req.user.id, action: 'checklist.created', entityType: 'checklist', entityId: checklistId, details: { source, template_id }, ipAddress: req.ip });
    return res.status(201).json({ id: checklistId, message: 'Checklist created' });
  } catch (err) {
    console.error('[CHECKLIST] create error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/projects/:projectId/checklists/ai-extract
 * Upload PDF → AI service extracts tasks → returns draft (NOT saved until validated).
 * Body: multipart/form-data with field 'rfp' (PDF file)
 */
async function aiExtract(req, res) {
  if (!req.file) return res.status(400).json({ error: 'PDF file is required (field: rfp)' });

  try {
    // Send PDF bytes to AI service as base64
    const pdfBase64 = req.file.buffer.toString('base64');

    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/extract-requirements`,
      { pdf_base64: pdfBase64, filename: req.file.originalname },
      { timeout: 60000 }
    );

    const tasks = aiResponse.data.tasks || [];

    // Return draft — NOT persisted until consultant validates
    await auditLog({ userId: req.user.id, action: 'checklist.ai_draft_generated', entityType: 'project', entityId: parseInt(req.params.projectId), details: { filename: req.file.originalname, task_count: tasks.length }, ipAddress: req.ip });

    return res.json({ tasks, message: 'AI draft generated — review and validate before saving' });
  } catch (err) {
    console.error('[CHECKLIST] aiExtract error:', err.message);
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'AI service unavailable. Make sure it is running on ' + process.env.AI_SERVICE_URL });
    }
    return res.status(500).json({ error: 'AI extraction failed' });
  }
}

/**
 * POST /api/projects/:projectId/checklists/ai-validate
 * Saves a validated AI-generated checklist (human confirmed).
 * Body: { title, tasks: [{title, description, task_type, priority}] }
 */
async function aiValidate(req, res) {
  const { title, tasks = [] } = req.body;
  const projectId = req.params.projectId;

  if (!title) return res.status(400).json({ error: 'Checklist title is required' });

  try {
    const [result] = await pool.execute(
      `INSERT INTO checklists (project_id, title, source, ai_validated) VALUES (?, ?, 'ai', 1)`,
      [projectId, title]
    );
    const checklistId = result.insertId;

    for (let i = 0; i < tasks.length; i++) {
      const t = tasks[i];
      await pool.execute(
        `INSERT INTO tasks (checklist_id, title, description, task_type, priority, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [checklistId, t.title, t.description || null, t.task_type || 'document', t.priority || 5, i]
      );
    }

    await auditLog({ userId: req.user.id, action: 'checklist.ai_validated', entityType: 'checklist', entityId: checklistId, details: { task_count: tasks.length }, ipAddress: req.ip });
    return res.status(201).json({ id: checklistId, message: 'AI checklist validated and saved' });
  } catch (err) {
    console.error('[CHECKLIST] aiValidate error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** PUT /api/checklists/:id */
async function update(req, res) {
  const { title } = req.body;
  try {
    await pool.execute(`UPDATE checklists SET title = ? WHERE id = ?`, [title, req.params.id]);
    await auditLog({ userId: req.user.id, action: 'checklist.updated', entityType: 'checklist', entityId: parseInt(req.params.id), ipAddress: req.ip });
    return res.json({ message: 'Checklist updated' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** DELETE /api/checklists/:id */
async function remove(req, res) {
  try {
    await pool.execute(`DELETE FROM checklists WHERE id = ?`, [req.params.id]);
    await auditLog({ userId: req.user.id, action: 'checklist.deleted', entityType: 'checklist', entityId: parseInt(req.params.id), ipAddress: req.ip });
    return res.json({ message: 'Checklist deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { listByProject, getOne, create, aiExtract, aiValidate, update, remove };