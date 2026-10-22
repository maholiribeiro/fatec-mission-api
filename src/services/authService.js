const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const usuarioModel = require('../models/usuarioModel');
const AppError = require('../utils/AppError');

/** Hash bcrypt usado quando o e-mail não existe, para o tempo de resposta não revelar isso. */
const HASH_FALSO = bcrypt.hashSync('usuario-inexistente', env.bcryptSaltRounds);

function gerarToken(usuario) {
  return jwt.sign({ sub: usuario.usuario_id, role: usuario.role }, env.jwt.secret, {
    expiresIn: env.jwt.expiresIn,
  });
}

function semSenha(usuario) {
  const { senha_hash, ...publico } = usuario;
  return publico;
}

async function login(email, senha) {
  const usuario = await usuarioModel.findByEmail(email.toLowerCase());
  const senhaOk = await bcrypt.compare(senha, usuario ? usuario.senha_hash : HASH_FALSO);

  // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem).
  if (!usuario || !senhaOk) {
    throw AppError.unauthorized('E-mail ou senha inválidos.');
  }

  return {
    token: gerarToken(usuario),
    tipo: 'Bearer',
    expira_em: env.jwt.expiresIn,
    usuario: semSenha(usuario),
  };
}

module.exports = { login, gerarToken };
