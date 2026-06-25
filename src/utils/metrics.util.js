const { getDateOnlyString } = require('./date.util');

function toPositiveInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function isValidDateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && !Number.isNaN(Date.parse(value));
}

function getCurrentMonthRange(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);

  return {
    from: getDateOnlyString(from),
    to: getDateOnlyString(to),
  };
}

function buildMetricsFilters(query = {}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = toPositiveInteger(query.month);
  const year = toPositiveInteger(query.year) || currentYear;
  const hasMonthYear = month !== null && month >= 1 && month <= 12;

  let from = query.from || '';
  let to = query.to || '';

  if (!from && !to && hasMonthYear) {
    from = `${year}-${String(month).padStart(2, '0')}-01`;
    to = getDateOnlyString(new Date(year, month, 0));
  }

  if (!from || !isValidDateOnly(from)) {
    from = '';
  }

  if (!to || !isValidDateOnly(to)) {
    to = from || '';
  }

  return {
    from,
    to,
    month: hasMonthYear ? month : null,
    year,
    categoryId: toPositiveInteger(query.categoryId ?? query.categoriaId),
    subcategoryId: toPositiveInteger(query.subcategoryId ?? query.subcategoriaId),
    productId: toPositiveInteger(query.productId ?? query.productoId),
    userId: toPositiveInteger(query.userId ?? query.vendedorId),
    paymentMethod: String(query.paymentMethod || query.metodoPago || '').trim(),
    search: String(query.search || '').trim(),
  };
}

module.exports = {
  buildMetricsFilters,
  getCurrentMonthRange,
};
