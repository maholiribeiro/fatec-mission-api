const { Router } = require('express');
const controller = require('../controllers/conquistaController');
const autenticar = require('../middlewares/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

/**
 * @openapi
 * /conquistas:
 *   get:
 *     tags: [Conquistas]
 *     summary: Lista todas as conquistas e quais o usuário já desbloqueou
 *     description: "**Requer autenticação.**"
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Conquistas com status de desbloqueio
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer, example: 8 }
 *                 desbloqueadas: { type: integer, example: 2 }
 *                 conquistas:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/ConquistaUsuario' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.get('/conquistas', autenticar, asyncHandler(controller.listar));

module.exports = router;
