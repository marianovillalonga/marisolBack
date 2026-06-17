const { Router } = require('express');

const orderController = require('../controllers/order.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { validateNumericParams } = require('../middlewares/request-validation.middleware');

const router = Router();

router.get('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), orderController.listOrders);
router.get('/:id', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin', 'vendedor']), orderController.getOrderById);
router.post('/draft', authMiddleware, roleMiddleware(['admin', 'vendedor']), orderController.saveDraftOrder);
router.post('/:id/confirm', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin', 'vendedor']), orderController.confirmDraftOrder);
router.post('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), orderController.createOrder);
router.patch('/:id', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin', 'vendedor']), orderController.updatePendingCustomerOrder);
router.patch('/:id/customer', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin', 'vendedor']), orderController.updateCustomerOrder);

module.exports = router;
