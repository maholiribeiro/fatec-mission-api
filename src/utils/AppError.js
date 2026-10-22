/**
 * Erro de aplicação com status HTTP. Lançado pelos services e convertido
 * em JSON padronizado pelo middleware central de erros.
 */
class AppError extends Error {
  constructor(status, mensagem, detalhes) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;
    this.detalhes = detalhes;
  }

  static badRequest(msg, detalhes) {
    return new AppError(400, msg, detalhes);
  }
  static unauthorized(msg = 'Não autenticado.') {
    return new AppError(401, msg);
  }
  static forbidden(msg = 'Acesso negado.') {
    return new AppError(403, msg);
  }
  static notFound(msg = 'Recurso não encontrado.') {
    return new AppError(404, msg);
  }
  static conflict(msg) {
    return new AppError(409, msg);
  }
}

module.exports = AppError;
