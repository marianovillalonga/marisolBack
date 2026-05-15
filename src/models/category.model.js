const pool = require('../config/db');

class CategoryModel {
  async ensureCategoriesTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        codigo VARCHAR(4) UNIQUE,
        fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      ALTER TABLE categorias
      ADD COLUMN IF NOT EXISTS codigo VARCHAR(4)
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subcategorias (
        id SERIAL PRIMARY KEY,
        categoria_id INTEGER NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
        nombre VARCHAR(100) NOT NULL,
        codigo VARCHAR(4) NOT NULL,
        fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (categoria_id, codigo)
      )
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_subcategorias_categoria_nombre_unique
      ON subcategorias (categoria_id, LOWER(nombre))
    `);

    await pool.query(`
      INSERT INTO categorias (nombre)
      SELECT DISTINCT categoria
      FROM productos
      WHERE categoria IS NOT NULL AND TRIM(categoria) <> ''
      ON CONFLICT (nombre) DO NOTHING
    `);

    const categoriesWithoutCode = await pool.query(`
      SELECT id
      FROM categorias
      WHERE codigo IS NULL OR TRIM(codigo) = ''
      ORDER BY id ASC
    `);

    for (const category of categoriesWithoutCode.rows) {
      const nextCode = await this.getNextCategoryCode();
      await pool.query('UPDATE categorias SET codigo = $2 WHERE id = $1', [category.id, nextCode]);
    }
  }

  async listCategories() {
    const { rows } = await pool.query(`
      SELECT
        c.id,
        c.nombre,
        c.codigo,
        COALESCE(
          ARRAY_AGG(s.nombre ORDER BY s.nombre) FILTER (WHERE s.nombre IS NOT NULL),
          ARRAY[]::VARCHAR[]
        ) AS subcategorias
      FROM categorias c
      LEFT JOIN subcategorias s ON s.categoria_id = c.id
      GROUP BY c.id, c.nombre, c.codigo
      ORDER BY c.nombre ASC
    `);

    return rows;
  }

  async createCategory(nombre) {
    const normalizedName = nombre.trim();

    const existing = await pool.query(
      'SELECT id, nombre, codigo FROM categorias WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
      [normalizedName],
    );

    if (existing.rows[0]) {
      return { category: existing.rows[0], created: false };
    }

    const nextCode = await this.getNextCategoryCode();
    const { rows } = await pool.query(
      'INSERT INTO categorias (nombre, codigo) VALUES ($1, $2) RETURNING id, nombre, codigo',
      [normalizedName, nextCode],
    );

    return { category: rows[0], created: true };
  }

  async deleteCategory(id) {
    const categoryResult = await pool.query(
      'SELECT id, nombre, codigo FROM categorias WHERE id = $1 LIMIT 1',
      [id],
    );

    const category = categoryResult.rows[0];

    if (!category) {
      return { error: 'NOT_FOUND' };
    }

    const inUseResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM productos
        WHERE LOWER(COALESCE(categoria, '')) = LOWER($1)
      `,
      [category.nombre],
    );

    if (inUseResult.rows[0]?.total > 0) {
      return { error: 'IN_USE' };
    }

    await pool.query('DELETE FROM categorias WHERE id = $1', [id]);

    return { deleted: true };
  }

  async findOrCreateCategory(nombre, client = pool) {
    const normalizedName = nombre.trim();
    const existing = await client.query(
      'SELECT id, nombre, codigo FROM categorias WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
      [normalizedName],
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const nextCode = await this.getNextCategoryCode(client);
    const { rows } = await client.query(
      'INSERT INTO categorias (nombre, codigo) VALUES ($1, $2) RETURNING id, nombre, codigo',
      [normalizedName, nextCode],
    );

    return rows[0];
  }

  async findOrCreateSubcategory(categoriaId, nombre, client = pool) {
    const normalizedName = nombre.trim();
    const existing = await client.query(
      `
        SELECT id, categoria_id, nombre, codigo
        FROM subcategorias
        WHERE categoria_id = $1 AND LOWER(nombre) = LOWER($2)
        LIMIT 1
      `,
      [categoriaId, normalizedName],
    );

    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const nextCode = await this.getNextSubcategoryCode(categoriaId, client);
    const { rows } = await client.query(
      `
        INSERT INTO subcategorias (categoria_id, nombre, codigo)
        VALUES ($1, $2, $3)
        RETURNING id, categoria_id, nombre, codigo
      `,
      [categoriaId, normalizedName, nextCode],
    );

    return rows[0];
  }

  async getNextCategoryCode(client = pool) {
    const { rows } = await client.query(`
      SELECT COALESCE(MAX(CAST(codigo AS INTEGER)), 0) + 1 AS next_code
      FROM categorias
      WHERE codigo ~ '^[0-9]{4}$'
    `);

    return String(Number(rows[0]?.next_code || 1)).padStart(4, '0');
  }

  async getNextSubcategoryCode(categoriaId, client = pool) {
    const { rows } = await client.query(
      `
        SELECT COALESCE(MAX(CAST(codigo AS INTEGER)), 0) + 1 AS next_code
        FROM subcategorias
        WHERE categoria_id = $1
          AND codigo ~ '^[0-9]{4}$'
      `,
      [categoriaId],
    );

    return String(Number(rows[0]?.next_code || 1)).padStart(4, '0');
  }
}

module.exports = new CategoryModel();
