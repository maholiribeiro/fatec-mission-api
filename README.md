# Fatec Mission API

API REST da plataforma **Fatec Mission**, que gamifica a experiência acadêmica. Os estudantes cumprem missões pelo campus (presenciais ou virtuais), ganham XP, desbloqueiam conquistas e disputam um ranking. O projeto não tem sistema de níveis: conta apenas o XP acumulado.

**Stack:** Node.js · Express · MySQL · JWT · bcrypt · Joi · Swagger (OpenAPI 3.0) · Jest

---

## Sumário
1. [Requisitos](#requisitos)
2. [Instalação e execução](#instalação-e-execução)
3. [Geração automática do banco](#geração-automática-do-banco)
4. [Estrutura de pastas](#estrutura-de-pastas)
5. [Decisões técnicas](#decisões-técnicas)
6. [Regras de negócio](#regras-de-negócio)
7. [Endpoints](#endpoints)
8. [Testes](#testes)

---

## Requisitos
- Node.js 18 ou superior
- MySQL 8.0 ou superior, já instalado e rodando. Também funciona com MariaDB 10.5+.
- Um usuário MySQL com permissão de `CREATE DATABASE` e `CREATE TABLE` (em ambiente local, o `root` serve).

## Instalação e execução

```bash
# 1. Instalar dependências
npm install

# 2. Criar o .env a partir do exemplo e preencher (senha do MySQL, JWT_SECRET...)
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env

# 3. Criar o banco e as tabelas (+ dados de exemplo)
npm run db:seed               # ou "npm run db:init" para criar só a estrutura

# 4. Subir a API
npm run dev                   # desenvolvimento (nodemon, reinicia ao salvar)
npm start                     # produção

# 5. Documentação interativa
# http://localhost:3000/api-docs
```

### Variáveis de ambiente
Todas estão documentadas no [.env.example](.env.example). As principais:

| Variável | Descrição |
|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` | Credenciais do MySQL |
| `DB_NAME` | Nome do banco, criado automaticamente |
| `DB_AUTO_INIT` | `true`: o servidor cria o banco e as tabelas ao subir |
| `DB_AUTO_SEED` | `true`: também insere os dados de exemplo ao subir |
| `JWT_SECRET` | Segredo de assinatura dos tokens. Use um valor longo e aleatório |
| `JWT_EXPIRES_IN` | Validade do token (ex.: `8h`, `1d`) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Administrador criado pelo seed |

Para gerar um `JWT_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Geração automática do banco

A API cria o próprio banco. Você não precisa rodar nenhum SQL manualmente.

| Comando | O que faz |
|---|---|
| `npm run db:init` | `CREATE DATABASE IF NOT EXISTS` + todas as tabelas (`CREATE TABLE IF NOT EXISTS`) |
| `npm run db:seed` | O mesmo que `db:init`, mais 8 missões, 8 perguntas de quiz, 8 conquistas e 1 administrador de exemplo |
| `DB_AUTO_INIT=true` | Faz o mesmo do `db:init` automaticamente toda vez que o servidor sobe |

O script é **idempotente** e pode ser executado quantas vezes você quiser:
- as tabelas usam `IF NOT EXISTS`;
- o seed só insere uma missão ou conquista se ainda não existir outra com o mesmo título/nome;
- o administrador é inserido com `INSERT IGNORE` (o e-mail é `UNIQUE`);
- as perguntas de exemplo só são inseridas em quizzes que ainda não têm nenhuma pergunta.

> **Banco já existente?** Basta rodar `npm run db:init` (ou subir a API com `DB_AUTO_INIT=true`): as novas tabelas `pergunta` e `alternativa` são criadas sem mexer nas demais. Use `npm run db:seed` para também incluir as perguntas de exemplo.

O DDL fica em [src/scripts/schema.js](src/scripts/schema.js) e segue o modelo oficial: tipos, PKs, FKs, ENUMs, defaults e `UNIQUE`. Detalhes da implementação:
- **Charset `utf8mb4`**, obrigatório por causa dos ENUMs acentuados (`'Fácil'`, `'Médio'`, `'Difícil'`).
- **FKs:** apagar um usuário apaga em cascata o histórico e as conquistas dele. Uma missão com histórico não pode ser apagada (`RESTRICT`); nesse caso, desative-a via `PATCH /admin/missoes/:id/status`.
- **Índices extras** (`idx_*`) para acelerar o ranking e a verificação de sucesso. Eles não mudam as regras do modelo.

### Tabelas do quiz (extensão do modelo)

| Tabela | Campos | Restrições |
|---|---|---|
| `PERGUNTA` | `pergunta_id` INT PK AI · `missao_id` INT · `enunciado` TEXT · `ordem` SMALLINT (padrão 1) | FK → `MISSAO`. Apagar a missão apaga as perguntas |
| `ALTERNATIVA` | `alternativa_id` INT PK AI · `pergunta_id` INT · `texto` VARCHAR(255) · `correta` TINYINT(1) (padrão 0) · `ordem` TINYINT | FK → `PERGUNTA`. Apagar a pergunta apaga as alternativas |

Relacionamentos: `MISSAO 1:N PERGUNTA` e `PERGUNTA 1:N ALTERNATIVA`.

**"Exatamente uma correta" é garantido no próprio banco.** A coluna gerada `correta_unica` vale `1` na alternativa correta e `NULL` nas demais, e o `UNIQUE (pergunta_id, correta_unica)` impede uma segunda correta, já que valores `NULL` não conflitam entre si. A API também valida isso antes de gravar e devolve uma mensagem clara.

### Credenciais de exemplo (após `npm run db:seed`)
- Administrador: `admin@fatec.sp.gov.br` / `Admin@123` (definido no `.env`)
- Estudantes: crie pelo `POST /usuarios`.
- Missões presenciais do seed usam QR Codes como `FATEC-BIBLIOTECA-001`, `FATEC-LAB3-001`, `FATEC-TESOURO-001`.

## Estrutura de pastas

```
fatec-mission-api/
├── server.js                  # Ponto de entrada: auto-init do banco + app.listen
├── .env.example
├── package.json
├── src/
│   ├── app.js                 # Montagem do Express (exportado para testes)
│   ├── config/                # env.js · database.js (pool mysql2) · swagger.js
│   ├── routes/                # Rotas + anotações Swagger (JSDoc)
│   ├── controllers/           # Camada HTTP: lê req, chama service, responde
│   ├── services/              # Regras de negócio (XP, conquistas, ranking, dashboard)
│   ├── models/                # Acesso ao banco (SQL parametrizado)
│   ├── middlewares/           # auth (JWT) · requireRole · validate (Joi) · errorHandler
│   ├── validators/            # Schemas Joi
│   ├── utils/                 # gameRules (XP) · quizRules (pontuação) · conquistaRules · AppError · asyncHandler
│   └── scripts/               # schema.js (DDL) · initDb.js · seed.js
└── tests/
    ├── unit/                  # Regras de XP, quiz, conquistas e conclusão de missão
    └── integration/           # HTTP: auth, roles, validação, erros, Swagger
```

Fluxo de uma requisição: **routes → middlewares → controllers → services → models → MySQL**.

## Decisões técnicas

### Por que `mysql2` puro, sem ORM
- **O esquema já está definido** na documentação oficial do banco. Com SQL explícito, o DDL gerado é exatamente o especificado. Um ORM poderia criar colunas extras (`createdAt`/`updatedAt`) ou traduzir tipos de outra forma.
- **A regra crítica depende de transação e lock.** A conclusão de missão usa `SELECT ... FOR UPDATE` dentro de uma transação. Com `mysql2` isso fica explícito e fácil de auditar.
- **O ranking e o dashboard são consultas agregadas** (`ORDER BY`, `COUNT`, `SUM`, subconsultas). Em SQL direto elas ficam mais claras do que em um query builder.
- **Menos dependências e menos "mágica"**, o que facilita o entendimento em um projeto acadêmico.
- **Segurança:** todas as queries usam placeholders `?` (prepared/parametrizadas), o que evita SQL injection.

### Outras escolhas
- **`bcryptjs`:** é o algoritmo bcrypt implementado em JavaScript puro, compatível com hashes do `bcrypt` nativo. Foi escolhido porque não exige compilação C++ (node-gyp), que costuma falhar no Windows.
- **Joi** para validação, com mensagens em português e `stripUnknown`: campos não previstos, como `role` no cadastro ou `xp` na criação de missão, são descartados.
- **Express 4:** o Express 5 torna `req.query` somente leitura, o que complica a substituição pelos valores validados.

## Regras de negócio

As regras ficam centralizadas em [src/utils/gameRules.js](src/utils/gameRules.js) e [src/services/missaoService.js](src/services/missaoService.js).

| Dificuldade | XP no sucesso | Penalidade no erro |
|---|---|---|
| Fácil | +75 | −15 |
| Médio | +100 | −25 |
| Difícil | +150 | −75 |

- **XP da missão:** é derivado da dificuldade e nunca é enviado pelo cliente. Se a dificuldade mudar em uma edição, o XP é recalculado.
- **Tentativas (`POST /missoes/:id/concluir`):** tudo acontece em uma única transação:
  1. valida a missão (404 se não existir, 400 se estiver inativa);
  2. trava a linha do usuário com `FOR UPDATE`. Isso serializa requisições simultâneas, como um duplo clique;
  3. **um único sucesso por missão:** se já existir `sucesso` para o par usuário/missão, a API responde **409**. Erros podem se repetir;
  4. grava o `HISTORICO` com o `xp_variacao` (positivo no sucesso, negativo no erro) e soma esse valor em `USUARIO.xp`;
  5. no sucesso, verifica as conquistas e desbloqueia as que tiverem o requisito atingido.
- **QR Code:** é opcional em qualquer um dos 4 tipos.
  - Missão com QR Code: o cliente envia `qr_code` e o resultado vem da comparação. `resultado: "sucesso"` sem o código é recusado com 400.
  - Missão sem QR Code: o cliente envia `resultado`.
  - O valor do QR Code **só aparece para administradores**. Estudantes veem apenas `possui_qr_code`, para não poderem concluir missões presenciais sem ir ao local.
- **Conquistas:** a coluna `requisito` usa um formato que a API interpreta:

  | Requisito | Significado |
  |---|---|
  | `missoes:5` | concluiu 5 missões |
  | `xp:500` | tem pelo menos 500 de XP |
  | `dificuldade:Difícil:3` | concluiu 3 missões difíceis |
  | `tipo:Tipo 2:2` | concluiu 2 missões do Tipo 2 |

  Uma conquista com requisito vazio ou em formato desconhecido não é desbloqueada automaticamente. A PK composta de `USUARIO_CONQUISTA` e o `INSERT IGNORE` impedem desbloqueio duplicado.
- **Quiz:** são as missões do tipo `Tipo 2` (constante `TIPO_QUIZ` em [gameRules.js](src/utils/gameRules.js)). Elas são respondidas no app, pergunta a pergunta. A lógica fica em [quizService.js](src/services/quizService.js) e [quizRules.js](src/utils/quizRules.js).
  - **Pontuação proporcional:** o XP da missão vale 100% do quiz e é dividido igualmente entre as perguntas. O arredondamento é feito só no total, então acertar tudo sempre dá o XP cheio.

    | Quiz | XP por pergunta | Exemplo |
    |---|---|---|
    | Difícil (150 XP), 4 perguntas | 37,5 | 3 acertos → 112,5 → **113 XP** |
    | Médio (100 XP), 4 perguntas | 25 | 2 acertos → **50 XP** |
    | Médio (100 XP), 3 perguntas | 33,33 | 3 acertos → **100 XP** |

  - **1 ou mais acertos:** resultado `sucesso` com o XP proporcional. O quiz fica concluído, e uma nova tentativa recebe **409**. Isso evita refazer para melhorar a nota depois de conhecer as perguntas.
  - **0 acertos:** resultado `erro` com a penalidade da dificuldade. O estudante pode tentar de novo.
  - **Todas as perguntas devem ser respondidas**, cada uma uma única vez, e com uma alternativa da própria pergunta. Caso contrário, a API responde 400 com os detalhes.
  - **O gabarito nunca vai para o estudante.** Nem ao carregar o quiz, nem na correção, que informa apenas se cada pergunta foi acertada.
  - **O quiz não pode ser concluído por `POST /missoes/:id/concluir`**, que daria 100% do XP sem responder. Essa rota responde 400 indicando o endpoint correto.
  - **Um quiz com perguntas não pode mudar de tipo** (409). Remova as perguntas antes.
  - Editar perguntas depois que estudantes já responderam não altera o XP que eles já ganharam.
- **Ranking:** é uma consulta `ORDER BY xp DESC`, nunca uma tabela. Participam apenas estudantes, com filtro opcional por curso e paginação. Empatados dividem a posição (1, 2, 2, 4…).
- **XP negativo:** como a regra manda subtrair a penalidade, o XP de um usuário pode ficar negativo. Assim, `USUARIO.xp` sempre corresponde à soma de `HISTORICO.xp_variacao`. Se preferir travar o XP em zero, altere `usuarioModel.incrementarXp` para `SET xp = GREATEST(xp + ?, 0)`. Nesse caso, a soma do histórico deixa de bater com o XP do usuário.

## Endpoints

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/login` | público | Autentica e retorna o JWT |
| POST | `/usuarios` | público | Cadastro de estudante |
| GET | `/perfil` | JWT | Dados, XP, posição, missões concluídas, conquistas |
| GET | `/missoes` | JWT | Lista missões (`?tipo=&dificuldade=&status=ativa\|inativa\|todas`) |
| GET | `/missoes/:id` | JWT | Detalhes da missão |
| POST | `/missoes/:id/concluir` | JWT | Registra a tentativa (`{ "qr_code": "..." }` ou `{ "resultado": "sucesso\|erro" }`). Não vale para quiz |
| GET | `/missoes/:id/quiz` | JWT | Perguntas e alternativas do quiz (sem gabarito), XP total e XP por pergunta |
| POST | `/missoes/:id/quiz/respostas` | JWT | Envia as respostas (`{ "respostas": [{ "pergunta_id", "alternativa_id" }] }`) e recebe a pontuação |
| GET | `/ranking` | JWT | Ranking por XP (`?curso=&limite=&pagina=`) |
| GET | `/conquistas` | JWT | Conquistas e status de desbloqueio |
| POST | `/admin/missoes` | admin | Cria uma missão |
| PUT | `/admin/missoes/:id` | admin | Edita uma missão |
| PATCH | `/admin/missoes/:id/status` | admin | Ativa ou desativa uma missão |
| DELETE | `/admin/missoes/:id` | admin | Exclui uma missão. Só funciona se ela não tiver tentativas; caso contrário, responde 409 e é preciso desativá-la |
| GET | `/admin/usuarios` | admin | Todos os usuários com estatísticas. `?formato=csv` baixa um CSV (separador `;`, UTF-8 com BOM, para o Excel) |
| GET | `/admin/missoes/:id/perguntas` | admin | Perguntas do quiz **com** gabarito |
| POST | `/admin/missoes/:id/perguntas` | admin | Cadastra uma pergunta e suas alternativas, atrelada ao quiz `:id` |
| PUT | `/admin/perguntas/:id` | admin | Edita enunciado/ordem, troca as alternativas ou move a pergunta para outro quiz (`missao_id`) |
| PATCH | `/admin/perguntas/:id/correta` | admin | Define qual alternativa é a correta (`{ "alternativa_id" }`) |
| DELETE | `/admin/perguntas/:id` | admin | Remove a pergunta e suas alternativas |
| GET | `/admin/dashboard` | admin | Indicadores gerais, incluindo estudantes ativos (com ao menos 1 tentativa), todas as missões da mais à menos realizada e a participação por curso |

**Documentação interativa:** `GET /api-docs`. A especificação em JSON fica em `GET /api-docs.json`.

**Formato padrão de erro** (400, 401, 403, 404, 409, 500):
```json
{ "erro": { "status": 400, "mensagem": "Dados inválidos.", "detalhes": [{ "campo": "email", "mensagem": "\"email\" deve ser um e-mail válido" }] } }
```

### Exemplo rápido com curl
```bash
curl -X POST http://localhost:3000/usuarios -H "Content-Type: application/json" \
  -d '{"nome":"Maria Souza","email":"maria@fatec.sp.gov.br","senha":"Senha@123","curso":"ADS","semestre":3}'

curl -X POST http://localhost:3000/login -H "Content-Type: application/json" \
  -d '{"email":"maria@fatec.sp.gov.br","senha":"Senha@123"}'

curl -X POST http://localhost:3000/missoes/1/concluir -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" -d '{"qr_code":"FATEC-BIBLIOTECA-001"}'

# Quiz (admin): cadastrar pergunta com exatamente uma alternativa correta
curl -X POST http://localhost:3000/admin/missoes/5/perguntas -H "Authorization: Bearer <TOKEN_ADMIN>" \
  -H "Content-Type: application/json" \
  -d '{"enunciado":"Qual estrutura segue LIFO?","alternativas":[{"texto":"Pilha","correta":true},{"texto":"Fila"},{"texto":"Árvore"}]}'

# Quiz (estudante): carregar e responder
curl http://localhost:3000/missoes/5/quiz -H "Authorization: Bearer <TOKEN>"
curl -X POST http://localhost:3000/missoes/5/quiz/respostas -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"respostas":[{"pergunta_id":5,"alternativa_id":17},{"pergunta_id":6,"alternativa_id":21}]}'
```

## Testes

```bash
npm test
```

São 132 testes em Jest e Supertest. Nenhum deles precisa de MySQL: a camada de dados é mockada. Eles cobrem:
- **Quiz:**
  - pontuação proporcional, incluindo o exemplo 150 XP / 4 perguntas = 37,5 e os arredondamentos;
  - exatamente uma alternativa correta;
  - pergunta só em missão do tipo quiz;
  - mover uma pergunta de quiz e trocar o gabarito;
  - respostas incompletas, duplicadas ou de outra pergunta;
  - 0 acertos geram penalidade, e um quiz concluído recebe 409;
  - o gabarito nunca é exposto;
  - o atalho `/concluir` é bloqueado para quiz.
- **Administração:**
  - dashboard: estudantes ativos, missões nunca realizadas e participação por curso;
  - exclusão de missão: bloqueada quando há tentativas;
  - CSV: separador `;`, BOM, aspas e proteção contra fórmulas (*CSV injection*).
- **Cálculo de XP:** ganhos e penalidades das três dificuldades, e XP derivado da dificuldade na criação e na edição.
- **Sucesso único por missão:** 409, rollback, e erros que continuam permitidos depois de um sucesso.
- **Desbloqueio de conquistas:** interpretação dos requisitos, desbloqueio seletivo e verificação feita depois de atualizar o XP.
- **QR Code:** código correto, código incorreto, código ausente e ocultação do código para estudantes.
- **HTTP:** login, cadastro (hash e role forçada), 401, 403, 400, 404, JSON malformado e cobertura do Swagger.
