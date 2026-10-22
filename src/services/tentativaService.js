/**
 * Infraestrutura compartilhada para registrar tentativas de missão
 * (conclusão comum/QR Code e respostas de quiz usam exatamente o mesmo fluxo).
 */
const db = require('../config/database');
const historicoModel = require('../models/historicoModel');
const usuarioModel = require('../models/usuarioModel');
const conquistaService = require('./conquistaService');

/** Executa `fn(conn)` em uma transação: commit no sucesso, rollback em qualquer erro. */
async function comTransacao(fn) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await fn(conn);
    await conn.commit();
    return resultado;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * REGRA DE NEGÓCIO — efeitos de uma tentativa (deve rodar dentro da transação,
 * com a linha do usuário já travada por SELECT ... FOR UPDATE):
 *  1. grava o HISTORICO com a variação de XP (positiva no sucesso, negativa no erro);
 *  2. soma a variação em USUARIO.xp;
 *  3. se for sucesso, verifica e desbloqueia conquistas.
 */
async function registrarTentativa(conn, { missao, usuario, resultado, xpVariacao }) {
  const usuarioId = usuario.usuario_id;
  const missaoId = missao.missao_id;

  const historicoId = await historicoModel.create({ usuarioId, missaoId, resultado, xpVariacao }, conn);
  await usuarioModel.incrementarXp(usuarioId, xpVariacao, conn);

  const conquistasDesbloqueadas =
    resultado === 'sucesso' ? await conquistaService.verificarEDesbloquear(usuarioId, conn) : [];

  return {
    historico: {
      historico_id: historicoId,
      usuario_id: usuarioId,
      missao_id: missaoId,
      resultado,
      xp_variacao: xpVariacao,
    },
    xp_total: usuario.xp + xpVariacao,
    conquistas_desbloqueadas: conquistasDesbloqueadas,
  };
}

module.exports = { comTransacao, registrarTentativa };
