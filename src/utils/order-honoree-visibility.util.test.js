const test = require('node:test');
const assert = require('node:assert/strict');

const {
  inferHistoricalOrderHonoreeVisibility,
  normalizeOrderHonoreeVisibility,
} = require('./order-honoree-visibility.util');

test('pedido historico con datos de agasajado queda visible', () => {
  assert.equal(
    inferHistoricalOrderHonoreeVisibility({
      tipo: 'cliente',
      agasajadoNombre: 'Sofia',
      edadAgasajado: null,
      tematica: '',
      fechaEvento: null,
    }),
    true,
  );
});

test('pedido historico sin datos de agasajado queda oculto', () => {
  assert.equal(
    inferHistoricalOrderHonoreeVisibility({
      tipo: 'cliente',
      agasajadoNombre: '   ',
      edadAgasajado: null,
      tematica: '',
      fechaEvento: null,
    }),
    false,
  );
});

test('pedido nuevo con boton de agasajado habilitado guarda true', () => {
  assert.equal(normalizeOrderHonoreeVisibility('cliente', true), true);
});

test('pedido nuevo con boton de agasajado deshabilitado guarda false', () => {
  assert.equal(normalizeOrderHonoreeVisibility('cliente', false), false);
});

test('edicion de agasajado habilitado a deshabilitado guarda false', () => {
  assert.equal(normalizeOrderHonoreeVisibility('cliente', false), false);
});

test('edicion de agasajado deshabilitado a habilitado guarda true', () => {
  assert.equal(normalizeOrderHonoreeVisibility('cliente', true), true);
});
