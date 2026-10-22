const { Router } = require('express');
const controller = require('../controllers/authController');
const validate = require('../middlewares/validate');
const { auth } = require('../validators/schemas');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

/**
 * @openapi
 * /login:
 *   post:
 *     tags: [Autenticação]
 *     summary: Autentica o usuário e retorna um JWT
 *     description: Rota pública. Use o token retornado no botão **Authorize** (Bearer).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *           examples:
 *             estudante:
 *               value: { email: maria@fatec.sp.gov.br, senha: Senha@123 }
 *             administrador:
 *               value: { email: admin@fatec.sp.gov.br, senha: Admin@123 }
 *     responses:
 *       200:
 *         description: Autenticado com sucesso
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LoginResponse' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Erro' }
 *             example: { erro: { status: 401, mensagem: 'E-mail ou senha inválidos.' } }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.post('/login', validate({ body: auth.login }), asyncHandler(controller.login));

module.exports = router;
