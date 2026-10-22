/**
 * Acesso às tabelas PERGUNTA e ALTERNATIVA (quiz).
 * Todas as funções aceitam um `conn` opcional para participar de uma transação.
 */
const db = require('../config/database');

// ------------------------------------------------------------------ perguntas

async function findPerguntasByMissao(missaoId, conn = db) {
  const [rows] = await conn.query(
    `SELECT pergunta_id, missao_id, enunciado, ordem
       FROM pergunta
      WHERE missao_id = ?
      ORDER BY ordem, pergunta_id`,
    [missaoId]
  );
  return rows;
}

async function findPerguntaById(perguntaId, conn = db) {
  const [rows] = await conn.query(
    'SELECT pergunta_id, missao_id, enunciado, ordem FROM pergunta WHERE pergunta_id = ?',
    [perguntaId]
  );
  return rows[0] || null;
}

async function contarPerguntas(missaoId, conn = db) {
  const [[row]] = await conn.query('SELECT COUNT(*) AS total FROM pergunta WHERE missao_id = ?', [missaoId]);
  return Number(row.total);
}

/** Próxima posição livre no quiz (usada quando a ordem não é informada). */
async function proximaOrdem(missaoId, conn = db) {
  const [[row]] = await conn.query(
    'SELECT COALESCE(MAX(ordem), 0) + 1 AS proxima FROM pergunta WHERE missao_id = ?',
    [missaoId]
  );
  return Number(row.proxima);
}

async function createPergunta({ missaoId, enunciado, ordem }, conn = db) {
  const [result] = await conn.query(
    'INSERT INTO pergunta (missao_id, enunciado, ordem) VALUES (?, ?, ?)',
    [missaoId, enunciado, ordem]
  );
  return result.insertId;
}

async function updatePergunta(perguntaId, { missaoId, enunciado, ordem }, conn = db) {
  await conn.query(
    'UPDATE pergunta SET missao_id = ?, enunciado = ?, ordem = ? WHERE pergunta_id = ?',
    [missaoId, enunciado, ordem, perguntaId]
  );
}

/** Remove a pergunta; as alternativas vão junto (ON DELETE CASCADE). */
async function deletePergunta(perguntaId, conn = db) {
  const [result] = await conn.query('DELETE FROM pergunta WHERE pergunta_id = ?', [perguntaId]);
  return result.affectedRows > 0;
}

// ------------------------------------------------------------------ alternativas

/** Alternativas de várias perguntas de uma vez (evita N+1 consultas). */
async function findAlternativasByPerguntas(perguntaIds, conn = db) {
  if (!perguntaIds.length) return [];
  const [rows] = await conn.query(
    `SELECT alternativa_id, pergunta_id, texto, correta, ordem
       FROM alternativa
      WHERE pergunta_id IN (?)
      ORDER BY pergunta_id, ordem, alternativa_id`,
    [perguntaIds]
  );
  return rows.map((a) => ({ ...a, correta: Boolean(a.correta) }));
}

async function findAlternativaById(alternativaId, conn = db) {
  const [rows] = await conn.query(
    'SELECT alternativa_id, pergunta_id, texto, correta, ordem FROM alternativa WHERE alternativa_id = ?',
    [alternativaId]
  );
  return rows[0] ? { ...rows[0], correta: Boolean(rows[0].correta) } : null;
}

/** Insere as alternativas na ordem recebida (ordem 1, 2, 3...). */
async function createAlternativas(perguntaId, alternativas, conn = db) {
  const valores = alternativas.map((a, i) => [perguntaId, a.texto, a.correta ? 1 : 0, i + 1]);
  await conn.query('INSERT INTO alternativa (pergunta_id, texto, correta, ordem) VALUES ?', [valores]);
}

async function deleteAlternativasByPergunta(perguntaId, conn = db) {
  await conn.query('DELETE FROM alternativa WHERE pergunta_id = ?', [perguntaId]);
}

/**
 * Marca UMA alternativa como correta. Primeiro desmarca todas da pergunta e depois
 * marca a escolhida — nessa ordem, para não violar o UNIQUE de "uma correta por pergunta".
 */
async function definirCorreta(perguntaId, alternativaId, conn = db) {
  await conn.query('UPDATE alternativa SET correta = 0 WHERE pergunta_id = ?', [perguntaId]);
  await conn.query(
    'UPDATE alternativa SET correta = 1 WHERE alternativa_id = ? AND pergunta_id = ?',
    [alternativaId, perguntaId]
  );
}

module.exports = {
  findPerguntasByMissao,
  findPerguntaById,
  contarPerguntas,
  proximaOrdem,
  createPergunta,
  updatePergunta,
  deletePergunta,
  findAlternativasByPerguntas,
  findAlternativaById,
  createAlternativas,
  deleteAlternativasByPergunta,
  definirCorreta,
};
