import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requirePlan } from '../middleware/requirePlan.js';
import {
  clockIn,
  clockOut,
  clockToggle,
  createStaff,
  listStaff,
  roster,
  timesheet,
  updateStaff,
} from '../controllers/staff.controller.js';

const router = Router();

// Public endpoints — no auth, used by the wall-mounted clock widget
router.get('/roster', roster);
router.post('/clock-toggle', clockToggle);

// Protected management endpoints — PRO plan required
router.use(requireAuth);
router.use(requirePlan('PRO'));

router.get('/', listStaff);
router.get('/timesheet', timesheet);
router.post('/', requireRole('OWNER', 'MANAGER'), createStaff);
router.put('/:id', requireRole('OWNER', 'MANAGER'), updateStaff);
router.post('/:id/clock-in', clockIn);
router.post('/:id/clock-out', clockOut);

export default router;
