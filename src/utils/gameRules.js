/**
 * REGRAS DE NEGÓCIO DE XP — fonte única da verdade.
 *
 * - O XP de uma missão NÃO é escolhido pelo administrador: é derivado da dificuldade.
 *     Fácil = 75 | Médio = 100 | Difícil = 150
 * - Cada tentativa com erro aplica uma penalidade (valor negativo em HISTORICO.xp_variacao):
 *     Fácil = -15 | Médio = -25 | Difícil = -75
 * - Não existe sistema de níveis: o usuário apenas acumula XP (USUARIO.xp).
 */

const DIFICULDADES = Object.freeze(['Fácil', 'Médio', 'Difícil']);
const TIPOS = Object.freeze(['Tipo 1', 'Tipo 2', 'Tipo 3', 'Tipo 4']);
/** Tipo de missão que é um QUIZ (perguntas e alternativas respondidas no app). */
const TIPO_QUIZ = 'Tipo 2';
const STATUS_MISSAO = Object.freeze(['ativa', 'inativa']);
const RESULTADOS = Object.freeze(['sucesso', 'erro']);
const ROLES = Object.freeze(['estudante', 'administrador']);

const XP_POR_DIFICULDADE = Object.freeze({ 'Fácil': 75, 'Médio': 100, 'Difícil': 150 });
const PENALIDADE_POR_DIFICULDADE = Object.freeze({ 'Fácil': -15, 'Médio': -25, 'Difícil': -75 });

function assertDificuldade(dificuldade) {
  if (!DIFICULDADES.includes(dificuldade)) {
    throw new Error(`Dificuldade inválida: "${dificuldade}". Use: ${DIFICULDADES.join(', ')}.`);
  }
}

/** XP concedido ao concluir uma missão com sucesso. */
function xpDaMissao(dificuldade) {
  assertDificuldade(dificuldade);
  return XP_POR_DIFICULDADE[dificuldade];
}

/** Penalidade (sempre negativa) aplicada a cada erro. */
function penalidadeDaMissao(dificuldade) {
  assertDificuldade(dificuldade);
  return PENALIDADE_POR_DIFICULDADE[dificuldade];
}

/**
 * Variação de XP de uma tentativa, gravada em HISTORICO.xp_variacao
 * e somada diretamente em USUARIO.xp (positiva no sucesso, negativa no erro).
 */
function calcularVariacaoXp(dificuldade, resultado) {
  if (resultado === 'sucesso') return xpDaMissao(dificuldade);
  if (resultado === 'erro') return penalidadeDaMissao(dificuldade);
  throw new Error(`Resultado inválido: "${resultado}". Use: ${RESULTADOS.join(', ')}.`);
}

module.exports = {
  DIFICULDADES,
  TIPOS,
  TIPO_QUIZ,
  STATUS_MISSAO,
  RESULTADOS,
  ROLES,
  XP_POR_DIFICULDADE,
  PENALIDADE_POR_DIFICULDADE,
  xpDaMissao,
  penalidadeDaMissao,
  calcularVariacaoXp,
};
