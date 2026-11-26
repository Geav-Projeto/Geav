// Painel do GEAV: eventos (editor/admin) e usuários (admin)
(function () {
  var API = window.GEAV_API;
  var usuario = null;
  var eventos = [];
  var editandoId = null;

  function $(id) { return document.getElementById(id); }

  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto) e.textContent = texto; // textContent: nunca interpreta HTML (evita XSS)
    return e;
  }

  function botao(texto, classe, aoClicar) {
    var b = criar('button', 'admin-btn ' + (classe || ''), texto);
    b.type = 'button';
    b.addEventListener('click', aoClicar);
    return b;
  }

  function formatar(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
  }

  function paraCampoData(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function mensagem(el, texto, ok) {
    el.textContent = texto;
    el.className = 'admin-msg' + (ok ? ' admin-msg--ok' : '');
  }

  async function api(caminho, metodo, corpo) {
    var opcoes = { method: metodo || 'GET', credentials: 'include', headers: { 'X-Requested-With': 'geav' } };
    if (corpo !== undefined) {
      opcoes.headers['Content-Type'] = 'application/json';
      opcoes.body = JSON.stringify(corpo);
    }
    var resp = await fetch(API + caminho, opcoes);
    var dados = await resp.json().catch(function () { return {}; });
    if (resp.status === 401) {
      window.location.href = 'login.html';
      throw new Error('Sessão expirada.');
    }
    if (!resp.ok) throw new Error((dados.erros && dados.erros.join(' ')) || dados.erro || 'Erro inesperado.');
    return dados;
  }

  async function acao(fn) {
    try {
      await fn();
      await carregarEventos();
    } catch (e) {
      alert(e.message);
    }
  }

  // ── EVENTOS ─────────────────────────────────────────
  async function carregarEventos() {
    try {
      eventos = (await api('/eventos/admin/lista')).eventos;
      desenharEventos();
    } catch (e) {
      $('listaEventos').textContent = 'Não foi possível carregar os eventos.';
    }
  }

  function desenharEventos() {
    var area = $('listaEventos');
    area.textContent = '';
    if (!eventos.length) {
      area.appendChild(criar('p', 'admin-vazio', 'Nenhum evento cadastrado ainda.'));
      return;
    }
    var ehAdmin = usuario.papel === 'admin';
    eventos.forEach(function (ev) {
      var item = criar('article', 'admin-item');
      var topo = criar('div', 'admin-item-topo');
      topo.appendChild(criar('h3', 'admin-item-titulo', ev.titulo));
      topo.appendChild(criar('span', 'admin-tag admin-tag--' + ev.status, ev.status === 'publicado' ? 'Publicado' : 'Rascunho'));
      if (ev.destaque) topo.appendChild(criar('span', 'admin-tag admin-tag--destaque', 'Em destaque'));
      item.appendChild(topo);

      var info = formatar(ev.data_inicio) + (ev.local ? ' · ' + ev.local : '');
      if (ehAdmin && ev.criado_por_nome) info += ' · por ' + ev.criado_por_nome;
      item.appendChild(criar('p', 'admin-item-info', info));

      var acoes = criar('div', 'admin-acoes');
      if (ehAdmin || ev.status === 'rascunho') {
        acoes.appendChild(botao('Editar', '', function () { editar(ev); }));
      }
      if (ehAdmin) {
        var publicado = ev.status === 'publicado';
        acoes.appendChild(botao(publicado ? 'Despublicar' : 'Publicar', '', function () {
          acao(function () { return api('/eventos/' + ev.id + '/status', 'PATCH', { status: publicado ? 'rascunho' : 'publicado' }); });
        }));
        acoes.appendChild(botao(ev.destaque ? 'Remover destaque' : 'Destacar', '', function () {
          acao(function () { return api('/eventos/' + ev.id + '/destaque', 'PATCH', { destaque: !ev.destaque }); });
        }));
        acoes.appendChild(botao('Excluir', 'admin-btn--perigo', function () {
          if (confirm('Excluir o evento "' + ev.titulo + '"?')) {
            acao(function () { return api('/eventos/' + ev.id, 'DELETE'); });
          }
        }));
      }
      item.appendChild(acoes);
      area.appendChild(item);
    });
  }

  function limparFormulario() {
    $('formEvento').reset();
    editandoId = null;
    $('tituloForm').textContent = 'Novo evento';
    $('btnSalvar').textContent = 'Salvar como rascunho';
    $('btnCancelar').hidden = true;
  }

  function editar(ev) {
    editandoId = ev.id;
    $('ev-titulo').value = ev.titulo || '';
    $('ev-inicio').value = paraCampoData(ev.data_inicio);
    $('ev-fim').value = ev.data_fim ? paraCampoData(ev.data_fim) : '';
    $('ev-local').value = ev.local || '';
    $('ev-imagem').value = ev.imagem_url || '';
    $('ev-desc').value = ev.descricao || '';
    $('tituloForm').textContent = 'Editar evento';
    $('btnSalvar').textContent = 'Salvar alterações';
    $('btnCancelar').hidden = false;
    mensagem($('msgEvento'), '');
    $('formEvento').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  $('btnCancelar').addEventListener('click', limparFormulario);

  $('formEvento').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = $('msgEvento');
    mensagem(msg, '');
    var inicio = $('ev-inicio').value;
    var fim = $('ev-fim').value;
    var corpo = {
      titulo: $('ev-titulo').value,
      descricao: $('ev-desc').value,
      local: $('ev-local').value,
      data_inicio: inicio ? new Date(inicio).toISOString() : null,
      data_fim: fim ? new Date(fim).toISOString() : null,
      imagem_url: $('ev-imagem').value,
    };
    try {
      if (editandoId) await api('/eventos/' + editandoId, 'PUT', corpo);
      else await api('/eventos', 'POST', corpo);
      limparFormulario();
      mensagem(msg, 'Evento salvo com sucesso.', true);
      await carregarEventos();
    } catch (err) {
      mensagem(msg, err.message);
    }
  });

  // ── USUÁRIOS (somente admin) ────────────────────────
  async function carregarUsuarios() {
    var area = $('listaUsuarios');
    try {
      var lista = (await api('/usuarios')).usuarios;
      area.textContent = '';
      lista.forEach(function (u) {
        var item = criar('article', 'admin-item');
        var topo = criar('div', 'admin-item-topo');
        topo.appendChild(criar('h3', 'admin-item-titulo', u.nome));
        topo.appendChild(criar('span', 'admin-tag', u.papel === 'admin' ? 'Administrador' : 'Editor'));
        if (!u.ativo) topo.appendChild(criar('span', 'admin-tag admin-tag--rascunho', 'Desativado'));
        item.appendChild(topo);
        item.appendChild(criar('p', 'admin-item-info', u.email));
        if (u.id !== usuario.id) {
          var acoes = criar('div', 'admin-acoes');
          acoes.appendChild(botao(u.ativo ? 'Desativar' : 'Reativar', u.ativo ? 'admin-btn--perigo' : '', async function () {
            try {
              await api('/usuarios/' + u.id + '/ativo', 'PATCH', { ativo: !u.ativo });
              await carregarUsuarios();
            } catch (err) {
              alert(err.message);
            }
          }));
          item.appendChild(acoes);
        }
        area.appendChild(item);
      });
    } catch (e) {
      area.textContent = 'Não foi possível carregar os usuários.';
    }
  }

  $('formUsuario').addEventListener('submit', async function (e) {
    e.preventDefault();
    var msg = $('msgUsuario');
    mensagem(msg, '');
    try {
      await api('/usuarios', 'POST', {
        nome: $('us-nome').value,
        email: $('us-email').value,
        senha: $('us-senha').value,
        papel: $('us-papel').value,
      });
      $('formUsuario').reset();
      mensagem(msg, 'Usuário cadastrado com sucesso.', true);
      await carregarUsuarios();
    } catch (err) {
      mensagem(msg, err.message);
    }
  });

  // ── INÍCIO ──────────────────────────────────────────
  $('btnSair').addEventListener('click', async function () {
    try { await api('/auth/logout', 'POST', {}); } catch (e) { /* segue para o site */ }
    window.location.href = 'index.html';
  });

  (async function iniciar() {
    try {
      usuario = (await api('/auth/me')).usuario;
    } catch (e) {
      if (e.message !== 'Sessão expirada.') {
        $('listaEventos').textContent = 'Não foi possível conectar ao servidor. Verifique se a API está rodando.';
      }
      return;
    }
    $('quem').textContent = usuario.nome + ' · ' + (usuario.papel === 'admin' ? 'Administrador' : 'Editor');
    if (usuario.papel === 'admin') {
      $('blocoUsuarios').hidden = false;
      carregarUsuarios();
    }
    carregarEventos();
  })();
})();