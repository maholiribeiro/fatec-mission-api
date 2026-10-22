const authService = require('../services/authService');

async function login(req, res) {
  const resultado = await authService.login(req.body.email, req.body.senha);
  res.json(resultado);
}

module.exports = { login };
