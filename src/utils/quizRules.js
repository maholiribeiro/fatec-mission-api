/**
 * REGRAS DE PONTUAÇÃO DO QUIZ.
 *
 * O XP da missão (definido pela dificuldade) vale 100% do quiz e é dividido igualmente
 * entre as perguntas:
 *
 *     xp_por_pergunta = xp_total / total_de_perguntas
 *     xp_obtido       = arredondar(acertos × xp_por_pergunta)
 *
 * Ex.: quiz Difícil (150 XP) com 4 perguntas → 37,5 XP por pergunta;
 *      3 acertos → 112,5 → 113 XP.
 *
 * O arredondamento é feito só no total (e não pergunta a pergunta) para não acumular
 * erro: acertar tudo sempre resulta exatamente no XP cheio da missão.
 */

const arredondar2 = (n) => Math.round(n * 100) / 100;

function calcularPontuacaoQuiz(xpTotal, totalPerguntas, acertos) {
  if (!Number.isInteger(totalPerguntas) || totalPerguntas < 1) {
    throw new Error('O quiz precisa ter ao menos uma pergunta.');
  }
  if (!Number.isInteger(acertos) || acertos < 0 || acertos > totalPerguntas) {
    throw new Error(`Quantidade de acertos inválida: ${acertos} de ${totalPerguntas}.`);
  }
  if (!Number.isFinite(xpTotal) || xpTotal < 0) {
    throw new Error(`XP total inválido: ${xpTotal}.`);
  }

  const xpPorPergunta = xpTotal / totalPerguntas;
  return {
    acertos,
    total: totalPerguntas,
    percentual: arredondar2((acertos / totalPerguntas) * 100),
    xp_por_pergunta: arredondar2(xpPorPergunta),
    xp_obtido: Math.round(acertos * xpPorPergunta),
  };
}

module.exports = { calcularPontuacaoQuiz };
