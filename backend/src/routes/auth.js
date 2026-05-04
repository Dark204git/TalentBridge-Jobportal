import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, getMe, changePassword, forgotPassword, resetPassword, deleteAccount } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many auth attempts, please try again later' },
});

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePassword);
router.delete('/account',        authenticate, deleteAccount);


export default router;