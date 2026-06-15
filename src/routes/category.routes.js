const { Router } = require('express');

const categoryController = require('../controllers/category.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { validateNumericParams } = require('../middlewares/request-validation.middleware');

const router = Router();

router.get('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), categoryController.listCategories);
router.get('/subcategories', authMiddleware, roleMiddleware(['admin', 'vendedor']), categoryController.listSubcategories);
router.post('/', authMiddleware, roleMiddleware(['admin']), categoryController.createCategory);
router.post('/subcategories', authMiddleware, roleMiddleware(['admin']), categoryController.createSubcategory);
router.put(
  '/subcategories/:id',
  authMiddleware,
  validateNumericParams(['id']),
  roleMiddleware(['admin']),
  categoryController.updateSubcategory,
);
router.delete(
  '/subcategories/:id',
  authMiddleware,
  validateNumericParams(['id']),
  roleMiddleware(['admin']),
  categoryController.deleteSubcategory,
);
router.put(
  '/:id',
  authMiddleware,
  validateNumericParams(['id']),
  roleMiddleware(['admin']),
  categoryController.updateCategory,
);
router.delete(
  '/:id',
  authMiddleware,
  validateNumericParams(['id']),
  roleMiddleware(['admin']),
  categoryController.deleteCategory,
);

module.exports = router;
