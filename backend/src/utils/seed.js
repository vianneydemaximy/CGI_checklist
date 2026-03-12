/**
 * utils/seed.js
 * Creates default consultant and admin users with hashed passwords.
 * Run: node src/utils/seed.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const bcrypt   = require('bcryptjs');
const { pool } = require('../config/db');

const USERS = [
  { role: 'admin',      name: 'Admin',           email: 'admin@cgi.com',  password: 'Admin123!'   },
  { role: 'consultant', name: 'Alice Consultant', email: 'alice@cgi.com',  password: 'Consult123!' },
];

async function seed() {
  console.log('🌱 Seeding users...');
  for (const u of USERS) {
    const hash = await bcrypt.hash(u.password, 10);

    const [roleRows] = await pool.execute(`SELECT id FROM roles WHERE name = ?`, [u.role]);
    if (roleRows.length === 0) {
      console.error(`  ❌ Role "${u.role}" not found in DB — did you run schema.sql first?`);
      continue;
    }
    const roleId = roleRows[0].id;

    const [existing] = await pool.execute(`SELECT id FROM users WHERE email = ?`, [u.email]);
    if (existing.length > 0) {
      await pool.execute(
        `UPDATE users SET password_hash = ?, role_id = ?, name = ? WHERE email = ?`,
        [hash, roleId, u.name, u.email]
      );
      console.log(`  ✏️  Updated: ${u.email}`);
    } else {
      await pool.execute(
        `INSERT INTO users (role_id, name, email, password_hash) VALUES (?, ?, ?, ?)`,
        [roleId, u.name, u.email, hash]
      );
      console.log(`  ✅ Created: ${u.email}  (password: ${u.password})`);
    }
  }

  console.log('\n✅ Seed complete. You can now log in with the credentials above.');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });