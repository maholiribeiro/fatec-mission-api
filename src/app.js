/**
 * Montagem do app Express (separado do server.js para permitir testes com supertest).
 */
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const env = require('./config/env');
const swaggerSpec = require('./config/swagger');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '100kb' }));
if (env.nodeEnv !== 'test') app.use(morgan('dev'));

// Documentação interativa
app.get('/api-docs.json', (req, res) => res.json(swaggerSpec));
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: 'Fatec Mission API',
    swaggerOptions: { persistAuthorization: true },
  })
);

app.get('/', (req, res) =>
  res.json({ nome: 'Fatec Mission API', versao: '1.0.0', documentacao: '/api-docs' })
);

// Health check usado pela pipeline de CD: confirma que a versão publicada é o commit esperado.
// RENDER_GIT_COMMIT é definida automaticamente pelo Render em cada deploy.
app.get('/health', (req, res) =>
  res.json({ status: 'ok', commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'local' })
);

app.use(routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
