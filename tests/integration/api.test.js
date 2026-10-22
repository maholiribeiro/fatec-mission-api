/**
 * Testes de integração da camada HTTP (rotas + middlewares + tratamento de erros)
 * com a camada de dados mockada — não exigem MySQL.
 */
jest.mock('../../src/config/database', () => ({ getConnection: jest.fn(), query: jest.fn() }));
jest.mock('../../src/models/usuarioModel');
jest.mock('../../src/services/missaoService');
jest.mock('../../src/services/adminService');
jest.mock('../../src/services/quizService');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const usuarioModel = require('../../src/models/usuarioModel');
const missaoService = require('../../src/services/missaoService');
const adminService = require('../../src/services/adminService');
const quizService = require('../../src/services/quizService');
const AppError = require('../../src/utils/AppError');

const token = (role, id = 1) => jwt.sign({ sub: id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
const estudante = `Bearer ${token('estudante')}`;
const admin = `Bearer ${token('administrador', 2)}`;

beforeEach(() => jest.resetAllMocks());

describe('POST /login', () => {
  test('credenciais válidas retornam JWT sem expor senha_hash', async () => {
    usuarioModel.findByEmail.mockResolvedValue({
      usuario_id: 1, nome: 'Maria', email: 'maria@fatec.sp.gov.br', curso: 'ADS', semestre: 3, xp: 0, role: 'estudante',
      senha_hash: await bcrypt.hash('Senha@123', 4),
    });

    const res = await request(app).post('/login').send({ email: 'MARIA@fatec.sp.gov.br', senha: 'Senha@123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.usuario).not.toHaveProperty('senha_hash');
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET)).toMatchObject({ sub: 1, role: 'estudante' });
    expect(usuarioModel.findByEmail).toHaveBeenCalledWith('maria@fatec.sp.gov.br');
  });

  test('senha errada → 401', async () => {
    usuarioModel.findByEmail.mockResolvedValue({ usuario_id: 1, role: 'estudante', senha_hash: await bcrypt.hash('certa', 4) });
    const res = await request(app).post('/login').send({ email: 'a@b.com', senha: 'errada' });
    expect(res.status).toBe(401);
    expect(res.body.erro.mensagem).toBe('E-mail ou senha inválidos.');
  });

  test('e-mail inexistente → 401 com a mesma mensagem', async () => {
    usuarioModel.findByEmail.mockResolvedValue(null);
    const res = await request(app).post('/login').send({ email: 'x@y.com', senha: 'qualquer' });
    expect(res.status).toBe(401);
    expect(res.body.erro.mensagem).toBe('E-mail ou senha inválidos.');
  });
});

describe('POST /usuarios', () => {
  test('dados inválidos → 400 com detalhes por campo', async () => {
    const res = await request(app).post('/usuarios').send({ nome: 'A', email: 'invalido', senha: '1', semestre: 20 });
    expect(res.status).toBe(400);
    const campos = res.body.erro.detalhes.map((d) => d.campo);
    expect(campos).toEqual(expect.arrayContaining(['nome', 'email', 'senha', 'curso', 'semestre']));
  });

  test('cadastro válido → 201, role sempre estudante, senha com hash', async () => {
    usuarioModel.findByEmail.mockResolvedValue(null);
    usuarioModel.create.mockResolvedValue(10);
    usuarioModel.findById.mockResolvedValue({ usuario_id: 10, nome: 'Maria', email: 'maria@fatec.sp.gov.br', curso: 'ADS', semestre: 3, xp: 0, role: 'estudante' });

    const res = await request(app).post('/usuarios').send({
      nome: 'Maria', email: 'maria@fatec.sp.gov.br', senha: 'Senha@123', curso: 'ADS', semestre: 3, role: 'administrador',
    });

    expect(res.status).toBe(201);
    const criado = usuarioModel.create.mock.calls[0][0];
    expect(criado).not.toHaveProperty('role', 'administrador');
    expect(criado.senhaHash).not.toBe('Senha@123');
    expect(await bcrypt.compare('Senha@123', criado.senhaHash)).toBe(true);
  });

  test('e-mail já cadastrado → 409', async () => {
    usuarioModel.findByEmail.mockResolvedValue({ usuario_id: 1 });
    const res = await request(app).post('/usuarios').send({
      nome: 'Maria', email: 'maria@fatec.sp.gov.br', senha: 'Senha@123', curso: 'ADS', semestre: 3,
    });
    expect(res.status).toBe(409);
  });
});

describe('Autenticação e autorização', () => {
  test('rota privada sem token → 401', async () => {
    const res = await request(app).get('/perfil');
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ erro: { status: 401, mensagem: 'Token de autenticação ausente.' } });
  });

  test('token inválido → 401', async () => {
    const res = await request(app).get('/missoes').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });

  test('estudante em rota /admin → 403', async () => {
    const res = await request(app).get('/admin/dashboard').set('Authorization', estudante);
    expect(res.status).toBe(403);
    expect(adminService.dashboard).not.toHaveBeenCalled();
  });

  test('administrador em rota /admin → 200', async () => {
    adminService.dashboard.mockResolvedValue({ usuarios: { total: 3 } });
    const res = await request(app).get('/admin/dashboard').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body.usuarios.total).toBe(3);
  });
});

