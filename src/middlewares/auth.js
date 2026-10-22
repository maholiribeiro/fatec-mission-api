/**
 * Autenticação JWT: exige header "Authorization: Bearer <token>".
 * Em caso de sucesso, disponibiliza req.user = { id, role }.
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');

function autenticar(req, res, next) {
  const header = req.headers.authorization || '';
  const [esquema, token] = header.split(' ');

  if (!token || esquema !== 'Bearer') {
    return next(AppError.unauthorized('Token de autenticação ausente.'));
  }

  try {
    const payload = jwt.verify(token, env.jwt.secret);
    req.user = { id: Number(payload.sub), role: payload.role };
    return next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError' ? 'Token expirado.' : 'Token inválido.';
    return next(AppError.unauthorized(msg));
  }
}

module.exports = autenticar;
