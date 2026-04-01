require('dotenv').config();

const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://marisol-front.vercel.app';
const FRONTEND_URLS = (process.env.FRONTEND_URLS || FRONTEND_URL)
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const AUTH_SECRET = process.env.AUTH_SECRET || 'desarrollo-local';
const AUTH_TOKEN_TTL = process.env.AUTH_TOKEN_TTL || '8h';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@marisol.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';
const isProduction = process.env.NODE_ENV === 'production';
const DB_SSL = process.env.DB_SSL;
const DB_SSL_REJECT_UNAUTHORIZED = process.env.DB_SSL_REJECT_UNAUTHORIZED;

function validateRuntimeConfig() {
  const issues = [];

  if (isProduction && AUTH_SECRET === 'desarrollo-local') {
    issues.push('AUTH_SECRET no puede usar el valor por defecto en produccion');
  }

  if (isProduction && AUTH_SECRET.length < 32) {
    issues.push('AUTH_SECRET debe tener al menos 32 caracteres en produccion');
  }

  if (isProduction && ADMIN_PASSWORD === 'admin123') {
    issues.push('ADMIN_PASSWORD no puede usar el valor por defecto en produccion');
  }

  if (isProduction && DB_SSL === 'false') {
    issues.push('DB_SSL no debe deshabilitarse en produccion');
  }

  if (isProduction && DB_SSL_REJECT_UNAUTHORIZED === 'false') {
    issues.push('DB_SSL_REJECT_UNAUTHORIZED=false solo deberia usarse temporalmente fuera de produccion');
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
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME,
  validateRuntimeConfig,
};
