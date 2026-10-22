/**
 * QUIZ — cadastro de perguntas/alternativas (administração) e resposta pelos estudantes.
 *
 * Regras:
 * - Só missões do tipo quiz (TIPO_QUIZ) recebem perguntas.
 * - Cada pergunta tem de 2 a 6 alternativas e EXATAMENTE UMA correta
 *   (validado aqui e garantido também por UNIQUE no banco).
 * - O gabarito (campo "correta") nunca é enviado aos estudantes.
 * - Pontuação: XP da missão dividido igualmente entre as perguntas (ver quizRules).
 *     · 1 ou mais acertos → resultado 'sucesso' com o XP proporcional; o quiz fica concluído
 *       (vale a regra de UM sucesso por missão).
 *     · 0 acertos → resultado 'erro' com a penalidade da dificuldade; pode tentar de novo.
 */
const missaoModel = require('../models/missaoModel');
const usuarioModel = require('../models/usuarioModel');
const historicoModel = require('../models/historicoModel');
const quizModel = require('../models/quizModel');
const { comTransacao, registrarTentativa } = require('./tentativaService');
const { formatarMissao } = require('./missaoService');
const AppError = require('../utils/AppError');
const { TIPO_QUIZ, xpDaMissao, penalidadeDaMissao } = require('../utils/gameRules');
const { calcularPontuacaoQuiz } = require('../utils/quizRules');

// ------------------------------------------------------------------ helpers

function assertQuiz(missao) {
  if (!missao) throw AppError.notFound('Missão não encontrada.');
  if (missao.tipo !== TIPO_QUIZ) {
    throw AppError.badRequest(
      `A missão "${missao.titulo}" não é um quiz. Apenas missões do tipo "${TIPO_QUIZ}" possuem perguntas.`
    );
  }
}

/** Exatamente UMA alternativa correta e sem textos repetidos. */
function validarAlternativas(alternativas) {
  const corretas = alternativas.filter((a) => a.correta).length;
  if (corretas !== 1) {
    throw AppError.badRequest('Dados inválidos.', [
      {
        campo: 'alternativas',
        mensagem: corretas === 0
          ? 'Marque qual alternativa é a correta (correta: true).'
          : `Apenas uma alternativa pode ser correta (${corretas} marcadas).`,
      },
    ]);
  }
  const textos = alternativas.map((a) => a.texto.trim().toLowerCase());
  if (new Set(textos).size !== textos.length) {
    throw AppError.badRequest('Dados inválidos.', [
      { campo: 'alternativas', mensagem: 'Há alternativas com o mesmo texto.' },
    ]);
  }
}

/** Junta perguntas e alternativas; `comGabarito` controla a exposição do campo "correta". */
async function montarPerguntas(missaoId, { comGabarito }, conn) {
  const perguntas = await quizModel.findPerguntasByMissao(missaoId, conn);
  const alternativas = await quizModel.findAlternativasByPerguntas(
    perguntas.map((p) => p.pergunta_id),
    conn
  );
  return perguntas.map((p) => ({
    pergunta_id: p.pergunta_id,
    missao_id: p.missao_id,
    enunciado: p.enunciado,
    ordem: p.ordem,
    alternativas: alternativas
      .filter((a) => a.pergunta_id === p.pergunta_id)
      .map((a) =>
        comGabarito
          ? { alternativa_id: a.alternativa_id, texto: a.texto, correta: a.correta, ordem: a.ordem }
          : { alternativa_id: a.alternativa_id, texto: a.texto, ordem: a.ordem }
      ),
  }));
}

async function perguntaCompleta(perguntaId, conn) {
  const pergunta = await quizModel.findPerguntaById(perguntaId, conn);
  const alternativas = await quizModel.findAlternativasByPerguntas([perguntaId], conn);
  return {
    ...pergunta,
    alternativas: alternativas.map(({ alternativa_id, texto, correta, ordem }) => ({ alternativa_id, texto, correta, ordem })),
  };
}

function resumoPontuacao(missao, totalPerguntas) {
  const xpTotal = xpDaMissao(missao.dificuldade);
  return {
    total_perguntas: totalPerguntas,
    xp_total: xpTotal,
    xp_por_pergunta: totalPerguntas ? Math.round((xpTotal / totalPerguntas) * 100) / 100 : null,
  };
}

