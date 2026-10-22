const bcrypt = require('bcryptjs');
const env = require('../config/env');
const usuarioModel = require('../models/usuarioModel');
const historicoModel = require('../models/historicoModel');
const conquistaService = require('./conquistaService');
const AppError = require('../utils/AppError');

/**
 * Cadastro público: SEMPRE cria com role='estudante'
 * (administradores só são criados via seed/banco).
 */
async function cadastrar({ nome, email, senha, curso, semestre }) {
  const emailNormalizado = email.toLowerCase();
  if (await usuarioModel.findByEmail(emailNormalizado)) {
    throw AppError.conflict('Já existe um usuário cadastrado com este e-mail.');
  }

  const senhaHash = await bcrypt.hash(senha, env.bcryptSaltRounds);
  // Se duas requisições passarem pela checagem ao mesmo tempo, o UNIQUE do e-mail
  // gera ER_DUP_ENTRY, que o middleware de erros converte em 409.
  const id = await usuarioModel.create({ nome, email: emailNormalizado, senhaHash, curso, semestre });
  return usuarioModel.findById(id);
}

/** Perfil completo do usuário autenticado: dados, XP, missões concluídas e conquistas. */
async function perfil(usuarioId) {
  const usuario = await usuarioModel.findById(usuarioId);
  if (!usuario) throw AppError.notFound('Usuário não encontrado.');

  const [missoes, conquistas, posicao] = await Promise.all([
    historicoModel.missoesConcluidas(usuarioId),
    conquistaService.listarDoUsuario(usuarioId),
    usuarioModel.posicaoNoRanking(usuarioId),
  ]);

  return {
    ...usuario,
    posicao_ranking: posicao,
    total_missoes_concluidas: missoes.length,
    missoes_concluidas: missoes,
    conquistas: conquistas.filter((c) => c.desbloqueada),
  };
}

module.exports = { cadastrar, perfil };
