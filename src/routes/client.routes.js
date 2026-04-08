const { Router } = require('express');

const clientController = require('../controllers/client.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { validateNumericParams } = require('../middlewares/request-validation.middleware');

const router = Router();

router.get('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), clientController.listClients);
router.get('/:id', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin', 'vendedor']), clientController.getClientById);
router.post('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), clientController.createClient);
router.put('/:id', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin']), clientController.updateClient);
router.delete('/:id', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin']), clientController.deleteClient);
router.post('/:id/purchases', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin', 'vendedor']), clientController.createPurchase);
router.put('/:id/purchases/:purchaseId', authMiddleware, validateNumericParams(['id', 'purchaseId']), roleMiddleware(['admin', 'vendedor']), clientController.updatePurchase);
router.delete('/:id/purchases/:purchaseId', authMiddleware, validateNumericParams(['id', 'purchaseId']), roleMiddleware(['admin', 'vendedor']), clientController.deletePurchase);

module.exports = router;
