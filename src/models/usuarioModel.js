/**
 * Acesso à tabela USUARIO.
 * Todas as funções aceitam um `conn` opcional para participar de uma transação.
 */
const db = require('../config/database');

const CAMPOS_PUBLICOS = 'usuario_id, nome, email, curso, semestre, xp, role';

async function findByEmail(email, conn = db) {
  const [rows] = await conn.query('SELECT * FROM usuario WHERE email = ?', [email]);
  return rows[0] || null;
}

async function findById(id, conn = db) {
  const [rows] = await conn.query(`SELECT ${CAMPOS_PUBLICOS} FROM usuario WHERE usuario_id = ?`, [id]);
  return rows[0] || null;
}

/**
 * Lê o usuário com lock de linha (SELECT ... FOR UPDATE).
 * Serializa tentativas simultâneas do MESMO usuário, garantindo a regra de "um único sucesso
 * por missão" mesmo com requisições concorrentes (ex.: duplo clique).
 */
async function findByIdForUpdate(id, conn) {
  const [rows] = await conn.query(
    `SELECT ${CAMPOS_PUBLICOS} FROM usuario WHERE usuario_id = ? FOR UPDATE`,
    [id]
  );
  return rows[0] || null;
}

async function create({ nome, email, senhaHash, curso, semestre, role = 'estudante' }, conn = db) {
  const [result] = await conn.query(
    `INSERT INTO usuario (nome, email, senha_hash, curso, semestre, role)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nome, email, senhaHash, curso, semestre, role]
  );
  return result.insertId;
}

/** Soma (ou subtrai, se negativo) a variação de XP no total do usuário. */
async function incrementarXp(id, variacao, conn = db) {
  await conn.query('UPDATE usuario SET xp = xp + ? WHERE usuario_id = ?', [variacao, id]);
}

/**
 * Posição do estudante no ranking geral (1 = maior XP). Empates compartilham a posição.
 * Administradores não participam do ranking → retorna null.
 */
async function posicaoNoRanking(id, conn = db) {
  const [rows] = await conn.query(
    `SELECT 1 + (
        SELECT COUNT(*) FROM usuario o WHERE o.role = 'estudante' AND o.xp > u.xp
      ) AS posicao
     FROM usuario u
     WHERE u.usuario_id = ? AND u.role = 'estudante'`,
    [id]
  );
  return rows[0] ? rows[0].posicao : null;
}

/**
 * Todos os usuários com estatísticas, para a administração (exportação CSV).
 * Nunca inclui senha_hash.
 */
async function listarComEstatisticas(conn = db) {
  const [rows] = await conn.query(`
    SELECT u.usuario_id, u.nome, u.email, u.curso, u.semestre, u.role, u.xp,
           COALESCE(h.tentativas, 0) AS tentativas,
           COALESCE(h.conclusoes, 0) AS missoes_concluidas,
           COALESCE(h.erros, 0)      AS erros,
           COALESCE(c.conquistas, 0) AS conquistas
      FROM usuario u
      LEFT JOIN (
        SELECT usuario_id, COUNT(*) AS tentativas,
               SUM(resultado = 'sucesso') AS conclusoes, SUM(resultado = 'erro') AS erros
          FROM historico GROUP BY usuario_id
      ) h ON h.usuario_id = u.usuario_id
      LEFT JOIN (
        SELECT usuario_id, COUNT(*) AS conquistas FROM usuario_conquista GROUP BY usuario_id
      ) c ON c.usuario_id = u.usuario_id
     ORDER BY u.role DESC, u.xp DESC, u.nome`);
  return rows.map((r) => ({
    ...r,
    tentativas: Number(r.tentativas),
    missoes_concluidas: Number(r.missoes_concluidas),
    erros: Number(r.erros),
    conquistas: Number(r.conquistas),
  }));
}

module.exports = {
  findByEmail,
  findById,
  findByIdForUpdate,
  create,
  incrementarXp,
  posicaoNoRanking,
  listarComEstatisticas,
};