// ------------------------------------------------------------------ administração

/** Lista as perguntas de um quiz COM o gabarito (somente administradores). */
async function listarPerguntasAdmin(missaoId) {
  const missao = await missaoModel.findById(missaoId);
  assertQuiz(missao);
  const perguntas = await montarPerguntas(missaoId, { comGabarito: true });
  return {
    missao: formatarMissao(missao, { admin: true }),
    ...resumoPontuacao(missao, perguntas.length),
    perguntas,
  };
}

/** Cadastra uma pergunta (com suas alternativas) e a vincula a uma missão quiz. */
async function criarPergunta(missaoId, { enunciado, ordem, alternativas }) {
  validarAlternativas(alternativas);
  return comTransacao(async (conn) => {
    assertQuiz(await missaoModel.findById(missaoId, conn));
    const ordemFinal = ordem ?? (await quizModel.proximaOrdem(missaoId, conn));
    const perguntaId = await quizModel.createPergunta({ missaoId, enunciado, ordem: ordemFinal }, conn);
    await quizModel.createAlternativas(perguntaId, alternativas, conn);
    return perguntaCompleta(perguntaId, conn);
  });
}

/**
 * Edita a pergunta. Campos omitidos mantêm o valor atual.
 * - `missao_id`: move a pergunta para outro quiz.
 * - `alternativas`: SUBSTITUI todas as alternativas (os IDs antigos deixam de existir).
 */
async function atualizarPergunta(perguntaId, dados) {
  if (dados.alternativas) validarAlternativas(dados.alternativas);
  return comTransacao(async (conn) => {
    const atual = await quizModel.findPerguntaById(perguntaId, conn);
    if (!atual) throw AppError.notFound('Pergunta não encontrada.');

    const missaoId = dados.missao_id ?? atual.missao_id;
    if (missaoId !== atual.missao_id) assertQuiz(await missaoModel.findById(missaoId, conn));

    await quizModel.updatePergunta(
      perguntaId,
      {
        missaoId,
        enunciado: dados.enunciado ?? atual.enunciado,
        ordem: dados.ordem ?? (missaoId !== atual.missao_id ? await quizModel.proximaOrdem(missaoId, conn) : atual.ordem),
      },
      conn
    );
    if (dados.alternativas) {
      await quizModel.deleteAlternativasByPergunta(perguntaId, conn);
      await quizModel.createAlternativas(perguntaId, dados.alternativas, conn);
    }
    return perguntaCompleta(perguntaId, conn);
  });
}

/** Define qual alternativa (já cadastrada) é a resposta correta da pergunta. */
async function definirAlternativaCorreta(perguntaId, alternativaId) {
  return comTransacao(async (conn) => {
    const pergunta = await quizModel.findPerguntaById(perguntaId, conn);
    if (!pergunta) throw AppError.notFound('Pergunta não encontrada.');
    const alternativa = await quizModel.findAlternativaById(alternativaId, conn);
    if (!alternativa || alternativa.pergunta_id !== pergunta.pergunta_id) {
      throw AppError.badRequest('Dados inválidos.', [
        { campo: 'alternativa_id', mensagem: 'A alternativa informada não pertence a esta pergunta.' },
      ]);
    }
    await quizModel.definirCorreta(perguntaId, alternativaId, conn);
    return perguntaCompleta(perguntaId, conn);
  });
}

async function removerPergunta(perguntaId) {
  const removida = await quizModel.deletePergunta(perguntaId);
  if (!removida) throw AppError.notFound('Pergunta não encontrada.');
}

// ------------------------------------------------------------------ estudantes

/** Quiz para responder no app: perguntas e alternativas SEM o gabarito. */
async function obterQuiz(missaoId, usuario) {
  const missao = await missaoModel.findById(missaoId);
  assertQuiz(missao);
  const admin = usuario.role === 'administrador';
  if (missao.status !== 'ativa' && !admin) throw AppError.badRequest('Esta missão está inativa.');

  const perguntas = await montarPerguntas(missaoId, { comGabarito: false });
  if (!perguntas.length) throw AppError.badRequest('Este quiz ainda não possui perguntas.');

  const concluida = await historicoModel.existeSucesso(usuario.id, missaoId);
  return {
    missao: formatarMissao({ ...missao, concluida }, { admin }),
    ...resumoPontuacao(missao, perguntas.length),
    perguntas,
  };
}

