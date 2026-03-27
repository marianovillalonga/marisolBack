function notFoundHandler(req, res, _next) {
  res.status(404).json({
    ok: false,
    message: `Ruta no encontrada: ${req.originalUrl}`,
  });
}

function errorHandler(error, _req, res, _next) {
  console.error(error);

  res.status(500).json({
    ok: false,
    message: 'Error interno del servidor',
  });
}

module.exports = {
  notFoundHandler,
  errorHandler,
};
