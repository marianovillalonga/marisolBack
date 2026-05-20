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
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.MAIL_FROM = 'Sistema <no-reply@example.com>';
  process.env.SMTP_HOST = '';
  process.env.SMTP_PORT = '';
  process.env.SMTP_SECURE = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';
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
  process.env.SMTP_HOST = '';
  process.env.SMTP_PORT = '';
  process.env.SMTP_SECURE = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';
  delete process.env.DB_SSL_REJECT_UNAUTHORIZED;

  const { validateRuntimeConfig } = loadEnvModule();

  assert.throws(() => validateRuntimeConfig(), /FRONTEND_URLS debe usar https en produccion/);
  restoreEnv(snapshot);
});

test('validateRuntimeConfig falla en produccion si falta RESEND_API_KEY', () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.AUTH_SECRET = '12345678901234567890123456789012';
  process.env.ADMIN_PASSWORD = 'un-password-seguro';
  process.env.DATABASE_URL = 'postgres://user:password@db.example.com:5432/marisol';
  process.env.DB_SSL = 'true';
  process.env.FRONTEND_URLS = 'https://app.marisol.com';
  process.env.RESEND_API_KEY = '';
  process.env.MAIL_FROM = '';
  process.env.SMTP_HOST = '';
  process.env.SMTP_PORT = '';
  process.env.SMTP_SECURE = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';
  delete process.env.DB_SSL_REJECT_UNAUTHORIZED;

  const { validateRuntimeConfig } = loadEnvModule();

  assert.throws(
    () => validateRuntimeConfig(),
    /Debes configurar RESEND_API_KEY o SMTP_HOST\/SMTP_PORT\/SMTP_USER\/SMTP_PASS en produccion para recuperar passwords/,
  );
  restoreEnv(snapshot);
});

test('validateRuntimeConfig falla en produccion si falta MAIL_FROM', () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.AUTH_SECRET = '12345678901234567890123456789012';
  process.env.ADMIN_PASSWORD = 'un-password-seguro';
  process.env.DATABASE_URL = 'postgres://user:password@db.example.com:5432/marisol';
  process.env.DB_SSL = 'true';
  process.env.FRONTEND_URLS = 'https://app.marisol.com';
  process.env.RESEND_API_KEY = 're_test_key';
  process.env.MAIL_FROM = '';
  process.env.SMTP_HOST = '';
  process.env.SMTP_PORT = '';
  process.env.SMTP_SECURE = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';
  delete process.env.DB_SSL_REJECT_UNAUTHORIZED;

  const { validateRuntimeConfig } = loadEnvModule();

  assert.throws(
    () => validateRuntimeConfig(),
    /MAIL_FROM es obligatorio en produccion para recuperar passwords/,
  );
  restoreEnv(snapshot);
});

test('validateRuntimeConfig permite configuracion SMTP segura en produccion', () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.AUTH_SECRET = '12345678901234567890123456789012';
  process.env.ADMIN_PASSWORD = 'un-password-seguro';
  process.env.DATABASE_URL = 'postgres://user:password@db.example.com:5432/marisol';
  process.env.DB_SSL = 'true';
  process.env.FRONTEND_URLS = 'https://app.marisol.com';
  process.env.RESEND_API_KEY = '';
  process.env.MAIL_FROM = 'Sistema <no-reply@example.com>';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'smtp-user';
  process.env.SMTP_PASS = 'smtp-pass';
  delete process.env.DB_SSL_REJECT_UNAUTHORIZED;

  const { validateRuntimeConfig } = loadEnvModule();

  assert.doesNotThrow(() => validateRuntimeConfig());
  restoreEnv(snapshot);
});

test('validateRuntimeConfig falla si la configuracion SMTP esta incompleta', () => {
  const snapshot = { ...process.env };

  process.env.NODE_ENV = 'production';
  process.env.AUTH_SECRET = '12345678901234567890123456789012';
  process.env.ADMIN_PASSWORD = 'un-password-seguro';
  process.env.DATABASE_URL = 'postgres://user:password@db.example.com:5432/marisol';
  process.env.DB_SSL = 'true';
  process.env.FRONTEND_URLS = 'https://app.marisol.com';
  process.env.RESEND_API_KEY = '';
  process.env.MAIL_FROM = 'Sistema <no-reply@example.com>';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'smtp-user';
  process.env.SMTP_PASS = '';
  delete process.env.DB_SSL_REJECT_UNAUTHORIZED;

  const { validateRuntimeConfig } = loadEnvModule();

  assert.throws(
    () => validateRuntimeConfig(),
    /SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS deben configurarse completos para usar nodemailer/,
  );
  restoreEnv(snapshot);
});
