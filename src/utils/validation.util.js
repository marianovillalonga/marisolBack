const validationRules = require('../../../shared/validation/rules.json');

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

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parsePaginationParams(source = {}) {
  const defaultPage = validationRules.pagination.defaultPage;
  const defaultPageSize = validationRules.pagination.defaultPageSize;
  const maxPageSize = validationRules.pagination.maxPageSize;

  const page = clampNumber(Number(source.page) || defaultPage, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = clampNumber(
    Number(source.pageSize || source.limit) || defaultPageSize,
    1,
    maxPageSize,
  );

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

module.exports = {
  hasJsonContentType,
  isNonEmptyString,
  isPositiveInteger,
  isValidEmail,
  parsePaginationParams,
};
