const pool = require('../config/db');

class BudgetModel {
  mapBudget(row) {
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
      metodoPago: row.metodo_pago,
      notas: row.notas,
      fechaEmision: row.fecha_emision,
      diasValidez: Number(row.dias_validez || 0),
      fechaVencimiento: row.fecha_vencimiento,
      estado: row.estado,
      cantidadItems: Number(row.cantidad_items || 0),
    };
  }

  mapBudgetItem(row) {
    return {
      id: row.id,
      presupuestoId: row.presupuesto_id,
      productoId: row.producto_id,
      productoNombre: row.producto_nombre,
      cantidad: Number(row.cantidad || 0),
      precioUnitario: Number(row.precio_unitario || 0),
      subtotal: Number(row.subtotal || 0),
    };
  }

  async ensureBudgetsTables() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS presupuestos (
        id SERIAL PRIMARY KEY,
        cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
        vendedor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
        ajuste_metodo_pago NUMERIC(12, 2) NOT NULL DEFAULT 0,
        ajuste_metodo_pago_tipo VARCHAR(20),
        ajuste_metodo_pago_porcentaje NUMERIC(8, 2) NOT NULL DEFAULT 0,
        descuento NUMERIC(12, 2) NOT NULL DEFAULT 0,
        total NUMERIC(12, 2) NOT NULL DEFAULT 0,
        metodo_pago VARCHAR(50) NOT NULL DEFAULT 'efectivo',
        notas TEXT,
        fecha_emision TIMESTAMP NOT NULL DEFAULT NOW(),
        dias_validez INTEGER NOT NULL DEFAULT 10,
        fecha_vencimiento TIMESTAMP NOT NULL,
        fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
        fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS presupuesto_detalles (
        id SERIAL PRIMARY KEY,
        presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
        producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
        producto_nombre VARCHAR(150) NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1,
        precio_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0,
        subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_presupuestos_cliente_id
      ON presupuestos(cliente_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_presupuesto_detalles_presupuesto_id
      ON presupuesto_detalles(presupuesto_id)
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion_presupuestos()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.fecha_actualizacion = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_actualizar_presupuestos ON presupuestos
    `);

    await pool.query(`
      CREATE TRIGGER trigger_actualizar_presupuestos
      BEFORE UPDATE ON presupuestos
      FOR EACH ROW
      EXECUTE FUNCTION actualizar_fecha_actualizacion_presupuestos()
    `);
  }

  buildListQuery() {
    return `
      SELECT
        p.id,
        p.cliente_id,
        c.nombre AS cliente_nombre,
        p.vendedor_id,
        u.nombre AS vendedor_nombre,
        p.subtotal,
        p.ajuste_metodo_pago,
        p.ajuste_metodo_pago_tipo,
        p.ajuste_metodo_pago_porcentaje,
        p.descuento,
        p.total,
        p.metodo_pago,
        p.notas,
        p.fecha_emision,
        p.dias_validez,
        p.fecha_vencimiento,
        CASE
          WHEN p.fecha_vencimiento < NOW() THEN 'vencido'
          ELSE 'vigente'
        END AS estado,
        COALESCE(SUM(pd.cantidad), 0)::int AS cantidad_items
      FROM presupuestos p
      LEFT JOIN clientes c ON c.id = p.cliente_id
      LEFT JOIN usuarios u ON u.id = p.vendedor_id
      LEFT JOIN presupuesto_detalles pd ON pd.presupuesto_id = p.id
    `;
  }

  async listBudgets(search = '', status = 'all') {
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
            OR CAST(p.id AS TEXT) LIKE REPLACE($1, '%', '')
          )
        GROUP BY p.id, c.nombre, u.nombre
        HAVING (
          $2 = 'all'
          OR (
            $2 = 'vigente' AND MAX(p.fecha_vencimiento) >= NOW()
          )
          OR (
            $2 = 'vencido' AND MAX(p.fecha_vencimiento) < NOW()
          )
        )
        ORDER BY p.fecha_emision DESC, p.id DESC
      `,
      [normalizedSearch, normalizedStatus],
    );

    return rows.map((row) => this.mapBudget(row));
  }

  async findById(id) {
    const budgetResult = await pool.query(
      `
        ${this.buildListQuery()}
        WHERE p.id = $1
        GROUP BY p.id, c.nombre, u.nombre
        LIMIT 1
      `,
      [id],
    );

    if (!budgetResult.rows[0]) {
      return null;
    }

    const itemsResult = await pool.query(
      `
        SELECT
          id,
          presupuesto_id,
          producto_id,
          producto_nombre,
          cantidad,
          precio_unitario,
          subtotal
        FROM presupuesto_detalles
        WHERE presupuesto_id = $1
        ORDER BY id ASC
      `,
      [id],
    );

    return {
      ...this.mapBudget(budgetResult.rows[0]),
      items: itemsResult.rows.map((row) => this.mapBudgetItem(row)),
    };
  }

  async createBudget({
    clientId,
    sellerId,
    descuento,
    ajusteMetodoPago = 0,
    ajusteMetodoPagoTipo = null,
    ajusteMetodoPagoPorcentaje = 0,
    metodoPago,
    notas,
    fechaEmision,
    diasValidez,
    items,
  }) {
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
        if (item.productoId) {
          const productResult = await client.query(
            'SELECT id, nombre FROM productos WHERE id = $1 LIMIT 1',
            [item.productoId],
          );

          const product = productResult.rows[0];

          if (!product) {
            await client.query('ROLLBACK');
            return { error: 'PRODUCT_NOT_FOUND' };
          }

          itemSnapshots.push({
            productoId: product.id,
            productoNombre: product.nombre,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            subtotal: Number(item.cantidad) * Number(item.precioUnitario),
          });
          continue;
        }

        itemSnapshots.push({
          productoId: null,
          productoNombre: item.productoNombre,
          cantidad: item.cantidad,
          precioUnitario: item.precioUnitario,
          subtotal: Number(item.cantidad) * Number(item.precioUnitario),
        });
      }

      const subtotal = itemSnapshots.reduce((acc, item) => acc + item.subtotal, 0);
      const total = subtotal + ajusteMetodoPago - descuento;
      const fechaVencimiento = addDaysToDate(fechaEmision, diasValidez);

      const budgetResult = await client.query(
        `
          INSERT INTO presupuestos (
            cliente_id,
            vendedor_id,
            subtotal,
            ajuste_metodo_pago,
            ajuste_metodo_pago_tipo,
            ajuste_metodo_pago_porcentaje,
            descuento,
            total,
            metodo_pago,
            notas,
            fecha_emision,
            dias_validez,
            fecha_vencimiento
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id
        `,
        [
          customer?.id || null,
          sellerId,
          subtotal,
          ajusteMetodoPago,
          ajusteMetodoPagoTipo,
          ajusteMetodoPagoPorcentaje,
          descuento,
          total,
          metodoPago,
          notas || null,
          fechaEmision,
          diasValidez,
          fechaVencimiento,
        ],
      );

      const budgetId = budgetResult.rows[0].id;

      for (const item of itemSnapshots) {
        await client.query(
          `
            INSERT INTO presupuesto_detalles (
              presupuesto_id,
              producto_id,
              producto_nombre,
              cantidad,
              precio_unitario,
              subtotal
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            budgetId,
            item.productoId,
            item.productoNombre,
            item.cantidad,
            item.precioUnitario,
            item.subtotal,
          ],
        );
      }

      await client.query('COMMIT');
      return { budgetId };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

function addDaysToDate(dateString, days) {
  const baseDate = new Date(`${dateString}T00:00:00`);
  baseDate.setDate(baseDate.getDate() + Number(days));
  return baseDate.toISOString();
}

module.exports = new BudgetModel();
