const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../config/db');
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

test('findById devuelve los items de la venta en el mismo orden en que fueron guardados', async () => {
  const originalQuery = pool.query;
  const queries = [];

  pool.query = async (query, params) => {
    queries.push(query);

    if (query.includes('FROM ventas v')) {
      return {
        rows: [
          {
            id: params[0],
            cliente_id: null,
            cliente_nombre: null,
            vendedor_id: 1,
            vendedor_nombre: 'Vendedor',
            subtotal: 300,
            ajuste_metodo_pago: 0,
            ajuste_metodo_pago_tipo: null,
            ajuste_metodo_pago_porcentaje: 0,
            descuento: 0,
            total: 300,
            monto_pagado: 300,
            deuda_pendiente: 0,
            metodo_pago: 'efectivo',
            pagos: [{ metodo: 'efectivo', monto: 300 }],
            estado: 'en_progreso',
            notas: null,
            fecha_venta: '2026-07-14T00:00:00.000Z',
            cantidad_items: 3,
          },
        ],
      };
    }

    return {
      rows: [
        {
          id: 10,
          venta_id: params[0],
          producto_id: 1,
          producto_nombre: 'Primero',
          cantidad: 1,
          precio_unitario: 100,
          subtotal: 100,
        },
        {
          id: 11,
          venta_id: params[0],
          producto_id: 2,
          producto_nombre: 'Segundo',
          cantidad: 1,
          precio_unitario: 200,
          subtotal: 200,
        },
      ],
    };
  };

  try {
    const sale = await saleModel.findById(123);
    const detailsQuery = queries.find((query) => query.includes('FROM venta_detalles'));

    assert.match(detailsQuery, /ORDER BY id ASC/);
    assert.deepEqual(
      sale.items.map((item) => item.productoNombre),
      ['Primero', 'Segundo'],
    );
  } finally {
    pool.query = originalQuery;
  }
});

test('listSales excluye ventas anuladas en datos y total de paginacion', async () => {
  const originalQuery = pool.query;
  const queries = [];

  pool.query = async (query, params) => {
    queries.push({ query, params });

    if (query.includes('COUNT(*)')) {
      return { rows: [{ total: 3 }] };
    }

    return {
      rows: [
        {
          id: 10,
          cliente_id: null,
          cliente_nombre: null,
          vendedor_id: 1,
          vendedor_nombre: 'Vendedor',
          subtotal: 1000,
          ajuste_metodo_pago: 0,
          ajuste_metodo_pago_tipo: null,
          ajuste_metodo_pago_porcentaje: 0,
          descuento: 0,
          total: 1000,
          monto_pagado: 1000,
          deuda_pendiente: 0,
          metodo_pago: 'efectivo',
          pagos: [{ metodo: 'efectivo', monto: 1000 }],
          estado: 'confirmada',
          notas: null,
          fecha_venta: '2026-07-20T00:00:00.000Z',
          cantidad_items: 1,
        },
        {
          id: 11,
          cliente_id: null,
          cliente_nombre: null,
          vendedor_id: 1,
          vendedor_nombre: 'Vendedor',
          subtotal: 500,
          ajuste_metodo_pago: 0,
          ajuste_metodo_pago_tipo: null,
          ajuste_metodo_pago_porcentaje: 0,
          descuento: 0,
          total: 500,
          monto_pagado: 0,
          deuda_pendiente: 500,
          metodo_pago: 'efectivo',
          pagos: [],
          estado: 'en_progreso',
          notas: null,
          fecha_venta: '2026-07-19T00:00:00.000Z',
          cantidad_items: 1,
        },
        {
          id: 12,
          cliente_id: 2,
          cliente_nombre: 'Cliente confirmada',
          vendedor_id: 1,
          vendedor_nombre: 'Vendedor',
          subtotal: 750,
          ajuste_metodo_pago: 0,
          ajuste_metodo_pago_tipo: null,
          ajuste_metodo_pago_porcentaje: 0,
          descuento: 0,
          total: 750,
          monto_pagado: 750,
          deuda_pendiente: 0,
          metodo_pago: 'efectivo',
          pagos: [{ metodo: 'efectivo', monto: 750 }],
          estado: 'confirmada',
          notas: null,
          fecha_venta: '2026-07-18T00:00:00.000Z',
          cantidad_items: 1,
        },
      ],
    };
  };

  try {
    const result = await saleModel.listSales('', 'all', { limit: 20, offset: 0 });

    assert.equal(result.total, 3);
    assert.deepEqual(result.sales.map((sale) => sale.estado), ['confirmada', 'en_progreso', 'confirmada']);
    assert.equal(queries.length, 2);
    assert.ok(
      queries.every(({ query }) => query.includes("LOWER(TRIM(v.estado)) <> 'anulada'")),
      'datos y count deben excluir anuladas en SQL',
    );
    assert.ok(
      queries.every(({ query }) => query.includes("LOWER(TRIM(v.estado)) = $2")),
      'datos y count deben compartir tambien la condicion normalizada de estado',
    );
  } finally {
    pool.query = originalQuery;
  }
});

test('listSales mantiene coherente el filtro confirmada sin incluir anuladas', async () => {
  const originalQuery = pool.query;
  const queries = [];

  pool.query = async (query, params) => {
    queries.push({ query, params });

    if (query.includes('COUNT(*)')) {
      return { rows: [{ total: 1 }] };
    }

    return {
      rows: [
        {
          id: 20,
          cliente_id: 3,
          cliente_nombre: 'Cliente',
          vendedor_id: 1,
          vendedor_nombre: 'Vendedor',
          subtotal: 1500,
          ajuste_metodo_pago: 0,
          ajuste_metodo_pago_tipo: null,
          ajuste_metodo_pago_porcentaje: 0,
          descuento: 0,
          total: 1500,
          monto_pagado: 1500,
          deuda_pendiente: 0,
          metodo_pago: 'efectivo',
          pagos: [{ metodo: 'efectivo', monto: 1500 }],
          estado: 'confirmada',
          notas: null,
          fecha_venta: '2026-07-20T00:00:00.000Z',
          cantidad_items: 1,
        },
      ],
    };
  };

  try {
    const result = await saleModel.listSales('', 'confirmada', { limit: 20, offset: 0 });

    assert.equal(result.total, 1);
    assert.deepEqual(result.sales.map((sale) => sale.estado), ['confirmada']);
    assert.ok(queries.every(({ params }) => params[1] === 'confirmada'));
    assert.ok(queries.every(({ query }) => query.includes("LOWER(TRIM(v.estado)) <> 'anulada'")));
  } finally {
    pool.query = originalQuery;
  }
});

test('listSales no expone ventas anuladas aun si se solicita ese estado', async () => {
  const originalQuery = pool.query;
  const queries = [];

  pool.query = async (query, params) => {
    queries.push({ query, params });

    if (query.includes('COUNT(*)')) {
      return { rows: [{ total: 0 }] };
    }

    return { rows: [] };
  };

  try {
    const result = await saleModel.listSales('', 'anulada', { limit: 20, offset: 0 });

    assert.equal(result.total, 0);
    assert.deepEqual(result.sales, []);
    assert.ok(queries.every(({ params }) => params[1] === 'anulada'));
    assert.ok(queries.every(({ query }) => query.includes("LOWER(TRIM(v.estado)) <> 'anulada'")));
  } finally {
    pool.query = originalQuery;
  }
});
