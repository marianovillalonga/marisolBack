function buildCategoriesResponse(categories) {
  return {
    ok: true,
    categories,
  };
}

function buildCategoryResponse(category, message) {
  return {
    ok: true,
    message,
    category,
  };
}

module.exports = {
  buildCategoriesResponse,
  buildCategoryResponse,
};
