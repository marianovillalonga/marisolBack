function buildPaginationMeta({ page, pageSize, total }) {
  const totalItems = Number(total || 0);
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}

module.exports = {
  buildPaginationMeta,
};
