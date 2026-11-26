// Uso: npm run criar-admin   (rode dentro da pasta backend)
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const pool = require('../src/db');

function perguntar(texto, oculto = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      // não mostra a senha enquanto é digitada
      rl._writeToOutput = (s) => rl.output.write(s.includes(texto) ? s : '*');
    }
    rl.question(texto, (resposta) => {
      rl.close();
      if (oculto) console.log('');
      resolve(resposta);
    });
  });
}

(async () => {
  try {
    const nome = (await perguntar('Nome do administrador: ')).trim();
    const email = (await perguntar('E-mail: ')).trim().toLowerCase();
    const senha = await perguntar('Senha (mínimo 10 caracteres): ', true);
    const confirmar = await perguntar('Repita a senha: ', true);

    if (nome.length < 2) throw new Error('Nome inválido.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail inválido.');
    if (senha.length < 10 || senha.length > 72) throw new Error('A senha deve ter de 10 a 72 caracteres.');
    if (senha !== confirmar) throw new Error('As senhas não conferem.');

    const hash = await bcrypt.hash(senha, 12);
    await pool.query(
      "INSERT INTO usuarios (nome, email, senha_hash, papel) VALUES ($1, $2, $3, 'admin')",
      [nome, email, hash]
    );
    console.log('Administrador criado com sucesso: ' + email);
  } catch (err) {
    if (err.code === '23505') console.error('Já existe um usuário com este e-mail.');
    else console.error('Erro: ' + err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();