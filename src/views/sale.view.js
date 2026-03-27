function buildSalesResponse(sales) {
  return {
    ok: true,
    sales,
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
