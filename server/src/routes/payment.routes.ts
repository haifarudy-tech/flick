import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  cashPayment,
  createPaymentIntent,
  refund,
  terminalSession,
} from '../controllers/payment.controller.js';

const router = Router();
router.use(requireAuth);

router.post('/intent', createPaymentIntent);
router.post('/terminal/session', terminalSession);
router.post('/cash', cashPayment);
router.post('/:id/refund', refund);

export default router;
