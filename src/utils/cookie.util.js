const { AUTH_COOKIE_NAME, AUTH_TOKEN_TTL } = require('../config/env');

function parseDurationToSeconds(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  const matches = normalizedValue.match(/^(\d+)(s|m|h|d)?$/);

  if (!matches) {
    return 8 * 60 * 60;
  }

  const amount = Number(matches[1]);
  const unit = matches[2] || 's';

  switch (unit) {
    case 'd':
      return amount * 24 * 60 * 60;
    case 'h':
      return amount * 60 * 60;
    case 'm':
      return amount * 60;
    default:
      return amount;
  }
}

function getAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: parseDurationToSeconds(AUTH_TOKEN_TTL) * 1000,
  };
}

function setAuthCookie(res, token) {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((accumulator, entry) => {
      const separatorIndex = entry.indexOf('=');

      if (separatorIndex <= 0) {
        return accumulator;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function getAuthTokenFromCookies(cookieHeader) {
  const cookies = parseCookies(cookieHeader);
  return cookies[AUTH_COOKIE_NAME] || null;
}

module.exports = {
  clearAuthCookie,
  getAuthCookieOptions,
  getAuthTokenFromCookies,
  parseDurationToSeconds,
  setAuthCookie,
};
