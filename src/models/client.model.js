const pool = require('../config/db');

class ClientModel {
  mapClient(client) {
    return {
      id: client.id,
      nombre: client.nombre,
      telefono: client.telefono,
      email: client.email,
      direccion: client.direccion,
      documento: client.documento,
      notas: client.notas,
      limiteCredito: Number(client.limite_credito || 0),
      fechaCreacion: client.fecha_creacion,
      fechaActualizacion: client.fecha_actualizacion,
      resumen: {
        cantidadCompras: Number(client.cantidad_compras || 0),
        gastoTotal: Number(client.gasto_total || 0),
        deudaTotal: Number(client.deuda_total || 0),
        productosDistintos: Number(client.productos_distintos || 0),
        ultimaCompra: client.ultima_compra,
        estadoCuenta: Number(client.deuda_total || 0) > 0 ? 'debe' : 'al_dia',
      },
    };
  }

  mapPurchase(purchase) {
    const total = Number(purchase.total_compra || 0);
    const paid = Number(purchase.monto_pagado || 0);

    return {
      id: purchase.id,
      clienteId: purchase.cliente_id,
      productoId: purchase.producto_id,
      productoNombre: purchase.producto_nombre,
      cantidad: Number(purchase.cantidad),
      precioUnitario: Number(purchase.precio_unitario),
      totalCompra: total,
      montoPagado: paid,
      deudaPendiente: Math.max(total - paid, 0),
      fechaCompra: purchase.fecha_compra,
      notas: purchase.notas,
      estadoCuenta: total - paid > 0 ? 'debe' : 'al_dia',
    };
  }

