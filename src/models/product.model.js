const pool = require('../config/db');
const categoryModel = require('./category.model');
const { buildEan13 } = require('../utils/barcode.util');
const { calculateAdjustedPrice } = require('../utils/price-adjustment.util');

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

  mapPriceAdjustmentProduct(product) {
    return {
      ...this.mapProduct(product),
      precioAnterior: Number(product.precio_anterior ?? product.precioAnterior ?? product.precio),
      precioNuevo: Number(product.precio_nuevo ?? product.precioNuevo ?? product.precio),
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

  async listProducts(search = '', category = '', subcategory = '', pagination = { limit: 20, offset: 0 }, barcode = '') {
    const normalizedSearch = `%${search.trim().toLowerCase()}%`;
    const normalizedCategory = category.trim().toLowerCase();
    const normalizedSubcategory = subcategory.trim().toLowerCase();
    const normalizedBarcode = barcode.trim().toLowerCase();
    const buildFiltersQuery = (barcodePlaceholder) => `
      WHERE
        (
          $1 = '%%'
          OR LOWER(nombre) LIKE $1
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
        AND (
          ${barcodePlaceholder} = ''
          OR REGEXP_REPLACE(COALESCE(codigo_barras, ''), '\\D', '', 'g') = ${barcodePlaceholder}
        )
    `;
    const filtersQuery = buildFiltersQuery('$6');
    const countFiltersQuery = buildFiltersQuery('$4');
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
      pool.query(query, [
        normalizedSearch,
        normalizedCategory,
        normalizedSubcategory,
        pagination.limit,
        pagination.offset,
        normalizedBarcode,
      ]),
      pool.query(
        `
          SELECT COUNT(*)::int AS total
          FROM productos
          ${countFiltersQuery}
        `,
        [normalizedSearch, normalizedCategory, normalizedSubcategory, normalizedBarcode],
      ),
    ]);
    const total = Number(countResult.rows[0]?.total || 0);

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

  async adjustPricesByCategory({ categoryId, subcategoryId = null, percentage }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const { rows: targetRows } = await client.query(
        `
          SELECT
            p.id,
            p.nombre,
            p.categoria,
            p.subcategoria,
            p.codigo_barras,
            p.cantidad,
            p.stock_minimo,
            p.precio AS precio_anterior,
            p.detalle,
            p.image_url,
            p.fecha_creacion,
            p.fecha_actualizacion
          FROM productos p
          INNER JOIN categorias c
            ON LOWER(TRIM(COALESCE(p.categoria, ''))) = LOWER(TRIM(c.nombre))
          LEFT JOIN subcategorias s
            ON s.categoria_id = c.id
           AND LOWER(TRIM(COALESCE(p.subcategoria, ''))) = LOWER(TRIM(s.nombre))
          WHERE c.id = $1
            AND ($2::int IS NULL OR s.id = $2)
          ORDER BY LOWER(p.nombre) ASC, p.id ASC
        `,
        [categoryId, subcategoryId],
      );

      if (!targetRows.length) {
        await client.query('COMMIT');
        return {
          products: [],
          updatedCount: 0,
        };
      }

      const products = [];

      for (const targetRow of targetRows) {
        const precioAnterior = Number(targetRow.precio_anterior);
        const precioNuevo = calculateAdjustedPrice(precioAnterior, percentage);

        const { rows } = await client.query(
          `
            UPDATE productos
            SET precio = $2
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
          [targetRow.id, precioNuevo],
        );

        const updatedRow = rows[0];

        products.push({
          ...this.mapProduct(updatedRow),
          precioAnterior,
          precioNuevo,
        });
      }

      await client.query('COMMIT');

      return {
        products,
        updatedCount: products.length,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async revertPriceAdjustment(products = []) {
    const normalizedProducts = products
      .map((product) => ({
        id: Number(product.id),
        precioAnterior: Number(product.precioAnterior ?? product.precio_anterior),
      }))
      .filter((product) => Number.isInteger(product.id) && Number.isFinite(product.precioAnterior));

    if (!normalizedProducts.length) {
      return {
        products: [],
        updatedCount: 0,
      };
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const productsToRestore = [];

      for (const product of normalizedProducts) {
        const { rows } = await client.query(
          `
            UPDATE productos
            SET precio = $2
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
          [product.id, product.precioAnterior],
        );

        if (rows[0]) {
          productsToRestore.push(this.mapProduct(rows[0]));
        }
      }

      await client.query('COMMIT');

      return {
        products: productsToRestore,
        updatedCount: productsToRestore.length,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteProduct(id) {
    const { rowCount } = await pool.query('DELETE FROM productos WHERE id = $1', [id]);
    return rowCount > 0;
  }
}

module.exports = new ProductModel();
