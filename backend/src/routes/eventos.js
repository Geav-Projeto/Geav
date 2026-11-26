const router = require('express').Router();
const pool = require('../db');
const { envolver, exigirLogin, exigirAdmin } = require('../middleware');

const CAMPOS_PUBLICOS = 'id, titulo, descricao, local, data_inicio, data_fim, imagem_url';

function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function validarEvento(b) {
  const erros = [];
  const titulo = String(b.titulo || '').trim();
  const descricao = b.descricao ? String(b.descricao).trim() : null;
  const local = b.local ? String(b.local).trim() : null;
  const inicio = b.data_inicio ? new Date(b.data_inicio) : null;
  const fim = b.data_fim ? new Date(b.data_fim) : null;
  const imagem = b.imagem_url ? String(b.imagem_url).trim() : null;

  if (titulo.length < 3 || titulo.length > 150) erros.push('O título deve ter de 3 a 150 caracteres.');
  if (descricao && descricao.length > 5000) erros.push('A descrição deve ter até 5000 caracteres.');
  if (local && local.length > 200) erros.push('O local deve ter até 200 caracteres.');
  if (!inicio || isNaN(inicio)) erros.push('Informe uma data de início válida.');
  if (fim && (isNaN(fim) || (inicio && fim < inicio))) erros.push('A data de término é inválida.');
  if (imagem) {
    try {
      const url = new URL(imagem);
      if (url.protocol !== 'https:' || imagem.length > 500) throw new Error();
    } catch {
      erros.push('A imagem deve ser um link https válido.');
    }
  }
  return { erros, dados: { titulo, descricao, local, data_inicio: inicio, data_fim: fim, imagem_url: imagem } };
}

// ── PÚBLICO ─────────────────────────────────────────────
// Card em destaque: só existe se publicado, marcado como destaque e ainda não terminou
router.get('/destaque', envolver(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS_PUBLICOS} FROM eventos
     WHERE status = 'publicado' AND destaque = TRUE
       AND COALESCE(data_fim, data_inicio) >= NOW()
     LIMIT 1`
  );
  res.json({ evento: rows[0] || null });
}));

// Próximos eventos publicados
router.get('/', envolver(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${CAMPOS_PUBLICOS} FROM eventos
     WHERE status = 'publicado' AND COALESCE(data_fim, data_inicio) >= NOW()
     ORDER BY data_inicio ASC LIMIT 50`
  );
  res.json({ eventos: rows });
}));

// ── PAINEL (login) ──────────────────────────────────────
// Admin vê tudo; editor vê só os próprios
router.get('/admin/lista', exigirLogin, envolver(async (req, res) => {
  const base = `SELECT e.*, u.nome AS criado_por_nome FROM eventos e
                LEFT JOIN usuarios u ON u.id = e.criado_por`;
  const consulta = req.usuario.papel === 'admin'
    ? await pool.query(base + ' ORDER BY e.data_inicio DESC')
    : await pool.query(base + ' WHERE e.criado_por = $1 ORDER BY e.data_inicio DESC', [req.usuario.id]);
  res.json({ eventos: consulta.rows });
}));

// Criar: sempre nasce como rascunho
router.post('/', exigirLogin, envolver(async (req, res) => {
  const { erros, dados } = validarEvento(req.body);
  if (erros.length) return res.status(400).json({ erros });
  const { rows } = await pool.query(
    `INSERT INTO eventos (titulo, descricao, local, data_inicio, data_fim, imagem_url, criado_por)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [dados.titulo, dados.descricao, dados.local, dados.data_inicio, dados.data_fim, dados.imagem_url, req.usuario.id]
  );
  res.status(201).json({ evento: rows[0] });
}));

// Editar: admin edita qualquer um; editor só os próprios rascunhos
router.put('/:id', exigirLogin, envolver(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido.' });
  const atual = (await pool.query('SELECT * FROM eventos WHERE id = $1', [id])).rows[0];
  if (!atual) return res.status(404).json({ erro: 'Evento não encontrado.' });

  const ehAdmin = req.usuario.papel === 'admin';
  const ehDono = atual.criado_por === req.usuario.id;
  if (!ehAdmin && !(ehDono && atual.status === 'rascunho')) {
    return res.status(403).json({ erro: 'Você não pode editar este evento.' });
  }

  const { erros, dados } = validarEvento(req.body);
  if (erros.length) return res.status(400).json({ erros });
  const { rows } = await pool.query(
    `UPDATE eventos SET titulo=$1, descricao=$2, local=$3, data_inicio=$4, data_fim=$5, imagem_url=$6
     WHERE id=$7 RETURNING *`,
    [dados.titulo, dados.descricao, dados.local, dados.data_inicio, dados.data_fim, dados.imagem_url, id]
  );
  res.json({ evento: rows[0] });
}));

// Publicar / despublicar (somente admin)
router.patch('/:id/status', exigirLogin, exigirAdmin, envolver(async (req, res) => {
  const id = idValido(req.params.id);
  const status = req.body.status;
  if (!id || !['rascunho', 'publicado'].includes(status)) {
    return res.status(400).json({ erro: 'Dados inválidos.' });
  }
  // Ao voltar para rascunho, o evento perde o destaque
  const { rows } = await pool.query(
    `UPDATE eventos SET status = $1, destaque = CASE WHEN $1 = 'rascunho' THEN FALSE ELSE destaque END
     WHERE id = $2 RETURNING *`,
    [status, id]
  );
  if (!rows[0]) return res.status(404).json({ erro: 'Evento não encontrado.' });
  res.json({ evento: rows[0] });
}));

// Definir destaque (somente admin); apenas um evento por vez
router.patch('/:id/destaque', exigirLogin, exigirAdmin, envolver(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id || typeof req.body.destaque !== 'boolean') return res.status(400).json({ erro: 'Dados inválidos.' });

  const evento = (await pool.query('SELECT * FROM eventos WHERE id = $1', [id])).rows[0];
  if (!evento) return res.status(404).json({ erro: 'Evento não encontrado.' });

  if (req.body.destaque) {
    if (evento.status !== 'publicado') {
      return res.status(400).json({ erro: 'Publique o evento antes de colocá-lo em destaque.' });
    }
    if (new Date(evento.data_fim || evento.data_inicio) < new Date()) {
      return res.status(400).json({ erro: 'Este evento já terminou.' });
    }
  }

  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    if (req.body.destaque) await cliente.query('UPDATE eventos SET destaque = FALSE WHERE destaque = TRUE');
    const { rows } = await cliente.query('UPDATE eventos SET destaque = $1 WHERE id = $2 RETURNING *', [req.body.destaque, id]);
    await cliente.query('COMMIT');
    res.json({ evento: rows[0] });
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}));

// Excluir (somente admin)
router.delete('/:id', exigirLogin, exigirAdmin, envolver(async (req, res) => {
  const id = idValido(req.params.id);
  if (!id) return res.status(400).json({ erro: 'ID inválido.' });
  const { rowCount } = await pool.query('DELETE FROM eventos WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ erro: 'Evento não encontrado.' });
  res.json({ ok: true });
}));

module.exports = router;