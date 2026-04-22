import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createOrder,
  getOrder,
  listOrders,
  updateStatus,
} from '../controllers/order.controller.js';

const router = Router();
router.use(requireAuth);

router.get('/', listOrders);
router.post('/', createOrder);
router.get('/:id', getOrder);
router.put('/:id/status', updateStatus);

export default router;
