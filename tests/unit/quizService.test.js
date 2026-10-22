/**
 * Regras do quiz com o banco mockado: cadastro de perguntas/alternativas, gabarito
 * (exatamente uma correta), vínculo com a missão e pontuação proporcional aos acertos.
 */
jest.mock('../../src/config/database', () => ({ getConnection: jest.fn() }));
jest.mock('../../src/models/missaoModel');
jest.mock('../../src/models/usuarioModel');
jest.mock('../../src/models/historicoModel');
jest.mock('../../src/models/quizModel');
jest.mock('../../src/services/conquistaService');

const db = require('../../src/config/database');
const missaoModel = require('../../src/models/missaoModel');
const usuarioModel = require('../../src/models/usuarioModel');
const historicoModel = require('../../src/models/historicoModel');
const quizModel = require('../../src/models/quizModel');
const conquistaService = require('../../src/services/conquistaService');
const quizService = require('../../src/services/quizService');

const conn = { beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn() };

const QUIZ = { missao_id: 4, titulo: 'Quiz: Lógica', dificuldade: 'Difícil', tipo: 'Tipo 2', xp: 150, status: 'ativa', qr_code: null };

// 4 perguntas (ids 1..4); alternativas p*10+1..p*10+3, a correta é sempre p*10+1
const PERGUNTAS = [1, 2, 3, 4].map((p) => ({ pergunta_id: p, missao_id: 4, enunciado: `Pergunta ${p}`, ordem: p }));
const ALTERNATIVAS = PERGUNTAS.flatMap(({ pergunta_id: p }) =>
  [1, 2, 3].map((n) => ({ alternativa_id: p * 10 + n, pergunta_id: p, texto: `Alt ${n}`, correta: n === 1, ordem: n }))
);

/** Respostas com `acertos` corretas (as primeiras) e o restante erradas. */
const respostas = (acertos) =>
  PERGUNTAS.map(({ pergunta_id: p }, i) => ({ pergunta_id: p, alternativa_id: p * 10 + (i < acertos ? 1 : 2) }));

const ALTERNATIVAS_OK = [
  { texto: 'Pilha', correta: true },
  { texto: 'Fila', correta: false },
];

beforeEach(() => {
  jest.resetAllMocks();
  db.getConnection.mockResolvedValue(conn);
  missaoModel.findById.mockResolvedValue(QUIZ);
  usuarioModel.findByIdForUpdate.mockResolvedValue({ usuario_id: 7, xp: 300, role: 'estudante' });
  historicoModel.existeSucesso.mockResolvedValue(false);
  historicoModel.create.mockResolvedValue(50);
  quizModel.findPerguntasByMissao.mockResolvedValue(PERGUNTAS);
  quizModel.findAlternativasByPerguntas.mockImplementation(async (ids) =>
    ALTERNATIVAS.filter((a) => ids.includes(a.pergunta_id))
  );
  conquistaService.verificarEDesbloquear.mockResolvedValue([]);
});

