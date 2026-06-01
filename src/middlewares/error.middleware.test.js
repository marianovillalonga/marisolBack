const test = require('node:test');
const assert = require('node:assert/strict');

const {
  errorHandler,
  isDatabaseConnectionError,
} = require('./error.middleware');

function createMockRequest() {
  return {
    requestId: 'test-request-id',
    method: 'POST',
    originalUrl: '/api/auth/login',
    ip: '127.0.0.1',
    user: null,
  };
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

test('isDatabaseConnectionError detecta ECONNREFUSED directo', () => {
  const error = new Error('connect ECONNREFUSED 127.0.0.1:5432');
  error.code = 'ECONNREFUSED';

  assert.equal(isDatabaseConnectionError(error), true);
});

test('isDatabaseConnectionError detecta ECONNREFUSED dentro de AggregateError', () => {
  const innerError = new Error('connect ECONNREFUSED 127.0.0.1:5432');
  innerError.code = 'ECONNREFUSED';

  assert.equal(isDatabaseConnectionError(new AggregateError([innerError])), true);
});

test('errorHandler responde 503 cuando la base no esta disponible', () => {
  const error = new Error('connect ECONNREFUSED 127.0.0.1:5432');
  error.code = 'ECONNREFUSED';
  const res = createMockResponse();

  errorHandler(error, createMockRequest(), res, () => {});

  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, {
    ok: false,
    message: 'Base de datos no disponible. Verifica que PostgreSQL este iniciado.',
    requestId: 'test-request-id',
  });
});
