const pool = require('../config/db');
const saleModel = require('./sale.model');
const { getDateOnlyString } = require('../utils/date.util');

function roundToTwo(value) {
  return Number(Number(value || 0).toFixed(2));
}

class OrderModel {
  mapOrder(row) {
    const montoTotal = Number(row.monto_total || 0);
    const montoEntregado = Number(row.monto_entregado || 0);

    return {
      id: row.id,
      tipo: row.tipo || 'proveedor',
      estado: row.estado || 'registrado',
      usuarioId: row.usuario_id,
      usuarioNombre: row.usuario_nombre,
      fechaPedido: row.fecha_pedido,
      fechaEvento: row.fecha_evento,
      fechaEntrega: row.fecha_entrega,
      clienteId: row.cliente_id,
      clienteNombre: row.cliente_nombre,
      clienteTelefono: row.cliente_telefono,
      agasajadoNombre: row.agasajado_nombre,
      edadAgasajado: row.edad_agasajado !== null ? Number(row.edad_agasajado) : null,
      tematica: row.tematica,
      mostrarDatosAgasajado: Boolean(row.mostrar_datos_agasajado),
      metodoPago: row.metodo_pago,
      ventaId: row.venta_id,
      notas: row.notas,
      cantidadItems: Number(row.cantidad_items || 0),
      cantidadLineas: Number(row.cantidad_lineas || 0),
      montoTotal,
      montoEntregado,
      saldoPendiente: Number(row.saldo_pendiente ?? Math.max(montoTotal - montoEntregado, 0)),
    };
  }

  mapOrderItem(row) {
    const cantidad = Number(row.cantidad || 0);
    const costoUnitario = Number(row.costo_unitario || 0);

    return {
      id: row.id,
      pedidoId: row.pedido_id,
      productoId: row.producto_id,
      productoNombre: row.producto_nombre,
      descripcion: row.descripcion,
      cantidad,
      costoUnitario,
      subtotal: Number(row.subtotal || cantidad * costoUnitario),
      stockAnterior: Number(row.stock_anterior || 0),
      stockActual: Number(row.stock_actual || 0),
    };
  }

