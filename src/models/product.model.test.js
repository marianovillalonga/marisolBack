const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../config/db');
const productModel = require('./product.model');

function buildProductRow(overrides = {}) {
  return {
    id: 1,
    nombre: 'Producto',
    categoria: 'Tortas',
    subcategoria: 'Chocolate',
    codigo_barras: null,
    cantidad: 10,
    stock_minimo: 1,
    precio: 0,
    detalle: '',
    image_url: null,
    fecha_creacion: '2026-08-04T00:00:00.000Z',
    fecha_actualizacion: '2026-08-04T00:00:00.000Z',
    ...overrides,
  };
}

function withMockClient(handler) {
  const originalConnect = pool.connect;
  const queries = [];

  const client = {
    query: async (query, params = []) => {
      queries.push({ query, params });
      return handler(query, params);
    },
    release: () => {},
  };

  pool.connect = async () => client;

  return async (callback) => {
    try {
      await callback(queries);
    } finally {
      pool.connect = originalConnect;
    }
  };
}

test('adjustPricesByCategory actualiza todos los productos de una categoria con redondeo a centenas', async () => {
  const runWithClient = withMockClient(async (query, params) => {
    if (query === 'BEGIN' || query === 'COMMIT') {
      return { rows: [] };
    }

    if (query.includes('FROM productos p')) {
      assert.deepEqual(params, [1, null]);
      return {
        rows: [
          buildProductRow({ id: 1, nombre: 'Torta chocolate', precio_anterior: 4838.47 }),
          buildProductRow({ id: 2, nombre: 'Torta vainilla', subcategoria: 'Vainilla', precio_anterior: 3500 }),
        ],
      };
    }

    if (query.includes('UPDATE productos')) {
      return {
        rows: [
          buildProductRow({
            id: params[0],
            nombre: params[0] === 1 ? 'Torta chocolate' : 'Torta vainilla',
            subcategoria: params[0] === 1 ? 'Chocolate' : 'Vainilla',
            precio: params[1],
          }),
        ],
      };
    }

    throw new Error(`Unexpected query: ${query}`);
  });

  await runWithClient(async (queries) => {
    const result = await productModel.adjustPricesByCategory({
      categoryId: 1,
      subcategoryId: null,
      percentage: 3,
    });

    assert.equal(result.updatedCount, 2);
    assert.deepEqual(
      result.products.map((product) => product.precioNuevo),
      [5000, 3600],
    );
    assert.deepEqual(
      queries.filter(({ query }) => query.includes('UPDATE productos')).map(({ params }) => params),
      [
        [1, 5000],
        [2, 3600],
      ],
    );
  });
});

test('adjustPricesByCategory aplica el filtro de subcategoria y guarda el precio redondeado', async () => {
  const runWithClient = withMockClient(async (query, params) => {
    if (query === 'BEGIN' || query === 'COMMIT') {
      return { rows: [] };
    }

    if (query.includes('FROM productos p')) {
      assert.deepEqual(params, [1, 10]);
      return {
        rows: [buildProductRow({ id: 1, nombre: 'Torta chocolate', precio_anterior: 3500 })],
      };
    }

    if (query.includes('UPDATE productos')) {
      return {
        rows: [buildProductRow({ id: params[0], nombre: 'Torta chocolate', precio: params[1] })],
      };
    }

    throw new Error(`Unexpected query: ${query}`);
  });

  await runWithClient(async (queries) => {
    const result = await productModel.adjustPricesByCategory({
      categoryId: 1,
      subcategoryId: 10,
      percentage: -5,
    });

    assert.equal(result.updatedCount, 1);
    assert.equal(result.products[0].precioAnterior, 3500);
    assert.equal(result.products[0].precioNuevo, 3300);
    assert.deepEqual(
      queries.filter(({ query }) => query.includes('UPDATE productos')).map(({ params }) => params),
      [[1, 3300]],
    );
  });
});

test('revertPriceAdjustment restaura el precio anterior registrado por auditoria', async () => {
  const runWithClient = withMockClient(async (query, params) => {
    if (query === 'BEGIN' || query === 'COMMIT') {
      return { rows: [] };
    }

    if (query.includes('UPDATE productos')) {
      return {
        rows: [buildProductRow({ id: params[0], nombre: 'Torta chocolate', precio: params[1] })],
      };
    }

    throw new Error(`Unexpected query: ${query}`);
  });

  await runWithClient(async (queries) => {
    const result = await productModel.revertPriceAdjustment([
      {
        id: 1,
        precioAnterior: 4838.47,
        precioNuevo: 5000,
      },
    ]);

    assert.equal(result.updatedCount, 1);
    assert.equal(result.products[0].precio, 4838.47);
    assert.deepEqual(
      queries.filter(({ query }) => query.includes('UPDATE productos')).map(({ params }) => params),
      [[1, 4838.47]],
    );
  });
});
