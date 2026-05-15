const { buildPaginationMeta } = require('./pagination.view');

function buildProductsResponse(products, pagination) {
  return {
    ok: true,
    products,
    pagination: buildPaginationMeta(pagination),
  };
}

function buildCategoriesResponse(categories) {
  return {
    ok: true,
    categories,
  };
}

function buildProductResponse(product, message) {
  return {
    ok: true,
    message,
    product,
  };
}

function buildProductMessageResponse(message) {
  return {
    ok: true,
    message,
  };
}

module.exports = {
  buildCategoriesResponse,
  buildProductsResponse,
  buildProductResponse,
  buildProductMessageResponse,
};
