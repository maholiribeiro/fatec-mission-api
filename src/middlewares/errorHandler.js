/**
 * Tratamento de erros centralizado. Toda resposta de erro segue o formato:
 *   { "erro": { "status": 404, "mensagem": "...", "detalhes": [...]? } }
 */
const AppError = require('../utils/AppError');
const env = require('../config/env');

function notFound(req, res, next) {
  next(AppError.notFound(`Rota não encontrada: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = 500;
  let mensagem = 'Erro interno do servidor.';
  let detalhes;

  if (err instanceof AppError) {
    status = err.status;
    mensagem = err.message;
    detalhes = err.detalhes;
  } else if (err.type === 'entity.parse.failed') {
    // JSON malformado no corpo da requisição
    status = 400;
    mensagem = 'JSON inválido no corpo da requisição.';
  } else if (err.code === 'ER_DUP_ENTRY') {
    // Violação de UNIQUE (e-mail de usuário, qr_code de missão, gabarito do quiz...)
    status = 409;
    const sql = err.sqlMessage || '';
    mensagem = sql.includes('qr_code')
      ? 'Já existe uma missão com este QR Code.'
      : sql.includes('uk_alternativa_uma_correta')
        ? 'Cada pergunta pode ter apenas uma alternativa correta.'
        : 'Registro duplicado.';
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_ROW_IS_REFERENCED_2') {
    status = 409;
    mensagem = 'Operação viola a integridade referencial dos dados.';
  }

  if (status === 500 && env.nodeEnv !== 'test') {
    console.error('[erro]', err);
  }

  const corpo = { erro: { status, mensagem } };
  if (detalhes) corpo.erro.detalhes = detalhes;
  if (status === 500 && env.nodeEnv === 'development') corpo.erro.debug = err.message;

  res.status(status).json(corpo);
}

module.exports = { notFound, errorHandler };
