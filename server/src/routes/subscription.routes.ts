import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  checkout,
  customerPortal,
  getSubscription,
  getUsageStats,
} from '../controllers/subscription.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/', getSubscription);
router.get('/usage', getUsageStats);
router.post('/checkout', requireRole('OWNER'), checkout);
router.post('/portal', requireRole('OWNER'), customerPortal);

export default router;
