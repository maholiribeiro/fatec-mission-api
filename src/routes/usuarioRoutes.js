const { Router } = require('express');
const controller = require('../controllers/usuarioController');
const autenticar = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { usuario } = require('../validators/schemas');
const asyncHandler = require('../utils/asyncHandler');

const router = Router();

/**
 * @openapi
 * /usuarios:
 *   post:
 *     tags: [Usuários]
 *     summary: Cadastra um novo estudante
 *     description: |
 *       Rota pública. O usuário é sempre criado com `role = 'estudante'` e `xp = 0`.
 *       A senha é armazenada somente como hash bcrypt.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UsuarioCadastro' }
 *     responses:
 *       201:
 *         description: Estudante cadastrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Usuario' }
 *             example:
 *               usuario_id: 1
 *               nome: Maria Souza
 *               email: maria@fatec.sp.gov.br
 *               curso: Análise e Desenvolvimento de Sistemas
 *               semestre: 3
 *               xp: 0
 *               role: estudante
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       409:
 *         description: E-mail já cadastrado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Erro' }
 *             example: { erro: { status: 409, mensagem: 'Já existe um usuário cadastrado com este e-mail.' } }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.post('/usuarios', validate({ body: usuario.cadastro }), asyncHandler(controller.cadastrar));

/**
 * @openapi
 * /perfil:
 *   get:
 *     tags: [Usuários]
 *     summary: Perfil do usuário autenticado
 *     description: Retorna nome, curso, XP, posição no ranking, missões concluídas e conquistas desbloqueadas. **Requer autenticação.**
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Perfil do usuário
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Perfil' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.get('/perfil', autenticar, asyncHandler(controller.perfil));

module.exports = router;
