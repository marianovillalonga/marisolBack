const test = require('node:test');
const assert = require('node:assert/strict');

const { buildMetricsFilters, getCurrentMonthRange } = require('./metrics.util');

test('buildMetricsFilters arma rango completo cuando recibe mes y ano', () => {
  const filters = buildMetricsFilters({ month: '2', year: '2026' });

  assert.equal(filters.from, '2026-02-01');
  assert.equal(filters.to, '2026-02-28');
  assert.equal(filters.month, 2);
  assert.equal(filters.year, 2026);
});

test('buildMetricsFilters prioriza rango desde/hasta sobre mes y ano', () => {
  const filters = buildMetricsFilters({
    month: '6',
    year: '2026',
    from: '2026-05-10',
    to: '2026-05-20',
  });

  assert.equal(filters.from, '2026-05-10');
  assert.equal(filters.to, '2026-05-20');
});

test('buildMetricsFilters normaliza filtros numericos y alias', () => {
  const filters = buildMetricsFilters({
    categoriaId: '3',
    subcategoriaId: '4',
    productoId: '5',
    vendedorId: '6',
    metodoPago: ' efectivo ',
    search: ' mesa ',
  });

  assert.equal(filters.categoryId, 3);
  assert.equal(filters.subcategoryId, 4);
  assert.equal(filters.productId, 5);
  assert.equal(filters.userId, 6);
  assert.equal(filters.paymentMethod, 'efectivo');
  assert.equal(filters.search, 'mesa');
});

test('getCurrentMonthRange devuelve primer y ultimo dia del mes', () => {
  assert.deepEqual(getCurrentMonthRange(new Date(2026, 5, 15)), {
    from: '2026-06-01',
    to: '2026-06-30',
  });
});
