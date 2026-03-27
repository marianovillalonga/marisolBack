const { verifyAuthToken } = require('../utils/token.util');
const { buildMessageResponse } = require('../views/auth.view');
const sessionModel = require('../models/session.model');
const userModel = require('../models/user.model');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json(buildMessageResponse('Token no enviado'));
  }

  const token = authHeader.split(' ')[1];

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
