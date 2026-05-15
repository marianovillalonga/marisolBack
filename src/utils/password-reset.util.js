const crypto = require('crypto');
const { FRONTEND_URL, PASSWORD_RESET_TOKEN_TTL_MINUTES } = require('../config/env');

function generatePasswordResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPasswordResetToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getPasswordResetExpirationDate() {
  return new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);
}

function buildPasswordResetUrl(token) {
  const baseUrl = new URL(FRONTEND_URL.replace(/\/$/, ''));
  baseUrl.pathname = '/reset-password';
  baseUrl.searchParams.set('token', token);
  return baseUrl.toString();
}

function maskEmail(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const [user = '', domain = ''] = normalizedEmail.split('@');

  if (!user || !domain) {
    return 'desconocido';
  }

  const visiblePrefix = user.slice(0, 2);
  return `${visiblePrefix}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
}

module.exports = {
  buildPasswordResetUrl,
  generatePasswordResetToken,
  getPasswordResetExpirationDate,
  hashPasswordResetToken,
  maskEmail,
};
