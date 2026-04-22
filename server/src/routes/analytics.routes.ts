import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  deliveryBreakdown,
  exportCsv,
  hourly,
  staffPerformance,
  summary,
  topItems,
} from '../controllers/analytics.controller.js';

const router = Router();
router.use(requireAuth);
router.get('/summary', summary);
router.get('/hourly', hourly);
router.get('/items', topItems);
router.get('/staff', staffPerformance);
router.get('/delivery', deliveryBreakdown);
router.get('/export', exportCsv);

export default router;
