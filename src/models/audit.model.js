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
}

module.exports = new AuditModel();
