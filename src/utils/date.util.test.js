const test = require('node:test');
const assert = require('node:assert/strict');

const { addDaysToDateOnly, getDateOnlyString } = require('./date.util');

test('getDateOnlyString conserva fechas YYYY-MM-DD sin corrimientos', () => {
  assert.equal(getDateOnlyString('2026-05-20'), '2026-05-20');
  assert.equal(getDateOnlyString('2026-05-20T23:59:59.000Z'), '2026-05-20');
});

test('addDaysToDateOnly suma dias sobre una fecha estable', () => {
  assert.equal(addDaysToDateOnly('2026-05-20', 1), '2026-05-21');
  assert.equal(addDaysToDateOnly('2026-12-31', 1), '2027-01-01');
});
