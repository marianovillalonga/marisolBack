const { verifyAuthToken } = require('../utils/token.util');
const { getAuthTokenFromCookies } = require('../utils/cookie.util');
const { buildMessageResponse } = require('../views/auth.view');
const sessionModel = require('../models/session.model');
const userModel = require('../models/user.model');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const cookieToken = getAuthTokenFromCookies(req.headers.cookie);
  const token =
    authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : cookieToken;

  if (!token) {
    return res.status(401).json(buildMessageResponse('Token no enviado'));
  }

  try {
    const payload = verifyAuthToken(token);
    const revoked = await sessionModel.isTokenRevoked(payload.jti);
    const currentUser = await userModel.findPublicById(Number(payload.sub));

    if (revoked || !currentUser) {
      return res.status(401).json(buildMessageResponse('Token invalido o vencido'));
    }

    req.user = {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    };
    req.token = token;
    req.tokenPayload = payload;

    return next();
  } catch (_error) {
    return res.status(401).json(buildMessageResponse('Token invalido o vencido'));
  }
}

module.exports = authMiddleware;
