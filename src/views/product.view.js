function buildProductsResponse(products) {
  return {
    ok: true,
    products,
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
