const { Router } = require('express');
const controller = require('../controllers/missaoController');
const autenticar = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { missao } = require('../validators/schemas');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

router.use('/missoes', autenticar);

/**
 * @openapi
 * /missoes:
 *   get:
 *     tags: [Missões]
 *     summary: "Lista missões (padrão: somente ativas)"
 *     description: |
 *       **Requer autenticação.** Cada missão traz `concluida` indicando se o usuário autenticado já a concluiu.
 *       O valor do `qr_code` só aparece para administradores.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tipo
 *         schema: { $ref: '#/components/schemas/TipoMissao' }
 *       - in: query
 *         name: dificuldade
 *         schema: { $ref: '#/components/schemas/Dificuldade' }
 *       - in: query
 *         name: status
 *         description: "Padrão: ativa. Use 'todas' para não filtrar."
 *         schema: { type: string, enum: [ativa, inativa, todas], default: ativa }
 *     responses:
 *       200:
 *         description: Lista de missões
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Missao' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.get('/missoes', validate({ query: missao.filtros }), asyncHandler(controller.listar));

/**
 * @openapi
 * /missoes/{id}:
 *   get:
 *     tags: [Missões]
 *     summary: Detalhes de uma missão
 *     description: "**Requer autenticação.**"
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/MissaoId'
 *     responses:
 *       200:
 *         description: Missão encontrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Missao' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.get('/missoes/:id', validate({ params: missao.id }), asyncHandler(controller.detalhar));

/**
 * @openapi
 * /missoes/{id}/concluir:
 *   post:
 *     tags: [Missões]
 *     summary: Registra uma tentativa (sucesso ou erro) em uma missão
 *     description: |
 *       **Requer autenticação.** Aplica as regras de negócio:
 *       - Sucesso: soma o XP da missão (Fácil +75, Médio +100, Difícil +150) e verifica conquistas.
 *       - Erro: aplica penalidade (Fácil −15, Médio −25, Difícil −75).
 *       - Só existe **um** sucesso por missão; um segundo sucesso retorna **409**. Erros podem se repetir.
 *       - Missões com QR Code: envie `qr_code`; o resultado é definido pela comparação com o código cadastrado.
 *       - Missões sem QR Code: envie `resultado`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/MissaoId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ConcluirMissaoRequest' }
 *           examples:
 *             qrCode:
 *               summary: Missão presencial (QR Code)
 *               value: { qr_code: FATEC-BIBLIOTECA-001 }
 *             sucesso:
 *               summary: Missão virtual concluída
 *               value: { resultado: sucesso }
 *             erro:
 *               summary: Tentativa com erro
 *               value: { resultado: erro }
 *     responses:
 *       201:
 *         description: Tentativa registrada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ConcluirMissaoResponse' }
 *             examples:
 *               sucesso:
 *                 value:
 *                   mensagem: Missão concluída com sucesso! +75 XP
 *                   historico: { historico_id: 10, usuario_id: 1, missao_id: 1, resultado: sucesso, xp_variacao: 75 }
 *                   xp_total: 75
 *                   conquistas_desbloqueadas:
 *                     - { conquista_id: 1, nome: Primeiros Passos, descricao: Conclua sua primeira missão., icone: /icones/primeiros-passos.png, requisito: 'missoes:1' }
 *               erro:
 *                 value:
 *                   mensagem: Tentativa incorreta. -15 XP
 *                   historico: { historico_id: 11, usuario_id: 1, missao_id: 2, resultado: erro, xp_variacao: -15 }
 *                   xp_total: 60
 *                   conquistas_desbloqueadas: []
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: Missão já concluída com sucesso por este usuário
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Erro' }
 *             example: { erro: { status: 409, mensagem: 'Você já concluiu esta missão com sucesso.' } }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.post(
  '/missoes/:id/concluir',
  validate({ params: missao.id, body: missao.concluir }),
  asyncHandler(controller.concluir)
);

module.exports = router;