  async ensureClientsTables() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        telefono VARCHAR(50),
        email VARCHAR(150),
        direccion TEXT,
        documento VARCHAR(50),
        notas TEXT,
        limite_credito NUMERIC(12, 2) NOT NULL DEFAULT 0,
        fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
        fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cliente_compras (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
        venta_id INTEGER,
        producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
        producto_nombre VARCHAR(150) NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1,
        precio_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0,
        total_compra NUMERIC(12, 2),
        monto_pagado NUMERIC(12, 2) NOT NULL DEFAULT 0,
        fecha_compra TIMESTAMP NOT NULL DEFAULT NOW(),
        notas TEXT,
        fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
        fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      ALTER TABLE cliente_compras
      ADD COLUMN IF NOT EXISTS venta_id INTEGER
    `);

    await pool.query(`
      ALTER TABLE cliente_compras
      ADD COLUMN IF NOT EXISTS total_compra NUMERIC(12, 2)
    `);

    await pool.query(`
      UPDATE cliente_compras
      SET total_compra = cantidad * precio_unitario
      WHERE total_compra IS NULL
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cliente_compras_cliente_id
      ON cliente_compras(cliente_id)
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion_clientes()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.fecha_actualizacion = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_actualizar_clientes ON clientes
    `);
    await pool.query(`
      CREATE TRIGGER trigger_actualizar_clientes
      BEFORE UPDATE ON clientes
      FOR EACH ROW
      EXECUTE FUNCTION actualizar_fecha_actualizacion_clientes()
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion_cliente_compras()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.fecha_actualizacion = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_actualizar_cliente_compras ON cliente_compras
    `);
    await pool.query(`
      CREATE TRIGGER trigger_actualizar_cliente_compras
      BEFORE UPDATE ON cliente_compras
      FOR EACH ROW
      EXECUTE FUNCTION actualizar_fecha_actualizacion_cliente_compras()
    `);
  }

  buildSummarySubquery() {
    return `
      SELECT
        cliente_id,
        COUNT(*)::int AS cantidad_compras,
        COALESCE(SUM(COALESCE(total_compra, cantidad * precio_unitario)), 0)::numeric(12, 2) AS gasto_total,
        COALESCE(SUM(GREATEST(COALESCE(total_compra, cantidad * precio_unitario) - monto_pagado, 0)), 0)::numeric(12, 2) AS deuda_total,
        COUNT(DISTINCT COALESCE(producto_id::text, producto_nombre))::int AS productos_distintos,
        MAX(fecha_compra) AS ultima_compra
      FROM cliente_compras
      GROUP BY cliente_id
    `;
  }

  async listClients(search = '', debtStatus = 'all', pagination = { limit: 20, offset: 0 }) {
    const normalizedSearch = `%${search.trim().toLowerCase()}%`;
    const normalizedDebtStatus = debtStatus.trim().toLowerCase();
    const filtersQuery = `
      WHERE
        (
          $1 = '%%'
          OR LOWER(c.nombre) LIKE $1
          OR LOWER(COALESCE(c.telefono, '')) LIKE $1
          OR LOWER(COALESCE(c.email, '')) LIKE $1
          OR LOWER(COALESCE(c.documento, '')) LIKE $1
        )
        AND (
          $2 = 'all'
          OR ($2 = 'with_debt' AND COALESCE(r.deuda_total, 0) > 0)
          OR ($2 = 'up_to_date' AND COALESCE(r.deuda_total, 0) <= 0)
        )
    `;

    const [{ rows }, countResult] = await Promise.all([
      pool.query(
      `
        SELECT
          c.id,
          c.nombre,
          c.telefono,
          c.email,
          c.direccion,
          c.documento,
          c.notas,
          c.limite_credito,
          c.fecha_creacion,
          c.fecha_actualizacion,
          COALESCE(r.cantidad_compras, 0) AS cantidad_compras,
          COALESCE(r.gasto_total, 0) AS gasto_total,
          COALESCE(r.deuda_total, 0) AS deuda_total,
          COALESCE(r.productos_distintos, 0) AS productos_distintos,
          r.ultima_compra
        FROM clientes c
        LEFT JOIN (${this.buildSummarySubquery()}) r ON r.cliente_id = c.id
        ${filtersQuery}
        ORDER BY COALESCE(r.deuda_total, 0) DESC, c.nombre ASC
        LIMIT $3
        OFFSET $4
      `,
      [normalizedSearch, normalizedDebtStatus, pagination.limit, pagination.offset],
    ),
      pool.query(
        `
          SELECT COUNT(*)::int AS total
          FROM clientes c
          LEFT JOIN (${this.buildSummarySubquery()}) r ON r.cliente_id = c.id
          ${filtersQuery}
        `,
        [normalizedSearch, normalizedDebtStatus],
      ),
    ]);

    return {
      clients: rows.map((row) => this.mapClient(row)),
      total: Number(countResult.rows[0]?.total || 0),
    };
  }

  async findById(id) {
    const clientResult = await pool.query(
      `
        SELECT
          c.id,
          c.nombre,
          c.telefono,
          c.email,
          c.direccion,
          c.documento,
          c.notas,
          c.limite_credito,
          c.fecha_creacion,
          c.fecha_actualizacion,
          COALESCE(r.cantidad_compras, 0) AS cantidad_compras,
          COALESCE(r.gasto_total, 0) AS gasto_total,
          COALESCE(r.deuda_total, 0) AS deuda_total,
          COALESCE(r.productos_distintos, 0) AS productos_distintos,
          r.ultima_compra
        FROM clientes c
        LEFT JOIN (${this.buildSummarySubquery()}) r ON r.cliente_id = c.id
        WHERE c.id = $1
        LIMIT 1
      `,
      [id],
    );

    if (!clientResult.rows[0]) {
      return null;
    }

    const purchasesResult = await pool.query(
      `
        SELECT
          id,
          cliente_id,
          producto_id,
          producto_nombre,
          cantidad,
          precio_unitario,
          COALESCE(total_compra, cantidad * precio_unitario)::numeric(12, 2) AS total_compra,
          monto_pagado,
          fecha_compra,
          notas,
          fecha_creacion,
          fecha_actualizacion
        FROM cliente_compras
        WHERE cliente_id = $1
        ORDER BY fecha_compra DESC, id DESC
      `,
      [id],
    );

    return {
      ...this.mapClient(clientResult.rows[0]),
      compras: purchasesResult.rows.map((row) => this.mapPurchase(row)),
    };
  }

  async createClient({ nombre, telefono, email, direccion, documento, notas, limiteCredito }) {
    const { rows } = await pool.query(
      `
        INSERT INTO clientes (nombre, telefono, email, direccion, documento, notas, limite_credito)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          nombre,
          telefono,
          email,
          direccion,
          documento,
          notas,
          limite_credito,
          fecha_creacion,
          fecha_actualizacion,
          0 AS cantidad_compras,
          0 AS gasto_total,
          0 AS deuda_total,
          0 AS productos_distintos,
          NULL AS ultima_compra
      `,
      [nombre, telefono || null, email || null, direccion || null, documento || null, notas || null, limiteCredito],
    );

    return this.mapClient(rows[0]);
  }

  async updateClient(id, { nombre, telefono, email, direccion, documento, notas, limiteCredito }) {
    const { rows } = await pool.query(
      `
        UPDATE clientes
        SET
          nombre = $2,
          telefono = $3,
          email = $4,
          direccion = $5,
          documento = $6,
          notas = $7,
          limite_credito = $8
        WHERE id = $1
        RETURNING id
      `,
      [id, nombre, telefono || null, email || null, direccion || null, documento || null, notas || null, limiteCredito],
    );

    if (!rows[0]) {
      return null;
    }

    return this.findById(id);
  }

  async deleteClient(id) {
    const { rowCount } = await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
    return rowCount > 0;
  }

  async resolveProductSnapshot(productId, fallbackName) {
    if (!productId) {
      return fallbackName.trim();
    }

    const { rows } = await pool.query(
      'SELECT id, nombre FROM productos WHERE id = $1 LIMIT 1',
      [productId],
    );

    if (!rows[0]) {
      return null;
    }

    return rows[0].nombre;
  }

  async createPurchase(clientId, purchase) {
    const productName = await this.resolveProductSnapshot(purchase.productoId, purchase.productoNombre);

    if (!productName) {
      return { error: 'PRODUCT_NOT_FOUND' };
    }

    const { rows } = await pool.query(
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
        RETURNING
          id,
          cliente_id,
          producto_id,
          producto_nombre,
          cantidad,
          precio_unitario,
          COALESCE(total_compra, cantidad * precio_unitario)::numeric(12, 2) AS total_compra,
          monto_pagado,
          fecha_compra,
          notas
      `,
      [
        clientId,
        purchase.ventaId || null,
        purchase.productoId || null,
        productName,
        purchase.cantidad,
        purchase.precioUnitario,
        purchase.totalCompra || Number(purchase.cantidad) * Number(purchase.precioUnitario),
        purchase.montoPagado,
        purchase.fechaCompra,
        purchase.notas || null,
      ],
    );

