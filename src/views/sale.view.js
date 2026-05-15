const { buildPaginationMeta } = require('./pagination.view');

function buildSalesResponse(sales, pagination) {
  return {
    ok: true,
    sales,
    pagination: buildPaginationMeta(pagination),
  };
}

function buildSalesSummaryResponse(summary) {
  return {
    ok: true,
    summary,
  };
}

function buildSaleResponse(sale, message) {
  return {
    ok: true,
    message,
    sale,
  };
}

function buildSaleMessageResponse(message) {
  return {
    ok: true,
    message,
  };
}

module.exports = {
  buildSalesResponse,
  buildSalesSummaryResponse,
  buildSaleResponse,
  buildSaleMessageResponse,
};
