import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  generateQRCode,
  getBusiness,
  updateBusiness,
} from '../controllers/business.controller.js';

// Public (no auth) — QR code image
const publicBusinessRouter = Router();
publicBusinessRouter.get('/qr/:slug', generateQRCode);

// Authenticated
const router = Router();
router.use(requireAuth);
router.get('/', getBusiness);
router.put('/', updateBusiness);

export { publicBusinessRouter };
export default router;
