/**
 * Testa a regra de negócio central (POST /missoes/:id/concluir) com o banco mockado:
 * cálculo de XP, penalidades, sucesso único por missão, QR Code, transação e conquistas.
 */
jest.mock('../../src/config/database', () => ({ getConnection: jest.fn() }));
jest.mock('../../src/models/missaoModel');
jest.mock('../../src/models/usuarioModel');
jest.mock('../../src/models/historicoModel');
jest.mock('../../src/models/quizModel');
jest.mock('../../src/services/conquistaService');

const db = require('../../src/config/database');
const quizModel = require('../../src/models/quizModel');
const missaoModel = require('../../src/models/missaoModel');
const usuarioModel = require('../../src/models/usuarioModel');
const historicoModel = require('../../src/models/historicoModel');
const conquistaService = require('../../src/services/conquistaService');
const missaoService = require('../../src/services/missaoService');

const conn = {
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
};

function missao(extra = {}) {
  return { missao_id: 1, titulo: 'M', dificuldade: 'Médio', tipo: 'Tipo 4', xp: 100, status: 'ativa', qr_code: null, ...extra };
}

beforeEach(() => {
  jest.resetAllMocks();
  db.getConnection.mockResolvedValue(conn);
  usuarioModel.findByIdForUpdate.mockResolvedValue({ usuario_id: 7, xp: 200, role: 'estudante' });
  historicoModel.existeSucesso.mockResolvedValue(false);
  historicoModel.create.mockResolvedValue(99);
  conquistaService.verificarEDesbloquear.mockResolvedValue([]);
});

