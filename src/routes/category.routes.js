const { Router } = require('express');

const categoryController = require('../controllers/category.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { validateNumericParams } = require('../middlewares/request-validation.middleware');

const router = Router();

router.get('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), categoryController.listCategories);
router.post('/', authMiddleware, roleMiddleware(['admin']), categoryController.createCategory);
router.delete(
  '/:id',
  authMiddleware,
  validateNumericParams(['id']),
  roleMiddleware(['admin']),
  categoryController.deleteCategory,
);

module.exports = router;
