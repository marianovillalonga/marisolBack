const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateAdjustedPrice,
  roundToNearest50,
} = require('./price-adjustment.util');

test('roundToNearest50 redondea al multiplo de 50 mas cercano', () => {
  assert.equal(roundToNearest50(3331), 3350);
  assert.equal(roundToNearest50(3324), 3300);
  assert.equal(roundToNearest50(4983.62), 5000);
  assert.equal(roundToNearest50(4974), 4950);
  assert.equal(roundToNearest50(4975), 5000);
});

test('calculateAdjustedPrice aplica aumentos positivos y redondea sin centavos', () => {
  assert.equal(calculateAdjustedPrice(4838.47, 3), 5000);
});

test('calculateAdjustedPrice aplica descuentos negativos y redondea sin centavos', () => {
  assert.equal(calculateAdjustedPrice(3500, -5), 3350);
});

test('calculateAdjustedPrice soporta precios con centavos', () => {
  assert.equal(calculateAdjustedPrice(100.25, 10), 100);
});
