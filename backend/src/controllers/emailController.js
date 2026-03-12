/**
 * controllers/emailController.js
 * Email generation (via AI service) and real SMTP sending.
 *
 * GDPR compliance:
 *  - No tracking pixels included in emails.
 *  - Email body content is NOT stored in audit_logs (only metadata).
 *  - Recipient consent is the consultant's responsibility.
 */
const axios      = require('axios');
const { pool }   = require('../config/db');
const { sendEmail } = require('../config/email');
const { auditLog }  = require('../middleware/audit');

/**
 * POST /api/projects/:projectId/emails/generate
 * Body: { task_ids: [1,2,3], recipient_email, recipient_name }
 * Calls AI service to generate a professional email draft.
 * Does NOT send — returns draft for human review.
 */
async function generateDraft(req, res) {
  const { task_ids, recipient_email, recipient_name } = req.body;
  if (!task_ids?.length || !recipient_email) {
    return res.status(400).json({ error: 'task_ids (array) and recipient_email are required' });
  }

  try {
    // Fetch task details for the AI
    const placeholders = task_ids.map(() => '?').join(',');
    const [tasks] = await pool.execute(
      `SELECT id, title, description, task_type FROM tasks WHERE id IN (${placeholders})`,
      task_ids
    );

    if (tasks.length === 0) return res.status(404).json({ error: 'No tasks found for given IDs' });

    // Call AI service for professional email generation
    const aiResponse = await axios.post(
      `${process.env.AI_SERVICE_URL}/generate-email`,
      { tasks, recipient_name: recipient_name || 'Client', project_id: req.params.projectId },
      { timeout: 30000 }
    );

    const { subject, body } = aiResponse.data;

    // Save as draft in DB
    const [result] = await pool.execute(
      `INSERT INTO emails (project_id, sent_by, recipient, subject, body, status, task_ids)
       VALUES (?, ?, ?, ?, ?, 'draft', ?)`,
      [req.params.projectId, req.user.id, recipient_email, subject, body, JSON.stringify(task_ids)]
    );

    await auditLog({
      userId: req.user.id, action: 'email.draft_generated', entityType: 'email', entityId: result.insertId,
      details: { recipient: recipient_email, task_count: task_ids.length }, ipAddress: req.ip,
    });

    return res.json({ id: result.insertId, subject, body, recipient: recipient_email, message: 'Draft generated — review before sending' });
  } catch (err) {
    console.error('[EMAIL] generateDraft error:', err.message);
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({ error: 'AI service unavailable' });
    }
    return res.status(500).json({ error: 'Email generation failed' });
  }
}

/**
 * POST /api/emails/:id/send
 * Human validation step — consultant explicitly triggers send.
 * Optionally accepts { subject, body } to send a modified draft.
 */
async function sendDraft(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM emails WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Email not found' });

    const email = rows[0];
    if (email.status === 'sent') return res.status(400).json({ error: 'Email already sent' });

    // Allow consultant to edit before sending
    const finalSubject = req.body.subject || email.subject;
    const finalBody    = req.body.body    || email.body;

    await sendEmail({ to: email.recipient, subject: finalSubject, text: finalBody });

    await pool.execute(
      `UPDATE emails SET status = 'sent', sent_at = NOW(), subject = ?, body = ? WHERE id = ?`,
      [finalSubject, finalBody, req.params.id]
    );

    // Mark covered tasks as 'requested'
    const taskIds = email.task_ids ? JSON.parse(email.task_ids) : [];
    if (taskIds.length) {
      const ph = taskIds.map(() => '?').join(',');
      await pool.execute(
        `UPDATE tasks SET status = 'requested' WHERE id IN (${ph}) AND status = 'pending'`,
        taskIds
      );
    }

    await auditLog({
      userId: req.user.id, action: 'email.sent', entityType: 'email', entityId: parseInt(req.params.id),
      details: { recipient: email.recipient, task_count: taskIds.length },  // NOT logging body — GDPR
      ipAddress: req.ip,
    });

    return res.json({ message: 'Email sent successfully' });
  } catch (err) {
    console.error('[EMAIL] sendDraft error:', err);
    // Mark as failed in DB
    await pool.execute(`UPDATE emails SET status = 'failed' WHERE id = ?`, [req.params.id]);
    return res.status(500).json({ error: 'Failed to send email: ' + err.message });
  }
}

/** GET /api/projects/:projectId/emails — list emails for project */
async function listByProject(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT e.id, e.recipient, e.subject, e.status, e.sent_at, e.created_at,
              u.name AS sent_by_name, e.task_ids
       FROM emails e JOIN users u ON u.id = e.sent_by
       WHERE e.project_id = ? ORDER BY e.created_at DESC`,
      [req.params.projectId]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/emails/:id — get single email draft */
async function getOne(req, res) {
  try {
    const [rows] = await pool.execute(`SELECT * FROM emails WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Email not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { generateDraft, sendDraft, listByProject, getOne };