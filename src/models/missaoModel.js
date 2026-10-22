/**
 * Acesso à tabela MISSAO.
 */
const db = require('../config/database');

/** Contadores por missão (usados na administração). */
const ESTATISTICAS_SQL = `
  (SELECT COUNT(*) FROM historico ht WHERE ht.missao_id = m.missao_id) AS total_tentativas,
  (SELECT COUNT(*) FROM historico hc WHERE hc.missao_id = m.missao_id AND hc.resultado = 'sucesso') AS total_conclusoes,
  (SELECT COUNT(*) FROM pergunta p WHERE p.missao_id = m.missao_id) AS total_perguntas`;

/**
 * Lista missões com filtros opcionais. Se `usuarioId` for informado, adiciona a flag
 * `concluida` (1/0) indicando se aquele usuário já tem um sucesso na missão.
 * Com `comEstatisticas`, inclui total de tentativas, conclusões e perguntas.
 */
async function findAll({ tipo, dificuldade, status, comEstatisticas = false } = {}, usuarioId = null, conn = db) {
  const where = [];
  const params = [];

  let concluidaSql = '0 AS concluida';
  if (usuarioId) {
    concluidaSql = `EXISTS (
        SELECT 1 FROM historico h
        WHERE h.missao_id = m.missao_id AND h.usuario_id = ? AND h.resultado = 'sucesso'
      ) AS concluida`;
    params.push(usuarioId);
  }

  if (tipo) {
    where.push('m.tipo = ?');
    params.push(tipo);
  }
  if (dificuldade) {
    where.push('m.dificuldade = ?');
    params.push(dificuldade);
  }
  if (status) {
    where.push('m.status = ?');
    params.push(status);
  }

  const [rows] = await conn.query(
    `SELECT m.*, ${concluidaSql}${comEstatisticas ? `, ${ESTATISTICAS_SQL}` : ''}
     FROM missao m
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY m.missao_id`,
    params
  );
  return rows;
}

async function findById(id, conn = db) {
  const [rows] = await conn.query('SELECT * FROM missao WHERE missao_id = ?', [id]);
  return rows[0] || null;
}

async function create({ titulo, descricao, dificuldade, tipo, xp, status, qr_code }, conn = db) {
  const [result] = await conn.query(
    `INSERT INTO missao (titulo, descricao, dificuldade, tipo, xp, status, qr_code)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [titulo, descricao ?? null, dificuldade, tipo, xp, status || 'ativa', qr_code ?? null]
  );
  return result.insertId;
}

async function update(id, { titulo, descricao, dificuldade, tipo, xp, status, qr_code }, conn = db) {
  const [result] = await conn.query(
    `UPDATE missao
        SET titulo = ?, descricao = ?, dificuldade = ?, tipo = ?, xp = ?, status = ?, qr_code = ?
      WHERE missao_id = ?`,
    [titulo, descricao ?? null, dificuldade, tipo, xp, status, qr_code ?? null, id]
  );
  return result.affectedRows > 0;
}

async function updateStatus(id, status, conn = db) {
  const [result] = await conn.query('UPDATE missao SET status = ? WHERE missao_id = ?', [status, id]);
  return result.affectedRows > 0;
}

async function estatisticas(id, conn = db) {
  const [[row]] = await conn.query(`SELECT ${ESTATISTICAS_SQL} FROM missao m WHERE m.missao_id = ?`, [id]);
  return row || null;
}

/** Remove a missão (perguntas/alternativas vão junto por CASCADE). */
async function remove(id, conn = db) {
  const [result] = await conn.query('DELETE FROM missao WHERE missao_id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { findAll, findById, create, update, updateStatus, estatisticas, remove };
