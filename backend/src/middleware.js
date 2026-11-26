const jwt = require('jsonwebtoken');
const pool = require('./db');

const COOKIE = 'geav_token';
const OITO_HORAS = 8 * 60 * 60 * 1000;

// Repassa erros de funções async para o tratador de erros do Express
const envolver = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function opcoesCookie() {
  return {
    httpOnly: true,                                   // JavaScript do site não lê o cookie
    secure: process.env.NODE_ENV === 'production',    // só HTTPS em produção
    sameSite: 'lax',
    path: '/',
  };
}

function assinarToken(usuario) {
  return jwt.sign({ sub: usuario.id, papel: usuario.papel }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '8h',
  });
}

function definirCookie(res, usuario) {
  res.cookie(COOKIE, assinarToken(usuario), { ...opcoesCookie(), maxAge: OITO_HORAS });
}

function limparCookie(res) {
  res.clearCookie(COOKIE, opcoesCookie());
}

// Exige login válido e confere no banco se o usuário continua ativo
const exigirLogin = envolver(async (req, res, next) => {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ erro: 'Não autenticado.' });
  let dados;
  try {
    dados = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
  }
  const { rows } = await pool.query(
    'SELECT id, nome, email, papel, ativo FROM usuarios WHERE id = $1',
    [dados.sub]
  );
  const usuario = rows[0];
  if (!usuario || !usuario.ativo) return res.status(401).json({ erro: 'Sessão inválida.' });
  req.usuario = usuario;
  next();
});

function exigirAdmin(req, res, next) {
  if (!req.usuario || req.usuario.papel !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
  }
  next();
}

// Defesa contra CSRF: cabeçalho customizado força o navegador a pedir permissão (CORS)
function protegerCsrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'geav') {
    return res.status(403).json({ erro: 'Requisição bloqueada.' });
  }
  next();
}

module.exports = { envolver, exigirLogin, exigirAdmin, protegerCsrf, definirCookie, limparCookie };