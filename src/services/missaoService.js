const missaoModel = require('../models/missaoModel');
const usuarioModel = require('../models/usuarioModel');
const historicoModel = require('../models/historicoModel');
const quizModel = require('../models/quizModel');
const { comTransacao, registrarTentativa } = require('./tentativaService');
const AppError = require('../utils/AppError');
const { xpDaMissao, penalidadeDaMissao, calcularVariacaoXp, TIPO_QUIZ } = require('../utils/gameRules');

/**
 * Formata a missão para a resposta. O valor do qr_code só é exposto para administradores —
 * se estudantes o recebessem, poderiam "concluir" missões presenciais sem ir ao local.
 */
function formatarMissao(m, { admin = false } = {}) {
  const saida = {
    missao_id: m.missao_id,
    titulo: m.titulo,
    descricao: m.descricao,
    dificuldade: m.dificuldade,
    tipo: m.tipo,
    xp: m.xp,
    penalidade: penalidadeDaMissao(m.dificuldade),
    status: m.status,
    possui_qr_code: Boolean(m.qr_code),
    quiz: m.tipo === TIPO_QUIZ,
  };
  if (admin) {
    saida.qr_code = m.qr_code;
    // Estatísticas (presentes quando a consulta as incluiu): base para decidir se pode excluir
    if (m.total_tentativas !== undefined) {
      saida.total_tentativas = Number(m.total_tentativas);
      saida.total_conclusoes = Number(m.total_conclusoes);
      saida.total_perguntas = Number(m.total_perguntas);
    }
  }
  if (m.concluida !== undefined) saida.concluida = Boolean(m.concluida);
  return saida;
}

async function listar({ tipo, dificuldade, status = 'ativa' }, usuario) {
  const admin = usuario.role === 'administrador';
  const filtroStatus = status === 'todas' ? undefined : status;
  const missoes = await missaoModel.findAll(
    { tipo, dificuldade, status: filtroStatus, comEstatisticas: admin },
    usuario.id
  );
  return missoes.map((m) => formatarMissao(m, { admin }));
}

async function detalhar(id, usuario) {
  const missao = await missaoModel.findById(id);
  if (!missao) throw AppError.notFound('Missão não encontrada.');
  const admin = usuario.role === 'administrador';
  const [concluida, stats] = await Promise.all([
    historicoModel.existeSucesso(usuario.id, id),
    admin ? missaoModel.estatisticas(id) : null,
  ]);
  return formatarMissao({ ...missao, ...stats, concluida }, { admin });
}

/**
 * Define o resultado da tentativa:
 * - Missão COM qr_code: o resultado vem da comparação do código lido com o cadastrado.
 *   Sem código, só é aceito resultado='erro' (ex.: desistência/tempo esgotado).
 * - Missão SEM qr_code (desafio virtual...): usa o `resultado` informado pelo cliente.
 * (Quizzes não passam por aqui: são corrigidos pelo quizService.)
 */
function determinarResultado(missao, { resultado, qr_code }) {
  if (qr_code !== undefined) {
    if (!missao.qr_code) {
      throw AppError.badRequest('Esta missão não utiliza QR Code. Informe o campo "resultado".');
    }
    return qr_code.trim() === missao.qr_code ? 'sucesso' : 'erro';
  }
  if (missao.qr_code && resultado === 'sucesso') {
    throw AppError.badRequest('Esta missão exige a leitura do QR Code para ser concluída.');
  }
  return resultado;
}

/**
 * REGRA DE NEGÓCIO PRINCIPAL — registra uma tentativa de missão.
 *
 * Tudo acontece em UMA transação:
 *  1. Carrega a missão (404 se não existir; 400 se estiver inativa).
 *  2. Trava a linha do usuário (FOR UPDATE) para serializar tentativas concorrentes.
 *  3. Se for sucesso, verifica se já existe sucesso para o par usuario/missao → 409.
 *  4. Calcula a variação: +75/+100/+150 no sucesso, -15/-25/-75 no erro.
 *  5. Grava o HISTORICO e soma a variação em USUARIO.xp.
 *  6. Se for sucesso, verifica e desbloqueia conquistas.
 * Qualquer falha desfaz tudo (rollback).
 */
