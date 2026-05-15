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
  process.env.DATABASE_URL = 'postgres://user:password@db.example.com:5432/marisol';
  process.env.DB_SSL = 'true';
  process.env.FRONTEND_URLS = 'https://marisol-front.vercel.app,https://app.marisol.com';
  process.env.FRONTEND_RESET_PASSWORD_URL = 'https://app.marisol.com/auth/reset-password';
  delete process.env.DB_SSL_REJECT_UNAUTHORIZED;

  const { validateRuntimeConfig } = loadEnvModule();

  assert.doesNotThrow(() => validateRuntimeConfig());
  restoreEnv(snapshot);
});

test('validateRuntimeConfig falla si FRONTEND_URLS no usa https en produccion', () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.AUTH_SECRET = '12345678901234567890123456789012';
  process.env.ADMIN_PASSWORD = 'un-password-seguro';
  process.env.DATABASE_URL = 'postgres://user:password@db.example.com:5432/marisol';
  process.env.DB_SSL = 'true';
  process.env.FRONTEND_URLS = 'http://app.insegura.local';
  process.env.FRONTEND_RESET_PASSWORD_URL = 'https://app.marisol.com/auth/reset-password';
  delete process.env.DB_SSL_REJECT_UNAUTHORIZED;

  const { validateRuntimeConfig } = loadEnvModule();

  assert.throws(() => validateRuntimeConfig(), /FRONTEND_URLS debe usar https en produccion/);
  restoreEnv(snapshot);
});
