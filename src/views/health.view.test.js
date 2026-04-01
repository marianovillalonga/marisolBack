const test = require('node:test');
const assert = require('node:assert/strict');

const { buildHealthResponse } = require('./health.view');

test('buildHealthResponse devuelve el estado esperado', () => {
  assert.deepEqual(buildHealthResponse(), {
    ok: true,
    message: 'Backend operativo',
  });
});
