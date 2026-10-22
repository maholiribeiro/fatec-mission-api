const { parseRequisito, atingiuRequisito } = require('../../src/utils/conquistaRules');

const stats = {
  xp: 400,
  missoesConcluidas: 4,
  porDificuldade: { 'Fácil': 2, 'Difícil': 2 },
  porTipo: { 'Tipo 1': 3, 'Tipo 2': 1 },
};

describe('parseRequisito', () => {
  test('interpreta os formatos suportados', () => {
    expect(parseRequisito('missoes:5')).toEqual({ tipo: 'missoes', quantidade: 5 });
    expect(parseRequisito('XP:500')).toEqual({ tipo: 'xp', quantidade: 500 });
    expect(parseRequisito('dificuldade:Difícil:3')).toEqual({ tipo: 'dificuldade', alvo: 'Difícil', quantidade: 3 });
    expect(parseRequisito('tipo:Tipo 2:1')).toEqual({ tipo: 'tipo', alvo: 'Tipo 2', quantidade: 1 });
  });

  test.each([null, '', '   ', 'missoes', 'missoes:0', 'missoes:-2', 'xp:abc', 'dificuldade:Épica:1', 'tipo:Tipo 9:1', 'qualquer coisa'])(
    'requisito inválido/desconhecido (%p) retorna null',
    (req) => {
      expect(parseRequisito(req)).toBeNull();
    }
  );
});

describe('atingiuRequisito', () => {
  test('missões concluídas', () => {
    expect(atingiuRequisito('missoes:4', stats)).toBe(true);
    expect(atingiuRequisito('missoes:5', stats)).toBe(false);
  });

  test('XP acumulado', () => {
    expect(atingiuRequisito('xp:400', stats)).toBe(true);
    expect(atingiuRequisito('xp:401', stats)).toBe(false);
  });

  test('por dificuldade', () => {
    expect(atingiuRequisito('dificuldade:Difícil:2', stats)).toBe(true);
    expect(atingiuRequisito('dificuldade:Difícil:3', stats)).toBe(false);
    expect(atingiuRequisito('dificuldade:Médio:1', stats)).toBe(false);
  });

  test('por tipo', () => {
    expect(atingiuRequisito('tipo:Tipo 1:3', stats)).toBe(true);
    expect(atingiuRequisito('tipo:Tipo 4:1', stats)).toBe(false);
  });

  test('requisito ausente nunca é desbloqueado automaticamente', () => {
    expect(atingiuRequisito(null, stats)).toBe(false);
  });
});
