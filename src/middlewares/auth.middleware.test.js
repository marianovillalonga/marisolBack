const assert = require('node:assert/strict');
const test = require('node:test');

const authMiddlewarePath = require.resolve('./auth.middleware');
const cookieUtilPath = require.resolve('../utils/cookie.util');
const tokenUtilPath = require.resolve('../utils/token.util');
const sessionModelPath = require.resolve('../models/session.model');
const userModelPath = require.resolve('../models/user.model');

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
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

function loadAuthMiddleware(overrides = {}) {
  for (const modulePath of [
    authMiddlewarePath,
    cookieUtilPath,
    tokenUtilPath,
    sessionModelPath,
    userModelPath,
  ]) {
    delete require.cache[modulePath];
  }

  require.cache[cookieUtilPath] = {
    id: cookieUtilPath,
    filename: cookieUtilPath,
    loaded: true,
    exports: overrides.cookieUtil || {
      getAuthTokenFromCookies: () => 'cookie-token',
    },
  };

  require.cache[tokenUtilPath] = {
    id: tokenUtilPath,
    filename: tokenUtilPath,
    loaded: true,
    exports: overrides.tokenUtil || {
      verifyAuthToken: () => ({
        sub: '10',
        email: 'admin@example.com',
        role: 'admin',
        jti: 'session-id',
        iat: Math.floor(Date.now() / 1000),
      }),
    },
  };

  require.cache[sessionModelPath] = {
    id: sessionModelPath,
    filename: sessionModelPath,
    loaded: true,
    exports: overrides.sessionModel || {
      isTokenRevoked: async () => false,
    },
  };

  require.cache[userModelPath] = {
    id: userModelPath,
    filename: userModelPath,
    loaded: true,
    exports: overrides.userModel || {
      findSessionUserById: async () => ({
        id: 10,
        email: 'admin@example.com',
        role: 'admin',
        passwordUpdatedAtEpochMs: 0,
      }),
    },
  };

  return require(authMiddlewarePath);
}

test('authMiddleware ignora JWT enviados por headers legacy', async () => {
  const authMiddleware = loadAuthMiddleware({
    cookieUtil: {
      getAuthTokenFromCookies: () => null,
    },
    tokenUtil: {
      verifyAuthToken: () => {
        throw new Error('No deberia validar headers legacy');
      },
    },
  });
  const req = {
    headers: {
      authorization: 'Bearer header-token',
      'x-auth-token': 'header-token',
    },
  };
  const res = createMockResponse();

  await authMiddleware(req, res, () => {
    throw new Error('No deberia autenticar sin cookie');
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'Token no enviado');
});

test('authMiddleware autentica sesiones usando cookie HttpOnly', async () => {
  const authMiddleware = loadAuthMiddleware();
  const req = {
    headers: {
      cookie: 'marisol_auth=cookie-token',
    },
  };
  const res = createMockResponse();
  let nextCalled = false;

  await authMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, {
    id: 10,
    email: 'admin@example.com',
    role: 'admin',
  });
  assert.equal(req.token, 'cookie-token');
});
