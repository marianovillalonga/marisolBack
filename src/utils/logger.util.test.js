const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRequestLogMeta, sanitizeMeta, sanitizeUrlForLogging } = require('./logger.util');

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

test('buildRequestLogMeta incluye contexto operativo sin filtrar secretos', () => {
  const meta = buildRequestLogMeta(
    {
      requestId: 'req-123',
      method: 'POST',
      originalUrl: '/api/orders',
      ip: '127.0.0.1',
      headers: {
        cookie: 'auth=abc',
        'user-agent': 'Playwright',
        referer: 'http://localhost:3000/pedidos',
      },
      user: {
        id: 42,
      },
    },
    {
      statusCode: 201,
    },
    123.45,
  );

  assert.deepEqual(meta, {
    requestId: 'req-123',
    method: 'POST',
    path: '/api/orders',
    statusCode: 201,
    durationMs: 123.45,
    ip: '127.0.0.1',
    userId: 42,
    authPresent: true,
    userAgent: 'Playwright',
    referer: 'http://localhost:3000/pedidos',
  });
});

test('buildRequestLogMeta no trata headers legacy como sesion activa', () => {
  const meta = buildRequestLogMeta(
    {
      requestId: 'req-456',
      method: 'GET',
      originalUrl: '/api/clients',
      ip: '127.0.0.1',
      headers: {
        authorization: 'Bearer token',
        'user-agent': 'Browser',
      },
    },
    {
      statusCode: 200,
    },
    12.3,
  );

  assert.equal(meta.authPresent, false);
});

test('sanitizeUrlForLogging redacta tokens de recuperacion en path y query string', () => {
  assert.equal(
    sanitizeUrlForLogging('/api/auth/password-reset/token-real-secreto'),
    '/api/auth/password-reset/[REDACTED]',
  );
  assert.equal(
    sanitizeUrlForLogging('https://app.example.com/reset-password?token=token-real-secreto'),
    'https://app.example.com/reset-password?token=%5BREDACTED%5D',
  );
});

test('buildRequestLogMeta redacta tokens en path y referer', () => {
  const meta = buildRequestLogMeta(
    {
      requestId: 'req-reset',
      method: 'GET',
      originalUrl: '/api/auth/password-reset/token-real-secreto',
      ip: '127.0.0.1',
      headers: {
        referer: 'https://app.example.com/reset-password?token=token-real-secreto',
      },
    },
    {
      statusCode: 404,
    },
    10,
  );

  assert.equal(meta.path, '/api/auth/password-reset/[REDACTED]');
  assert.equal(meta.referer, 'https://app.example.com/reset-password?token=%5BREDACTED%5D');
});
