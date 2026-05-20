const test = require('node:test');
const assert = require('node:assert/strict');

const userModelPath = require.resolve('../models/user.model');
const passwordResetTokenModelPath = require.resolve('../models/password-reset-token.model');
const sessionModelPath = require.resolve('../models/session.model');
const dbPath = require.resolve('../config/db');
const auditUtilPath = require.resolve('../utils/audit.util');
const cookieUtilPath = require.resolve('../utils/cookie.util');
const hashUtilPath = require.resolve('../utils/hash.util');
const mailUtilPath = require.resolve('../utils/mail.util');
const passwordResetUtilPath = require.resolve('../utils/password-reset.util');
const tokenUtilPath = require.resolve('../utils/token.util');
const validationUtilPath = require.resolve('../utils/validation.util');
const validationRulesPath = require.resolve('../config/validation-rules');
const authControllerPath = require.resolve('./auth.controller');

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    cookiesCleared: false,
    authCookie: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function clearModuleCache() {
  [
    authControllerPath,
    userModelPath,
    passwordResetTokenModelPath,
    sessionModelPath,
    dbPath,
    auditUtilPath,
    cookieUtilPath,
    hashUtilPath,
    mailUtilPath,
    passwordResetUtilPath,
    tokenUtilPath,
    validationUtilPath,
    validationRulesPath,
  ].forEach((modulePath) => {
    delete require.cache[modulePath];
  });
}

function loadAuthController(overrides = {}) {
  clearModuleCache();

  const defaultClient = {
    query: async () => ({}),
    release() {},
  };
  const defaultUserModel = {
    validateCredentials: async () => null,
    findByEmail: async () => null,
    updatePasswordByUserId: async () => true,
  };
  const defaultPasswordResetTokenModel = {
    findValidTokenByHash: async () => null,
    findValidTokenByHashForUpdate: async () => null,
    invalidateActiveTokensForUser: async () => {},
    createToken: async () => ({ id: 1 }),
    markTokenUsed: async () => {},
  };

  require.cache[userModelPath] = {
    id: userModelPath,
    filename: userModelPath,
    loaded: true,
    exports: overrides.userModel || defaultUserModel,
  };
  require.cache[passwordResetTokenModelPath] = {
    id: passwordResetTokenModelPath,
    filename: passwordResetTokenModelPath,
    loaded: true,
    exports: overrides.passwordResetTokenModel || defaultPasswordResetTokenModel,
  };
  require.cache[sessionModelPath] = {
    id: sessionModelPath,
    filename: sessionModelPath,
    loaded: true,
    exports: overrides.sessionModel || {
      revokeToken: async () => {},
    },
  };
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: overrides.db || {
      connect: async () => defaultClient,
    },
  };
  require.cache[auditUtilPath] = {
    id: auditUtilPath,
    filename: auditUtilPath,
    loaded: true,
    exports: overrides.auditUtil || {
      registerAudit: async () => {},
    },
  };
  require.cache[cookieUtilPath] = {
    id: cookieUtilPath,
    filename: cookieUtilPath,
    loaded: true,
    exports: overrides.cookieUtil || {
      clearAuthCookie: (res) => {
        res.cookiesCleared = true;
      },
      setAuthCookie: (res, token) => {
        res.authCookie = token;
      },
    },
  };
  require.cache[hashUtilPath] = {
    id: hashUtilPath,
    filename: hashUtilPath,
    loaded: true,
    exports: overrides.hashUtil || {
      hashPassword: async () => 'bcrypt-hash',
    },
  };
  require.cache[mailUtilPath] = {
    id: mailUtilPath,
    filename: mailUtilPath,
    loaded: true,
    exports: overrides.mailUtil || {
      MailDeliveryError: class MailDeliveryError extends Error {},
      sendPasswordResetEmail: async () => ({ deliveryMode: 'file' }),
    },
  };
  require.cache[passwordResetUtilPath] = {
    id: passwordResetUtilPath,
    filename: passwordResetUtilPath,
    loaded: true,
    exports: overrides.passwordResetUtil || {
      buildPasswordResetUrl: () => 'https://example.com/reset?token=test-token',
      generatePasswordResetToken: () => 'test-token',
      getPasswordResetExpirationDate: () => new Date('2026-05-20T00:30:00.000Z'),
      hashPasswordResetToken: (token) => `hash:${token}`,
      maskEmail: (email) => email,
    },
  };
  require.cache[tokenUtilPath] = {
    id: tokenUtilPath,
    filename: tokenUtilPath,
    loaded: true,
    exports: overrides.tokenUtil || {
      createAuthToken: () => 'signed-token',
    },
  };
  require.cache[validationUtilPath] = {
    id: validationUtilPath,
    filename: validationUtilPath,
    loaded: true,
    exports: overrides.validationUtil || {
      isValidEmail: (email) => email.includes('@'),
    },
  };
  require.cache[validationRulesPath] = {
    id: validationRulesPath,
    filename: validationRulesPath,
    loaded: true,
    exports: overrides.validationRules || {
      auth: {
        passwordMinLength: 8,
      },
    },
  };

  return require('./auth.controller');
}

