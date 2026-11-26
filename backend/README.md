# GEAV — Backend (API)

API do site do Grupo Espírita Amor e Vida, responsável por login de usuários
autorizados e gerenciamento de eventos.

## Tecnologias

- Node.js + Express
- Neon (PostgreSQL serverless)

## Configuração

1. Copie `.env.example` para `.env` e preencha os valores.
2. Instale as dependências:

```
npm install
```

3. Inicie o servidor:

```
npm start
```

## Variáveis de ambiente

| Variável       | Descrição                                          |
|----------------|----------------------------------------------------|
| `DATABASE_URL` | String de conexão do Neon                          |
| `JWT_SECRET`   | Texto aleatório longo usado para assinar sessões   |
| `PORT`         | Porta da API (padrão 3000)                         |
| `FRONTEND_URL` | Endereço do site, liberado no CORS                 |
| `NODE_ENV`     | `development` ou `production`                      |

## Banco de dados

Tabelas: `usuarios` e `eventos`.

- Perfis: `admin` (publica eventos, define destaque e cria usuários) e
  `editor` (cadastra eventos como rascunho).
- Não existe cadastro público: contas são criadas somente por um admin.
- O card de destaque só aparece no site quando existe um evento
  `publicado` com `destaque = true` que ainda não terminou.

## Segurança

- Senhas guardadas apenas como hash (argon2 ou bcrypt).
- Consultas SQL sempre parametrizadas.
- Permissões verificadas no servidor em cada rota.
- Segredos somente no `.env`, que nunca é versionado.