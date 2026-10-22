const conquistaModel = require('../models/conquistaModel');
const historicoModel = require('../models/historicoModel');
const usuarioModel = require('../models/usuarioModel');
const { atingiuRequisito } = require('../utils/conquistaRules');

function formatar(c) {
  return { ...c, desbloqueada: Boolean(c.desbloqueada), data_desbloqueio: c.data_desbloqueio || null };
}

async function listarDoUsuario(usuarioId) {
  const conquistas = await conquistaModel.findAllComStatus(usuarioId);
  return conquistas.map(formatar);
}

/**
 * Monta as estatísticas do usuário usadas para avaliar os requisitos:
 * XP atual, total de missões concluídas e contagens por dificuldade/tipo.
 */
async function estatisticasDoUsuario(usuarioId, conn) {
  const [usuario, contagens] = await Promise.all([
    usuarioModel.findById(usuarioId, conn),
    historicoModel.contagemSucessos(usuarioId, conn),
  ]);

  const stats = { xp: usuario ? usuario.xp : 0, missoesConcluidas: 0, porDificuldade: {}, porTipo: {} };
  for (const { dificuldade, tipo, total } of contagens) {
    const n = Number(total);
    stats.missoesConcluidas += n;
    stats.porDificuldade[dificuldade] = (stats.porDificuldade[dificuldade] || 0) + n;
    stats.porTipo[tipo] = (stats.porTipo[tipo] || 0) + n;
  }
  return stats;
}

/**
 * REGRA DE NEGÓCIO: após cada sucesso, verifica todas as conquistas ainda bloqueadas
 * e desbloqueia (INSERT em USUARIO_CONQUISTA) as que tiveram o requisito atingido.
 * Deve ser chamada DENTRO da transação da conclusão, depois de o XP ter sido atualizado,
 * para que as estatísticas já considerem a missão recém-concluída.
 *
 * @returns {Promise<Array>} conquistas desbloqueadas nesta chamada
 */
async function verificarEDesbloquear(usuarioId, conn) {
  const bloqueadas = await conquistaModel.findBloqueadas(usuarioId, conn);
  if (!bloqueadas.length) return [];

  const stats = await estatisticasDoUsuario(usuarioId, conn);
  const novas = [];

  for (const conquista of bloqueadas) {
    if (atingiuRequisito(conquista.requisito, stats)) {
      const inseriu = await conquistaModel.desbloquear(usuarioId, conquista.conquista_id, conn);
      if (inseriu) novas.push(conquista);
    }
  }
  return novas;
}

module.exports = { listarDoUsuario, verificarEDesbloquear, estatisticasDoUsuario };
