const test = require('node:test');
const assert = require('node:assert/strict');

const userModel = require('./user.model');

test('normalizePaymentMethodSettings conserva debito para evitar ajustes ocultos', () => {
  const settings = userModel.normalizePaymentMethodSettings({
    debito: {
      tipo: 'descuento',
      porcentaje: 0.03,
    },
  });

  assert.deepEqual(settings.debito, {
    tipo: 'descuento',
    porcentaje: 0.03,
  });
});
