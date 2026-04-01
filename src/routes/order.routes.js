const { Router } = require('express');

const orderController = require('../controllers/order.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = Router();

router.get('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), orderController.listOrders);
router.get('/:id', authMiddleware, roleMiddleware(['admin', 'vendedor']), orderController.getOrderById);
router.post('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), orderController.createOrder);

module.exports = router;
