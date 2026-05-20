const { FRONTEND_URLS } = require('../config/env');
const { getAuthTokenFromCookies } = require('../utils/cookie.util');

const allowedOrigins = new Set(
  FRONTEND_URLS.map((url) => {
    try {
      return new URL(url).origin;
    } catch {
      return null;
    }
  }).filter(Boolean),
);

function isMutatingMethod(method) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method || '').toUpperCase());
}

function extractOriginFromReferer(referer) {
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function validateTrustedOriginForCookieAuth(req, res, next) {
  if (!isMutatingMethod(req.method)) {
    return next();
  }

  const authToken = getAuthTokenFromCookies(req.headers.cookie);

  if (!authToken) {
    return next();
  }

  const requestOrigin = req.headers.origin || extractOriginFromReferer(req.headers.referer);

  if (requestOrigin && allowedOrigins.has(requestOrigin)) {
    return next();
  }

  return res.status(403).json({
    ok: false,
    message: 'Origen no permitido para esta operacion autenticada',
    requestId: req.requestId || null,
  });
}

module.exports = {
  extractOriginFromReferer,
  isMutatingMethod,
  validateTrustedOriginForCookieAuth,
};
