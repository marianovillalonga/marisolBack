ALTER TABLE IF EXISTS usuarios
ADD COLUMN IF NOT EXISTS password_actualizada_en TIMESTAMP NOT NULL DEFAULT NOW();

UPDATE usuarios
SET password_actualizada_en = COALESCE(password_actualizada_en, fecha_actualizacion, fecha_creacion, NOW());

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expira_en TIMESTAMP NOT NULL,
  usado_en TIMESTAMP,
  solicitado_ip VARCHAR(120),
  request_id VARCHAR(120),
  fecha_creacion TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_usuario_id
ON password_reset_tokens(usuario_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expira_en
ON password_reset_tokens(expira_en);
