/**
 * Consultas agregadas para o painel administrativo.
 */
const db = require('../config/database');

async function indicadores(conn = db) {
  const [[row]] = await conn.query(`
    SELECT
      (SELECT COUNT(*) FROM usuario)                                   AS total_usuarios,
      (SELECT COUNT(*) FROM usuario WHERE role = 'estudante')          AS total_estudantes,
      (SELECT COUNT(*) FROM usuario WHERE role = 'administrador')      AS total_administradores,
      (SELECT COUNT(DISTINCT h.usuario_id)
         FROM historico h JOIN usuario u ON u.usuario_id = h.usuario_id
        WHERE u.role = 'estudante')                                   AS estudantes_ativos,
      (SELECT COUNT(*) FROM missao)                                    AS total_missoes,
      (SELECT COUNT(*) FROM missao WHERE status = 'ativa')             AS missoes_ativas,
      (SELECT COALESCE(SUM(xp_variacao), 0) FROM historico WHERE xp_variacao > 0) AS xp_distribuido,
      (SELECT COALESCE(SUM(xp_variacao), 0) FROM historico WHERE xp_variacao < 0) AS xp_penalidades,
      (SELECT COUNT(*) FROM historico)                                 AS total_tentativas,
      (SELECT COUNT(*) FROM historico WHERE resultado = 'sucesso')     AS total_sucessos,
      (SELECT COUNT(*)
         FROM historico h
         JOIN missao m  ON m.missao_id  = h.missao_id
         JOIN usuario u ON u.usuario_id = h.usuario_id
        WHERE h.resultado = 'sucesso' AND m.status = 'ativa' AND u.role = 'estudante') AS conclusoes_missoes_ativas,
      (SELECT COUNT(*) FROM usuario_conquista)                         AS conquistas_desbloqueadas
  `);
  return row;
}

async function missoesMaisConcluidas(limite = 5, conn = db) {
  const [rows] = await conn.query(
    `SELECT m.missao_id, m.titulo, COUNT(*) AS conclusoes
       FROM historico h
       JOIN missao m ON m.missao_id = h.missao_id
      WHERE h.resultado = 'sucesso'
      GROUP BY m.missao_id, m.titulo
      ORDER BY conclusoes DESC, m.missao_id
      LIMIT ?`,
    [limite]
  );
  return rows;
}

/** TODAS as missões com conclusões, tentativas e erros — da mais realizada para a menos. */
async function missoesRealizadas(conn = db) {
  const [rows] = await conn.query(`
    SELECT m.missao_id, m.titulo, m.tipo, m.dificuldade, m.status,
           COALESCE(SUM(h.resultado = 'sucesso'), 0) AS conclusoes,
           COALESCE(SUM(h.resultado = 'erro'), 0)    AS erros,
           COUNT(h.historico_id)                      AS tentativas
      FROM missao m
      LEFT JOIN historico h ON h.missao_id = m.missao_id
     GROUP BY m.missao_id, m.titulo, m.tipo, m.dificuldade, m.status
     ORDER BY conclusoes DESC, tentativas DESC, m.titulo`);
  return rows;
}

/** Participação por curso: estudantes, ativos (com ao menos 1 tentativa), conclusões e XP. */
async function participacaoPorCurso(conn = db) {
  const [rows] = await conn.query(`
    SELECT u.curso,
           COUNT(*)                                    AS estudantes,
           SUM(COALESCE(h.tentativas, 0) > 0)          AS ativos,
           COALESCE(SUM(h.conclusoes), 0)              AS conclusoes,
           COALESCE(SUM(u.xp), 0)                      AS xp_total
      FROM usuario u
      LEFT JOIN (
        SELECT usuario_id, COUNT(*) AS tentativas, SUM(resultado = 'sucesso') AS conclusoes
          FROM historico GROUP BY usuario_id
      ) h ON h.usuario_id = u.usuario_id
     WHERE u.role = 'estudante'
     GROUP BY u.curso
     ORDER BY estudantes DESC, u.curso`);
  return rows;
}

module.exports = { indicadores, missoesMaisConcluidas, missoesRealizadas, participacaoPorCurso };
