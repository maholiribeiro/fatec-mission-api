/**
 * Acesso às tabelas CONQUISTA e USUARIO_CONQUISTA.
 */
const db = require('../config/database');

/** Todas as conquistas, com status de desbloqueio para o usuário informado. */
async function findAllComStatus(usuarioId, conn = db) {
  const [rows] = await conn.query(
    `SELECT c.conquista_id, c.nome, c.descricao, c.icone, c.requisito,
            (uc.usuario_id IS NOT NULL) AS desbloqueada,
            uc.data_desbloqueio
       FROM conquista c
       LEFT JOIN usuario_conquista uc
              ON uc.conquista_id = c.conquista_id AND uc.usuario_id = ?
      ORDER BY c.conquista_id`,
    [usuarioId]
  );
  return rows;
}

/** Conquistas que o usuário AINDA NÃO desbloqueou. */
async function findBloqueadas(usuarioId, conn = db) {
  const [rows] = await conn.query(
    `SELECT c.*
       FROM conquista c
      WHERE NOT EXISTS (
        SELECT 1 FROM usuario_conquista uc
         WHERE uc.conquista_id = c.conquista_id AND uc.usuario_id = ?
      )
      ORDER BY c.conquista_id`,
    [usuarioId]
  );
  return rows;
}

/**
 * Registra o desbloqueio. INSERT IGNORE + PK composta (usuario_id, conquista_id)
 * impedem desbloqueio duplicado. Retorna true se inseriu.
 */
async function desbloquear(usuarioId, conquistaId, conn = db) {
  const [result] = await conn.query(
    'INSERT IGNORE INTO usuario_conquista (usuario_id, conquista_id) VALUES (?, ?)',
    [usuarioId, conquistaId]
  );
  return result.affectedRows > 0;
}

module.exports = { findAllComStatus, findBloqueadas, desbloquear };
