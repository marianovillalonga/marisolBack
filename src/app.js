const express = require('express');
const cors = require('cors');

const { FRONTEND_URL } = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
const { buildHealthResponse } = require('./views/health.view');

const app = express();

app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  }),
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json(buildHealthResponse());
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
