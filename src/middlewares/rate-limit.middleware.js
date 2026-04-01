const { buildMessageResponse } = require('../views/auth.view');

function createRateLimitMiddleware({
  windowMs,
  maxRequests,
  keyBuilder = (req) => req.ip || 'unknown',
  message = 'Demasiadas solicitudes. Intenta nuevamente en unos minutos.',
}) {
  const buckets = new Map();

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    const key = keyBuilder(req);
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json(buildMessageResponse(message));
    }

    bucket.count += 1;
    return next();
  };
}

const loginRateLimit = createRateLimitMiddleware({
  windowMs: 10 * 60 * 1000,
  maxRequests: 5,
  keyBuilder: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    return `${req.ip || 'unknown'}:${email || 'anonymous'}`;
  },
  message: 'Demasiados intentos de login. Espera unos minutos antes de reintentar.',
});

const apiRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 240,
});

module.exports = {
  apiRateLimit,
  createRateLimitMiddleware,
  loginRateLimit,
};
