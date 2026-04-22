import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requirePlan } from '../middleware/requirePlan.js';
import {
  disconnect,
  finishConnect,
  listPlatforms,
  startConnect,
  triggerSync,
  updateSettings,
} from '../controllers/delivery.controller.js';

const router = Router();
router.use(requireAuth);
router.use(requirePlan('STARTER'));

router.get('/platforms', listPlatforms);
router.post('/connect/:platform', requireRole('OWNER', 'MANAGER'), startConnect);
router.post('/callback/:platform', requireRole('OWNER', 'MANAGER'), finishConnect);
router.delete('/disconnect/:platform', requireRole('OWNER', 'MANAGER'), disconnect);
router.post('/sync/:platform', requireRole('OWNER', 'MANAGER'), triggerSync);
router.put('/settings/:platform', requireRole('OWNER', 'MANAGER'), updateSettings);

export default router;
