const { Router } = require('express');

const productController = require('../controllers/product.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const router = Router();

router.get('/categories', authMiddleware, roleMiddleware(['admin', 'vendedor']), productController.listCategories);
router.get('/', authMiddleware, roleMiddleware(['admin', 'vendedor']), productController.listProducts);
router.get('/:id', authMiddleware, roleMiddleware(['admin', 'vendedor']), productController.getProductById);
router.post('/', authMiddleware, roleMiddleware(['admin']), productController.createProduct);
router.patch('/price-adjustment', authMiddleware, roleMiddleware(['admin']), productController.adjustPricesByCategory);
router.put('/:id', authMiddleware, roleMiddleware(['admin']), productController.updateProduct);
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), productController.deleteProduct);

module.exports = router;
