const test = require('node:test');
const assert = require('node:assert/strict');

const { createRateLimitMiddleware } = require('./rate-limit.middleware');

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
