/**
 * controllers/authController.js
 */
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const { pool }     = require('../config/db');
const { auditLog } = require('../middleware/audit');

async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    const [rows] = await pool.execute(
      `SELECT u.*, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id
       WHERE u.email = ? AND u.is_active = 1`,
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)  return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { id: user.id, email: user.email, role: user.role, name: user.name };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

    await auditLog({ userId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id, ipAddress: req.ip });
    return res.json({ token, user: payload });
  } catch (err) {
    console.error('[AUTH] login error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function me(req, res) {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, r.name AS role FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { login, me };