describe('POST /missoes/:id/concluir', () => {
  test('corpo vazio → 400', async () => {
    const res = await request(app).post('/missoes/1/concluir').set('Authorization', estudante).send({});
    expect(res.status).toBe(400);
  });

  test('id não numérico → 400', async () => {
    const res = await request(app).post('/missoes/abc/concluir').set('Authorization', estudante).send({ resultado: 'sucesso' });
    expect(res.status).toBe(400);
  });

  test('sucesso duplicado → 409 em JSON padronizado', async () => {
    missaoService.concluir.mockRejectedValue(AppError.conflict('Você já concluiu esta missão com sucesso.'));
    const res = await request(app).post('/missoes/1/concluir').set('Authorization', estudante).send({ resultado: 'sucesso' });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: { status: 409, mensagem: 'Você já concluiu esta missão com sucesso.' } });
  });

  test('tentativa válida → 201 e repassa id numérico e usuário do token', async () => {
    missaoService.concluir.mockResolvedValue({ historico: { xp_variacao: 100 } });
    const res = await request(app).post('/missoes/3/concluir').set('Authorization', estudante).send({ resultado: 'sucesso' });
    expect(res.status).toBe(201);
    expect(missaoService.concluir).toHaveBeenCalledWith(3, 1, { resultado: 'sucesso' });
  });
});

describe('Admin: validação de missões', () => {
  test('POST /admin/missoes com dificuldade inválida → 400', async () => {
    const res = await request(app).post('/admin/missoes').set('Authorization', admin)
      .send({ titulo: 'Nova missão', dificuldade: 'Épica', tipo: 'Tipo 1' });
    expect(res.status).toBe(400);
    expect(res.body.erro.detalhes[0].campo).toBe('dificuldade');
  });

  test('POST /admin/missoes ignora campo xp enviado pelo cliente', async () => {
    missaoService.criar.mockResolvedValue({ missao_id: 1 });
    const res = await request(app).post('/admin/missoes').set('Authorization', admin)
      .send({ titulo: 'Nova missão', dificuldade: 'Fácil', tipo: 'Tipo 1', xp: 9999 });
    expect(res.status).toBe(201);
    expect(missaoService.criar.mock.calls[0][0]).not.toHaveProperty('xp');
  });

  test('PATCH status inválido → 400', async () => {
    const res = await request(app).patch('/admin/missoes/1/status').set('Authorization', admin).send({ status: 'pausada' });
    expect(res.status).toBe(400);
  });
});

