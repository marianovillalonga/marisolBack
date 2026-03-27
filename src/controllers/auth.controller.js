const userModel = require('../models/user.model');
const sessionModel = require('../models/session.model');
const { createAuthToken } = require('../utils/token.util');
const {
  buildCurrentUserResponse,
  buildLoginSuccessResponse,
  buildLogoutResponse,
  buildMessageResponse,
} = require('../views/auth.view');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(buildMessageResponse('Email y password son obligatorios'));
    }

    const user = await userModel.validateCredentials(email, password);

    if (!user) {
      return res.status(401).json(buildMessageResponse('Credenciales invalidas'));
    }

    const token = createAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return res.status(200).json(buildLoginSuccessResponse(user, token));
  } catch (error) {
    next(error);
  }
}

async function me(req, res, next) {
  try {
    const user = await userModel.findPublicById(req.user.id);

    if (!user) {
      return res.status(404).json(buildMessageResponse('Usuario no encontrado'));
    }

    return res.status(200).json(buildCurrentUserResponse(user));
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    if (!req.tokenPayload?.jti || !req.tokenPayload?.exp) {
      return res.status(400).json(buildMessageResponse('Token invalido o vencido'));
    }

    await sessionModel.revokeToken({
      jti: req.tokenPayload.jti,
      userId: req.user.id,
      expiresAt: new Date(req.tokenPayload.exp * 1000),
    });

    return res.status(200).json(buildLogoutResponse());
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  me,
  logout,
};
