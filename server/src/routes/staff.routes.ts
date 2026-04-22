import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requirePlan } from '../middleware/requirePlan.js';
import {
  clockIn,
  clockOut,
  createStaff,
  listStaff,
  updateStaff,
} from '../controllers/staff.controller.js';

const router = Router();
router.use(requireAuth);
router.use(requirePlan('PRO'));

router.get('/', listStaff);
router.post('/', requireRole('OWNER', 'MANAGER'), createStaff);
router.put('/:id', requireRole('OWNER', 'MANAGER'), updateStaff);
router.post('/:id/clock-in', clockIn);
router.post('/:id/clock-out', clockOut);

export default router;
