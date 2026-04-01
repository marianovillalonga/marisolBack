const { Router } = require('express');

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { loginRateLimit } = require('../middlewares/rate-limit.middleware');

const router = Router();

router.post('/login', loginRateLimit, authController.login);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
