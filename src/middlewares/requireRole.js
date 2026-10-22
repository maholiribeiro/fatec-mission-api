/**
 * Autorização por role. Deve ser usado DEPOIS do middleware de autenticação.
 * Ex.: router.use(autenticar, requireRole('administrador'))
 */
const AppError = require('../utils/AppError');

function requireRole(...rolesPermitidas) {
  return (req, res, next) => {
    if (!req.user) return next(AppError.unauthorized('Não autenticado.'));
    if (!rolesPermitidas.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          rolesPermitidas.includes('administrador') && rolesPermitidas.length === 1
            ? 'Acesso restrito a administradores.'
            : 'Acesso negado para o seu perfil.'
        )
      );
    }
    return next();
  };
}

module.exports = requireRole;
