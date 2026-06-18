const test = require('node:test');
const assert = require('node:assert/strict');

const saleModel = require('./sale.model');

test('calculateSaleTotals conserva una venta manual de 7000 sin ajuste de pago', () => {
  const totals = saleModel.calculateSaleTotals({
    descuento: 0,
    montoPagado: 7000,
    pagos: [{ metodo: 'debito', monto: 7000 }],
    itemSnapshots: [
      {
        productoId: null,
        productoNombre: 'Producto manual',
        cantidad: 1,
        precioUnitario: 7000,
        subtotal: 7000,
      },
    ],
    seller: {
      configuracion_metodos_pago: {
        debito: {
          tipo: 'descuento',
          porcentaje: 0,
        },
      },
    },
  });

  assert.equal(totals.error, undefined);
  assert.equal(totals.subtotal, 7000);
  assert.equal(totals.ajusteMetodoPago, 0);
  assert.equal(totals.total, 7000);
});
