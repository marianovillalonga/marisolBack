const { buildMessageResponse } = require('../views/auth.view');
const { hasJsonContentType, isPositiveInteger } = require('../utils/validation.util');

function requireJsonContentType(req, res, next) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && !hasJsonContentType(req)) {
    return res
      .status(415)
      .json(buildMessageResponse('El tipo de contenido debe ser application/json'));
  }

  return next();
}

function validateNumericParams(paramNames) {
  return function numericParamsMiddleware(req, res, next) {
    for (const paramName of paramNames) {
      if (!isPositiveInteger(req.params[paramName])) {
        return res
          .status(400)
          .json(buildMessageResponse(`El parametro ${paramName} no es valido`));
      }
    }

    return next();
  };
}

module.exports = {
  requireJsonContentType,
  validateNumericParams,
};
