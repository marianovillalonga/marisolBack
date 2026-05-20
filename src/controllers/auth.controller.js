const userModel = require('../models/user.model');
const passwordResetTokenModel = require('../models/password-reset-token.model');
const sessionModel = require('../models/session.model');
const pool = require('../config/db');
const { registerAudit } = require('../utils/audit.util');
const { clearAuthCookie, setAuthCookie } = require('../utils/cookie.util');
const { hashPassword } = require('../utils/hash.util');
const { MailDeliveryError, sendPasswordResetEmail } = require('../utils/mail.util');
const {
  buildPasswordResetUrl,
  generatePasswordResetToken,
  getPasswordResetExpirationDate,
  hashPasswordResetToken,
  maskEmail,
} = require('../utils/password-reset.util');
const { createAuthToken } = require('../utils/token.util');
const {
  buildCurrentUserResponse,
  buildLoginSuccessResponse,
  buildLogoutResponse,
  buildMessageResponse,
  buildPasswordResetRequestedResponse,
  buildPasswordResetSuccessResponse,
  buildPasswordResetTokenValidResponse,
} = require('../views/auth.view');
const { isValidEmail } = require('../utils/validation.util');
const validationRules = require('../config/validation-rules');

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(buildMessageResponse('Email y password son obligatorios'));
    }

    if (!isValidEmail(email)) {
      return res.status(400).json(buildMessageResponse('El email no es valido'));
    }

    const authResult = await userModel.validateCredentials(email, password);

    if (!authResult) {
      return res.status(401).json(buildMessageResponse('Credenciales invalidas'));
    }

    if (authResult.error === 'PASSWORD_RESET_REQUIRED') {
      await registerAudit(req, {
        action: 'legacy_password_login_blocked',
        entity: 'auth',
        entityId: authResult.user?.id || null,
        details: {
          email,
        },
      });

      return res.status(403).json(
        buildMessageResponse(
          'Tu cuenta requiere restablecer la password antes de iniciar sesion. Usa "Olvide mi password".',
        ),
      );
    }

    const user = authResult.user;

    const token = createAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    setAuthCookie(res, token);

    await registerAudit(req, {
      action: 'login',
      entity: 'auth',
      entityId: user.id,
      details: {
        email: user.email,
        role: user.role,
      },
    });

    return res.status(200).json(buildLoginSuccessResponse(user));
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
      clearAuthCookie(res);
      return res.status(400).json(buildMessageResponse('Token invalido o vencido'));
    }

    await sessionModel.revokeToken({
      jti: req.tokenPayload.jti,
      userId: req.user.id,
      expiresAt: new Date(req.tokenPayload.exp * 1000),
    });

    await registerAudit(req, {
      action: 'logout',
      entity: 'auth',
      entityId: req.user.id,
      details: {
        email: req.user.email,
      },
    });

    clearAuthCookie(res);
    return res.status(200).json(buildLogoutResponse());
  } catch (error) {
    next(error);
  }
}

function isValidPassword(password) {
  return typeof password === 'string' && password.length >= validationRules.auth.passwordMinLength;
}

async function requestPasswordReset(req, res, next) {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return res.status(400).json(buildMessageResponse('Ingresa un email valido'));
    }

    const user = await userModel.findByEmail(email);

    if (!user || !user.activo) {
      await registerAudit(req, {
        action: 'password_reset_requested',
        entity: 'auth',
        details: {
          email: maskEmail(email),
          userFound: false,
        },
      });
      return res.status(202).json(buildPasswordResetRequestedResponse());
    }

    const resetToken = generatePasswordResetToken();
    const tokenHash = hashPasswordResetToken(resetToken);
    const expiresAt = getPasswordResetExpirationDate();
    const resetUrl = buildPasswordResetUrl(resetToken);

    try {
      await passwordResetTokenModel.invalidateActiveTokensForUser(user.id);
      await passwordResetTokenModel.createToken({
        userId: user.id,
        tokenHash,
        expiresAt,
        ip: req.ip,
        requestId: req.requestId || null,
      });

      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        expiresAt,
        requestId: req.requestId || null,
      });
    } catch (error) {
      if (error instanceof MailDeliveryError) {
        await registerAudit(req, {
          action: 'password_reset_delivery_failed',
          entity: 'auth',
          entityId: user.id,
          details: {
            email: maskEmail(user.email),
            code: error.code,
          },
        });

        return res.status(503).json(buildMessageResponse(error.message));
      }

      throw error;
    }

    await registerAudit(req, {
      action: 'password_reset_requested',
      entity: 'auth',
      entityId: user.id,
      details: {
        email: maskEmail(user.email),
        userFound: true,
      },
    });

    return res.status(202).json(buildPasswordResetRequestedResponse());
  } catch (error) {
    next(error);
  }
}

async function validatePasswordResetToken(req, res, next) {
  try {
    const token = String(req.params?.token || '').trim();

    if (!token) {
      return res.status(400).json(buildMessageResponse('Token invalido o vencido'));
    }

    const tokenHash = hashPasswordResetToken(token);
    const resetToken = await passwordResetTokenModel.findValidTokenByHash(tokenHash);

    if (!resetToken) {
      await registerAudit(req, {
        action: 'password_reset_token_invalid',
        entity: 'auth',
        details: {
          reason: 'not_found_or_expired',
        },
      });

      return res.status(400).json(buildMessageResponse('Token invalido o vencido'));
    }

    return res.status(200).json(buildPasswordResetTokenValidResponse());
  } catch (error) {
    next(error);
  }
}

async function resetPasswordWithToken(req, res, next) {
  const client = await pool.connect();

  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    const confirmPassword = String(req.body?.confirmPassword || '');

    if (!token || !newPassword || !confirmPassword) {
      return res.status(400).json(buildMessageResponse('Todos los campos son obligatorios'));
    }

    if (!isValidPassword(newPassword)) {
      return res
        .status(400)
        .json(
          buildMessageResponse(
            `La nueva password debe tener al menos ${validationRules.auth.passwordMinLength} caracteres`,
          ),
        );
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json(buildMessageResponse('La confirmacion no coincide con la nueva password'));
    }

    const tokenHash = hashPasswordResetToken(token);

    await client.query('BEGIN');
    const resetToken = await passwordResetTokenModel.findValidTokenByHashForUpdate(tokenHash, client);

    if (!resetToken) {
      await client.query('ROLLBACK');

      await registerAudit(req, {
        action: 'password_reset_failed',
        entity: 'auth',
        details: {
          reason: 'invalid_or_expired_token',
        },
      });

      return res.status(400).json(buildMessageResponse('Token invalido o vencido'));
    }

    const newPasswordHash = await hashPassword(newPassword);
    const updated = await userModel.updatePasswordByUserId(
      {
        userId: resetToken.usuario_id,
        passwordHash: newPasswordHash,
      },
      client,
    );

    if (!updated) {
      await client.query('ROLLBACK');
      return res.status(404).json(buildMessageResponse('Usuario no encontrado'));
    }

    await passwordResetTokenModel.markTokenUsed(resetToken.id, client);
    await passwordResetTokenModel.invalidateActiveTokensForUser(resetToken.usuario_id, client);
    await client.query('COMMIT');

    await registerAudit(req, {
      action: 'password_reset_completed',
      entity: 'auth',
      entityId: resetToken.usuario_id,
      details: {
        method: 'token',
      },
    });

    return res.status(200).json(buildPasswordResetSuccessResponse());
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
}

module.exports = {
  login,
  me,
  logout,
  requestPasswordReset,
  resetPasswordWithToken,
  validatePasswordResetToken,
};