  async ensureOrdersTables() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        tipo VARCHAR(20) NOT NULL DEFAULT 'proveedor',
        estado VARCHAR(20) NOT NULL DEFAULT 'registrado',
        fecha_pedido TIMESTAMP NOT NULL DEFAULT NOW(),
        fecha_evento TIMESTAMP,
        fecha_entrega TIMESTAMP,
        cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        cliente_nombre VARCHAR(150),
        cliente_telefono VARCHAR(50),
        agasajado_nombre VARCHAR(150),
        edad_agasajado INTEGER,
        tematica VARCHAR(150),
        mostrar_datos_agasajado BOOLEAN NOT NULL DEFAULT FALSE,
        monto_entregado NUMERIC(12, 2) NOT NULL DEFAULT 0,
        saldo_pendiente NUMERIC(12, 2) NOT NULL DEFAULT 0,
        metodo_pago VARCHAR(50),
        venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL,
        notas TEXT,
        fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
        fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pedido_detalles (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
        producto_nombre VARCHAR(250) NOT NULL,
        descripcion TEXT,
        cantidad INTEGER NOT NULL DEFAULT 1,
        costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
        stock_anterior INTEGER NOT NULL DEFAULT 0,
        stock_actual INTEGER NOT NULL DEFAULT 0
      )
    `);

    await pool.query(`
      ALTER TABLE pedidos
      ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'proveedor',
      ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'registrado',
      ADD COLUMN IF NOT EXISTS fecha_evento TIMESTAMP,
      ADD COLUMN IF NOT EXISTS fecha_entrega TIMESTAMP,
      ADD COLUMN IF NOT EXISTS cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS cliente_nombre VARCHAR(150),
      ADD COLUMN IF NOT EXISTS cliente_telefono VARCHAR(50),
      ADD COLUMN IF NOT EXISTS agasajado_nombre VARCHAR(150),
      ADD COLUMN IF NOT EXISTS edad_agasajado INTEGER,
      ADD COLUMN IF NOT EXISTS tematica VARCHAR(150),
      ADD COLUMN IF NOT EXISTS mostrar_datos_agasajado BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS monto_entregado NUMERIC(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(12, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50),
      ADD COLUMN IF NOT EXISTS venta_id INTEGER REFERENCES ventas(id) ON DELETE SET NULL
    `);

    await pool.query(`
      ALTER TABLE pedido_detalles
      ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(12,2) NOT NULL DEFAULT 0
    `);

    await pool.query(`
      ALTER TABLE pedido_detalles
      ADD COLUMN IF NOT EXISTS descripcion TEXT
    `);

    await pool.query(`
      ALTER TABLE pedido_detalles
      ALTER COLUMN producto_nombre TYPE VARCHAR(250)
    `);

    await pool.query(`
      UPDATE pedidos
      SET
        tipo = COALESCE(tipo, 'proveedor'),
        estado = CASE
          WHEN COALESCE(tipo, 'proveedor') = 'cliente' THEN COALESCE(NULLIF(estado, ''), 'pendiente')
          ELSE COALESCE(NULLIF(estado, ''), 'registrado')
        END,
        saldo_pendiente = GREATEST(
          COALESCE((
            SELECT SUM(pd.cantidad * pd.costo_unitario)
            FROM pedido_detalles pd
            WHERE pd.pedido_id = pedidos.id
          ), 0) - COALESCE(monto_entregado, 0),
          0
        )
      WHERE tipo IS NULL
         OR estado IS NULL
         OR saldo_pendiente IS NULL
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pedidos_usuario_id
      ON pedidos(usuario_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_pedido_detalles_pedido_id
      ON pedido_detalles(pedido_id)
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion_pedidos()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.fecha_actualizacion = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_actualizar_pedidos ON pedidos
    `);
    await pool.query(`
      CREATE TRIGGER trigger_actualizar_pedidos
      BEFORE UPDATE ON pedidos
      FOR EACH ROW
      EXECUTE FUNCTION actualizar_fecha_actualizacion_pedidos()
    `);
  }

  buildListQuery() {
    return `
      SELECT
        p.id,
        p.usuario_id,
        u.nombre AS usuario_nombre,
        p.tipo,
        p.estado,
        p.fecha_pedido,
        p.fecha_evento,
        p.fecha_entrega,
        p.cliente_id,
        p.cliente_nombre,
        p.cliente_telefono,
        p.agasajado_nombre,
        p.edad_agasajado,
        p.tematica,
        p.mostrar_datos_agasajado,
        p.monto_entregado,
        p.saldo_pendiente,
        p.metodo_pago,
        p.venta_id,
        p.notas,
        COALESCE(SUM(pd.cantidad), 0)::int AS cantidad_items,
        COUNT(pd.id)::int AS cantidad_lineas,
        COALESCE(SUM(pd.cantidad * pd.costo_unitario), 0)::numeric(12,2) AS monto_total
      FROM pedidos p
      LEFT JOIN usuarios u ON u.id = p.usuario_id
      LEFT JOIN pedido_detalles pd ON pd.pedido_id = p.id
    `;
  }

  async listOrders(search = '', pagination = { limit: 20, offset: 0 }, status = 'all') {
    const normalizedSearch = `%${search.trim().toLowerCase()}%`;
    const allowedStatuses = ['registrado', 'en_progreso', 'pendiente', 'hecho', 'entregado'];
    const normalizedStatus = allowedStatuses.includes(status) ? status : 'all';
    const filtersQuery = `
      WHERE
        (
          $1 = '%%'
          OR CAST(p.id AS TEXT) LIKE REPLACE($1, '%', '')
          OR LOWER(COALESCE(u.nombre, '')) LIKE $1
          OR LOWER(COALESCE(p.notas, '')) LIKE $1
          OR LOWER(COALESCE(pd.producto_nombre, '')) LIKE $1
          OR LOWER(COALESCE(p.cliente_nombre, '')) LIKE $1
          OR LOWER(COALESCE(p.agasajado_nombre, '')) LIKE $1
          OR LOWER(COALESCE(p.tematica, '')) LIKE $1
        )
        AND ($2 = 'all' OR p.estado = $2)
    `;

    const [{ rows }, countResult] = await Promise.all([
      pool.query(
      `
        ${this.buildListQuery()}
        ${filtersQuery}
        GROUP BY p.id, u.nombre
        ORDER BY p.fecha_pedido DESC, p.id DESC
        LIMIT $3
        OFFSET $4
      `,
      [normalizedSearch, normalizedStatus, pagination.limit, pagination.offset],
    ),
      pool.query(
        `
          SELECT COUNT(DISTINCT p.id)::int AS total
          FROM pedidos p
          LEFT JOIN usuarios u ON u.id = p.usuario_id
          LEFT JOIN pedido_detalles pd ON pd.pedido_id = p.id
          ${filtersQuery}
        `,
        [normalizedSearch, normalizedStatus],
      ),
    ]);

    return {
      orders: rows.map((row) => this.mapOrder(row)),
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  async findById(id) {
    const orderResult = await pool.query(
      `
        ${this.buildListQuery()}
        WHERE p.id = $1
        GROUP BY p.id, u.nombre
        LIMIT 1
      `,
      [id],
    );

    if (!orderResult.rows[0]) {
      return null;
    }

    const itemsResult = await pool.query(
      `
        SELECT
          id,
          pedido_id,
          producto_id,
          producto_nombre,
          descripcion,
          cantidad,
          costo_unitario,
          (cantidad * costo_unitario)::numeric(12,2) AS subtotal,
          stock_anterior,
          stock_actual
        FROM pedido_detalles
        WHERE pedido_id = $1
        ORDER BY id DESC
      `,
      [id],
    );

    return {
      ...this.mapOrder(orderResult.rows[0]),
      items: itemsResult.rows.map((row) => this.mapOrderItem(row)),
    };
  }

  async createOrder(payload) {
    return payload.tipo === 'cliente'
      ? this.createCustomerOrder(payload)
      : this.createSupplierOrder(payload);
  }

  async buildCustomerItemSnapshots(client, items) {
    const itemSnapshots = [];

    for (const item of items) {
      if (item.productoId) {
        const productResult = await client.query(
          `
            SELECT id, nombre
            FROM productos
            WHERE id = $1
            LIMIT 1
          `,
          [item.productoId],
        );

        const product = productResult.rows[0];

        if (!product) {
          return { error: 'PRODUCT_NOT_FOUND' };
        }

        itemSnapshots.push({
          productoId: product.id,
          productoNombre: product.nombre,
          descripcion: item.descripcion || '',
          cantidad: Number(item.cantidad),
          costoUnitario: Number(item.costoUnitario),
        });
        continue;
      }

      itemSnapshots.push({
        productoId: null,
        productoNombre: item.productoNombre,
        descripcion: item.descripcion || '',
        cantidad: Number(item.cantidad),
        costoUnitario: Number(item.costoUnitario),
      });
    }

    return { itemSnapshots };
  }

  async ensureUserExists(client, userId) {
    const userResult = await client.query(
      'SELECT id FROM usuarios WHERE id = $1 LIMIT 1',
      [userId],
    );

    return userResult.rows[0] ? { ok: true } : { error: 'USER_NOT_FOUND' };
  }

  async resolveExistingClientId(client, clientId) {
    if (!clientId) {
      return null;
    }

    const clientResult = await client.query(
      'SELECT id FROM clientes WHERE id = $1 LIMIT 1',
      [clientId],
    );

    return clientResult.rows[0] ? Number(clientResult.rows[0].id) : null;
  }

  buildOrderItemSnapshots(items) {
    return items.map((item) => ({
      productoId: item.productoId || null,
      productoNombre: item.productoNombre,
      descripcion: item.descripcion || '',
      cantidad: Number(item.cantidad),
      costoUnitario: Number(item.costoUnitario),
    }));
  }

  async upsertOrderDetails(client, orderId, itemSnapshots) {
    await client.query('DELETE FROM pedido_detalles WHERE pedido_id = $1', [orderId]);

    for (const item of itemSnapshots) {
      await client.query(
        `
          INSERT INTO pedido_detalles (
            pedido_id,
            producto_id,
            producto_nombre,
            descripcion,
            cantidad,
            costo_unitario,
            stock_anterior,
            stock_actual
          )
          VALUES ($1, $2, $3, $4, $5, $6, 0, 0)
        `,
        [
          orderId,
          item.productoId,
          item.productoNombre,
          item.descripcion || null,
          item.cantidad,
          item.costoUnitario,
        ],
      );
    }
  }

  async saveDraftOrder(payload) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userStatus = await this.ensureUserExists(client, payload.userId);
      if (userStatus.error) {
        await client.query('ROLLBACK');
        return userStatus;
      }

      const resolvedClientId = payload.tipo === 'cliente' && payload.clientId
        ? await this.resolveExistingClientId(client, Number(payload.clientId))
        : null;

      if (payload.orderId) {
        const existingOrderResult = await client.query(
          'SELECT id, estado FROM pedidos WHERE id = $1 LIMIT 1 FOR UPDATE',
          [payload.orderId],
        );

        if (!existingOrderResult.rows[0]) {
          await client.query('ROLLBACK');
          return { error: 'NOT_FOUND' };
        }

        if (existingOrderResult.rows[0].estado !== 'en_progreso') {
          await client.query('ROLLBACK');
          return { error: 'INVALID_STATE' };
        }
      }

      const itemSnapshots = this.buildOrderItemSnapshots(payload.items);
      const montoTotal = roundToTwo(
        itemSnapshots.reduce(
          (accumulator, item) => accumulator + item.cantidad * item.costoUnitario,
          0,
        ),
      );
      const safeMontoEntregado = roundToTwo(payload.tipo === 'cliente' ? payload.montoEntregado || 0 : 0);
      const saldoPendiente = roundToTwo(Math.max(montoTotal - safeMontoEntregado, 0));
      let resolvedOrderId = payload.orderId;

      if (resolvedOrderId) {
        await client.query(
          `
            UPDATE pedidos
            SET
              usuario_id = $2,
              tipo = $3,
              estado = 'en_progreso',
              fecha_pedido = $4,
              fecha_evento = $5,
              fecha_entrega = $6,
              cliente_id = $7,
              cliente_nombre = $8,
              cliente_telefono = $9,
              agasajado_nombre = $10,
              edad_agasajado = $11,
              tematica = $12,
              mostrar_datos_agasajado = $13,
              monto_entregado = $14,
              saldo_pendiente = $15,
              metodo_pago = NULL,
              venta_id = NULL,
              notas = $16
            WHERE id = $1
          `,
          [
            resolvedOrderId,
            payload.userId,
            payload.tipo,
            payload.fechaPedido,
            payload.tipo === 'cliente' ? payload.fechaEvento : null,
            payload.tipo === 'cliente' ? payload.fechaEntrega : null,
            resolvedClientId,
            payload.tipo === 'cliente' ? payload.clienteNombre || null : null,
            payload.tipo === 'cliente' ? payload.clienteTelefono || null : null,
            payload.tipo === 'cliente' ? payload.agasajadoNombre || null : null,
            payload.tipo === 'cliente' ? payload.edadAgasajado : null,
            payload.tipo === 'cliente' ? payload.tematica || null : null,
            payload.tipo === 'cliente' ? Boolean(payload.mostrarDatosAgasajado) : false,
            safeMontoEntregado,
            saldoPendiente,
            payload.notas || null,
          ],
        );
      } else {
        const orderResult = await client.query(
          `
            INSERT INTO pedidos (
              usuario_id,
              tipo,
              estado,
              fecha_pedido,
              fecha_evento,
              fecha_entrega,
              cliente_id,
              cliente_nombre,
              cliente_telefono,
              agasajado_nombre,
              edad_agasajado,
              tematica,
              mostrar_datos_agasajado,
              monto_entregado,
              saldo_pendiente,
              notas
            )
            VALUES ($1, $2, 'en_progreso', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id
          `,
          [
            payload.userId,
            payload.tipo,
            payload.fechaPedido,
            payload.tipo === 'cliente' ? payload.fechaEvento : null,
            payload.tipo === 'cliente' ? payload.fechaEntrega : null,
            resolvedClientId,
            payload.tipo === 'cliente' ? payload.clienteNombre || null : null,
            payload.tipo === 'cliente' ? payload.clienteTelefono || null : null,
            payload.tipo === 'cliente' ? payload.agasajadoNombre || null : null,
            payload.tipo === 'cliente' ? payload.edadAgasajado : null,
            payload.tipo === 'cliente' ? payload.tematica || null : null,
            payload.tipo === 'cliente' ? Boolean(payload.mostrarDatosAgasajado) : false,
            safeMontoEntregado,
            saldoPendiente,
            payload.notas || null,
          ],
        );
        resolvedOrderId = orderResult.rows[0].id;
      }

      await this.upsertOrderDetails(client, resolvedOrderId, itemSnapshots);

      await client.query('COMMIT');
      return { orderId: resolvedOrderId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async confirmDraftOrder({ orderId, userId }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userStatus = await this.ensureUserExists(client, userId);
      if (userStatus.error) {
        await client.query('ROLLBACK');
        return userStatus;
      }

      const orderResult = await client.query(
        `
          SELECT *
          FROM pedidos
          WHERE id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [orderId],
      );

      const order = orderResult.rows[0];

      if (!order) {
        await client.query('ROLLBACK');
        return { error: 'NOT_FOUND' };
      }

      if (order.estado !== 'en_progreso') {
        await client.query('ROLLBACK');
        return { error: 'INVALID_STATE' };
      }

      const detailsResult = await client.query(
        `
          SELECT producto_id, producto_nombre, descripcion, cantidad, costo_unitario
          FROM pedido_detalles
          WHERE pedido_id = $1
          ORDER BY id ASC
        `,
        [orderId],
      );

      const items = detailsResult.rows.map((item) => ({
        productoId: item.producto_id ? Number(item.producto_id) : null,
        productoNombre: item.producto_nombre,
        descripcion: item.descripcion || '',
        cantidad: Number(item.cantidad),
        costoUnitario: Number(item.costo_unitario),
      }));

      if (order.tipo === 'proveedor') {
        await client.query('DELETE FROM pedido_detalles WHERE pedido_id = $1', [orderId]);

        for (const item of items) {
          let productId = null;
          let productName = item.productoNombre;
          let stockAnterior = 0;
          let stockActual = 0;

          if (item.productoId) {
            const productResult = await client.query(
              `
                SELECT id, nombre, cantidad
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

            productId = product.id;
            productName = product.nombre;
            stockAnterior = Number(product.cantidad || 0);
            stockActual = stockAnterior + Number(item.cantidad);

            await client.query(
              `
                UPDATE productos
                SET cantidad = $2
                WHERE id = $1
              `,
              [product.id, stockActual],
            );
          }

          await client.query(
            `
              INSERT INTO pedido_detalles (
                pedido_id,
                producto_id,
                producto_nombre,
                descripcion,
                cantidad,
                costo_unitario,
                stock_anterior,
                stock_actual
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              orderId,
              productId,
              productName,
              item.descripcion || null,
              item.cantidad,
              item.costoUnitario,
              stockAnterior,
              stockActual,
            ],
          );
        }

        await client.query(
          `
            UPDATE pedidos
            SET
              usuario_id = $2,
              estado = 'registrado'
            WHERE id = $1
          `,
          [orderId, userId],
        );
      } else {
        const montoTotal = roundToTwo(
          items.reduce(
            (accumulator, item) => accumulator + item.cantidad * item.costoUnitario,
            0,
          ),
        );
        const safeMontoEntregado = roundToTwo(order.monto_entregado || 0);
        const saldoPendiente = roundToTwo(Math.max(montoTotal - safeMontoEntregado, 0));

        await client.query(
          `
            UPDATE pedidos
            SET
              usuario_id = $2,
              estado = 'pendiente',
              saldo_pendiente = $3
            WHERE id = $1
          `,
          [orderId, userId, saldoPendiente],
        );
      }

      await client.query('COMMIT');
      return { orderId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createSupplierOrder({ userId, fechaPedido, notas, items }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userStatus = await this.ensureUserExists(client, userId);

      if (userStatus.error) {
        await client.query('ROLLBACK');
        return userStatus;
      }

      const { rows: orderRows } = await client.query(
        `
          INSERT INTO pedidos (
            usuario_id,
            tipo,
            estado,
            fecha_pedido,
            notas
          )
          VALUES ($1, 'proveedor', 'registrado', $2, $3)
          RETURNING id
        `,
        [userId, fechaPedido, notas || null],
      );

      const orderId = orderRows[0].id;

      for (const item of items) {
        let productId = null;
        let productName = item.productoNombre;
        let stockAnterior = 0;
        let stockActual = 0;

        if (item.productoId) {
          const productResult = await client.query(
            `
              SELECT id, nombre, cantidad
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

          productId = product.id;
          productName = product.nombre;
          stockAnterior = Number(product.cantidad || 0);
          stockActual = stockAnterior + Number(item.cantidad);

          await client.query(
            `
              UPDATE productos
              SET cantidad = $2
              WHERE id = $1
            `,
            [product.id, stockActual],
          );
        }

        await client.query(
          `
            INSERT INTO pedido_detalles (
              pedido_id,
              producto_id,
              producto_nombre,
              descripcion,
              cantidad,
              costo_unitario,
              stock_anterior,
              stock_actual
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            orderId,
            productId,
            productName,
            item.descripcion || null,
            item.cantidad,
            item.costoUnitario,
            stockAnterior,
            stockActual,
          ],
        );
      }

      await client.query('COMMIT');
      return { orderId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createCustomerOrder({
    userId,
    fechaPedido,
    fechaEvento,
    fechaEntrega,
    clientId,
    clienteNombre,
    clienteTelefono,
    agasajadoNombre,
    edadAgasajado,
    tematica,
    mostrarDatosAgasajado = false,
    montoEntregado = 0,
    notas,
    items,
  }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userStatus = await this.ensureUserExists(client, userId);

      if (userStatus.error) {
        await client.query('ROLLBACK');
        return userStatus;
      }

      const resolvedClientId = clientId
        ? await this.resolveExistingClientId(client, Number(clientId))
        : null;

      const snapshotResult = await this.buildCustomerItemSnapshots(client, items);

      if (snapshotResult.error) {
        await client.query('ROLLBACK');
        return snapshotResult;
      }

      const itemSnapshots = snapshotResult.itemSnapshots;

      const montoTotal = roundToTwo(
        itemSnapshots.reduce(
          (accumulator, item) => accumulator + item.cantidad * item.costoUnitario,
          0,
        ),
      );
      const safeMontoEntregado = roundToTwo(montoEntregado);
      const saldoPendiente = roundToTwo(Math.max(montoTotal - safeMontoEntregado, 0));

      const { rows: orderRows } = await client.query(
        `
          INSERT INTO pedidos (
            usuario_id,
            tipo,
            estado,
            fecha_pedido,
            fecha_evento,
            fecha_entrega,
            cliente_id,
            cliente_nombre,
            cliente_telefono,
            agasajado_nombre,
            edad_agasajado,
            tematica,
            mostrar_datos_agasajado,
            monto_entregado,
            saldo_pendiente,
            notas
          )
          VALUES ($1, 'cliente', 'pendiente', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING id
        `,
        [
          userId,
          fechaPedido,
          fechaEvento,
          fechaEntrega,
          resolvedClientId,
          clienteNombre || null,
          clienteTelefono || null,
          agasajadoNombre || null,
          edadAgasajado,
          tematica || null,
          Boolean(mostrarDatosAgasajado),
          safeMontoEntregado,
          saldoPendiente,
          notas || null,
        ],
      );

      const orderId = orderRows[0].id;

      for (const item of itemSnapshots) {
        await client.query(
          `
            INSERT INTO pedido_detalles (
              pedido_id,
              producto_id,
              producto_nombre,
              descripcion,
              cantidad,
              costo_unitario,
              stock_anterior,
              stock_actual
            )
            VALUES ($1, $2, $3, $4, $5, $6, 0, 0)
          `,
          [
            orderId,
            item.productoId,
            item.productoNombre,
            item.descripcion || null,
            item.cantidad,
            item.costoUnitario,
          ],
        );
      }

      await client.query('COMMIT');
      return { orderId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePendingCustomerOrder({
    orderId,
    userId,
    fechaPedido,
    fechaEvento,
    fechaEntrega,
    clientId,
    clienteNombre,
    clienteTelefono,
    agasajadoNombre,
    edadAgasajado,
    tematica,
    mostrarDatosAgasajado = false,
    montoEntregado = 0,
    notas,
    items,
  }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userStatus = await this.ensureUserExists(client, userId);

      if (userStatus.error) {
        await client.query('ROLLBACK');
        return userStatus;
      }

      const resolvedClientId = clientId
        ? await this.resolveExistingClientId(client, Number(clientId))
        : null;

      const existingOrderResult = await client.query(
        `
          SELECT id, tipo, estado, venta_id
          FROM pedidos
          WHERE id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [orderId],
      );

      const existingOrder = existingOrderResult.rows[0];

      if (!existingOrder) {
        await client.query('ROLLBACK');
        return { error: 'NOT_FOUND' };
      }

      if (existingOrder.tipo !== 'cliente') {
        await client.query('ROLLBACK');
        return { error: 'INVALID_TYPE' };
      }

      if (!['pendiente', 'hecho'].includes(existingOrder.estado) || existingOrder.venta_id) {
        await client.query('ROLLBACK');
        return { error: 'INVALID_STATE' };
      }

      const snapshotResult = await this.buildCustomerItemSnapshots(client, items);

      if (snapshotResult.error) {
        await client.query('ROLLBACK');
        return snapshotResult;
      }

      const itemSnapshots = snapshotResult.itemSnapshots;
      const montoTotal = roundToTwo(
        itemSnapshots.reduce(
          (accumulator, item) => accumulator + item.cantidad * item.costoUnitario,
          0,
        ),
      );
      const safeMontoEntregado = roundToTwo(montoEntregado);
      const saldoPendiente = roundToTwo(Math.max(montoTotal - safeMontoEntregado, 0));

      await client.query(
        `
          UPDATE pedidos
          SET
            usuario_id = $2,
            fecha_pedido = $3,
            fecha_evento = $4,
            fecha_entrega = $5,
            cliente_id = $6,
            cliente_nombre = $7,
            cliente_telefono = $8,
            agasajado_nombre = $9,
            edad_agasajado = $10,
            tematica = $11,
            mostrar_datos_agasajado = $12,
            monto_entregado = $13,
            saldo_pendiente = $14,
            notas = $15
          WHERE id = $1
        `,
        [
          orderId,
          userId,
          fechaPedido,
          fechaEvento,
          fechaEntrega,
          resolvedClientId,
          clienteNombre || null,
          clienteTelefono || null,
          agasajadoNombre || null,
          edadAgasajado,
          tematica || null,
          Boolean(mostrarDatosAgasajado),
          safeMontoEntregado,
          saldoPendiente,
          notas || null,
        ],
      );

      await this.upsertOrderDetails(client, orderId, itemSnapshots);

      await client.query('COMMIT');
      return { orderId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateCustomerOrder({
    orderId,
    userId,
    estado,
    montoEntregado,
    metodoPago,
  }) {
    const dbClient = await pool.connect();

    try {
      await dbClient.query('BEGIN');

      const orderResult = await dbClient.query(
        `
          SELECT
            p.*,
            COALESCE((
              SELECT SUM(pd.cantidad * pd.costo_unitario)
              FROM pedido_detalles pd
              WHERE pd.pedido_id = p.id
            ), 0)::numeric(12,2) AS monto_total
          FROM pedidos p
          WHERE p.id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [orderId],
      );

      const order = orderResult.rows[0];

      if (!order) {
        await dbClient.query('ROLLBACK');
        return { error: 'NOT_FOUND' };
      }

      if (order.tipo !== 'cliente') {
        await dbClient.query('ROLLBACK');
        return { error: 'INVALID_TYPE' };
      }

      const safeMontoEntregado = roundToTwo(
        montoEntregado !== undefined ? montoEntregado : order.monto_entregado,
      );
      const montoTotal = roundToTwo(order.monto_total);
      const saldoPendiente = roundToTwo(Math.max(montoTotal - safeMontoEntregado, 0));
      const nextEstado = estado || order.estado;
      const allowedTransitions = {
        pendiente: ['pendiente', 'hecho'],
        hecho: ['hecho', 'entregado'],
        entregado: ['entregado'],
      };

      if (safeMontoEntregado - montoTotal > 0.01) {
        await dbClient.query('ROLLBACK');
        return { error: 'EXCESS_DELIVERY_AMOUNT' };
      }

      if (
        allowedTransitions[order.estado] &&
        !allowedTransitions[order.estado].includes(nextEstado)
      ) {
        await dbClient.query('ROLLBACK');
        return { error: 'INVALID_STATUS_TRANSITION' };
      }

      if (nextEstado === 'entregado' && saldoPendiente > 0) {
        await dbClient.query('ROLLBACK');
        return { error: 'BALANCE_PENDING', saldoPendiente };
      }

      if (order.estado === 'entregado' && nextEstado === 'entregado') {
        await dbClient.query('ROLLBACK');
        return { error: 'ALREADY_DELIVERED' };
      }

      let ventaId = order.venta_id;

      if (nextEstado === 'entregado' && !ventaId) {
        const detailsResult = await dbClient.query(
          `
            SELECT producto_id, producto_nombre, descripcion, cantidad, costo_unitario
            FROM pedido_detalles
            WHERE pedido_id = $1
            ORDER BY id ASC
          `,
          [orderId],
        );

        const items = detailsResult.rows.map((item) => ({
          productoId: item.producto_id ? Number(item.producto_id) : null,
          productoNombre: item.producto_nombre,
          descripcion: item.descripcion || '',
          cantidad: Number(item.cantidad),
          precioUnitario: Number(item.costo_unitario),
        }));

        const saleClientId = order.cliente_id
          ? await this.resolveExistingClientId(dbClient, Number(order.cliente_id))
          : null;

        const saleResult = await saleModel.createSaleWithClient(dbClient, {
          clientId: saleClientId,
          sellerId: userId,
          descuento: 0,
          montoPagado: montoTotal,
          pagos: [{ metodo: metodoPago, monto: montoTotal }],
          notas: `Entrega de pedido de cliente #${orderId} - ${order.agasajado_nombre || order.cliente_nombre || ''}`.trim(),
          fechaVenta: getDateOnlyString(order.fecha_entrega || new Date()),
          items,
        });

        if (saleResult.error) {
          await dbClient.query('ROLLBACK');
          return saleResult;
        }

        ventaId = saleResult.saleId;
      }

      await dbClient.query(
        `
          UPDATE pedidos
          SET
            estado = $2,
            monto_entregado = $3,
            saldo_pendiente = $4,
            metodo_pago = $5,
            venta_id = $6
          WHERE id = $1
        `,
        [
          orderId,
          nextEstado,
          safeMontoEntregado,
          saldoPendiente,
          metodoPago || order.metodo_pago || null,
          ventaId || null,
        ],
      );

      await dbClient.query('COMMIT');
      return { orderId, saleId: ventaId || null };
    } catch (error) {
      await dbClient.query('ROLLBACK');
      throw error;
    } finally {
      dbClient.release();
    }
  }

  async deleteOrder(id) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `
          SELECT id, tipo, estado, venta_id
          FROM pedidos
          WHERE id = $1
          LIMIT 1
          FOR UPDATE
        `,
        [id],
      );

      const order = orderResult.rows[0];

      if (!order) {
        await client.query('ROLLBACK');
        return { error: 'NOT_FOUND' };
      }

      if (order.venta_id) {
        await client.query('ROLLBACK');
        return { error: 'HAS_LINKED_SALE' };
      }

      if (order.estado === 'entregado') {
        await client.query('ROLLBACK');
        return { error: 'INVALID_STATE' };
      }

      const detailsResult = await client.query(
        `
          SELECT producto_id, cantidad
          FROM pedido_detalles
          WHERE pedido_id = $1
        `,
        [id],
      );

      if (order.tipo === 'proveedor' && order.estado === 'registrado') {
        for (const detail of detailsResult.rows) {
          if (detail.producto_id) {
            await client.query(
              `
                UPDATE productos
                SET cantidad = GREATEST(cantidad - $2, 0)
                WHERE id = $1
              `,
              [detail.producto_id, Number(detail.cantidad || 0)],
            );
          }
        }
      }

      await client.query('DELETE FROM pedidos WHERE id = $1', [id]);

      await client.query('COMMIT');
      return { deleted: true, order };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new OrderModel();
