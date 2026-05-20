const test = require('node:test');
const assert = require('node:assert/strict');

function loadCsrfModule() {
  delete require.cache[require.resolve('../config/env')];
  delete require.cache[require.resolve('./csrf.middleware')];
  return require('./csrf.middleware');
}

function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, snapshot);
}

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

test('validateTrustedOriginForCookieAuth permite POST autenticado desde origin confiable', () => {
  const snapshot = { ...process.env };

  process.env.FRONTEND_URLS = 'https://app.marisol.com';
  process.env.AUTH_COOKIE_NAME = 'marisol_auth';

  const { validateTrustedOriginForCookieAuth } = loadCsrfModule();
  const req = {
    method: 'POST',
    headers: {
      cookie: 'marisol_auth=token-valido',
      origin: 'https://app.marisol.com',
    },
    requestId: 'req-1',
  };
  const res = createMockResponse();
  let calledNext = false;

  validateTrustedOriginForCookieAuth(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, true);
  assert.equal(res.statusCode, 200);
  restoreEnv(snapshot);
});

test('validateTrustedOriginForCookieAuth bloquea POST autenticado desde origin no confiable', () => {
  const snapshot = { ...process.env };

  process.env.FRONTEND_URLS = 'https://app.marisol.com';
  process.env.AUTH_COOKIE_NAME = 'marisol_auth';

  const { validateTrustedOriginForCookieAuth } = loadCsrfModule();
  const req = {
    method: 'POST',
    headers: {
      cookie: 'marisol_auth=token-valido',
      origin: 'https://evil.example.com',
    },
    requestId: 'req-2',
  };
  const res = createMockResponse();
  let calledNext = false;

  validateTrustedOriginForCookieAuth(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, 'Origen no permitido para esta operacion autenticada');
  restoreEnv(snapshot);
});

test('validateTrustedOriginForCookieAuth permite mutaciones sin cookie de sesion', () => {
  const snapshot = { ...process.env };

  process.env.FRONTEND_URLS = 'https://app.marisol.com';
  process.env.AUTH_COOKIE_NAME = 'marisol_auth';

  const { validateTrustedOriginForCookieAuth } = loadCsrfModule();
  const req = {
    method: 'POST',
    headers: {},
    requestId: 'req-3',
  };
  const res = createMockResponse();
  let calledNext = false;

  validateTrustedOriginForCookieAuth(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, true);
  assert.equal(res.statusCode, 200);
  restoreEnv(snapshot);
});

test('validateTrustedOriginForCookieAuth usa referer si origin no esta presente', () => {
  const snapshot = { ...process.env };

  process.env.FRONTEND_URLS = 'https://app.marisol.com';
  process.env.AUTH_COOKIE_NAME = 'marisol_auth';

  const { validateTrustedOriginForCookieAuth } = loadCsrfModule();
  const req = {
    method: 'DELETE',
    headers: {
      cookie: 'marisol_auth=token-valido',
      referer: 'https://app.marisol.com/ventas/1',
    },
    requestId: 'req-4',
  };
  const res = createMockResponse();
  let calledNext = false;

  validateTrustedOriginForCookieAuth(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, true);
  assert.equal(res.statusCode, 200);
  restoreEnv(snapshot);
});
