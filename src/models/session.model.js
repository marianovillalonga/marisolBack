const pool = require('../config/db');

class SessionModel {
  async ensureRevokedTokensTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tokens_revocados (
        id SERIAL PRIMARY KEY,
        jti VARCHAR(255) NOT NULL UNIQUE,
        usuario_id INTEGER,
        expira_en TIMESTAMP NOT NULL,
        fecha_revocacion TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
  }

  async revokeToken({ jti, userId, expiresAt }) {
    await pool.query(
      `
        INSERT INTO tokens_revocados (jti, usuario_id, expira_en)
        VALUES ($1, $2, $3)
        ON CONFLICT (jti) DO NOTHING
      `,
      [jti, userId, expiresAt],
    );
  }

  async isTokenRevoked(jti) {
    const { rows } = await pool.query(
      'SELECT id FROM tokens_revocados WHERE jti = $1 AND expira_en > NOW() LIMIT 1',
      [jti],
    );

    return Boolean(rows[0]);
  }

  async deleteExpiredRevokedTokens() {
    await pool.query('DELETE FROM tokens_revocados WHERE expira_en <= NOW()');
  }
}

module.exports = new SessionModel();
