/**
 * controllers/emailController.js
 * Génération (IA ou template), sauvegarde et envoi d'emails.
 *
 * GDPR :
 *  - Aucun pixel de tracking dans les emails.
 *  - Corps de l'email NON stocké dans audit_logs (métadonnées uniquement).
 */
const axios      = require('axios');
const { pool }   = require('../config/db');
const { sendEmail } = require('../config/email');
const { auditLog }  = require('../middleware/audit');

/**
 * POST /api/projects/:projectId/emails/generate
 * Génère un brouillon via l'IA. Ne pas envoyer — retourner pour validation.
 * Body: { task_ids, recipient_email, recipient_name }
 */
async function generateDraft(req, res) {
  const { task_ids, recipient_email, recipient_name } = req.body;
  if (!task_ids?.length || !recipient_email) {
    return res.status(400).json({ error: 'task_ids (array) et recipient_email sont requis' });
  }

  try {
    const placeholders = task_ids.map(() => '?').join(',');
    const [tasks] = await pool.execute(
      `SELECT id, title, description, task_type FROM tasks WHERE id IN (${placeholders})`,
      task_ids
    );
    if (tasks.length === 0) return res.status(404).json({ error: 'No tasks found' });

    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/generate-email`,
      { tasks, recipient_name: recipient_name || 'Client', project_id: req.params.projectId },
      { timeout: 30000 }
    );

    const { subject, body } = aiResponse.data;

    const [result] = await pool.execute(
      `INSERT INTO emails (project_id, sent_by, recipient, subject, body, status, task_ids)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
      [req.params.projectId, req.user.id, recipient_email, subject, body, JSON.stringify(task_ids)]
    );

    await auditLog({
      userId: req.user.id, action: 'email.draft_generated', entityType: 'email',
      entityId: result.insertId,
      details: { recipient: recipient_email, task_count: task_ids.length, source: 'ai' },
      ipAddress: req.ip,
    });

    return res.json({ id: result.insertId, subject, body, recipient: recipient_email });
  } catch (err) {
    console.error('[EMAIL] generateDraft error:', err.message);
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'AI service unavailable — is it running on ' + process.env.AI_SERVICE_URL + '?' });
    }
    return res.status(500).json({ error: 'Email generation failed: ' + err.message });
  }
}

/**
 * POST /api/projects/:projectId/emails/draft
 * Sauvegarde un brouillon construit manuellement (depuis un template email).
 * Ne génère PAS d'IA. Ne PAS envoyer — retourner pour validation.
 * Body: { recipient_email, subject, body, task_ids }
 */
async function saveDraft(req, res) {
  const { recipient_email, subject, body, task_ids = [] } = req.body;
  if (!recipient_email || !subject || !body) {
    return res.status(400).json({ error: 'recipient_email, subject et body sont requis' });
  }

  try {
    const [result] = await pool.execute(
      `INSERT INTO emails (project_id, sent_by, recipient, subject, body, status, task_ids)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
      [req.params.projectId, req.user.id, recipient_email, subject, body, JSON.stringify(task_ids)]
    );

    await auditLog({
      userId: req.user.id, action: 'email.draft_saved', entityType: 'email',
      entityId: result.insertId,
      details: { recipient: recipient_email, task_count: task_ids.length, source: 'template' },
      ipAddress: req.ip,
    });

    return res.status(201).json({ id: result.insertId, message: 'Draft saved' });
  } catch (err) {
    console.error('[EMAIL] saveDraft error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/emails/:id/send
 * Envoi réel après validation humaine explicite.
 * Accepte { subject, body } pour permettre une dernière modification.
 */
async function sendDraft(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM emails WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Email not found' });

    const email = rows[0];
    if (email.status === 'sent') return res.status(400).json({ error: 'Email already sent' });

    const finalSubject = req.body.subject || email.subject;
    const finalBody    = req.body.body    || email.body;

    await sendEmail({ to: email.recipient, subject: finalSubject, text: finalBody });

    await pool.execute(
      `UPDATE emails SET status = 'sent', sent_at = NOW(), subject = ?, body = ? WHERE id = ?`,
      [finalSubject, finalBody, req.params.id]
    );

    // Passage des tâches couvertes en statut 'requested'
    const taskIds = email.task_ids ? JSON.parse(email.task_ids) : [];
    if (taskIds.length) {
      const ph = taskIds.map(() => '?').join(',');
      await pool.execute(
        `UPDATE tasks SET status = 'requested' WHERE id IN (${ph}) AND status = 'pending'`,
        taskIds
      );
    }

    await auditLog({
      userId: req.user.id, action: 'email.sent', entityType: 'email',
      entityId: parseInt(req.params.id),
      details: { recipient: email.recipient, task_count: taskIds.length },
      ipAddress: req.ip,
    });

    return res.json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('[EMAIL] sendDraft error:', err);
    await pool.execute(`UPDATE emails SET status = 'failed' WHERE id = ?`, [req.params.id]).catch(() => {});
    return res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
}

/** GET /api/projects/:projectId/emails */
async function listByProject(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT e.id, e.recipient, e.subject, e.status, e.sent_at, e.created_at,
              u.name AS sent_by_name, e.task_ids
       FROM emails e JOIN users u ON u.id = e.sent_by
       WHERE e.project_id = ?
       ORDER BY e.created_at DESC`,
      [req.params.projectId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/emails/:id */
async function getOne(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM emails WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Email not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { generateDraft, saveDraft, sendDraft, listByProject, getOne };