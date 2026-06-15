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

function buildSubcategoriesResponse(subcategories) {
  return {
    ok: true,
    subcategories,
  };
}

function buildSubcategoryResponse(subcategory, message) {
  return {
    ok: true,
    message,
    subcategory,
  };
}

module.exports = {
  buildCategoriesResponse,
  buildCategoryResponse,
  buildSubcategoriesResponse,
  buildSubcategoryResponse,
};
