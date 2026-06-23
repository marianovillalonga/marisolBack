const pool = require('../config/db');

class AuditModel {
  async ensureAuditTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        accion VARCHAR(100) NOT NULL,
        entidad VARCHAR(100) NOT NULL,
        entidad_id VARCHAR(100),
        detalle_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip VARCHAR(120),
        request_id VARCHAR(120),
        fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_auditoria_usuario_id
      ON auditoria(usuario_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_auditoria_entidad
      ON auditoria(entidad, entidad_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_auditoria_accion_fecha
      ON auditoria(accion, fecha_creacion DESC)
    `);
  }

  async logAction({
    userId = null,
    action,
    entity,
    entityId = null,
    details = {},
    ip = null,
    requestId = null,
  }) {
    await pool.query(
      `
        INSERT INTO auditoria (
          usuario_id,
          accion,
          entidad,
          entidad_id,
          detalle_json,
          ip,
          request_id
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      `,
      [
        userId,
        action,
        entity,
        entityId === null || entityId === undefined ? null : String(entityId),
        JSON.stringify(details || {}),
        ip,
        requestId,
      ],
    );
  }

  async listPriceAdjustments(limit = 20) {
    const { rows } = await pool.query(
      `
        SELECT
          a.id,
          a.detalle_json,
          a.request_id,
          a.fecha_creacion,
          NOT EXISTS (
            SELECT 1
            FROM auditoria revert
            WHERE revert.accion = 'precios_ajuste_anulado'
              AND revert.entidad = 'categoria'
              AND revert.detalle_json ->> 'ajusteAnuladoId' = a.id::text
          ) AS can_revert,
          u.id AS usuario_id,
          u.nombre AS usuario_nombre,
          u.email AS usuario_email
        FROM auditoria a
        LEFT JOIN usuarios u
          ON u.id = a.usuario_id
        WHERE a.accion = 'precios_ajustados_por_categoria'
          AND a.entidad = 'categoria'
        ORDER BY a.fecha_creacion DESC, a.id DESC
        LIMIT $1
      `,
      [limit],
    );

    return rows.map((row) => ({
      id: Number(row.id),
      requestId: row.request_id || null,
      createdAt: row.fecha_creacion,
      canRevert: Boolean(row.can_revert),
      user: row.usuario_id
        ? {
            id: Number(row.usuario_id),
            name: row.usuario_nombre || '',
            email: row.usuario_email || '',
          }
        : null,
      details: row.detalle_json || {},
    }));
  }

  async findPriceAdjustmentById(id) {
    const { rows } = await pool.query(
      `
        SELECT
          a.id,
          a.detalle_json,
          a.request_id,
          a.fecha_creacion,
          NOT EXISTS (
            SELECT 1
            FROM auditoria revert
            WHERE revert.accion = 'precios_ajuste_anulado'
              AND revert.entidad = 'categoria'
              AND revert.detalle_json ->> 'ajusteAnuladoId' = a.id::text
          ) AS can_revert,
          u.id AS usuario_id,
          u.nombre AS usuario_nombre,
          u.email AS usuario_email
        FROM auditoria a
        LEFT JOIN usuarios u
          ON u.id = a.usuario_id
        WHERE a.id = $1
          AND a.accion = 'precios_ajustados_por_categoria'
          AND a.entidad = 'categoria'
        LIMIT 1
      `,
      [id],
    );

    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      id: Number(row.id),
      requestId: row.request_id || null,
      createdAt: row.fecha_creacion,
      canRevert: Boolean(row.can_revert),
      user: row.usuario_id
        ? {
            id: Number(row.usuario_id),
            name: row.usuario_nombre || '',
            email: row.usuario_email || '',
          }
        : null,
      details: row.detalle_json || {},
    };
  }

  async findLatestPriceAdjustment() {
    const [latest] = await this.listPriceAdjustments(1);
    return latest || null;
  }
}

module.exports = new AuditModel();
