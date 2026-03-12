/**
 * server.js
 * HTTP server entry point.
 */
require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/db');

const PORT = parseInt(process.env.PORT || '4000', 10);

async function start() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`🚀 Backend running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   AI Service:  ${process.env.AI_SERVICE_URL || 'http://localhost:8000'}`);
  });
}

start();