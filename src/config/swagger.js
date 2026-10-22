/**
 * Configuração do Swagger (OpenAPI 3.0).
 * Os paths são lidos das anotações JSDoc em src/routes/*.js;
 * aqui ficam as informações gerais, o esquema de segurança JWT e os schemas reutilizáveis.
 */
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Fatec Mission API',
    version: '1.0.0',
    description:
      'API REST da plataforma **Fatec Mission** — gamificação da experiência acadêmica. ' +
      'Estudantes cumprem missões (presenciais ou virtuais) pelo campus, ganham XP, ' +
      'desbloqueiam conquistas e disputam um ranking. Não há sistema de níveis: apenas XP acumulado.\n\n' +
      '**Autenticação:** faça `POST /login`, copie o `token` e clique em **Authorize** (Bearer).\n\n' +
      '**Regras de XP:** Fácil = +75 / −15 · Médio = +100 / −25 · Difícil = +150 / −75.',
  },
  servers: [{ url: '/', description: 'Servidor atual' }],
  tags: [
    { name: 'Autenticação' },
    { name: 'Usuários' },
    { name: 'Missões' },
    {
      name: 'Quiz',
      description:
        "Missões do tipo quiz ('Tipo 2'): perguntas com alternativas, respondidas no app. " +
        'O XP da missão é dividido igualmente entre as perguntas.',
    },
    { name: 'Ranking' },
    { name: 'Conquistas' },
    { name: 'Administração', description: "Rotas restritas a role='administrador'" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token JWT obtido em POST /login',
      },
    },
    schemas: {
      Dificuldade: { type: 'string', enum: ['Fácil', 'Médio', 'Difícil'], example: 'Médio' },
      TipoMissao: { type: 'string', enum: ['Tipo 1', 'Tipo 2', 'Tipo 3', 'Tipo 4'], example: 'Tipo 1' },
      StatusMissao: { type: 'string', enum: ['ativa', 'inativa'], example: 'ativa' },
      Role: { type: 'string', enum: ['estudante', 'administrador'], example: 'estudante' },

      Usuario: {
        type: 'object',
        description: 'Tabela USUARIO (sem senha_hash, que nunca é exposta).',
        properties: {
          usuario_id: { type: 'integer', example: 1 },
          nome: { type: 'string', maxLength: 150, example: 'Maria Souza' },
          email: { type: 'string', format: 'email', maxLength: 150, example: 'maria@fatec.sp.gov.br' },
          curso: { type: 'string', maxLength: 100, example: 'Análise e Desenvolvimento de Sistemas' },
          semestre: { type: 'integer', minimum: 1, maximum: 12, example: 3 },
          xp: { type: 'integer', example: 325 },
          role: { $ref: '#/components/schemas/Role' },
        },
      },
      UsuarioCadastro: {
        type: 'object',
        required: ['nome', 'email', 'senha', 'curso', 'semestre'],
        properties: {
          nome: { type: 'string', minLength: 2, maxLength: 150, example: 'Maria Souza' },
          email: { type: 'string', format: 'email', maxLength: 150, example: 'maria@fatec.sp.gov.br' },
          senha: { type: 'string', minLength: 6, maxLength: 72, example: 'Senha@123' },
          curso: { type: 'string', maxLength: 100, example: 'Análise e Desenvolvimento de Sistemas' },
          semestre: { type: 'integer', minimum: 1, maximum: 12, example: 3 },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'senha'],
        properties: {
          email: { type: 'string', format: 'email', example: 'maria@fatec.sp.gov.br' },
          senha: { type: 'string', example: 'Senha@123' },
        },
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
          tipo: { type: 'string', example: 'Bearer' },
          expira_em: { type: 'string', example: '8h' },
          usuario: { $ref: '#/components/schemas/Usuario' },
        },
      },

      Missao: {
        type: 'object',
        description:
          'Tabela MISSAO. O `xp` é calculado automaticamente pela dificuldade. ' +
          'O valor de `qr_code` só é retornado para administradores; estudantes veem apenas `possui_qr_code`.',
        properties: {
          missao_id: { type: 'integer', example: 1 },
          titulo: { type: 'string', maxLength: 150, example: 'Visite a biblioteca' },
          descricao: { type: 'string', nullable: true, example: 'Encontre o QR Code no balcão da biblioteca.' },
          dificuldade: { $ref: '#/components/schemas/Dificuldade' },
          tipo: { $ref: '#/components/schemas/TipoMissao' },
          xp: { type: 'integer', example: 100 },
          penalidade: { type: 'integer', example: -25, description: 'XP perdido em caso de erro' },
          status: { $ref: '#/components/schemas/StatusMissao' },
          possui_qr_code: { type: 'boolean', example: true },
          quiz: {
            type: 'boolean',
            example: false,
            description: 'Se é um quiz (Tipo 2): deve ser respondido em POST /missoes/{id}/quiz/respostas',
          },
          qr_code: { type: 'string', nullable: true, example: 'FATEC-BIBLIO-001', description: 'Somente administradores' },
          concluida: { type: 'boolean', example: false, description: 'Se o usuário autenticado já concluiu a missão' },
          total_tentativas: { type: 'integer', example: 40, description: 'Somente administradores' },
          total_conclusoes: { type: 'integer', example: 31, description: 'Somente administradores' },
          total_perguntas: { type: 'integer', example: 0, description: 'Somente administradores (perguntas de quiz)' },
        },
      },
      MissaoInput: {
        type: 'object',
        required: ['titulo', 'dificuldade', 'tipo'],
        description: 'O XP NÃO é enviado: é definido pela dificuldade (Fácil=75, Médio=100, Difícil=150).',
        properties: {
          titulo: { type: 'string', maxLength: 150, example: 'Visite a biblioteca' },
          descricao: { type: 'string', nullable: true, example: 'Encontre o QR Code no balcão da biblioteca.' },
          dificuldade: { $ref: '#/components/schemas/Dificuldade' },
          tipo: { $ref: '#/components/schemas/TipoMissao' },
          status: { $ref: '#/components/schemas/StatusMissao' },
          qr_code: { type: 'string', maxLength: 255, nullable: true, example: 'FATEC-BIBLIO-001' },
        },
      },
      ConcluirMissaoRequest: {
        type: 'object',
        description:
          'Envie `qr_code` (missões com QR Code: o resultado é definido pela comparação) ' +
          'ou `resultado` (missões sem QR Code, validadas pelo front-end — ex.: desafio virtual). ' +
          "Em missões com QR Code, `resultado: 'erro'` sem `qr_code` também é aceito. " +
          'Quizzes NÃO usam esta rota: veja POST /missoes/{id}/quiz/respostas.',
        properties: {
          resultado: { type: 'string', enum: ['sucesso', 'erro'], example: 'sucesso' },
          qr_code: { type: 'string', maxLength: 255, example: 'FATEC-BIBLIO-001' },
        },
      },
      Historico: {
        type: 'object',
        description: 'Tabela HISTORICO — uma tentativa (sucesso ou erro) de um usuário em uma missão.',
        properties: {
          historico_id: { type: 'integer', example: 42 },
          usuario_id: { type: 'integer', example: 1 },
          missao_id: { type: 'integer', example: 3 },
          resultado: { type: 'string', enum: ['sucesso', 'erro'], example: 'sucesso' },
          xp_variacao: { type: 'integer', example: 100, description: 'Positivo em sucesso, negativo em erro' },
        },
      },
      ConcluirMissaoResponse: {
        type: 'object',
        properties: {
          mensagem: { type: 'string', example: 'Missão concluída com sucesso! +100 XP' },
          historico: { $ref: '#/components/schemas/Historico' },
          xp_total: { type: 'integer', example: 425 },
          conquistas_desbloqueadas: {
            type: 'array',
            items: { $ref: '#/components/schemas/Conquista' },
          },
        },
      },

      // ---------------------------------------------------------------- QUIZ
      Alternativa: {
        type: 'object',
        description: 'Tabela ALTERNATIVA. `correta` só aparece para administradores.',
        properties: {
          alternativa_id: { type: 'integer', example: 12 },
          texto: { type: 'string', maxLength: 255, example: 'Centro Paula Souza' },
          ordem: { type: 'integer', example: 1 },
          correta: { type: 'boolean', example: true, description: 'Somente administradores' },
        },
      },
      AlternativaInput: {
        type: 'object',
        required: ['texto'],
        properties: {
          texto: { type: 'string', minLength: 1, maxLength: 255, example: 'Centro Paula Souza' },
          correta: { type: 'boolean', default: false, example: true },
        },
      },
      Pergunta: {
        type: 'object',
        description: 'Tabela PERGUNTA — atrelada a uma missão do tipo quiz (missao_id).',
        properties: {
          pergunta_id: { type: 'integer', example: 5 },
          missao_id: { type: 'integer', example: 4 },
          enunciado: { type: 'string', example: 'Qual instituição administra as Fatecs no estado de São Paulo?' },
          ordem: { type: 'integer', example: 1 },
          alternativas: { type: 'array', items: { $ref: '#/components/schemas/Alternativa' } },
        },
      },
      PerguntaInput: {
        type: 'object',
        required: ['enunciado', 'alternativas'],
        description: 'De 2 a 6 alternativas, com exatamente UMA `correta: true`.',
        properties: {
          enunciado: { type: 'string', minLength: 3, maxLength: 2000, example: 'Qual instituição administra as Fatecs no estado de São Paulo?' },
          ordem: { type: 'integer', minimum: 1, example: 1, description: 'Opcional: padrão é o fim do quiz' },
          alternativas: {
            type: 'array',
            minItems: 2,
            maxItems: 6,
            items: { $ref: '#/components/schemas/AlternativaInput' },
            example: [
              { texto: 'Centro Paula Souza', correta: true },
              { texto: 'Ministério da Educação', correta: false },
              { texto: 'Prefeitura de cada município', correta: false },
              { texto: 'Universidade de São Paulo', correta: false },
            ],
          },
        },
      },
      PerguntaUpdate: {
        type: 'object',
        minProperties: 1,
        description: 'Envie apenas o que deseja alterar. `alternativas` substitui a lista inteira.',
        properties: {
          missao_id: { type: 'integer', example: 4, description: 'Move a pergunta para outro quiz' },
          enunciado: { type: 'string', minLength: 3, maxLength: 2000 },
          ordem: { type: 'integer', minimum: 1 },
          alternativas: { type: 'array', minItems: 2, maxItems: 6, items: { $ref: '#/components/schemas/AlternativaInput' } },
        },
      },
      Quiz: {
        type: 'object',
        description: 'Quiz para o estudante responder (sem gabarito).',
        properties: {
          missao: { $ref: '#/components/schemas/Missao' },
          total_perguntas: { type: 'integer', example: 4 },
          xp_total: { type: 'integer', example: 150, description: 'XP de 100% de acertos' },
          xp_por_pergunta: { type: 'number', example: 37.5 },
          perguntas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                pergunta_id: { type: 'integer', example: 5 },
                missao_id: { type: 'integer', example: 4 },
                enunciado: { type: 'string', example: 'Qual instituição administra as Fatecs no estado de São Paulo?' },
                ordem: { type: 'integer', example: 1 },
                alternativas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      alternativa_id: { type: 'integer', example: 12 },
                      texto: { type: 'string', example: 'Centro Paula Souza' },
                      ordem: { type: 'integer', example: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      },
      QuizAdmin: {
        type: 'object',
        properties: {
          missao: { $ref: '#/components/schemas/Missao' },
          total_perguntas: { type: 'integer', example: 4 },
          xp_total: { type: 'integer', example: 150 },
          xp_por_pergunta: { type: 'number', nullable: true, example: 37.5 },
          perguntas: { type: 'array', items: { $ref: '#/components/schemas/Pergunta' } },
        },
      },
      RespostasQuizRequest: {
        type: 'object',
        required: ['respostas'],
        properties: {
          respostas: {
            type: 'array',
            description: 'Uma resposta para CADA pergunta do quiz',
            items: {
              type: 'object',
              required: ['pergunta_id', 'alternativa_id'],
              properties: {
                pergunta_id: { type: 'integer', example: 5 },
                alternativa_id: { type: 'integer', example: 12 },
              },
            },
            example: [
              { pergunta_id: 5, alternativa_id: 12 },
              { pergunta_id: 6, alternativa_id: 18 },
              { pergunta_id: 7, alternativa_id: 21 },
              { pergunta_id: 8, alternativa_id: 27 },
            ],
          },
        },
      },
      ResultadoQuiz: {
        type: 'object',
        properties: {
          mensagem: { type: 'string', example: 'Quiz concluído! 3 de 4 acertos: +113 XP' },
          pontuacao: {
            type: 'object',
            properties: {
              acertos: { type: 'integer', example: 3 },
              total: { type: 'integer', example: 4 },
              percentual: { type: 'number', example: 75 },
              xp_por_pergunta: { type: 'number', example: 37.5 },
              xp_obtido: { type: 'integer', example: 113, description: 'arredondar(acertos × xp_por_pergunta)' },
            },
          },
          correcao: {
            type: 'array',
            description: 'Se cada pergunta foi acertada (sem revelar a alternativa correta)',
            items: {
              type: 'object',
              properties: {
                pergunta_id: { type: 'integer', example: 5 },
                alternativa_id: { type: 'integer', example: 12 },
                acertou: { type: 'boolean', example: true },
              },
            },
          },
          historico: { $ref: '#/components/schemas/Historico' },
          xp_total: { type: 'integer', example: 538, description: 'XP total do usuário após a tentativa' },
          conquistas_desbloqueadas: { type: 'array', items: { $ref: '#/components/schemas/Conquista' } },
        },
      },

      Conquista: {
        type: 'object',
        description:
          'Tabela CONQUISTA. `requisito` usa um formato legível pela API: ' +
          '`missoes:N`, `xp:N`, `dificuldade:<Fácil|Médio|Difícil>:N`, `tipo:<Tipo 1..4>:N`. ' +
          'Conquistas com requisito vazio/desconhecido não são desbloqueadas automaticamente.',
        properties: {
          conquista_id: { type: 'integer', example: 1 },
          nome: { type: 'string', maxLength: 100, example: 'Primeiros Passos' },
          descricao: { type: 'string', nullable: true, example: 'Conclua sua primeira missão.' },
          icone: { type: 'string', nullable: true, example: '/icones/primeiros-passos.png' },
          requisito: { type: 'string', nullable: true, example: 'missoes:1' },
        },
      },
      ConquistaUsuario: {
        allOf: [
          { $ref: '#/components/schemas/Conquista' },
          {
            type: 'object',
            properties: {
              desbloqueada: { type: 'boolean', example: true },
              data_desbloqueio: { type: 'string', format: 'date-time', nullable: true, example: '2026-09-20T14:32:00.000Z' },
            },
          },
        ],
      },

      Perfil: {
        type: 'object',
        properties: {
          usuario_id: { type: 'integer', example: 1 },
          nome: { type: 'string', example: 'Maria Souza' },
          email: { type: 'string', example: 'maria@fatec.sp.gov.br' },
          curso: { type: 'string', example: 'Análise e Desenvolvimento de Sistemas' },
          semestre: { type: 'integer', example: 3 },
          role: { $ref: '#/components/schemas/Role' },
          xp: { type: 'integer', example: 325 },
          posicao_ranking: { type: 'integer', nullable: true, example: 4 },
          total_missoes_concluidas: { type: 'integer', example: 3 },
          missoes_concluidas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                missao_id: { type: 'integer', example: 1 },
                titulo: { type: 'string', example: 'Visite a biblioteca' },
                dificuldade: { $ref: '#/components/schemas/Dificuldade' },
                tipo: { $ref: '#/components/schemas/TipoMissao' },
                xp_ganho: { type: 'integer', example: 100 },
              },
            },
          },
          conquistas: { type: 'array', items: { $ref: '#/components/schemas/ConquistaUsuario' } },
        },
      },
      RankingItem: {
        type: 'object',
        properties: {
          posicao: { type: 'integer', example: 1 },
          usuario_id: { type: 'integer', example: 7 },
          nome: { type: 'string', example: 'João Lima' },
          curso: { type: 'string', example: 'Análise e Desenvolvimento de Sistemas' },
          semestre: { type: 'integer', example: 5 },
          xp: { type: 'integer', example: 980 },
        },
      },
      Dashboard: {
        type: 'object',
        properties: {
          usuarios: {
            type: 'object',
            properties: {
              total: { type: 'integer', example: 120 },
              estudantes: { type: 'integer', example: 118 },
              administradores: { type: 'integer', example: 2 },
              ativos: { type: 'integer', example: 96, description: 'Estudantes com ao menos uma tentativa' },
              percentual_ativos: { type: 'number', example: 81.36 },
            },
          },
          conclusoes: { type: 'integer', example: 450, description: 'Total de missões concluídas (sucessos)' },
          missoes: {
            type: 'object',
            properties: {
              total: { type: 'integer', example: 20 },
              ativas: { type: 'integer', example: 17 },
              inativas: { type: 'integer', example: 3 },
            },
          },
          xp: {
            type: 'object',
            properties: {
              distribuido: { type: 'integer', example: 45300, description: 'Soma dos XP ganhos em sucessos' },
              penalidades: { type: 'integer', example: -2100, description: 'Soma das penalidades aplicadas' },
              saldo: { type: 'integer', example: 43200 },
            },
          },
          tentativas: {
            type: 'object',
            properties: {
              total: { type: 'integer', example: 600 },
              sucessos: { type: 'integer', example: 450 },
              erros: { type: 'integer', example: 150 },
              taxa_acerto: { type: 'number', example: 75.0, description: '% de tentativas com sucesso' },
            },
          },
          taxa_conclusao: {
            type: 'number',
            example: 22.06,
            description: '% de pares (estudante × missão ativa) concluídos',
          },
          conquistas_desbloqueadas: { type: 'integer', example: 210 },
          missoes_mais_concluidas: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                missao_id: { type: 'integer', example: 1 },
                titulo: { type: 'string', example: 'Visite a biblioteca' },
                conclusoes: { type: 'integer', example: 95 },
              },
            },
          },
          missoes_realizadas: {
            type: 'array',
            description: 'TODAS as missões, da mais realizada (conclusões) para a menos realizada',
            items: {
              type: 'object',
              properties: {
                missao_id: { type: 'integer', example: 1 },
                titulo: { type: 'string', example: 'Visite a biblioteca' },
                tipo: { $ref: '#/components/schemas/TipoMissao' },
                dificuldade: { $ref: '#/components/schemas/Dificuldade' },
                status: { $ref: '#/components/schemas/StatusMissao' },
                conclusoes: { type: 'integer', example: 95 },
                erros: { type: 'integer', example: 12 },
                tentativas: { type: 'integer', example: 107 },
              },
            },
          },
          participacao_por_curso: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                curso: { type: 'string', example: 'Análise e Desenvolvimento de Sistemas' },
                estudantes: { type: 'integer', example: 54 },
                ativos: { type: 'integer', example: 47 },
                percentual_ativos: { type: 'number', example: 87.04 },
                conclusoes: { type: 'integer', example: 210 },
                xp_total: { type: 'integer', example: 19850 },
              },
            },
          },
        },
      },

      UsuarioAdmin: {
        type: 'object',
        description: 'Usuário com estatísticas (administração/exportação). Nunca inclui a senha.',
        properties: {
          usuario_id: { type: 'integer', example: 7 },
          nome: { type: 'string', example: 'Maria Souza' },
          email: { type: 'string', example: 'maria@fatec.sp.gov.br' },
          curso: { type: 'string', example: 'Análise e Desenvolvimento de Sistemas' },
          semestre: { type: 'integer', example: 3 },
          role: { $ref: '#/components/schemas/Role' },
          xp: { type: 'integer', example: 325 },
          missoes_concluidas: { type: 'integer', example: 3 },
          tentativas: { type: 'integer', example: 4 },
          erros: { type: 'integer', example: 1 },
          conquistas: { type: 'integer', example: 2 },
        },
      },

      Erro: {
        type: 'object',
        properties: {
          erro: {
            type: 'object',
            properties: {
              status: { type: 'integer', example: 400 },
              mensagem: { type: 'string', example: 'Dados inválidos.' },
              detalhes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    campo: { type: 'string', example: 'email' },
                    mensagem: { type: 'string', example: '"email" deve ser um e-mail válido' },
                  },
                },
              },
            },
          },
        },
      },
    },
    parameters: {
      MissaoId: {
        name: 'id',
        in: 'path',
        required: true,
        description: 'ID da missão',
        schema: { type: 'integer', minimum: 1, example: 1 },
      },
    },
    responses: {
      BadRequest: {
        description: 'Dados de entrada inválidos',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
      },
      Unauthorized: {
        description: 'Token ausente, inválido ou expirado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Erro' },
            example: { erro: { status: 401, mensagem: 'Token de autenticação ausente.' } },
          },
        },
      },
      Forbidden: {
        description: "Usuário autenticado sem a role necessária ('administrador')",
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Erro' },
            example: { erro: { status: 403, mensagem: 'Acesso restrito a administradores.' } },
          },
        },
      },
      NotFound: {
        description: 'Recurso não encontrado',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Erro' },
            example: { erro: { status: 404, mensagem: 'Missão não encontrada.' } },
          },
        },
      },
      Conflict: {
        description: 'Conflito com o estado atual (ex.: registro duplicado)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Erro' } } },
      },
      InternalError: {
        description: 'Erro interno do servidor',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Erro' },
            example: { erro: { status: 500, mensagem: 'Erro interno do servidor.' } },
          },
        },
      },
    },
  },
};

const swaggerSpec = swaggerJsdoc({
  definition,
  // O glob exige "/" mesmo no Windows.
  apis: [path.join(__dirname, '../routes/*.js').replace(/\\/g, '/')],
});

module.exports = swaggerSpec;
