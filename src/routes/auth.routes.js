const { Router } = require('express');

const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const {
  loginRateLimit,
  passwordResetAttemptRateLimit,
  passwordResetRequestRateLimit,
} = require('../middlewares/rate-limit.middleware');

const router = Router();

router.post('/login', loginRateLimit, authController.login);
router.post('/forgot-password', passwordResetRequestRateLimit, authController.requestPasswordReset);
router.get('/password-reset/:token', passwordResetAttemptRateLimit, authController.validatePasswordResetToken);
router.post('/password-reset', passwordResetAttemptRateLimit, authController.resetPasswordWithToken);
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.me);

module.exports = router;
