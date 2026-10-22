/**
 * DDL de todas as tabelas, na ordem correta de criação (respeitando as FKs).
 * Tudo com CREATE TABLE IF NOT EXISTS → o script é idempotente.
 *
 * Observações:
 * - utf8mb4 é obrigatório por causa dos ENUMs acentuados ('Fácil', 'Médio', 'Difícil').
 * - Os índices adicionais (idx_*) apenas aceleram ranking/consultas; não alteram as regras do modelo.
 * - RANKING não é tabela: é uma consulta ORDER BY xp DESC sobre USUARIO.
 */
const TABELAS = [
  {
    nome: 'usuario',
    ddl: `
      CREATE TABLE IF NOT EXISTS usuario (
        usuario_id  INT           NOT NULL AUTO_INCREMENT,
        nome        VARCHAR(150)  NOT NULL,
        email       VARCHAR(150)  NOT NULL,
        senha_hash  VARCHAR(255)  NOT NULL,
        curso       VARCHAR(100)  NOT NULL,
        semestre    TINYINT       NOT NULL,
        xp          INT           NOT NULL DEFAULT 0,
        role        ENUM('estudante','administrador') NOT NULL DEFAULT 'estudante',
        PRIMARY KEY (usuario_id),
        UNIQUE KEY uk_usuario_email (email),
        KEY idx_usuario_xp (xp),
        KEY idx_usuario_curso_xp (curso, xp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    nome: 'missao',
    ddl: `
      CREATE TABLE IF NOT EXISTS missao (
        missao_id    INT           NOT NULL AUTO_INCREMENT,
        titulo       VARCHAR(150)  NOT NULL,
        descricao    TEXT          NULL,
        dificuldade  ENUM('Fácil','Médio','Difícil') NOT NULL,
        tipo         ENUM('Tipo 1','Tipo 2','Tipo 3','Tipo 4') NOT NULL,
        xp           INT           NOT NULL,
        status       ENUM('ativa','inativa') NOT NULL DEFAULT 'ativa',
        qr_code      VARCHAR(255)  NULL,
        PRIMARY KEY (missao_id),
        UNIQUE KEY uk_missao_qr_code (qr_code),
        KEY idx_missao_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    nome: 'historico',
    ddl: `
      CREATE TABLE IF NOT EXISTS historico (
        historico_id  INT  NOT NULL AUTO_INCREMENT,
        usuario_id    INT  NOT NULL,
        missao_id     INT  NOT NULL,
        resultado     ENUM('sucesso','erro') NOT NULL,
        xp_variacao   INT  NOT NULL,
        PRIMARY KEY (historico_id),
        KEY idx_historico_usuario_missao (usuario_id, missao_id, resultado),
        KEY idx_historico_missao (missao_id),
        CONSTRAINT fk_historico_usuario FOREIGN KEY (usuario_id)
          REFERENCES usuario (usuario_id) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT fk_historico_missao FOREIGN KEY (missao_id)
          REFERENCES missao (missao_id) ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    nome: 'conquista',
    ddl: `
      CREATE TABLE IF NOT EXISTS conquista (
        conquista_id  INT           NOT NULL AUTO_INCREMENT,
        nome          VARCHAR(100)  NOT NULL,
        descricao     VARCHAR(255)  NULL,
        icone         VARCHAR(255)  NULL,
        requisito     VARCHAR(255)  NULL,
        PRIMARY KEY (conquista_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  {
    nome: 'usuario_conquista',
    ddl: `
      CREATE TABLE IF NOT EXISTS usuario_conquista (
        usuario_id        INT       NOT NULL,
        conquista_id      INT       NOT NULL,
        data_desbloqueio  DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (usuario_id, conquista_id),
        KEY idx_uc_conquista (conquista_id),
        CONSTRAINT fk_uc_usuario FOREIGN KEY (usuario_id)
          REFERENCES usuario (usuario_id) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT fk_uc_conquista FOREIGN KEY (conquista_id)
          REFERENCES conquista (conquista_id) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  // ------------------------------------------------------------------ QUIZ
  // Perguntas pertencem a uma MISSAO do tipo quiz (MISSAO 1:N PERGUNTA).
  {
    nome: 'pergunta',
    ddl: `
      CREATE TABLE IF NOT EXISTS pergunta (
        pergunta_id  INT       NOT NULL AUTO_INCREMENT,
        missao_id    INT       NOT NULL,
        enunciado    TEXT      NOT NULL,
        ordem        SMALLINT  NOT NULL DEFAULT 1,
        PRIMARY KEY (pergunta_id),
        KEY idx_pergunta_missao_ordem (missao_id, ordem),
        CONSTRAINT fk_pergunta_missao FOREIGN KEY (missao_id)
          REFERENCES missao (missao_id) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
  // Alternativas de cada pergunta (PERGUNTA 1:N ALTERNATIVA).
  // "correta_unica" é uma coluna gerada: vale 1 na alternativa correta e NULL nas demais.
  // Com o UNIQUE (pergunta_id, correta_unica), o próprio banco impede DUAS alternativas
  // corretas na mesma pergunta (NULLs não conflitam entre si).
  {
    nome: 'alternativa',
    ddl: `
      CREATE TABLE IF NOT EXISTS alternativa (
        alternativa_id  INT           NOT NULL AUTO_INCREMENT,
        pergunta_id     INT           NOT NULL,
        texto           VARCHAR(255)  NOT NULL,
        correta         TINYINT(1)    NOT NULL DEFAULT 0,
        ordem           TINYINT       NOT NULL DEFAULT 1,
        correta_unica   TINYINT(1)    GENERATED ALWAYS AS (IF(correta = 1, 1, NULL)) STORED,
        PRIMARY KEY (alternativa_id),
        UNIQUE KEY uk_alternativa_uma_correta (pergunta_id, correta_unica),
        CONSTRAINT fk_alternativa_pergunta FOREIGN KEY (pergunta_id)
          REFERENCES pergunta (pergunta_id) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  },
];

module.exports = { TABELAS };
