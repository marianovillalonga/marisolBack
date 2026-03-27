const pool = require('../config/db');

class ProductModel {
  mapProduct(product) {
    return {
      id: product.id,
      nombre: product.nombre,
      categoria: product.categoria,
      codigoBarras: product.codigo_barras,
      cantidad: Number(product.cantidad),
      precio: Number(product.precio),
      detalle: product.detalle,
      imageUrl: product.image_url,
      fechaCreacion: product.fecha_creacion,
      fechaActualizacion: product.fecha_actualizacion,
    };
  }

  async ensureProductsTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS productos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(150) NOT NULL,
        categoria VARCHAR(100),
        cantidad INTEGER NOT NULL DEFAULT 0,
        precio NUMERIC(12, 2) NOT NULL DEFAULT 0,
        detalle TEXT,
        image_url TEXT,
        fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
        fecha_actualizacion TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`
      ALTER TABLE productos
      ADD COLUMN IF NOT EXISTS categoria VARCHAR(100)
    `);
    await pool.query(`
      ALTER TABLE productos
      ADD COLUMN IF NOT EXISTS codigo_barras VARCHAR(120)
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_codigo_barras_unique
      ON productos (LOWER(codigo_barras))
      WHERE codigo_barras IS NOT NULL AND TRIM(codigo_barras) <> ''
    `);
    await pool.query(`
      CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion_productos()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.fecha_actualizacion = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);
    await pool.query(`
      DROP TRIGGER IF EXISTS trigger_actualizar_productos ON productos
    `);
    await pool.query(`
      CREATE TRIGGER trigger_actualizar_productos
      BEFORE UPDATE ON productos
      FOR EACH ROW
      EXECUTE FUNCTION actualizar_fecha_actualizacion_productos()
    `);
  }

  async listProducts(search = '', category = '') {
    const normalizedSearch = `%${search.trim().toLowerCase()}%`;
    const normalizedCategory = category.trim().toLowerCase();
    const query = `
      SELECT
        id,
        nombre,
        categoria,
        codigo_barras,
        cantidad,
        precio,
        detalle,
        image_url,
        fecha_creacion,
        fecha_actualizacion
      FROM productos
      WHERE
        (
          $1 = '%%'
          OR LOWER(nombre) LIKE $1
          OR LOWER(COALESCE(detalle, '')) LIKE $1
          OR LOWER(COALESCE(codigo_barras, '')) LIKE $1
        )
        AND (
          $2 = ''
          OR LOWER(COALESCE(categoria, '')) = $2
        )
      ORDER BY id ASC
    `;

    const { rows } = await pool.query(query, [normalizedSearch, normalizedCategory]);
    return rows.map((product) => this.mapProduct(product));
  }

  async listCategories() {
    const { rows } = await pool.query(`
      SELECT DISTINCT categoria
      FROM productos
      WHERE categoria IS NOT NULL AND TRIM(categoria) <> ''
      ORDER BY categoria ASC
    `);

    return rows.map((row) => row.categoria);
  }

  async findById(id) {
    const { rows } = await pool.query(
      `
        SELECT
          id,
          nombre,
          categoria,
          codigo_barras,
          cantidad,
          precio,
          detalle,
          image_url,
          fecha_creacion,
          fecha_actualizacion
        FROM productos
        WHERE id = $1
        LIMIT 1
      `,
      [id],
    );

    if (!rows[0]) {
      return null;
    }

    return this.mapProduct(rows[0]);
  }

  async createProduct({ nombre, categoria, codigoBarras, cantidad, precio, detalle, imageUrl }) {
    const { rows } = await pool.query(
      `
        INSERT INTO productos (nombre, categoria, codigo_barras, cantidad, precio, detalle, image_url)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING
          id,
          nombre,
          categoria,
          codigo_barras,
          cantidad,
          precio,
          detalle,
          image_url,
          fecha_creacion,
          fecha_actualizacion
      `,
      [
        nombre,
        categoria || null,
        codigoBarras || null,
        cantidad,
        precio,
        detalle || null,
        imageUrl || null,
      ],
    );

    return this.mapProduct(rows[0]);
  }

  async updateProduct(id, { nombre, categoria, codigoBarras, cantidad, precio, detalle, imageUrl }) {
    const { rows } = await pool.query(
      `
        UPDATE productos
        SET
          nombre = $2,
          categoria = $3,
          codigo_barras = $4,
          cantidad = $5,
          precio = $6,
          detalle = $7,
          image_url = $8
        WHERE id = $1
        RETURNING
          id,
          nombre,
          categoria,
          codigo_barras,
          cantidad,
          precio,
          detalle,
          image_url,
          fecha_creacion,
          fecha_actualizacion
      `,
      [
        id,
        nombre,
        categoria || null,
        codigoBarras || null,
        cantidad,
        precio,
        detalle || null,
        imageUrl || null,
      ],
    );

    if (!rows[0]) {
      return null;
    }

    return this.mapProduct(rows[0]);
  }

  async adjustPricesByCategory(category, percentage) {
    const { rows } = await pool.query(
      `
        UPDATE productos
        SET precio = ROUND((precio * (1 + ($2 / 100.0)))::numeric, 2)
        WHERE LOWER(COALESCE(categoria, '')) = LOWER($1)
        RETURNING
          id,
          nombre,
          categoria,
          codigo_barras,
          cantidad,
          precio,
          detalle,
          image_url,
          fecha_creacion,
          fecha_actualizacion
      `,
      [category.trim(), percentage],
    );

    return rows.map((product) => this.mapProduct(product));
  }

  async deleteProduct(id) {
    const { rowCount } = await pool.query('DELETE FROM productos WHERE id = $1', [id]);
    return rowCount > 0;
  }
}

module.exports = new ProductModel();
