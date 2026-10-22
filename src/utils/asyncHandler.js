/**
 * Envolve controllers async para que qualquer exceção chegue ao middleware de erros
 * (o Express 4 não captura rejeições de Promises sozinho).
 */
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
