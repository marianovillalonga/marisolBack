const test = require('node:test');
const assert = require('node:assert/strict');

const { buildHealthResponse } = require('./health.view');

test('buildHealthResponse devuelve el estado esperado', () => {
  const response = buildHealthResponse();

  assert.equal(response.ok, true);
  assert.equal(response.message, 'Backend operativo');
  assert.match(response.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof response.uptimeSeconds, 'number');
});
