const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateBudgetInput,
  validateOrderInput,
  validateSaleInput,
} = require('./document-validation.util');

test('validateSaleInput rechaza desajuste entre pagos y monto pagado', () => {
  const error = validateSaleInput({
    clientId: 1,
    descuento: 0,
    montoPagado: 100,
    pagos: [{ metodo: 'efectivo', monto: 90 }],
    fechaVenta: '2026-04-08',
    items: [{ productoId: 1, cantidad: 1, precioUnitario: 100 }],
  });

  assert.equal(error, 'La suma de los pagos debe coincidir con el monto pagado');
});

test('validateBudgetInput rechaza cliente invalido', () => {
  const error = validateBudgetInput({
    clientId: 'abc',
    descuento: 0,
    ajusteMetodoPago: 0,
    metodoPago: 'efectivo',
    fechaEmision: '2026-04-08',
    diasValidez: 7,
    items: [{ productoNombre: 'Producto manual', cantidad: 1, precioUnitario: 100 }],
  });

  assert.equal(error, 'El cliente seleccionado no es valido');
});

test('validateOrderInput de cliente acepta datos de agasajado opcionales', () => {
  const error = validateOrderInput({
    tipo: 'cliente',
    fechaPedido: '2026-04-08',
    fechaEvento: null,
    fechaEntrega: null,
    clienteNombre: 'Maria',
    clienteTelefono: '11 2345 6789',
    agasajadoNombre: '',
    montoEntregado: 0,
    items: [{ productoNombre: 'Combo', cantidad: 1, costoUnitario: 100 }],
  });

  assert.equal(error, null);
});

test('validateOrderInput de proveedor acepta item manual valido', () => {
  const error = validateOrderInput({
    tipo: 'proveedor',
    fechaPedido: '2026-04-08',
    items: [{ productoNombre: 'Caja sorpresa', cantidad: 2, costoUnitario: 500 }],
  });

  assert.equal(error, null);
});
