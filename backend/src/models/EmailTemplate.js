/**
 * models/EmailTemplate.js
 * Helpers de requêtes pour les templates d'email.
 * Optionnel — voir models/Template.js pour le contexte.
 */
const { pool } = require('../config/db');

const EmailTemplate = {
  async findAccessibleByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT et.*, u.name AS created_by_name
       FROM email_templates et JOIN users u ON u.id = et.created_by
       WHERE et.is_global = 1 OR et.created_by = ?
       ORDER BY et.is_global DESC, et.name ASC`,
      [userId]
    );
    return rows;
  },

  async findById(id, userId) {
    const [rows] = await pool.execute(
      `SELECT * FROM email_templates WHERE id = ? AND (is_global = 1 OR created_by = ?)`,
      [id, userId]
    );
    return rows[0] || null;
  },
};

module.exports = EmailTemplate;