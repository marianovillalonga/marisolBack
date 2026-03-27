const { buildMessageResponse } = require('../views/auth.view');

function roleMiddleware(allowedRoles) {
  return function checkRole(req, res, next) {
    if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json(buildMessageResponse('No tenes permisos para realizar esta accion'));
    }

    return next();
  };
}

module.exports = roleMiddleware;
