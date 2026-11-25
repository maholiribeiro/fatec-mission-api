/**
 * Centraliza a leitura das variáveis de ambiente.
 * Nenhuma credencial fica hardcoded: tudo vem do .env (ver .env.example).
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const OBRIGATORIAS = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];
const faltando = OBRIGATORIAS.filter((k) => !process.env[k]);
if (faltando.length) {
  throw new Error(
    `Variáveis de ambiente obrigatórias ausentes: ${faltando.join(', ')}. ` +
      'Copie o .env.example para .env e preencha os valores.'
  );
}

const bool = (v, padrao = false) => (v === undefined ? padrao : String(v).toLowerCase() === 'true');

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
    // Bancos MySQL na nuvem (ex.: Aiven) exigem conexão criptografada.
    ssl: bool(process.env.DB_SSL, false) ? { rejectUnauthorized: false } : undefined,
    autoInit: bool(process.env.DB_AUTO_INIT, false),
    autoSeed: bool(process.env.DB_AUTO_SEED, false),
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },
  bcryptSaltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  admin: {
    nome: process.env.ADMIN_NOME || 'Administrador',
    email: process.env.ADMIN_EMAIL,
    senha: process.env.ADMIN_PASSWORD,
  },
};
