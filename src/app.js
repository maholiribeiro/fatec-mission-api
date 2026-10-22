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

app.use(routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
