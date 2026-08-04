const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateAdjustedPrice,
  roundToNearest100,
} = require('./price-adjustment.util');

test('roundToNearest100 redondea al multiplo de 100 mas cercano', () => {
  assert.equal(roundToNearest100(3349), 3300);
  assert.equal(roundToNearest100(3350), 3400);
  assert.equal(roundToNearest100(3351), 3400);
  assert.equal(roundToNearest100(3449), 3400);
  assert.equal(roundToNearest100(3450), 3500);
  assert.equal(roundToNearest100(4983.62), 5000);
});

test('calculateAdjustedPrice aplica aumentos positivos y redondea a centenas', () => {
  assert.equal(calculateAdjustedPrice(4838.47, 3), 5000);
});

test('calculateAdjustedPrice aplica descuentos negativos y redondea a centenas', () => {
  assert.equal(calculateAdjustedPrice(3500, -5), 3300);
});

test('calculateAdjustedPrice redondea porcentajes 0 a centenas usando Math.round', () => {
  assert.equal(calculateAdjustedPrice(3450, 0), 3500);
  assert.equal(calculateAdjustedPrice(3449, 0), 3400);
  assert.equal(calculateAdjustedPrice(3350, 0), 3400);
  assert.equal(calculateAdjustedPrice(3349, 0), 3300);
  assert.equal(calculateAdjustedPrice(3250, 0), 3300);
});

test('calculateAdjustedPrice redondea precios menores a 100 y precios decimales', () => {
  assert.equal(calculateAdjustedPrice(49, 0), 0);
  assert.equal(calculateAdjustedPrice(50, 0), 100);
  assert.equal(calculateAdjustedPrice(100.25, 10), 100);
});
