const conquistaService = require('../services/conquistaService');

async function listar(req, res) {
  const conquistas = await conquistaService.listarDoUsuario(req.user.id);
  res.json({
    total: conquistas.length,
    desbloqueadas: conquistas.filter((c) => c.desbloqueada).length,
    conquistas,
  });
}

module.exports = { listar };
