const pool = require('../config/db');

class OrderModel {
  mapOrder(row) {
    return {
      id: row.id,
      usuarioId: row.usuario_id,
      usuarioNombre: row.usuario_nombre,
      fechaPedido: row.fecha_pedido,
      notas: row.notas,
      cantidadItems: Number(row.cantidad_items || 0),
      cantidadLineas: Number(row.cantidad_lineas || 0),
    };
  }

  mapOrderItem(row) {
    return {
      id: row.id,
      pedidoId: row.pedido_id,
      productoId: row.producto_id,
      productoNombre: row.producto_nombre,
      cantidad: Number(row.cantidad || 0),
      stockAnterior: Number(row.stock_anterior || 0),
      stockActual: Number(row.stock_actual || 0),
    };
  }

  async ensureOrdersTables() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        fecha_pedido TIMESTAMP NOT NULL DEFAULT NOW(),
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
        producto_nombre VARCHAR(150) NOT NULL,
        cantidad INTEGER NOT NULL DEFAULT 1,
        stock_anterior INTEGER NOT NULL DEFAULT 0,
        stock_actual INTEGER NOT NULL DEFAULT 0
      )
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
        p.fecha_pedido,
        p.notas,
        COALESCE(SUM(pd.cantidad), 0)::int AS cantidad_items,
        COUNT(pd.id)::int AS cantidad_lineas
      FROM pedidos p
      LEFT JOIN usuarios u ON u.id = p.usuario_id
      LEFT JOIN pedido_detalles pd ON pd.pedido_id = p.id
    `;
  }

  async listOrders(search = '') {
    const normalizedSearch = `%${search.trim().toLowerCase()}%`;

    const { rows } = await pool.query(
      `
        ${this.buildListQuery()}
        WHERE
          (
            $1 = '%%'
            OR CAST(p.id AS TEXT) LIKE REPLACE($1, '%', '')
            OR LOWER(COALESCE(u.nombre, '')) LIKE $1
            OR LOWER(COALESCE(p.notas, '')) LIKE $1
          )
        GROUP BY p.id, u.nombre
        ORDER BY p.fecha_pedido DESC, p.id DESC
      `,
      [normalizedSearch],
    );

    return rows.map((row) => this.mapOrder(row));
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
          cantidad,
          stock_anterior,
          stock_actual
        FROM pedido_detalles
        WHERE pedido_id = $1
        ORDER BY id ASC
      `,
      [id],
    );

    return {
      ...this.mapOrder(orderResult.rows[0]),
      items: itemsResult.rows.map((row) => this.mapOrderItem(row)),
    };
  }

  async createOrder({ userId, fechaPedido, notas, items }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'SELECT id FROM usuarios WHERE id = $1 LIMIT 1',
        [userId],
      );

      if (!userResult.rows[0]) {
        await client.query('ROLLBACK');
        return { error: 'USER_NOT_FOUND' };
      }

      const { rows: orderRows } = await client.query(
        `
          INSERT INTO pedidos (
            usuario_id,
            fecha_pedido,
            notas
          )
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [userId, fechaPedido, notas || null],
      );

      const orderId = orderRows[0].id;

      for (const item of items) {
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

        const stockAnterior = Number(product.cantidad || 0);
        const stockActual = stockAnterior + Number(item.cantidad);

        await client.query(
          `
            INSERT INTO pedido_detalles (
              pedido_id,
              producto_id,
              producto_nombre,
              cantidad,
              stock_anterior,
              stock_actual
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [orderId, product.id, product.nombre, item.cantidad, stockAnterior, stockActual],
        );

        await client.query(
          `
            UPDATE productos
            SET cantidad = $2
            WHERE id = $1
          `,
          [product.id, stockActual],
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
}

module.exports = new OrderModel();
