const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createRateLimitMiddleware,
  loginRateLimit,
  passwordResetAttemptRateLimit,
  passwordResetRequestRateLimit,
} = require('./rate-limit.middleware');

function createMockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
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

test('createRateLimitMiddleware bloquea cuando supera el maximo', () => {
  const middleware = createRateLimitMiddleware({
    windowMs: 60_000,
    maxRequests: 2,
    message: 'Limite alcanzado',
  });
  const req = { ip: '127.0.0.1' };
  const nextCalls = [];

  middleware(req, createMockResponse(), () => nextCalls.push('first'));
  middleware(req, createMockResponse(), () => nextCalls.push('second'));

  const res = createMockResponse();
  middleware(req, res, () => nextCalls.push('third'));

  assert.deepEqual(nextCalls, ['first', 'second']);
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.message, 'Limite alcanzado');
  assert.equal(typeof res.headers['Retry-After'], 'string');
});

test('loginRateLimit aplica limite por ip y email', () => {
  const req = {
    ip: '127.0.0.1',
    body: {
      email: 'user@example.com',
    },
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    loginRateLimit(req, createMockResponse(), () => {});
  }

  const res = createMockResponse();
  loginRateLimit(req, res, () => {});

  assert.equal(res.statusCode, 429);
  assert.equal(res.body.message, 'Demasiados intentos de login. Espera unos minutos antes de reintentar.');
});

test('passwordResetRequestRateLimit aplica limite por ip y email', () => {
  const req = {
    ip: '127.0.0.2',
    body: {
      email: 'reset@example.com',
    },
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    passwordResetRequestRateLimit(req, createMockResponse(), () => {});
  }

  const res = createMockResponse();
  passwordResetRequestRateLimit(req, res, () => {});

  assert.equal(res.statusCode, 429);
  assert.equal(
    res.body.message,
    'Demasiadas solicitudes de recuperacion. Espera unos minutos antes de reintentar.',
  );
});

test('passwordResetAttemptRateLimit aplica limite por ip y token', () => {
  const req = {
    ip: '127.0.0.3',
    body: {
      token: 'TOKEN-ABC-123',
    },
    params: {},
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    passwordResetAttemptRateLimit(req, createMockResponse(), () => {});
  }

  const res = createMockResponse();
  passwordResetAttemptRateLimit(req, res, () => {});

  assert.equal(res.statusCode, 429);
  assert.equal(
    res.body.message,
    'Demasiados intentos de restablecimiento. Espera unos minutos antes de reintentar.',
  );
});
