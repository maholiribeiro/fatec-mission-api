/**
 * RANKING não é uma tabela: é uma consulta sobre USUARIO ordenada por XP.
 * Apenas estudantes participam. Não há níveis — só o XP acumulado.
 */
const db = require('../config/database');

async function listar({ curso, limite = 50, pagina = 1 } = {}, conn = db) {
  const params = [];
  let filtro = "WHERE role = 'estudante'";
  if (curso) {
    filtro += ' AND curso = ?';
    params.push(curso);
  }
  params.push(limite, (pagina - 1) * limite);

  const [rows] = await conn.query(
    `SELECT usuario_id, nome, curso, semestre, xp
       FROM usuario
       ${filtro}
      ORDER BY xp DESC, nome ASC
      LIMIT ? OFFSET ?`,
    params
  );
  return rows;
}

/** Quantos estudantes (do curso, se informado) têm XP maior que `xp` → base da posição com empates. */
async function contarComXpMaior(xp, curso, conn = db) {
  const params = [xp];
  let sql = "SELECT COUNT(*) AS total FROM usuario WHERE role = 'estudante' AND xp > ?";
  if (curso) {
    sql += ' AND curso = ?';
    params.push(curso);
  }
  const [rows] = await conn.query(sql, params);
  return rows[0].total;
}

async function contar(curso, conn = db) {
  const params = [];
  let sql = "SELECT COUNT(*) AS total FROM usuario WHERE role = 'estudante'";
  if (curso) {
    sql += ' AND curso = ?';
    params.push(curso);
  }
  const [rows] = await conn.query(sql, params);
  return rows[0].total;
}

module.exports = { listar, contarComXpMaior, contar };
