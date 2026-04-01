const { Router } = require('express');

const authRoutes = require('./auth.routes');
const budgetRoutes = require('./budget.routes');
const categoryRoutes = require('./category.routes');
const clientRoutes = require('./client.routes');
const orderRoutes = require('./order.routes');
const productRoutes = require('./product.routes');
const saleRoutes = require('./sale.routes');
const userRoutes = require('./user.routes');

const router = Router();

router.use('/auth', authRoutes);
router.use('/budgets', budgetRoutes);
router.use('/categories', categoryRoutes);
router.use('/clients', clientRoutes);
router.use('/orders', orderRoutes);
router.use('/products', productRoutes);
router.use('/sales', saleRoutes);
router.use('/users', userRoutes);

module.exports = router;
