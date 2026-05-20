const test = require('node:test');
const assert = require('node:assert/strict');

const { sanitizeMeta } = require('./logger.util');

test('sanitizeMeta redacta credenciales y tokens en objetos anidados', () => {
  const result = sanitizeMeta({
    password: 'secret',
    nested: {
      authorization: 'Bearer token',
      resetUrl: 'https://example.com/reset?token=abc',
    },
    array: [
      {
        apiKey: 'abc123',
      },
    ],
    safe: 'visible',
  });

  assert.deepEqual(result, {
    password: '[REDACTED]',
    nested: {
      authorization: '[REDACTED]',
      resetUrl: '[REDACTED]',
    },
    array: [
      {
        apiKey: '[REDACTED]',
      },
    ],
    safe: 'visible',
  });
});
