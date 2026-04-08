const { Router } = require('express');

const saleController = require('../controllers/sale.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { validateNumericParams } = require('../middlewares/request-validation.middleware');

const router = Router();

router.get('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), saleController.listSales);
router.get('/summary', authMiddleware, roleMiddleware(['admin', 'vendedor']), saleController.getSalesSummary);
router.get('/:id', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin', 'vendedor']), saleController.getSaleById);
router.post('/draft', authMiddleware, roleMiddleware(['admin', 'vendedor']), saleController.saveDraftSale);
router.post('/:id/confirm', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin', 'vendedor']), saleController.confirmDraftSale);
router.post('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), saleController.createSale);
router.delete('/:id', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin']), saleController.cancelSale);

module.exports = router;
