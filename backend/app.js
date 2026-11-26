// Card de evento em destaque + estado do botão Entrar/Sair
(function () {
  var API = window.GEAV_API;
  if (!API) return;

  function criar(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto) e.textContent = texto; // textContent: nunca interpreta HTML (evita XSS)
    return e;
  }

  function linha(rotulo, valor) {
    var p = criar('p', 'destaque-info');
    p.appendChild(criar('strong', '', rotulo));
    p.appendChild(document.createTextNode(valor));
    return p;
  }

  function formatarData(valor) {
    var d = new Date(valor);
    if (isNaN(d)) return '';
    return d.toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
  }

  async function carregarDestaque() {
    var secao = document.getElementById('destaque');
    var area = document.getElementById('destaque-conteudo');
    if (!secao || !area) return;
    try {
      var resp = await fetch(API + '/eventos/destaque');
      if (!resp.ok) return;
      var ev = (await resp.json()).evento;
      if (!ev) return; // sem evento em destaque: o card não aparece

      var temImagem = typeof ev.imagem_url === 'string' && ev.imagem_url.indexOf('https://') === 0;
      var card = criar('article', 'destaque-card' + (temImagem ? '' : ' destaque-card--sem-imagem'));

      if (temImagem) {
        var img = criar('img', 'destaque-img');
        img.src = ev.imagem_url;
        img.alt = ev.titulo;
        img.loading = 'lazy';
        card.appendChild(img);
      }

      var corpo = criar('div', 'destaque-corpo');
      corpo.appendChild(criar('p', 'destaque-selo', 'Evento em destaque'));
      corpo.appendChild(criar('h2', 'destaque-titulo', ev.titulo));
      corpo.appendChild(linha('Quando', formatarData(ev.data_inicio)));
      if (ev.local) corpo.appendChild(linha('Local', ev.local));
      if (ev.descricao) corpo.appendChild(criar('p', 'destaque-desc', ev.descricao));
      card.appendChild(corpo);

      area.appendChild(card);
      secao.hidden = false;
    } catch (e) {
      // API fora do ar: o site continua normal, só sem o card
    }
  }

  async function ajustarLogin() {
    var link = document.getElementById('linkEntrar');
    if (!link) return;
    try {
      var resp = await fetch(API + '/auth/me', { credentials: 'include' });
      if (!resp.ok) return; // visitante comum: mantém o botão "Entrar"
      var dados = await resp.json();
      var painel = document.createElement('a');
      painel.href = 'admin.html';
      painel.textContent = 'Painel';
      link.parentNode.insertBefore(painel, link);
      link.textContent = 'Sair';
      link.href = '#';
      link.title = 'Conectado como ' + dados.usuario.nome;
      link.addEventListener('click', async function (e) {
        e.preventDefault();
        try {
          await fetch(API + '/auth/logout', {
            method: 'POST',
            credentials: 'include',
            headers: { 'X-Requested-With': 'geav' },
          });
        } finally {
          window.location.reload();
        }
      });
    } catch (e) {
      // sem API: mantém "Entrar"
    }
  }

  carregarDestaque();
  ajustarLogin();
})();