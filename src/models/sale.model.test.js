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

test('calculateSaleTotals conserva producto de 3500 sin descuentos ni ajustes activos', () => {
  const totals = saleModel.calculateSaleTotals({
    descuento: 0,
    montoPagado: 3500,
    pagos: [{ metodo: 'debito', monto: 3500 }],
    itemSnapshots: [
      {
        productoId: 1,
        productoNombre: 'Producto actualizado',
        cantidad: 1,
        precioUnitario: 3500,
        subtotal: 3500,
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
  assert.equal(totals.subtotal, 3500);
  assert.equal(totals.ajusteMetodoPago, 0);
  assert.equal(totals.ajusteMetodoPagoTipo, null);
  assert.equal(totals.ajusteMetodoPagoPorcentaje, 0);
  assert.equal(totals.total, 3500);
  assert.equal(totals.deudaPendiente, 0);
});

test('calculateSaleTotals aplica descuento por metodo de pago sin redondear al peso', () => {
  const totals = saleModel.calculateSaleTotals({
    descuento: 0,
    montoPagado: 3498.95,
    pagos: [{ metodo: 'debito', monto: 3498.95 }],
    itemSnapshots: [
      {
        productoId: null,
        productoNombre: 'Producto manual',
        cantidad: 1,
        precioUnitario: 3500,
        subtotal: 3500,
      },
    ],
    seller: {
      configuracion_metodos_pago: {
        debito: {
          tipo: 'descuento',
          porcentaje: 0.03,
        },
      },
    },
  });

  assert.equal(totals.error, undefined);
  assert.equal(totals.subtotal, 3500);
  assert.equal(totals.ajusteMetodoPago, -1.05);
  assert.equal(totals.ajusteMetodoPagoTipo, 'descuento');
  assert.equal(totals.ajusteMetodoPagoPorcentaje, 0.03);
  assert.equal(totals.total, 3498.95);
});

test('calculateSaleTotals aplica recargo por metodo de pago sin redondear al peso', () => {
  const totals = saleModel.calculateSaleTotals({
    descuento: 0,
    montoPagado: 3780,
    pagos: [{ metodo: 'credito', monto: 3780 }],
    itemSnapshots: [
      {
        productoId: null,
        productoNombre: 'Producto manual',
        cantidad: 1,
        precioUnitario: 3500,
        subtotal: 3500,
      },
    ],
    seller: {
      configuracion_metodos_pago: {
        credito: {
          tipo: 'aumento',
          porcentaje: 8,
        },
      },
    },
  });

  assert.equal(totals.error, undefined);
  assert.equal(totals.subtotal, 3500);
  assert.equal(totals.ajusteMetodoPago, 280);
  assert.equal(totals.ajusteMetodoPagoTipo, 'aumento');
  assert.equal(totals.ajusteMetodoPagoPorcentaje, 8);
  assert.equal(totals.total, 3780);
});
