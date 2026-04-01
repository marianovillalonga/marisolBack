const test = require('node:test');
const assert = require('node:assert/strict');

function loadEnvModule() {
  delete require.cache[require.resolve('./env')];
  return require('./env');
}

function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) {
    if (!(key in snapshot)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, snapshot);
}

test('validateRuntimeConfig falla en produccion con secretos inseguros', () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.AUTH_SECRET = 'corta';
  process.env.ADMIN_PASSWORD = 'admin123';
  process.env.DB_SSL = 'false';
  process.env.DB_SSL_REJECT_UNAUTHORIZED = 'false';

  const { validateRuntimeConfig } = loadEnvModule();

  assert.throws(() => validateRuntimeConfig(), /Configuracion insegura/);
  restoreEnv(snapshot);
});

test('validateRuntimeConfig permite configuracion segura en produccion', () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.AUTH_SECRET = '12345678901234567890123456789012';
  process.env.ADMIN_PASSWORD = 'un-password-seguro';
  process.env.DB_SSL = 'true';
  delete process.env.DB_SSL_REJECT_UNAUTHORIZED;

  const { validateRuntimeConfig } = loadEnvModule();

  assert.doesNotThrow(() => validateRuntimeConfig());
  restoreEnv(snapshot);
});
