/**
 * app.js
 * Express application — middleware, routes, error handler.
 */
require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// ── Security headers ──────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// ── Body parsers ──────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting : 200 req / 15 min / IP ────────────────────
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  message:  { error: 'Too many requests, please try again later.' },
}));

// ── Routes ────────────────────────────────────────────────────
app.use('/api/auth',           require('./routes/auth'));
app.use('/api/projects',       require('./routes/projects'));
app.use('/api/checklists',     require('./routes/checklists'));
app.use('/api/tasks',          require('./routes/tasks'));
app.use('/api/documents',      require('./routes/documents'));
app.use('/api/emails',         require('./routes/emails'));
app.use('/api/templates',      require('./routes/templates'));
app.use('/api/email-templates',require('./routes/emailTemplates'));  // ← V2
app.use('/api/history',        require('./routes/history'));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[APP] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
