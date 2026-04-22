import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getBusiness, updateBusiness } from '../controllers/business.controller.js';

const router = Router();

router.use(requireAuth);
router.get('/', getBusiness);
router.put('/', updateBusiness);

export default router;
