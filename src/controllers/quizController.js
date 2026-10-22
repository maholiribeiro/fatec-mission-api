const quizService = require('../services/quizService');

// --------------------------- Estudantes ---------------------------

async function obter(req, res) {
  res.json(await quizService.obterQuiz(req.params.id, req.user));
}

async function responder(req, res) {
  res.status(201).json(await quizService.responder(req.params.id, req.user.id, req.body.respostas));
}

// --------------------------- Administração ---------------------------

async function listarPerguntas(req, res) {
  res.json(await quizService.listarPerguntasAdmin(req.params.id));
}

async function criarPergunta(req, res) {
  const pergunta = await quizService.criarPergunta(req.params.id, req.body);
  res.status(201).json(pergunta);
}

async function atualizarPergunta(req, res) {
  res.json(await quizService.atualizarPergunta(req.params.id, req.body));
}

async function definirCorreta(req, res) {
  res.json(await quizService.definirAlternativaCorreta(req.params.id, req.body.alternativa_id));
}

async function removerPergunta(req, res) {
  await quizService.removerPergunta(req.params.id);
  res.status(204).end();
}

module.exports = { obter, responder, listarPerguntas, criarPergunta, atualizarPergunta, definirCorreta, removerPergunta };
