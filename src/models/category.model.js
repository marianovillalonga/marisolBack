const pool = require('../config/db');

class CategoryModel {
  async ensureCategoriesTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL UNIQUE,
        fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      INSERT INTO categorias (nombre)
      SELECT DISTINCT categoria
      FROM productos
      WHERE categoria IS NOT NULL AND TRIM(categoria) <> ''
      ON CONFLICT (nombre) DO NOTHING
    `);
  }

  async listCategories() {
    const { rows } = await pool.query(`
      SELECT id, nombre
      FROM categorias
      ORDER BY nombre ASC
    `);

    return rows;
  }

  async createCategory(nombre) {
    const normalizedName = nombre.trim();

    const existing = await pool.query(
      'SELECT id, nombre FROM categorias WHERE LOWER(nombre) = LOWER($1) LIMIT 1',
      [normalizedName],
    );

    if (existing.rows[0]) {
      return { category: existing.rows[0], created: false };
    }

    const { rows } = await pool.query(
      'INSERT INTO categorias (nombre) VALUES ($1) RETURNING id, nombre',
      [normalizedName],
    );

    return { category: rows[0], created: true };
  }

  async deleteCategory(id) {
    const categoryResult = await pool.query(
      'SELECT id, nombre FROM categorias WHERE id = $1 LIMIT 1',
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
}

module.exports = new CategoryModel();
