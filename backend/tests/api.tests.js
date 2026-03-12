/**
 * tests/api.test.js
 * Integration tests for auth and project endpoints.
 * Uses supertest — does NOT require a real DB (mocked below).
 *
 * Run: npm test
 */
const request  = require('supertest');
const app      = require('../src/app');

// ── Mock DB pool so tests don't need MySQL ────────────────────
jest.mock('../src/config/db', () => ({
  pool: {
    execute: jest.fn(),
    getConnection: jest.fn(() => ({ release: jest.fn() })),
  },
  testConnection: jest.fn(),
}));

const { pool } = require('../src/config/db');

// ── Mock bcryptjs ─────────────────────────────────────────────
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash:    jest.fn(() => '$2b$10$hashedpassword'),
}));
const bcrypt = require('bcryptjs');

// ── Mock email sender ─────────────────────────────────────────
jest.mock('../src/config/email', () => ({ sendEmail: jest.fn() }));

// ── Helpers ───────────────────────────────────────────────────
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test_secret_key';

function makeToken(role = 'consultant') {
  return jwt.sign({ id: 1, email: 'test@cgi.com', role, name: 'Test User' }, process.env.JWT_SECRET);
}

// ─────────────────────────────────────────────────────────────
describe('Health check', () => {
  it('GET /health → 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Auth — POST /api/auth/login', () => {
  it('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.statusCode).toBe(400);
  });

  it('returns 401 for unknown user', async () => {
    pool.execute.mockResolvedValueOnce([[]]);   // no user found
    const res = await request(app).post('/api/auth/login').send({ email: 'x@x.com', password: 'pass' });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for wrong password', async () => {
    pool.execute.mockResolvedValueOnce([[{ id: 1, email: 'a@a.com', password_hash: 'hash', role: 'consultant', name: 'A', is_active: 1 }]]);
    bcrypt.compare.mockResolvedValueOnce(false);
    const res = await request(app).post('/api/auth/login').send({ email: 'a@a.com', password: 'wrong' });
    expect(res.statusCode).toBe(401);
  });

  it('returns JWT token on success', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 1, email: 'a@a.com', password_hash: 'hash', role: 'consultant', name: 'Alice', is_active: 1 }]])
      .mockResolvedValueOnce([{ insertId: 1 }]);   // audit log insert
    bcrypt.compare.mockResolvedValueOnce(true);

    const res = await request(app).post('/api/auth/login').send({ email: 'a@a.com', password: 'correct' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.role).toBe('consultant');
  });
});

// ─────────────────────────────────────────────────────────────
describe('Projects — GET /api/projects', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.statusCode).toBe(401);
  });

  it('returns project list for authenticated consultant', async () => {
    pool.execute.mockResolvedValueOnce([[
      { id: 1, name: 'Project Alpha', status: 'active', consultant_id: 1 }
    ]]);
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${makeToken('consultant')}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Projects — POST /api/projects', () => {
  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({});
    expect(res.statusCode).toBe(400);
  });

  it('creates a project successfully', async () => {
    pool.execute
      .mockResolvedValueOnce([{ insertId: 42 }])   // INSERT
      .mockResolvedValueOnce([{}]);                 // audit log
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ name: 'New Mission', description: 'Test' });
    expect(res.statusCode).toBe(201);
    expect(res.body.id).toBe(42);
  });
});

// ─────────────────────────────────────────────────────────────
describe('Role guard — client cannot create projects', () => {
  it('returns 403', async () => {
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${makeToken('client')}`)
      .send({ name: 'Should fail' });
    expect(res.statusCode).toBe(403);
  });
});