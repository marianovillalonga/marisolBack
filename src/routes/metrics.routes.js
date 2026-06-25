const { Router } = require('express');

const metricsController = require('../controllers/metrics.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = Router();
const canViewMetrics = [authMiddleware, roleMiddleware(['admin', 'vendedor'])];

router.get('/summary', canViewMetrics, metricsController.getSummary);
router.get('/top-products', canViewMetrics, metricsController.getTopProducts);
router.get('/monthly-profits', canViewMetrics, metricsController.getMonthlyProfits);
router.get('/category-sales', canViewMetrics, metricsController.getCategorySales);
router.get('/sales-detail', canViewMetrics, metricsController.getSalesDetail);

module.exports = router;