async function concluir(missaoId, usuarioId, dados) {
  return comTransacao(async (conn) => {
    const missao = await missaoModel.findById(missaoId, conn);
    if (!missao) throw AppError.notFound('Missão não encontrada.');
    if (missao.status !== 'ativa') throw AppError.badRequest('Esta missão está inativa.');
    // Quiz tem pontuação proporcional aos acertos: não pode ser "concluído" com resultado livre.
    if (missao.tipo === TIPO_QUIZ) {
      throw AppError.badRequest(
        `Esta missão é um quiz. Responda as perguntas em POST /missoes/${missao.missao_id}/quiz/respostas.`
      );
    }

    const resultado = determinarResultado(missao, dados);

    const usuario = await usuarioModel.findByIdForUpdate(usuarioId, conn);
    if (!usuario) throw AppError.notFound('Usuário não encontrado.');

    // Apenas UM sucesso por missão (erros podem se repetir à vontade).
    if (resultado === 'sucesso' && (await historicoModel.existeSucesso(usuarioId, missaoId, conn))) {
      throw AppError.conflict('Você já concluiu esta missão com sucesso.');
    }

    const xpVariacao = calcularVariacaoXp(missao.dificuldade, resultado);
    const efeitos = await registrarTentativa(conn, { missao, usuario, resultado, xpVariacao });

    return {
      mensagem:
        resultado === 'sucesso'
          ? `Missão concluída com sucesso! +${xpVariacao} XP`
          : `Tentativa incorreta. ${xpVariacao} XP`,
      ...efeitos,
    };
  });
}

// ----------------------------- Administração -----------------------------

/** Criação: o XP é SEMPRE derivado da dificuldade, nunca enviado pelo cliente. */
async function criar(dados) {
  const id = await missaoModel.create({ ...dados, xp: xpDaMissao(dados.dificuldade) });
  return formatarMissao(await missaoModel.findById(id), { admin: true });
}

/** Edição: se a dificuldade mudar, o XP é recalculado automaticamente. */
async function atualizar(id, dados) {
  const atual = await missaoModel.findById(id);
  if (!atual) throw AppError.notFound('Missão não encontrada.');

  // Um quiz com perguntas não pode virar outro tipo (as perguntas ficariam órfãs).
  if (atual.tipo === TIPO_QUIZ && dados.tipo !== TIPO_QUIZ && (await quizModel.contarPerguntas(id)) > 0) {
    throw AppError.conflict('Este quiz possui perguntas cadastradas. Remova-as antes de alterar o tipo da missão.');
  }

  const novo = {
    titulo: dados.titulo,
    descricao: dados.descricao !== undefined ? dados.descricao : atual.descricao,
    dificuldade: dados.dificuldade,
    tipo: dados.tipo,
    status: dados.status || atual.status,
    // qr_code omitido → mantém o atual; null ou "" → remove o QR Code.
    qr_code: dados.qr_code !== undefined ? dados.qr_code || null : atual.qr_code,
    xp: xpDaMissao(dados.dificuldade),
  };
  await missaoModel.update(id, novo);
  return formatarMissao(await missaoModel.findById(id), { admin: true });
}

async function alterarStatus(id, status) {
  const atualizado = await missaoModel.updateStatus(id, status);
  if (!atualizado) throw AppError.notFound('Missão não encontrada.');
  return formatarMissao(await missaoModel.findById(id), { admin: true });
}

/**
 * Exclusão definitiva. Só é permitida para missões SEM tentativas registradas:
 * apagar o histórico mudaria o XP já conquistado pelos estudantes (e o ranking).
 * Missões já jogadas devem ser DESATIVADAS. Perguntas de quiz são removidas junto (CASCADE).
 */
async function excluir(id) {
  const missao = await missaoModel.findById(id);
  if (!missao) throw AppError.notFound('Missão não encontrada.');
  const { total_tentativas: tentativas } = await missaoModel.estatisticas(id);
  if (Number(tentativas) > 0) {
    throw AppError.conflict(
      `Esta missão possui ${tentativas} tentativa(s) registrada(s) e não pode ser excluída, ` +
        'para preservar o histórico e o XP dos estudantes. Desative-a.'
    );
  }
  await missaoModel.remove(id);
}

module.exports = { listar, detalhar, concluir, criar, atualizar, alterarStatus, excluir, formatarMissao };
