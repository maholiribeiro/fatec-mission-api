const { Router } = require('express');
const controller = require('../controllers/rankingController');
const autenticar = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { ranking } = require('../validators/schemas');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

/**
 * @openapi
 * /ranking:
 *   get:
 *     tags: [Ranking]
 *     summary: Ranking de estudantes por XP
 *     description: |
 *       **Requer autenticação.** O ranking não é uma tabela: é uma consulta `ORDER BY xp DESC` sobre USUARIO.
 *       Apenas estudantes participam. Empates compartilham a mesma posição (1, 2, 2, 4...).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: curso
 *         description: Filtra pelo nome exato do curso
 *         schema: { type: string, example: Análise e Desenvolvimento de Sistemas }
 *       - in: query
 *         name: limite
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
 *       - in: query
 *         name: pagina
 *         schema: { type: integer, minimum: 1, default: 1 }
 *     responses:
 *       200:
 *         description: Ranking
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 curso: { type: string, nullable: true }
 *                 pagina: { type: integer, example: 1 }
 *                 limite: { type: integer, example: 50 }
 *                 total: { type: integer, example: 118 }
 *                 ranking:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/RankingItem' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.get('/ranking', autenticar, validate({ query: ranking.filtros }), asyncHandler(controller.obter));

module.exports = router;
