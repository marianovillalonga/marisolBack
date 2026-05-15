const pool = require('../config/db');
const {
  distributeAmountAcrossItems,
  groupSaleItemsByProduct,
  roundToTwo,
} = require('../utils/sale.util');

function normalizePaymentRows(rawPayments) {
  if (!Array.isArray(rawPayments)) {
    return [];
  }

  return rawPayments
    .map((payment) => ({
      metodo: payment?.metodo || '',
      monto: roundToTwo(Number(payment?.monto || 0)),
    }))
    .filter((payment) => payment.metodo && payment.monto > 0);
}

function getPaymentMultiplier(rule) {
  const percentage = Number(rule?.porcentaje || 0);

  if (!percentage) {
    return 1;
  }

  return rule?.tipo === 'aumento'
    ? 1 + percentage / 100
    : Math.max(1 - percentage / 100, 0.01);
}

function resolveMetodoPago(payments) {
  if (!payments.length) {
    return 'pendiente';
  }

  if (payments.length === 1) {
    return payments[0].metodo;
  }

  return 'mixto';
}

class SaleModel {
  mapSale(row) {
    const pagos = normalizePaymentRows(row.pagos);

    return {
      id: row.id,
      clienteId: row.cliente_id,
      clienteNombre: row.cliente_nombre,
      vendedorId: row.vendedor_id,
      vendedorNombre: row.vendedor_nombre,
      subtotal: Number(row.subtotal || 0),
      ajusteMetodoPago: Number(row.ajuste_metodo_pago || 0),
      ajusteMetodoPagoTipo: row.ajuste_metodo_pago_tipo || null,
      ajusteMetodoPagoPorcentaje: Number(row.ajuste_metodo_pago_porcentaje || 0),
      descuento: Number(row.descuento || 0),
      total: Number(row.total || 0),
      montoPagado: Number(row.monto_pagado || 0),
      deudaPendiente: Number(row.deuda_pendiente || 0),
      metodoPago: row.metodo_pago,
      pagos,
      estado: row.estado,
      notas: row.notas,
      fechaVenta: row.fecha_venta,
      cantidadItems: Number(row.cantidad_items || 0),
    };
  }

  mapSaleItem(row) {
    return {
      id: row.id,
      ventaId: row.venta_id,
      productoId: row.producto_id,
      productoNombre: row.producto_nombre,
      cantidad: Number(row.cantidad || 0),
      precioUnitario: Number(row.precio_unitario || 0),
      subtotal: Number(row.subtotal || 0),
    };
  }

