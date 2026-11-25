/**
 * Pool de conexões MySQL (mysql2/promise).
 * O pool só abre conexões na primeira query, então importar este módulo é barato.
 */
const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  ssl: env.db.ssl,
  connectionLimit: env.db.connectionLimit,
  waitForConnections: true,
  charset: 'utf8mb4', // necessário para os ENUMs acentuados ('Fácil', 'Médio', 'Difícil')
  decimalNumbers: true, // SUM()/AVG() retornam number em vez de string
  timezone: 'Z',
});

module.exports = pool;
