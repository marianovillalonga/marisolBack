const { buildPaginationMeta } = require('./pagination.view');

function buildMetricsResponse(key, data) {
  return {
    ok: true,
    [key]: data,
  };
}

function buildMetricsDetailResponse(items, pagination) {
  return {
    ok: true,
    items,
    pagination: buildPaginationMeta(pagination),
  };
}

module.exports = {
  buildMetricsDetailResponse,
  buildMetricsResponse,
};
