const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { envolver, exigirLogin, exigirAdmin } = require('../middleware');

// Tudo aqui é exclusivo de administradores
router.use(exigirLogin, exigirAdmin);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/', envolver(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nome, email, papel, ativo, criado_em FROM usuarios ORDER BY nome'
  );
  res.json({ usuarios: rows });
}));

router.post('/', envolver(async (req, res) => {
  const nome = String(req.body.nome || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');
  const papel = req.body.papel === 'admin' ? 'admin' : 'editor';

  const erros = [];
  if (nome.length < 2 || nome.length > 120) erros.push('Nome inválido.');
  if (!EMAIL_REGEX.test(email) || email.length > 255) erros.push('E-mail inválido.');
  if (senha.length < 10 || senha.length > 72) erros.push('A senha deve ter de 10 a 72 caracteres.');
  if (erros.length) return res.status(400).json({ erros });

  const hash = await bcrypt.hash(senha, 12);
  try {
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES ($1, $2, $3, $4) RETURNING id, nome, email, papel, ativo',
      [nome, email, hash, papel]
    );
    res.status(201).json({ usuario: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Já existe um usuário com este e-mail.' });
    throw err;
  }
}));

router.patch('/:id/ativo', envolver(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0 || typeof req.body.ativo !== 'boolean') {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }
  if (id === req.usuario.id) return res.status(400).json({ erro: 'Você não pode desativar a si mesmo.' });
  const { rows } = await pool.query(
    'UPDATE usuarios SET ativo = $1 WHERE id = $2 RETURNING id, nome, email, papel, ativo',
    [req.body.ativo, id]
  );
  if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  res.json({ usuario: rows[0] });
}));

module.exports = router;