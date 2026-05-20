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
const PASSWORD_RESET_TOKEN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TOKEN_TTL_MINUTES) || 30;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT) || 0;
const SMTP_SECURE = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.SMTP_SECURE || '').toLowerCase(),
);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';
const SEED_DEFAULT_ADMIN = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.SEED_DEFAULT_ADMIN || '').toLowerCase(),
);
const DB_SSL = process.env.DB_SSL;
const DB_SSL_REJECT_UNAUTHORIZED = process.env.DB_SSL_REJECT_UNAUTHORIZED;
const DATABASE_URL = process.env.DATABASE_URL || '';
const DB_HOST = process.env.DB_HOST || '';
const DB_PORT = process.env.DB_PORT || '';
const DB_USER = process.env.DB_USER || '';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || '';

function isHttpsUrl(url) {
  try {
    return new URL(url).protocol === 'https:';
  } catch (_error) {
    return false;
  }
}

function validateRuntimeConfig() {
  const issues = [];
  const hasDatabaseUrl = Boolean(DATABASE_URL.trim());
  const hasLocalDbConfig = [DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME].every((value) =>
    String(value || '').trim(),
  );

  const hasSmtpConfig = [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS].every((value) =>
    String(value || '').trim(),
  );

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

  if (!FRONTEND_URLS.length) {
    issues.push('FRONTEND_URLS debe tener al menos un origen permitido');
  }

  if (PASSWORD_RESET_TOKEN_TTL_MINUTES < 5 || PASSWORD_RESET_TOKEN_TTL_MINUTES > 120) {
    issues.push('PASSWORD_RESET_TOKEN_TTL_MINUTES debe estar entre 5 y 120');
  }

  if ((RESEND_API_KEY || hasSmtpConfig) && !MAIL_FROM.trim()) {
    issues.push('MAIL_FROM es obligatorio cuando hay un proveedor de email configurado');
  }

  if ([SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS].some((value) => String(value || '').trim()) && !hasSmtpConfig) {
    issues.push('SMTP_HOST, SMTP_PORT, SMTP_USER y SMTP_PASS deben configurarse completos para usar nodemailer');
  }

  if (isProduction && !RESEND_API_KEY.trim() && !hasSmtpConfig) {
    issues.push(
      'Debes configurar RESEND_API_KEY o SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS en produccion para recuperar passwords',
    );
  }

  if (isProduction && !MAIL_FROM.trim()) {
    issues.push('MAIL_FROM es obligatorio en produccion para recuperar passwords');
  }

  if (!hasDatabaseUrl && !hasLocalDbConfig) {
    issues.push(
      'Debes configurar DATABASE_URL o bien DB_HOST, DB_PORT, DB_USER, DB_PASSWORD y DB_NAME',
    );
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
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
  RESEND_API_KEY,
  MAIL_FROM,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ADMIN_NAME,
  SEED_DEFAULT_ADMIN,
  DATABASE_URL,
  validateRuntimeConfig,
};
