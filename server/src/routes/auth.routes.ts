import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { login, logout, pinLogin, refresh, signup } from '../controllers/auth.controller.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);
router.post('/refresh', authLimiter, refresh);
router.post('/logout', logout);
router.post('/pin-login', authLimiter, pinLogin);

export default router;
