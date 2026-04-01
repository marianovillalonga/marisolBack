const express = require('express');
const cors = require('cors');

const { FRONTEND_URLS } = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const logger = require('./utils/logger.util');
const { buildHealthResponse } = require('./views/health.view');

const app = express();

const allowedOrigins = new Set(FRONTEND_URLS);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '15mb' }));
app.use(logger.createRequestLogger());

app.get('/api/health', (_req, res) => {
  res.status(200).json(buildHealthResponse());
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
