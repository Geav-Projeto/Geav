(function () {
  var form = document.getElementById('formLogin');
  var erro = document.getElementById('erro');
  var botao = document.getElementById('botao');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    erro.textContent = '';
    var email = document.getElementById('email').value.trim();
    var senha = document.getElementById('senha').value;
    if (!email || !senha) {
      erro.textContent = 'Informe e-mail e senha.';
      return;
    }

    botao.disabled = true;
    botao.textContent = 'Entrando...';
    try {
      var resp = await fetch(window.GEAV_API + '/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'geav' },
        body: JSON.stringify({ email: email, senha: senha }),
      });
      var dados = await resp.json().catch(function () { return {}; });
      if (!resp.ok) {
        erro.textContent = dados.erro || 'Não foi possível entrar.';
        return;
      }
      window.location.href = 'index.html';
    } catch (err) {
      erro.textContent = 'Não foi possível conectar ao servidor. Tente novamente.';
    } finally {
      botao.disabled = false;
      botao.textContent = 'Entrar';
    }
  });
})();