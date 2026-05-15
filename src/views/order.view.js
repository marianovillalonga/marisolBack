const { buildPaginationMeta } = require('./pagination.view');

function buildOrdersResponse(orders, pagination) {
  return {
    ok: true,
    orders,
    pagination: buildPaginationMeta(pagination),
  };
}

function buildOrderResponse(order, message) {
  return {
    ok: true,
    message,
    order,
  };
}

module.exports = {
  buildOrdersResponse,
  buildOrderResponse,
};
