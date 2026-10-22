jest.mock('../../src/config/database', () => ({}));
jest.mock('../../src/models/conquistaModel');
jest.mock('../../src/models/historicoModel');
jest.mock('../../src/models/usuarioModel');

const conquistaModel = require('../../src/models/conquistaModel');
const historicoModel = require('../../src/models/historicoModel');
const usuarioModel = require('../../src/models/usuarioModel');
const conquistaService = require('../../src/services/conquistaService');

const conn = { fake: 'conn' };

const CONQUISTAS = [
  { conquista_id: 1, nome: 'Primeiros Passos', requisito: 'missoes:1' },
  { conquista_id: 2, nome: 'Explorador', requisito: 'missoes:5' },
  { conquista_id: 3, nome: 'Colecionador', requisito: 'xp:300' },
  { conquista_id: 4, nome: 'Destemido', requisito: 'dificuldade:Difícil:1' },
  { conquista_id: 5, nome: 'Manual', requisito: null },
];

beforeEach(() => {
  jest.resetAllMocks();
  conquistaModel.desbloquear.mockResolvedValue(true);
});

describe('conquistaService.verificarEDesbloquear', () => {
  test('desbloqueia apenas as conquistas bloqueadas cujo requisito foi atingido', async () => {
    conquistaModel.findBloqueadas.mockResolvedValue(CONQUISTAS);
    usuarioModel.findById.mockResolvedValue({ usuario_id: 7, xp: 325 });
    historicoModel.contagemSucessos.mockResolvedValue([
      { dificuldade: 'Fácil', tipo: 'Tipo 1', total: 1 },
      { dificuldade: 'Difícil', tipo: 'Tipo 2', total: 1 },
    ]);

    const novas = await conquistaService.verificarEDesbloquear(7, conn);

    expect(novas.map((c) => c.conquista_id)).toEqual([1, 3, 4]);
    expect(conquistaModel.desbloquear).toHaveBeenCalledTimes(3);
    expect(conquistaModel.desbloquear).toHaveBeenCalledWith(7, 1, conn);
    expect(conquistaModel.desbloquear).not.toHaveBeenCalledWith(7, 2, conn);
    expect(conquistaModel.desbloquear).not.toHaveBeenCalledWith(7, 5, conn);
  });

  test('não consulta estatísticas se não houver conquistas bloqueadas', async () => {
    conquistaModel.findBloqueadas.mockResolvedValue([]);

    expect(await conquistaService.verificarEDesbloquear(7, conn)).toEqual([]);
    expect(historicoModel.contagemSucessos).not.toHaveBeenCalled();
  });

  test('não retorna conquista se o INSERT foi ignorado (já desbloqueada em paralelo)', async () => {
    conquistaModel.findBloqueadas.mockResolvedValue([CONQUISTAS[0]]);
    usuarioModel.findById.mockResolvedValue({ usuario_id: 7, xp: 75 });
    historicoModel.contagemSucessos.mockResolvedValue([{ dificuldade: 'Fácil', tipo: 'Tipo 1', total: 1 }]);
    conquistaModel.desbloquear.mockResolvedValue(false);

    expect(await conquistaService.verificarEDesbloquear(7, conn)).toEqual([]);
  });
});

describe('conquistaService.estatisticasDoUsuario', () => {
  test('agrega contagens por dificuldade e por tipo', async () => {
    usuarioModel.findById.mockResolvedValue({ usuario_id: 7, xp: 500 });
    historicoModel.contagemSucessos.mockResolvedValue([
      { dificuldade: 'Fácil', tipo: 'Tipo 1', total: 2 },
      { dificuldade: 'Fácil', tipo: 'Tipo 2', total: 1 },
      { dificuldade: 'Médio', tipo: 'Tipo 1', total: 3 },
    ]);

    const stats = await conquistaService.estatisticasDoUsuario(7, conn);

    expect(stats).toEqual({
      xp: 500,
      missoesConcluidas: 6,
      porDificuldade: { 'Fácil': 3, 'Médio': 3 },
      porTipo: { 'Tipo 1': 5, 'Tipo 2': 1 },
    });
  });
});
