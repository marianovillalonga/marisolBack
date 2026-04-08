const { Router } = require('express');

const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { validateNumericParams } = require('../middlewares/request-validation.middleware');

const router = Router();

router.post('/', authMiddleware, roleMiddleware(['admin']), userController.createUser);
router.get('/', authMiddleware, roleMiddleware(['admin']), userController.listUsers);
router.put('/profile', authMiddleware, userController.updateProfile);
router.put('/password', authMiddleware, userController.updatePassword);
router.put('/:id', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin']), userController.updateUserByAdmin);
router.patch('/:id/block', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin']), userController.blockUser);
router.patch('/:id/unblock', authMiddleware, validateNumericParams(['id']), roleMiddleware(['admin']), userController.unblockUser);

module.exports = router;
