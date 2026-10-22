const { calcularPontuacaoQuiz } = require('../../src/utils/quizRules');

describe('calcularPontuacaoQuiz', () => {
  test('exemplo da especificação: 150 XP / 4 perguntas = 37,5 XP por pergunta', () => {
    expect(calcularPontuacaoQuiz(150, 4, 4)).toEqual({
      acertos: 4,
      total: 4,
      percentual: 100,
      xp_por_pergunta: 37.5,
      xp_obtido: 150,
    });
  });

  test.each([
    [0, 0],
    [1, 38], // 37,5 → 38
    [2, 75],
    [3, 113], // 112,5 → 113
    [4, 150],
  ])('150 XP / 4 perguntas com %i acerto(s) → %i XP', (acertos, xp) => {
    expect(calcularPontuacaoQuiz(150, 4, acertos).xp_obtido).toBe(xp);
  });

  test('arredonda só o total: acertar tudo sempre dá o XP cheio (100 XP / 3 perguntas)', () => {
    const r = calcularPontuacaoQuiz(100, 3, 3);
    expect(r.xp_por_pergunta).toBe(33.33);
    expect(r.xp_obtido).toBe(100);
    expect(calcularPontuacaoQuiz(100, 3, 2).xp_obtido).toBe(67);
    expect(calcularPontuacaoQuiz(100, 3, 1).percentual).toBe(33.33);
  });

  test('quiz Fácil (75 XP) com 2 perguntas, 1 acerto → 38 XP (37,5 arredondado)', () => {
    expect(calcularPontuacaoQuiz(75, 2, 1).xp_obtido).toBe(38);
  });

  test('entradas inválidas lançam erro', () => {
    expect(() => calcularPontuacaoQuiz(150, 0, 0)).toThrow(/ao menos uma pergunta/);
    expect(() => calcularPontuacaoQuiz(150, 4, 5)).toThrow(/acertos inválida/);
    expect(() => calcularPontuacaoQuiz(150, 4, -1)).toThrow(/acertos inválida/);
    expect(() => calcularPontuacaoQuiz(-10, 4, 1)).toThrow(/XP total inválido/);
  });
});
