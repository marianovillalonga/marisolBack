function notFoundHandler(req, res, _next) {
  res.status(404).json({
    ok: false,
    message: `Ruta no encontrada: ${req.originalUrl}`,
  });
}

function errorHandler(error, _req, res, _next) {
  console.error(error);

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
