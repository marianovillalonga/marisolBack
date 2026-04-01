const pool = require('../config/db');
const categoryModel = require('./category.model');
const { buildEan13 } = require('../utils/barcode.util');

class ProductModel {
  mapProduct(product) {
    return {
      id: product.id,
      nombre: product.nombre,
      categoria: product.categoria,
      subcategoria: product.subcategoria,
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
        subcategoria VARCHAR(100),
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
      ADD COLUMN IF NOT EXISTS subcategoria VARCHAR(100)
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
        subcategoria,
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
          OR LOWER(COALESCE(subcategoria, '')) LIKE $1
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
          subcategoria,
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

  async createProduct({ nombre, categoria, subcategoria, codigoBarras, cantidad, precio, detalle, imageUrl }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const category = await categoryModel.findOrCreateCategory(categoria, client);
      const subcategory = await categoryModel.findOrCreateSubcategory(
        category.id,
        subcategoria,
        client,
      );
      const finalBarcode =
        codigoBarras && codigoBarras.trim()
          ? codigoBarras.trim()
          : await this.generateBarcode(category.codigo, subcategory.codigo, client);

      const { rows } = await client.query(
        `
          INSERT INTO productos (
            nombre,
            categoria,
            subcategoria,
            codigo_barras,
            cantidad,
            precio,
            detalle,
            image_url
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING
            id,
            nombre,
            categoria,
            subcategoria,
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
          subcategoria || null,
          finalBarcode,
          cantidad,
          precio,
          detalle || null,
          imageUrl || null,
        ],
      );

      await client.query('COMMIT');
      return this.mapProduct(rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProduct(
    id,
    { nombre, categoria, subcategoria, codigoBarras, cantidad, precio, detalle, imageUrl },
  ) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const existingResult = await client.query(
        'SELECT id, codigo_barras FROM productos WHERE id = $1 LIMIT 1 FOR UPDATE',
        [id],
      );

      if (!existingResult.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }

      const category = await categoryModel.findOrCreateCategory(categoria, client);
      const subcategory = await categoryModel.findOrCreateSubcategory(
        category.id,
        subcategoria,
        client,
      );
      const finalBarcode =
        codigoBarras && codigoBarras.trim()
          ? codigoBarras.trim()
          : existingResult.rows[0].codigo_barras ||
            (await this.generateBarcode(category.codigo, subcategory.codigo, client, id));

      const { rows } = await client.query(
        `
          UPDATE productos
          SET
            nombre = $2,
            categoria = $3,
            subcategoria = $4,
            codigo_barras = $5,
            cantidad = $6,
            precio = $7,
            detalle = $8,
            image_url = $9
          WHERE id = $1
          RETURNING
            id,
            nombre,
            categoria,
            subcategoria,
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
          subcategoria || null,
          finalBarcode,
          cantidad,
          precio,
          detalle || null,
          imageUrl || null,
        ],
      );

      await client.query('COMMIT');
      return this.mapProduct(rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async generateBarcode(categoryCode, subcategoryCode, client = pool, productIdToExclude = null) {
    const prefix = `${categoryCode}${subcategoryCode}`;
    const params = [`${prefix}%`];
    let exclusionClause = '';

    if (productIdToExclude) {
      params.push(productIdToExclude);
      exclusionClause = 'AND id <> $2';
    }

    const { rows } = await client.query(
      `
        SELECT codigo_barras
        FROM productos
        WHERE codigo_barras LIKE $1
          AND LENGTH(codigo_barras) = 13
          ${exclusionClause}
        ORDER BY codigo_barras DESC
        LIMIT 1
      `,
      params,
    );

    const lastBase = rows[0]?.codigo_barras?.slice(0, 12) || `${prefix}0000`;
    const lastSequence = lastBase.slice(-4);
    const nextSequence = String(Number(lastSequence) + 1).padStart(4, '0');

    return buildEan13(`${prefix}${nextSequence}`);
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
          subcategoria,
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
