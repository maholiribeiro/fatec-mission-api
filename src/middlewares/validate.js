/**
 * Validação de entrada com Joi.
 * Uso: validate({ body: schema, params: schema, query: schema })
 * Os valores validados/convertidos (ex.: "3" → 3, trim) substituem os originais.
 */
const AppError = require('../utils/AppError');

const OPCOES = { abortEarly: false, stripUnknown: true, convert: true };

function validate(schemas) {
  return (req, res, next) => {
    const detalhes = [];

    for (const origem of ['params', 'query', 'body']) {
      if (!schemas[origem]) continue;
      const { value, error } = schemas[origem].validate(req[origem] ?? {}, OPCOES);
      if (error) {
        detalhes.push(
          ...error.details.map((d) => ({ campo: d.path.join('.') || origem, mensagem: d.message }))
        );
      } else {
        req[origem] = value;
      }
    }

    if (detalhes.length) return next(AppError.badRequest('Dados inválidos.', detalhes));
    return next();
  };
}

module.exports = validate;
