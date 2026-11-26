require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pool = require('./src/db');
const { protegerCsrf } = require('./src/middleware');

// ── Verificações de segurança na inicialização ──────────
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET ausente ou curto demais (mínimo 32 caracteres). Confira o .env.');
  process.exit(1);
}
if (!process.env.FRONTEND_URL) {
  console.error('FRONTEND_URL não definida no .env.');
  process.exit(1);
}

const app = express();
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL.split(',').map((o) => o.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-Requested-With'],
}));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

app.get('/api/saude', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, banco: true });
  } catch {
    res.status(503).json({ ok: false, banco: false });
  }
});

// Toda requisição que altera dados precisa do cabeçalho X-Requested-With: geav
app.use('/api', protegerCsrf);

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/eventos', require('./src/routes/eventos'));
app.use('/api/usuarios', require('./src/routes/usuarios'));

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erro: 'JSON inválido.' });
  console.error('Erro:', err.message); // detalhes só no log do servidor
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

const porta = process.env.PORT || 3000;
app.listen(porta, () => console.log('API GEAV rodando em http://127.0.0.1:' + porta));