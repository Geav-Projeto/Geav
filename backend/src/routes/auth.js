const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../db');
const { envolver, exigirLogin, definirCookie, limparCookie } = require('../middleware');

// Hash falso: mantém o tempo de resposta igual quando o e-mail não existe
const HASH_FALSO = bcrypt.hashSync('senha-falsa-do-geav', 12);

const limitador = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10, // 10 tentativas por IP a cada 15 minutos
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
});

router.post('/login', limitador, envolver(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');
  if (!email || !senha || email.length > 255 || senha.length > 200) {
    return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  }

  const { rows } = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);
  const usuario = rows[0];

  if (usuario && usuario.bloqueado_ate && new Date(usuario.bloqueado_ate) > new Date()) {
    await bcrypt.compare(senha, HASH_FALSO);
    return res.status(429).json({ erro: 'Conta temporariamente bloqueada. Tente mais tarde.' });
  }

  const senhaOk = await bcrypt.compare(senha, usuario ? usuario.senha_hash : HASH_FALSO);

  if (!usuario || !usuario.ativo || !senhaOk) {
    if (usuario) {
      // 5 erros seguidos = bloqueio de 15 minutos
      await pool.query(
        `UPDATE usuarios SET
           tentativas_falhas = CASE WHEN tentativas_falhas + 1 >= 5 THEN 0 ELSE tentativas_falhas + 1 END,
           bloqueado_ate = CASE WHEN tentativas_falhas + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE bloqueado_ate END
         WHERE id = $1`,
        [usuario.id]
      );
    }
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }

  await pool.query('UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = $1', [usuario.id]);
  definirCookie(res, usuario);
  res.json({ usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel } });
}));

router.post('/logout', (req, res) => {
  limparCookie(res);
  res.json({ ok: true });
});

router.get('/me', exigirLogin, (req, res) => {
  const { id, nome, email, papel } = req.usuario;
  res.json({ usuario: { id, nome, email, papel } });
});

module.exports = router;