/**
 * models/Template.js
 * Helpers de requêtes pour les templates de checklist.
 *
 * Ce fichier est OPTIONNEL — les controllers fonctionnent sans lui.
 * Son rôle est de centraliser les requêtes SQL répétées pour faciliter
 * la maintenance et les tests unitaires futurs.
 *
 * Usage dans un controller :
 *   const Template = require('../models/Template');
 *   const templates = await Template.findAccessibleByUser(userId);
 */
const { pool } = require('../config/db');

const Template = {
  /** Retourne tous les templates visibles par un utilisateur */
  async findAccessibleByUser(userId) {
    const [rows] = await pool.execute(
      `SELECT t.*, u.name AS created_by_name,
        (SELECT COUNT(*) FROM template_items ti WHERE ti.template_id = t.id) AS item_count
       FROM templates t JOIN users u ON u.id = t.created_by
       WHERE t.is_global = 1 OR t.created_by = ?
       ORDER BY t.is_global DESC, t.name ASC`,
      [userId]
    );
    return rows;
  },

  /** Retourne un template avec ses items */
  async findByIdWithItems(id, userId) {
    const [rows] = await pool.execute(
      `SELECT * FROM templates WHERE id = ? AND (is_global = 1 OR created_by = ?)`,
      [id, userId]
    );
    if (rows.length === 0) return null;

    const [items] = await pool.execute(
      `SELECT * FROM template_items WHERE template_id = ? ORDER BY sort_order`,
      [id]
    );
    return { ...rows[0], items };
  },

  /** Crée un template et ses items en une transaction */
  async create({ name, description, createdBy, isGlobal, items = [] }) {
    const [result] = await pool.execute(
      `INSERT INTO templates (name, description, created_by, is_global) VALUES (?, ?, ?, ?)`,
      [name, description || null, createdBy, isGlobal ? 1 : 0]
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
    return templateId;
  },
};

module.exports = Template;