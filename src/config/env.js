require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://marisol-front.vercel.app';
const FRONTEND_URLS = (process.env.FRONTEND_URLS || FRONTEND_URL)
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const AUTH_SECRET = process.env.AUTH_SECRET || (isTest ? 'test-auth-secret-32-chars-minimum!!' : '');
const AUTH_TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '8h';
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || 'marisol_auth';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';
const SEED_DEFAULT_ADMIN = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.SEED_DEFAULT_ADMIN || '').toLowerCase(),
);
const DB_SSL = process.env.DB_SSL;
const DB_SSL_REJECT_UNAUTHORIZED = process.env.DB_SSL_REJECT_UNAUTHORIZED;

function isHttpsUrl(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function validateRuntimeConfig() {
  const issues = [];

  if (!AUTH_SECRET) {
    issues.push('AUTH_SECRET es obligatorio');
  }

  if (AUTH_SECRET && AUTH_SECRET.length < 32) {
    issues.push('AUTH_SECRET debe tener al menos 32 caracteres');
  }

  if (SEED_DEFAULT_ADMIN) {
    if (!ADMIN_EMAIL) {
      issues.push('ADMIN_EMAIL es obligatorio cuando SEED_DEFAULT_ADMIN esta habilitado');
    }

    if (!ADMIN_PASSWORD) {
      issues.push('ADMIN_PASSWORD es obligatorio cuando SEED_DEFAULT_ADMIN esta habilitado');
    }

    if (ADMIN_PASSWORD && ADMIN_PASSWORD.length < 12) {
      issues.push('ADMIN_PASSWORD debe tener al menos 12 caracteres');
    }
  }

  if (isProduction && DB_SSL === 'false') {
    issues.push('DB_SSL no debe deshabilitarse en produccion');
  }

  if (isProduction && DB_SSL_REJECT_UNAUTHORIZED === 'false') {
    issues.push('DB_SSL_REJECT_UNAUTHORIZED=false solo deberia usarse temporalmente fuera de produccion');
  }

  if (isProduction && FRONTEND_URLS.some((url) => !isHttpsUrl(url))) {
    issues.push('FRONTEND_URLS debe usar https en produccion');
  }

  if (issues.length) {
    throw new Error(`Configuracion insegura: ${issues.join('. ')}`);
  }
}

module.exports = {
  PORT,
  FRONTEND_URL,
  FRONTEND_URLS,
  AUTH_SECRET,
  AUTH_TOKEN_TTL,
  AUTH_COOKIE_NAME,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME,
  SEED_DEFAULT_ADMIN,
  validateRuntimeConfig,
};
