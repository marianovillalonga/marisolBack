const pool = require('../config/db');

class PasswordResetTokenModel {
  async invalidateActiveTokensForUser(userId, client = pool) {
    await client.query(
      `
        UPDATE password_reset_tokens
        SET usado_en = NOW()
        WHERE usuario_id = $1
          AND usado_en IS NULL
          AND expira_en > NOW()
      `,
      [userId],
    );
  }

  async createToken({ userId, tokenHash, expiresAt, ip = null, requestId = null }, client = pool) {
    const { rows } = await client.query(
      `
        INSERT INTO password_reset_tokens (
          usuario_id,
          token_hash,
          expira_en,
          solicitado_ip,
          request_id
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, usuario_id, expira_en, fecha_creacion
      `,
      [userId, tokenHash, expiresAt, ip, requestId],
    );

    return rows[0];
  }

  async findValidTokenByHash(tokenHash, client = pool) {
    const { rows } = await client.query(
      `
        SELECT id, usuario_id, expira_en, usado_en, fecha_creacion
        FROM password_reset_tokens
        WHERE token_hash = $1
          AND usado_en IS NULL
          AND expira_en > NOW()
        LIMIT 1
      `,
      [tokenHash],
    );

    return rows[0] || null;
  }

  async findValidTokenByHashForUpdate(tokenHash, client) {
    const { rows } = await client.query(
      `
        SELECT id, usuario_id, expira_en, usado_en, fecha_creacion
        FROM password_reset_tokens
        WHERE token_hash = $1
          AND usado_en IS NULL
          AND expira_en > NOW()
        LIMIT 1
        FOR UPDATE
      `,
      [tokenHash],
    );

    return rows[0] || null;
  }

  async markTokenUsed(tokenId, client = pool) {
    await client.query(
      `
        UPDATE password_reset_tokens
        SET usado_en = NOW()
        WHERE id = $1
      `,
      [tokenId],
    );
  }
}

module.exports = new PasswordResetTokenModel();
