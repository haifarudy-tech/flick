import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  cashPayment,
  capturePayment,
  createPaymentIntent,
  refund,
  terminalSession,
} from '../controllers/payment.controller.js';
import { createPublicCheckout } from '../controllers/public-order.controller.js';

// Public (no auth) — guest QR ordering
const publicPaymentRouter = Router();
publicPaymentRouter.post('/public/intent', createPublicCheckout);

// Authenticated — POS / staff payments
const router = Router();
router.use(requireAuth);
router.post('/intent', createPaymentIntent);
router.post('/terminal/session', terminalSession);
router.post('/capture', capturePayment);
router.post('/cash', cashPayment);
router.post('/:id/refund', refund);

export { publicPaymentRouter };
export default router;
