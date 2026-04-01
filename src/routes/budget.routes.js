const { Router } = require('express');

const budgetController = require('../controllers/budget.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = Router();

router.get('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), budgetController.listBudgets);
router.get('/:id', authMiddleware, roleMiddleware(['admin', 'vendedor']), budgetController.getBudgetById);
router.post('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), budgetController.createBudget);

module.exports = router;
