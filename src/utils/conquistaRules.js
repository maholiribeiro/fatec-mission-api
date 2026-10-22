/**
 * REGRAS DE DESBLOQUEIO DE CONQUISTAS.
 *
 * A coluna CONQUISTA.requisito (VARCHAR 255) guarda uma regra legível por máquina.
 * Formatos suportados (sem diferenciar maiúsculas no prefixo):
 *
 *   missoes:N                  → concluiu pelo menos N missões distintas
 *   xp:N                       → possui pelo menos N de XP acumulado
 *   dificuldade:<Dificuldade>:N → concluiu N missões daquela dificuldade (ex.: dificuldade:Difícil:3)
 *   tipo:<Tipo>:N              → concluiu N missões daquele tipo        (ex.: tipo:Tipo 2:5)
 *
 * Requisito nulo, vazio ou em formato desconhecido → a conquista NÃO é desbloqueada
 * automaticamente (fica reservada para concessão manual/futura).
 */

const { DIFICULDADES, TIPOS } = require('./gameRules');

/**
 * Converte o texto do requisito em um objeto { tipo, alvo?, quantidade } ou null se inválido.
 */
function parseRequisito(requisito) {
  if (typeof requisito !== 'string' || !requisito.trim()) return null;
  const partes = requisito.split(':').map((p) => p.trim());
  const chave = partes[0].toLowerCase();

  const inteiroPositivo = (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n > 0 ? n : null;
  };

  if ((chave === 'missoes' || chave === 'xp') && partes.length === 2) {
    const quantidade = inteiroPositivo(partes[1]);
    return quantidade ? { tipo: chave, quantidade } : null;
  }

  if (chave === 'dificuldade' && partes.length === 3 && DIFICULDADES.includes(partes[1])) {
    const quantidade = inteiroPositivo(partes[2]);
    return quantidade ? { tipo: 'dificuldade', alvo: partes[1], quantidade } : null;
  }

  if (chave === 'tipo' && partes.length === 3 && TIPOS.includes(partes[1])) {
    const quantidade = inteiroPositivo(partes[2]);
    return quantidade ? { tipo: 'tipo', alvo: partes[1], quantidade } : null;
  }

  return null;
}

/**
 * Verifica se as estatísticas do usuário satisfazem o requisito.
 * @param {string|null} requisito
 * @param {{ xp:number, missoesConcluidas:number,
 *           porDificuldade:Record<string,number>, porTipo:Record<string,number> }} stats
 */
function atingiuRequisito(requisito, stats) {
  const regra = parseRequisito(requisito);
  if (!regra) return false;

  switch (regra.tipo) {
    case 'missoes':
      return stats.missoesConcluidas >= regra.quantidade;
    case 'xp':
      return stats.xp >= regra.quantidade;
    case 'dificuldade':
      return (stats.porDificuldade[regra.alvo] || 0) >= regra.quantidade;
    case 'tipo':
      return (stats.porTipo[regra.alvo] || 0) >= regra.quantidade;
    default:
      return false;
  }
}

module.exports = { parseRequisito, atingiuRequisito };
