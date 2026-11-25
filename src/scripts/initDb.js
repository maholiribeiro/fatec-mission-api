/**
 * Geração automática do banco de dados.
 *
 *   npm run db:init   → cria o banco (se não existir) e todas as tabelas
 *   npm run db:seed   → idem + dados de exemplo (missões, conquistas, admin)
 *
 * Também é chamado pelo server.js quando DB_AUTO_INIT=true.
 * É idempotente: CREATE DATABASE/TABLE IF NOT EXISTS e seeds que não duplicam registros.
 */
const mysql = require('mysql2/promise');
const env = require('../config/env');
const { TABELAS } = require('./schema');
const { seed } = require('./seed');

async function initDatabase({ seed: executarSeed = false, log = console.log } = {}) {
  // Conecta SEM banco selecionado, para conseguir criá-lo.
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    ssl: env.db.ssl,
    charset: 'utf8mb4',
  });

  try {
    const nomeBanco = mysql.escapeId(env.db.database);
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS ${nomeBanco} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE ${nomeBanco}`);
    log(`[db:init] Banco "${env.db.database}" pronto.`);

    for (const tabela of TABELAS) {
      await conn.query(tabela.ddl);
      log(`[db:init] Tabela "${tabela.nome}" OK.`);
    }

    if (executarSeed) {
      await seed(conn, log);
    }

    log('[db:init] Inicialização concluída.');
  } finally {
    await conn.end();
  }
}

// Execução via linha de comando: node src/scripts/initDb.js [--seed]
if (require.main === module) {
  const comSeed = process.argv.includes('--seed');
  initDatabase({ seed: comSeed })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[db:init] Falha:', err.message);
      process.exit(1);
    });
}

module.exports = { initDatabase };