describe('missaoService.concluir', () => {
  test.each([
    ['Fácil', 75],
    ['Médio', 100],
    ['Difícil', 150],
  ])('sucesso em missão %s soma %i XP ao usuário', async (dificuldade, xp) => {
    missaoModel.findById.mockResolvedValue(missao({ dificuldade }));

    const r = await missaoService.concluir(1, 7, { resultado: 'sucesso' });

    expect(historicoModel.create).toHaveBeenCalledWith(
      { usuarioId: 7, missaoId: 1, resultado: 'sucesso', xpVariacao: xp },
      conn
    );
    expect(usuarioModel.incrementarXp).toHaveBeenCalledWith(7, xp, conn);
    expect(r.xp_total).toBe(200 + xp);
    expect(r.historico.xp_variacao).toBe(xp);
    expect(conn.commit).toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  test.each([
    ['Fácil', -15],
    ['Médio', -25],
    ['Difícil', -75],
  ])('erro em missão %s subtrai %i XP e não verifica conquistas', async (dificuldade, penalidade) => {
    missaoModel.findById.mockResolvedValue(missao({ dificuldade }));

    const r = await missaoService.concluir(1, 7, { resultado: 'erro' });

    expect(historicoModel.create).toHaveBeenCalledWith(
      { usuarioId: 7, missaoId: 1, resultado: 'erro', xpVariacao: penalidade },
      conn
    );
    expect(usuarioModel.incrementarXp).toHaveBeenCalledWith(7, penalidade, conn);
    expect(r.xp_total).toBe(200 + penalidade);
    expect(conquistaService.verificarEDesbloquear).not.toHaveBeenCalled();
  });

  test('segundo sucesso na mesma missão é rejeitado com 409 e faz rollback', async () => {
    missaoModel.findById.mockResolvedValue(missao());
    historicoModel.existeSucesso.mockResolvedValue(true);

    await expect(missaoService.concluir(1, 7, { resultado: 'sucesso' })).rejects.toMatchObject({ status: 409 });

    expect(historicoModel.create).not.toHaveBeenCalled();
    expect(usuarioModel.incrementarXp).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
    expect(conn.commit).not.toHaveBeenCalled();
    expect(conn.release).toHaveBeenCalled();
  });

  test('erros podem ser registrados mesmo após já existir sucesso (não consulta sucesso)', async () => {
    missaoModel.findById.mockResolvedValue(missao());
    historicoModel.existeSucesso.mockResolvedValue(true);

    await missaoService.concluir(1, 7, { resultado: 'erro' });

    expect(historicoModel.existeSucesso).not.toHaveBeenCalled();
    expect(historicoModel.create).toHaveBeenCalled();
  });

  test('sucesso dispara a verificação de conquistas e retorna as desbloqueadas', async () => {
    missaoModel.findById.mockResolvedValue(missao());
    const conquista = { conquista_id: 1, nome: 'Primeiros Passos', requisito: 'missoes:1' };
    conquistaService.verificarEDesbloquear.mockResolvedValue([conquista]);

    const r = await missaoService.concluir(1, 7, { resultado: 'sucesso' });

    expect(conquistaService.verificarEDesbloquear).toHaveBeenCalledWith(7, conn);
    expect(r.conquistas_desbloqueadas).toEqual([conquista]);
    // A verificação acontece DEPOIS de atualizar o XP (para considerar a missão atual).
    const ordemXp = usuarioModel.incrementarXp.mock.invocationCallOrder[0];
    const ordemConquista = conquistaService.verificarEDesbloquear.mock.invocationCallOrder[0];
    expect(ordemXp).toBeLessThan(ordemConquista);
  });

  test('missão inexistente → 404', async () => {
    missaoModel.findById.mockResolvedValue(null);
    await expect(missaoService.concluir(1, 7, { resultado: 'sucesso' })).rejects.toMatchObject({ status: 404 });
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('missão inativa → 400', async () => {
    missaoModel.findById.mockResolvedValue(missao({ status: 'inativa' }));
    await expect(missaoService.concluir(1, 7, { resultado: 'sucesso' })).rejects.toMatchObject({ status: 400 });
  });

  describe('missões com QR Code', () => {
    beforeEach(() => missaoModel.findById.mockResolvedValue(missao({ dificuldade: 'Fácil', qr_code: 'FATEC-001' })));

    test('QR Code correto → sucesso', async () => {
      const r = await missaoService.concluir(1, 7, { qr_code: ' FATEC-001 ' });
      expect(r.historico.resultado).toBe('sucesso');
      expect(r.historico.xp_variacao).toBe(75);
    });

    test('QR Code incorreto → erro com penalidade', async () => {
      const r = await missaoService.concluir(1, 7, { qr_code: 'OUTRO' });
      expect(r.historico.resultado).toBe('erro');
      expect(r.historico.xp_variacao).toBe(-15);
    });

    test("resultado 'sucesso' sem QR Code é recusado (400)", async () => {
      await expect(missaoService.concluir(1, 7, { resultado: 'sucesso' })).rejects.toMatchObject({ status: 400 });
      expect(historicoModel.create).not.toHaveBeenCalled();
    });
  });

  test('enviar qr_code para missão sem QR Code → 400', async () => {
    missaoModel.findById.mockResolvedValue(missao());
    await expect(missaoService.concluir(1, 7, { qr_code: 'X' })).rejects.toMatchObject({ status: 400 });
  });

  test('quiz não pode ser concluído por esta rota (evita ganhar 100% sem responder) → 400', async () => {
    missaoModel.findById.mockResolvedValue(missao({ tipo: 'Tipo 2' }));

    await expect(missaoService.concluir(1, 7, { resultado: 'sucesso' })).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/quiz/),
    });
    expect(historicoModel.create).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
  });
});

describe('missaoService.criar / atualizar', () => {
  test('XP da missão criada é derivado da dificuldade', async () => {
    missaoModel.create.mockResolvedValue(5);
    missaoModel.findById.mockResolvedValue(missao({ missao_id: 5, dificuldade: 'Difícil', xp: 150 }));

    await missaoService.criar({ titulo: 'Nova', dificuldade: 'Difícil', tipo: 'Tipo 3', xp: 9999 });

    expect(missaoModel.create).toHaveBeenCalledWith(expect.objectContaining({ xp: 150 }));
  });

  test('mudar a dificuldade na edição recalcula o XP', async () => {
    missaoModel.findById.mockResolvedValue(missao({ dificuldade: 'Fácil', xp: 75 }));

    await missaoService.atualizar(1, { titulo: 'M', dificuldade: 'Difícil', tipo: 'Tipo 1' });

    expect(missaoModel.update).toHaveBeenCalledWith(1, expect.objectContaining({ dificuldade: 'Difícil', xp: 150 }));
  });

  test('quiz com perguntas não pode mudar de tipo → 409', async () => {
    missaoModel.findById.mockResolvedValue(missao({ tipo: 'Tipo 2' }));
    quizModel.contarPerguntas.mockResolvedValue(4);

    await expect(
      missaoService.atualizar(1, { titulo: 'M', dificuldade: 'Médio', tipo: 'Tipo 1' })
    ).rejects.toMatchObject({ status: 409 });
    expect(missaoModel.update).not.toHaveBeenCalled();
  });

  test('excluir missão sem tentativas → remove', async () => {
    missaoModel.findById.mockResolvedValue(missao());
    missaoModel.estatisticas.mockResolvedValue({ total_tentativas: 0 });

    await missaoService.excluir(1);

    expect(missaoModel.remove).toHaveBeenCalledWith(1);
  });

  test('excluir missão com tentativas → 409 (preserva histórico e XP), sem remover', async () => {
    missaoModel.findById.mockResolvedValue(missao());
    missaoModel.estatisticas.mockResolvedValue({ total_tentativas: '3' });

    await expect(missaoService.excluir(1)).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/3 tentativa\(s\).*Desative-a/),
    });
    expect(missaoModel.remove).not.toHaveBeenCalled();
  });

  test('excluir missão inexistente → 404', async () => {
    missaoModel.findById.mockResolvedValue(null);
    await expect(missaoService.excluir(9)).rejects.toMatchObject({ status: 404 });
  });

  test('admin vê estatísticas da missão; estudante não', () => {
    const m = missao({ total_tentativas: '4', total_conclusoes: '3', total_perguntas: '0' });
    expect(missaoService.formatarMissao(m, { admin: true })).toMatchObject({
      total_tentativas: 4, total_conclusoes: 3, total_perguntas: 0,
    });
    expect(missaoService.formatarMissao(m)).not.toHaveProperty('total_tentativas');
  });

  test('formatarMissao indica se a missão é um quiz', () => {
    expect(missaoService.formatarMissao(missao({ tipo: 'Tipo 2' })).quiz).toBe(true);
    expect(missaoService.formatarMissao(missao({ tipo: 'Tipo 1' })).quiz).toBe(false);
  });

  test('qr_code nunca é exposto para estudantes', () => {
    const m = missao({ qr_code: 'SEGREDO' });
    expect(missaoService.formatarMissao(m)).not.toHaveProperty('qr_code');
    expect(missaoService.formatarMissao(m).possui_qr_code).toBe(true);
    expect(missaoService.formatarMissao(m, { admin: true }).qr_code).toBe('SEGREDO');
  });
});