/**
 * Corrige as respostas e registra a tentativa (transação única, linha do usuário travada).
 * Todas as perguntas do quiz devem ser respondidas, cada uma uma única vez.
 */
async function responder(missaoId, usuarioId, respostas) {
  return comTransacao(async (conn) => {
    const missao = await missaoModel.findById(missaoId, conn);
    assertQuiz(missao);
    if (missao.status !== 'ativa') throw AppError.badRequest('Esta missão está inativa.');

    const usuario = await usuarioModel.findByIdForUpdate(usuarioId, conn);
    if (!usuario) throw AppError.notFound('Usuário não encontrado.');

    // Quiz concluído não pode ser refeito (nem para melhorar a nota, nem gerando penalidades).
    if (await historicoModel.existeSucesso(usuarioId, missaoId, conn)) {
      throw AppError.conflict('Você já concluiu este quiz.');
    }

    const perguntas = await montarPerguntas(missaoId, { comGabarito: true }, conn);
    if (!perguntas.length) throw AppError.badRequest('Este quiz ainda não possui perguntas.');

    const correcao = corrigir(perguntas, respostas);
    const acertos = correcao.filter((c) => c.acertou).length;
    const pontuacao = calcularPontuacaoQuiz(xpDaMissao(missao.dificuldade), perguntas.length, acertos);

    const resultado = acertos > 0 ? 'sucesso' : 'erro';
    const xpVariacao = resultado === 'sucesso' ? pontuacao.xp_obtido : penalidadeDaMissao(missao.dificuldade);
    const efeitos = await registrarTentativa(conn, { missao, usuario, resultado, xpVariacao });

    return {
      mensagem:
        resultado === 'sucesso'
          ? `Quiz concluído! ${acertos} de ${perguntas.length} acertos: +${xpVariacao} XP`
          : `Nenhuma resposta correta. ${xpVariacao} XP — tente novamente.`,
      pontuacao,
      correcao,
      ...efeitos,
    };
  });
}

/**
 * Confere as respostas com o gabarito. Retorna, por pergunta, se o estudante acertou —
 * sem revelar qual era a alternativa correta (o quiz pode ser refeito após 0 acertos).
 */
function corrigir(perguntas, respostas) {
  const porPergunta = new Map(perguntas.map((p) => [p.pergunta_id, p]));
  const detalhes = [];
  const respondidas = new Set();

  respostas.forEach(({ pergunta_id, alternativa_id }, i) => {
    const pergunta = porPergunta.get(pergunta_id);
    if (!pergunta) {
      detalhes.push({ campo: `respostas.${i}.pergunta_id`, mensagem: `A pergunta ${pergunta_id} não pertence a este quiz.` });
    } else if (respondidas.has(pergunta_id)) {
      detalhes.push({ campo: `respostas.${i}.pergunta_id`, mensagem: `A pergunta ${pergunta_id} foi respondida mais de uma vez.` });
    } else if (!pergunta.alternativas.some((a) => a.alternativa_id === alternativa_id)) {
      detalhes.push({ campo: `respostas.${i}.alternativa_id`, mensagem: `A alternativa ${alternativa_id} não pertence à pergunta ${pergunta_id}.` });
    }
    respondidas.add(pergunta_id);
  });

  const faltando = perguntas.filter((p) => !respondidas.has(p.pergunta_id)).map((p) => p.pergunta_id);
  if (faltando.length) {
    detalhes.push({ campo: 'respostas', mensagem: `Responda todas as perguntas. Faltando: ${faltando.join(', ')}.` });
  }
  if (detalhes.length) throw AppError.badRequest('Respostas inválidas.', detalhes);

  const escolhida = new Map(respostas.map((r) => [r.pergunta_id, r.alternativa_id]));
  return perguntas.map((p) => ({
    pergunta_id: p.pergunta_id,
    alternativa_id: escolhida.get(p.pergunta_id),
    acertou: p.alternativas.some((a) => a.correta && a.alternativa_id === escolhida.get(p.pergunta_id)),
  }));
}

module.exports = {
  listarPerguntasAdmin,
  criarPergunta,
  atualizarPergunta,
  definirAlternativaCorreta,
  removerPergunta,
  obterQuiz,
  responder,
};
