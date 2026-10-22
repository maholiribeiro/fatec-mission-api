/**
 * Schemas Joi de validação de entrada, agrupados por recurso.
 * As mensagens são em português para o front-end poder exibi-las diretamente.
 */
const Joi = require('joi');
const { DIFICULDADES, TIPOS, STATUS_MISSAO, RESULTADOS } = require('../utils/gameRules');

const mensagens = {
  'any.required': '"{#label}" é obrigatório',
  'string.empty': '"{#label}" não pode ser vazio',
  'string.min': '"{#label}" deve ter no mínimo {#limit} caracteres',
  'string.max': '"{#label}" deve ter no máximo {#limit} caracteres',
  'string.email': '"{#label}" deve ser um e-mail válido',
  'number.base': '"{#label}" deve ser um número',
  'number.integer': '"{#label}" deve ser um número inteiro',
  'number.min': '"{#label}" deve ser maior ou igual a {#limit}',
  'number.max': '"{#label}" deve ser menor ou igual a {#limit}',
  'any.only': '"{#label}" deve ser um dos valores: {#valids}',
  'object.missing': 'Informe ao menos um dos campos: {#peers}',
  'object.min': 'Informe ao menos um campo para alterar',
  'array.base': '"{#label}" deve ser uma lista',
  'array.min': '"{#label}" deve ter no mínimo {#limit} itens',
  'array.max': '"{#label}" deve ter no máximo {#limit} itens',
  'boolean.base': '"{#label}" deve ser verdadeiro ou falso',
};

const J = Joi.defaults((schema) => schema.messages(mensagens));

const id = J.object({ id: J.number().integer().min(1).required() });

const auth = {
  login: J.object({
    email: J.string().trim().email().max(150).required(),
    senha: J.string().min(1).max(72).required(),
  }),
};

const usuario = {
  cadastro: J.object({
    nome: J.string().trim().min(2).max(150).required(),
    email: J.string().trim().email().max(150).required(),
    // bcrypt considera apenas os 72 primeiros bytes da senha
    senha: J.string().min(6).max(72).required(),
    curso: J.string().trim().min(2).max(100).required(),
    semestre: J.number().integer().min(1).max(12).required(),
  }),
};

const missao = {
  id,
  filtros: J.object({
    tipo: J.string().valid(...TIPOS),
    dificuldade: J.string().valid(...DIFICULDADES),
    status: J.string().valid(...STATUS_MISSAO, 'todas').default('ativa'),
  }),
  concluir: J.object({
    resultado: J.string().valid(...RESULTADOS),
    qr_code: J.string().trim().min(1).max(255),
  }).or('resultado', 'qr_code'),
  // Sem campo "xp": ele é sempre derivado da dificuldade.
  criar: J.object({
    titulo: J.string().trim().min(3).max(150).required(),
    descricao: J.string().trim().allow('', null).max(65535),
    dificuldade: J.string().valid(...DIFICULDADES).required(),
    tipo: J.string().valid(...TIPOS).required(),
    status: J.string().valid(...STATUS_MISSAO).default('ativa'),
    qr_code: J.string().trim().max(255).allow(null).empty(''),
  }),
  editar: J.object({
    titulo: J.string().trim().min(3).max(150).required(),
    descricao: J.string().trim().allow('', null).max(65535),
    dificuldade: J.string().valid(...DIFICULDADES).required(),
    tipo: J.string().valid(...TIPOS).required(),
    status: J.string().valid(...STATUS_MISSAO),
    // null ou "" remove o QR Code da missão
    qr_code: J.string().trim().max(255).allow(null, ''),
  }),
  status: J.object({
    status: J.string().valid(...STATUS_MISSAO).required(),
  }),
};

// A regra "exatamente uma alternativa correta" é validada no quizService.
const alternativas = J.array()
  .items(
    J.object({
      texto: J.string().trim().min(1).max(255).required(),
      correta: J.boolean().default(false),
    })
  )
  .min(2)
  .max(6);

const idPositivo = J.number().integer().min(1);

const quiz = {
  id,
  criarPergunta: J.object({
    enunciado: J.string().trim().min(3).max(2000).required(),
    ordem: J.number().integer().min(1).max(999),
    alternativas: alternativas.required(),
  }),
  editarPergunta: J.object({
    missao_id: idPositivo,
    enunciado: J.string().trim().min(3).max(2000),
    ordem: J.number().integer().min(1).max(999),
    alternativas,
  }).min(1),
  correta: J.object({
    alternativa_id: idPositivo.required(),
  }),
  responder: J.object({
    respostas: J.array()
      .items(
        J.object({
          pergunta_id: idPositivo.required(),
          alternativa_id: idPositivo.required(),
        })
      )
      .min(1)
      .max(200)
      .required(),
  }),
};

const ranking = {
  filtros: J.object({
    curso: J.string().trim().max(100),
    limite: J.number().integer().min(1).max(100).default(50),
    pagina: J.number().integer().min(1).default(1),
  }),
};

const admin = {
  usuarios: J.object({
    formato: J.string().valid('json', 'csv').default('json'),
  }),
};

module.exports = { auth, usuario, missao, quiz, ranking, admin };