test('login bloquea usuarios legacy que requieren reset de password', async () => {
  const controller = loadAuthController({
    userModel: {
      validateCredentials: async () => ({
        error: 'PASSWORD_RESET_REQUIRED',
        user: { id: 10, email: 'legacy@example.com' },
      }),
    },
  });
  const req = {
    body: {
      email: 'legacy@example.com',
      password: 'secret',
    },
  };
  const res = createMockResponse();

  await controller.login(req, res, () => {});

  assert.equal(res.statusCode, 403);
  assert.match(res.body.message, /restablecer la password/i);
});

test('requestPasswordReset no enumera usuarios inexistentes', async () => {
  const controller = loadAuthController();
  const req = {
    body: {
      email: 'missing@example.com',
    },
  };
  const res = createMockResponse();

  await controller.requestPasswordReset(req, res, () => {});

  assert.equal(res.statusCode, 202);
  assert.equal(
    res.body.message,
    'Si el email existe, enviaremos instrucciones para restablecer el acceso.',
  );
});

test('validatePasswordResetToken rechaza token invalido o expirado', async () => {
  const controller = loadAuthController();
  const req = {
    params: {
      token: 'invalid-token',
    },
  };
  const res = createMockResponse();

  await controller.validatePasswordResetToken(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Token invalido o vencido');
});

test('resetPasswordWithToken rechaza token invalido o expirado', async () => {
  const controller = loadAuthController();
  const req = {
    body: {
      token: 'invalid-token',
      newPassword: 'Password123',
      confirmPassword: 'Password123',
    },
  };
  const res = createMockResponse();

  await controller.resetPasswordWithToken(req, res, () => {});

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'Token invalido o vencido');
});

test('resetPasswordWithToken invalida el token usado y rechaza su reutilizacion', async () => {
  let tokenAlreadyUsed = false;
  const controller = loadAuthController({
    passwordResetTokenModel: {
      findValidTokenByHashForUpdate: async () =>
        tokenAlreadyUsed
          ? null
          : {
              id: 4,
              usuario_id: 9,
            },
      invalidateActiveTokensForUser: async () => {},
      markTokenUsed: async () => {
        tokenAlreadyUsed = true;
      },
    },
  });

  const firstReq = {
    body: {
      token: 'valid-token',
      newPassword: 'Password123',
      confirmPassword: 'Password123',
    },
  };
  const firstRes = createMockResponse();
  await controller.resetPasswordWithToken(firstReq, firstRes, () => {});

  const secondReq = {
    body: {
      token: 'valid-token',
      newPassword: 'Password123',
      confirmPassword: 'Password123',
    },
  };
  const secondRes = createMockResponse();
  await controller.resetPasswordWithToken(secondReq, secondRes, () => {});

  assert.equal(firstRes.statusCode, 200);
  assert.equal(secondRes.statusCode, 400);
  assert.equal(secondRes.body.message, 'Token invalido o vencido');
});
