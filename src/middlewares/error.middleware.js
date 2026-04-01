const logger = require('../utils/logger.util');

function notFoundHandler(req, res, _next) {
  res.status(404).json({
    ok: false,
    message: `Ruta no encontrada: ${req.originalUrl}`,
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
    });
  }

  if (error instanceof SyntaxError && 'body' in error) {
    return res.status(400).json({
      ok: false,
      message: 'El cuerpo de la solicitud no contiene JSON valido',
    });
  }

  res.status(500).json({
    ok: false,
    message: 'Error interno del servidor',
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
