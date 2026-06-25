const metricsModel = require('../models/metrics.model');
const { buildMessageResponse } = require('../views/auth.view');
const { buildMetricsDetailResponse, buildMetricsResponse } = require('../views/metrics.view');
const { buildMetricsFilters } = require('../utils/metrics.util');
const { parsePaginationParams } = require('../utils/validation.util');

function hasInvalidDateRange(filters) {
  if (filters.from && Number.isNaN(Date.parse(filters.from))) {
    return true;
  }

  if (filters.to && Number.isNaN(Date.parse(filters.to))) {
    return true;
  }

  return Boolean(filters.from && filters.to && new Date(filters.from) > new Date(filters.to));
}

function getFilters(req) {
  return buildMetricsFilters(req.query);
}

async function getSummary(req, res, next) {
  try {
    const filters = getFilters(req);

    if (hasInvalidDateRange(filters)) {
      return res.status(400).json(buildMessageResponse('Las fechas de metricas no son validas'));
    }

    const summary = await metricsModel.getSummary(filters);
    return res.status(200).json(buildMetricsResponse('summary', summary));
  } catch (error) {
    next(error);
  }
}

async function getTopProducts(req, res, next) {
  try {
    const filters = getFilters(req);

    if (hasInvalidDateRange(filters)) {
      return res.status(400).json(buildMessageResponse('Las fechas de metricas no son validas'));
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 25);
    const products = await metricsModel.getTopProducts(filters, limit);
    return res.status(200).json(buildMetricsResponse('products', products));
  } catch (error) {
    next(error);
  }
}

async function getMonthlyProfits(req, res, next) {
  try {
    const filters = getFilters(req);
    const months = Math.min(Math.max(Number(req.query.months) || 12, 1), 24);
    const monthly = await metricsModel.getMonthlyProfits(filters, months);
    return res.status(200).json(buildMetricsResponse('months', monthly));
  } catch (error) {
    next(error);
  }
}

async function getCategorySales(req, res, next) {
  try {
    const filters = getFilters(req);

    if (hasInvalidDateRange(filters)) {
      return res.status(400).json(buildMessageResponse('Las fechas de metricas no son validas'));
    }

    const categories = await metricsModel.getCategorySales(filters);
    return res.status(200).json(buildMetricsResponse('categories', categories));
  } catch (error) {
    next(error);
  }
}

async function getSalesDetail(req, res, next) {
  try {
    const filters = getFilters(req);

    if (hasInvalidDateRange(filters)) {
      return res.status(400).json(buildMessageResponse('Las fechas de metricas no son validas'));
    }

    const pagination = parsePaginationParams(req.query);
    const result = await metricsModel.getSalesDetail(
      filters,
      pagination,
      req.query.sortBy || 'fecha',
      req.query.sortOrder || 'desc',
    );

    return res.status(200).json(
      buildMetricsDetailResponse(result.items, {
        ...pagination,
        total: result.total,
      }),
    );
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getCategorySales,
  getMonthlyProfits,
  getSalesDetail,
  getSummary,
  getTopProducts,
};
