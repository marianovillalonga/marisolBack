const express = require('express');
const cors = require('cors');

const { FRONTEND_URLS } = require('./config/env');
const routes = require('./routes');
const { validateTrustedOriginForCookieAuth } = require('./middlewares/csrf.middleware');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { apiRateLimit } = require('./middlewares/rate-limit.middleware');
const { requireJsonContentType } = require('./middlewares/request-validation.middleware');
const { securityHeadersMiddleware } = require('./middlewares/security-headers.middleware');
const logger = require('./utils/logger.util');
const { buildHealthResponse } = require('./views/health.view');
const { getDependencyHealth, getLivenessHealth } = require('./services/health.service');

const app = express();
app.disable('x-powered-by');

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
app.use(securityHeadersMiddleware());
app.use(requireJsonContentType);
app.use(logger.createRequestLogger());
app.use('/api', apiRateLimit);
app.use('/api', validateTrustedOriginForCookieAuth);

app.get('/api/livez', (req, res) => {
  const health = getLivenessHealth();
  res.status(200).json(buildHealthResponse({ ...health, requestId: req.requestId || null }));
});

app.get('/api/readyz', async (req, res, next) => {
  try {
    const health = await getDependencyHealth();
    const statusCode = health.ok ? 200 : 503;
    res.status(statusCode).json(buildHealthResponse({ ...health, requestId: req.requestId || null }));
  } catch (error) {
    next(error);
  }
});

app.get('/api/health', async (req, res, next) => {
  try {
    const health = await getDependencyHealth();
    const statusCode = health.ok ? 200 : 503;
    res.status(statusCode).json(buildHealthResponse({ ...health, requestId: req.requestId || null }));
  } catch (error) {
    next(error);
  }
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
