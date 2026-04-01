function buildOrdersResponse(orders) {
  return {
    ok: true,
    orders,
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
