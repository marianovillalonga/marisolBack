const test = require('node:test');
const assert = require('node:assert/strict');

const {
  distributeAmountAcrossItems,
  groupSaleItemsByProduct,
  roundCurrencyAmount,
  roundToTwo,
} = require('./sale.util');

test('groupSaleItemsByProduct acumula cantidades del mismo producto', () => {
  const grouped = groupSaleItemsByProduct([
    { productoId: 10, productoNombre: 'Remera', cantidad: 2 },
    { productoId: 10, productoNombre: 'Remera', cantidad: 3 },
    { productoId: 11, productoNombre: 'Pantalon', cantidad: 1 },
  ]);

  assert.deepEqual(grouped, [
    { productoId: 10, productoNombre: 'Remera', cantidadTotal: 5 },
    { productoId: 11, productoNombre: 'Pantalon', cantidadTotal: 1 },
  ]);
});

test('distributeAmountAcrossItems conserva el total distribuido', () => {
  const distributed = distributeAmountAcrossItems(10, [30, 30, 40]);
  const total = distributed.reduce((accumulator, value) => accumulator + value, 0);

  assert.equal(total, 10);
});

test('roundToTwo conserva importes sin redondeo a centenas', () => {
  assert.equal(roundToTwo(450), 450);
  assert.equal(roundToTwo(10800), 10800);
  assert.equal(roundToTwo(10800.456), 10800.46);
});

test('roundCurrencyAmount redondea solo al peso', () => {
  assert.equal(roundCurrencyAmount(400), 400);
  assert.equal(roundCurrencyAmount(450), 450);
  assert.equal(roundCurrencyAmount(10800), 10800);
  assert.equal(roundCurrencyAmount(10800.49), 10800);
  assert.equal(roundCurrencyAmount(10800.5), 10801);
});