  async ensureSalesTables() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ventas (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        vendedor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
        ajuste_metodo_pago NUMERIC(12, 2) NOT NULL DEFAULT 0,
        ajuste_metodo_pago_tipo VARCHAR(20),
        ajuste_metodo_pago_porcentaje NUMERIC(8, 2) NOT NULL DEFAULT 0,
        descuento NUMERIC(12, 2) NOT NULL DEFAULT 0,
        total NUMERIC(12, 2) NOT NULL DEFAULT 0,
        monto_pagado NUMERIC(12, 2) NOT NULL DEFAULT 0,
        deuda_pendiente NUMERIC(12, 2) NOT NULL DEFAULT 0,
        metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo',
        pagos JSONB NOT NULL DEFAULT '[]'::jsonb,
        estado VARCHAR(30) NOT NULL DEFAULT 'confirmada',
        notas TEXT,
        fecha_venta TIMESTAMP NOT NULL DEFAULT NOW(),
        fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
        fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS venta_detalles (
        id SERIAL PRIMARY KEY,
        venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
        producto_nombre VARCHAR(150) NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1,
        precio_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0,
        subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0
      )
    `);

    await pool.query(`
      ALTER TABLE IF EXISTS ventas
      ADD COLUMN IF NOT EXISTS ajuste_metodo_pago NUMERIC(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS ajuste_metodo_pago_tipo VARCHAR(20),
      ADD COLUMN IF NOT EXISTS ajuste_metodo_pago_porcentaje NUMERIC(8, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS pagos JSONB NOT NULL DEFAULT '[]'::jsonb
    `);

    await pool.query(`
      UPDATE ventas
      SET pagos = CASE
        WHEN jsonb_typeof(pagos) = 'array' AND jsonb_array_length(pagos) > 0 THEN pagos
        WHEN COALESCE(monto_pagado, 0) > 0 THEN jsonb_build_array(
          jsonb_build_object(
            'metodo', COALESCE(metodo_pago, 'efectivo'),
            'monto', ROUND(COALESCE(monto_pagado, 0)::numeric, 2)
          )
        )
        ELSE '[]'::jsonb
      END
      WHERE pagos IS NULL
         OR jsonb_typeof(pagos) <> 'array'
         OR (jsonb_typeof(pagos) = 'array' AND jsonb_array_length(pagos) = 0)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ventas_cliente_id
      ON ventas(cliente_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_venta_detalles_venta_id
      ON venta_detalles(venta_id)
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion_ventas()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.fecha_actualizacion = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_actualizar_ventas ON ventas
    `);
    await pool.query(`
      CREATE TRIGGER trigger_actualizar_ventas
      BEFORE UPDATE ON ventas
      FOR EACH ROW
      EXECUTE FUNCTION actualizar_fecha_actualizacion_ventas()
    `);
  }

  buildListQuery() {
    return `
      SELECT
        v.id,
        v.cliente_id,
        c.nombre AS cliente_nombre,
        v.vendedor_id,
        u.nombre AS vendedor_nombre,
        v.subtotal,
        v.ajuste_metodo_pago,
        v.ajuste_metodo_pago_tipo,
        v.ajuste_metodo_pago_porcentaje,
        v.descuento,
        v.total,
        v.monto_pagado,
        v.deuda_pendiente,
        v.metodo_pago,
        v.pagos,
        v.estado,
        v.notas,
        v.fecha_venta,
        COALESCE(SUM(vd.cantidad), 0)::int AS cantidad_items
      FROM ventas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      LEFT JOIN usuarios u ON u.id = v.vendedor_id
      LEFT JOIN venta_detalles vd ON vd.venta_id = v.id
    `;
  }

  async listSales(search = '', status = 'all', pagination = { limit: 20, offset: 0 }) {
    const normalizedSearch = `%${search.trim().toLowerCase()}%`;
    const normalizedStatus = status.trim().toLowerCase();
    const filtersQuery = `
      WHERE
        (
          $1 = '%%'
          OR LOWER(COALESCE(c.nombre, 'consumidor final')) LIKE $1
          OR LOWER(COALESCE(u.nombre, '')) LIKE $1
          OR CAST(v.id AS TEXT) LIKE REPLACE($1, '%', '')
        )
        AND (
          $2 = 'all'
          OR LOWER(v.estado) = $2
        )
    `;

    const [{ rows }, countResult] = await Promise.all([
      pool.query(
      `
        ${this.buildListQuery()}
        ${filtersQuery}
        GROUP BY v.id, c.nombre, u.nombre
        ORDER BY v.fecha_venta DESC, v.id DESC
        LIMIT $3
        OFFSET $4
      `,
      [normalizedSearch, normalizedStatus, pagination.limit, pagination.offset],
    ),
      pool.query(
        `
          SELECT COUNT(*)::int AS total
          FROM ventas v
          LEFT JOIN clientes c ON c.id = v.cliente_id
          LEFT JOIN usuarios u ON u.id = v.vendedor_id
          ${filtersQuery}
        `,
        [normalizedSearch, normalizedStatus],
      ),
    ]);

    return {
      sales: rows.map((row) => this.mapSale(row)),
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  async getSalesSummary(from, to) {
    const { rows } = await pool.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE estado = 'confirmada')::int AS total_ventas,
          COUNT(*) FILTER (WHERE estado = 'anulada')::int AS ventas_anuladas,
          COALESCE(SUM(total) FILTER (WHERE estado = 'confirmada'), 0)::numeric(12, 2) AS total_facturado,
          COALESCE(SUM(monto_pagado) FILTER (WHERE estado = 'confirmada'), 0)::numeric(12, 2) AS total_cobrado,
          COALESCE(SUM(deuda_pendiente) FILTER (WHERE estado = 'confirmada'), 0)::numeric(12, 2) AS total_pendiente,
          COALESCE(AVG(total) FILTER (WHERE estado = 'confirmada'), 0)::numeric(12, 2) AS ticket_promedio
        FROM ventas
        WHERE fecha_venta >= $1::timestamp
          AND fecha_venta < ($2::timestamp + INTERVAL '1 day')
      `,
      [from, to],
    );

    return {
      from,
      to,
      totalVentas: Number(rows[0]?.total_ventas || 0),
      ventasAnuladas: Number(rows[0]?.ventas_anuladas || 0),
      totalFacturado: Number(rows[0]?.total_facturado || 0),
      totalCobrado: Number(rows[0]?.total_cobrado || 0),
      totalPendiente: Number(rows[0]?.total_pendiente || 0),
      ticketPromedio: Number(rows[0]?.ticket_promedio || 0),
    };
  }

  async findById(id) {
    const saleResult = await pool.query(
      `
        ${this.buildListQuery()}
        WHERE v.id = $1
        GROUP BY v.id, c.nombre, u.nombre
        LIMIT 1
      `,
      [id],
    );

    if (!saleResult.rows[0]) {
      return null;
    }

    const itemsResult = await pool.query(
      `
        SELECT
          id,
          venta_id,
          producto_id,
          producto_nombre,
          cantidad,
          precio_unitario,
          subtotal
        FROM venta_detalles
        WHERE venta_id = $1
        ORDER BY id DESC
      `,
      [id],
    );

    return {
      ...this.mapSale(saleResult.rows[0]),
      items: itemsResult.rows.map((row) => this.mapSaleItem(row)),
    };
  }

  async resolveSaleContext(client, { clientId, sellerId }) {
    let customer = null;

    if (clientId) {
      const customerResult = await client.query(
        'SELECT id, nombre FROM clientes WHERE id = $1 LIMIT 1',
        [clientId],
      );
      customer = customerResult.rows[0];

      if (!customer) {
        return { error: 'CLIENT_NOT_FOUND' };
      }
    }

    const sellerResult = await client.query(
      'SELECT id, nombre, configuracion_metodos_pago FROM usuarios WHERE id = $1 LIMIT 1',
      [sellerId],
    );

    if (!sellerResult.rows[0]) {
      return { error: 'SELLER_NOT_FOUND' };
    }

    return {
      customer,
      seller: sellerResult.rows[0],
    };
  }

  buildItemSnapshots(items, productsById = new Map()) {
    return items.map((item) => {
      const normalizedProductId = item.productoId ? Number(item.productoId) : null;
      const productSnapshot = normalizedProductId ? productsById.get(normalizedProductId) : null;

      return {
        productoId: normalizedProductId,
        productoNombre: productSnapshot?.productoNombre || item.productoNombre || '',
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precioUnitario),
        subtotal: Number(item.cantidad) * Number(item.precioUnitario),
      };
    });
  }

  calculateSaleTotals({ descuento, montoPagado, pagos, itemSnapshots, seller }) {
    const normalizedPayments = normalizePaymentRows(pagos);
    const subtotal = itemSnapshots.reduce((acc, item) => acc + item.subtotal, 0);
    const discountedSubtotal = roundToTwo(Math.max(subtotal - descuento, 0));
    let totalPaymentBase = 0;
    const sellerConfig =
      seller?.configuracion_metodos_pago && typeof seller.configuracion_metodos_pago === 'object'
        ? seller.configuracion_metodos_pago
        : {};

    for (const payment of normalizedPayments) {
      const paymentRule = sellerConfig[payment.metodo];
      const multiplier = getPaymentMultiplier(paymentRule);
      const paymentBase = roundToTwo(payment.monto / multiplier);
      totalPaymentBase += paymentBase;
    }

    totalPaymentBase = roundToTwo(totalPaymentBase);

    if (totalPaymentBase - discountedSubtotal > 0.01) {
      return { error: 'INVALID_PAYMENT_SPLIT' };
    }

    const ajusteMetodoPago = roundToTwo(montoPagado - totalPaymentBase);
    const singlePaymentRule =
      normalizedPayments.length === 1 ? sellerConfig[normalizedPayments[0].metodo] : null;
    const ajusteMetodoPagoTipo =
      normalizedPayments.length === 1 && Number(singlePaymentRule?.porcentaje || 0) > 0
        ? singlePaymentRule?.tipo || null
        : null;
    const ajusteMetodoPagoPorcentaje =
      normalizedPayments.length === 1 ? Number(singlePaymentRule?.porcentaje || 0) : 0;
    const total = roundToTwo(discountedSubtotal + ajusteMetodoPago);
    const deudaPendiente = Math.max(total - montoPagado, 0);
    const itemAdjustments = distributeAmountAcrossItems(
      ajusteMetodoPago - descuento,
      itemSnapshots.map((item) => item.subtotal),
    );
    const itemNetTotals = itemSnapshots.map((item, index) =>
      roundToTwo(item.subtotal + itemAdjustments[index]),
    );
    const itemPayments = distributeAmountAcrossItems(montoPagado, itemNetTotals);

    return {
      subtotal,
      normalizedPayments,
      ajusteMetodoPago,
      ajusteMetodoPagoTipo,
      ajusteMetodoPagoPorcentaje,
      total,
      deudaPendiente,
      itemNetTotals,
      itemPayments,
      metodoPago: resolveMetodoPago(normalizedPayments),
    };
  }

  async upsertSaleDetails(client, saleId, itemSnapshots) {
    await client.query('DELETE FROM venta_detalles WHERE venta_id = $1', [saleId]);

    for (const item of itemSnapshots) {
      await client.query(
        `
          INSERT INTO venta_detalles (
            venta_id,
            producto_id,
            producto_nombre,
            cantidad,
            precio_unitario,
            subtotal
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          saleId,
          item.productoId,
          item.productoNombre || '',
          item.cantidad,
          item.precioUnitario,
          item.subtotal,
        ],
      );
    }
  }

  async lockProductsForSale(client, items) {
    const catalogItems = items.filter(
      (item) => item.productoId && !Number.isNaN(Number(item.productoId)),
    );
    const groupedItems = groupSaleItemsByProduct(catalogItems);
    const productsById = new Map();

    for (const groupedItem of groupedItems) {
      const productResult = await client.query(
        `
          SELECT id, nombre, cantidad, precio
          FROM productos
          WHERE id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [groupedItem.productoId],
      );

      const product = productResult.rows[0];

      if (!product) {
        return { error: 'PRODUCT_NOT_FOUND' };
      }

      if (Number(product.cantidad) < groupedItem.cantidadTotal) {
        return {
          error: 'INSUFFICIENT_STOCK',
          productName: product.nombre,
          availableStock: Number(product.cantidad),
        };
      }

      productsById.set(product.id, {
        productoId: product.id,
        productoNombre: product.nombre,
      });
    }

    return {
      groupedItems,
      productsById,
    };
  }

  async saveDraftSale({
    saleId,
    clientId,
    sellerId,
    descuento,
    montoPagado,
    notas,
    fechaVenta,
    pagos = [],
    items,
  }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const context = await this.resolveSaleContext(client, { clientId, sellerId });

      if (context.error) {
        await client.query('ROLLBACK');
        return context;
      }

      if (saleId) {
        const existingSaleResult = await client.query(
          'SELECT id, estado FROM ventas WHERE id = $1 LIMIT 1 FOR UPDATE',
          [saleId],
        );

        if (!existingSaleResult.rows[0]) {
          await client.query('ROLLBACK');
          return { error: 'NOT_FOUND' };
        }

        if (existingSaleResult.rows[0].estado !== 'en_progreso') {
          await client.query('ROLLBACK');
          return { error: 'INVALID_STATE' };
        }
      }

      const itemSnapshots = this.buildItemSnapshots(items);
      const computedTotals = this.calculateSaleTotals({
        descuento,
        montoPagado,
        pagos,
        itemSnapshots,
        seller: context.seller,
      });

      if (computedTotals.error) {
        await client.query('ROLLBACK');
        return computedTotals;
      }

      let resolvedSaleId = saleId;

      if (resolvedSaleId) {
        await client.query(
          `
            UPDATE ventas
            SET
              cliente_id = $2,
              vendedor_id = $3,
              subtotal = $4,
              ajuste_metodo_pago = $5,
              ajuste_metodo_pago_tipo = $6,
              ajuste_metodo_pago_porcentaje = $7,
              descuento = $8,
              total = $9,
              monto_pagado = $10,
              deuda_pendiente = $11,
              metodo_pago = $12,
              pagos = $13,
              estado = 'en_progreso',
              notas = $14,
              fecha_venta = $15
            WHERE id = $1
          `,
          [
            resolvedSaleId,
            clientId || null,
            sellerId,
            computedTotals.subtotal,
            computedTotals.ajusteMetodoPago,
            computedTotals.ajusteMetodoPagoTipo,
            computedTotals.ajusteMetodoPagoPorcentaje,
            descuento,
            computedTotals.total,
            montoPagado,
            computedTotals.deudaPendiente,
            computedTotals.metodoPago,
            JSON.stringify(computedTotals.normalizedPayments),
            notas || null,
            fechaVenta,
          ],
        );
      } else {
        const saleResult = await client.query(
          `
            INSERT INTO ventas (
              cliente_id,
              vendedor_id,
              subtotal,
              ajuste_metodo_pago,
              ajuste_metodo_pago_tipo,
              ajuste_metodo_pago_porcentaje,
              descuento,
              total,
              monto_pagado,
              deuda_pendiente,
              metodo_pago,
              pagos,
              estado,
              notas,
              fecha_venta
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'en_progreso', $13, $14)
            RETURNING id
          `,
          [
            clientId || null,
            sellerId,
            computedTotals.subtotal,
            computedTotals.ajusteMetodoPago,
            computedTotals.ajusteMetodoPagoTipo,
            computedTotals.ajusteMetodoPagoPorcentaje,
            descuento,
            computedTotals.total,
            montoPagado,
            computedTotals.deudaPendiente,
            computedTotals.metodoPago,
            JSON.stringify(computedTotals.normalizedPayments),
            notas || null,
            fechaVenta,
          ],
        );

        resolvedSaleId = saleResult.rows[0].id;
      }

      await this.upsertSaleDetails(client, resolvedSaleId, itemSnapshots);
      await client.query('DELETE FROM cliente_compras WHERE venta_id = $1', [resolvedSaleId]);

      await client.query('COMMIT');
      return { saleId: resolvedSaleId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createSaleWithClient(
    client,
    {
      clientId,
      sellerId,
      descuento,
      montoPagado,
      notas,
      fechaVenta,
      pagos = [],
      items,
    },
  ) {
    const context = await this.resolveSaleContext(client, { clientId, sellerId });

    if (context.error) {
      return context;
    }

    const stockContext = await this.lockProductsForSale(client, items);

    if (stockContext.error) {
      return stockContext;
    }

    const itemSnapshots = this.buildItemSnapshots(items, stockContext.productsById);
    const computedTotals = this.calculateSaleTotals({
      descuento,
      montoPagado,
      pagos,
      itemSnapshots,
      seller: context.seller,
    });

    if (computedTotals.error) {
      return computedTotals;
    }

    if (computedTotals.deudaPendiente > 0 && !context.customer) {
      return { error: 'CLIENT_REQUIRED_FOR_BALANCE' };
    }

    const saleResult = await client.query(
      `
        INSERT INTO ventas (
          cliente_id,
          vendedor_id,
          subtotal,
          ajuste_metodo_pago,
          ajuste_metodo_pago_tipo,
          ajuste_metodo_pago_porcentaje,
          descuento,
          total,
          monto_pagado,
          deuda_pendiente,
          metodo_pago,
          pagos,
          estado,
          notas,
          fecha_venta
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'confirmada', $13, $14)
        RETURNING id
      `,
      [
        clientId || null,
        sellerId,
        computedTotals.subtotal,
        computedTotals.ajusteMetodoPago,
        computedTotals.ajusteMetodoPagoTipo,
        computedTotals.ajusteMetodoPagoPorcentaje,
        descuento,
        computedTotals.total,
        montoPagado,
        computedTotals.deudaPendiente,
        computedTotals.metodoPago,
        JSON.stringify(computedTotals.normalizedPayments),
        notas || null,
        fechaVenta,
      ],
    );

    const saleId = saleResult.rows[0].id;
    await this.upsertSaleDetails(client, saleId, itemSnapshots);

    for (const groupedItem of stockContext.groupedItems) {
      await client.query(
        `
          UPDATE productos
          SET cantidad = cantidad - $2
          WHERE id = $1
        `,
        [groupedItem.productoId, groupedItem.cantidadTotal],
      );
    }

    if (context.customer) {
      for (let index = 0; index < itemSnapshots.length; index += 1) {
        const item = itemSnapshots[index];

        await client.query(
          `
            INSERT INTO cliente_compras (
              cliente_id,
              venta_id,
              producto_id,
              producto_nombre,
              cantidad,
              precio_unitario,
              total_compra,
              monto_pagado,
              fecha_compra,
              notas
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `,
          [
            context.customer.id,
            saleId,
            item.productoId,
            item.productoNombre,
            item.cantidad,
            item.precioUnitario,
            computedTotals.itemNetTotals[index],
            computedTotals.itemPayments[index],
            fechaVenta,
            notesForClientSale(notas),
          ],
        );
      }
    }

    return { saleId };
  }

  async createSale({
    clientId,
    sellerId,
    descuento,
    montoPagado,
    notas,
    fechaVenta,
    pagos = [],
    items,
  }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      const result = await this.createSaleWithClient(client, {
        clientId,
        sellerId,
        descuento,
        montoPagado,
        notas,
        fechaVenta,
        pagos,
        items,
      });

      if (result.error) {
        await client.query('ROLLBACK');
        return result;
      }

      await client.query('COMMIT');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async confirmDraftSale({ saleId, sellerId }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const saleResult = await client.query(
        `
          SELECT
            id,
            cliente_id,
            vendedor_id,
            descuento,
            monto_pagado,
            pagos,
            notas,
            fecha_venta,
            estado
          FROM ventas
          WHERE id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [saleId],
      );

      const draft = saleResult.rows[0];

      if (!draft) {
        await client.query('ROLLBACK');
        return { error: 'NOT_FOUND' };
      }

      if (draft.estado !== 'en_progreso') {
        await client.query('ROLLBACK');
        return { error: 'INVALID_STATE' };
      }

      const itemsResult = await client.query(
        `
          SELECT producto_id, producto_nombre, cantidad, precio_unitario
          FROM venta_detalles
          WHERE venta_id = $1
          ORDER BY id ASC
        `,
        [saleId],
      );

      const items = itemsResult.rows.map((item) => ({
        productoId: item.producto_id ? Number(item.producto_id) : null,
        productoNombre: item.producto_nombre || '',
        cantidad: Number(item.cantidad),
        precioUnitario: Number(item.precio_unitario),
      }));

      const context = await this.resolveSaleContext(client, {
        clientId: draft.cliente_id ? Number(draft.cliente_id) : null,
        sellerId,
      });

      if (context.error) {
        await client.query('ROLLBACK');
        return context;
      }

      const stockContext = await this.lockProductsForSale(client, items);

      if (stockContext.error) {
        await client.query('ROLLBACK');
        return stockContext;
      }

      const itemSnapshots = this.buildItemSnapshots(items, stockContext.productsById);
      const computedTotals = this.calculateSaleTotals({
        descuento: Number(draft.descuento || 0),
        montoPagado: Number(draft.monto_pagado || 0),
        pagos: draft.pagos,
        itemSnapshots,
        seller: context.seller,
      });

      if (computedTotals.error) {
        await client.query('ROLLBACK');
        return computedTotals;
      }

      if (computedTotals.deudaPendiente > 0 && !context.customer) {
        await client.query('ROLLBACK');
        return { error: 'CLIENT_REQUIRED_FOR_BALANCE' };
      }

      await this.upsertSaleDetails(client, saleId, itemSnapshots);

      await client.query(
        `
          UPDATE ventas
          SET
            cliente_id = $2,
            vendedor_id = $3,
            subtotal = $4,
            ajuste_metodo_pago = $5,
            ajuste_metodo_pago_tipo = $6,
            ajuste_metodo_pago_porcentaje = $7,
            descuento = $8,
            total = $9,
            monto_pagado = $10,
            deuda_pendiente = $11,
            metodo_pago = $12,
            pagos = $13,
            estado = 'confirmada'
          WHERE id = $1
        `,
        [
          saleId,
          draft.cliente_id || null,
          sellerId,
          computedTotals.subtotal,
          computedTotals.ajusteMetodoPago,
          computedTotals.ajusteMetodoPagoTipo,
          computedTotals.ajusteMetodoPagoPorcentaje,
          Number(draft.descuento || 0),
          computedTotals.total,
          Number(draft.monto_pagado || 0),
          computedTotals.deudaPendiente,
          computedTotals.metodoPago,
          JSON.stringify(computedTotals.normalizedPayments),
        ],
      );

      for (const groupedItem of stockContext.groupedItems) {
        await client.query(
          `
            UPDATE productos
            SET cantidad = cantidad - $2
            WHERE id = $1
          `,
          [groupedItem.productoId, groupedItem.cantidadTotal],
        );
      }

      await client.query('DELETE FROM cliente_compras WHERE venta_id = $1', [saleId]);

      if (context.customer) {
        for (let index = 0; index < itemSnapshots.length; index += 1) {
          const item = itemSnapshots[index];

          await client.query(
            `
              INSERT INTO cliente_compras (
                cliente_id,
                venta_id,
                producto_id,
                producto_nombre,
                cantidad,
                precio_unitario,
                total_compra,
                monto_pagado,
                fecha_compra,
                notas
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `,
            [
              context.customer.id,
              saleId,
              item.productoId,
              item.productoNombre,
              item.cantidad,
              item.precioUnitario,
              computedTotals.itemNetTotals[index],
              computedTotals.itemPayments[index],
              draft.fecha_venta,
              notesForClientSale(draft.notas),
            ],
          );
        }
      }

      await client.query('COMMIT');
      return { saleId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelSale(id) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const saleResult = await client.query(
        'SELECT id, estado FROM ventas WHERE id = $1 LIMIT 1 FOR UPDATE',
        [id],
      );

      const sale = saleResult.rows[0];

      if (!sale) {
        await client.query('ROLLBACK');
        return { error: 'NOT_FOUND' };
      }

      if (sale.estado === 'anulada') {
        await client.query('ROLLBACK');
        return { error: 'ALREADY_CANCELLED' };
      }

      const detailsResult = await client.query(
        'SELECT producto_id, cantidad FROM venta_detalles WHERE venta_id = $1',
        [id],
      );

      for (const detail of detailsResult.rows) {
        if (sale.estado === 'confirmada' && detail.producto_id) {
          await client.query(
            'UPDATE productos SET cantidad = cantidad + $2 WHERE id = $1',
            [detail.producto_id, detail.cantidad],
          );
        }
      }

      await client.query(
        "UPDATE ventas SET estado = 'anulada' WHERE id = $1",
        [id],
      );

      await client.query('DELETE FROM cliente_compras WHERE venta_id = $1', [id]);

      await client.query('COMMIT');

      return { cancelled: true };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async repairClientPurchasesFromSales() {
      const { rows: sales } = await pool.query(`
      SELECT id, descuento, ajuste_metodo_pago, monto_pagado
      FROM ventas
      WHERE estado = 'confirmada'
        AND EXISTS (SELECT 1 FROM cliente_compras cc WHERE cc.venta_id = ventas.id)
    `);

    for (const sale of sales) {
      const { rows: details } = await pool.query(
        `
          SELECT id, subtotal
          FROM venta_detalles
          WHERE venta_id = $1
          ORDER BY id ASC
        `,
        [sale.id],
      );

      const { rows: purchases } = await pool.query(
        `
          SELECT id
          FROM cliente_compras
          WHERE venta_id = $1
          ORDER BY id ASC
        `,
        [sale.id],
      );

      if (!details.length || details.length !== purchases.length) {
        continue;
      }

      const subtotals = details.map((detail) => Number(detail.subtotal || 0));
      const adjustments = distributeAmountAcrossItems(
        Number(sale.ajuste_metodo_pago || 0) - Number(sale.descuento || 0),
        subtotals,
      );
      const netTotals = subtotals.map((subtotal, index) => roundToTwo(subtotal + adjustments[index]));
      const payments = distributeAmountAcrossItems(Number(sale.monto_pagado || 0), netTotals);

      for (let index = 0; index < purchases.length; index += 1) {
        await pool.query(
          `
            UPDATE cliente_compras
            SET
              total_compra = $2,
              monto_pagado = $3
            WHERE id = $1
          `,
          [purchases[index].id, netTotals[index], payments[index]],
        );
      }
    }
  }
}

function notesForClientSale(notes) {
  return notes ? `Venta registrada: ${notes}` : 'Venta registrada desde modulo de ventas';
}

module.exports = new SaleModel();
