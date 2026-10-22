const { Router } = require('express');
const missaoController = require('../controllers/missaoController');
const adminController = require('../controllers/adminController');
const autenticar = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const validate = require('../middlewares/validate');
const { missao, admin } = require('../validators/schemas');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

// Todas as rotas /admin/* exigem JWT válido E role='administrador'.
router.use('/admin', autenticar, requireRole('administrador'));

/**
 * @openapi
 * /admin/missoes:
 *   post:
 *     tags: [Administração]
 *     summary: Cria uma missão
 *     description: |
 *       **Requer autenticação e role='administrador'.**
 *       O XP é definido automaticamente pela dificuldade (Fácil=75, Médio=100, Difícil=150) — não envie `xp`.
 *       `qr_code` é opcional em qualquer tipo de missão e deve ser único.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MissaoInput' }
 *           example:
 *             titulo: Visite o Auditório
 *             descricao: Leia o QR Code na entrada do auditório.
 *             dificuldade: Fácil
 *             tipo: Tipo 1
 *             qr_code: FATEC-AUDITORIO-001
 *     responses:
 *       201:
 *         description: Missão criada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Missao' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       409:
 *         description: QR Code já utilizado por outra missão
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Erro' }
 *             example: { erro: { status: 409, mensagem: 'Já existe uma missão com este QR Code.' } }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.post('/admin/missoes', validate({ body: missao.criar }), asyncHandler(missaoController.criar));

/**
 * @openapi
 * /admin/missoes/{id}:
 *   put:
 *     tags: [Administração]
 *     summary: Edita uma missão
 *     description: |
 *       **Requer autenticação e role='administrador'.**
 *       `titulo`, `dificuldade` e `tipo` são obrigatórios. Campos opcionais omitidos mantêm o valor atual;
 *       `qr_code: null` (ou "") remove o QR Code. Se a dificuldade mudar, o XP é recalculado.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/MissaoId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/MissaoInput' }
 *           example:
 *             titulo: Visite o Auditório (atualizada)
 *             dificuldade: Médio
 *             tipo: Tipo 1
 *     responses:
 *       200:
 *         description: Missão atualizada
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Missao' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       500: { $ref: '#/components/responses/InternalError' }
 *   delete:
 *     tags: [Administração]
 *     summary: Exclui uma missão
 *     description: |
 *       **Requer autenticação e role='administrador'.**
 *       Só é possível excluir missões **sem tentativas registradas**: apagar o histórico alteraria
 *       o XP já conquistado pelos estudantes. Missões já jogadas devem ser desativadas.
 *       Perguntas e alternativas de quiz são removidas junto.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/MissaoId'
 *     responses:
 *       204: { description: Missão excluída }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409:
 *         description: A missão possui tentativas registradas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Erro' }
 *             example:
 *               erro:
 *                 status: 409
 *                 mensagem: Esta missão possui 12 tentativa(s) registrada(s) e não pode ser excluída, para preservar o histórico e o XP dos estudantes. Desative-a.
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.put(
  '/admin/missoes/:id',
  validate({ params: missao.id, body: missao.editar }),
  asyncHandler(missaoController.atualizar)
);
router.delete('/admin/missoes/:id', validate({ params: missao.id }), asyncHandler(missaoController.excluir));

/**
 * @openapi
 * /admin/missoes/{id}/status:
 *   patch:
 *     tags: [Administração]
 *     summary: Ativa ou desativa uma missão
 *     description: "**Requer autenticação e role='administrador'.** Missões inativas não podem ser concluídas."
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - $ref: '#/components/parameters/MissaoId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { $ref: '#/components/schemas/StatusMissao' }
 *           example: { status: inativa }
 *     responses:
 *       200:
 *         description: Status atualizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Missao' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.patch(
  '/admin/missoes/:id/status',
  validate({ params: missao.id, body: missao.status }),
  asyncHandler(missaoController.alterarStatus)
);

/**
 * @openapi
 * /admin/dashboard:
 *   get:
 *     tags: [Administração]
 *     summary: Indicadores gerais da plataforma
 *     description: |
 *       **Requer autenticação e role='administrador'.**
 *       Total de usuários (e estudantes ativos: com ao menos uma tentativa), missões, XP distribuído,
 *       penalidades, taxas de acerto e conclusão, todas as missões ordenadas da mais à menos realizada
 *       e participação por curso.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Indicadores
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Dashboard' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.get('/admin/dashboard', asyncHandler(adminController.dashboard));

/**
 * @openapi
 * /admin/usuarios:
 *   get:
 *     tags: [Administração]
 *     summary: Lista (ou exporta em CSV) todos os usuários cadastrados
 *     description: |
 *       **Requer autenticação e role='administrador'.** Inclui XP, missões concluídas, tentativas,
 *       erros e conquistas de cada usuário (nunca a senha).
 *
 *       Com `formato=csv`, retorna um arquivo para download, pronto para o Excel em português:
 *       separador `;`, UTF-8 com BOM.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: formato
 *         schema: { type: string, enum: [json, csv], default: json }
 *     responses:
 *       200:
 *         description: Usuários
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/UsuarioAdmin' }
 *           text/csv:
 *             schema: { type: string }
 *             example: "ID;Nome;E-mail;Curso;Semestre;Perfil;XP;Missões concluídas;Tentativas;Erros;Conquistas\r\n7;Maria Souza;maria@fatec.sp.gov.br;ADS;3;estudante;325;3;4;1;2\r\n"
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.get('/admin/usuarios', validate({ query: admin.usuarios }), asyncHandler(adminController.usuarios));

module.exports = router;
