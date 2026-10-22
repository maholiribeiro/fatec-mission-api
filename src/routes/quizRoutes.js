const { Router } = require('express');
const controller = require('../controllers/quizController');
const autenticar = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const validate = require('../middlewares/validate');
const { quiz } = require('../validators/schemas');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();
const admin = [autenticar, requireRole('administrador')];

// =====================================================================
// ESTUDANTES
// =====================================================================

/**
 * @openapi
 * /missoes/{id}/quiz:
 *   get:
 *     tags: [Quiz]
 *     summary: Carrega o quiz de uma missão para responder no app
 *     description: |
 *       **Requer autenticação.** Retorna as perguntas e alternativas **sem o gabarito**,
 *       além do XP total (100% de acertos) e do XP por pergunta.
 *       Somente missões do tipo quiz (`Tipo 2`) possuem perguntas.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/MissaoId'
 *     responses:
 *       200:
 *         description: Quiz pronto para ser respondido
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Quiz' }
 *       400:
 *         description: A missão não é um quiz, está inativa ou ainda não tem perguntas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Erro' }
 *             example: { erro: { status: 400, mensagem: 'Este quiz ainda não possui perguntas.' } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.get('/missoes/:id/quiz', autenticar, validate({ params: quiz.id }), asyncHandler(controller.obter));

/**
 * @openapi
 * /missoes/{id}/quiz/respostas:
 *   post:
 *     tags: [Quiz]
 *     summary: Envia as respostas do quiz e recebe a pontuação
 *     description: |
 *       **Requer autenticação.** Todas as perguntas devem ser respondidas, uma única vez cada.
 *
 *       **Pontuação:** o XP da missão (Fácil 75 · Médio 100 · Difícil 150) vale 100% do quiz e é
 *       dividido igualmente entre as perguntas. Ex.: 150 XP / 4 perguntas = 37,5 XP por pergunta;
 *       3 acertos = 112,5 → **113 XP** (o arredondamento é feito só no total).
 *
 *       - **1 ou mais acertos:** resultado `sucesso` com o XP proporcional. O quiz fica concluído.
 *       - **0 acertos:** resultado `erro` com a penalidade da dificuldade. É possível tentar de novo.
 *       - Quiz já concluído: **409**.
 *
 *       A correção informa se cada pergunta foi acertada, sem revelar a alternativa correta.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/MissaoId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RespostasQuizRequest' }
 *     responses:
 *       201:
 *         description: Tentativa registrada com a pontuação
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ResultadoQuiz' }
 *       400:
 *         description: Respostas incompletas, duplicadas ou de outra pergunta/quiz
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Erro' }
 *             example:
 *               erro:
 *                 status: 400
 *                 mensagem: Respostas inválidas.
 *                 detalhes: [{ campo: respostas, mensagem: 'Responda todas as perguntas. Faltando: 7, 8.' }]
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Quiz já concluído por este usuário
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Erro' }
 *             example: { erro: { status: 409, mensagem: 'Você já concluiu este quiz.' } }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.post(
  '/missoes/:id/quiz/respostas',
  autenticar,
  validate({ params: quiz.id, body: quiz.responder }),
  asyncHandler(controller.responder)
);

// =====================================================================
// ADMINISTRAÇÃO
// =====================================================================

/**
 * @openapi
 * /admin/missoes/{id}/perguntas:
 *   get:
 *     tags: [Quiz]
 *     summary: Lista as perguntas de um quiz com o gabarito
 *     description: "**Requer autenticação e role='administrador'.**"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/MissaoId'
 *     responses:
 *       200:
 *         description: Perguntas com as alternativas e qual é a correta
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/QuizAdmin' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 *   post:
 *     tags: [Quiz]
 *     summary: Cadastra uma pergunta (e suas alternativas) em um quiz
 *     description: |
 *       **Requer autenticação e role='administrador'.**
 *       A pergunta fica atrelada à missão do caminho, que precisa ser do tipo quiz (`Tipo 2`).
 *       Informe de 2 a 6 alternativas, com **exatamente uma** `correta: true`.
 *       Sem `ordem`, a pergunta entra no fim do quiz.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/MissaoId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PerguntaInput' }
 *     responses:
 *       201:
 *         description: Pergunta cadastrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Pergunta' }
 *       400:
 *         description: Dados inválidos, nenhuma ou mais de uma alternativa correta, ou a missão não é um quiz
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Erro' }
 *             example:
 *               erro:
 *                 status: 400
 *                 mensagem: Dados inválidos.
 *                 detalhes: [{ campo: alternativas, mensagem: 'Apenas uma alternativa pode ser correta (2 marcadas).' }]
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.get('/admin/missoes/:id/perguntas', ...admin, validate({ params: quiz.id }), asyncHandler(controller.listarPerguntas));
router.post(
  '/admin/missoes/:id/perguntas',
  ...admin,
  validate({ params: quiz.id, body: quiz.criarPergunta }),
  asyncHandler(controller.criarPergunta)
);

/**
 * @openapi
 * /admin/perguntas/{id}:
 *   put:
 *     tags: [Quiz]
 *     summary: Edita uma pergunta
 *     description: |
 *       **Requer autenticação e role='administrador'.** Envie só os campos que deseja alterar:
 *       - `missao_id`: move a pergunta para outro quiz;
 *       - `alternativas`: **substitui** todas as alternativas, com exatamente uma correta.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, description: ID da pergunta, schema: { type: integer, minimum: 1 } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PerguntaUpdate' }
 *     responses:
 *       200:
 *         description: Pergunta atualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Pergunta' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 *   delete:
 *     tags: [Quiz]
 *     summary: Remove uma pergunta (e suas alternativas)
 *     description: "**Requer autenticação e role='administrador'.**"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, description: ID da pergunta, schema: { type: integer, minimum: 1 } }
 *     responses:
 *       204: { description: Pergunta removida }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.put(
  '/admin/perguntas/:id',
  ...admin,
  validate({ params: quiz.id, body: quiz.editarPergunta }),
  asyncHandler(controller.atualizarPergunta)
);
router.delete('/admin/perguntas/:id', ...admin, validate({ params: quiz.id }), asyncHandler(controller.removerPergunta));

/**
 * @openapi
 * /admin/perguntas/{id}/correta:
 *   patch:
 *     tags: [Quiz]
 *     summary: Define qual alternativa é a correta
 *     description: |
 *       **Requer autenticação e role='administrador'.** Marca a alternativa informada como correta
 *       e desmarca as demais. A alternativa precisa pertencer à pergunta.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { name: id, in: path, required: true, description: ID da pergunta, schema: { type: integer, minimum: 1 } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [alternativa_id]
 *             properties:
 *               alternativa_id: { type: integer, example: 12 }
 *     responses:
 *       200:
 *         description: Gabarito atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Pergunta' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.patch(
  '/admin/perguntas/:id/correta',
  ...admin,
  validate({ params: quiz.id, body: quiz.correta }),
  asyncHandler(controller.definirCorreta)
);

module.exports = router;
