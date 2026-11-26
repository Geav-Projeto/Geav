require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não definida no .env.');
  process.exit(1);
}

// O Neon "dorme" quando fica sem uso; o timeout maior cobre a primeira consulta.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 15000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('Erro no pool do banco:', err.message));

module.exports = pool;