    return { purchase: this.mapPurchase(rows[0]) };
  }

  async updatePurchase(clientId, purchaseId, purchase) {
    const existingPurchase = await pool.query(
      'SELECT id FROM cliente_compras WHERE id = $1 AND cliente_id = $2 LIMIT 1',
      [purchaseId, clientId],
    );

    if (!existingPurchase.rows[0]) {
      return { error: 'NOT_FOUND' };
    }

    const productName = await this.resolveProductSnapshot(purchase.productoId, purchase.productoNombre);

    if (!productName) {
      return { error: 'PRODUCT_NOT_FOUND' };
    }

    const { rows } = await pool.query(
      `
        UPDATE cliente_compras
        SET
          producto_id = $3,
          producto_nombre = $4,
          cantidad = $5,
          precio_unitario = $6,
          total_compra = $7,
          monto_pagado = $8,
          fecha_compra = $9,
          notas = $10
        WHERE id = $1 AND cliente_id = $2
        RETURNING
          id,
          cliente_id,
          producto_id,
          producto_nombre,
          cantidad,
          precio_unitario,
          COALESCE(total_compra, cantidad * precio_unitario)::numeric(12, 2) AS total_compra,
          monto_pagado,
          fecha_compra,
          notas
      `,
      [
        purchaseId,
        clientId,
        purchase.productoId || null,
        productName,
        purchase.cantidad,
        purchase.precioUnitario,
        purchase.totalCompra || Number(purchase.cantidad) * Number(purchase.precioUnitario),
        purchase.montoPagado,
        purchase.fechaCompra,
        purchase.notas || null,
      ],
    );

    return { purchase: this.mapPurchase(rows[0]) };
  }

  async deletePurchase(clientId, purchaseId) {
    const { rowCount } = await pool.query(
      'DELETE FROM cliente_compras WHERE id = $1 AND cliente_id = $2',
      [purchaseId, clientId],
    );

    return rowCount > 0;
  }
}

module.exports = new ClientModel();
