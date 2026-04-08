function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function isPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0;
}

function hasJsonContentType(req) {
  return req.is('application/json') || req.is('application/*+json');
}

module.exports = {
  hasJsonContentType,
  isNonEmptyString,
  isPositiveInteger,
  isValidEmail,
};
