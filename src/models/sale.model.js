const pool = require('../config/db');

class SaleModel {
  mapSale(row) {
    return {
      id: row.id,
      clienteId: row.cliente_id,
      clienteNombre: row.cliente_nombre,
      vendedorId: row.vendedor_id,
      vendedorNombre: row.vendedor_nombre,
      subtotal: Number(row.subtotal || 0),
      descuento: Number(row.descuento || 0),
      total: Number(row.total || 0),
      montoPagado: Number(row.monto_pagado || 0),
      deudaPendiente: Number(row.deuda_pendiente || 0),
      metodoPago: row.metodo_pago,
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
        descuento NUMERIC(12, 2) NOT NULL DEFAULT 0,
        total NUMERIC(12, 2) NOT NULL DEFAULT 0,
        monto_pagado NUMERIC(12, 2) NOT NULL DEFAULT 0,
        deuda_pendiente NUMERIC(12, 2) NOT NULL DEFAULT 0,
        metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo',
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
        v.descuento,
        v.total,
        v.monto_pagado,
        v.deuda_pendiente,
        v.metodo_pago,
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

  async listSales(search = '', status = 'all') {
    const normalizedSearch = `%${search.trim().toLowerCase()}%`;
    const normalizedStatus = status.trim().toLowerCase();

    const { rows } = await pool.query(
      `
        ${this.buildListQuery()}
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
        GROUP BY v.id, c.nombre, u.nombre
        ORDER BY v.fecha_venta DESC, v.id DESC
      `,
      [normalizedSearch, normalizedStatus],
    );

    return rows.map((row) => this.mapSale(row));
  }

  async getSalesSummary(from, to) {
    const { rows } = await pool.query(
      `
        SELECT
          COUNT(*) FILTER (WHERE estado <> 'anulada')::int AS total_ventas,
          COUNT(*) FILTER (WHERE estado = 'anulada')::int AS ventas_anuladas,
          COALESCE(SUM(total) FILTER (WHERE estado <> 'anulada'), 0)::numeric(12, 2) AS total_facturado,
          COALESCE(SUM(monto_pagado) FILTER (WHERE estado <> 'anulada'), 0)::numeric(12, 2) AS total_cobrado,
          COALESCE(SUM(deuda_pendiente) FILTER (WHERE estado <> 'anulada'), 0)::numeric(12, 2) AS total_pendiente,
          COALESCE(AVG(total) FILTER (WHERE estado <> 'anulada'), 0)::numeric(12, 2) AS ticket_promedio
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
        ORDER BY id ASC
      `,
      [id],
    );

    return {
      ...this.mapSale(saleResult.rows[0]),
      items: itemsResult.rows.map((row) => this.mapSaleItem(row)),
    };
  }

  async createSale({ clientId, sellerId, descuento, montoPagado, metodoPago, notas, fechaVenta, items }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let customer = null;

      if (clientId) {
        const customerResult = await client.query(
          'SELECT id, nombre FROM clientes WHERE id = $1 LIMIT 1',
          [clientId],
        );
        customer = customerResult.rows[0];

        if (!customer) {
          await client.query('ROLLBACK');
          return { error: 'CLIENT_NOT_FOUND' };
        }
      }

      const sellerResult = await client.query(
        'SELECT id, nombre FROM usuarios WHERE id = $1 LIMIT 1',
        [sellerId],
      );

      if (!sellerResult.rows[0]) {
        await client.query('ROLLBACK');
        return { error: 'SELLER_NOT_FOUND' };
      }

      const itemSnapshots = [];

      for (const item of items) {
        const productResult = await client.query(
          `
            SELECT id, nombre, cantidad, precio
            FROM productos
            WHERE id = $1
            LIMIT 1
            FOR UPDATE
          `,
          [item.productoId],
        );

        const product = productResult.rows[0];

        if (!product) {
          await client.query('ROLLBACK');
          return { error: 'PRODUCT_NOT_FOUND' };
        }

        if (Number(product.cantidad) < item.cantidad) {
          await client.query('ROLLBACK');
          return {
            error: 'INSUFFICIENT_STOCK',
            productName: product.nombre,
            availableStock: Number(product.cantidad),
          };
        }

        itemSnapshots.push({
          productoId: product.id,
          productoNombre: product.nombre,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: Number(item.cantidad) * Number(item.precioUnitario),
        });
      }

      const subtotal = itemSnapshots.reduce((acc, item) => acc + item.subtotal, 0);
      const total = subtotal - descuento;
      const deudaPendiente = Math.max(total - montoPagado, 0);
      const itemDiscounts = distributeAmountAcrossItems(descuento, itemSnapshots.map((item) => item.subtotal));
      const itemNetTotals = itemSnapshots.map((item, index) =>
        roundToTwo(item.subtotal - itemDiscounts[index]),
      );
      const itemPayments = distributeAmountAcrossItems(montoPagado, itemNetTotals);

      const saleResult = await client.query(
        `
          INSERT INTO ventas (
            cliente_id,
            vendedor_id,
            subtotal,
            descuento,
            total,
            monto_pagado,
            deuda_pendiente,
            metodo_pago,
            estado,
            notas,
            fecha_venta
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'confirmada', $9, $10)
          RETURNING id
        `,
        [
          clientId || null,
          sellerId,
          subtotal,
          descuento,
          total,
          montoPagado,
          deudaPendiente,
          metodoPago,
          notas || null,
          fechaVenta,
        ],
      );

      const saleId = saleResult.rows[0].id;

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
          [saleId, item.productoId, item.productoNombre, item.cantidad, item.precioUnitario, item.subtotal],
        );

        await client.query(
          `
            UPDATE productos
            SET cantidad = cantidad - $2
            WHERE id = $1
          `,
          [item.productoId, item.cantidad],
        );
      }

      if (customer) {
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
              customer.id,
              saleId,
              item.productoId,
              item.productoNombre,
              item.cantidad,
              item.precioUnitario,
              itemNetTotals[index],
              itemPayments[index],
              fechaVenta,
              notesForClientSale(notas),
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
        if (detail.producto_id) {
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
      SELECT id, descuento, monto_pagado
      FROM ventas
      WHERE estado <> 'anulada'
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
      const discounts = distributeAmountAcrossItems(Number(sale.descuento || 0), subtotals);
      const netTotals = subtotals.map((subtotal, index) => roundToTwo(subtotal - discounts[index]));
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

function roundToTwo(value) {
  return Number(value.toFixed(2));
}

function distributeAmountAcrossItems(amount, bases) {
  const safeAmount = roundToTwo(amount);
  const totalBase = bases.reduce((accumulator, value) => accumulator + value, 0);

  if (totalBase <= 0) {
    return bases.map(() => 0);
  }

  const distributed = bases.map((base) => roundToTwo((safeAmount * base) / totalBase));
  const assigned = roundToTwo(distributed.reduce((accumulator, value) => accumulator + value, 0));
  const difference = roundToTwo(safeAmount - assigned);

  if (difference !== 0 && distributed.length) {
    distributed[distributed.length - 1] = roundToTwo(distributed[distributed.length - 1] + difference);
  }

  return distributed;
}

module.exports = new SaleModel();
