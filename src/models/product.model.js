const pool = require('../config/db');
const categoryModel = require('./category.model');
const { buildEan13 } = require('../utils/barcode.util');

function roundedPriceSql(rawPriceExpression) {
  return `
    (
      CASE
        WHEN MOD(ROUND(ABS(${rawPriceExpression}))::int, 100) <= 50
          THEN ROUND(ABS(${rawPriceExpression}))::int - MOD(ROUND(ABS(${rawPriceExpression}))::int, 100)
        ELSE ROUND(ABS(${rawPriceExpression}))::int + (100 - MOD(ROUND(ABS(${rawPriceExpression}))::int, 100))
      END
    ) * CASE WHEN ${rawPriceExpression} < 0 THEN -1 ELSE 1 END
  `;
}

class ProductModel {
  mapProduct(product) {
    return {
      id: product.id,
      nombre: product.nombre,
      categoria: product.categoria,
      subcategoria: product.subcategoria,
      codigoBarras: product.codigo_barras,
      cantidad: Number(product.cantidad),
      stockMinimo: Number(product.stock_minimo || 0),
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
        stock_minimo INTEGER NOT NULL DEFAULT 0,
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
      ALTER TABLE productos
      ADD COLUMN IF NOT EXISTS stock_minimo INTEGER NOT NULL DEFAULT 0
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

  async listProducts(search = '', category = '', subcategory = '', pagination = { limit: 20, offset: 0 }) {
    const normalizedSearch = `%${search.trim().toLowerCase()}%`;
    const normalizedCategory = category.trim().toLowerCase();
    const normalizedSubcategory = subcategory.trim().toLowerCase();
    const isBarcodeLikeSearch = /^\d{8,}$/.test(String(search).replace(/\D/g, ''));
    const filtersQuery = `
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
        AND (
          $3 = ''
          OR LOWER(COALESCE(subcategoria, '')) = $3
        )
    `;
    const query = `
      SELECT
        id,
        nombre,
        categoria,
        subcategoria,
        codigo_barras,
        cantidad,
        stock_minimo,
        precio,
        detalle,
        image_url,
        fecha_creacion,
        fecha_actualizacion
      FROM productos
      ${filtersQuery}
      ORDER BY
        CASE
          WHEN stock_minimo > 0 AND cantidad <= stock_minimo * 0.3 THEN 0
          WHEN stock_minimo > 0 AND cantidad <= stock_minimo THEN 1
          ELSE 2
        END ASC,
        LOWER(nombre) ASC,
        id ASC
      LIMIT $4
      OFFSET $5
    `;

    const [{ rows }, countResult] = await Promise.all([
      pool.query(query, [normalizedSearch, normalizedCategory, normalizedSubcategory, pagination.limit, pagination.offset]),
      pool.query(
        `
          SELECT COUNT(*)::int AS total
          FROM productos
          ${filtersQuery}
        `,
        [normalizedSearch, normalizedCategory, normalizedSubcategory],
      ),
    ]);
    const total = Number(countResult.rows[0]?.total || 0);

    if (isBarcodeLikeSearch) {
      console.info('[barcode][products:model] sql lookup', {
        rawSearch: search,
        normalizedSearch,
        category: normalizedCategory,
        subcategory: normalizedSubcategory,
        limit: pagination.limit,
        offset: pagination.offset,
        returnedRows: rows.length,
        total,
        matches: rows.map((product) => ({
          id: product.id,
          codigoBarras: product.codigo_barras,
        })),
      });
    }

    return {
      products: rows.map((product) => this.mapProduct(product)),
      total,
    };
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
          stock_minimo,
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

  async createProduct({ nombre, categoria, subcategoria, codigoBarras, cantidad, stockMinimo, precio, detalle, imageUrl }) {
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
            stock_minimo,
            precio,
            detalle,
            image_url
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING
            id,
            nombre,
            categoria,
            subcategoria,
            codigo_barras,
            cantidad,
            stock_minimo,
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
          stockMinimo,
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
    { nombre, categoria, subcategoria, codigoBarras, cantidad, stockMinimo, precio, detalle, imageUrl },
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
            stock_minimo = $7,
            precio = $8,
            detalle = $9,
            image_url = $10
          WHERE id = $1
          RETURNING
            id,
            nombre,
            categoria,
            subcategoria,
            codigo_barras,
            cantidad,
            stock_minimo,
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
          stockMinimo,
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
        WITH adjusted_products AS (
          SELECT
            id,
            precio * (1 + ($2 / 100.0)) AS raw_price
          FROM productos
          WHERE LOWER(COALESCE(categoria, '')) = LOWER($1)
        ),
        rounded_products AS (
          SELECT
            id,
            ${roundedPriceSql('raw_price')} AS precio_redondeado
          FROM adjusted_products
        )
        UPDATE productos AS productos
        SET precio = rounded_products.precio_redondeado
        FROM rounded_products
        WHERE productos.id = rounded_products.id
        RETURNING
          productos.id,
          productos.nombre,
          productos.categoria,
          productos.subcategoria,
          productos.codigo_barras,
          productos.cantidad,
          productos.stock_minimo,
          productos.precio,
          productos.detalle,
          productos.image_url,
          productos.fecha_creacion,
          productos.fecha_actualizacion
      `,
      [category.trim(), percentage],
    );

    return rows.map((product) => this.mapProduct(product));
  }

  async roundExistingProductPrices() {
    const { rows } = await pool.query(
      `
        WITH rounded_products AS (
          SELECT
            id,
            precio AS precio_anterior,
            ${roundedPriceSql('precio')} AS precio_redondeado
          FROM productos
        )
        UPDATE productos AS productos
        SET precio = rounded_products.precio_redondeado
        FROM rounded_products
        WHERE productos.id = rounded_products.id
          AND productos.precio IS DISTINCT FROM rounded_products.precio_redondeado
        RETURNING
          productos.id,
          productos.nombre,
          productos.categoria,
          rounded_products.precio_anterior,
          productos.precio AS precio_actual
      `,
    );

    return rows.map((product) => ({
      id: product.id,
      nombre: product.nombre,
      categoria: product.categoria,
      precioAnterior: Number(product.precio_anterior),
      precioActual: Number(product.precio_actual),
    }));
  }

  async deleteProduct(id) {
    const { rowCount } = await pool.query('DELETE FROM productos WHERE id = $1', [id]);
    return rowCount > 0;
  }
}

module.exports = new ProductModel();
