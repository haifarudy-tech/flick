import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  createOrder,
  getOrder,
  listOrders,
  updateStatus,
} from '../controllers/order.controller.js';
import { getPublicOrder } from '../controllers/public-order.controller.js';

// Public (no auth)
const publicOrderRouter = Router();
publicOrderRouter.get('/public/:id', getPublicOrder);

// Authenticated
const router = Router();
router.use(requireAuth);
router.get('/', listOrders);
router.post('/', createOrder);
router.get('/:id', getOrder);
router.put('/:id/status', updateStatus);

export { publicOrderRouter };
export default router;
