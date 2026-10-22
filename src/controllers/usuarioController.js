const usuarioService = require('../services/usuarioService');

async function cadastrar(req, res) {
  const usuario = await usuarioService.cadastrar(req.body);
  res.status(201).location(`/perfil`).json(usuario);
}

async function perfil(req, res) {
  res.json(await usuarioService.perfil(req.user.id));
}

module.exports = { cadastrar, perfil };
