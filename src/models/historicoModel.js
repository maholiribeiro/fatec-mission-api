/**
 * Acesso à tabela HISTORICO (tentativas de missões).
 */
const db = require('../config/database');

/** Regra de negócio: só pode existir UM sucesso por par usuario_id/missao_id. */
async function existeSucesso(usuarioId, missaoId, conn = db) {
  const [rows] = await conn.query(
    `SELECT 1 FROM historico
      WHERE usuario_id = ? AND missao_id = ? AND resultado = 'sucesso'
      LIMIT 1`,
    [usuarioId, missaoId]
  );
  return rows.length > 0;
}

async function create({ usuarioId, missaoId, resultado, xpVariacao }, conn = db) {
  const [result] = await conn.query(
    `INSERT INTO historico (usuario_id, missao_id, resultado, xp_variacao)
     VALUES (?, ?, ?, ?)`,
    [usuarioId, missaoId, resultado, xpVariacao]
  );
  return result.insertId;
}

/** Missões concluídas (com sucesso) pelo usuário. */
async function missoesConcluidas(usuarioId, conn = db) {
  const [rows] = await conn.query(
    `SELECT m.missao_id, m.titulo, m.dificuldade, m.tipo, h.xp_variacao AS xp_ganho
       FROM historico h
       JOIN missao m ON m.missao_id = h.missao_id
      WHERE h.usuario_id = ? AND h.resultado = 'sucesso'
      ORDER BY h.historico_id`,
    [usuarioId]
  );
  return rows;
}

/**
 * Contagem de missões concluídas por dificuldade e por tipo — base para
 * avaliar os requisitos das conquistas.
 */
async function contagemSucessos(usuarioId, conn = db) {
  const [rows] = await conn.query(
    `SELECT m.dificuldade, m.tipo, COUNT(*) AS total
       FROM historico h
       JOIN missao m ON m.missao_id = h.missao_id
      WHERE h.usuario_id = ? AND h.resultado = 'sucesso'
      GROUP BY m.dificuldade, m.tipo`,
    [usuarioId]
  );
  return rows;
}

module.exports = { existeSucesso, create, missoesConcluidas, contagemSucessos };
