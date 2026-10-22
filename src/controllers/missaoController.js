const missaoService = require('../services/missaoService');

async function listar(req, res) {
  res.json(await missaoService.listar(req.query, req.user));
}

async function detalhar(req, res) {
  res.json(await missaoService.detalhar(req.params.id, req.user));
}

async function concluir(req, res) {
  const resultado = await missaoService.concluir(req.params.id, req.user.id, req.body);
  res.status(201).json(resultado);
}

// --------------------------- Administração ---------------------------

async function criar(req, res) {
  const missao = await missaoService.criar(req.body);
  res.status(201).location(`/missoes/${missao.missao_id}`).json(missao);
}

async function atualizar(req, res) {
  res.json(await missaoService.atualizar(req.params.id, req.body));
}

async function alterarStatus(req, res) {
  res.json(await missaoService.alterarStatus(req.params.id, req.body.status));
}

async function excluir(req, res) {
  await missaoService.excluir(req.params.id);
  res.status(204).end();
}

module.exports = { listar, detalhar, concluir, criar, atualizar, alterarStatus, excluir };
