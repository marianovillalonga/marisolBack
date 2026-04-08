const test = require('node:test');
const assert = require('node:assert/strict');

const {
  requireJsonContentType,
  validateNumericParams,
} = require('./request-validation.middleware');

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

test('requireJsonContentType rechaza POST sin content-type json', () => {
  const req = {
    method: 'POST',
    headers: {
      'content-length': '10',
    },
    is(pattern) {
      return pattern === 'application/json' ? false : null;
    },
  };
  const res = createMockResponse();
  let calledNext = false;

  requireJsonContentType(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 415);
  assert.equal(res.body.message, 'El tipo de contenido debe ser application/json');
});

test('validateNumericParams rechaza ids invalidos', () => {
  const middleware = validateNumericParams(['id', 'purchaseId']);
  const req = {
    params: {
      id: '4',
      purchaseId: 'abc',
    },
  };
  const res = createMockResponse();
  let calledNext = false;

  middleware(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, 'El parametro purchaseId no es valido');
});
