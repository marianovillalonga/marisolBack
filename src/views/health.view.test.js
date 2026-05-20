const test = require('node:test');
const assert = require('node:assert/strict');

const { buildHealthResponse } = require('./health.view');

test('buildHealthResponse devuelve el estado esperado', () => {
  const response = buildHealthResponse({
    ok: true,
    mode: 'readiness',
    configOk: true,
    databaseOk: true,
    mailOk: true,
    configError: null,
    databaseError: null,
    databaseLatencyMs: 12.34,
    requestId: 'req-health',
  });

  assert.equal(response.ok, true);
  assert.equal(response.message, 'Backend operativo');
  assert.equal(response.mode, 'readiness');
  assert.match(response.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof response.uptimeSeconds, 'number');
  assert.equal(response.requestId, 'req-health');
  assert.deepEqual(response.checks, {
    config: {
      status: 'ok',
      error: null,
    },
    database: {
      status: 'ok',
      latencyMs: 12.34,
      error: null,
    },
    mail: 'ok',
  });
});

test('buildHealthResponse devuelve liveness simple sin checks profundos', () => {
  const response = buildHealthResponse({
    ok: true,
    mode: 'liveness',
    mailOk: true,
  });

  assert.equal(response.message, 'Backend vivo');
  assert.deepEqual(response.checks, {
    config: 'skipped',
    database: 'skipped',
    mail: 'ok',
  });
});
