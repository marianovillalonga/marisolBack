const logger = require('../utils/logger.util');

const DATABASE_CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EHOSTUNREACH',
]);

function isDatabaseConnectionError(error) {
  if (!error) {
    return false;
  }

  const code = String(error.code || '').toUpperCase();

  if (DATABASE_CONNECTION_ERROR_CODES.has(code)) {
    return true;
  }

  if (error instanceof AggregateError) {
    return error.errors.some((innerError) => isDatabaseConnectionError(innerError));
  }

  return false;
}

function notFoundHandler(req, res, _next) {
  res.status(404).json({
    ok: false,
    message: `Ruta no encontrada: ${req.originalUrl}`,
    requestId: req.requestId || null,
  });
}

function errorHandler(error, req, res, _next) {
  logger.error('request_failed', {
    requestId: req.requestId || null,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id || null,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
  });

  if (error?.type === 'entity.too.large' || error?.status === 413) {
    return res.status(413).json({
      ok: false,
      message: 'La solicitud es demasiado grande. Reduce el tamano de la imagen.',
      requestId: req.requestId || null,
    });
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      ok: false,
      message: 'El cuerpo de la solicitud no contiene JSON valido',
      requestId: req.requestId || null,
    });
  }

  if (isDatabaseConnectionError(error)) {
    return res.status(503).json({
      ok: false,
      message: 'Base de datos no disponible. Verifica que PostgreSQL este iniciado.',
      requestId: req.requestId || null,
    });
  }

  res.status(500).json({
    ok: false,
    message: 'Error interno del servidor',
    requestId: req.requestId || null,
  });
}

module.exports = {
  isDatabaseConnectionError,
  notFoundHandler,
  errorHandler,
};
