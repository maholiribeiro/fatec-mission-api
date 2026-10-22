const {
  xpDaMissao,
  penalidadeDaMissao,
  calcularVariacaoXp,
} = require('../../src/utils/gameRules');

describe('Regras de XP', () => {
  test.each([
    ['Fácil', 75],
    ['Médio', 100],
    ['Difícil', 150],
  ])('missão %s concede %i XP', (dificuldade, xp) => {
    expect(xpDaMissao(dificuldade)).toBe(xp);
    expect(calcularVariacaoXp(dificuldade, 'sucesso')).toBe(xp);
  });

  test.each([
    ['Fácil', -15],
    ['Médio', -25],
    ['Difícil', -75],
  ])('erro em missão %s aplica penalidade de %i XP', (dificuldade, penalidade) => {
    expect(penalidadeDaMissao(dificuldade)).toBe(penalidade);
    expect(calcularVariacaoXp(dificuldade, 'erro')).toBe(penalidade);
  });

  test('penalidade é sempre negativa e ganho sempre positivo', () => {
    for (const d of ['Fácil', 'Médio', 'Difícil']) {
      expect(calcularVariacaoXp(d, 'sucesso')).toBeGreaterThan(0);
      expect(calcularVariacaoXp(d, 'erro')).toBeLessThan(0);
    }
  });

  test('dificuldade ou resultado inválidos lançam erro', () => {
    expect(() => xpDaMissao('Impossível')).toThrow(/Dificuldade inválida/);
    expect(() => calcularVariacaoXp('Fácil', 'talvez')).toThrow(/Resultado inválido/);
  });
});