describe('Quiz', () => {
  const pergunta = {
    enunciado: 'Qual estrutura segue LIFO?',
    alternativas: [
      { texto: 'Pilha', correta: true },
      { texto: 'Fila' },
    ],
  };

  test('estudante não cadastra perguntas → 403', async () => {
    const res = await request(app).post('/admin/missoes/4/perguntas').set('Authorization', estudante).send(pergunta);
    expect(res.status).toBe(403);
    expect(quizService.criarPergunta).not.toHaveBeenCalled();
  });

  test('admin cadastra pergunta → 201 (correta assume false por padrão)', async () => {
    quizService.criarPergunta.mockResolvedValue({ pergunta_id: 9 });
    const res = await request(app).post('/admin/missoes/4/perguntas').set('Authorization', admin).send(pergunta);
    expect(res.status).toBe(201);
    expect(quizService.criarPergunta).toHaveBeenCalledWith(4, {
      enunciado: 'Qual estrutura segue LIFO?',
      alternativas: [
        { texto: 'Pilha', correta: true },
        { texto: 'Fila', correta: false },
      ],
    });
  });

  test('menos de 2 alternativas → 400', async () => {
    const res = await request(app)
      .post('/admin/missoes/4/perguntas')
      .set('Authorization', admin)
      .send({ enunciado: 'Pergunta?', alternativas: [{ texto: 'Única', correta: true }] });
    expect(res.status).toBe(400);
    expect(res.body.erro.detalhes[0].campo).toBe('alternativas');
  });

  test('PUT sem nenhum campo → 400', async () => {
    const res = await request(app).put('/admin/perguntas/1').set('Authorization', admin).send({});
    expect(res.status).toBe(400);
  });

  test('PATCH correta exige alternativa_id', async () => {
    const res = await request(app).patch('/admin/perguntas/1/correta').set('Authorization', admin).send({});
    expect(res.status).toBe(400);
  });

  test('DELETE pergunta → 204', async () => {
    quizService.removerPergunta.mockResolvedValue();
    const res = await request(app).delete('/admin/perguntas/1').set('Authorization', admin);
    expect(res.status).toBe(204);
  });

  test('carregar quiz exige login', async () => {
    const res = await request(app).get('/missoes/4/quiz');
    expect(res.status).toBe(401);
  });

  test('responder quiz → 201 repassando usuário do token e respostas', async () => {
    quizService.responder.mockResolvedValue({ pontuacao: { xp_obtido: 113 } });
    const respostas = [{ pergunta_id: 1, alternativa_id: 11 }];
    const res = await request(app).post('/missoes/4/quiz/respostas').set('Authorization', estudante).send({ respostas });
    expect(res.status).toBe(201);
    expect(quizService.responder).toHaveBeenCalledWith(4, 1, respostas);
  });

  test('respostas sem alternativa_id → 400', async () => {
    const res = await request(app)
      .post('/missoes/4/quiz/respostas')
      .set('Authorization', estudante)
      .send({ respostas: [{ pergunta_id: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.erro.detalhes[0].campo).toBe('respostas.0.alternativa_id');
  });

  test('quiz já concluído → 409 em JSON padronizado', async () => {
    quizService.responder.mockRejectedValue(AppError.conflict('Você já concluiu este quiz.'));
    const res = await request(app)
      .post('/missoes/4/quiz/respostas')
      .set('Authorization', estudante)
      .send({ respostas: [{ pergunta_id: 1, alternativa_id: 11 }] });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ erro: { status: 409, mensagem: 'Você já concluiu este quiz.' } });
  });
});

describe('Admin: exclusão de missão e exportação de usuários', () => {
  test('DELETE /admin/missoes/:id → 204', async () => {
    missaoService.excluir.mockResolvedValue();
    const res = await request(app).delete('/admin/missoes/3').set('Authorization', admin);
    expect(res.status).toBe(204);
    expect(missaoService.excluir).toHaveBeenCalledWith(3);
  });

  test('DELETE de missão com tentativas → 409 em JSON padronizado', async () => {
    missaoService.excluir.mockRejectedValue(AppError.conflict('Esta missão possui 2 tentativa(s) registrada(s)...'));
    const res = await request(app).delete('/admin/missoes/3').set('Authorization', admin);
    expect(res.status).toBe(409);
  });

  test('estudante não exclui missão → 403', async () => {
    const res = await request(app).delete('/admin/missoes/3').set('Authorization', estudante);
    expect(res.status).toBe(403);
    expect(missaoService.excluir).not.toHaveBeenCalled();
  });

  test('GET /admin/usuarios?formato=csv → arquivo CSV para download', async () => {
    adminService.exportarUsuariosCsv.mockResolvedValue('﻿ID;Nome\r\n1;Ana\r\n');
    const res = await request(app).get('/admin/usuarios?formato=csv').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="usuarios-fatec-mission-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(res.text).toContain('1;Ana');
  });

  test('GET /admin/usuarios → JSON por padrão; formato inválido → 400', async () => {
    adminService.listarUsuarios.mockResolvedValue([{ usuario_id: 1 }]);
    const ok = await request(app).get('/admin/usuarios').set('Authorization', admin);
    expect(ok.status).toBe(200);
    expect(ok.body).toEqual([{ usuario_id: 1 }]);
    const bad = await request(app).get('/admin/usuarios?formato=xls').set('Authorization', admin);
    expect(bad.status).toBe(400);
  });

  test('exportação exige administrador', async () => {
    const res = await request(app).get('/admin/usuarios?formato=csv').set('Authorization', estudante);
    expect(res.status).toBe(403);
  });
});

describe('Diversos', () => {
  test('JSON malformado → 400', async () => {
    const res = await request(app).post('/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
  });

  test('rota inexistente → 404', async () => {
    const res = await request(app).get('/nao-existe');
    expect(res.status).toBe(404);
  });

  test('especificação Swagger documenta todos os endpoints', async () => {
    const res = await request(app).get('/api-docs.json');
    expect(res.status).toBe(200);
    expect(res.body.info.title).toBe('Fatec Mission API');
    expect(Object.keys(res.body.paths).sort()).toEqual([
      '/admin/dashboard',
      '/admin/missoes',
      '/admin/missoes/{id}',
      '/admin/missoes/{id}/perguntas',
      '/admin/missoes/{id}/status',
      '/admin/perguntas/{id}',
      '/admin/perguntas/{id}/correta',
      '/admin/usuarios',
      '/conquistas',
      '/login',
      '/missoes',
      '/missoes/{id}',
      '/missoes/{id}/concluir',
      '/missoes/{id}/quiz',
      '/missoes/{id}/quiz/respostas',
      '/perfil',
      '/ranking',
      '/usuarios',
    ]);
    expect(res.body.components.securitySchemes.bearerAuth.scheme).toBe('bearer');
  });
});