// =====================================================================
describe('cadastro de perguntas (admin)', () => {
  test('cria a pergunta atrelada à missão quiz, no fim do quiz, com as alternativas', async () => {
    quizModel.proximaOrdem.mockResolvedValue(5);
    quizModel.createPergunta.mockResolvedValue(9);
    quizModel.findPerguntaById.mockResolvedValue({ pergunta_id: 9, missao_id: 4, enunciado: 'LIFO?', ordem: 5 });

    await quizService.criarPergunta(4, { enunciado: 'LIFO?', alternativas: ALTERNATIVAS_OK });

    expect(quizModel.createPergunta).toHaveBeenCalledWith({ missaoId: 4, enunciado: 'LIFO?', ordem: 5 }, conn);
    expect(quizModel.createAlternativas).toHaveBeenCalledWith(9, ALTERNATIVAS_OK, conn);
    expect(conn.commit).toHaveBeenCalled();
  });

  test('respeita a ordem informada', async () => {
    quizModel.createPergunta.mockResolvedValue(9);
    quizModel.findPerguntaById.mockResolvedValue({ pergunta_id: 9 });
    await quizService.criarPergunta(4, { enunciado: 'X?', ordem: 2, alternativas: ALTERNATIVAS_OK });
    expect(quizModel.proximaOrdem).not.toHaveBeenCalled();
    expect(quizModel.createPergunta).toHaveBeenCalledWith(expect.objectContaining({ ordem: 2 }), conn);
  });

  test.each([
    ['nenhuma correta', [{ texto: 'A', correta: false }, { texto: 'B', correta: false }], /Marque qual/],
    ['duas corretas', [{ texto: 'A', correta: true }, { texto: 'B', correta: true }], /Apenas uma/],
    ['textos repetidos', [{ texto: 'A', correta: true }, { texto: ' a ', correta: false }], /mesmo texto/],
  ])('rejeita alternativas com %s (400) sem tocar no banco', async (_, alternativas, msg) => {
    const erro = await quizService.criarPergunta(4, { enunciado: 'X?', alternativas }).catch((e) => e);
    expect(erro.status).toBe(400);
    expect(erro.detalhes[0]).toMatchObject({ campo: 'alternativas', mensagem: expect.stringMatching(msg) });
    expect(db.getConnection).not.toHaveBeenCalled();
  });

  test('só missões do tipo quiz recebem perguntas (400)', async () => {
    missaoModel.findById.mockResolvedValue({ ...QUIZ, tipo: 'Tipo 1', titulo: 'Biblioteca' });
    await expect(
      quizService.criarPergunta(4, { enunciado: 'X?', alternativas: ALTERNATIVAS_OK })
    ).rejects.toMatchObject({ status: 400, message: expect.stringMatching(/não é um quiz/) });
    expect(quizModel.createPergunta).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('missão inexistente → 404', async () => {
    missaoModel.findById.mockResolvedValue(null);
    await expect(
      quizService.criarPergunta(99, { enunciado: 'X?', alternativas: ALTERNATIVAS_OK })
    ).rejects.toMatchObject({ status: 404 });
  });

  test('editar com novas alternativas substitui as antigas', async () => {
    quizModel.findPerguntaById.mockResolvedValue({ pergunta_id: 1, missao_id: 4, enunciado: 'Antiga', ordem: 1 });

    await quizService.atualizarPergunta(1, { enunciado: 'Nova', alternativas: ALTERNATIVAS_OK });

    expect(quizModel.updatePergunta).toHaveBeenCalledWith(1, { missaoId: 4, enunciado: 'Nova', ordem: 1 }, conn);
    expect(quizModel.deleteAlternativasByPergunta).toHaveBeenCalledWith(1, conn);
    expect(quizModel.createAlternativas).toHaveBeenCalledWith(1, ALTERNATIVAS_OK, conn);
  });

  test('mover a pergunta para outro quiz valida o destino e a coloca no fim', async () => {
    quizModel.findPerguntaById.mockResolvedValue({ pergunta_id: 1, missao_id: 4, enunciado: 'P', ordem: 1 });
    missaoModel.findById.mockResolvedValue({ ...QUIZ, missao_id: 5 });
    quizModel.proximaOrdem.mockResolvedValue(3);

    await quizService.atualizarPergunta(1, { missao_id: 5 });

    expect(quizModel.updatePergunta).toHaveBeenCalledWith(1, { missaoId: 5, enunciado: 'P', ordem: 3 }, conn);
    expect(quizModel.deleteAlternativasByPergunta).not.toHaveBeenCalled();
  });

  test('não move a pergunta para uma missão que não é quiz', async () => {
    quizModel.findPerguntaById.mockResolvedValue({ pergunta_id: 1, missao_id: 4, enunciado: 'P', ordem: 1 });
    missaoModel.findById.mockResolvedValue({ ...QUIZ, missao_id: 6, tipo: 'Tipo 3' });

    await expect(quizService.atualizarPergunta(1, { missao_id: 6 })).rejects.toMatchObject({ status: 400 });
    expect(quizModel.updatePergunta).not.toHaveBeenCalled();
  });

  test('define a alternativa correta da pergunta', async () => {
    quizModel.findPerguntaById.mockResolvedValue({ pergunta_id: 1, missao_id: 4 });
    quizModel.findAlternativaById.mockResolvedValue({ alternativa_id: 12, pergunta_id: 1 });

    await quizService.definirAlternativaCorreta(1, 12);

    expect(quizModel.definirCorreta).toHaveBeenCalledWith(1, 12, conn);
  });

  test('não aceita como correta uma alternativa de OUTRA pergunta (400)', async () => {
    quizModel.findPerguntaById.mockResolvedValue({ pergunta_id: 1, missao_id: 4 });
    quizModel.findAlternativaById.mockResolvedValue({ alternativa_id: 21, pergunta_id: 2 });

    await expect(quizService.definirAlternativaCorreta(1, 21)).rejects.toMatchObject({ status: 400 });
    expect(quizModel.definirCorreta).not.toHaveBeenCalled();
  });

  test('listagem do admin traz o gabarito e o XP por pergunta', async () => {
    const r = await quizService.listarPerguntasAdmin(4);
    expect(r).toMatchObject({ total_perguntas: 4, xp_total: 150, xp_por_pergunta: 37.5 });
    expect(r.perguntas[0].alternativas[0]).toHaveProperty('correta', true);
  });

  test('remover pergunta inexistente → 404', async () => {
    quizModel.deletePergunta.mockResolvedValue(false);
    await expect(quizService.removerPergunta(99)).rejects.toMatchObject({ status: 404 });
  });
});

// =====================================================================
describe('obterQuiz (estudante)', () => {
  test('nunca envia o gabarito ao estudante', async () => {
    const r = await quizService.obterQuiz(4, { id: 7, role: 'estudante' });

    expect(r.total_perguntas).toBe(4);
    expect(r.xp_por_pergunta).toBe(37.5);
    expect(JSON.stringify(r.perguntas)).not.toMatch(/correta/);
    expect(r.perguntas[0].alternativas).toHaveLength(3);
  });

  test('quiz sem perguntas → 400', async () => {
    quizModel.findPerguntasByMissao.mockResolvedValue([]);
    await expect(quizService.obterQuiz(4, { id: 7, role: 'estudante' })).rejects.toMatchObject({ status: 400 });
  });

  test('quiz inativo não é exibido para estudantes', async () => {
    missaoModel.findById.mockResolvedValue({ ...QUIZ, status: 'inativa' });
    await expect(quizService.obterQuiz(4, { id: 7, role: 'estudante' })).rejects.toMatchObject({ status: 400 });
  });
});

// =====================================================================
describe('responder (pontuação)', () => {
  test.each([
    [4, 150],
    [3, 113],
    [2, 75],
    [1, 38],
  ])('%i de 4 acertos em quiz Difícil (150 XP) → sucesso com +%i XP', async (acertos, xp) => {
    const r = await quizService.responder(4, 7, respostas(acertos));

    expect(r.pontuacao).toMatchObject({ acertos, total: 4, xp_por_pergunta: 37.5, xp_obtido: xp });
    expect(historicoModel.create).toHaveBeenCalledWith(
      { usuarioId: 7, missaoId: 4, resultado: 'sucesso', xpVariacao: xp },
      conn
    );
    expect(usuarioModel.incrementarXp).toHaveBeenCalledWith(7, xp, conn);
    expect(conquistaService.verificarEDesbloquear).toHaveBeenCalledWith(7, conn);
    expect(r.xp_total).toBe(300 + xp);
    expect(conn.commit).toHaveBeenCalled();
  });

  test('0 acertos → erro com a penalidade da dificuldade (−75) e sem conquistas', async () => {
    const r = await quizService.responder(4, 7, respostas(0));

    expect(r.historico).toMatchObject({ resultado: 'erro', xp_variacao: -75 });
    expect(usuarioModel.incrementarXp).toHaveBeenCalledWith(7, -75, conn);
    expect(conquistaService.verificarEDesbloquear).not.toHaveBeenCalled();
  });

  test('a correção indica acertos por pergunta sem revelar a alternativa correta', async () => {
    const r = await quizService.responder(4, 7, respostas(2));
    expect(r.correcao).toEqual([
      { pergunta_id: 1, alternativa_id: 11, acertou: true },
      { pergunta_id: 2, alternativa_id: 21, acertou: true },
      { pergunta_id: 3, alternativa_id: 32, acertou: false },
      { pergunta_id: 4, alternativa_id: 42, acertou: false },
    ]);
  });

  test('quiz já concluído → 409, sem registrar nada (nem penalidade)', async () => {
    historicoModel.existeSucesso.mockResolvedValue(true);

    await expect(quizService.responder(4, 7, respostas(0))).rejects.toMatchObject({ status: 409 });
    expect(historicoModel.create).not.toHaveBeenCalled();
    expect(usuarioModel.incrementarXp).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalled();
  });

  test('todas as perguntas devem ser respondidas (400)', async () => {
    const erro = await quizService.responder(4, 7, respostas(4).slice(0, 3)).catch((e) => e);
    expect(erro.status).toBe(400);
    expect(erro.detalhes).toEqual([{ campo: 'respostas', mensagem: 'Responda todas as perguntas. Faltando: 4.' }]);
    expect(historicoModel.create).not.toHaveBeenCalled();
  });

  test('rejeita pergunta repetida, pergunta de outro quiz e alternativa de outra pergunta (400)', async () => {
    const r = respostas(4);
    const invalidas = [
      [...r, { pergunta_id: 1, alternativa_id: 11 }], // repetida
      [...r, { pergunta_id: 99, alternativa_id: 991 }], // outro quiz
      [{ pergunta_id: 1, alternativa_id: 21 }, ...r.slice(1)], // alternativa da pergunta 2
    ];
    for (const lista of invalidas) {
      await expect(quizService.responder(4, 7, lista)).rejects.toMatchObject({ status: 400 });
    }
    expect(historicoModel.create).not.toHaveBeenCalled();
  });

  test('missão que não é quiz → 400', async () => {
    missaoModel.findById.mockResolvedValue({ ...QUIZ, tipo: 'Tipo 1' });
    await expect(quizService.responder(4, 7, respostas(4))).rejects.toMatchObject({ status: 400 });
  });

  test('quiz inativo → 400', async () => {
    missaoModel.findById.mockResolvedValue({ ...QUIZ, status: 'inativa' });
    await expect(quizService.responder(4, 7, respostas(4))).rejects.toMatchObject({ status: 400 });
  });
});
