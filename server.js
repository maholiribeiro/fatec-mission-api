const env = require('./src/config/env');
const app = require('./src/app');
const { initDatabase } = require('./src/scripts/initDb');
const db = require('./src/config/database');

async function start() {
  // Geração automática do banco ao subir o servidor (idempotente).
  if (env.db.autoInit) {
    await initDatabase({ seed: env.db.autoSeed });
  }

  // Garante que o pool consegue falar com o banco antes de aceitar requisições.
  await db.query('SELECT 1');

  const server = app.listen(env.port, () => {
    console.log(`[api] Fatec Mission API rodando em http://localhost:${env.port}`);
    console.log(`[api] Documentação Swagger em http://localhost:${env.port}/api-docs`);
  });

  const shutdown = async (signal) => {
    console.log(`[api] ${signal} recebido, encerrando...`);
    server.close(async () => {
      await db.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  console.error('[api] Falha ao iniciar:', err.message);
  process.exit(1);
});
