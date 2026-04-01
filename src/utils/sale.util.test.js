const test = require('node:test');
const assert = require('node:assert/strict');

const { distributeAmountAcrossItems, groupSaleItemsByProduct } = require('./sale.util');

test('groupSaleItemsByProduct acumula cantidades del mismo producto', () => {
  const grouped = groupSaleItemsByProduct([
    { productoId: 10, cantidad: 2 },
    { productoId: 10, cantidad: 3 },
    { productoId: 11, cantidad: 1 },
  ]);

  assert.deepEqual(grouped, [
    { productoId: 10, cantidadTotal: 5 },
    { productoId: 11, cantidadTotal: 1 },
  ]);
});

test('distributeAmountAcrossItems conserva el total distribuido', () => {
  const distributed = distributeAmountAcrossItems(10, [30, 30, 40]);
  const total = distributed.reduce((accumulator, value) => accumulator + value, 0);

  assert.equal(total, 10);
});
