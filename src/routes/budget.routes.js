const { Router } = require('express');

const budgetController = require('../controllers/budget.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { validateNumericParams } = require('../middlewares/request-validation.middleware');

const router = Router();

router.get('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), budgetController.listBudgets);
router.get('/:id', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin', 'vendedor']), budgetController.getBudgetById);
router.post('/draft', authMiddleware, roleMiddleware(['admin', 'vendedor']), budgetController.saveDraftBudget);
router.post('/:id/confirm', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin', 'vendedor']), budgetController.confirmDraftBudget);
router.post('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), budgetController.createBudget);

module.exports = router;
